from types import SimpleNamespace
from uuid import uuid4

from app.models.venue import VenueStatus
from app.schemas.venue import VenueResponse


def test_venue_response_includes_catalog_metadata_and_facility_names() -> None:
    projector_id = uuid4()
    wifi_id = uuid4()
    venue = SimpleNamespace(
        id=uuid4(),
        name="Great Hall",
        code="GREAT-HALL",
        location="Main Campus",
        capacity=500,
        description="A large event venue.",
        status=VenueStatus.ACTIVE,
        timezone="Africa/Nairobi",
        booking_buffer_minutes=0,
        venue_type="Auditorium",
        image_url="/assets/venue-great-hall.jpeg",
        facilities=[
            SimpleNamespace(facility=SimpleNamespace(id=projector_id, name="Projector")),
            SimpleNamespace(facility=SimpleNamespace(id=wifi_id, name="Wi-Fi")),
        ],
    )

    response = VenueResponse.model_validate(venue)

    assert response.venue_type == "Auditorium"
    assert response.image_url == "/assets/venue-great-hall.jpeg"
    assert [facility.name for facility in response.facilities] == ["Projector", "Wi-Fi"]
