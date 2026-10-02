import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_access_token
)


def main():
    password = "TestPass123"

    # Hash password
    password_hash = hash_password(password)
    print("Hash:", password_hash)

    # Verify correct password
    valid = verify_password(password_hash, password)
    print("Verified:", valid)

    # Verify wrong password
    invalid = verify_password(password_hash, "WrongPassword")
    print("Wrong password:", invalid)

    # Create access token
    access_token = create_access_token({
        "user_id": "test-user-123",
        "role": "ADMIN"
    })
    print("Access token:", access_token)

    # Verify access token
    decoded = verify_access_token(access_token)
    print("Decoded access token:", decoded)

    # Create refresh token
    refresh_token = create_refresh_token({
        "user_id": "test-user-123"
    })
    print("Refresh token:", refresh_token)


if __name__ == "__main__":
    main()
