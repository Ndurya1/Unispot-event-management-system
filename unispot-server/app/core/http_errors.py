from collections.abc import Mapping
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from app.core.observability import request_id_context


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str
    details: list[dict[str, Any]] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorDetail


def error_response(
    status: int,
    code: str,
    message: str,
    *,
    details: list[dict[str, Any]] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    request_id = str(request_id_context.get() or uuid4())
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "request_id": request_id,
                "details": details or [],
            }
        },
        headers={**(headers or {}), "X-Request-ID": request_id},
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        codes = {
            400: "invalid_request",
            401: "authentication_required",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            409: "conflict",
            413: "payload_too_large",
            422: "validation_error",
            429: "rate_limited",
            503: "service_unavailable",
        }
        code = codes.get(exc.status_code, "request_failed")
        detail = exc.detail
        message = detail if isinstance(detail, str) else "Request could not be completed"
        details: list[dict[str, Any]] = []
        if isinstance(detail, list):
            details = [
                {"code": item.get("code", "invalid"), "message": item.get("message", "Invalid")}
                for item in detail
                if isinstance(item, dict)
            ]
        if isinstance(detail, dict):
            code = detail.get("code", code)
            message = detail.get("message", message)
        if exc.status_code >= 500:
            message = "Service is temporarily unavailable"
        return error_response(exc.status_code, code, message, details=details, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Pydantic input, context, and exception messages can contain passwords/chat text.
        details = [{"location": list(item["loc"]), "code": item["type"]} for item in exc.errors()]
        return error_response(422, "validation_error", "Request validation failed", details=details)

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
        return error_response(409, "integrity_conflict", "The request conflicts with stored data")

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        return error_response(503, "database_unavailable", "Database is temporarily unavailable")
