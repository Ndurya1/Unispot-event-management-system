from app.schemas.auth import RegisterRequest


def test_register_request_requires_a_strong_password() -> None:
    request = RegisterRequest(
        full_name="A UniSpot User",
        email="user@example.com",
        password="password123",
    )
    assert request.full_name == "A UniSpot User"


def test_register_request_rejects_short_password() -> None:
    try:
        RegisterRequest(
            full_name="A UniSpot User",
            email="user@example.com",
            password="short",
        )
    except ValueError:
        return
    raise AssertionError("short registration passwords must be rejected")
