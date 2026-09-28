# UniSpot Product Requirements Document

*Automated venue discovery and booking for Kisii University student organizations*

Product: UniSpot  
Document: Product Requirements Document  
Version: 1.0  
Date: 28 September 2026

# 1 Product summary

UniSpot is a browser-based venue discovery and booking platform for Kisii University clubs, associations, and authorized student organizers. It replaces printed request letters, office follow-ups, and manual conflict checking with a single authoritative schedule. Eligible requests are allocated automatically when the requested venue and time are available. No administrator approves or rejects individual bookings.

The product offers two booking paths: a conventional search-and-form interface and a conversational assistant. Both paths use the same FastAPI booking service, PostgreSQL records, authorization rules, and conflict controls. Administrative users maintain venue information and observe allocations, but they cannot choose which eligible requester receives an available slot.

# 2 Product decisions

| **Decision**             | **Product rule**                                                                                                                               |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Backend                  | FastAPI with Python; Django is not part of the target architecture.                                                                            |
| Database                 | PostgreSQL; MySQL is not part of the target architecture.                                                                                      |
| Allocation               | Automatic and policy-driven. A valid request is confirmed atomically if the slot is available.                                                 |
| Administrative role      | Can maintain venue data, block unavailable periods, and view allocations. Cannot approve, reject, prioritize, or reassign individual requests. |
| Conversational assistant | Can search venue data and create, view, or cancel the authenticated user's bookings through controlled application tools.                      |
| Source of truth          | The PostgreSQL booking record is authoritative for availability and allocation.                                                                |

# 3 Problem and opportunity

The current process requires organizers to research likely availability, type and print a request letter, physically deliver it to the Halls Officer, and return repeatedly to ask whether it has been processed. Manual review may take one to three weeks. Conflicts can be discovered close to the event date, after organizers have already committed time and resources.

UniSpot shortens the decision loop from days or weeks to the duration of a validated transaction. It also removes individual approval discretion from ordinary venue allocation. The product does not attempt to eliminate legitimate venue policy; instead, it converts policy into visible eligibility rules, maintenance blocks, capacity constraints, and deterministic scheduling controls.

# 4 Goals and success measures

| **Goal**                  | **Measure**                                                                      | **Initial target**                                          |
|---------------------------|----------------------------------------------------------------------------------|-------------------------------------------------------------|
| Immediate certainty       | Time from completed request to confirmed or unavailable response                 | 95 percent within 3 seconds under normal load               |
| Prevent double-booking    | Confirmed overlapping allocations for the same venue                             | Zero                                                        |
| Reduce office follow-up   | Requests requiring a physical visit for booking status                           | At least 90 percent reduction during pilot                  |
| Conversational completion | Assistant sessions that complete a booking after the user begins venue discovery | Track baseline; target 60 percent after usability iteration |
| Transparent access        | Allocation decisions traceable to rules and timestamps                           | 100 percent of booking mutations logged                     |
| Usability                 | First-time users completing a booking without staff assistance                   | At least 80 percent in pilot testing                        |

# 5 Non-goals

- No manual approval queue for ordinary bookings.
>
- No administrator ranking of clubs, associations, or event importance.
>
- No payment collection, ticket sales, or attendee registration in the first release.
>
- No unrestricted natural-language execution against PostgreSQL.
>
- No native Android or iOS application in the first release.
>
- No institutional single sign-on until the university provides integration access and policy guidance.

# 6 Users and roles

| **Role**                 | **Core needs**                                                     | **Permitted actions**                                                                       | **Explicit restriction**                                          |
|--------------------------|--------------------------------------------------------------------|---------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| Organizer                | Find a suitable venue and obtain immediate confirmation            | Browse; ask assistant; create, view, and cancel own eligible bookings                       | Cannot modify venue rules or other users' bookings                |
| Venue data administrator | Keep the catalogue and operating schedule accurate                 | Create/update venues and facilities; create maintenance or closure blocks; view allocations | Cannot approve, reject, prioritize, or move an individual booking |
| System administrator     | Operate accounts, permissions, configuration, and audits           | Manage users and roles; inspect logs; manage system configuration                           | Cannot bypass allocation rules through ordinary product endpoints |
| Conversational assistant | Help an authenticated organizer complete tasks in natural language | Invoke scoped search, availability, booking, lookup, and cancellation tools                 | No raw SQL, no arbitrary writes, no cross-user access             |

# 7 Core user journeys

