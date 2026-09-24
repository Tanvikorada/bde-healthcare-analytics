import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
    # Context manager runs the startup event that loads the default dataset.
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth(client):
    res = client.post("/api/token", data={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_api_health(client):
    assert client.get("/openapi.json").status_code == 200


def test_endpoints_require_auth(client):
    assert client.get("/api/kpis").status_code == 401
    assert client.post("/api/upload").status_code == 401


def test_bad_login(client):
    res = client.post("/api/token", data={"username": "admin", "password": "wrong"})
    assert res.status_code == 401


def test_get_kpis(client, auth):
    res = client.get("/api/kpis", headers=auth)
    assert res.status_code == 200
    data = res.json()
    assert "total_records_processed" in data
    assert "top_disease" in data


def test_me(client, auth):
    assert client.get("/api/me", headers=auth).json()["username"] == "admin"


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"


def test_register_and_login_new_user(client):
    res = client.post("/api/register", json={
        "username": "newpatientuser",
        "password": "hunter22",
        "full_name": "New Test User",
    })
    assert res.status_code == 200

    # Duplicate registration is rejected.
    dup = client.post("/api/register", json={
        "username": "newpatientuser",
        "password": "hunter22",
        "full_name": "New Test User",
    })
    assert dup.status_code == 400

    login = client.post("/api/token", data={"username": "newpatientuser", "password": "hunter22"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    me = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["username"] == "newpatientuser"


def test_ml_prediction_valid_input(client, auth):
    payload = {
        "age_band": "61-70",
        "disease": "Heart Disease",
        "treatment_cost": 5000.0,
        "gender": "Male",
        "length_of_stay": 5,
        "previous_admissions": 1,
    }
    res = client.post("/api/predict", json=payload, headers=auth)
    assert res.status_code == 200
    data = res.json()
    assert data["prediction"] in ["High Risk", "Low Risk", "Error"]
    assert "probability" in data


def test_upload_rejects_non_csv(client, auth):
    res = client.post("/api/upload", files={"file": ("x.txt", b"a,b")}, headers=auth)
    assert res.status_code == 400
