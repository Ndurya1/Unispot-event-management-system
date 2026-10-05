"""Model-provider boundary for the in-app assistant.

The provider is deliberately kept behind a small interface. Deployments can
replace ``RuleBasedAssistantProvider`` with an approved model adapter without
giving the model database access or changing the tool executor.
"""

from dataclasses import dataclass, field
from typing import Protocol

from app.schemas.assistant import AssistantToolInvocation, ToolName


@dataclass(frozen=True)
class AssistantProviderPlan:
    response: str | None = None
    tool_calls: list[AssistantToolInvocation] = field(default_factory=list)


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
        if "venue" in normalized or "hall" in normalized:
            return AssistantProviderPlan(
                response=(
                    "I can search venues and availability. Please include the date, "
                    "start and end time, expected attendance, and preferred location."
                )
            )
        return AssistantProviderPlan(
            response=(
                "I can help find venues, check availability, view your bookings, "
                "or create and cancel bookings."
            )
        )


__all__ = ["AssistantProvider", "AssistantProviderPlan", "RuleBasedAssistantProvider"]
