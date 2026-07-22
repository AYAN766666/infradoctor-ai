import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ["DATABASE_URL"] = "sqlite:///./test_infra_doctor.db"

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_register():
    response = client.post("/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "testpass123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "User created successfully"
    assert "user_id" in data


def test_register_duplicate():
    response = client.post("/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "testpass123"
    })
    assert response.status_code == 409


def test_login():
    response = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user_id"] > 0


def test_login_wrong_password():
    response = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401


def test_me_without_token():
    response = client.get("/auth/me")
    assert response.status_code == 403


def test_me_with_token():
    login_res = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123"
    })
    token = login_res.json()["access_token"]
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
