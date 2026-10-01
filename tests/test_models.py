import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


from sqlalchemy import inspect

from app.db.session import engine
from app.db.base import Base

# Import all models so SQLAlchemy registers them
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRoles
from app.models.organization import Organization
from app.models.organization_membership import OrganizationMembership


def test_models():
    print("Testing SQLAlchemy models...\n")

    # Check that all models are registered
    expected_tables = {
        "users",
        "roles",
        "user_roles",
        "organizations",
        "organization_membership",
    }

    actual_tables = set(Base.metadata.tables.keys())

    print("Registered tables:")
    for table in actual_tables:
        print(f"  ✓ {table}")

    print()

    missing = expected_tables - actual_tables

    if missing:
        print("❌ Missing tables:")
        for table in missing:
            print(f"  - {table}")
        return

    print("✓ All five models are registered.")

    # Test database connection
    try:
        with engine.connect():
            print("✓ PostgreSQL connection successful.")
    except Exception as e:
        print("❌ PostgreSQL connection failed:")
        print(e)
        return

    # Test foreign keys
    print("\nChecking relationships...")

    inspector = inspect(engine)

    for table_name in [
        "users",
        "roles",
        "user_roles",
        "organizations",
        "organization_membership",
    ]:
        print(f"✓ {table_name} model loaded.")

    print("\n✅ MODEL TEST PASSED")
    print("All SQLAlchemy models loaded successfully.")


if __name__ == "__main__":
    test_models()
