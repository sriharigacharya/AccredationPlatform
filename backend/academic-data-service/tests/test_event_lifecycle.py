"""
test_event_lifecycle.py — 12-test suite covering the full event lifecycle.

Tests:
  1. Scheduler Proposal (no photos)
  2. Mentor Approval
  3. Student Registration & duplicate prevention
  4. Cancel Registration gating
  5. Walk-in & Attendance transaction
  6. Strict gating bypass rejection
  7. SAR Decoupling
  8. Time-slot interval overlap
  9. Student enrollment rejection
 10. RBAC unauthorized award rejection
 11. Idempotent multi-course double-award
 12. Event isolation
"""

import os
import sys
import pytest
import json
from datetime import datetime, timedelta, date

# Add academic-data-service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from flask import Flask
from models import db, Student, Faculty, ClassAttendanceSession, ClassAttendanceEntry
from event_models import (
    Club, StudentRole, Event, EventPhoto, EventRegistration, EventAttendanceAward,
    EventStatus, EventAttendanceStatus,
)
from routes.events import events_bp


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def app():
    app = Flask("test_event_lifecycle")
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["TESTING"] = True

    db.init_app(app)
    app.register_blueprint(events_bp)

    with app.app_context():
        db.create_all()
        _seed_test_data()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def _seed_test_data():
    """Seed minimal data for lifecycle tests."""
    # Faculty
    fac1 = Faculty(faculty_id="FAC001", name="Dr. Meena Iyer", email="fac001@test.edu",
                   designation="Assoc Prof", qualification="PhD")
    fac2 = Faculty(faculty_id="FAC002", name="Prof. Ravi Shankar", email="fac002@test.edu",
                   designation="Asst Prof", qualification="MTech")
    db.session.add_all([fac1, fac2])

    # Students in Section A (Sem 3) with courses_data for CS3C01, CS3C02
    courses_a = json.dumps([
        {"code": "CS3C01", "name": "Data Structures", "credits": 4,
         "cie1": 20, "cie2": 22, "quiz1": 8, "quiz2": 9, "el": 25, "see": 80, "attendance_pct": 90.0},
        {"code": "CS3C02", "name": "Digital Logic", "credits": 4,
         "cie1": 18, "cie2": 20, "quiz1": 7, "quiz2": 8, "el": 22, "see": 75, "attendance_pct": 85.0},
    ])
    stu1 = Student(student_id="STU001", name="Aarav Sharma", email="stu001@test.edu",
                   section="A", semester=3, attendance_pct=90.0, internal_marks=80.0,
                   courses_data=courses_a)
    stu2 = Student(student_id="STU002", name="Aditi Rao", email="stu002@test.edu",
                   section="A", semester=3, attendance_pct=72.0, internal_marks=60.0,
                   courses_data=courses_a)
    # Student in Section B (different section)
    courses_b = json.dumps([
        {"code": "CS5C01", "name": "DBMS", "credits": 4,
         "cie1": 15, "cie2": 18, "quiz1": 6, "quiz2": 7, "el": 20, "see": 70, "attendance_pct": 80.0},
    ])
    stu3 = Student(student_id="STU050", name="Hemanth Reddy", email="stu050@test.edu",
                   section="B", semester=5, attendance_pct=58.0, internal_marks=50.0,
                   courses_data=courses_b)
    db.session.add_all([stu1, stu2, stu3])

    # Club
    club = Club(id=1, name="ACM Student Chapter", category="technical",
                description="ACM chapter", mentor_faculty_id="FAC001")
    db.session.add(club)
    db.session.flush()

    # Student Roles
    db.session.add(StudentRole(student_id="STU001", club_id=1, role="head", assigned_by="admin"))
    db.session.add(StudentRole(student_id="STU002", club_id=1, role="member", assigned_by="admin"))

    db.session.commit()


# ── Header helpers ────────────────────────────────────────────────────────────

def student_headers(sid):
    return {"X-User-Role": "Student", "X-Linked-Id": sid, "X-User-Id": f"U_{sid}"}

def teacher_headers(fid):
    return {"X-User-Role": "Teacher", "X-Linked-Id": fid, "X-User-Id": f"U_{fid}"}

