"""
Unit tests for Event Access Control on report-assembly endpoints:
  - GET /events?status=approved (bulk picker)
  - GET /events/summary-sheets
  - GET /clubs-activities/summary-sheets

Verifies:
  1. Student and Worker tokens receive 403 Forbidden on approved events bulk read & summary sheets.
  2. Admin and Teacher (Faculty) receive 200 OK regardless of mentor assignment.
"""

import os
import sys
import io
import pytest
from datetime import datetime

# Add academic-data-service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from flask import Flask
from models import db, Faculty, Student, Department
from event_models import Club, Event, EventPhoto
from routes.events import events_bp


@pytest.fixture
def app():
    test_app = Flask(__name__)
    test_app.config["TESTING"] = True
    test_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    test_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(test_app)
    test_app.register_blueprint(events_bp)

    with test_app.app_context():
        db.create_all()

        dept = Department(code="CSE", name="Computer Science & Engineering")
        db.session.add(dept)

        # Faculty 1 (mentor for Club 1), Faculty 2 (not mentor for Club 1)
        f1 = Faculty(faculty_id="FAC001", name="Dr. Raman", email="raman@test.edu", department_code="CSE")
        f2 = Faculty(faculty_id="FAC002", name="Dr. Meera", email="meera@test.edu", department_code="CSE")
        db.session.add_all([f1, f2])

        # Student & Worker
        s1 = Student(student_id="STU001", name="Rohan", email="rohan@test.edu", department_code="CSE")
        db.session.add(s1)

        # Club with mentor FAC001
        c1 = Club(id=1, name="ACM Student Chapter", category="technical", mentor_faculty_id="FAC001")
        db.session.add(c1)

        # Approved event
        ev = Event(
            id=1,
            club_id=1,
            title="Annual Tech Symposium",
            event_type="symposium",
            status="approved",
            event_date=datetime(2025, 10, 15, 10, 0),
            venue="Auditorium",
            attendee_count=150,
            report_text="Successful symposium.",
            po_mapping="PO1, PO2, PO5",
            resource_person="Industry Expert",
        )
        db.session.add(ev)
        db.session.commit()

        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def test_approved_events_picker_access_control(client):
    """GET /events?status=approved must return 403 for Student/Worker, 200 for Admin/Faculty."""
    
    # 1. Student token -> 403
    res_student = client.get("/events?status=approved", headers={
        "X-User-Role": "Student",
        "X-Linked-Id": "STU001",
        "X-User-Id": "U_STU001",
    })
    assert res_student.status_code == 403
    assert "Access denied" in res_student.json["error"]

    # 2. Worker token -> 403
    res_worker = client.get("/events?status=approved", headers={
        "X-User-Role": "Worker",
        "X-User-Id": "U_WRK001",
    })
    assert res_worker.status_code == 403
    assert "Access denied" in res_worker.json["error"]

    # 3. Admin token -> 200
    res_admin = client.get("/events?status=approved", headers={
        "X-User-Role": "Admin",
        "X-User-Id": "U_ADM001",
    })
    assert res_admin.status_code == 200
    assert len(res_admin.json) == 1
    assert res_admin.json[0]["title"] == "Annual Tech Symposium"

    # 4. Faculty token (even if FAC002 who is NOT the mentor for Club 1) -> 200
    res_faculty = client.get("/events?status=approved", headers={
        "X-User-Role": "Teacher",
        "X-Linked-Id": "FAC002",
        "X-User-Id": "U_FAC002",
    })
    assert res_faculty.status_code == 200
    assert len(res_faculty.json) == 1
    assert res_faculty.json[0]["title"] == "Annual Tech Symposium"


def test_summary_sheets_access_control(client):
    """GET /events/summary-sheets & GET /clubs-activities/summary-sheets must return 403 for Student/Worker, 200 for Admin/Faculty."""

    # 1. Student -> 403
    res_student = client.get("/events/summary-sheets?event_ids=1", headers={
        "X-User-Role": "Student",
        "X-Linked-Id": "STU001",
        "X-User-Id": "U_STU001",
    })
    assert res_student.status_code == 403

    res_student_alias = client.get("/clubs-activities/summary-sheets?event_ids=1", headers={
        "X-User-Role": "Student",
        "X-Linked-Id": "STU001",
        "X-User-Id": "U_STU001",
    })
    assert res_student_alias.status_code == 403

    # 2. Worker -> 403
    res_worker = client.get("/events/summary-sheets?event_ids=1", headers={
        "X-User-Role": "Worker",
        "X-User-Id": "U_WRK001",
    })
    assert res_worker.status_code == 403

    # 3. Admin -> 200
    res_admin = client.get("/events/summary-sheets?event_ids=1", headers={
        "X-User-Role": "Admin",
        "X-User-Id": "U_ADM001",
    })
    assert res_admin.status_code == 200
    assert len(res_admin.json) == 1
    assert res_admin.json[0]["title"] == "Annual Tech Symposium"
    assert res_admin.json[0]["po_mapping"] == "PO1, PO2, PO5"

    # 4. Faculty -> 200
    res_faculty = client.get("/clubs-activities/summary-sheets?event_ids=1", headers={
        "X-User-Role": "Teacher",
        "X-Linked-Id": "FAC002",
        "X-User-Id": "U_FAC002",
    })
    assert res_faculty.status_code == 200
    assert len(res_faculty.json) == 1
    assert res_faculty.json[0]["title"] == "Annual Tech Symposium"
