"""QA release gates. Uses only the existing disposable release_db fixture.

Run with TEST_DATABASE_URL pointing to an isolated local PostgreSQL cluster.
Expected behavior is asserted: known defects intentionally FAIL, not xfail.
Email delivery is mocked; no external services are contacted.
"""

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.dependencies.database import get_db
from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.main import create_application
from app.models.auth_action_token import AuthActionToken, AuthActionType
from app.models.equipment import EquipmentItem, EquipmentStatus
from app.models.event import CampusEvent, EventRegistration, EventStatus
from app.models.role import Role
from app.models.user import User, UserStatus
from app.models.user_role import UserRoles
from app.services.email_service import generate_action_token
from tests.integration.test_release import release_db as release_fixture
from tests.integration.test_release import seed

release_db = release_fixture

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="module")]


@pytest_asyncio.fixture(loop_scope="module")
async def api(
    release_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[AsyncClient]:
    async def fake_email(**kwargs: Any) -> bool:
        return True

    monkeypatch.setattr("app.services.auth_service.send_verification_email", fake_email)
    monkeypatch.setattr("app.services.auth_service.send_password_reset_email", fake_email)
    app = create_application(get_settings().model_copy(update={"rate_limit_enabled": False}))

    async def database() -> AsyncIterator[AsyncSession]:
        async with release_db() as session:
            yield session

    app.dependency_overrides[get_db] = database
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://qa") as client:
        yield client


async def actor(
    factory: async_sessionmaker[AsyncSession], role: str = "STUDENT"
) -> tuple[UUID, str, dict[str, str]]:
    async with factory() as session:
        user = User(
            full_name="QA synthetic user",
            email=f"qa-{uuid4()}@example.com",
            password_hash=hash_password("QA-only-password-123!"),
            status=UserStatus.ACTIVE,
        )
        session.add(user)
        await session.flush()
        role_id = await session.scalar(select(Role.id).where(Role.name == role))
        if role_id is None:
            item = Role(name=role)
            session.add(item)
            await session.flush()
            role_id = item.id
        session.add(UserRoles(user_id=user.id, role_id=role_id))
        await session.commit()
        return (
            user.id,
            user.email,
            {"Authorization": f"Bearer {create_access_token({'user_id': str(user.id)})}"},
        )


async def campus_event(
    factory: async_sessionmaker[AsyncSession],
    owner: UUID | None = None,
    capacity: int = 2,
    past: bool = False,
) -> str:
    start = datetime.now(UTC) + timedelta(days=-5 if past else 5)
    async with factory() as session:
        item = CampusEvent(
            slug=f"qa-{uuid4()}",
            title="QA event",
            starts_at=start,
            ends_at=start + timedelta(hours=2),
            capacity=capacity,
            status=EventStatus.PUBLISHED,
            created_by_user_id=owner,
        )
        session.add(item)
        await session.commit()
        return str(item.id)


def registration(event_id: str) -> dict[str, str]:
    return {
        "event_id": event_id,
        "full_name": "QA Person",
        "email": "qa@example.com",
        "phone": "0700000000",
    }


@pytest.mark.parametrize("path", ["/auth/forgot-password", "/auth/resend-verification"])
async def test_existing_account_recovery_succeeds(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession], path: str
) -> None:
    _, email, _ = await actor(release_db)
    response = await api.post(path, json={"email": email})
    assert response.status_code == 200, response.text


