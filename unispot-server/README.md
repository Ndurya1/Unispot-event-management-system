# UniSpot backend

FastAPI backend for UniSpot's policy-driven venue discovery and booking platform.
PostgreSQL is the authoritative source for availability; ordinary bookings are
allocated automatically and never enter an administrator approval queue.

## Local setup

Prerequisites: Python 3.13+, `uv`, and PostgreSQL.

```powershell
Copy-Item .env.example .env
uv sync --all-groups
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

The frontend development server runs on `http://localhost:5173` by default;
that origin is included in the example CORS configuration. Set
`TEST_DATABASE_URL` to an isolated PostgreSQL database when running the
integration test locally.

The example environment is deliberately local-only. Replace its database URL and
JWT secret before using the application outside a test environment.

## Checks

```powershell
uv run pytest
uv run ruff check .
uv run mypy app tests
uv run alembic upgrade head
```

`GET /health` is a process liveness check. `GET /health/readiness` verifies the
PostgreSQL connection and returns HTTP 503 with a stable, non-sensitive error when
the database is unavailable.

CI provides `TEST_DATABASE_URL` automatically for the PostgreSQL-backed
integration check.

## In-app assistant

The authenticated React client sends conversational turns to
`POST /assistant/messages`. The endpoint persists conversation state and accepts
only the typed allow-list: `search_venues`, `check_availability`,
`get_booking_policy`, `list_my_bookings`, `create_booking`, and
`cancel_my_booking`. Venue discovery and booking writes run through the same
domain services as the standard UI. Create and cancel calls are staged until
the client sends `confirmed: true`; booking writes also use an
`Idempotency-Key` header.

The default local provider is a safe rule-based fallback. A model adapter can be
configured behind the provider interface without exposing database credentials
or accepting model-generated SQL, requester IDs, or role escalation.
