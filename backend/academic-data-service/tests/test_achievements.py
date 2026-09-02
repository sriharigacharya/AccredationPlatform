"""
Unit tests for Student Achievements routes, verification lifecycle,
team achievements handling, and unified NBA Criterion 4.6.3 reporting.
"""

import os
import sys
import io
import pytest
from datetime import date, datetime

# Add academic-data-service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from flask import Flask
from models import db, Student, Department
import achievement_models
from routes.student_achievements import student_achievements_bp
from achievement_models import StudentAchievement


@pytest.fixture
def app():
    test_app = Flask(__name__)
    test_app.config["TESTING"] = True
    test_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    test_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(test_app)
    test_app.register_blueprint(student_achievements_bp)

    with test_app.app_context():
        db.create_all()

        # Seed test department and students
        dept = Department(code="CSE", name="Computer Science & Engineering")
        db.session.add(dept)

        s1 = Student(student_id="STU069", name="Aarav Sharma", email="aarav@test.edu", department_id=dept.id, section="A", semester=7)
        s2 = Student(student_id="STU070", name="Bhavna Rao", email="bhavna@test.edu", department_id=dept.id, section="A", semester=7)
        s3 = Student(student_id="STU072", name="Chetan Kumar", email="chetan@test.edu", department_id=dept.id, section="B", semester=5)

        db.session.add_all([s1, s2, s3])
        db.session.commit()

        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def test_student_self_submission_and_scoping(client):
    """Student submits an external achievement with proof and team members."""
    data = {
        "event_name": "Smart India Hackathon 2025",
        "organizing_body": "AICTE & MoE",
        "activity_type": "technical",
        "event_scope": "national",
        "event_date": "2025-11-22",
        "academic_year": "2025-26",
        "venue": "IIT Roorkee",
        "result_description": "1st Prize Winner",
        "student_ids": "STU069, STU070",
        "proof_file": (io.BytesIO(b"%PDF-1.4 test certificate"), "cert.pdf"),
    }

    # Student submission header
    headers = {
        "X-User-Role": "Student",
        "X-Linked-Id": "STU069",
        "X-User-Id": "U_STU069",
    }

    res = client.post("/student-achievements", data=data, content_type="multipart/form-data", headers=headers)
    assert res.status_code == 201
    ach_id = res.json["achievement"]["id"]
    assert res.json["achievement"]["verification_status"] == "pending"
    assert res.json["achievement"]["is_team"] is True
    assert res.json["achievement"]["team_size"] == 2

    # Scoped query by primary student (me)
    res_me1 = client.get("/student-achievements?student_id=me", headers={"X-Linked-Id": "STU069", "X-User-Role": "Student"})
    assert res_me1.status_code == 200
    assert len(res_me1.json) == 1

    # Scoped query by teammate student (me)
    res_me2 = client.get("/student-achievements?student_id=me", headers={"X-Linked-Id": "STU070", "X-User-Role": "Student"})
    assert res_me2.status_code == 200
    assert len(res_me2.json) == 1
    assert res_me2.json[0]["id"] == ach_id

    # Third student not in team should see 0 records
    res_me3 = client.get("/student-achievements?student_id=me", headers={"X-Linked-Id": "STU072", "X-User-Role": "Student"})
    assert res_me3.status_code == 200
    assert len(res_me3.json) == 0


def test_faculty_verification_and_rejection_workflow(client):
    """Faculty/Admin can verify or reject pending achievements."""
    # Create record directly
    ach = StudentAchievement(
        student_id="STU072",
        student_ids=["STU072"],
        activity_type="sports",
        event_name="VTU State Athletics 2025",
        organizing_body="VTU",
        event_scope="within_state",
        event_date=date(2025, 10, 15),
        academic_year="2025-26",
        venue="Kanteerava Stadium, Bengaluru",
        result_description="Gold Medal in 100m Sprint",
        proof_file_path="athletics_cert.pdf",
        verification_status="pending",
    )
    db.session.add(ach)
    db.session.commit()
    ach_id = ach.id

    # Faculty rejects record with a reason
    fac_headers = {"X-User-Role": "Faculty", "X-User-Id": "FAC001"}
    res_rej = client.patch(f"/student-achievements/{ach_id}/reject", json={"rejection_reason": "Certificate seal unclear"}, headers=fac_headers)
    assert res_rej.status_code == 200
    assert res_rej.json["achievement"]["verification_status"] == "rejected"
    assert res_rej.json["achievement"]["rejection_reason"] == "Certificate seal unclear"

    # Faculty re-verifies record
    res_ver = client.patch(f"/student-achievements/{ach_id}/verify", headers=fac_headers)
    assert res_ver.status_code == 200
    assert res_ver.json["achievement"]["verification_status"] == "verified"
    assert res_ver.json["achievement"]["verified_by"] == "FAC001"


