from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.booking import Booking, BookingStatus
from app.schemas.booking import BookingCreate


def test_booking_schema_requires_timezone_and_ordered_interval() -> None:
    with pytest.raises(ValidationError):
        BookingCreate(
            venue_id=uuid4(),
            organization_id=uuid4(),
            event_name="Orientation",
            expected_attendance=20,
            starts_at=datetime(2030, 1, 1, 10, 0),
            ends_at=datetime(2030, 1, 1, 11, 0),
        )

    with pytest.raises(ValidationError):
        BookingCreate(
            venue_id=uuid4(),
            organization_id=uuid4(),
            event_name="Orientation",
            expected_attendance=20,
            starts_at=datetime(2030, 1, 1, 11, 0, tzinfo=UTC),
            ends_at=datetime(2030, 1, 1, 10, 0, tzinfo=UTC),
        )


def test_booking_schema_accepts_positive_attendance_and_timezone() -> None:
    booking = BookingCreate(
        venue_id=uuid4(),
        organization_id=uuid4(),
        event_name="Orientation",
        expected_attendance=20,
        starts_at=datetime.now(UTC) + timedelta(days=1),
        ends_at=datetime.now(UTC) + timedelta(days=1, hours=1),
    )
    assert booking.expected_attendance == 20


def test_booking_status_has_no_approval_states() -> None:
    assert {status.value for status in BookingStatus} == {
        "CONFIRMED",
        "CANCELLED",
        "COMPLETED",
    }
    assert "approved_by" not in Booking.__table__.columns
    assert "rejection_reason" not in Booking.__table__.columns
