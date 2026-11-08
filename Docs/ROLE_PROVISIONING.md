# Role Provisioning Guide (Local Development)

**Purpose:** Document how to create initial admin accounts and organize memberships for local testing. 

> **Important:** Public registration does not grant application roles or organization memberships. Roles must be provisioned separately.

## Roles

| Role | Permissions | How to Assign |
|---|---|---|
| **ORGANIZER** (via OrganizationMembership) | Can create bookings for their organization, view/cancel own bookings | Requires active OrganizationMembership with role ORGANIZER |
| **VENUE_ADMIN** | Can manage venues, create venue blocks/closures, view allocations | Assigned via `User.role` field |
| **SYSTEM_ADMIN** | Full administrative access, user management, analytics, audit logs | Assigned via `User.role` field |

## Method 1: Direct Database Update (Recommended for Local Dev)

This is the simplest way for local development. You'll need access to your PostgreSQL database.

### 1. Create a user via the app
First, register a user through the frontend (`/signup`) or API. This creates an active user account.

### 2. Connect to the database
```powershell
psql -U postgres -d unispot
```

### 3. Grant admin role
```sql
-- Make user a System Admin
UPDATE users SET role = 'SYSTEM_ADMIN' WHERE email = 'your-email@example.com';

-- Or make user a Venue Admin
UPDATE users SET role = 'VENUE_ADMIN' WHERE email = 'your-email@example.com';
```

### 4. Create organization and membership (for booking as organizer)
```sql
-- Create an organization (if not exists)
INSERT INTO organizations (id, name, status, created_at, updated_at)
VALUES (gen_random_uuid(), 'Tech Club', 'ACTIVE', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Get IDs
SELECT id, email FROM users WHERE email = 'your-email@example.com';
SELECT id, name FROM organizations WHERE name = 'Tech Club';

-- Create organizer membership
INSERT INTO organization_memberships (id, user_id, organization_id, membership_role, status, created_at, updated_at)
VALUES (gen_random_uuid(), '<user-id>', '<org-id>', 'ORGANIZER', 'ACTIVE', NOW(), NOW());
```

## Method 2: Using Python Script

You can also create a quick script in the backend:

```python
# scripts/make_admin.py
import asyncio
from sqlalchemy import select, update
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole

async def make_admin(email: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"User {email} not found")
            return
        user.role = UserRole.SYSTEM_ADMIN
        await session.commit()
        print(f"Made {email} a SYSTEM_ADMIN")

asyncio.run(make_admin("your-email@example.com"))
```

Run with: `uv run python scripts/make_admin.py`

## Notes
- Never allow public signup to grant admin roles - this is enforced by design
- For testing bookings, you need both an active user AND an active ORGANIZER membership in an active organization
- Venue Admins can manage venues and blocks but cannot approve/reject individual bookings
- System Admins have full access but still cannot bypass allocation rules