def test_unified_nba_report_generation(client):
    """
    NBA Criterion 4.6.3 Report Acceptance Criteria:
    - Technical and non-technical achievements share ONE UNIFIED TABLE grouped only by academic year.
    - Only verified records are included in the report.
    """
    # 1. Verified Technical achievement in 2025-26
    ach1 = StudentAchievement(
        student_id="STU069",
        student_ids=["STU069"],
        activity_type="technical",
        event_name="SIH 2025",
        organizing_body="MoE",
        event_scope="national",
        event_date=date(2025, 11, 20),
        academic_year="2025-26",
        venue="IIT Roorkee",
        result_description="1st Prize",
        proof_file_path="sih.pdf",
        verification_status="verified",
    )
    # 2. Verified Sports achievement in 2025-26 (unified with technical)
    ach2 = StudentAchievement(
        student_id="STU072",
        student_ids=["STU072"],
        activity_type="sports",
        event_name="VTU Athletics 2025",
        organizing_body="VTU",
        event_scope="within_state",
        event_date=date(2025, 10, 15),
        academic_year="2025-26",
        venue="Bengaluru",
        result_description="Gold Medal",
        proof_file_path="vtu.pdf",
        verification_status="verified",
    )
    # 3. Pending Cultural achievement in 2025-26 (must NOT appear in report)
    ach3 = StudentAchievement(
        student_id="STU070",
        student_ids=["STU070"],
        activity_type="cultural",
        event_name="Yuva Utsav 2025",
        organizing_body="AIU",
        event_scope="national",
        event_date=date(2025, 9, 10),
        academic_year="2025-26",
        venue="BHU",
        result_description="1st Prize Vocal",
        proof_file_path="yuva.pdf",
        verification_status="pending",
    )
    # 4. Verified Cultural achievement in 2024-25 (different academic year)
    ach4 = StudentAchievement(
        student_id="STU069",
        student_ids=["STU069"],
        activity_type="cultural",
        event_name="State Youth Fest 2024",
        organizing_body="Govt of Karnataka",
        event_scope="within_state",
        event_date=date(2024, 12, 5),
        academic_year="2024-25",
        venue="Mysuru",
        result_description="Winner Solo Classical",
        proof_file_path="fest.pdf",
        verification_status="verified",
    )

    db.session.add_all([ach1, ach2, ach3, ach4])
    db.session.commit()

    # Query report endpoint
    res = client.get("/student-achievements/report", headers={"X-User-Role": "Faculty"})
    assert res.status_code == 200
    report_data = res.json

    assert report_data["total_verified_achievements"] == 3
    assert len(report_data["unified_by_year"]) == 2
    assert "Section 4.6.3" in report_data["nba_section"]
    assert "4.7" not in report_data["nba_section"]


    # Verify 2025-26 group contains BOTH technical and sports in the same list (not split into tables)
    year_2025 = next(y for y in report_data["unified_by_year"] if y["academic_year"] == "2025-26")
    assert year_2025["total_achievements"] == 2
    assert year_2025["technical_count"] == 1
    assert year_2025["sports_count"] == 1
    assert year_2025["cultural_count"] == 0  # Pending one is excluded!
    assert len(year_2025["achievements"]) == 2

    # Check both activities are in the single unified array
    types_in_group = [a["activity_type"] for a in year_2025["achievements"]]
    assert "technical" in types_in_group
    assert "sports" in types_in_group
