# UniSpot Backend Implementation Plan

Product: UniSpot  
Backend: FastAPI, PostgreSQL, SQLAlchemy 2 async, Alembic, Pydantic v2  
Version: 1.0  
Date: 28 September 2026

## 1. Purpose

This plan converts the UniSpot PRD and database specification into small, reviewable backend commits for agentic coding. Each task should be implemented, tested, reviewed, and committed before the next task begins.

The backend must preserve four non-negotiable product rules:

- Venue allocation is automatic. Ordinary bookings do not enter an administrator approval queue.
- PostgreSQL is the authoritative source for venue availability and allocation.
- Administrators may maintain venue data, create closure or maintenance blocks, and observe allocations, but cannot approve, reject, prioritize, or reassign individual booking requests.
- The conversational assistant may read and mutate data only through allow-listed FastAPI services. It must never receive database credentials or execute model-generated SQL.

## 2. Agentic coding operating rules

For every task, the coding agent must:

1. Read the PRD, database models document, existing repository instructions, and relevant code before proposing changes.
2. Inspect the current Git status and preserve unrelated user changes.
3. Produce a short implementation plan naming the files to create or modify.
4. Implement only the current task. Do not pre-build later milestones.
5. Add or update tests for every behavior change.
6. Run the task's verification commands and report actual results.
7. Review the diff for accidental secrets, unrelated formatting changes, missing authorization, and inconsistent naming.
8. Make one focused commit using the specified commit message or a close equivalent.
9. Stop if a required policy decision is unresolved and different answers would materially change the data model or behavior.

### Definition of a committable task

A task is committable when:

- The application imports and starts successfully.
- The migration history is valid and reversible where practical.
- New behavior has automated tests.
- Existing tests still pass.
- No placeholder credentials, private keys, tokens, or production URLs are committed.
- API schemas and error responses are documented through FastAPI's OpenAPI output.
- The diff represents one coherent change that can be reviewed or reverted independently.

## 3. Target project structure

```text
server/
├── alembic/
│   ├── versions/
│   └── env.py
├── app/
│   ├── api/
│   │   ├── dependencies/
│   │   └── routes/
│   ├── assistant/
│   │   ├── orchestrator.py
│   │   ├── prompts.py
│   │   ├── schemas.py
│   │   └── tools.py
│   ├── core/
│   │   ├── config.py
│   │   ├── exceptions.py
│   │   ├── logging.py
│   │   └── security.py
│   ├── db/
│   │   ├── base.py
│   │   ├── session.py
│   │   └── types.py
│   ├── models/
│   ├── repositories/
│   ├── schemas/
│   ├── services/
│   ├── main.py
│   └── worker.py
├── tests/
│   ├── integration/
│   ├── unit/
│   ├── conftest.py
│   └── factories.py
├── .env.example
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
└── README.md
```

Keep routes thin. Routes validate HTTP input and call services. Services contain domain rules and transaction boundaries. Repositories contain database queries. Assistant tools call the same services as conventional HTTP routes.

## 4. Milestone overview

| Milestone | Outcome | Commits |
| --- | --- | ---: |
| M0 | Reproducible FastAPI development environment | 4 |
| M1 | Identity, roles, organizations, and authorization | 5 |
| M2 | Venue catalogue, facilities, hours, and blocks | 5 |
| M3 | Atomic automated booking | 6 |
| M4 | Booking retrieval, cancellation, notifications, and audit | 5 |
| M5 | Conversational assistant tools and orchestration | 6 |
| M6 | Hardening, observability, and delivery readiness | 5 |
| Total | Production-oriented backend baseline | 36 |

## 5. Commit sequence

## M0. Foundation

### Task 0.1 — Initialize the backend package

**Commit:** `chore: initialize FastAPI backend`

**Scope**

- Create the `server` project and application package.
- Add FastAPI, Uvicorn, Pydantic Settings, SQLAlchemy async, asyncpg, Alembic, pytest, pytest-asyncio, HTTPX, Ruff, and mypy dependencies.
- Add `/health` returning application status and version.
- Add a minimal README with local start commands.

**Expected files**

- `server/pyproject.toml`
- `server/app/main.py`
- `server/app/core/config.py`
- `server/tests/test_health.py`
- `server/README.md`

**Verification**

```bash
pytest
ruff check .
uvicorn app.main:app --reload
```

**Done when:** `/health` returns HTTP 200 and the test suite passes in a clean environment.

