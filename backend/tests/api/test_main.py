"""
API tests — use the shared TestClient fixture from conftest.py.
"""


def test_root_returns_operational(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "operational"


def test_health_returns_healthy(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "healthy"