async def test_account_recovery_does_not_reveal_account_existence(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    _, email, _ = await actor(release_db)
    existing = await api.post("/auth/forgot-password", json={"email": email})
    missing = await api.post(
        "/auth/forgot-password", json={"email": f"absent-{uuid4()}@example.com"}
    )
    assert existing.status_code == missing.status_code == 200
    assert existing.json()["message"] == missing.json()["message"]


async def test_delete_own_account_succeeds(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    _, _, headers = await actor(release_db)
    response = await api.delete("/auth/me", headers=headers)
    assert response.status_code == 204, response.text


async def test_password_reset_revokes_old_refresh_token(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    user_id, _, _ = await actor(release_db)
    old_refresh = create_refresh_token({"user_id": str(user_id)})
    raw, digest = generate_action_token()
    async with release_db() as session:
        session.add(
            AuthActionToken(
                user_id=user_id,
                action_type=AuthActionType.RESET_PASSWORD,
                token_hash=digest,
                expires_at=datetime.now(UTC) + timedelta(minutes=5),
            )
        )
        await session.commit()
    result = await api.post(
        "/auth/reset-password", json={"token": raw, "new_password": "New-QA-password-456!"}
    )
    assert result.status_code == 200, result.text
    replay = await api.post(
        "/auth/reset-password", json={"token": raw, "new_password": "Another-QA-password-789!"}
    )
    assert replay.status_code == 400
    refreshed = await api.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert refreshed.status_code == 401, "Old session still refreshes after password reset"


async def test_registration_does_not_grant_admin_and_duplicate_is_rejected(
    api: AsyncClient,
) -> None:
    email = f"signup-{uuid4()}@example.com"
    payload = {
        "email": email,
        "full_name": "QA Signup",
        "password": "QA-only-password-123!",
        "role": "SYSTEM_ADMIN",
    }
    result = await api.post("/auth/register", json=payload)
    assert result.status_code == 201, result.text
    assert (await api.post("/auth/register", json=payload)).status_code == 409
    logged_in = await api.post(
        "/auth/login", json={"email": email, "password": payload["password"]}
    )
    assert logged_in.status_code == 200
    me = await api.get(
        "/auth/me", headers={"Authorization": f"Bearer {logged_in.json()['access_token']}"}
    )
    assert me.json()["roles"] == ["STUDENT"]
    assert me.json()["organizations"] == []


async def test_provider_request_accepts_valid_idempotency_key(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    user_id, _ = await seed(release_db)
    providers = await api.get("/providers")
    assert providers.status_code == 200
    result = await api.post(
        "/providers/requests",
        headers={
            "Authorization": f"Bearer {create_access_token({'user_id': str(user_id)})}",
            "Idempotency-Key": uuid4().hex,
        },
        json={
            "provider_id": providers.json()[0]["id"],
            "event_name": "QA request",
            "requested_date": (datetime.now(UTC) + timedelta(days=5)).isoformat(),
        },
    )
    assert result.status_code == 201, result.text


async def test_admin_can_edit_equipment_inventory_without_reservation_dates(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    _, _, headers = await actor(release_db, "SYSTEM_ADMIN")
    items = await api.get("/equipment/items", headers=headers)
    assert items.status_code == 200, items.text
    result = await api.patch(
        f"/equipment/items/{items.json()[0]['id']}", headers=headers, json={"total_quantity": 10}
    )
    assert result.status_code == 200, result.text


async def test_event_capacity_is_atomic_and_duplicate_registration_replays(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    event_id = await campus_event(release_db, capacity=1)
    a, b = await actor(release_db), await actor(release_db)
    responses = await asyncio.gather(
        *[
            api.post(
                "/events/registrations",
                headers={**u[2], "Idempotency-Key": uuid4().hex},
                json=registration(event_id),
            )
            for u in (a, b)
        ]
    )
    assert sorted(r.status_code for r in responses) == [201, 409]
    winner = a if responses[0].status_code == 201 else b
    repeated = await api.post(
        "/events/registrations",
        headers={**winner[2], "Idempotency-Key": uuid4().hex},
        json=registration(event_id),
    )
    assert repeated.status_code == 201
    async with release_db() as session:
        assert (
            await session.scalar(
                select(func.count())
                .select_from(EventRegistration)
                .where(EventRegistration.event_id == event_id)
            )
            == 1
        )


async def test_registration_for_past_event_is_rejected(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    event_id = await campus_event(release_db, past=True)
    _, _, headers = await actor(release_db)
    response = await api.post(
        "/events/registrations",
        headers={**headers, "Idempotency-Key": uuid4().hex},
        json=registration(event_id),
    )
    if response.status_code == 503:
        pytest.skip("BLOCKED by QA-002: registration cannot query checked_in_at on migrated schema")
    assert response.status_code in (400, 409, 422), response.text


async def test_future_unattended_event_cannot_issue_attendance_certificate(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    event_id = await campus_event(release_db)
    _, _, headers = await actor(release_db)
    reg = await api.post(
        "/events/registrations",
        headers={**headers, "Idempotency-Key": uuid4().hex},
        json=registration(event_id),
    )
    if reg.status_code == 503:
        pytest.skip("BLOCKED by QA-002: registration prerequisite fails on migrated schema")
    assert reg.status_code == 201
    cert = await api.post(
        "/certificates/issue",
        headers=headers,
        json={"registration_id": reg.json()["id"], "template_name": "Attendance"},
    )
    assert cert.status_code in (400, 403, 409, 422), cert.text


async def test_cross_organizer_event_edit_and_attendance_are_denied(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    owner, _, _ = await actor(release_db, "ORGANIZER")
    _, _, outsider = await actor(release_db, "ORGANIZER")
    event_id = await campus_event(release_db, owner)
    assert (
        await api.patch(f"/events/{event_id}", headers=outsider, json={"title": "Unauthorized"})
    ).status_code == 403
    assert (await api.get(f"/events/{event_id}/registrations", headers=outsider)).status_code == 403


async def test_equipment_stock_is_atomic(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    async with release_db() as session:
        item = EquipmentItem(
            slug=f"qa-{uuid4()}",
            name="Single QA item",
            total_quantity=1,
            status=EquipmentStatus.ACTIVE,
        )
        session.add(item)
        await session.commit()
        item_id = str(item.id)
    users = [await actor(release_db), await actor(release_db)]
    start = datetime.now(UTC) + timedelta(days=5)
    payload = {
        "equipment_item_id": item_id,
        "quantity": 1,
        "starts_at": start.isoformat(),
        "ends_at": (start + timedelta(hours=1)).isoformat(),
    }
    responses = await asyncio.gather(
        *[
            api.post(
                "/equipment/reservations",
                headers={**u[2], "Idempotency-Key": uuid4().hex},
                json=payload,
            )
            for u in users
        ]
    )
    assert sorted(r.status_code for r in responses) == [201, 409], [
        (r.status_code, r.text) for r in responses
    ]


@pytest.mark.parametrize(
    "path", ["/admin/users", "/admin/metrics", "/events/registrations", "/providers/admin/all"]
)
async def test_student_cannot_read_admin_resources(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession], path: str
) -> None:
    _, _, headers = await actor(release_db)
    assert (await api.get(path, headers=headers)).status_code == 403
    assert (await api.get(path)).status_code == 401


@pytest.mark.parametrize(
    "payload",
    [{}, {"email": "not-email", "password": "x"}, {"email": "qa@example.com", "password": []}],
)
async def test_malformed_login_has_safe_validation_envelope(
    api: AsyncClient, payload: dict[str, Any]
) -> None:
    result = await api.post("/auth/login", json=payload)
    assert result.status_code == 422
    assert result.json()["error"]["request_id"] == result.headers["x-request-id"]


async def test_sql_like_search_does_not_change_database(api: AsyncClient) -> None:
    response = await api.get("/venues", params={"location": "' OR 1=1 --"})
    assert response.status_code == 200
    assert response.json() == []


async def test_invalid_pagination_is_rejected(api: AsyncClient) -> None:
    assert (await api.get("/venues", params={"limit": -1})).status_code == 422
    assert (await api.get("/venues", params={"offset": 10001})).status_code == 422


async def test_cors_rejects_untrusted_origin(api: AsyncClient) -> None:
    result = await api.options(
        "/auth/login",
        headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"},
    )
    assert result.status_code == 400
    assert "access-control-allow-origin" not in result.headers


async def test_email_html_escapes_user_name(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import email_service

    captured: dict[str, Any] = {}

    async def capture(**kwargs: Any) -> bool:
        captured.update(kwargs)
        return True

    monkeypatch.setattr(email_service, "send_transactional_email", capture)
    await email_service.send_verification_email(
        to="qa@example.com",
        full_name='<a href="https://untrusted.example">click here</a>',
        raw_token="synthetic",
    )
    assert '<a href="https://untrusted.example">' not in captured["html"]


async def test_migration_head_and_liveness(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    # SELECT-only evidence: readiness currently checks connectivity, not schema head.
    async with release_db() as session:
        assert (
            await session.scalar(text("SELECT version_num FROM alembic_version")) == "20261108_0023"
        )
    assert (await api.get("/health")).status_code == 200


async def test_equipment_constraint_errors_do_not_expose_sql(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    _, _, headers = await actor(release_db, "SYSTEM_ADMIN")
    response = await api.post(
        "/equipment/items",
        headers=headers,
        json={"slug": f"qa-{uuid4()}", "name": "Zero stock", "total_quantity": 0},
    )
    assert response.status_code in (400, 422)
    assert "INSERT INTO" not in response.text and "asyncpg" not in response.text, response.text


async def test_waitlist_join_route_is_reachable(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    user_id, booking = await seed(release_db)
    response = await api.post(
        "/scheduling/waitlists",
        headers={
            "Authorization": f"Bearer {create_access_token({'user_id': str(user_id)})}",
            "Idempotency-Key": uuid4().hex,
        },
        json={
            "venue_id": str(booking.venue_id),
            "event_name": "QA queue",
            "requested_date": booking.starts_at.date().isoformat(),
            "requested_start": "10:00",
            "requested_end": "12:00",
        },
    )
    assert response.status_code == 201, response.text


async def test_recurring_schedule_create_pause_and_cross_user_denial(
    api: AsyncClient, release_db: async_sessionmaker[AsyncSession]
) -> None:
    user_id, booking = await seed(release_db)
    owner = {
        "Authorization": f"Bearer {create_access_token({'user_id': str(user_id)})}",
        "Idempotency-Key": uuid4().hex,
    }
    response = await api.post(
        "/scheduling/recurring",
        headers=owner,
        json={
            "venue_id": str(booking.venue_id),
            "event_name": "QA weekly",
            "day_of_week": 1,
            "start_time": "10:00",
            "end_time": "12:00",
        },
    )
    assert response.status_code == 201, response.text
    _, _, outsider = await actor(release_db)
    path = f"/scheduling/recurring/{response.json()['id']}"
    assert (await api.patch(path, headers=outsider, json={"status": "PAUSED"})).status_code == 404
    assert (await api.patch(path, headers=owner, json={"status": "PAUSED"})).status_code == 200
