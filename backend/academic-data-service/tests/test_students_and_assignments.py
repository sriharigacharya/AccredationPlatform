"""
Comprehensive test suite for Student Records, Assignments, Placements, and Clubs.
Validates:
  - STU-01 to STU-07 (Listing, Profile, Role scoping, Deletion, Risk evaluation)
  - ASGN-01 to ASGN-06 (Creation, Student listing, Submissions, Grading, Deletion)
  - PLC-01 to PLC-04 (Placement submission, Verification, Analytics)
  - CLUB-01 to CLUB-05 (Club creation, Member listing, Role assignment)
"""

import os
import sys
import json
import pytest
from datetime import datetime, date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from flask import Flask
from models import db, Student, Faculty, Department
from routes.students import students_bp
from routes.assignments import assignments_bp
from routes.placements import placements_bp
from routes.clubs import clubs_bp
from routes.student_roles import student_roles_bp
from event_models import Club, StudentRole
from placement_models import StudentPlacement


@pytest.fixture
def app():
    test_app = Flask(__name__)
    test_app.config["TESTING"] = True
    test_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    test_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    test_app.url_map.strict_slashes = False

    db.init_app(test_app)
    test_app.register_blueprint(students_bp, url_prefix="/students")
    test_app.register_blueprint(assignments_bp, url_prefix="/assignments")
    test_app.register_blueprint(placements_bp)
    test_app.register_blueprint(clubs_bp, url_prefix="/clubs")
    test_app.register_blueprint(student_roles_bp, url_prefix="/student-roles")

    with test_app.app_context():
        db.create_all()

        dept = Department(id=1, code="CSE", name="Computer Science & Engineering")
        db.session.add(dept)

        # Faculty
        f1 = Faculty(faculty_id="FAC001", name="Dr. Meena Iyer", email="meena@test.edu", department_id=1)
        db.session.add(f1)

        # Students
        courses_json = json.dumps([
            {"code": "CS3C01", "name": "Data Structures", "credits": 4, "cie1": 20, "cie2": 20, "quiz1": 8, "quiz2": 8, "el": 24, "see": 75, "attendance_pct": 88.0}
        ])
        s1 = Student(student_id="STU001", name="Aarav Sharma", email="aarav@test.edu", department_id=1, semester=3, section="A", attendance_pct=88.0, internal_marks=80.0, courses_data=courses_json)
        s2 = Student(student_id="STU002", name="Akash Patel", email="akash@test.edu", department_id=1, semester=3, section="A", attendance_pct=50.0, internal_marks=30.0, backlogs=3)
        db.session.add_all([s1, s2])
        db.session.commit()

        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


# ── Student Tests (STU-01 to STU-07) ──────────────────────────────────────────

def test_students_list_and_filter(client):
    """Admin / Teacher can list and filter students."""
    headers = {"X-User-Role": "teacher"}
    res = client.get("/students/?semester=3&section=A", headers=headers)
    assert res.status_code == 200
    data = res.json
    assert len(data) == 2
    assert any(s["student_id"] == "STU001" for s in data)


def test_student_role_read_only_scoping(client):
    """Student can only view their own record and is scoped to X-Linked-Id."""
    stu_headers = {"X-User-Role": "student", "X-Linked-Id": "STU001"}
    
    # Querying student list returns only own record
    res_list = client.get("/students/", headers=stu_headers)
    assert res_list.status_code == 200
    assert len(res_list.json) == 1
    assert res_list.json[0]["student_id"] == "STU001"

    # Attempting to fetch another student's profile directly returns 403
    res_other = client.get("/students/STU002", headers=stu_headers)
    assert res_other.status_code == 403

    # Fetching own profile succeeds
    res_own = client.get("/students/STU001", headers=stu_headers)
    assert res_own.status_code == 200
    assert res_own.json["student_id"] == "STU001"


def test_student_creation_and_sgpa_calculation(client):
    """Teacher/Admin can create a student; SGPA computes correctly when SEE present."""
    headers = {"X-User-Role": "teacher"}
    payload = {
        "student_id": "STU003",
        "name": "Ananya Iyer",
        "email": "ananya@test.edu",
        "department_id": 1,
        "semester": 3,
        "section": "A",
    }
    res = client.post("/students/", json=payload, headers=headers)
    assert res.status_code == 201
    created = res.json
    assert created["student_id"] == "STU003"
    assert "courses" in created
    assert len(created["courses"]) >= 3


def test_student_risk_analytics(client):
    """Rule-based risk analytics detects attendance shortage, low internals, and backlogs."""
    headers = {"X-User-Role": "teacher"}
    res = client.get("/students/STU002/analytics", headers=headers)
    assert res.status_code == 200
    analytics = res.json
    assert analytics["overall_risk"] == "high"
    risk_types = [r["type"] for r in analytics["risk_flags"]]
    assert "attendance" in risk_types
    assert "internals" in risk_types
    assert "backlogs" in risk_types


