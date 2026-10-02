import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.services.auth_services import register_user, login_user


db = SessionLocal()

try:
    print("Testing registration...")

    user = register_user(
        db,
        "Test User",
        "test@example.com",
        "TestPass123"
    )

    print("✓ Registration successful")
    print(f"  User: {user['name']}")
    print(f"  Email: {user['email']}")
    print(f"  Status: {user['status']}")

    print("\nTesting login...")

    tokens = login_user(
        db,
        "test@example.com",
        "TestPass123"
    )

    print("✓ Login successful")
    print("✓ Access token generated")
    print("✓ Refresh token generated")

except ValueError as e:
    db.rollback()
    print(f"✗ Authentication error: {e}")

except Exception as e:
    db.rollback()
    print(f"✗ Unexpected error: {e}")

finally:
    db.close()
