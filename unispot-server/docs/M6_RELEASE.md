# M6: backend hardening and release guide

Branch: `production-hardening`. Scope: backend, deployment assets and backend CI;
no React implementation or production deployment.

## Architecture and invariants

FastAPI routes authenticate the caller and validate bounded input. Domain services
own booking policy and transactional writes. PostgreSQL is authoritative: active
reservations use an exclusion constraint with half-open `[start, end)` ranges,
so adjacent bookings are allowed but overlapping bookings/blocks are not.
History, notification creation and successful booking audit events commit with
the booking. A separate worker delivers in-app notifications, caps failed
external delivery attempts, and purges expired conversations/rate buckets.

The assistant's typed tools call these same services. Neither the provider nor
client tool arguments choose a requester, roles or executable SQL. Write proposals
require a matching server-issued confirmation ID. A later non-confirmation turn
invalidates the old proposal, including when its replacement has invalid arguments.
One write per turn is allowed. Concurrent turns on an existing conversation return
409 immediately; same-key booking requests serialize and replay without duplicates.

Policy requires an active `ORGANIZER` membership (a generic active member cannot
book) and remains: minimum 24-hour booking lead time, maximum 12-hour duration,
maximum 180-day advance window, capacity and venue
operating hours. Cancellation requires at least 24 hours' notice.

## Local development and verification

Use Python 3.13+, PostgreSQL 17 and `uv`; copy `.env.example` to `.env`, replace
local credentials as needed, then:

```powershell
uv sync --all-groups --locked
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --no-access-log
# In another terminal:
uv run python -m app.worker
```

The application has no public registration or automatic admin bootstrap. Provision
users, password hashes, roles and memberships through your existing controlled
administrative process. System administrators can manage account status and role
assignments through the protected `/admin/users/{id}/status` and
`/admin/users/{id}/roles` endpoints; every change is audited and an administrator
cannot disable their own account or remove the last active system administrator.
`POST /auth/login` returns bearer tokens for an active
account, and `POST /auth/refresh` exchanges a valid refresh token only while its
user remains active. Suspended/disabled users cannot refresh old tokens.

```powershell
uv run ruff check .
uv run mypy app tests
uv run pytest -q
```

Set `TEST_DATABASE_URL` to a dedicated test database, never production. PostgreSQL
integration tests otherwise skip. The release fixture uses a generated
`unispot_release_<uuid>` database and a test-only user with `CREATEDB` privileges.
It verifies upgrade to head, downgrade to base, upgrade again, then removes only
its own generated database. Other fixtures roll back their test writes.
Never use `alembic downgrade base` against retained application data.

## Containers and migrations

```powershell
Copy-Item .env.compose.example .env.compose
# Edit placeholders. DATABASE_URL must use host postgres, not localhost.
docker compose --env-file .env.compose config --quiet
docker compose --env-file .env.compose up --build --wait --wait-timeout 180 api worker
docker compose --env-file .env.compose logs --tail 100 api worker migrate
docker compose --env-file .env.compose exec api alembic current
docker compose --env-file .env.compose down
```

`down` retains the database volume; do not add `--volumes` unless intentionally
discarding a disposable environment. The image runs as a non-root user and the
build context excludes `.env*`, source-control metadata, tests and developer tools.
The migration service waits for PostgreSQL; API and worker wait for migration
success. API readiness checks PostgreSQL, while `/health` checks process liveness.
The worker emits `worker_batch` / `worker_batch_failed` events; it does not expose
an HTTP health endpoint. Monitor absence of successful batches as well as failures.

This Compose file is a local deployment baseline, not a complete production
infrastructure definition. Before production, provision TLS ingress, encrypted
backups with a restore drill, resource limits, log retention, secret management,
monitoring/alerts and a restricted runtime DB role separate from the migration
owner. Run migrations once per release under the migration identity, not once per
replica. Restrict runtime audit permissions to SELECT/INSERT; the application has
no audit update/delete endpoint, and migration `20261009_0009` also enforces
append-only behavior with a database trigger. Keep runtime permissions restricted
as an additional defense.
Review and pin approved base-image digests in your deployment pipeline.

Migration `20261008_0008` adds only `rate_limit_buckets` and its expiry index;
`20261009_0009` adds a PostgreSQL append-only trigger for `audit_events`.
Existing booking data is unchanged. Back up before migrations. Downgrading 0008
drops rate-limit counters; downgrading 0009 removes database enforcement and must
only be done with an approved application rollback.

## Configuration