### Task 0.2 — Add environment configuration

**Commit:** `chore: add typed application configuration`

**Scope**

- Define typed development, test, and production settings.
- Require `DATABASE_URL`, JWT configuration, allowed origins, and environment name.
- Add `.env.example` with names and safe example values only.
- Fail fast when required production configuration is missing.

**Tests**

- Defaults are safe in tests.
- Invalid production configuration raises a clear startup error.
- Secrets do not appear in serialized settings or logs.

### Task 0.3 — Configure PostgreSQL and async sessions

**Commit:** `feat: configure async PostgreSQL persistence`

**Scope**

- Create the async engine and session factory.
- Add a request-scoped database dependency.
- Add connection-health checking.
- Configure test transaction rollback or isolated test databases.

**Expected files**

- `app/db/base.py`
- `app/db/session.py`
- `app/api/dependencies/database.py`
- `tests/conftest.py`

**Tests**

- A session can execute `SELECT 1`.
- Failed connections surface a controlled service-unavailable error.

### Task 0.4 — Initialize Alembic and CI quality gates

**Commit:** `chore: add migrations and backend quality checks`

**Scope**

- Configure Alembic to use application metadata and `DATABASE_URL`.
- Add an empty baseline migration.
- Add CI for lint, type checks, migrations, and tests against PostgreSQL.
- Verify migration upgrade and downgrade in CI.

**Done when:** a clean database migrates to head and the CI workflow passes.

## M1. Identity and authorization

### Task 1.1 — Create user and system-role models

**Commit:** `feat: add user and role persistence models`

**Scope**

- Add `users`, `roles`, and `user_roles` SQLAlchemy models.
- Add enums and constraints from `UniSpot_DB_MODELS.md`.
- Enable PostgreSQL `citext` or implement a unique normalized email column.
- Seed `ORGANIZER`, `VENUE_ADMIN`, and `SYSTEM_ADMIN` roles idempotently.

**Tests**

- Emails are unique case-insensitively.
- Duplicate role assignments fail.
- Disabled users remain stored for audit history.

### Task 1.2 — Implement password authentication and JWTs

**Commit:** `feat: implement JWT authentication`

**Scope**

- Hash passwords using Argon2id or the approved password library.
- Implement login, access tokens, refresh tokens, and authenticated-user dependency.
- Do not expose `password_hash` in response schemas.
- Record `last_login_at` after successful login.

**Tests**

- Valid login succeeds.
- Invalid credentials return a generic unauthorized response.
- Disabled users cannot authenticate.
- Expired and tampered tokens are rejected.

### Task 1.3 — Add organizations and memberships

**Commit:** `feat: add organizations and memberships`

**Scope**

- Add `organizations` and `organization_memberships` models and migrations.
- Add organization create/list/update operations restricted to system administrators.
- Add membership assignment and deactivation.
- Prevent duplicate user-organization membership rows.

**Tests**

- A user may belong to multiple organizations.
- Only an active organizer membership can be used for booking.
- Unauthorized membership changes return HTTP 403.

### Task 1.4 — Centralize authorization dependencies

**Commit:** `feat: enforce role and membership authorization`

**Scope**

- Implement dependencies for active user, required system role, and active organization membership.
- Ensure server-side authorization is independent of UI visibility.
- Return consistent HTTP 401 and 403 error bodies.

**Tests**

- Cover every allow and deny combination for organizer, venue administrator, and system administrator.

### Task 1.5 — Add identity audit events

**Commit:** `feat: audit authentication and authorization changes`

**Scope**

- Create the initial `audit_events` model.
- Record successful login, failed login without sensitive data, role assignment, membership change, and account-status change.
- Add request correlation IDs.

## M2. Venue catalogue and availability inputs

### Task 2.1 — Add venue and facility models

**Commit:** `feat: add venue and facility catalogue`

**Scope**

- Add `venues`, `facilities`, and `venue_facilities`.
- Implement venue and facility CRUD for authorized administrators.
- Implement organizer-facing venue detail and filtered list endpoints.
- Validate positive venue capacity.

**Tests**

- Filter by capacity, location, facility, and status.
- Inactive venues are excluded from the default organizer catalogue.
- Duplicate venue-facility links fail.

### Task 2.2 — Add venue operating hours

**Commit:** `feat: add venue operating-hour rules`

**Scope**

