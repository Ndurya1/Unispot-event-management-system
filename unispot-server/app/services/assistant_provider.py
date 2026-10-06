"""Model-provider boundary for the in-app assistant.

The provider is deliberately kept behind a small interface. Deployments can
replace ``RuleBasedAssistantProvider`` with an approved model adapter without
giving the model database access or changing the tool executor.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from app.schemas.assistant import AssistantToolInvocation, ToolName


@dataclass(frozen=True)
class AssistantProviderPlan:
    response: str | None = None
    tool_calls: list[AssistantToolInvocation] = field(default_factory=list)
    state_patch: dict[str, object] = field(default_factory=dict)


class AssistantProvider(Protocol):
    async def complete(
        self, *, message: str, state: dict[str, object]
    ) -> AssistantProviderPlan: ...


class RuleBasedAssistantProvider:
    """Safe local fallback used when no external model provider is configured."""

    async def complete(
        self, *, message: str, state: dict[str, object]
    ) -> AssistantProviderPlan:
        normalized = message.casefold()
        intent = state.get("intent")
        if any(word in normalized for word in ("policy", "policies", "rules", "rule")):
            return AssistantProviderPlan(
                tool_calls=[
                    AssistantToolInvocation(name=ToolName.GET_BOOKING_POLICY, arguments={})
                ]
            )
        if "my booking" in normalized or "my reservation" in normalized:
            return AssistantProviderPlan(
                tool_calls=[AssistantToolInvocation(name=ToolName.LIST_MY_BOOKINGS, arguments={})]
            )
        if "cancel" in normalized or "cancelled" in normalized:
            booking_id = _find_uuid(message)
            if booking_id is not None:
                return AssistantProviderPlan(
                    tool_calls=[
                        AssistantToolInvocation(
                            name=ToolName.CANCEL_MY_BOOKING,
                            arguments={"booking_id": booking_id},
                        )
                    ],
                    state_patch={"intent": ToolName.CANCEL_MY_BOOKING.value},
                )
            return AssistantProviderPlan(
                response=(
                    "Please provide the booking ID or confirmation reference "
                    "you want to cancel."
                ),
                state_patch={"intent": ToolName.CANCEL_MY_BOOKING.value},
            )
        if any(word in normalized for word in ("book", "reserve", "reservation")):
            return AssistantProviderPlan(
                response=(
                    "To prepare a booking I need the venue, organization, event name, "
                    "expected attendance, date, start time, and end time."
                ),
                state_patch={"intent": ToolName.CREATE_BOOKING.value},
            )
        if intent == ToolName.CREATE_BOOKING.value:
            slots = _extract_slots(message, state)
            missing = [
                label
                for key, label in (
                    ("venue_id", "venue"),
                    ("organization_id", "organization"),
                    ("event_name", "event name"),
                    ("capacity", "expected attendance"),
                    ("starts_at", "start time"),
                    ("ends_at", "end time"),
                )
                if key not in slots
            ]
            return AssistantProviderPlan(
                response=(
                    "I still need: " + ", ".join(missing) + "."
                    if missing
                    else "I have the booking details. Select a venue and organization to continue."
                ),
                state_patch={"intent": ToolName.CREATE_BOOKING.value, "slots": slots},
            )
        if intent == ToolName.CHECK_AVAILABILITY.value or any(
            word in normalized for word in ("availability", "available", "free")
        ):
            slots = _extract_slots(message, state)
            if slots.get("starts_at") and slots.get("ends_at"):
                arguments: dict[str, object] = {
                    "starts_at": slots["starts_at"],
                    "ends_at": slots["ends_at"],
                }
                for key in ("capacity", "location"):
                    if key in slots:
                        arguments[key] = slots[key]
                return AssistantProviderPlan(
                    tool_calls=[
                        AssistantToolInvocation(
                            name=ToolName.CHECK_AVAILABILITY,
                            arguments=arguments,
                        )
                    ],
                    state_patch={"intent": ToolName.CHECK_AVAILABILITY.value, "slots": slots},
                )
            return AssistantProviderPlan(
                response="Please provide the date, start time, and end time to check availability.",
                state_patch={"intent": ToolName.CHECK_AVAILABILITY.value, "slots": slots},
            )
        if "venue" in normalized or "hall" in normalized or "search" in normalized:
            slots = _extract_slots(message, state)
            arguments = {
                key: slots[key] for key in ("capacity", "location") if key in slots
            }
            if arguments:
                return AssistantProviderPlan(
                    tool_calls=[
                        AssistantToolInvocation(
                            name=ToolName.SEARCH_VENUES,
                            arguments=arguments,
                        )
                    ],
                    state_patch={"intent": ToolName.SEARCH_VENUES.value, "slots": slots},
                )
            return AssistantProviderPlan(
                response=(
                    "I can search venues and availability. Please include the date, "
                    "start and end time, expected attendance, and preferred location."
                ),
                state_patch={"intent": ToolName.SEARCH_VENUES.value, "slots": slots},
            )
        return AssistantProviderPlan(
            response=(
                "I can help find venues, check availability, view your bookings, "
                "or create and cancel bookings."
            )
        )


def _find_uuid(message: str) -> str | None:
    match = re.search(
        r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
        message,
        flags=re.IGNORECASE,
    )
    return match.group(0) if match else None


def _extract_slots(message: str, state: dict[str, object]) -> dict[str, object]:
    existing = state.get("slots")
    slots = dict(existing) if isinstance(existing, dict) else {}
    capacity = re.search(r"\b(\d{1,5})\s*(?:people|persons|attendees|capacity)\b", message, re.I)
    if capacity:
        slots["capacity"] = int(capacity.group(1))
    location = re.search(r"\b(?:in|at|near)\s+([A-Za-z][A-Za-z -]{1,40})", message)
    if location:
        slots["location"] = location.group(1).strip(" .,")
    datetimes = re.findall(
        r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})\b",
        message,
    )
    parsed = []
    for value in datetimes[:2]:
        try:
            parsed.append(datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat())
        except ValueError:
            continue
    if parsed:
        slots["starts_at"] = parsed[0]
    if len(parsed) > 1:
        slots["ends_at"] = parsed[1]
    return slots


__all__ = ["AssistantProvider", "AssistantProviderPlan", "RuleBasedAssistantProvider"]