Required environment values are `APP_ENV`, `DATABASE_URL` (asyncpg PostgreSQL URL),
`JWT_SECRET_KEY` (at least 32 random characters) and `ALLOWED_ORIGINS` (JSON array).
Production rejects localhost configuration, example JWT secrets, empty origins,
and disabled throttling. Compose additionally requires `POSTGRES_PASSWORD`;
`POSTGRES_USER` and `POSTGRES_DB` default to `unispot`. Match and URL-encode the
database password in `DATABASE_URL`. Never place real secrets in examples or images.

| Setting | Default | Purpose |
| --- | --- | --- |
| `JWT_ALGORITHM` | HS256 | Token signing algorithm |
| `JWT_ACCESS_TOKEN_MINUTES` / `JWT_REFRESH_TOKEN_MINUTES` | 15 / 10080 | Token lifetimes |
| `MAX_REQUEST_BODY_BYTES` | 32768 | Actual streamed body limit; oversized body gets 413 |
| `REQUEST_BODY_TIMEOUT_SECONDS` | 15 | Maximum body-read time; timeout gets 408 |
| `RATE_LIMIT_ENABLED` | true | Cannot be disabled in production |
| `RATE_LIMIT_WINDOW_SECONDS` | 60 | Shared fixed-window duration |
| `RATE_LIMIT_LOGIN` | 10 | `/auth/*` requests per socket IP/window |
| `RATE_LIMIT_BOOKING` | 30 | Booking POSTs per socket IP/window |
| `RATE_LIMIT_AVAILABILITY` | 60 | Venue-list/availability GETs per socket IP/window |
| `RATE_LIMIT_ASSISTANT` | 20 | Assistant messages per socket IP/window |
| `ASSISTANT_TIMEOUT_SECONDS` | 20 | Provider completion timeout |
| `WORKER_INTERVAL_SECONDS` | 30 | Delay between bounded worker batches |

Rate buckets are atomic PostgreSQL upserts keyed by HMAC, not plaintext IPs; they
work across API replicas using the same JWT secret. HTTP 429 includes `Retry-After`,
not internal thresholds. The limiter fails closed with a safe database error.
The image disables proxy-header trust. Behind ingress, all clients can otherwise
share the ingress IP's quota: explicitly configure Uvicorn proxy trust for only
your ingress addresses, strip client-supplied forwarding headers at ingress, and
validate rate behavior before launch. Do not trust arbitrary forwarded IPs.

List routes bound `limit` and `offset` (offset at most 10000); venue, facility and
organization lists default to 50 and cap at 100. Availability intervals cap at
31 days. Paired booking/allocation date filters cap at 366 days and require
timezone-aware timestamps. Assistant messages cap at 4000 characters and 8 tools;
provider state patches cap at 8000 serialized characters. Database statements and
lock waits have 10-second and 5-second timeouts respectively.

## Error and assistant contract changes

Errors now have a common envelope (a breaking change from the old `detail` shape):

```json
{"error":{"code":"conflict","message":"The requested venue interval is no longer available","request_id":"<uuid>","details":[]}}
```

Validation details expose locations/codes, not submitted values. Database failures
never return SQL, driver text or credentials. `X-Request-ID` accepts a valid UUID
or generates a new one; it is returned on responses and used by audit records.
Typical statuses: 401 authentication, 403 authorization, 404 not found, 409 conflict,
413 body size, 422 validation/policy, 429 throttling, 503 database unavailable.
Inspect `/docs` or `/openapi.json` for route-specific models and bearer security.

For assistant writes, first send the proposed tool with `confirmed: false`.
Render the returned summary and let the user confirm it. Then send:

```json
{"conversation_id":"<returned UUID>","message":"Confirm","confirmed":true,"confirmation_id":"<state.pending_confirmation.confirmation_id>"}
```

Do not include `tool_calls` in a confirmation. Retrying the exact confirmation
reuses its saved idempotency key; the assistant no longer relies on a caller-supplied
`Idempotency-Key`. Standard create/cancel booking routes still require that header.
Successful proposal state is retained for replay until a changed turn or expiry.

## Logs and metrics

JSON request logs include request ID, route template (not raw path/query), method,
status, latency and authenticated actor UUID. Authorization/cookies, request bodies,
chat text, SQL and exception text are not logged. Keep Uvicorn access logs disabled
as in the image; apply equivalent redaction to ingress/APM. Conversation content is
persisted as application data, not operational logs, with a 30-day retention policy.