## 7.1 Standard booking journey

**1.** The organizer signs in and searches venues using date, time, capacity, location, and facilities.

**2.** The system returns only venues that are operational, satisfy the filters, and have no conflicting allocation or venue block.

**3.** The organizer enters the event name, organization, expected attendance, start time, end time, and optional setup or cleanup needs.

**4.** FastAPI validates identity, organization membership, input rules, venue capacity, lead time, booking duration, and conflicts.

**5.** PostgreSQL atomically inserts a confirmed booking. If another transaction claimed the slot first, the request fails cleanly and alternatives are returned.

**6.** The organizer receives a confirmation reference and can view or cancel the booking according to policy.

## 7.2 Conversational booking journey

**1.** The organizer opens the assistant while authenticated and asks a question such as: Which halls fit 120 people next Friday from 2 pm to 5 pm?

**2.** The assistant extracts known constraints and asks only for missing required information.

**3.** The assistant invokes the venue search and availability tools and presents a concise set of valid options.

**4.** After the user selects an option, the assistant summarizes the venue, date, time, organization, event name, and attendance, then asks for explicit confirmation.

**5.** On confirmation, the assistant invokes the booking tool with a unique idempotency key. The booking service performs the same validation and transaction used by the standard interface.

**6.** The assistant returns the confirmed booking reference or explains why the slot is no longer available and offers current alternatives.

# 8 Functional requirements

| **ID** | **Capability**          | **Requirement**                                                                                                                                                         |
|--------|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| FR-01  | Authentication          | Users shall sign in before creating, viewing, or cancelling a booking.                                                                                                  |
| FR-02  | Organization membership | A booking shall be associated with an active organization membership belonging to the requester.                                                                        |
| FR-03  | Venue catalogue         | Users shall search venues by location, capacity, facilities, accessibility, operational status, date, and time.                                                         |
| FR-04  | Availability            | The server shall compute availability from confirmed bookings and active venue blocks; client displays are advisory until the transaction commits.                      |
| FR-05  | Automatic allocation    | A valid, non-conflicting request shall become Confirmed without human approval.                                                                                         |
| FR-06  | Conflict safety         | The system shall prevent overlapping confirmed bookings for the same venue, including under concurrent requests.                                                        |
| FR-07  | Venue blocks            | Authorized venue data administrators shall create closure or maintenance intervals with a reason; blocks shall prevent new allocations.                                 |
| FR-08  | Booking ownership       | Organizers shall view and cancel their own eligible bookings but shall not access private booking details belonging to other users.                                     |
| FR-09  | Allocation visibility   | Administrators shall see that a venue is allocated, including operationally necessary schedule data, without receiving approval controls.                               |
| FR-10  | Assistant search        | The assistant shall retrieve venues, facilities, policies, and live availability through read-only tools.                                                               |
| FR-11  | Assistant booking       | The assistant shall create a booking only after explicit user confirmation and through the validated booking service.                                                   |
| FR-12  | Assistant cancellation  | The assistant shall cancel only a booking owned by the authenticated user and only after confirmation.                                                                  |
| FR-13  | Conversation continuity | The system shall retain structured conversation state sufficient to resolve multi-turn booking requests without treating chat text as the authoritative booking record. |
| FR-14  | Notifications           | The system shall create in-app notifications for confirmation, cancellation, venue-impacting changes, and relevant reminders.                                           |
| FR-15  | Audit trail             | Every booking, cancellation, venue block, administrative change, and assistant tool invocation shall produce an immutable audit event.                                  |
| FR-16  | Alternatives            | When a requested slot is unavailable, the system shall return alternative venues or nearby available time slots when possible.                                          |
| FR-17  | Idempotency             | Repeated submissions with the same idempotency key shall not create duplicate bookings.                                                                                 |

# 9 Allocation policy

UniSpot uses deterministic allocation. A booking is confirmed when the authenticated requester is eligible, the venue is operational, the request satisfies published policy, and the requested interval is free at commit time. For simultaneously valid competing requests, the database transaction that successfully commits first receives the slot. The application records the server timestamp and request identifier so the result is auditable.

- Use half-open intervals: start_at \< existing_end and end_at \> existing_start. Back-to-back bookings are allowed unless a venue-specific buffer applies.
>
- Represent setup and cleanup time explicitly as buffers included in the occupied range.
>
- Apply documented maximum duration, advance-booking window, capacity, opening-hour, and organization eligibility rules consistently.
>
- Venue closures and maintenance blocks take precedence over new requests.
>
- Administrators may cancel allocations only through a separately audited emergency or policy process if the university requires one; such a process is not an approval mechanism and must require a reason.

