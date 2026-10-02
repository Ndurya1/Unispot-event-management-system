def test_login_service_exists() -> None:
    """Login service is available for Task 1.2."""
    from app.services.auth_service import login_user

    assert login_user is not None
