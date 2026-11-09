# UniSpot Production Readiness QA Report

Audit date: 2026-11-09, Africa/Nairobi. Repository: `C:\Unispot_app`, branch `main`, HEAD `9c4240c`.

## 1. Executive Summary

**Verdict: NO-GO.** The frontend cannot pass its documented frozen dependency installation or production build. A freshly migrated database cannot support event registration/attendance, equipment reservations fail on insert, provider requests fail before execution, and the waitlist join endpoint is absent. Account recovery fails for existing users and password reset does not revoke existing refresh tokens.

The original venue-booking subsystem has useful, verified safeguards. PostgreSQL-backed release tests passed for competing bookings, idempotent replay, policy boundaries, ownership, cancellation, assistant confirmation, audit immutability, shared throttling, and notification retry limits. An actual Chrome journey created and cancelled a booking and verified persistence. Those successes do not establish readiness of the complete application.

Final pytest result: **76 collected; 61 passed, 13 failed, 2 skipped because a prerequisite is broken**. This includes 28 added QA cases. The original suite alone produced 47 passes and one outdated-fixture failure. Additional evidence includes 74 browser route/viewport observations, a separate booking journey, 40 API GET probes, migration round trips, configuration checks, and dependency scans.

Application implementation, migrations, deployment files, and dependencies were not changed. An existing two-line change to `unispot-server/uv.lock` was present before the audit and preserved. Python dependency results therefore describe that working lockfile, not an independently reconstructed pristine checkout. No deployment or external production testing occurred.

### Architecture discovered

| Layer | Implementation and responsibilities |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router; public discovery, authentication, student/organizer/provider dashboards, five service screens, and administrative sections. Bearer tokens in localStorage or sessionStorage; shared fetch client retries through refresh. |
| API | FastAPI, Pydantic, SQLAlchemy async sessions; **107 OpenAPI operations**. Identity, venues/facilities/availability, organizations, bookings, events/registrations, equipment, providers, scheduling, certificates, notifications, assistant, audit, metrics, and administration. |
| Persistence | PostgreSQL/asyncpg. Alembic chain has 24 revision files, ending at `20261108_0023`. Venue occupancy uses a PostgreSQL range exclusion constraint. Other domains add idempotency, role/membership, notification, audit, and operational tables. |
| Worker | `python -m app.worker`; bounded notification batches, capped retries, conversation retention, rate-bucket cleanup. In-app delivery implemented; notification EMAIL/SMS adapters remain unavailable. |
| Integrations | Resend transactional auth email; rule-based assistant. Gemini adapter is disabled. Neon configuration exists but does not replace the PostgreSQL API layer. No implemented payment or file-upload workflow identified. |
| Deployment | Backend non-root Docker image; Compose PostgreSQL, migration job, API, worker. GitHub Actions backend lint/types/migrations/tests/container smoke; frontend frozen pnpm install/types/build. No complete frontend hosting/TLS configuration in this repository. |
| Authorization | System roles include STUDENT, ORGANIZER, VENUE_ADMIN, SYSTEM_ADMIN, SERVICE_PROVIDER, UNIVERSITY_STAFF. Active ORGANIZER organization membership is a separate booking eligibility condition. |

Full operation inventory: [api-results.json](qa-artifacts/api-results.json). Repository inventory covered 260 tracked files and generated/dependency directories were identified separately.

### Risk-based coverage plan used

1. Establish reproducibility: dependencies, build/type checks, migration upgrade/downgrade/upgrade, schema comparison and startup.
2. Verify core booking integrity: concurrent conflict, same-key replay, ownership, policy boundaries, cancellation, audit and notification atomicity.
3. Probe newer functionality outside the original suite: account recovery, equipment, event capacity/attendance, providers, waitlist joins, recurrence and certificates.
4. Exercise frontend/API integration in a browser, including role redirects, reloads, invalid inputs, network failure, responsive layout and a persisted booking journey.
5. Review defensive controls and measure bounded local performance; document external/container/operational gates separately.

Documentation is materially stale: the README and scope document call API-backed services demonstrations and even state that there is no backend; the API guide describes an obsolete registration response; the role-provisioning guide targets a nonexistent `users.role` field. The newer PR update accurately expands the scope to events/providers/operations, but its implementation claims needed fresh runtime verification.

## 2. Test Environment

| Item | Actual environment |
| --- | --- |
| OS/shell | Windows, PowerShell |
| JavaScript | Node 22.19.0; pnpm 11.25.0; installed Vite 6.4.5 |
| Browser | Headless Google Chrome 156.0.8078.80 through isolated Playwright 1.65.0 |
| Python | 3.13.7; existing backend virtual environment |
| Libraries | FastAPI 0.141.1, Starlette 1.7.0, SQLAlchemy 2.1.1, asyncpg 0.31.0, pytest 9.1.1, Pydantic 2.13.5, PyJWT 2.15.1, Uvicorn 0.54.0 |
| Database | New PostgreSQL 18 cluster at `127.0.0.1:55432`, database `unispot_qa`; disposable `unispot_release_<uuid>` databases for release suites. CI targets PostgreSQL 17, which was not separately exercised. |
| HTTP test servers | API `127.0.0.1:18000`; Vite `127.0.0.1:5174`. Existing port 8000 was left untouched. |
| Data/integrations | Synthetic users, organizations, venues, bookings and services only. Auth-email transport mocked. Browser external HTTP requests blocked. No real email, provider requests, payment, or external model calls. |
| Browser test limits | Test-only auth/catalogue quotas raised to permit route sweeps. Normal throttling tested separately in the existing suite. |

