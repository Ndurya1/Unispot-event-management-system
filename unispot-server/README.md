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
