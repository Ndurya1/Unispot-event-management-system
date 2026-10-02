from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import get_settings

password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _create_token(
    payload: dict[str, Any],
    expires_delta: timedelta,
    token_type: str,
) -> str:
    settings = get_settings()

    now = datetime.now(UTC)

    data = payload.copy()
    data.update(
        {
            "iat": now,
            "exp": now + expires_delta,
            "type": token_type,
        }
    )

    return jwt.encode(
        data,
        settings.jwt_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def create_access_token(payload: dict[str, Any]) -> str:
    settings = get_settings()

    return _create_token(
        payload,
        timedelta(minutes=settings.jwt_access_token_minutes),
        "access",
    )


def create_refresh_token(payload: dict[str, Any]) -> str:
    settings = get_settings()

    return _create_token(
        payload,
        timedelta(minutes=settings.jwt_refresh_token_minutes),
        "refresh",
    )


def _decode_token(token: str, expected_type: str) -> dict[str, Any]:
    settings = get_settings()

    payload = jwt.decode(
        token,
        settings.jwt_secret_key.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
    )

    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Invalid token type")

    return payload


def verify_access_token(token: str) -> dict[str, Any]:
    return _decode_token(token, "access")


def verify_refresh_token(token: str) -> dict[str, Any]:
    return _decode_token(token, "refresh")
