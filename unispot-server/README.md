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
integration tests locally. The release suite creates a randomly named disposable
database, migrates it up/down/up, and removes only that database afterward; its
test-only PostgreSQL user therefore needs `CREATEDB` privileges.

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
the client sends `confirmed: true` with the server-issued `confirmation_id` and
the same `conversation_id`, without resending tool arguments. The backend binds
the confirmation to the saved proposal and generates its idempotency key.
Changing the proposal invalidates the previous confirmation. Standard booking
endpoints continue to require an `Idempotency-Key` header.

The current provider is a limited rule-based fallback; no external model adapter
or provider-configuration switch is implemented. Typed create/cancel tools work,
but full natural-language booking completion remains a separate integration gap.

## Production hardening (M6)

See [the release and operations guide](docs/M6_RELEASE.md) for Docker setup,
environment variables, the error contract, observability, PRD traceability,
verification evidence, and outstanding deployment checks.

All API errors now use `error.code`, `error.message`, `error.request_id`, and
`error.details` rather than FastAPI's old `detail` shape. Clients should respect
HTTP 429 `Retry-After` and retain `X-Request-ID` for support. React is not changed
in this milestone.