Browser checks used the Vite development server because the production build fails. They are not production-bundle validation. Browser accounts had role assignments plus seeded organizer memberships; pure student/no-membership browser behavior was not exhaustively covered. API authorization tests use independent ordinary student fixtures.

Commands executed, from the appropriate root/backend directory:

```text
npm run typecheck
npm run build
corepack pnpm install --frozen-lockfile --lockfile-only --ignore-scripts
uv lock --check --offline
.venv\Scripts\python -m ruff check . --output-format json --output-file ../qa-artifacts/ruff.json
.venv\Scripts\python -m mypy app tests
.venv\Scripts\python -m alembic upgrade head
.venv\Scripts\python -m alembic check
.venv\Scripts\python -m pytest -q --tb=short --junitxml=../qa-artifacts/final-pytest.xml
node qa-artifacts/browser-audit.cjs
node qa-artifacts/booking-journey.cjs
unispot-server\.venv\Scripts\python qa-artifacts/api-probes.py
unispot-server\.venv\Scripts\python qa-artifacts/config-probes.py
unispot-server\.venv\Scripts\python qa-artifacts/source-audit.py
npm audit --json --ignore-scripts
uv export --frozen --no-dev --no-emit-project --format requirements-txt --output-file ../qa-artifacts/runtime-requirements.txt
uv tool run pip-audit -r ../qa-artifacts/runtime-requirements.txt --no-deps --disable-pip --format json --output ../qa-artifacts/python-audit.json
docker compose --env-file .env.compose.example config --quiet
```

All backend tests explicitly set `APP_ENV=test`, a synthetic JWT key and `DATABASE_URL`/`TEST_DATABASE_URL` to the new local cluster. Reproduction instructions are in [qa-artifacts/README.md](qa-artifacts/README.md). Some commands required escalation because the Windows sandbox denied cache access, local listeners, PostgreSQL startup or writes to new test files. Initial blocked attempts were retried; they are not counted as successful tests.

## 3. Test Execution Results

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Existing backend suite | 47 passed, 1 failed, no skips | Original fixture omits `email_verified_at`; [baseline XML](qa-artifacts/baseline-pytest.xml). |
| Added QA suite | 14 passed, 12 failed, 2 blocked/skipped | 28 cases; [QA tests](unispot-server/tests/integration/test_production_readiness.py), [QA XML](qa-artifacts/qa-pytest.xml). |
| Final combined suite | **61 passed, 13 failed, 2 skipped**, 39.91 seconds | [Final XML](qa-artifacts/final-pytest.xml), [log](qa-artifacts/final-pytest.log). One Starlette/httpx deprecation warning. |
| Frontend typecheck/build | FAIL, 10 TypeScript diagnostics each | [Build log](qa-artifacts/frontend-build.log). No new production bundle produced. |
| Frozen pnpm validation | FAIL | `ERR_PNPM_OUTDATED_LOCKFILE`: router specifier differs. Offline first attempt also lacked cached registry metadata. |
| Python lock consistency | PASS | `uv lock --check --offline`: resolved 68 packages without changes. Not a clean-environment install or image build. |
| Backend lint | FAIL | `ruff check .`: 547 findings; initial narrower `app tests` scan: 477. [JSON](qa-artifacts/ruff.json). New QA files pass targeted Ruff. |
| Backend typing | FAIL | 49 existing errors in 12 application files; final check covered 124 files. [Log](qa-artifacts/mypy.log). |
| Empty DB upgrade | PASS | All revisions reached head. |
| Upgrade/down/upgrade | PASS | Existing disposable release fixture ran successfully, including in final combined run. This does not prove populated production rollback safety. |
| Schema/model consistency | FAIL | `alembic check`: missing attendance column and metadata differences, including a proposed rate-limit table removal. No generated migration applied. |
| HTTP GET sweep | 38 HTTP 200; 2 HTTP 503 | 40 GET endpoints without path parameters, using admin auth when needed. Registration list endpoints fail. [Results](qa-artifacts/api-results.json). |
| Browser route sweep | 74 observations completed | No navigation-runner failures or uncaught `pageerror` events; nine observations included API errors. Route rendering is not workflow success. [Results](qa-artifacts/browser-results.json). |
| Browser booking journey | Creation/persistence/cancellation PASS; success-link routing FAIL | [Journey](qa-artifacts/booking-journey.json), [screenshot](qa-artifacts/booking-success.png). |
| Local latency sample | 100/100 sampled requests HTTP 200 | Five warmed endpoints, 20 requests each, concurrency 4. Small synthetic database; not load/capacity certification. |
| Compose syntax/interpolation | PASS | Example config validated. |
| Docker image/start/worker health | BLOCKED | Docker Desktop Linux engine named pipe absent, including outside sandbox. |
| Dependency scans | FAIL | npm: two moderate package entries; Python: two affected packages, two unique advisory IDs (scanner duplicated one). |
| Secret pattern scan | No matches in selected patterns | Current tracked tree and reachable history, excluding lockfiles from history; not exhaustive secret detection. [Results](qa-artifacts/source-audit.json). |
| Production operations | UNVERIFIED | TLS/ingress, backups/restore, alerts, real email delivery, multi-replica operation, production static hosting and deployment rollback. |

