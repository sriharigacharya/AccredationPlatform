"""
Unit and integration tests for Teacher Event Attendance Requests with Certificate Proof
and Automatic Profile Certification on Admin Approval.
"""

import os
import sys
import io
import json
import pytest
from datetime import date, datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from models import db, Faculty, FacultyDailyAttendance, AttendanceEvent
from timetable_models import TeacherEventAttendanceRequest


@pytest.fixture
def client():
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        with app.app_context():
            yield client


def test_submit_event_attendance_request_success(client):
    # Teacher FAC001 submits an event attendance request with PDF certificate proof
    fake_pdf = io.BytesIO(b"%PDF-1.4 Mock Certificate Data for Workshop")
    data = {
        "faculty_id": "FAC001",
        "course_name": "Advanced Machine Learning & Deep Learning Workshop",
        "event_type": "FDP",
        "organizer": "IIT Madras",
        "event_date": "2025-02-14",
        "start_time": "09:00",
        "end_time": "17:00",
        "is_full_day": "true",
        "description": "5-day comprehensive hands-on workshop on Transformers and Deep Learning.",
        "certificate": (fake_pdf, "IITM_ML_Certificate.pdf"),
    }

    headers = {
        "X-User-Role": "teacher",
        "X-Linked-Id": "FAC001",
        "X-User-Id": "FAC001",
    }

    res = client.post(
        "/attendance/event-requests",
        data=data,
        content_type="multipart/form-data",
        headers=headers,
    )

    assert res.status_code == 201
    resp_data = res.get_json()
    assert "request" in resp_data
    req = resp_data["request"]
    assert req["faculty_id"] == "FAC001"
    assert req["course_name"] == "Advanced Machine Learning & Deep Learning Workshop"
    assert req["event_type"] == "FDP"
    assert req["organizer"] == "IIT Madras"
    assert req["event_date"] == "2025-02-14"
    assert req["status"] == "pending"
    assert req["certificate_original_name"] == "IITM_ML_Certificate.pdf"
    assert req["certificate_filename"].startswith("cert_FAC001_20250214_")


def test_submit_without_certificate_fails(client):
    # Submitting without certificate proof should be rejected
    data = {
        "faculty_id": "FAC001",
        "course_name": "Cloud Computing FDP",
        "event_date": "2025-02-15",
    }
    headers = {"X-User-Role": "teacher", "X-Linked-Id": "FAC001"}
    res = client.post(
        "/attendance/event-requests",
        data=data,
        content_type="multipart/form-data",
        headers=headers,
    )
    assert res.status_code == 400
    assert "Certificate proof is required" in res.get_json()["error"]


def test_submit_invalid_file_extension(client):
    # Submitting with an unpermitted file type (.exe) should fail
    fake_exe = io.BytesIO(b"Fake executable payload")
    data = {
        "faculty_id": "FAC001",
        "course_name": "Cyber Security Workshop",
        "event_date": "2025-02-16",
        "certificate": (fake_exe, "malware.exe"),
    }
    headers = {"X-User-Role": "teacher", "X-Linked-Id": "FAC001"}
    res = client.post(
        "/attendance/event-requests",
        data=data,
        content_type="multipart/form-data",
        headers=headers,
    )
    assert res.status_code == 400
    assert "Invalid file type" in res.get_json()["error"]


def test_teacher_cannot_submit_for_other_faculty(client):
    # Teacher FAC001 trying to submit for FAC002 should be forbidden (403)
    fake_img = io.BytesIO(b"Fake image bytes")
    data = {
        "faculty_id": "FAC002",
        "course_name": "DevOps Bootcamp",
        "event_date": "2025-02-17",
        "certificate": (fake_img, "cert.png"),
    }
    headers = {"X-User-Role": "teacher", "X-Linked-Id": "FAC001"}
    res = client.post(
        "/attendance/event-requests",
        data=data,
        content_type="multipart/form-data",
        headers=headers,
    )
    assert res.status_code == 403