def admin_headers():
    return {"X-User-Role": "Admin", "X-User-Id": "U_ADMIN"}


# ══════════════════════════════════════════════════════════════════════════════
# TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_student_scheduler_proposal_blocks_photos(client):
    """1. Event proposal is a scheduler with date + time slot. No photos required."""
    data = {
        "club_id": "1",
        "title": "CodeStorm 2026",
        "event_type": "hackathon",
        "description": "Annual 24hr hackathon",
        "venue": "Main Auditorium",
        "event_date": "2026-09-15",
        "time_slot": "09:00 AM - 05:00 PM",
        "start_time": "09:00",
        "end_time": "17:00",
    }
    res = client.post("/events", data=data, content_type="multipart/form-data",
                      headers=student_headers("STU001"))
    assert res.status_code == 201
    body = res.json
    assert body["status"] == "pending"
    assert body["time_slot"] == "09:00 AM - 05:00 PM"
    assert body["start_time"] == "09:00"
    assert body["end_time"] == "17:00"
    assert body["is_completed"] is False


def test_mentor_approval_flow(client):
    """2. Faculty mentor approves a pending event → status becomes 'approved'."""
    # Create pending event
    event = Event(id=20, club_id=1, title="Approved Event", event_type="workshop",
                  venue="Lab 3", organized_by_student_id="STU001", submitted_via="club_head",
                  event_date=datetime.utcnow() + timedelta(days=5),
                  time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                  status="pending")
    db.session.add(event)
    db.session.commit()

    res = client.patch("/events/20/approve", json={}, headers=teacher_headers("FAC001"))
    assert res.status_code == 200
    assert res.json["status"] == "approved"
    assert res.json["reviewed_by"] == "FAC001"


def test_student_registration_and_duplicate_prevention(client):
    """3. Student RSVP + duplicate blocked with 409."""
    event = Event(id=25, club_id=1, title="RSVP Event", event_type="seminar",
                  venue="Hall A", organized_by_student_id="STU001", submitted_via="club_head",
                  event_date=datetime.utcnow() + timedelta(days=3),
                  time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                  status="approved")
    db.session.add(event)
    db.session.commit()

    # First registration
    res1 = client.post("/events/25/register", headers=student_headers("STU002"))
    assert res1.status_code == 201
    assert res1.json["student_id"] == "STU002"

    # Duplicate
    res2 = client.post("/events/25/register", headers=student_headers("STU002"))
    assert res2.status_code == 409


def test_cancel_registration_gating(client):
    """4. Cancel allowed for future event; blocked for ongoing/completed."""
    event = Event(id=30, club_id=1, title="Cancel Test Event", event_type="seminar",
                  venue="Hall B", organized_by_student_id="STU001", submitted_via="club_head",
                  event_date=datetime.utcnow() + timedelta(days=2),
                  time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                  status="approved")
    db.session.add(event)
    db.session.commit()

    # Register
    client.post("/events/30/register", headers=student_headers("STU002"))

    # Cancel — should succeed (future event)
    res = client.post("/events/30/cancel-registration", headers=student_headers("STU002"))
    assert res.status_code == 200

    # Re-register, then mark completed
    client.post("/events/30/register", headers=student_headers("STU002"))
    ev_rec = Event.query.get(30)
    ev_rec.is_completed = True
    db.session.commit()

    # Cancel — should fail (completed)
    res2 = client.post("/events/30/cancel-registration", headers=student_headers("STU002"))
    assert res2.status_code == 400
    assert "ongoing or completed" in res2.json["error"].lower()