- Add `venue_operating_hours`.
- Store one recurring rule per venue and weekday, with Monday = `0` through Sunday = `6`.
- Validate `closes_at > opens_at` and enforce one rule per venue and weekday.
- Create a service that determines whether a requested interval fits operating hours in `Africa/Nairobi`.
- Defer semester-specific `effective_from` and `effective_to` rules until they are operationally required.

**Tests**

- Normal hours, closed days, weekday mapping, duplicate weekday rules, and midnight boundaries.

### Task 2.3 — Add unified venue reservations

**Commit:** `feat: add unified venue occupancy model`

**Scope**

- Add `venue_reservations` with `venue_id`, `reservation_type`, `occupied_range`, `active`, and timestamps.
- Enable `btree_gist`.
- Add a GiST exclusion constraint preventing overlapping active ranges per venue.
- Document `[start, end)` half-open interval semantics.

**Tests**

- Overlapping active reservations fail.
- Back-to-back reservations succeed because `[start, end)` intervals do not overlap at the shared boundary.
- Inactive reservations no longer block the interval.

### Task 2.4 — Add venue maintenance and closure blocks

**Commit:** `feat: add venue block management`

**Scope**

- Add `venue_blocks` linked one-to-one to a `BLOCK` reservation.
- Allow venue administrators to create and cancel blocks with a reason.
- Do not add booking approval permissions.
- Reject a block that overlaps an active booking unless the emergency-impact policy is explicitly implemented.

**Tests**

- Blocks remove intervals from availability.
- Organizers cannot create or cancel blocks.
- All block changes produce audit events.

### Task 2.5 — Implement availability search

**Commit:** `feat: expose venue availability search`

**Scope**

- Implement `GET /availability` with date/time, capacity, location, and facility filters.
- Query unified active reservations.
- Return free venues without exposing private booking ownership or event information.
- Add pagination and a bounded query window.

**Tests**

- Free, occupied, blocked, inactive, and capacity-mismatch cases.
- Invalid and excessively large date ranges are rejected.

## M3. Automated booking

### Task 3.1 — Add booking persistence models

**Commit:** `feat: add automated booking models`

**Scope**

- Add `bookings` and `booking_events`.
- Link each active booking to one `BOOKING` reservation.
- Use `CONFIRMED`, `CANCELLED`, and `COMPLETED` only.
- Make `expected_attendance` required and positive.
- Generate the occupied interval from the exact `[starts_at, ends_at)` event range; do not add an implicit setup or cleanup buffer.
- Do not add `PENDING`, `APPROVED`, `REJECTED`, `approved_by`, or approval endpoints.

**Tests**

- Model constraints and allowed states.
- Confirmation code uniqueness.
- Required organization and requester relationships.

### Task 3.2 — Implement booking policy service

**Commit:** `feat: implement deterministic booking policy`

**Scope**

- Validate active user, membership, venue status, capacity, time order, operating hours, lead time, advance window, and maximum duration.
- Return structured rule violations.
- Keep policy rules in the service layer; defer persisted `policy_version` tracking until policies require formal versioning.

**Tests**

- One unit test per policy rule and boundary.
- No policy decision depends on administrator discretion.

### Task 3.3 — Implement atomic booking transaction

**Commit:** `feat: create bookings atomically`

**Scope**

- Implement the booking service transaction.
- Lock the selected venue row.
- Insert the unified reservation, confirmed booking, booking event, audit event, and notification outbox item atomically.
- Map exclusion-constraint violations to HTTP 409.
- Return current alternatives after a conflict where practical.

**Tests**

- Successful booking.
- Overlap conflict.
- Rollback leaves no partial reservation, booking, or audit event.

### Task 3.4 — Add create-booking endpoint

**Commit:** `feat: expose automated booking endpoint`

**Scope**

- Add `POST /bookings`.
- Inject requester identity from the JWT.
- Accept organization, venue, event, attendance, and interval fields.
- Return HTTP 201 with confirmation code; return 409 for an occupied slot.

**Tests**

- Authentication, membership, validation, success, and conflict responses.

### Task 3.5 — Add idempotency protection

**Commit:** `feat: make booking writes idempotent`

**Scope**

- Add `idempotency_keys`.
- Require an idempotency key for booking creation and later assistant writes.
- Replay the original successful response for the same request hash.
- Reject reuse of a key with a different payload.

**Tests**

- Network retry creates one booking.
- Same key and different payload returns a conflict.
- Concurrent duplicate submissions still create one booking.