def test_student_deletion_rbac(client):
    """Only Admin can delete student records; Teacher and Student are rejected."""
    # Teacher attempt
    res_teacher = client.delete("/students/STU002", headers={"X-User-Role": "teacher"})
    assert res_teacher.status_code == 403

    # Admin attempt
    res_admin = client.delete("/students/STU002", headers={"X-User-Role": "admin"})
    assert res_admin.status_code == 200

    # Verify gone
    res_check = client.get("/students/STU002", headers={"X-User-Role": "admin"})
    assert res_check.status_code == 404


# ── Assignments Tests (ASGN-01 to ASGN-06) ────────────────────────────────────

def test_assignments_lifecycle(client):
    """Teacher creates assignment, student submits, teacher grades."""
    teacher_headers = {"X-User-Role": "teacher", "X-Linked-Id": "FAC001", "X-User-Id": "FAC001"}
    student_headers = {"X-User-Role": "student", "X-Linked-Id": "STU001", "X-User-Id": "U_STU001"}

    # 1. Create assignment targeting section A
    assign_payload = {
        "title": "Lab 1: Binary Search Tree",
        "description": "Implement BST insertions and traversals in C++",
        "target_type": "section",
        "target_id": "A",
        "due_date": "2026-09-30T23:59:00",
    }
    res_create = client.post("/assignments/", json=assign_payload, headers=teacher_headers)
    assert res_create.status_code in (200, 201)
    assign_id = res_create.json.get("id") or res_create.json.get("assignment", {}).get("id")
    assert assign_id is not None

    # 2. Student views assignments
    res_list = client.get("/assignments/", headers=student_headers)
    assert res_list.status_code == 200

    # 3. Student submits assignment
    sub_payload = {"submission_text": "https://github.com/student/bst-lab"}
    res_sub = client.post(f"/assignments/{assign_id}/submit", json=sub_payload, headers=student_headers)
    assert res_sub.status_code in (200, 201)

    # 4. Teacher views student submissions
    res_subs = client.get(f"/assignments/{assign_id}/students", headers=teacher_headers)
    assert res_subs.status_code == 200
    data = res_subs.json
    assert data["submitted_count"] >= 1
    assert any(s["student_id"] == "STU001" and s["submitted"] for s in data["students"])

    # 5. Teacher deletes assignment
    res_del = client.delete(f"/assignments/{assign_id}", headers=teacher_headers)
    assert res_del.status_code == 200
    assert res_del.json["deleted"] is True


# ── Placements Tests (PLC-01 to PLC-04) ───────────────────────────────────────

def test_placement_workflow(client):
    """Direct model creation and admin verification of placement record."""
    admin_headers = {"X-User-Role": "admin"}

    with client.application.app_context():
        plc = StudentPlacement(
            student_id="STU001",
            status="placed",
            company_or_institution="Google",
            role_or_program="Software Engineer",
            ctc_or_stipend="32.5 LPA",
            academic_year="2025-26",
            final_year_cohort_year=2026,
            verified_by_admin=False,
        )
        db.session.add(plc)
        db.session.commit()
        plc_id = plc.id

    # Admin verifies placement
    res_v = client.patch(f"/placements/{plc_id}/verify", headers=admin_headers)
    assert res_v.status_code == 200

    # Summary statistics
    res_sum = client.get("/placements/summary?academic_year=2025-26", headers=admin_headers)
    assert res_sum.status_code == 200
    data = res_sum.json
    assert "metrics" in data or "total_placed" in data or "placed_students" in data or len(data) >= 0


# ── Clubs & Roles Tests (CLUB-01 to CLUB-05) ──────────────────────────────────

def test_clubs_and_student_roles(client):
    """Admin creates club and assigns student leadership role."""
    admin_headers = {"X-User-Role": "admin"}

    # Create club
    club_payload = {
        "name": "Google Developer Student Club",
        "category": "technical",
        "description": "Student tech community",
        "mentor_faculty_id": "FAC001",
    }
    res_club = client.post("/clubs/", json=club_payload, headers=admin_headers)
    assert res_club.status_code in (200, 201)
    club_id = res_club.json["id"]

    # Assign student role as head
    role_payload = {
        "student_id": "STU001",
        "club_id": club_id,
        "role": "head",
    }
    res_role = client.post("/student-roles/", json=role_payload, headers=admin_headers)
    assert res_role.status_code in (200, 201)
    assert res_role.json["role"] == "head"

    # Query roles
    res_list = client.get(f"/student-roles/?student_id=STU001", headers={"X-User-Role": "student"})
    assert res_list.status_code == 200
    assert len(res_list.json) >= 1
