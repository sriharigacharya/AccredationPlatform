"""
Unit tests for Teacher Classes, Attendance Taking, Exam Marks Entry,
and High Risk Alert Detection for Low-Performing Students.
"""

import os
import sys
import json
import pytest
from datetime import date

# Add academic-data-service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from flask import Flask
from models import db, Student, Faculty, Department, ClassAttendanceSession, ClassAttendanceEntry
from routes.classes import classes_bp


@pytest.fixture
def app():
    test_app = Flask(__name__)
    test_app.config["TESTING"] = True
    test_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    test_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(test_app)
    test_app.register_blueprint(classes_bp, url_prefix="/classes")

    with test_app.app_context():
        db.create_all()

        dept = Department(code="CSE", name="Computer Science & Engineering")
        db.session.add(dept)

        # Faculty
        f1 = Faculty(faculty_id="FAC001", name="Dr. Meena Iyer", email="meena@test.edu")
        f2 = Faculty(faculty_id="FAC002", name="Prof. Ravi Shankar", email="ravi@test.edu")
        db.session.add_all([f1, f2])

        # Students with courses_data
        courses_stu1 = json.dumps([
            {"code": "CS3C01", "name": "Data Structures & Algorithms", "credits": 4, "cie1": 20, "cie2": 22, "quiz1": 8, "quiz2": 9, "el": 25, "see": 80, "attendance_pct": 90.0}
        ])
        courses_stu2 = json.dumps([
            {"code": "CS3C01", "name": "Data Structures & Algorithms", "credits": 4, "cie1": 8, "cie2": 9, "quiz1": 3, "quiz2": 4, "el": 10, "see": 35, "attendance_pct": 55.0}
        ])

        s1 = Student(student_id="STU001", name="Aarav Sharma", email="aarav@test.edu", section="A", semester=3, attendance_pct=90.0, internal_marks=84.0, courses_data=courses_stu1)
        s2 = Student(student_id="STU002", name="Akash Patel", email="akash@test.edu", section="A", semester=3, attendance_pct=55.0, internal_marks=34.0, backlogs=2, courses_data=courses_stu2)
        s3 = Student(student_id="STU036", name="Aishwarya Naidu", email="aish@test.edu", section="B", semester=5, attendance_pct=88.0, internal_marks=80.0)

        db.session.add_all([s1, s2, s3])
        db.session.commit()

        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()



def test_teacher_only_views_assigned_classes(client):
    """Faculty FAC001 only sees their assigned courses (CS3C01, CS7C01), not FAC002's."""
    headers = {
        "X-User-Role": "teacher",
        "X-Linked-Id": "FAC001",
    }
    resp = client.get("/classes/my-classes", headers=headers)
    assert resp.status_code == 200
    classes = resp.json
    codes = [c["course_code"] for c in classes]
    assert "CS3C01" in codes
    assert "CS7C01" in codes
    assert "CS5C02" not in codes  # Taught by FAC002


def test_admin_views_all_classes(client):
    """Admin sees all courses across all sections and faculty."""
    headers = {
        "X-User-Role": "admin",
        "X-Linked-Id": "",
    }
    resp = client.get("/classes/my-classes", headers=headers)
    assert resp.status_code == 200
    classes = resp.json
    assert len(classes) == 4


def test_get_class_students_with_risk(client):
    """Roster returns students in Section A with evaluations and risk alerts."""
    headers = {
        "X-User-Role": "teacher",
        "X-Linked-Id": "FAC001",
    }
    resp = client.get("/classes/CS3C01/A/students", headers=headers)
    assert resp.status_code == 200
    data = resp.json
    assert data["course_code"] == "CS3C01"
    assert data["total_students"] == 2

    # STU002 should be flagged as high risk (cie1=8 < 12, attendance=55% < 60%)
    stu2 = next(s for s in data["students"] if s["student_id"] == "STU002")
    assert stu2["is_at_risk"] is True
    assert stu2["risk_severity"] == "high"
    assert any("Low CIE 1" in r for r in stu2["risk_reasons"])
    assert any("Attendance Shortage" in r for r in stu2["risk_reasons"])


