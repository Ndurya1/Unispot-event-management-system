import hashlib
import logging
import secrets
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger("unispot.email")


def generate_action_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, hashlib.sha256(raw.encode()).hexdigest()


async def send_transactional_email(*, to: str, subject: str, html: str, text: str) -> bool:
    settings = get_settings()
    api_key = settings.resend_api_key.get_secret_value() if settings.resend_api_key else None
    if not api_key:
        # Development fallback: log the message so local testing works without an email provider.
        # In production, RESEND_API_KEY must be configured.
        if settings.environment.value != "production":
            logger.warning(
                "email.dev_fallback to=%s subject=%s (set RESEND_API_KEY for real delivery)\n%s",
                to,
                subject,
                text,
            )
        else:
            logger.error("email.misconfigured to=%s subject=%s reason=no_resend_api_key", to, subject)
        return False

    payload: dict[str, Any] = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
        if response.status_code >= 400:
            logger.warning("email.failed status=%s body=%s", response.status_code, response.text[:500])
            return False
        return True
    except Exception:
        logger.exception("email.error")
        return False


def _frontend_base() -> str:
    return str(get_settings().frontend_url).rstrip("/")


async def send_verification_email(*, to: str, full_name: str, raw_token: str) -> bool:
    link = f"{_frontend_base()}/verify-email?token={raw_token}"
    subject = "Verify your UniSpot email"
    text = (
        f"Hi {full_name},\n\nVerify your UniSpot email by opening this link:\n{link}\n\n"
        "If you did not create this account, you can ignore this message."
    )
    html = f"""
    <p>Hi {full_name},</p>
    <p>Verify your UniSpot email by opening this link:</p>
    <p><a href="{link}">Verify email</a></p>
    <p>If you did not create this account, you can ignore this message.</p>
    """
    return await send_transactional_email(to=to, subject=subject, html=html, text=text)


async def send_password_reset_email(*, to: str, full_name: str, raw_token: str) -> bool:
    link = f"{_frontend_base()}/reset-password?token={raw_token}"
    subject = "Reset your UniSpot password"
    text = (
        f"Hi {full_name},\n\nReset your UniSpot password by opening this link:\n{link}\n\n"
        "If you did not request this, you can ignore this message."
    )
    html = f"""
    <p>Hi {full_name},</p>
    <p>Reset your UniSpot password by opening this link:</p>
    <p><a href="{link}">Reset password</a></p>
    <p>If you did not request this, you can ignore this message.</p>
    """
    return await send_transactional_email(to=to, subject=subject, html=html, text=text)
