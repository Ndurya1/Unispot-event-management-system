from fastapi.testclient import TestClient


def login(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/users/login",
        json={
            "email": "diana2026@test.com",
            "password": "Test1234",
        },
    )
    assert response.status_code == 200
    return {
        "Authorization": f"Bearer {response.json()['access_token']}"
    }


def get_test_venue_id(client: TestClient, headers: dict[str, str]) -> str:
    response = client.get("/venues", headers=headers)
    assert response.status_code == 200

    venues = response.json()
    test_venue = next(
        venue for venue in venues if venue["name"] == "Test Venue"
    )

    return test_venue["id"]


def test_create_booking(client: TestClient) -> None:
    headers = login(client)
    venue_id = get_test_venue_id(client, headers)

    response = client.post(
        "/bookings",
        headers=headers,
        json={
            "venue_id": venue_id,
            "start_time": "2026-11-10T10:00:00+03:00",
            "end_time": "2026-11-10T12:00:00+03:00",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["venue_id"] == venue_id
    assert data["start_time"] == "2026-11-10T07:00:00Z"
    assert data["end_time"] == "2026-11-10T09:00:00Z"


def test_overlapping_booking_is_rejected(client: TestClient) -> None:
    headers = login(client)
    venue_id = get_test_venue_id(client, headers)

    first = client.post(
        "/bookings",
        headers=headers,
        json={
            "venue_id": venue_id,
            "start_time": "2026-11-11T10:00:00+03:00",
            "end_time": "2026-11-11T12:00:00+03:00",
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/bookings",
        headers=headers,
        json={
            "venue_id": venue_id,
            "start_time": "2026-11-11T11:00:00+03:00",
            "end_time": "2026-11-11T13:00:00+03:00",
        },
    )

    assert second.status_code == 409
    assert second.json()["detail"] == "Venue is already booked for this time"


def test_invalid_booking_time_is_rejected(client: TestClient) -> None:
    headers = login(client)
    venue_id = get_test_venue_id(client, headers)

    response = client.post(
        "/bookings",
        headers=headers,
        json={
            "venue_id": venue_id,
            "start_time": "2026-11-12T14:00:00+03:00",
            "end_time": "2026-11-12T12:00:00+03:00",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "End time must be after start time"


def test_booking_requires_existing_venue(client: TestClient) -> None:
    headers = login(client)

    response = client.post(
        "/bookings",
        headers=headers,
        json={
            "venue_id": "00000000-0000-0000-0000-000000000000",
            "start_time": "2026-11-13T10:00:00+03:00",
            "end_time": "2026-11-13T12:00:00+03:00",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Venue not found"