# 10 Conversational assistant requirements

## 10.1 Supported intents

- Find venues by capacity, location, facilities, date, and time.
>
- Explain venue details and booking rules using approved product data.
>
- Check live availability for one or more venues.
>
- Create a booking after collecting required fields and receiving explicit confirmation.
>
- Show the authenticated user's upcoming and past bookings.
>
- Cancel an eligible booking after explicit confirmation.
>
- Offer alternatives when a venue or interval is unavailable.

## 10.2 Tool and permission model

| **Tool**           | **Access**                               | **Guardrails**                                                                                    |
|--------------------|------------------------------------------|---------------------------------------------------------------------------------------------------|
| search_venues      | Read venue and facility data             | Parameterized filters; only active public catalogue fields                                        |
| check_availability | Read bookings and blocks through service | Returns free/busy results; hides private requester details                                        |
| get_booking_policy | Read current policy                      | Versioned policy source                                                                           |
| create_booking     | Write via booking service                | Authenticated user; membership check; explicit confirmation; idempotency; atomic conflict control |
| list_my_bookings   | Read user's bookings                     | User identity injected by server, never accepted from model output                                |
| cancel_my_booking  | Update through booking service           | Ownership and cancellation-window checks; explicit confirmation                                   |

The language model never receives a database connection string and never generates SQL for execution. FastAPI exposes a fixed tool contract. The server injects the authenticated user ID, validates tool arguments, enforces rate limits, executes domain logic, and records the result. Tool responses are the only basis for claiming that a booking was created or cancelled.

# 11 States and transitions

| **State** | **Meaning**                                                     | **Allowed transitions** |
|-----------|-----------------------------------------------------------------|-------------------------|
| Held      | Optional short-lived slot reservation during final confirmation | Confirmed or Expired    |
| Confirmed | Successfully allocated by the booking transaction               | Cancelled or Completed  |
| Cancelled | Released by the owner or an authorized emergency process        | Terminal                |
| Expired   | A temporary hold elapsed without confirmation                   | Terminal                |
| Completed | The event interval ended                                        | Terminal                |

The first release may omit Held and confirm immediately after explicit user action. Pending, Approved, and Rejected are not part of the ordinary automated allocation workflow.

# 12 API requirements

| **Method** | **Endpoint**                  | **Purpose**                                             |
|------------|-------------------------------|---------------------------------------------------------|
| GET        | /venues                       | Search and filter venues                                |
| GET        | /venues/{venue_id}            | Retrieve venue details and facilities                   |
| GET        | /availability                 | Query venue availability for an interval                |
| POST       | /bookings                     | Atomically create a confirmed booking                   |
| GET        | /bookings/me                  | List the authenticated user's bookings                  |
| GET        | /bookings/{booking_id}        | Read an owned booking or an authorized operational view |
| POST       | /bookings/{booking_id}/cancel | Cancel an eligible owned booking                        |
| POST       | /assistant/messages           | Process one conversational turn and optional tool calls |
| GET        | /admin/allocations            | Read allocation schedule without approval actions       |
| POST       | /admin/venue-blocks           | Create a closure or maintenance block                   |

# 13 Non-functional requirements

| **Area**        | **Requirement**                                                                                                                                                |
|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Security        | HTTPS in deployment; strong password hashing or institutional identity provider; server-side authorization; secret management; least-privilege database roles. |
| Integrity       | PostgreSQL foreign keys, check constraints, unique constraints, transactions, and an exclusion constraint for occupied venue intervals.                        |
| Concurrency     | Two overlapping requests for the same venue must not both commit as Confirmed.                                                                                 |
| Performance     | P95 venue search and booking responses under 3 seconds at the defined pilot load; assistant model latency measured separately.                                 |
| Availability    | Graceful failure when assistant provider or notification service is unavailable; the standard booking UI must remain usable.                                   |
| Privacy         | Expose only schedule data needed for operations; keep organizer contact and conversation content restricted by role and retention policy.                      |
| Auditability    | Append-only audit events with actor, action, target, timestamp, request ID, channel, and outcome.                                                              |
| Accessibility   | Keyboard-operable interface, semantic labels, sufficient contrast, clear errors, and screen-reader-friendly form controls.                                     |
| Maintainability | FastAPI routes, domain services, repositories, schemas, and assistant tool adapters separated; Alembic migrations version the database.                        |
| Time handling   | Store timestamps as timezone-aware values in UTC and display them in Africa/Nairobi.                                                                           |

