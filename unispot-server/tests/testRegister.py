import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.auth_services import register_user

from app.db.session import SessionLocal

db = SessionLocal()

try:
    user = register_user(
        db,
        "Test User",
        "register@gmail.com",
        "TestPass122"
    )

    print("✓ Registration successful")
    print(f"User: {user['name']}")
    print(f"Email: {user['email']}")
    print(f"Status: {user['status']}")

except ValueError as e:
    db.rollback()
    print(f"✗ Registration failed: {e}")

except Exception as e:
    db.rollback()
    print(f"✗ Error: {e}")

finally:
    db.close()