The two explicitly skipped QA cases concern past-event registration and certificate issuance for an unattended future event. Both are blocked by the missing attendance column, not treated as passes. An initial browser journey attempt had a test-selector error after successful creation; the selector was corrected and the complete journey rerun. Exploratory test issues were corrected before the final combined counts above.

## 4. Critical and High-Severity Defects

No Critical-severity exploit was established. The following confirmed High-severity issues independently block a complete release.

### QA-001 — High — Frontend release pipeline cannot install/build

- **Component:** frontend dependencies and API types.
- **Reproduce:** run the frozen pnpm command above, `npm run typecheck`, and `npm run build`.
- **Expected:** reproducible install and production output.
- **Actual:** frozen install rejects `react-router-dom` specifier `^6.30.1` in the lockfile versus `^6.30.6` in the manifest. TypeScript then reports missing `AuthResponse.user`, incompatible organization membership fields, and an invalid registration response union.
- **Evidence:** `package.json:16`, `pnpm-lock.yaml:30`; `src/api/types.ts:11`, `src/auth/storage.ts:12`, `src/pages/AuthPages.tsx:119`, `src/pages/VenuePages.tsx:118`; build log.
- **Root cause:** manifest/lock drift and handwritten frontend types diverging from API responses.
- **Recommended fix:** deliberately regenerate the selected lockfile; reconcile types against OpenAPI, preferably generate them; rerun clean frozen install, typecheck, build and browser checks on the built output.
- **Deployment impact:** no releasable frontend artifact can be produced by the documented pipeline.

### QA-002 — High — Migrated schema cannot support event registrations/attendance

- **Component:** event model and Alembic migrations.
- **Reproduce:** migrate an empty PostgreSQL DB to head, authenticate, GET `/events/registrations/me`, or POST a valid `/events/registrations` request with an idempotency key.
- **Expected:** list registrations / create one, preserving capacity and attendance integrity.
- **Actual:** HTTP 503. Concurrent capacity attempts both return 503 before the business rule can be tested.
- **Evidence:** `app/models/event.py:95` expects `checked_in_at`; information-schema query returns no such column. PostgreSQL reports `column event_registrations.checked_in_at does not exist`. `alembic check` proposes adding it. Browser registration/ticket/certificate screens and admin registration list encounter 503s.
- **Root cause:** model field added without a corresponding migration.
- **Recommended fix:** add a forward migration for the nullable timestamp; test upgrade from the actual previous release, clean install and schema comparison; rerun registration, capacity, check-in, cancellation and certificates.
- **Deployment impact:** major user journeys fail even though migrations and readiness return success.

### QA-003 — High — Equipment reservations always fail on generated column writes

- **Component:** equipment ORM/service and migration `20261105_0012`.
- **Reproduce:** create a positive-stock item and submit a valid reservation; the new concurrency test submits two requests for one item.
- **Expected:** one HTTP 201 and one 409; exactly one reservation.
- **Actual:** both return HTTP 503. PostgreSQL reports `cannot insert a non-DEFAULT value into column "reserved_range"`.
- **Evidence:** migration defines `reserved_range` as `GENERATED ALWAYS`; `app/services/equipment_service.py:185` explicitly sets it and `app/models/equipment.py` does not declare the computed mapping.
- **Root cause:** generated-column contract is inconsistent between model, service and database.
- **Recommended fix:** represent the database-generated range with SQLAlchemy `Computed` and stop supplying it; verify stock concurrency, rollback, adjacency and idempotent retry.
- **Deployment impact:** equipment reservation creation is unavailable; successful oversubscription protection remains unverified.

### QA-004 — High — Password recovery/resend fail and disclose account existence

