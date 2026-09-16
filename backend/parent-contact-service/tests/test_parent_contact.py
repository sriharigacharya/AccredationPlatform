"""
Tests for Parent Contact Service (AcademiQ)
Covers parent records, phone masking (RBAC), contact consent guards, and call/SMS logging.
"""

import os
import sys
from pathlib import Path

# Add service directory to sys.path
SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

import pytest

# Ensure SQLite in-memory DB is used for testing
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["TWILIO_ENABLED"] = "false"

from app import create_app
from models import db, ParentRecord, ContactLog


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        yield app.test_client()


def test_get_parent_masked_for_teacher(client):
    """Teacher sees masked mobile numbers."""
    resp = client.get("/parents/STU001", headers={"X-User-Role": "teacher"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["student_id"] == "STU001"
    assert data["primary_mobile"] == "******3210"
    assert data["alternate_mobile"] == "******6780"


def test_get_parent_unmasked_for_admin(client):
    """Admin sees unmasked full mobile numbers."""
    resp = client.get("/parents/STU001", headers={"X-User-Role": "admin"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["student_id"] == "STU001"
    assert data["primary_mobile"] == "9876543210"
    assert data["alternate_mobile"] == "9123456780"


def test_get_parent_not_found(client):
    """Non-existent student returns 404."""
    resp = client.get("/parents/NON_EXISTENT")
    assert resp.status_code == 404


def test_create_and_update_parent(client):
    """Create new parent record, then update it."""
    payload = {
        "student_id": "STU999",
        "parent_name": "Test Parent",
        "relationship": "Father",
        "primary_mobile": "9998887770",
        "alternate_mobile": "9998887771",
        "preferred_contact_method": "SMS",
        "consent_to_contact": True
    }
    create_resp = client.post("/parents/", json=payload)
    assert create_resp.status_code == 201
    created = create_resp.get_json()
    assert created["student_id"] == "STU999"
    assert created["parent_name"] == "Test Parent"

    # Update existing
    update_resp = client.post("/parents/", json={
        "student_id": "STU999",
        "parent_name": "Updated Test Parent",
        "preferred_contact_method": "Call"
    })
    assert update_resp.status_code == 200
    updated = update_resp.get_json()
    assert updated["parent_name"] == "Updated Test Parent"
    assert updated["preferred_contact_method"] == "Call"


def test_delete_parent_rbac(client):
    """Teacher cannot delete parent; admin can."""
    # Ensure STU998 exists
    client.post("/parents/", json={
        "student_id": "STU998",
        "parent_name": "Delete Target",
        "primary_mobile": "9000000000"
    })

    # Teacher attempt -> 403
    t_resp = client.delete("/parents/STU998", headers={"X-User-Role": "teacher"})
    assert t_resp.status_code == 403

    # Admin attempt -> 200
    a_resp = client.delete("/parents/STU998", headers={"X-User-Role": "admin"})
    assert a_resp.status_code == 200

    # Verify deleted
    assert client.get("/parents/STU998").status_code == 404


def test_call_parent_consent_denied(client):
    """STU005 has consent_to_contact=False in seeded demo data -> returns 403."""
    resp = client.post("/contact/call", json={"student_id": "STU005"}, headers={"X-User-Id": "FAC001"})
    assert resp.status_code == 403
    assert "Contact blocked" in resp.get_json()["error"]

    # Verify contact log records consent_denied
    log_resp = client.get("/contact/log?student_id=STU005")
    assert log_resp.status_code == 200
    logs = log_resp.get_json()
    assert len(logs) > 0
    assert logs[0]["status"] == "consent_denied"


def test_call_parent_mock_success(client):
    """STU001 has consent -> in mock mode, returns 200 with status=mock."""
    resp = client.post("/contact/call", json={"student_id": "STU001", "use_proxy": True}, headers={"X-User-Id": "FAC001"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "mock"
    assert "Would call" in data["message"]
    assert "log_id" in data


def test_sms_parent_consent_denied_and_mock(client):
    """SMS adheres to consent check and mock mode."""
    # STU005 (consent=False) -> 403
    blocked = client.post("/contact/sms", json={"student_id": "STU005", "message": "Notice"})
    assert blocked.status_code == 403

    # STU001 (consent=True) -> 200 mock
    ok = client.post("/contact/sms", json={"student_id": "STU001", "message": "Attendance alert"})
    assert ok.status_code == 200
    assert ok.get_json()["status"] == "mock"


def test_contact_log_history(client):
    """Contact logs can be retrieved and filtered."""
    resp = client.get("/contact/log?student_id=STU001")
    assert resp.status_code == 200
    logs = resp.get_json()
    assert isinstance(logs, list)
