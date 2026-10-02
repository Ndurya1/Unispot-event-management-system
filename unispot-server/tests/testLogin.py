import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.services.auth_service import login_user

db = SessionLocal()

try:
    tokens = login_user(
        db,
        "register@example.com",
        "TestPass123"
    )

    print("✓ Login successful")
    print("✓ Access token generated")
    print("✓ Refresh token generated")

except ValueError as e:
    db.rollback()
    print(f"✗ Login failed: {e}")

except Exception as e:
    db.rollback()
    print(f"✗ Error: {e}")

finally:
    db.close()
