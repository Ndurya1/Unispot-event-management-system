"""Release checks use a disposable DB; no application data is deleted."""

import asyncio
import os
import sys
from collections.abc import AsyncIterator
from datetime import UTC, datetime, time, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.dependencies.database import get_db
from app.core.config import get_settings
from app.core.rate_limit import PostgresRateLimiter
from app.core.security import hash_password
from app.main import create_application
from app.models.assistant import AssistantToolCall
from app.models.audit_event import AuditEvent
from app.models.booking import Booking, BookingSource, BookingStatus
from app.models.booking_event import BookingEvent, BookingEventType
from app.models.notification import (
    DeliveryStatus,
    Notification,
    NotificationChannel,
    NotificationType,
)
from app.models.organization import Organization, OrganizationStatus, OrganizationType
from app.models.organization_membership import (
    MembershipRole,
    MembershipStatus,
    OrganizationMembership,
)
from app.models.role import Role
from app.models.user import User, UserStatus
from app.models.user_role import UserRoles
from app.models.venue import Venue, VenueStatus
from app.models.venue_operating_hours import VenueOperatingHours
from app.schemas.assistant import AssistantMessageRequest, AssistantToolInvocation, ToolName
from app.schemas.booking import BookingCancelRequest, BookingCreate
from app.services.assistant_provider import AssistantProviderPlan
from app.services.assistant_service import process_assistant_message
from app.services.booking_lifecycle import CancellationError, cancel_booking, get_owned_booking
from app.services.booking_policy import BookingPolicyError, validate_booking_policy
from app.services.booking_service import (
    BookingConflictError,
    IdempotencyConflictError,
    create_booking,
)
from app.services.notification_worker import process_pending_notifications
from app.services.venue_service import create_block

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="module")]
BACKEND_ROOT = Path(__file__).resolve().parents[2]


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def release_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    configured = os.getenv("TEST_DATABASE_URL")
    if not configured:
        pytest.skip("TEST_DATABASE_URL is not configured")
    database = "unispot_release_" + uuid4().hex
    base = make_url(configured)
    admin = create_async_engine(base, isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        await conn.execute(text(f'CREATE DATABASE "{database}"'))
    target = base.set(database=database)
    engine = create_async_engine(target, pool_size=10)
    try:
        env = {
            **os.environ,
            "APP_ENV": "test",
            "DATABASE_URL": target.render_as_string(hide_password=False),
        }
        for command in (("upgrade", "head"), ("downgrade", "base"), ("upgrade", "head")):
            proc = await asyncio.create_subprocess_exec(
                sys.executable,
                "-m",
                "alembic",
                *command,
                cwd=BACKEND_ROOT,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            output, _ = await proc.communicate()
            assert proc.returncode == 0, output.decode(errors="replace")
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        await engine.dispose()
        async with admin.connect() as conn:
            await conn.execute(text(f'DROP DATABASE "{database}" WITH (FORCE)'))
        await admin.dispose()


async def seed(factory: async_sessionmaker[AsyncSession]) -> tuple[UUID, BookingCreate]:
    async with factory() as session:
        user = User(
            full_name="Release organizer", email=f"{uuid4()}@example.com", status=UserStatus.ACTIVE
        )
        organization = Organization(
            name=str(uuid4()),
            slug=str(uuid4()),
            organization_type=OrganizationType.CLUB,
            status=OrganizationStatus.ACTIVE,
        )
        venue = Venue(
            name=str(uuid4()),
            code=uuid4().hex,
            location="Campus",
            capacity=100,
            status=VenueStatus.ACTIVE,
            timezone="Africa/Nairobi",
        )
        session.add_all([user, organization, venue])
        await session.flush()
        session.add(
            OrganizationMembership(
                user_id=user.id,
                organization_id=organization.id,
                membership_role=MembershipRole.ORGANIZER,
                status=MembershipStatus.ACTIVE,
            )
        )
        start = (datetime.now(UTC) + timedelta(days=5)).replace(
            hour=8, minute=0, second=0, microsecond=0
        )
        session.add(
            VenueOperatingHours(
                venue_id=venue.id,
                day_of_week=start.weekday(),
                opens_at=time(6),
                closes_at=time(23),
            )
        )
        await session.commit()
        return user.id, BookingCreate(
            venue_id=venue.id,
            organization_id=organization.id,
            event_name="Release test",
            expected_attendance=25,
            starts_at=start,
            ends_at=start + timedelta(hours=2),
        )


async def book(
    factory: async_sessionmaker[AsyncSession],
    user_id: UUID,
    data: BookingCreate,
    key: str,
) -> Booking:
    async with factory() as session:
        user = await session.get(User, user_id)
        assert user is not None
        return await create_booking(session, requester=user, data=data, idempotency_key=key)


async def test_atomic_conflicts_replay_back_to_back_and_cancellation(
    release_db: async_sessionmaker[AsyncSession],
) -> None:
    user_id, data = await seed(release_db)
    results = await asyncio.gather(
        book(release_db, user_id, data, "a"),
        book(release_db, user_id, data, "b"),
        return_exceptions=True,
    )
    bookings = [item for item in results if isinstance(item, Booking)]
    assert len(bookings) == 1
    assert sum(isinstance(item, BookingConflictError) for item in results) == 1
    winning_key = "a" if isinstance(results[0], Booking) else "b"
    replay = await book(release_db, user_id, data, winning_key)
    assert replay.id == bookings[0].id
    adjacent = data.model_copy(
        update={"starts_at": data.ends_at, "ends_at": data.ends_at + timedelta(hours=1)}
    )
    await book(release_db, user_id, adjacent, "adjacent")
    async with release_db() as session:
        user = await session.get(User, user_id)
        assert user is not None
        cancelled = await cancel_booking(
            session,
            booking_id=bookings[0].id,
            requester=user,
            data=BookingCancelRequest(),
            idempotency_key="cancel",
        )
        assert cancelled.status == BookingStatus.CANCELLED
        assert (
            await session.scalar(
                select(func.count())
                .select_from(AuditEvent)
                .where(
                    AuditEvent.actor_user_id == user_id,
                    AuditEvent.action == "BOOKING_CANCELLED",
                )
            )
            == 1
        )
    replacement = await book(release_db, user_id, data, "replacement")
    assert replacement.id != bookings[0].id


async def turn(
    factory: async_sessionmaker[AsyncSession],
    user_id: UUID,
    request: AssistantMessageRequest,
) -> object:
    async with factory() as session:
        user = await session.get(User, user_id)
        assert user is not None
        return await process_assistant_message(session, requester=user, request=request)


async def test_assistant_confirmation_create_retry_cancel_and_ownership(
    release_db: async_sessionmaker[AsyncSession],
) -> None:
    from app.schemas.assistant import AssistantMessageResponse

    user_id, data = await seed(release_db)
    action = AssistantToolInvocation(
        name=ToolName.CREATE_BOOKING, arguments=data.model_dump(mode="json")
    )
    with pytest.raises(HTTPException):
        await turn(
            release_db,
            user_id,
            AssistantMessageRequest(message="confirm", confirmed=True, tool_calls=[action]),
        )
    proposal = await turn(
        release_db, user_id, AssistantMessageRequest(message="book", tool_calls=[action])
    )
    assert isinstance(proposal, AssistantMessageResponse)
    pending = proposal.state["pending_confirmation"]
    assert isinstance(pending, dict)
    confirm = AssistantMessageRequest(
        conversation_id=proposal.conversation_id,
        message="Confirm",
        confirmed=True,
        confirmation_id=UUID(str(pending["confirmation_id"])),
    )
    other_id, _ = await seed(release_db)
    with pytest.raises(ValueError, match="Conversation not found"):
        await turn(release_db, other_id, confirm)
    result = await turn(release_db, user_id, confirm)
    assert isinstance(result, AssistantMessageResponse)
    assert result.tool_results[0].status == "succeeded"
    booking_id = result.tool_results[0].booking_id
    assert booking_id is not None
    repeated = await turn(release_db, user_id, confirm)
    assert isinstance(repeated, AssistantMessageResponse)
    assert repeated.tool_results[0].booking_id == booking_id
    async with release_db() as session:
        assert await get_owned_booking(session, booking_id, other_id) is None
        other = await session.get(User, other_id)
        assert other is not None
        with pytest.raises(CancellationError, match="Booking not found"):
            await cancel_booking(
                session,
                booking_id=booking_id,
                requester=other,
                data=BookingCancelRequest(),
                idempotency_key="not-owner",
            )
    cancel_proposal = await turn(
        release_db,
        user_id,
        AssistantMessageRequest(
            conversation_id=proposal.conversation_id,
            message="cancel",
            tool_calls=[
                AssistantToolInvocation(
                    name=ToolName.CANCEL_MY_BOOKING, arguments={"booking_id": str(booking_id)}
                ),
            ],
        ),
    )
    assert isinstance(cancel_proposal, AssistantMessageResponse)
    pending_cancel = cancel_proposal.state["pending_confirmation"]
    assert isinstance(pending_cancel, dict)
    cancelled = await turn(
        release_db,
        user_id,
        AssistantMessageRequest(
            conversation_id=proposal.conversation_id,
            message="Confirm cancel",
            confirmed=True,
            confirmation_id=UUID(str(pending_cancel["confirmation_id"])),
        ),
    )
    assert isinstance(cancelled, AssistantMessageResponse)
    assert cancelled.tool_results[0].status == "succeeded"
    async with release_db() as session:
        row = await session.get(Booking, booking_id)
        assert row is not None and row.source == BookingSource.ASSISTANT
        assert row.status == BookingStatus.CANCELLED
        assert (
            await session.scalar(
                select(func.count())
                .select_from(AssistantToolCall)
                .where(
                    AssistantToolCall.booking_id == booking_id,
                )
            )
            == 3
        )  # creation, safe replay, cancellation


async def test_shared_rate_limit_is_atomic(release_db: async_sessionmaker[AsyncSession]) -> None:
    limiter = PostgresRateLimiter(release_db)
    results = await asyncio.gather(
        *(limiter.check(uuid_key, 3, 3600) for uuid_key in [uuid4().hex] * 8)
    )
    assert results.count(0) == 3
    assert sum(item > 0 for item in results) == 5


async def test_worker_stops_retrying_at_cap(release_db: async_sessionmaker[AsyncSession]) -> None:
    user_id, data = await seed(release_db)
    booking = await book(release_db, user_id, data, "notification-failure")
    async with release_db() as session:
        notification = Notification(
            user_id=user_id,
            type=NotificationType.CONFIRMED,
            channel=NotificationChannel.EMAIL,
            title="Delivery test",
            body="test",
            delivery_status=DeliveryStatus.FAILED,
            attempt_count=5,
        )
        session.add(notification)
        await session.commit()
        await process_pending_notifications(session)
        await session.refresh(notification)
        assert notification.attempt_count == 5
        last_attempt = Notification(
            user_id=user_id,
            booking_id=booking.id,
            type=NotificationType.CONFIRMED,
            channel=NotificationChannel.EMAIL,
            title="Last attempt",
            body="test",
            delivery_status=DeliveryStatus.PENDING,
            attempt_count=4,
        )
        session.add(last_attempt)
        await session.commit()
        await process_pending_notifications(session)
        await session.refresh(last_attempt)
        assert last_attempt.delivery_status == DeliveryStatus.FAILED
        assert last_attempt.attempt_count == 5
        persisted = await session.get(Booking, booking.id)
        assert persisted is not None and persisted.status == BookingStatus.CONFIRMED


async def test_block_prevents_web_and_assistant_writes(
    release_db: async_sessionmaker[AsyncSession],
) -> None:
    from app.schemas.assistant import AssistantMessageResponse

    user_id, data = await seed(release_db)
    async with release_db() as session:
        await create_block(
            session, data.venue_id, data.starts_at, data.ends_at, "Maintenance", user_id
        )
    with pytest.raises(BookingConflictError):
        await book(release_db, user_id, data, "blocked")
    proposal = await turn(
        release_db,
        user_id,
        AssistantMessageRequest(
            message="book",
            tool_calls=[
                AssistantToolInvocation(
                    name=ToolName.CREATE_BOOKING, arguments=data.model_dump(mode="json")
                ),
            ],
        ),
    )
    assert isinstance(proposal, AssistantMessageResponse)
    pending = proposal.state["pending_confirmation"]
    assert isinstance(pending, dict)
    result = await turn(
        release_db,
        user_id,
        AssistantMessageRequest(
            conversation_id=proposal.conversation_id,
            message="confirm",
            confirmed=True,
            confirmation_id=UUID(str(pending["confirmation_id"])),
        ),
    )
    assert isinstance(result, AssistantMessageResponse)
    assert result.tool_results[0].status == "failed"


class BrokenProvider:
    async def complete(self, *, message: str, state: dict[str, object]) -> AssistantProviderPlan:
        raise RuntimeError("provider secret")


async def test_provider_failure_keeps_web_booking_usable(
    release_db: async_sessionmaker[AsyncSession],
) -> None:
    user_id, data = await seed(release_db)
    async with release_db() as session:
        user = await session.get(User, user_id)
        assert user is not None
        response = await process_assistant_message(
            session,
            requester=user,
            request=AssistantMessageRequest(message="book"),
            provider=BrokenProvider(),
        )
        assert "temporarily unavailable" in response.response
        assert "secret" not in response.response
    booking = await book(release_db, user_id, data, "web-fallback")
    assert booking.status == BookingStatus.CONFIRMED


async def test_simultaneous_same_key_replays_and_rejects_changed_payload(
    release_db: async_sessionmaker[AsyncSession],
) -> None:
    user_id, data = await seed(release_db)
    first, second = await asyncio.gather(
        book(release_db, user_id, data, "same-key"),
        book(release_db, user_id, data, "same-key"),
    )
    assert first.id == second.id
    with pytest.raises(IdempotencyConflictError):
        await book(
            release_db, user_id, data.model_copy(update={"event_name": "Changed"}), "same-key"
        )


async def test_business_rule_boundaries(release_db: async_sessionmaker[AsyncSession]) -> None:
    user_id, data = await seed(release_db)
    async with release_db() as session:
        user = await session.get(User, user_id)
        venue = await session.get(Venue, data.venue_id)
        assert user is not None and venue is not None

        # Exactly 24 hours ahead and exactly 12 hours long are allowed.
        async def validate(duration: timedelta, notice: timedelta = timedelta(hours=24)) -> None:
            assert user is not None and venue is not None
            await validate_booking_policy(
                session,
                requester=user,
                venue=venue,
                organization_id=data.organization_id,
                starts_at=data.starts_at,
                ends_at=data.starts_at + duration,
                expected_attendance=25,
                now=data.starts_at - notice,
            )

        await validate(timedelta(hours=12))
        with pytest.raises(BookingPolicyError) as too_long:
            await validate(timedelta(hours=12, seconds=1))
        assert "maximum_duration" in {v.code for v in too_long.value.violations}
        with pytest.raises(BookingPolicyError) as too_soon:
            await validate(timedelta(hours=2), timedelta(hours=23))
        assert "minimum_lead_time" in {v.code for v in too_soon.value.violations}


async def test_invalid_replacement_revokes_old_confirmation(
    release_db: async_sessionmaker[AsyncSession],
) -> None:
    from app.schemas.assistant import AssistantMessageResponse

    user_id, data = await seed(release_db)
    proposal = await turn(
        release_db,
        user_id,
        AssistantMessageRequest(
            message="book",
            tool_calls=[
                AssistantToolInvocation(
                    name=ToolName.CREATE_BOOKING, arguments=data.model_dump(mode="json")
                ),
            ],
        ),
    )
    assert isinstance(proposal, AssistantMessageResponse)
    pending = proposal.state["pending_confirmation"]
    assert isinstance(pending, dict)
    failed = await turn(
        release_db,
        user_id,
        AssistantMessageRequest(
            conversation_id=proposal.conversation_id,
            message="change the requester",
            tool_calls=[
                AssistantToolInvocation(
                    name=ToolName.CREATE_BOOKING,
                    arguments={
                        **data.model_dump(mode="json"),
                        "requester_id": str(uuid4()),
                        "sql": "private-secret",
                    },
                ),
            ],
        ),
    )
    assert isinstance(failed, AssistantMessageResponse)
    assert failed.tool_results[0].status == "failed"
    assert "private-secret" not in failed.model_dump_json()
    with pytest.raises(HTTPException):
        await turn(
            release_db,
            user_id,
            AssistantMessageRequest(
                conversation_id=proposal.conversation_id,
                message="confirm",
                confirmed=True,
                confirmation_id=UUID(str(pending["confirmation_id"])),
            ),
        )
    async with release_db() as session:
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Booking)
                .where(
                    Booking.requester_id == user_id,
                )
            )
            == 0
        )