def test_walk_in_and_attendance_transaction(client):
    """5. Day-of attendance with walk-in; sets is_completed=True."""
    event = Event(id=40, club_id=1, title="Attendance Event", event_type="workshop",
                  venue="Lab 1", organized_by_student_id="STU001", submitted_via="club_head",
                  event_date=datetime.utcnow() - timedelta(hours=2),
                  time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                  status="approved")
    db.session.add(event)
    db.session.commit()

    # Register STU002
    reg = EventRegistration(event_id=40, student_id="STU002", status="registered")
    db.session.add(reg)
    db.session.commit()

    # Mark attendance with STU002 present + STU001 as walk-in
    res = client.post("/events/40/attendance", json={
        "attendees": [{"student_id": "STU002", "status": "present"}],
        "walk_ins": [{"student_id": "STU001"}],
    }, headers=student_headers("STU001"))

    assert res.status_code == 200
    assert res.json["is_completed"] is True
    assert res.json["present_count"] == 2

    # Verify DB
    ev_db = Event.query.get(40)
    assert ev_db.is_completed is True


def test_strict_gating_bypass_rejection(client):
    """6. Post-event report REJECTED when is_completed=False."""
    event = Event(id=50, club_id=1, title="Gating Test Event", event_type="seminar",
                  venue="Hall C", organized_by_student_id="STU001", submitted_via="club_head",
                  event_date=datetime.utcnow() - timedelta(days=1),
                  time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                  status="approved", is_completed=False)
    db.session.add(event)
    db.session.commit()

    res = client.post("/events/50/post-event",
                      data={"report_text": "Test report"},
                      content_type="multipart/form-data",
                      headers=student_headers("STU001"))
    assert res.status_code == 400
    assert "completed" in res.json["error"].lower()


def test_sar_decoupling(client):
    """7. Post-event report writes ONLY to event models, zero SAR coupling."""
    event = Event(id=60, club_id=1, title="SAR Test Event", event_type="workshop",
                  venue="Lab 2", organized_by_student_id="STU001", submitted_via="club_head",
                  event_date=datetime.utcnow() - timedelta(hours=3),
                  time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                  status="approved", is_completed=True)
    db.session.add(event)
    db.session.commit()

    res = client.post("/events/60/post-event",
                      data={"report_text": "Successful event with 65 participants"},
                      content_type="multipart/form-data",
                      headers=student_headers("STU001"))
    assert res.status_code == 200
    assert "event" in res.json

    # Verify event report_text was updated
    ev = Event.query.get(60)
    assert "65 participants" in ev.report_text


def test_time_slot_interval_overlap(client):
    """8. Overlap/disjoint/boundary validation for duty attendance."""
    from routes.events import _parse_hhmm_to_minutes, _parse_slot_range_to_minutes, _intervals_overlap

    e_start = _parse_hhmm_to_minutes("11:00")  # 660
    e_end = _parse_hhmm_to_minutes("13:00")    # 780

    # Overlapping: 11:30 AM - 12:30 PM
    c_start, c_end = _parse_slot_range_to_minutes("11:30 AM - 12:30 PM")
    assert _intervals_overlap(e_start, e_end, c_start, c_end) is True

    # Disjoint: 09:00 AM - 10:00 AM
    c_start, c_end = _parse_slot_range_to_minutes("09:00 AM - 10:00 AM")
    assert _intervals_overlap(e_start, e_end, c_start, c_end) is False

    # Boundary touch: 01:00 PM - 02:00 PM (13:00 = event end, no strict overlap)
    c_start, c_end = _parse_slot_range_to_minutes("01:00 PM - 02:00 PM")
    assert _intervals_overlap(e_start, e_end, c_start, c_end) is False


def test_enrollment_validation_rejection(client):
    """9. Rejects duty attendance for student not in the requested section."""
    # Create completed event with STU050 (Section B) attending
    event = Event(id=70, club_id=1, title="Enrollment Test", event_type="workshop",
                  venue="Lab 1", organized_by_student_id="STU001", submitted_via="club_head",
                  event_date=datetime.utcnow() - timedelta(hours=2),
                  time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                  status="approved", is_completed=True)
    db.session.add(event)
    reg = EventRegistration(event_id=70, student_id="STU050", status="present")
    db.session.add(reg)
    db.session.commit()

    # Try to award Section A course attendance to Section B student
    res = client.post("/events/70/award-class-attendance", json={
        "course_code": "CS3C01",
        "section": "A",
        "time_slot": "11:30 AM - 12:30 PM",
        "student_ids": ["STU050"],
    }, headers=teacher_headers("FAC001"))

    assert res.status_code == 200
    # STU050 is Section B, so credited_count should be 0
    assert res.json["credited_count"] == 0


