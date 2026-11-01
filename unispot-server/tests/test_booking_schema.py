from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from app.models.booking import BookingSource, BookingStatus
from app.schemas.booking import BookingResponse


def test_booking_response_includes_venue_context() -> None:
    booking = SimpleNamespace(
        id=uuid4(),
        venue_id=uuid4(),
        venue=SimpleNamespace(name="Great Hall", location="Main Campus"),
        venue_name="Great Hall",
        venue_location="Main Campus",
        requester_id=uuid4(),
        organization_id=uuid4(),
        event_name="Student Innovation Night",
        event_description=None,
        expected_attendance=80,
        starts_at=datetime(2026, 11, 12, 11, tzinfo=UTC),
        ends_at=datetime(2026, 11, 12, 14, tzinfo=UTC),
        status=BookingStatus.CONFIRMED,
        source=BookingSource.WEB,
        confirmation_code="ABC123",
        created_at=datetime(2026, 11, 1, tzinfo=UTC),
        updated_at=datetime(2026, 11, 1, tzinfo=UTC),
        cancelled_at=None,
        cancellation_reason=None,
    )

    response = BookingResponse.model_validate(booking)

    assert response.venue_name == "Great Hall"
    assert response.venue_location == "Main Campus"
