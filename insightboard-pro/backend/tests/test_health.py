"""Health endpoint smoke tests."""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_root_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert "status" in body
    assert "database" in body
    assert "redis" in body
    assert body["version"] == "1.0.0"
    assert isinstance(body["uptime_seconds"], int)


def test_api_v1_health() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body.get("success") is True
    assert body.get("data") is not None