- **Component:** authentication transactions.
- **Reproduce:** POST `/auth/forgot-password` and `/auth/resend-verification` for a new active account; repeat forgot-password with an unknown address.
- **Expected:** uniform HTTP 200 response; existing eligible account receives a new single-use token through the email adapter.
- **Actual:** existing account returns 503; unknown account returns 200. This reveals account existence and prevents recovery.
- **Evidence:** `app/services/auth_service.py:247` and `:279`; preceding SELECT starts a transaction, then `async with session.begin()` at `:253`/`:285` opens another. Three targeted assertions fail. Email transport was mocked, so failure is before external delivery.
- **Root cause:** transaction already begun by SQLAlchemy autobegin. Also inspect the reversed enum comparison at `:290` when repairing reset-token invalidation.
- **Recommended fix:** establish a single transaction boundary for lookup/token invalidation/insertion; test known/unknown/inactive/verified accounts, repeated requests and concurrent token consumption.
- **Deployment impact:** users cannot recover accounts, and a public account-enumeration signal exists.

### QA-005 — High — Password reset leaves old refresh sessions valid

- **Component:** JWT/session lifecycle.
- **Reproduce:** obtain a refresh token; complete a valid password reset; call `/auth/refresh` with the old token.
- **Expected:** old refresh token rejected after password reset.
- **Actual:** HTTP 200 with a new access token. Reusing the reset-action token correctly returns 400, so this is specifically session revocation failure.
- **Evidence:** `app/services/auth_service.py:186` checks only active user status; password reset at `:322` changes the password hash without a session version/revocation record. Targeted test confirms the old refresh token remains usable.
- **Root cause:** stateless refresh tokens without revocation/session-version checks. Client logout only clears browser storage.
- **Recommended fix:** persisted, rotating refresh sessions or a per-user token version; revoke on reset/logout/account compromise; test concurrent rotation and replay. Define access-token revocation behavior explicitly.
- **Deployment impact:** stolen sessions survive password recovery for the remaining refresh lifetime (default seven days).

### QA-006 — High — All service-request submissions return HTTP 500

- **Component:** provider request route.
- **Reproduce:** authenticated eligible organizer POSTs `/providers/requests` with an active provider, valid body and `Idempotency-Key`; missing-key requests also take a broken error-message branch.
- **Expected:** 201 for valid submission; controlled 400/422 for an invalid key.
- **Actual:** 500 before service execution.
- **Evidence/root cause:** `app/api/routes/providers.py:95` and `:96` access nonexistent `Settings.booking_idempotency_key_max_length`. Both mypy and HTTP reproduction confirm the failure.
- **Recommended fix:** use the actual shared bounded-key contract consistently; test valid/missing/empty/overlong keys and same-key replay through the HTTP endpoint.
- **Deployment impact:** provider request workflow cannot start; assignment/quote lifecycle is not verified end to end.

### QA-007 — High — Waitlist join handler is not registered

- **Component:** scheduling router.
- **Reproduce:** POST `/scheduling/waitlists` with a valid authenticated user, venue, interval and idempotency key.
- **Expected:** 201 and a durable owned queue entry.
- **Actual:** 405 Method Not Allowed; OpenAPI has no POST operation for this path.
- **Evidence/root cause:** `app/api/routes/scheduling.py:54` defines `create_waitlist_entry` without a route decorator. The frontend calls that path.
- **Recommended fix:** register the intended POST route; add HTTP join/replay/ownership/cancel tests and clarify what triggers queue advancement.
- **Deployment impact:** users cannot join a waitlist through the shipped API/UI.

### QA-008 — High — Production email configuration can silently disable account email

- **Component:** production settings and Compose environment.
- **Reproduce:** instantiate production settings with otherwise valid synthetic DB/JWT/origin values and omit Resend/frontend email settings; inspect Compose's API environment.
- **Expected:** production configuration rejects missing required email transport or explicitly disables email-dependent workflows; links target the real frontend.
- **Actual:** configuration accepts no email key and defaults `FRONTEND_URL` to localhost:5173. Compose forwards neither `RESEND_API_KEY`, `EMAIL_FROM`, nor `FRONTEND_URL`. Signup can return “check your email” while the sender returns false.
- **Evidence:** [config-results.json](qa-artifacts/config-results.json); `app/core/config.py:55`, `:57`, `:76`; `app/services/email_service.py:20`; `compose.yaml:3`. Verified configuration behavior; real delivery not attempted.
- **Recommended fix:** wire explicit production email settings, validate them, use a durable outbox/retry path and test provider failure/recovery with a sandbox sender.
- **Deployment impact:** email verification/recovery remains unusable in the documented container configuration even after QA-004 is repaired.

### QA-009 — High — Runtime dependency set contains a compromised-root advisory