`GET /admin/metrics` requires SYSTEM_ADMIN. Counters cover booking attempts,
confirmations, conflicts, replays, denials, cancellations, assistant tool outcomes,
HTTP status classes and cumulative DB query latency/errors. These are process-local,
reset on restart, and are not a distributed metrics backend. Scrape each instance
and derive rates externally; this implementation does not supply histograms or
production alerting. Never use these approximate counters as a billing/audit ledger.

## PRD traceability and acceptance evidence

| Requirement | Routes / implementation | Schema migrations | Automated evidence |
| --- | --- | --- | --- |
| Active identity, user administration and administrative visibility, no approvals | `/auth/login`, `/auth/refresh`, `/admin/users/*`, `/admin/allocations`; auth dependencies | 0002 identity; 0004 booking | HTTP auth/admin regression, OpenAPI/schema tests |
| Automatic policy-based booking, organizer role, 24h / 12h boundaries | `POST /bookings`; booking_policy / booking_service | 0003 reservations; 0004 booking | `test_booking_requires_organizer_membership`, `test_business_rule_boundaries`, HTTP create test |
| No overlap, adjacent intervals allowed, blocks respected, alternatives on conflict | shared reservation exclusion constraint and conflict lookup | 0003 | `test_atomic_conflicts_replay_back_to_back_and_cancellation`, `test_block_prevents_web_and_assistant_writes` |
| Owned retrieval, cancellation, idempotent retries | `/bookings/me`, `/{id}`, `/{id}/cancel`; lifecycle / idempotency | 0004, 0005 | ownership, HTTP cancellation, concurrent same-key tests |
| Assistant cannot bypass identity/confirmation or execute SQL | `/assistant/messages`; typed executor, saved confirmation | 0007 | assistant schema, invalid-replacement, create/retry/cancel and conversation-concurrency tests |
| History/audit and notification independence | transactional booking events; worker; append-only audit trigger | 0005–0007, 0009 | HTTP history/request-ID test, delivery retry-cap test |
| Safe errors/tracing and abuse bounds | HTTP middleware, exception handlers, admin metrics | 0008 rate buckets | `test_hardening.py`, atomic limiter test |
| Non-model booking remains usable during provider outage | separate domain services and API routes | no new schema | `test_provider_failure_keeps_web_booking_usable` (backend service path) |
| Reproducible schema and deployment | Alembic, Dockerfile, compose, backend CI | 0001–0009 | disposable database upgrade/downgrade/upgrade; CI container smoke job |

Local verification: **43 tests passed** against PostgreSQL (including release
upgrade/downgrade/upgrade), Ruff passed, mypy passed for 84 source files,
`git diff --check` passed, and Compose configuration validation passed. The test
run emits one existing Starlette/httpx deprecation warning; no test is skipped in
this PostgreSQL-backed run. Docker build/start has NOT been verified locally because
the Docker engine is unavailable; the new CI container job must pass before release.
No production rollout, browser journey, external-provider call, backup restore or
load test has been performed.

| M6 acceptance area | Status | Evidence / limitation |
| --- | --- | --- |
| 6.1 Errors and tracing | PASS | Error/redaction tests; HTTP request ID matches stored audit |
| 6.2 Observability | PASS for backend implementation | JSON logs, bounded counters and admin-only metrics; production collection not verified |
| 6.3 Abuse controls | PASS | Atomic shared limiter, body cap, schema bounds, confirmation/concurrency regressions |
| 6.4 Container deployment | NOT VERIFIED at runtime | Assets and CI job added; Compose config passes, local daemon unavailable |
| 6.5 Documentation and backend release checks | PASS for local checks | This guide, traceability matrix, migrations, API/database tests, lint/types |
| Browser and production rollout | NOT VERIFIED | React untouched; no deployment performed |

## Outstanding release gates and inherited limitations

- The shipped provider is still rule-based; no external model adapter/configuration
  switch exists. Full natural-language creation/slot completion is not implemented,
  although typed, confirmed create/cancel tools are exercised. Do not label the
  complete conversational product production-ready based on M6 backend checks.
- Availability search reports active, unoccupied venues; booking additionally enforces
  operating hours, lead time, duration and membership. A search result is not a
  guarantee that every booking policy will pass.
- Email/SMS delivery adapters are not implemented. In-app delivery works; external
  channels fail with capped retry metadata and do not roll back bookings.
- Client integration must adopt the new error envelope and confirmation token.
  React remains untouched and its full journey has not been verified.
- Container CI and the production operational controls described above remain
  release gates. No credentials, cloud infrastructure or provider choice is assumed.