async def test_concurrent_conversation_turn_is_rejected(
    release_db: async_sessionmaker[AsyncSession],
) -> None:
    from app.schemas.assistant import AssistantMessageResponse

    user_id, _ = await seed(release_db)
    initial = await turn(release_db, user_id, AssistantMessageRequest(message="rules"))
    assert isinstance(initial, AssistantMessageResponse)
    entered, finish = asyncio.Event(), asyncio.Event()

    class WaitingProvider:
        async def complete(
            self, *, message: str, state: dict[str, object]
        ) -> AssistantProviderPlan:
            entered.set()
            await finish.wait()
            return AssistantProviderPlan(response="Done")

    async def waiting_turn() -> None:
        async with release_db() as session:
            user = await session.get(User, user_id)
            assert user is not None
            await process_assistant_message(
                session,
                requester=user,
                provider=WaitingProvider(),
                request=AssistantMessageRequest(
                    conversation_id=initial.conversation_id, message="wait"
                ),
            )

    task = asyncio.create_task(waiting_turn())
    try:
        await asyncio.wait_for(entered.wait(), timeout=5)
        with pytest.raises(HTTPException) as busy:
            await turn(
                release_db,
                user_id,
                AssistantMessageRequest(
                    conversation_id=initial.conversation_id, message="second turn"
                ),
            )
        assert busy.value.status_code == 409
    finally:
        finish.set()
        await task