- **Component:** Python runtime trust bundle.
- **Reproduce:** audit the frozen runtime export with pip-audit.
- **Expected:** deployed TLS trust bundle excludes known compromised trust paths.
- **Actual:** locked `certifi==2026.7.22` is flagged by `PYSEC-2026-4320` / `GHSA-6q48-6c7w-9gw2`.
- **Evidence:** [python-audit.json](qa-artifacts/python-audit.json), [certifi advisory](https://github.com/advisories/GHSA-6q48-6c7w-9gw2). The scanner lists the same certifi advisory twice; count it once.
- **Root cause:** outdated CA bundle in the tested lockfile. Exploitation was not attempted; it requires an on-path attacker and a compromised intermediate key.
- **Recommended fix:** update certifi to a verified fixed version (advisory recommends 2026.10.19 or later), refresh the lockfile deliberately and rebuild/re-audit the image.
- **Deployment impact:** outbound HTTPS, including transactional email, relies on this trust bundle; remediate before release.

## 5. Security Assessment

Confirmed positive controls: public signup did not grant SYSTEM_ADMIN despite a supplied elevated role; ordinary students received 403 on four representative admin resources, anonymous requests received 401; cross-organizer event editing and attendee-list reads were denied; booking/conversation ownership and assistant write confirmation passed existing tests. Parameterized venue filtering handled a SQL-like string without matching data. Malformed login inputs returned safe 422 envelopes with request IDs. Untrusted-origin preflight was rejected. Password hashing uses Argon2. Reset-action tokens are hashed and single use in the tested path.

Confirmed security defects are QA-004, QA-005, QA-009 and the following:

### QA-010 — Medium — Equipment errors expose SQL and submitted parameters

- **Reproduce:** as admin POST `/equipment/items` with unique slug/name and `total_quantity: 0`.
- **Expected:** bounded validation error without SQL/driver details.
- **Actual:** HTTP 400 message includes SQLAlchemy/asyncpg exception type, table/constraint, INSERT statement and bound parameters.
- **Evidence/root cause:** `app/api/routes/equipment.py:63` wraps every exception with `detail=str(error)`, bypassing global safe DB handling. Schema permits zero while DB requires positive stock. New `test_equipment_constraint_errors_do_not_expose_sql` fails.
- **Fix/impact:** align validation and constraints; handle known domain errors only and let safe handlers redact database failures. Confirmed exposure is admin-only, not an anonymous SQL-injection exploit.

### QA-011 — Medium — Unescaped account names are inserted into email HTML

- **Reproduce:** call the verification-email renderer with a name containing a benign HTML anchor, capture the mocked send payload.
- **Expected:** name rendered as text.
- **Actual:** injected anchor appears as HTML.
- **Evidence/root cause:** `app/services/email_service.py:70` and `:86` interpolate `full_name` directly; targeted template test fails.
- **Fix/impact:** escape untrusted text or use autoescaping templates; test verification and reset templates. This confirms HTML/content injection, not JavaScript execution in an email client. No email was sent.

Other dependency findings: `dnspython==2.8.0` is flagged for DNS decompression CPU exhaustion; fixed version reported is 2.9.0. npm reports react-router/react-router-dom moderate findings for open redirects and SSR error hydration. This app uses client-side BrowserRouter; SSR reachability was not established. Open-redirect exploitability was not demonstrated. Upgrade with router compatibility tests, rather than applying a blind major-version audit fix. Sources: [dnspython advisory](https://github.com/advisories/GHSA-45c3-73f7-pv4m), [router redirect advisory](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [SSR advisory](https://github.com/advisories/GHSA-337j-9hxr-rhxg).

Security limitations and risks, not established exploits:

- Browser storage exposes tokens to any successful same-origin XSS; no exploitable application DOM-XSS path was established. Email HTML injection is a separate finding.
- Authentication uses Authorization headers rather than ambient auth cookies, reducing classic CSRF exposure. No separate cookie-authenticated flow was identified.
- Rate limiting covers `/auth/*`, booking POSTs, availability/catalogue and assistant messages. Newer write endpoints are not equivalently limited. All `/auth/*` calls share the default ten-per-minute bucket, including session checks and refresh; browser sweeps used higher test-only limits.
- Docker disables proxy-header trust. Behind a proxy this can group users under one source-IP quota unless ingress trust is configured correctly; production ingress was not available to verify.
- JWT refresh rotation/replay detection and server-side logout are absent by inspection; password-reset persistence was independently demonstrated in QA-005.
- No file-upload endpoint was identified: upload testing is not applicable to the current API inventory.
- Current-tree/history pattern scanning found no private-key, AWS-key, GitHub-token or selected provider-key matches. This is not proof that arbitrary credentials were never committed. Existing local `.env` values were not exported.

## 6. Performance Assessment

Measured over HTTP against the isolated local API, warm-up followed by 20 requests per route, concurrency capped at four:

| Endpoint | Median ms | p95 ms | Max ms | HTTP 200 |
| --- | ---: | ---: | ---: | ---: |
| `/health` | 43.30 | 56.81 | 60.23 | 20/20 |
| `/health/readiness` | 28.94 | 49.78 | 61.24 | 20/20 |
| `/venues` | 95.52 | 113.47 | 116.91 | 20/20 |
| `/events` | 70.67 | 137.18 | 311.12 | 20/20 |
| `/providers` | 69.60 | 92.54 | 100.03 | 20/20 |

Evidence: [api-results.json](qa-artifacts/api-results.json). This used five synthetic venues, a few bookings and default service rows on a shared developer machine while other audit work ran. It is not a representative production dataset, sustained load, throughput SLO or memory-leak test. No production/shared-service load test was performed.

A local `EXPLAIN (ANALYZE, BUFFERS)` of active reservations for a nonexistent venue used a Bitmap Index Scan on `ex_venue_reservation_time`, one shared-buffer hit; reported planning 0.279 ms, total execution 5.830 ms. This demonstrates index use for that query only, not general production selectivity.

Inspection identified unbounded event/provider lists and several personal-history lists, full-table counts used for lazy seeding, and an individual event GET that scans up to 500 event summaries. Relationships often use `selectinload` and event counts are grouped, but no complete query-count or large-dataset N+1 certification was performed. SQL statement/lock timeouts are configured at 10/5 seconds; pool pre-ping is enabled. The frontend fetch client has no explicit timeout or cancellation policy.

Memory growth, worker liveness under prolonged outages, multi-replica throughput, pool exhaustion, large notification audiences and production resource limits remain unverified. Add measured SLOs and repeat with a representative dataset after correctness fixes.

## 7. Database and Data Integrity Assessment

Clean upgrade and disposable full rollback/re-upgrade passed. Core booking exclusion constraints, adjacent intervals, same-key concurrency and cancellation release passed runtime tests. An orphan check in the audit DB found **zero bookings without their referenced reservation**; this does not describe production data.

Schema comparison failed materially: attendance column missing; equipment generated-column mismatch independently reproduced; Alembic metadata omits `rate_limit_buckets` because its model is not imported by `app.models.__init__`, so autogenerate suggests removing that operational table. Additional existing index/name differences were reported. Do not blindly apply autogenerate output. Preserve deliberate SQL constraints/indexes and make metadata comparison explicit in CI.

### QA-012 — Medium — Concurrent read requests race while seeding default records

- **Reproduce:** on a freshly migrated empty service catalogue, issue concurrent GET `/events`, `/providers`, or `/equipment/availability`; React development StrictMode also issued duplicate initial requests during the browser run.
- **Expected:** read-only, deterministic successful responses; production catalogue populated deliberately.
- **Actual:** browser observed HTTP 409 during first-load GETs for all three catalogues, and GETs inserted fixed demo records, including April 2026 events during a November audit.
- **Evidence/root cause:** `event_service.py:396`, `equipment_service.py:231`, and `_ensure_default_providers` perform count-then-insert-and-commit without concurrent-safe seeding. Browser result entries record the 409s.
- **Fix/impact:** move demo population to an explicit development seed command; use safe upserts if initialization is required. Prevent transient first-use failures and accidental production demo content. Exact race frequency was not measured.

### QA-013 — Medium — Account deletion is broken and conflicts with audit retention

- **Reproduce:** authenticate a synthetic user, DELETE `/auth/me`.
- **Expected:** documented deletion/anonymization succeeds atomically and preserves required history.
- **Actual:** HTTP 500 before deletion. Direct import reproduction confirms `VenueBlock` cannot be imported from `app.models.venue`.
- **Evidence/root cause:** `auth_service.py:402`; additional inspected problems include nested transaction after auth lookup, updating append-only audit rows at `:423`, a nonexistent conversation import and remaining RESTRICT references. The latter problems were not bypassed to test subsequent execution.
- **Fix/impact:** design an explicit account-retention/anonymization transaction; correct imports and dependency handling; preserve append-only audit semantics and verify rollback with bookings/certificates/conversations. Current account deletion promise is not fulfilled.

### QA-014 — Medium — Equipment inventory editing requires unrelated interval fields

- **Reproduce:** PATCH `/equipment/items/{id}` as admin with `{"total_quantity":10}`.
- **Expected:** inventory quantity changes without reservation dates.
- **Actual:** 422, missing `starts_at` and `ends_at`.
- **Evidence/root cause:** `app/schemas/equipment.py:28` accidentally contains required interval fields and an undefined `EquipmentAvailabilityRequest` return annotation; targeted test and mypy agree.
- **Fix/impact:** separate inventory and interval schemas, preserve the frontend partial-update contract, and test zero/negative/overcommitted stock. Admin inventory maintenance is blocked.

Further unverified integrity risks: recurrence currently persists schedules but no occurrence-generation worker was found; waitlist advancement was not established; policy/settings/maintenance records exist but no general linkage from those records to booking validation was found. Certificate issuance checks confirmed registration rather than observed attendance/event completion; attendee self-check-in is allowed by the service. These require product-policy decisions and executable tests after QA-002 is fixed; they are not presented as proven unauthorized issuance exploits.

## 8. Frontend and UX Assessment

Executed Chrome checks covered public routes, auth/reset/verification shells, access redirects, all five service screens, student/organizer/provider dashboards, the administrative navigation sections and search, unknown-route fallback, plus dynamic event/venue details in the booking journey. Results retain the exact routes and final redirect destinations.

Desktop testing used 1440px width; mobile samples 390px and tablet samples 768px. No horizontal document overflow was detected in the 74 observations. Screenshots of mobile home, desktop organizer and mobile admin were visually inspected. This was a sampled responsive review, not every page at every size. Examples: [mobile home](qa-artifacts/browser-anonymous-_-390.png), [organizer](qa-artifacts/browser-organizer-_organizer_dashboard-1440.png), [mobile admin](qa-artifacts/browser-system_admin-_admin-390.png).

Empty login uses browser validation; invalid credentials show a useful error; all five tested roles redirected correctly and retained sessions across reload. Aborting venue requests produced “Venue data could not be loaded.” Mobile navigation opened. First keyboard focus reached “Skip to main content.” The simple visible-input label scan found no missing labels in inspected states. Full keyboard traversal, screen-reader behavior, modal focus trapping, color contrast and WCAG conformance were not established.

### QA-015 — Medium — Successful organizer booking links to a forbidden dashboard

- **Reproduce:** organizer completes the three-step booking form, then clicks “View my bookings.”
- **Expected:** organizer's booking list.
- **Actual:** `/access-denied`. Manually opening organizer dashboard shows the persisted booking and allows cancellation.
- **Evidence/root cause:** `src/pages/VenuePages.tsx:109` hardcodes `/student/dashboard#bookings`, which rejects organizer-only roles; [booking journey](qa-artifacts/booking-journey.json).
- **Fix/impact:** choose a role-appropriate destination or a shared authenticated booking-list route. Creation works, but its primary follow-up action is broken.

### QA-016 — Medium — Event capacity display reads the wrong API field

- **Reproduce:** open event cards or event details backed by GET `/events`.
- **Expected:** display the API's remaining-seat number.
- **Actual:** blank “seats left” counts; the detail description can interpolate `undefined seats remaining`.
- **Evidence/root cause:** backend `EventResponse.remaining_capacity` versus frontend `ApiCampusEvent.available_capacity`; `src/pages/DiscoveryPages.tsx:30`, `:235`, `:238`. Mobile screenshot confirms the missing card count.
- **Fix/impact:** align response types and render fields, add response-contract/browser assertions. Users cannot judge remaining capacity reliably.

### QA-017 — Medium — Ticket/history failures are rendered as empty data

- **Reproduce:** open student dashboard or QR/certificate services against the freshly migrated database.
- **Expected:** explicit failure state for failed registration-history requests.
- **Actual:** registration requests return 503 while screens can show no registrations/tickets; the browser recorded no alert-role error in those states. Some pages display status text, so this is not a claim that all errors are invisible.
- **Evidence/root cause:** [browser-results.json](qa-artifacts/browser-results.json), `src/pages/DashboardPages.tsx` and service-page catch/fallback handling. Failed data loads are conflated with empty lists.
- **Fix/impact:** keep loading/empty/error states separate and expose retry plus support request ID. Users can mistake service failure for missing records.

Admin metrics still mix live booking totals with illustrative users/events/trends. A preview notice exists, so this is a known scope limitation rather than a confirmed false-data vulnerability. Real reporting/export completeness and every administrative write form were not verified.

## 9. Deployment Configuration Assessment

Positive evidence: Dockerfile uses a non-root account and frozen uv dependencies; Compose waits for database health and migration completion; API readiness checks DB connectivity; structured logs use request IDs; database errors are generally redacted; worker retries are bounded. Compose validation passed, and local Uvicorn started. Image build/run was blocked by the unavailable Docker daemon, not declared successful.

### QA-018 — Medium — Published local setup environment does not parse

- **Reproduce:** load Settings using only `unispot-server/.env.example`.
- **Expected:** valid example configuration that starts after replacing secrets/database coordinates.
- **Actual:** `SettingsError` for `allowed_origins`: example supplies a plain URL where a JSON list is required. Even correcting serialization leaves example origin/FRONTEND_URL at 5173 while Vite is configured at 5174.
- **Evidence/root cause:** `.env.example:6`, `vite.config.ts:8`, [config-results.json](qa-artifacts/config-results.json).
- **Fix/impact:** supply a JSON list with the documented matching origin and align frontend URLs. Following the setup guide currently fails startup or browser CORS/link behavior.

### QA-019 — Medium — CI quality gates fail and frontend change filters miss config files

- **Reproduce:** run backend quality commands; inspect `.github/workflows/frontend.yml` path filters against tracked `vite.config.ts` and `tsconfig.json`.
- **Expected:** passing checks and CI triggered by build-relevant configuration changes.
- **Actual:** 547 Ruff findings, 49 application typing errors and the old auth fixture failure; workflow watches `vite.config.js`, not the actual `.ts`, and omits `tsconfig.json`.
- **Evidence/root cause:** lint/type logs; `tests/test_auth_context.py:17`; workflow path filters. Several typing errors correspond directly to runtime defects, not just style.
- **Fix/impact:** repair real contract/runtime errors and stale fixture, then restore lint hygiene and correct trigger paths. Do not disable gates to ship. Current CI cannot be considered green; configuration-only changes can miss frontend checks.

### QA-020 — Low — Documentation is inconsistent with the deployed feature/role contracts

- **Reproduce:** compare README, `Docs/SCOPE_DECISIONS.md`, `Docs/ROLE_PROVISIONING.md`, API guide and current OpenAPI/models.
- **Expected:** one accurate scope and operational bootstrap procedure.
- **Actual:** backend features labeled nonexistent demos; registration documented as returning tokens; role guide writes `users.role` and imports nonexistent `AsyncSessionLocal`/`UserRole` APIs.
- **Evidence/root cause:** old prototype/M6 documents not updated after later service and identity changes.
- **Fix/impact:** update scope/contract docs and provide a tested initial-admin provisioning command. This creates deployment/operator confusion but is not itself an authorization bypass.

Outstanding operational gates:

- Execute Docker build and Compose smoke on the intended PostgreSQL 17/container environment; validate worker health beyond process existence.
- Configure frontend build-time API URL, SPA history fallback, static caching, HTTPS, security headers and trusted ingress/proxy behavior. The API URL otherwise defaults to localhost:8000.
- Exercise schema-aware readiness: current `SELECT 1` succeeds while registration queries fail. Liveness must remain independent of DB readiness.
- Prove backup restoration and migrations on representative retained data; define RPO/RTO, rollback ownership and forward-repair procedure. Full downgrade destroys tables and is not a production recovery strategy.
- Configure centralized logs/metrics, error alerts and worker-delivery alerts. Existing counters are process-local; no production monitoring/alerting evidence was supplied.
- Pin/review container image digests and dependency source of truth. npm installation currently lacks both Neon packages despite their presence in `package.json`; pnpm and npm lockfiles have drifted. Neither clean frontend install nor container reproducibility passed.
- Confirm Resend failure handling, retention and safe logging in the actual deployment; auth email currently has no durable delivery retry after its user/token transaction.

## 10. Remediation Plan

| Priority | Work | Required verification |
| --- | --- | --- |
| P0 | Repair schema/model alignment and equipment computed-column writes (QA-002/003). | Fresh and prior-release upgrades; schema diff; registration/check-in/certificate flows; stock and event-capacity races; failed-write rollback. |
| P0 | Restore frontend frozen install and build (QA-001), then CI (QA-019). | Clean checkout install/build; generated/shared contracts; production-bundle browser suite. |
| P0 | Fix auth recovery, enumeration and session revocation (QA-004/005). | Existing/unknown account parity; mocked delivery; single-use and concurrent reset tokens; old access/refresh-session policy; failed-provider retry. |
| P0 | Repair provider request and waitlist route (QA-006/007). | HTTP happy/error/replay/ownership tests; complete provider assignment/status/quote/cancel and waitlist join/leave/advance journeys. |
| P0 | Configure production email and patch vulnerable dependencies (QA-008/009). | Validated container environment; sandbox delivery; refreshed lockfile and SBOM/advisory scan; rebuilt image. |
| P1 | Repair account deletion, inventory updates, SQL disclosure, email escaping and catalogue initialization (QA-010–014). | Transaction rollback/retention; safe error assertions; template tests; concurrent first-load GETs without writes. |
| P1 | Fix booking follow-up routing, event fields and failure states (QA-015–017). | Role-specific booking journey, populated event fixtures, API failure/retry states, persistent reload checks. |
| P1 | Align setup/CI/documentation (QA-018–020). | Follow setup on a clean machine; test initial admin creation; confirm workflow triggers. |
| Release gate | Container smoke, production-like E2E, recovery/monitoring and representative performance. | Evidence of healthy API/worker, migrated DB, SPA routes/TLS, backup restore and defined SLOs. |

Added tests assert the desired behavior and deliberately fail on defects; they do not modify production code or mark failures as expected. Keep the two prerequisite skips visible until QA-002 is fixed, then require them to execute. The fixture creates disposable databases and performs its own cleanup.

Coverage still needed: all newer service transitions, event cancellation notifications and venue-linked event edits, populated certificate revocation, provider authorization after reassignment, concurrent reset/verification and account status changes, schema-aware readiness, long-running worker failure recovery, refresh failure/network interruption, UI duplicate-submit/interrupted-write recovery and exhaustive admin form interactions. Existing booking/assistant coverage must remain passing throughout remediation.

Evidence and reusable audit utilities are under [qa-artifacts](qa-artifacts/README.md). No implementation remediation has been applied in this audit; the recommendations are proposed changes requiring a separate implementation task.

## 11. Final Deployment Verdict

**NO-GO**

Mandatory build and CI gates fail; clean migrations do not match runtime expectations; several advertised workflows fail under isolated HTTP/browser testing; account recovery/session security has confirmed defects; and container/operational release gates remain unverified. Neither a healthy `/health/readiness` response nor the successful core booking journey compensates for these failures. Re-audit after remediation with the same failing regression tests, a successful production build, and production-like deployment evidence.