def test_admin_approval_grants_attendance_and_adds_certification(client):
    # 1. Submit request as teacher
    fake_pdf = io.BytesIO(b"%PDF-1.4 Mock Certificate")
    req_res = client.post(
        "/attendance/event-requests",
        data={
            "faculty_id": "FAC001",
            "course_name": "IEEE Quantum Computing Winter School",
            "event_type": "Workshop",
            "organizer": "IEEE Computer Society",
            "event_date": "2025-01-20",
            "start_time": "09:30",
            "end_time": "17:30",
            "certificate": (fake_pdf, "quantum_cert.pdf"),
        },
        content_type="multipart/form-data",
        headers={"X-User-Role": "teacher", "X-Linked-Id": "FAC001"},
    )
    assert req_res.status_code == 201
    req_id = req_res.get_json()["request"]["id"]

    # Verify initial certifications count for FAC001
    fac = Faculty.query.filter_by(faculty_id="FAC001").first()
    initial_certs = json.loads(fac.certifications) if fac.certifications else []

    # 2. Admin approves request
    admin_headers = {"X-User-Role": "admin", "X-User-Id": "admin_user"}
    approve_res = client.post(
        f"/attendance/event-requests/{req_id}/approve",
        json={"admin_remarks": "Verified with IEEE portal. Approved."},
        headers=admin_headers,
    )
    assert approve_res.status_code == 200
    app_data = approve_res.get_json()
    assert app_data["request"]["status"] == "approved"
    assert app_data["daily_attendance"]["status"] == "PRESENT"
    assert "IEEE Quantum Computing" in app_data["added_certification"]

    # 3. Verify Database: FacultyDailyAttendance is PRESENT
    daily = FacultyDailyAttendance.query.filter_by(
        faculty_id="FAC001", date=date(2025, 1, 20)
    ).first()
    assert daily is not None
    assert daily.status == "PRESENT"
    assert daily.work_duration_minutes >= 480

    # 4. Verify Database: Faculty.certifications now includes the new certificate
    db.session.refresh(fac)
    updated_certs = json.loads(fac.certifications)
    assert len(updated_certs) == len(initial_certs) + 1
    assert any("IEEE Quantum Computing Winter School" in c for c in updated_certs)

    # 5. Verify Biometric AttendanceEvent audit records exist
    events = AttendanceEvent.query.filter_by(
        faculty_id="FAC001", source="EVENT_ATTENDANCE"
    ).all()
    assert len(events) >= 2
    types = [e.event_type for e in events]
    assert "IN" in types and "OUT" in types


def test_admin_rejection_workflow(client):
    # 1. Submit request as teacher
    fake_png = io.BytesIO(b"Fake PNG image content")
    req_res = client.post(
        "/attendance/event-requests",
        data={
            "faculty_id": "FAC002",
            "course_name": "Unverified Seminar",
            "event_date": "2025-01-25",
            "certificate": (fake_png, "seminar.png"),
        },
        content_type="multipart/form-data",
        headers={"X-User-Role": "teacher", "X-Linked-Id": "FAC002"},
    )
    assert req_res.status_code == 201
    req_id = req_res.get_json()["request"]["id"]

    # 2. Admin rejects request
    admin_headers = {"X-User-Role": "admin", "X-User-Id": "admin_user"}
    reject_res = client.post(
        f"/attendance/event-requests/{req_id}/reject",
        json={"rejection_reason": "Certificate does not indicate date and hours of completion."},
        headers=admin_headers,
    )
    assert reject_res.status_code == 200
    rej_data = reject_res.get_json()
    assert rej_data["request"]["status"] == "rejected"
    assert "Certificate does not indicate" in rej_data["request"]["admin_remarks"]

    # 3. Verify attendance was NOT granted
    daily = FacultyDailyAttendance.query.filter_by(
        faculty_id="FAC002", date=date(2025, 1, 25)
    ).first()
    assert daily is None or daily.status != "PRESENT"

    # 4. Verify certification was NOT added
    fac = Faculty.query.filter_by(faculty_id="FAC002").first()
    certs = json.loads(fac.certifications) if fac.certifications else []
    assert not any("Unverified Seminar" in c for c in certs)


def test_serve_certificate_proof(client):
    # Submit request to generate stored certificate file
    fake_pdf = io.BytesIO(b"%PDF-1.4 Official Certificate Content")
    req_res = client.post(
        "/attendance/event-requests",
        data={
            "faculty_id": "FAC001",
            "course_name": "Docker & Kubernetes Workshop",
            "event_date": "2025-02-01",
            "certificate": (fake_pdf, "k8s_cert.pdf"),
        },
        content_type="multipart/form-data",
        headers={"X-User-Role": "teacher", "X-Linked-Id": "FAC001"},
    )
    stored_name = req_res.get_json()["request"]["certificate_filename"]

    # Fetch proof via proof serving endpoint
    proof_res = client.get(f"/attendance/proofs/{stored_name}")
    assert proof_res.status_code == 200
    assert b"Official Certificate Content" in proof_res.data