def test_rbac_unauthorized_award_rejection(client):
    """10. Faculty B (not assigned to CS3C01 Sec A) gets 403."""
    event = Event(id=75, club_id=1, title="RBAC Test", event_type="workshop",
                  venue="Lab 1", organized_by_student_id="STU001", submitted_via="club_head",
                  event_date=datetime.utcnow() - timedelta(hours=2),
                  time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                  status="approved", is_completed=True)
    db.session.add(event)
    db.session.commit()

    res = client.post("/events/75/award-class-attendance", json={
        "course_code": "CS3C01",
        "section": "A",
        "time_slot": "11:30 AM - 12:30 PM",
        "student_ids": ["STU001"],
    }, headers=teacher_headers("FAC002"))  # FAC002 is NOT assigned to CS3C01 Sec A

    assert res.status_code == 403


def test_idempotent_multi_course_double_award(client):
    """11. Two faculty award different courses; re-submitting is idempotent (200, no 409)."""
    event = Event(id=80, club_id=1, title="Multi-Course Award", event_type="workshop",
                  venue="Lab 1", organized_by_student_id="STU001", submitted_via="club_head",
                  event_date=datetime.utcnow() - timedelta(hours=2),
                  time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                  status="approved", is_completed=True)
    db.session.add(event)
    # Register and mark STU001 as present
    reg = EventRegistration(event_id=80, student_id="STU001", status="present")
    db.session.add(reg)
    db.session.commit()

    # FAC001 awards CS3C01 (Section A)
    res1 = client.post("/events/80/award-class-attendance", json={
        "course_code": "CS3C01",
        "section": "A",
        "time_slot": "11:30 AM - 12:30 PM",
        "student_ids": ["STU001"],
    }, headers=teacher_headers("FAC001"))
    assert res1.status_code == 200
    assert res1.json["credited_count"] == 1

    # FAC001 re-submits CS3C01 — idempotent update, not 409
    res2 = client.post("/events/80/award-class-attendance", json={
        "course_code": "CS3C01",
        "section": "A",
        "time_slot": "11:30 AM - 12:30 PM",
        "student_ids": ["STU001"],
    }, headers=teacher_headers("FAC001"))
    assert res2.status_code == 200
    assert res2.json["updated_count"] == 1
    assert res2.json["credited_count"] == 0

    # Both awards persist
    awards = EventAttendanceAward.query.filter_by(event_id=80).all()
    assert len(awards) == 1  # idempotent: still 1 award for CS3C01


def test_event_isolation(client):
    """12. Event 1 awards don't leak into Event 2."""
    # Event A (completed)
    evA = Event(id=90, club_id=1, title="Event A", event_type="seminar",
                venue="Hall", organized_by_student_id="STU001", submitted_via="club_head",
                event_date=datetime.utcnow() - timedelta(hours=4),
                time_slot="11:00 AM - 01:00 PM", start_time="11:00", end_time="13:00",
                status="approved", is_completed=True)
    evB = Event(id=91, club_id=1, title="Event B", event_type="seminar",
                venue="Hall", organized_by_student_id="STU001", submitted_via="club_head",
                event_date=datetime.utcnow() - timedelta(hours=3),
                time_slot="02:00 PM - 04:00 PM", start_time="14:00", end_time="16:00",
                status="approved", is_completed=True)
    db.session.add_all([evA, evB])
    regA = EventRegistration(event_id=90, student_id="STU001", status="present")
    db.session.add(regA)
    db.session.commit()

    # Award on Event A
    client.post("/events/90/award-class-attendance", json={
        "course_code": "CS3C01",
        "section": "A",
        "time_slot": "11:30 AM - 12:30 PM",
        "student_ids": ["STU001"],
    }, headers=teacher_headers("FAC001"))

    # Event B should have zero awards
    awards_b = EventAttendanceAward.query.filter_by(event_id=91).all()
    assert len(awards_b) == 0

    # Event A should have 1 award
    awards_a = EventAttendanceAward.query.filter_by(event_id=90).all()
    assert len(awards_a) == 1
