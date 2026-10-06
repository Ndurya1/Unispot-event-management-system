from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization, OrganizationStatus
from app.models.organization_membership import (
    MembershipRole,
    MembershipStatus,
    OrganizationMembership,
)
from app.models.user import User, UserStatus
from app.models.venue import Venue, VenueStatus
from app.models.venue_operating_hours import VenueOperatingHours

BOOKING_MIN_LEAD_TIME = timedelta(hours=24)
BOOKING_MAX_ADVANCE_WINDOW = timedelta(days=180)
BOOKING_MAX_DURATION = timedelta(hours=12)


@dataclass(frozen=True)
class PolicyViolation:
    code: str
    message: str


class BookingPolicyError(ValueError):
    def __init__(self, violations: list[PolicyViolation]) -> None:
        self.violations = violations
        super().__init__("Booking policy validation failed")


async def validate_booking_policy(
    session: AsyncSession,
    *,
    requester: User,
    organization_id: UUID,
    venue: Venue,
    starts_at: datetime,
    ends_at: datetime,
    expected_attendance: int,
    now: datetime | None = None,
) -> None:
    violations: list[PolicyViolation] = []
    current_time = now or datetime.now(UTC)

    if requester.status is not UserStatus.ACTIVE:
        violations.append(PolicyViolation("user_inactive", "The requester is not active"))

    membership = await session.execute(
        select(OrganizationMembership)
        .join(Organization, Organization.id == OrganizationMembership.organization_id)
        .where(
            OrganizationMembership.user_id == requester.id,
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.membership_role == MembershipRole.ORGANIZER,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
            Organization.status == OrganizationStatus.ACTIVE,
        )
    )
    if membership.scalar_one_or_none() is None:
        violations.append(
            PolicyViolation(
                "organization_membership_required",
                "The requester must have an active organizer membership in the organization",
            )
        )

    if venue.status is not VenueStatus.ACTIVE:
        violations.append(PolicyViolation("venue_unavailable", "The venue is not active"))
    if expected_attendance <= 0:
        violations.append(
            PolicyViolation("attendance_positive", "Expected attendance must be positive")
        )
    elif expected_attendance > venue.capacity:
        violations.append(
            PolicyViolation("capacity_exceeded", "Expected attendance exceeds venue capacity")
        )

    if starts_at.tzinfo is None or ends_at.tzinfo is None:
        violations.append(
            PolicyViolation("timezone_required", "Booking times must include a timezone")
        )
    elif ends_at <= starts_at:
        violations.append(PolicyViolation("time_order", "ends_at must be later than starts_at"))
    else:
        if starts_at < current_time + BOOKING_MIN_LEAD_TIME:
            violations.append(
                PolicyViolation(
                    "minimum_lead_time",
                    "Bookings must be made at least 24 hours before they start",
                )
            )
        if starts_at > current_time + BOOKING_MAX_ADVANCE_WINDOW:
            violations.append(
                PolicyViolation(
                    "advance_window",
                    "Bookings cannot be made more than 180 days in advance",
                )
            )
        if ends_at - starts_at > BOOKING_MAX_DURATION:
            violations.append(
                PolicyViolation("maximum_duration", "Bookings cannot exceed twelve hours")
            )
        violations.extend(await _operating_hours_violations(session, venue, starts_at, ends_at))

    if violations:
        raise BookingPolicyError(violations)


async def _operating_hours_violations(
    session: AsyncSession,
    venue: Venue,
    starts_at: datetime,
    ends_at: datetime,
) -> list[PolicyViolation]:
    try:
        venue_zone = ZoneInfo(venue.timezone)
    except ZoneInfoNotFoundError:
        return [PolicyViolation("invalid_venue_timezone", "The venue timezone is invalid")]

    local_start = starts_at.astimezone(venue_zone)
    local_end = ends_at.astimezone(venue_zone)
    if local_start.date() != local_end.date():
        return [
            PolicyViolation(
                "operating_hours",
                "A booking must start and end on the same local operating day",
            )
        ]

    result = await session.execute(
        select(VenueOperatingHours).where(
            VenueOperatingHours.venue_id == venue.id,
            VenueOperatingHours.day_of_week == local_start.weekday(),
        )
    )
    hours = result.scalar_one_or_none()
    if hours is None:
        return [PolicyViolation("venue_closed", "The venue is closed on the requested day")]
    if local_start.time() < hours.opens_at or local_end.time() > hours.closes_at:
        return [
            PolicyViolation(
                "outside_operating_hours",
                "The requested interval falls outside the venue operating hours",
            )
        ]
    return []
