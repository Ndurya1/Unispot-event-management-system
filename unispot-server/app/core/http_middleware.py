import asyncio
from time import perf_counter
from uuid import UUID, uuid4

from sqlalchemy.exc import SQLAlchemyError
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import Settings
from app.core.http_errors import error_response
from app.core.observability import actor_context, log_event, metrics, request_id_context
from app.core.rate_limit import RateLimiter, bucket_key


class HttpMiddleware:
    def __init__(self, app: ASGIApp, settings: Settings, limiter: RateLimiter) -> None:
        self.app = app
        self.settings = settings
        self.limiter = limiter

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        try:
            request_id = UUID(headers.get("x-request-id", ""))
        except ValueError:
            request_id = uuid4()
        token = request_id_context.set(request_id)
        actor_token = actor_context.set(None)
        started = perf_counter()
        status = 500
        response_started = False

        async def traced_send(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status = message["status"]
                response_headers = MutableHeaders(scope=message)
                response_headers["X-Request-ID"] = str(request_id)
                response_headers["X-Content-Type-Options"] = "nosniff"
                response_headers["Cache-Control"] = "no-store"
            await send(message)

        try:
            group = self._rate_group(scope)
            if group is not None and self.settings.rate_limit_enabled:
                host = str((scope.get("client") or ("unknown", 0))[0])
                key = bucket_key(self.settings.jwt_secret_key.get_secret_value(), group, host)
                limit = getattr(self.settings, f"rate_limit_{group}")
                retry = await self.limiter.check(
                    key, limit, self.settings.rate_limit_window_seconds
                )
                if retry:
                    await error_response(
                        429,
                        "rate_limited",
                        "Too many requests. Please retry later",
                        headers={"Retry-After": str(retry)},
                    )(scope, receive, traced_send)
                    return

            # Enforce the actual streamed size, not just client-supplied Content-Length.
            body = bytearray()
            async with asyncio.timeout(self.settings.request_body_timeout_seconds):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    body.extend(message.get("body", b""))
                    if len(body) > self.settings.max_request_body_bytes:
                        await error_response(413, "payload_too_large", "Request body is too large")(
                            scope,
                            receive,
                            traced_send,
                        )
                        return
                    if not message.get("more_body", False):
                        break
            delivered = False

            async def buffered_receive() -> Message:
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()

            await self.app(scope, buffered_receive, traced_send)
        except TimeoutError:
            if not response_started:
                await error_response(408, "request_timeout", "Request timed out")(
                    scope,
                    receive,
                    traced_send,
                )
        except SQLAlchemyError:
            if not response_started:
                await error_response(503, "database_unavailable", "Database is unavailable")(
                    scope,
                    receive,
                    traced_send,
                )
        except Exception:
            # Do not log the exception: driver/provider errors can embed secrets and SQL.
            if not response_started:
                await error_response(500, "internal_error", "An unexpected error occurred")(
                    scope,
                    receive,
                    traced_send,
                )
        finally:
            elapsed = perf_counter() - started
            route = getattr(scope.get("route"), "path", "unmatched")
            metrics.add(f"http_responses_{status // 100}xx_total")
            metrics.add("http_seconds_total", elapsed)
            log_event(
                "http_request",
                request_id=str(request_id),
                endpoint=route,
                method=scope["method"],
                status=status,
                duration_ms=round(elapsed * 1000, 2),
                actor_id=actor_context.get(),
            )
            actor_context.reset(actor_token)
            request_id_context.reset(token)

    @staticmethod
    def _rate_group(scope: Scope) -> str | None:
        path = scope["path"].rstrip("/")
        if path.startswith("/auth/"):
            return "login"
        if path == "/assistant/messages":
            return "assistant"
        if path.startswith("/bookings") and scope["method"] == "POST":
            return "booking"
        if path in {"/availability", "/venues"} and scope["method"] == "GET":
            return "availability"
        return None
