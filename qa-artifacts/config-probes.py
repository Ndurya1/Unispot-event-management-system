"""Configuration-only checks. Uses synthetic values and never connects externally."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "unispot-server"))
from app.core.config import Settings

for key in ("APP_ENV", "DATABASE_URL", "JWT_SECRET_KEY", "ALLOWED_ORIGINS", "RESEND_API_KEY", "FRONTEND_URL"):
    os.environ.pop(key, None)

results = {}
try:
    Settings(_env_file=str(ROOT / "unispot-server/.env.example"))
    results["example_loads"] = True
except Exception as error:
    results["example_loads"] = False
    results["example_error_type"] = type(error).__name__
    # Report configuration field, without dumping values or complete exception context.
    results["example_error_field"] = "allowed_origins" if "allowed_origins" in str(error) else "unknown"

settings = Settings(_env_file=None, APP_ENV="production",
                    DATABASE_URL="postgresql+asyncpg://qa:synthetic@db.example/audit",
                    JWT_SECRET_KEY="qa-audit-synthetic-secret-with-more-than-32-characters",
                    ALLOWED_ORIGINS=["https://campus.example"])
results["production_accepts_missing_email_key"] = settings.resend_api_key is None
results["production_default_frontend_is_localhost"] = settings.frontend_url.host == "localhost"
(ROOT / "qa-artifacts/config-results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print(json.dumps(results, indent=2))