async def test_http_login_booking_audit_admin_and_cancellation(
    release_db: async_sessionmaker[AsyncSession],
) -> None:
    user_id, data = await seed(release_db)
    async with release_db() as session:
        user = await session.get(User, user_id)
        assert user is not None
        user.password_hash = hash_password("release-test-password")
        email = user.email
        await session.commit()

    app = create_application(get_settings().model_copy(update={"rate_limit_enabled": False}))

    async def database() -> AsyncIterator[AsyncSession]:
        async with release_db() as session:
            yield session

    app.dependency_overrides[get_db] = database
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post(
            "/auth/login", json={"email": email, "password": "release-test-password"}
        )
        assert login.status_code == 200, login.text
        client.headers["Authorization"] = "Bearer " + login.json()["access_token"]
        assert (await client.get("/admin/metrics")).status_code == 403
        assert (await client.get("/admin/allocations")).status_code == 403
        request_id = str(uuid4())
        created = await client.post(
            "/bookings",
            json=data.model_dump(mode="json"),
            headers={
                "Idempotency-Key": "http-create",
                "X-Request-ID": request_id,
            },
        )
        assert created.status_code == 201, created.text
        booking_id = UUID(created.json()["id"])
        assert created.json()["status"] == "CONFIRMED"
        assert created.headers["X-Request-ID"] == request_id
        assert (await client.get(f"/bookings/{booking_id}")).status_code == 200
        assert (await client.get("/bookings/me", params={"limit": 101})).status_code == 422
        async with release_db() as session:
            event = await session.scalar(
                select(AuditEvent).where(
                    AuditEvent.target_id == booking_id,
                    AuditEvent.action == "BOOKING_CREATED",
                )
            )
            assert event is not None and str(event.request_id) == request_id
            for name in ("VENUE_ADMIN", "SYSTEM_ADMIN"):
                role = await session.scalar(select(Role).where(Role.name == name))
                if role is None:
                    role = Role(name=name)
                    session.add(role)
                    await session.flush()
                session.add(UserRoles(user_id=user_id, role_id=role.id))
            await session.commit()
        allocations = await client.get("/admin/allocations")
        assert allocations.status_code == 200
        assert str(booking_id) in {row["id"] for row in allocations.json()}
        assert (await client.get("/admin/metrics")).status_code == 200
        cancelled = await client.post(
            f"/bookings/{booking_id}/cancel",
            json={},
            headers={
                "Idempotency-Key": "http-cancel",
            },
        )
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "CANCELLED"
        async with release_db() as session:
            history = (
                await session.scalars(
                    select(BookingEvent.event_type).where(
                        BookingEvent.booking_id == booking_id,
                    )
                )
            ).all()
            assert set(history) == {
                BookingEventType.CREATED,
                BookingEventType.CONFIRMED,
                BookingEventType.CANCELLED,
            }
            user = await session.get(User, user_id)
            assert user is not None
            user.status = UserStatus.SUSPENDED
            await session.commit()
        assert (await client.get("/bookings/me")).status_code == 401
        assert (
            await client.post(
                "/auth/login", json={"email": email, "password": "release-test-password"}
            )
        ).status_code == 401