### Task 3.6 — Add concurrency integration tests

**Commit:** `test: verify concurrent booking integrity`

**Scope**

- Create a test harness that releases two overlapping booking requests concurrently.
- Run against real PostgreSQL, not SQLite.
- Assert exactly one confirmed booking and one active reservation.

**Done when:** repeated test runs never produce two overlapping allocations.

## M4. Booking lifecycle, visibility, and notifications

### Task 4.1 — Add organizer booking queries

**Commit:** `feat: add organizer booking views`

**Scope**

- Add `GET /bookings/me` and `GET /bookings/{id}`.
- Filter ownership using authenticated user ID from the token.
- Support status and date filters with pagination.

**Tests**

- Users cannot read another user's private booking.
- The list returns only the authenticated user's records.

### Task 4.2 — Add read-only administrative allocation view

**Commit:** `feat: add read-only allocation calendar API`

**Scope**

- Add `GET /admin/allocations` for venue and system administrators.
- Return operational schedule details required to manage space.
- Exclude approve, reject, prioritize, and reassign actions.
- Apply privacy rules to requester and conversation data.

**Tests**

- Correct visibility and redaction.
- No approval routes appear in OpenAPI.

### Task 4.3 — Implement cancellation

**Commit:** `feat: implement owned booking cancellation`

**Scope**

- Add `POST /bookings/{id}/cancel`.
- Enforce ownership, state, and cancellation deadline.
- Mark the linked reservation inactive in the same transaction.
- Add booking event, audit event, and notification outbox item.

**Tests**

- Eligible cancellation releases the interval.
- Cross-user, expired-window, and duplicate cancellation attempts fail correctly.

### Task 4.4 — Add notification records and outbox worker

**Commit:** `feat: add reliable booking notifications`

**Scope**

- Add `notifications` and a transactional outbox table if not already included.
- Add a worker that sends or records in-app notifications.
- Retry transient failures with a capped backoff.
- Never roll back a confirmed booking because email delivery failed.

**Tests**

- Confirmation and cancellation enqueue notifications.
- Retry and terminal failure behavior.

### Task 4.5 — Complete audit coverage

**Commit:** `feat: complete append-only booking audit trail`

**Scope**

- Audit venue changes, blocks, booking attempts, successful allocations, conflicts, cancellations, and denied access.
- Make audit records immutable through application repositories and database permissions where possible.
- Add an authorized audit query for system administrators.

## M5. Conversational assistant

### Task 5.1 — Add conversation models

**Commit:** `feat: add assistant conversation persistence`

**Scope**

- Add `conversations`, `conversation_messages`, and `assistant_tool_calls`.
- Store validated structured state separately from message text.
- Add expiration and retention fields.
- Redact sensitive tool arguments and results.

**Tests**

- Ownership, expiration, message order, and redaction behavior.

### Task 5.2 — Define assistant tool schemas

**Commit:** `feat: define allow-listed assistant tools`

**Scope**

- Define typed tools: `search_venues`, `check_availability`, `get_booking_policy`, `create_booking`, `list_my_bookings`, and `cancel_my_booking`.
- Reject unknown tools and extra arguments.
- Never accept `requester_id`, database query text, or role escalation from model output.

**Tests**

- Valid schemas parse.
- Unknown fields, arbitrary SQL, and another user's ID are rejected.

### Task 5.3 — Implement read-only assistant tools

**Commit:** `feat: implement assistant venue discovery tools`

**Scope**

- Connect search, availability, and policy tools to existing services.
- Return minimal structured data suitable for model grounding.
- Hide private organizer details from free/busy results.

### Task 5.4 — Implement write assistant tools

**Commit:** `feat: implement controlled assistant booking tools`

**Scope**

- Connect booking and cancellation tools to the existing domain services.
- Inject authenticated identity at the server boundary.
- Require explicit confirmation state and idempotency key.
- Record tool call outcome and affected booking.

**Tests**

- The assistant path receives the same validation and conflict behavior as the web path.
- No write occurs before explicit confirmation.

### Task 5.5 — Add assistant orchestration endpoint

**Commit:** `feat: add conversational booking endpoint`

**Scope**

- Add `POST /assistant/messages`.
- Load the authenticated user's conversation and structured state.
- Call the configured model provider with the fixed tool definitions.
- Execute requested tools through the allow-list and return a grounded response.
- Treat tool output, not model prose, as proof of booking success.

