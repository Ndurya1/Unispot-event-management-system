from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import (
    DeliveryStatus,
    Notification,
    NotificationChannel,
)

MAX_DELIVERY_ATTEMPTS = 5
BASE_RETRY_DELAY = timedelta(minutes=5)


@dataclass(frozen=True)
class NotificationBatchResult:
    delivered: int
    retried: int
    failed: int


async def process_pending_notifications(
    session: AsyncSession,
    *,
    now: datetime | None = None,
    batch_size: int = 100,
) -> NotificationBatchResult:
    """Process a bounded notification batch without touching booking state.

    In-app delivery is represented by marking the durable notification SENT.
    External channels are retained as FAILED with capped retry metadata until a
    provider adapter is configured.
    """

    current_time = now or datetime.now(UTC)
    if batch_size < 1 or batch_size > 500:
        raise ValueError("batch_size must be between 1 and 500")
    result = await session.execute(
        select(Notification)
        .where(
            Notification.delivery_status.in_([DeliveryStatus.PENDING, DeliveryStatus.FAILED]),
            or_(
                Notification.next_attempt_at.is_(None),
                Notification.next_attempt_at <= current_time,
            ),
        )
        .order_by(Notification.created_at)
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )
    notifications = list(result.scalars().all())
    delivered = 0
    retried = 0
    failed = 0
    for notification in notifications:
        notification.attempt_count += 1
        if notification.channel is NotificationChannel.IN_APP:
            notification.delivery_status = DeliveryStatus.SENT
            notification.sent_at = current_time
            notification.last_error = None
            notification.next_attempt_at = None
            delivered += 1
            continue

        notification.delivery_status = DeliveryStatus.FAILED
        notification.last_error = "No delivery provider is configured for this channel"
        if notification.attempt_count >= MAX_DELIVERY_ATTEMPTS:
            notification.next_attempt_at = None
            failed += 1
        else:
            notification.next_attempt_at = current_time + BASE_RETRY_DELAY * (
                2 ** (notification.attempt_count - 1)
            )
            retried += 1
    await session.commit()
    return NotificationBatchResult(delivered=delivered, retried=retried, failed=failed)
