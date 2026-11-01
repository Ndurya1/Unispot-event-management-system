"""Seed the development venue catalog used by the frontend discovery flow."""

import asyncio
from typing import TypedDict

from sqlalchemy import select

from app.db.session import AsyncSessionFactory, dispose_engine
from app.models.facility import Facility, VenueFacility
from app.models.venue import Venue, VenueStatus


class VenueSeed(TypedDict):
    name: str
    code: str
    location: str
    capacity: int
    description: str
    venue_type: str
    image_url: str
    facilities: tuple[str, ...]


VENUE_CATALOG: tuple[VenueSeed, ...] = (
    {
        "name": "Great Hall",
        "code": "GREAT-HALL",
        "location": "Main Campus",
        "capacity": 500,
        "description": "A flexible auditorium for major campus events, conferences, and showcases.",
        "venue_type": "Auditorium",
        "image_url": "/assets/venue-great-hall.jpeg",
        "facilities": (
            "Projector",
            "Sound system",
            "Wi-Fi",
            "Air conditioning",
            "Seating",
            "Power supply",
        ),
    },
    {
        "name": "Seminar Room B",
        "code": "SEMINAR-B",
        "location": "Learning Commons",
        "capacity": 80,
        "description": "A focused room for workshops, club meetings, and collaborative learning.",
        "venue_type": "Seminar room",
        "image_url": "/assets/event-innovation.jpg",
        "facilities": ("Projector", "Whiteboard", "Wi-Fi", "Flexible seating"),
    },
    {
        "name": "Campus Courtyard",
        "code": "CAMPUS-COURTYARD",
        "location": "Central Campus",
        "capacity": 300,
        "description": (
            "An open-air setting for fairs, social events, and student community gatherings."
        ),
        "venue_type": "Outdoor space",
        "image_url": "/assets/campus-courtyard.jpg",
        "facilities": ("Outdoor seating", "Power access", "Accessible paths", "Open-air stage"),
    },
)


async def seed_venue_catalog() -> None:
    async with AsyncSessionFactory() as session:
        for record in VENUE_CATALOG:
            venue = await session.scalar(select(Venue).where(Venue.code == record["code"]))
            if venue is None:
                venue = Venue(
                    name=record["name"],
                    code=record["code"],
                    location=record["location"],
                    capacity=record["capacity"],
                    description=record["description"],
                    venue_type=record["venue_type"],
                    image_url=record["image_url"],
                    status=VenueStatus.ACTIVE,
                )
                session.add(venue)
                await session.flush()
            else:
                for field in (
                    "name",
                    "location",
                    "capacity",
                    "description",
                    "venue_type",
                    "image_url",
                ):
                    setattr(venue, field, record[field])

            for facility_name in record["facilities"]:
                facility = await session.scalar(
                    select(Facility).where(Facility.name == facility_name)
                )
                if facility is None:
                    facility = Facility(name=facility_name)
                    session.add(facility)
                    await session.flush()

                link = await session.get(
                    VenueFacility,
                    {"venue_id": venue.id, "facility_id": facility.id},
                )
                if link is None:
                    session.add(VenueFacility(venue_id=venue.id, facility_id=facility.id))

        await session.commit()


async def main() -> None:
    try:
        await seed_venue_catalog()
    finally:
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