**Tests**

- Multi-turn missing-field collection.
- Venue discovery, selection, confirmation, conflict, and cancellation flows.
- Provider failure does not corrupt booking state.

### Task 5.6 — Add adversarial assistant tests

**Commit:** `test: harden assistant tool boundaries`

**Scope**

- Test prompt injection requesting raw SQL, secrets, role escalation, other users' bookings, hidden system instructions, and unconfirmed writes.
- Test malformed and replayed tool calls.
- Assert denied tool calls are audited without leaking sensitive data.

## M6. Hardening and delivery readiness

### Task 6.1 — Standardize errors and request tracing

**Commit:** `feat: standardize API errors and request tracing`

**Scope**

- Add stable error codes, safe messages, validation details, and request IDs.
- Map database integrity errors to domain responses.
- Do not expose stack traces, SQL, or credentials.

### Task 6.2 — Add structured logging and metrics

**Commit:** `feat: add backend observability`

**Scope**

- Add structured logs for request ID, endpoint, latency, outcome, and safe actor identifiers.
- Add metrics for booking attempts, confirmations, conflicts, cancellations, assistant tool outcomes, and database latency.
- Redact authorization headers, cookies, message content, and secrets.

### Task 6.3 — Add rate limiting and abuse controls

**Commit:** `feat: add API and assistant abuse controls`

**Scope**

- Rate-limit login, booking writes, availability scans, and assistant messages.
- Bound pagination, date ranges, message size, and tool-call count per turn.
- Return retry guidance without leaking internal thresholds unnecessarily.

### Task 6.4 — Add Docker deployment assets

**Commit:** `chore: containerize UniSpot backend`

**Scope**

- Add a non-root production Dockerfile.
- Add local Docker Compose services for API, PostgreSQL, and worker.
- Add startup migration guidance and health checks.
- Keep secrets in environment configuration, not images or Compose files.

### Task 6.5 — Complete backend documentation and release checks

**Commit:** `docs: complete backend setup and release guide`

**Scope**

- Document setup, migrations, tests, environment variables, architecture, assistant boundaries, and operational commands.
- Add a traceability matrix mapping PRD requirements to endpoints, services, migrations, and tests.
- Run the final verification checklist below.

## 6. Final verification checklist

Before calling the backend MVP complete, verify:

- [ ] `alembic upgrade head` succeeds on a clean PostgreSQL database.
- [ ] All tests pass against PostgreSQL.
- [ ] Ruff and type checks pass.
- [ ] Two concurrent overlapping requests cannot both commit.
- [ ] A booking ending at a given time and another beginning at that exact time can both commit.
- [ ] An active venue block prevents booking from both the web and assistant paths.
- [ ] A venue administrator can see allocations but has no approval or rejection action.
- [ ] `Pending`, `Approved`, `Rejected`, `approved_by`, and `approved_at` are absent from the ordinary booking schema and API.
- [ ] The assistant cannot submit raw SQL, choose a requester ID, access another user's private booking, or write without explicit confirmation.
- [ ] Idempotent retries do not create duplicate bookings.
- [ ] Cancellation releases the occupied interval atomically.
- [ ] Every booking mutation produces booking history and an audit event.
- [ ] Notification failure does not undo a successful booking.
- [ ] Secrets and sensitive conversation content are absent from logs and commits.
- [ ] The standard booking interface remains usable when the model provider is unavailable.
- [ ] OpenAPI accurately describes authentication, schemas, errors, and endpoints.

## 7. Suggested execution order for coding agents

Use one agent task per numbered implementation task. Start a fresh context or provide only the relevant PRD section, database models, current repository tree, and previous task summary. Require the agent to return:

1. Files changed.
2. Design decisions made.
3. Tests added.
4. Commands run and results.
5. Remaining risks or blockers.
6. Proposed commit message.

Do not allow multiple agents to modify the same files concurrently. Parallel work is safest only when tasks have non-overlapping files and stable shared interfaces. Database migrations, core models, authentication, booking transactions, and assistant tool contracts should be developed sequentially.

## 8. Recommended first coding session

Begin with Tasks 0.1 through 0.3 only:

1. Initialize FastAPI and health endpoint.
2. Add typed configuration.
3. Connect async PostgreSQL with a tested request-scoped session.

Stop before creating domain models. Review the package structure, environment handling, test setup, and session lifecycle first; they become the foundation for every later commit.
