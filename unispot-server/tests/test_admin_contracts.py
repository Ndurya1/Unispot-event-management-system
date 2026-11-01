import pytest
from pydantic import ValidationError

from app.models.notification import NotificationType
from app.schemas.admin import AdminAnnouncementCreate


def test_admin_announcement_uses_durable_in_app_notification_type() -> None:
    announcement = AdminAnnouncementCreate(
        recipient_group="ORGANIZERS",
        title="Planned maintenance",
        body="The venue directory will be unavailable briefly.",
    )

    assert announcement.recipient_group == "ORGANIZERS"
    assert NotificationType.ANNOUNCEMENT.value == "ANNOUNCEMENT"


def test_admin_announcement_rejects_unknown_recipient_group() -> None:
    with pytest.raises(ValidationError):
        AdminAnnouncementCreate(
            recipient_group="STUDENTS",
            title="Unsupported targeting",
            body="This group is not represented by the current role model.",
        )
