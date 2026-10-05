from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.admin_allocations import router as admin_allocations_router
from app.api.routes.assistant import router as assistant_router
from app.api.routes.audit import router as audit_router
from app.api.routes.auth import router as auth_router
from app.api.routes.availability import router as availability_router
from app.api.routes.bookings import router as bookings_router
from app.api.routes.facilities import router as facilities_router
from app.api.routes.health import router as health_router
from app.api.routes.metrics import router as metrics_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.organizations import router as organizations_router
from app.api.routes.venues import router as venues_router
from app.core.config import Settings, get_settings
from app.core.http_errors import ErrorResponse, install_error_handlers
from app.core.http_middleware import HttpMiddleware
from app.core.observability import configure_logging
from app.core.rate_limit import PostgresRateLimiter
from app.db.session import AsyncSessionFactory, dispose_engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await dispose_engine()


def create_application(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    configure_logging()
    application = FastAPI(
        title=app_settings.app_name,
        description="Automated venue discovery and booking for Kisii University",
        version=app_settings.app_version,
        lifespan=lifespan,
        responses={
            code: {"model": ErrorResponse}
            for code in (400, 401, 403, 404, 405, 408, 409, 413, 422, 429, 500, 503)
        },
    )
    application.state.settings = app_settings
    application.add_middleware(
        HttpMiddleware,
        settings=app_settings,
        limiter=PostgresRateLimiter(AsyncSessionFactory),
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in app_settings.allowed_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "Retry-After"],
    )
    install_error_handlers(application)
    application.include_router(auth_router)
    application.include_router(metrics_router)
    application.include_router(health_router)
    application.include_router(organizations_router)
    application.include_router(venues_router)
    application.include_router(facilities_router)
    application.include_router(availability_router)
    application.include_router(bookings_router)
    application.include_router(admin_allocations_router)
    application.include_router(notifications_router)
    application.include_router(audit_router)
    application.include_router(assistant_router)
    return application


app = create_application()