# 14 Analytics and observability

- Booking attempts, confirmations, conflict failures, cancellations, and idempotent replays.
>
- Venue utilization by time range without exposing private event details unnecessarily.
>
- Assistant intent, tool success/failure, fallback rate, booking completion, and confirmation abandonment.
>
- API latency, database errors, constraint violations, notification failures, and authentication failures.
>
- No storage of secrets or full sensitive prompts in application logs; conversation retention must be defined and disclosed.

# 15 Acceptance scenarios

| **ID** | **Scenario**                                                       | **Expected result**                                                                    |
|--------|--------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| AC-01  | Organizer submits a valid request for a free slot                  | Booking becomes Confirmed and a reference is returned without administrator action     |
| AC-02  | Two concurrent requests target overlapping times at the same venue | Only one transaction commits; the other receives a conflict and alternatives           |
| AC-03  | Administrator opens the allocation schedule                        | Allocated interval is visible; no approve or reject control exists                     |
| AC-04  | Assistant is asked for a 100-person venue next Friday              | It asks for missing time/facility data, then returns verified options                  |
| AC-05  | Assistant proposes a booking but user has not confirmed            | No booking write occurs                                                                |
| AC-06  | User confirms through chat                                         | Assistant calls create_booking; normal validation and atomic conflict protection apply |
| AC-07  | Prompt asks assistant to expose another user's bookings or run SQL | Request is refused; no unauthorized tool operation occurs                              |
| AC-08  | Duplicate client retry uses the same idempotency key               | Original result is returned and no duplicate booking is created                        |
| AC-09  | Venue is blocked for maintenance                                   | Search and booking treat the interval as unavailable                                   |
| AC-10  | Owner cancels within policy                                        | Booking becomes Cancelled, the slot is released, and an audit event is written         |

# 16 Release scope

## 16.1 Minimum viable product

- Authentication and organization membership
>
- Venue and facility catalogue
>
- Live availability search
>
- Automatic confirmed booking with PostgreSQL conflict protection
>
- My bookings and cancellation
>
- Read-only administrative allocation calendar
>
- Venue maintenance blocks
>
- Conversational venue search and booking using scoped tools
>
- In-app notifications and audit events

## 16.2 Later releases

- Calendar export, reminders, recurring bookings, wait lists, and richer alternatives
>
- Institutional single sign-on and verified university identity integration
>
- Policy engine for organization-specific quotas or booking windows, provided rules remain explicit and non-discretionary
>
- Usage dashboards, accessibility improvements from user testing, and multilingual assistant support

# 17 Risks and mitigations

| **Risk**                                                    | **Mitigation**                                                                                                                        |
|-------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| Chatbot hallucinates availability or success                | Only tool responses may be presented as live availability or booking confirmation; include booking reference in successful responses. |
| Prompt injection attempts to bypass rules                   | Fixed tool allow-list, server-injected identity, schema validation, least privilege, and no raw SQL execution.                        |
| Concurrent requests create an overlap                       | PostgreSQL range exclusion constraint plus transaction handling and conflict-to-409 response mapping.                                 |
| Administrator recreates manual bias through hidden controls | No approval endpoints or UI actions; audit privileged emergency actions and review them periodically.                                 |
| Venue data becomes stale                                    | Assign maintenance ownership, display last-updated timestamps, and audit venue changes.                                               |
| Assistant provider is unavailable                           | Keep standard search and booking path independent; fail gracefully without blocking core service.                                     |
| Sensitive chat data is retained unnecessarily               | Minimize stored content, define retention, restrict access, and separate structured booking facts from raw messages.                  |

# 18 Open policy decisions

- Maximum booking duration and earliest/latest time a venue may be used.
>
- Minimum lead time and maximum advance-booking window.
>
- Whether organizations have quotas or cooldown periods and how those rules are made transparent.
>
- Setup and cleanup buffers by venue or event type.
>
- Cancellation deadline and treatment of repeated no-shows.
>
- Operational details visible to venue administrators versus private organizer information.
>
- Whether short-lived holds are needed during assistant confirmation and their expiry duration.
>
- Who may trigger an emergency cancellation and what evidence, reason, and notification are required.
