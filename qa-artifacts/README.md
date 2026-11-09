# QA evidence and reproduction

See [the production readiness report](../PRODUCTION_READINESS_QA_REPORT.md) for findings and limitations. Generated logs, screenshots, JSON and JUnit XML are evidence, not application assets. `postgres-data/` is ignored and contains only the isolated audit cluster; never use its trust-authentication configuration in production.

## Reproduce backend tests

Use a dedicated PostgreSQL test database and a user allowed to create disposable databases. The original release fixture upgrades/downgrades/re-upgrades randomly named databases and deletes only those generated databases. `db_session` tests roll back their writes. Never point these commands at production.

```powershell
cd C:\Unispot_app\unispot-server
$env:APP_ENV='test'
$env:DATABASE_URL='postgresql+asyncpg://qa_auditor@127.0.0.1:55432/unispot_qa'
$env:TEST_DATABASE_URL=$env:DATABASE_URL
$env:JWT_SECRET_KEY='qa-audit-only-secret-with-at-least-32-characters'
$env:ALLOWED_ORIGINS='["http://localhost:5174","http://127.0.0.1:5174"]'
.\.venv\Scripts\python.exe -m pytest -q --tb=short --junitxml=../qa-artifacts/final-pytest.xml
```

The new integration module mocks outbound auth email and uses the existing disposable release fixture. Its two skips explicitly identify event-registration prerequisites that currently fail. Failing assertions are intentional regression gates, not implementation changes.

## Reproduce browser/API checks

The audit cluster must be running and migrated first. Test-only `tests.qa_runtime` refuses any database other than `unispot_qa` at `127.0.0.1:55432`. With the above environment:

```powershell
.\.venv\Scripts\python.exe -m tests.qa_runtime seed
.\.venv\Scripts\python.exe -m uvicorn tests.qa_runtime:app --host 127.0.0.1 --port 18000 --no-access-log
```

In another terminal at repository root:

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:18000'
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort
```

Use a separate Playwright installation, without adding it to application dependencies. Set `QA_PLAYWRIGHT_PATH` to its `playwright` package directory; installed Google Chrome is required.

```powershell
node qa-artifacts/browser-audit.cjs
node qa-artifacts/booking-journey.cjs
.\unispot-server\.venv\Scripts\python.exe qa-artifacts/api-probes.py
```

Browser scripts block non-local HTTP requests. Synthetic credentials are defined in the test seed utility. The browser runtime mocks auth email and raises auth/catalogue throttles only for the route sweep; it must never be deployed. The booking script creates and cancels a synthetic booking. An exploratory selector failure left one additional synthetic confirmed booking in the isolated cluster; no user/application database was affected.

## Evidence inventory

- `final-pytest.xml` / `final-pytest.log`: authoritative combined result, 61 passed / 13 failed / 2 blocked skips.
- `baseline-pytest.xml`: original-suite baseline; `qa-pytest.xml`: focused additional cases.
- `browser-results.json`: 74 route/viewport observations, runtime errors, API failures, redirects, simple input-label and overflow checks.
- `booking-journey.json`: browser creation/persistence/cancellation and the broken post-success destination.
- `api-results.json`: 107-operation inventory, 40 GET probes and bounded latency samples.
- `config-results.json`: invalid local example and unsafe accepted production email defaults.
- `python-audit.json`: frozen Python runtime advisory scan; duplicate certifi advisory must be deduplicated.
- `ruff.json`, `mypy.log`, `frontend-build.log`: quality-gate failures. The two new QA Python files pass targeted Ruff and add no mypy diagnostics.
- `source-audit.json`: redacted, pattern-only current-tree/history scan; never exports matched values.
- `browser-*.png`, `booking-success.png`: screenshots. Three route screenshots were visually inspected; screenshot existence alone is not evidence of visual review.

The pre-existing `uv.lock` modification was preserved. No application code, deployment configuration or migrations were changed. Temporary audit servers and the isolated PostgreSQL cluster are stopped at handoff; files remain for inspection and reproduction.