def test_record_attendance(client):
    """Submitting class attendance saves session and updates student attendance rate."""
    headers = {
        "X-User-Role": "teacher",
        "X-Linked-Id": "FAC001",
    }
    payload = {
        "course_code": "CS3C01",
        "section": "A",
        "date": "2026-09-02",
        "records": [
            {"student_id": "STU001", "status": "present"},
            {"student_id": "STU002", "status": "absent"},
        ]
    }
    resp = client.post("/classes/attendance", json=payload, headers=headers)
    assert resp.status_code == 201
    assert resp.json["present_count"] == 1
    assert resp.json["absent_count"] == 1

    # Verify session was recorded in DB
    with client.application.app_context():
        session = ClassAttendanceSession.query.first()
        assert session is not None
        assert session.course_code == "CS3C01"
        assert session.total_students == 2
        assert session.present_count == 1
        assert session.absent_count == 1


def test_enter_exam_marks_and_recompute(client):
    """Entering CIE 1 marks updates student score, recomputes CIE raw and flags low marks."""
    headers = {
        "X-User-Role": "teacher",
        "X-Linked-Id": "FAC001",
    }
    payload = {
        "course_code": "CS3C01",
        "section": "A",
        "exam_type": "cie1",
        "marks": [
            {"student_id": "STU001", "score": 24.5},
            {"student_id": "STU002", "score": 7.0},
        ]
    }
    resp = client.post("/classes/marks", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json["updated_students"] == 2
    assert resp.json["statistics"]["average"] == 15.75
    assert resp.json["statistics"]["highest"] == 24.5
    assert resp.json["statistics"]["lowest"] == 7.0

    # Check student in DB
    with client.application.app_context():
        s1 = Student.query.filter_by(student_id="STU001").first()
        courses1 = s1.get_courses()
        assert courses1[0]["cie1"] == 24.5

        s2 = Student.query.filter_by(student_id="STU002").first()
        courses2 = s2.get_courses()
        assert courses2[0]["cie1"] == 7.0


def test_get_class_at_risk_endpoint(client):
    """GET /classes/<course_code>/<section>/at-risk returns only at-risk students."""
    headers = {
        "X-User-Role": "teacher",
        "X-Linked-Id": "FAC001",
    }
    resp = client.get("/classes/CS3C01/A/at-risk", headers=headers)
    assert resp.status_code == 200
    data = resp.json
    assert data["at_risk_count"] >= 1
    assert data["at_risk_students"][0]["student_id"] == "STU002"
    assert data["at_risk_students"][0]["severity"] == "high"


def test_view_and_modify_past_attendance_session_with_comment(client):
    """Teacher can view past attendance sessions, view details, and change records with audit comment."""
    headers = {
        "X-User-Role": "teacher",
        "X-Linked-Id": "FAC001",
    }

    # 1. Record an initial attendance session
    payload = {
        "course_code": "CS3C01",
        "section": "A",
        "session_date": "2026-09-02",
        "time_slot": "09:00 - 10:00 (Period 1)",
        "records": [
            {"student_id": "STU001", "status": "present"},
            {"student_id": "STU002", "status": "absent"},
        ],
    }
    create_resp = client.post("/classes/attendance", json=payload, headers=headers)
    assert create_resp.status_code == 201
    session_id = create_resp.json["session_id"]

    # 2. View session detail
    detail_resp = client.get(f"/classes/attendance-sessions/{session_id}", headers=headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json
    assert detail["id"] == session_id
    assert detail["present_count"] == 1
    assert detail["absent_count"] == 1
    assert detail["is_edited"] is False

    # 3. Patching without comment must fail (mandatory comment for audit)
    fail_patch = client.patch(
        f"/classes/attendance-sessions/{session_id}",
        json={
            "records": [{"student_id": "STU002", "status": "present"}],
            "change_comment": "",
        },
        headers=headers,
    )
    assert fail_patch.status_code == 400
    assert "mandatory" in fail_patch.json["error"]

    # 4. Patching with comment succeeds
    success_patch = client.patch(
        f"/classes/attendance-sessions/{session_id}",
        json={
            "records": [
                {"student_id": "STU001", "status": "present"},
                {"student_id": "STU002", "status": "present"},
            ],
            "change_comment": "Medical certificate verified by HOD for STU002.",
        },
        headers=headers,
    )
    assert success_patch.status_code == 200
    data = success_patch.json
    assert data["present_count"] == 2
    assert data["absent_count"] == 0
    assert data["change_comment"] == "Medical certificate verified by HOD for STU002."

    # 5. Detail now shows is_edited=True and audit info
    updated_detail = client.get(f"/classes/attendance-sessions/{session_id}", headers=headers).json
    assert updated_detail["is_edited"] is True
    assert updated_detail["edited_by"] == "FAC001"
    assert updated_detail["change_comment"] == "Medical certificate verified by HOD for STU002."

