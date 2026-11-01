from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.api.routes.auth import current_user
from app.models.user import User, UserStatus


@pytest.mark.asyncio
async def test_current_user_returns_roles_and_active_organizations() -> None:
    user_id = uuid4()
    organization_id = uuid4()
    membership_id = uuid4()
    user = cast(User, SimpleNamespace(
        id=user_id,
        full_name="Ada Organizer",
        email="ada@example.com",
        status=UserStatus.ACTIVE,
    ))
    membership = SimpleNamespace(
        id=membership_id,
        organization_id=organization_id,
        membership_role="ORGANIZER",
        organization=SimpleNamespace(name="Tech Club", slug="tech-club"),
    )
    role_result = MagicMock()
    role_result.scalars.return_value = iter(["SYSTEM_ADMIN"])
    membership_result = MagicMock()
    membership_result.scalars.return_value.all.return_value = [membership]
    session = AsyncMock()
    session.execute.side_effect = [role_result, membership_result]

    response = await current_user(user, session)

    assert response.id == user_id
    assert response.roles == ["SYSTEM_ADMIN"]
    assert response.organizations[0].organization_id == organization_id
    assert response.organizations[0].membership_role == "ORGANIZER"
