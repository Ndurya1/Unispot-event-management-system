from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.admin_allocations import router as admin_allocations_router
from app.api.routes.audit import router as audit_router
from app.api.routes.availability import router as availability_router
from app.api.routes.bookings import router as bookings_router
from app.api.routes.facilities import router as facilities_router
from app.api.routes.health import router as health_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.organizations import router as organizations_router
from app.api.routes.venues import router as venues_router
from app.core.config import Settings, get_settings
from app.db.session import dispose_engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await dispose_engine()


def create_application(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    application = FastAPI(
        title=app_settings.app_name,
        description="Automated venue discovery and booking for Kisii University",
        version=app_settings.app_version,
        lifespan=lifespan,
    )
    application.state.settings = app_settings
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in app_settings.allowed_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(health_router)
    application.include_router(organizations_router)
    application.include_router(venues_router)
    application.include_router(facilities_router)
    application.include_router(availability_router)
    application.include_router(bookings_router)
    application.include_router(admin_allocations_router)
    application.include_router(notifications_router)
    application.include_router(audit_router)
    return application


app = create_application()
