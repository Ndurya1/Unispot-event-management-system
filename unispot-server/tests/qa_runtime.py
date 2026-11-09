"""Local QA server and seed utility: never use outside the isolated audit DB."""

import asyncio
import sys
from datetime import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.db.session import AsyncSessionFactory, dispose_engine
from app.main import create_application
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRoles
from app.models.venue_operating_hours import VenueOperatingHours
from app.services import auth_service
from tests.integration.test_release import seed

target = make_url(get_settings().database_url.get_secret_value())
if target.host != "127.0.0.1" or target.port != 55432 or target.database != "unispot_qa":
    raise RuntimeError("QA runtime is restricted to the isolated local audit database")

# Browser route sweeps intentionally exceed ten session checks per minute.
# Rate limiting itself is tested separately using the normal release fixture.
app = create_application(
    get_settings().model_copy(
        update={
            "rate_limit_login": 10000,
            "rate_limit_availability": 10000,
        }
    )
)


async def mock_email(**kwargs: Any) -> bool:
    return True


for email_function in ("send_verification_email", "send_password_reset_email"):
    setattr(auth_service, email_function, mock_email)


async def seed_browser() -> None:
    from app.core.security import hash_password

    for role in ("STUDENT", "ORGANIZER", "SYSTEM_ADMIN", "SERVICE_PROVIDER", "VENUE_ADMIN"):
        email = f"qa-audit-{role.lower()}@example.com"
        async with AsyncSessionFactory() as session:
            if await session.scalar(select(User.id).where(User.email == email)):
                continue
        user_id, booking = await seed(AsyncSessionFactory)
        async with AsyncSessionFactory() as session:
            user = await session.get(User, user_id)
            assert user is not None
            user.email = email
            user.full_name = f"QA {role}"
            user.password_hash = hash_password("Local-QA-only-123!")
            role_id = await session.scalar(select(Role.id).where(Role.name == role))
            if role_id is None:
                r = Role(name=role)
                session.add(r)
                await session.flush()
                role_id = r.id
            session.add(UserRoles(user_id=user_id, role_id=role_id))
            for day in range(7):
                if day != booking.starts_at.weekday():
                    session.add(
                        VenueOperatingHours(
                            venue_id=booking.venue_id,
                            day_of_week=day,
                            opens_at=time(6),
                            closes_at=time(23),
                        )
                    )
            await session.commit()
    await dispose_engine()
    print("Five synthetic QA accounts and venues seeded; email transport mocked.")


if __name__ == "__main__":
    if sys.argv[1:] != ["seed"]:
        raise SystemExit("Use python -m tests.qa_runtime seed")
    asyncio.run(seed_browser())
