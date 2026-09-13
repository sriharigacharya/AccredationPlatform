"""
Automated unit and integration tests for Timetable, Biometric Attendance, and Leave Notifications.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from models import db, Faculty, TimetableSlot, AttendanceEvent, FacultyDailyAttendance, LeaveNotice, ScheduleNotification


@pytest.fixture
def client():
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        with app.app_context():
            yield client


def test_timetable_meta(client):
    res = client.get("/timetable/meta")
    assert res.status_code == 200
    data = res.get_json()
    assert "faculty" in data
    assert len(data["faculty"]) >= 42
    assert "sections" in data
    assert "periods" in data
    assert len(data["periods"]) == 6


def test_faculty_timetable_grid(client):
    res = client.get("/timetable/faculty/Dr. C VIDYARAJ")
    assert res.status_code == 200
    data = res.get_json()
    assert data["faculty"]["name"] == "Dr. C VIDYARAJ"
    assert "grid" in data
    assert "Tue" in data["grid"]
    assert len(data["grid"]["Tue"]) >= 2
    # Verify period index ordering
    tue_periods = [slot["period_index"] for slot in data["grid"]["Tue"]]
    assert tue_periods == sorted(tue_periods)


def test_biometric_punch_flow(client):
    # 1. On-time punch in
    p_in = client.post("/attendance/punch", json={
        "faculty_id": "Dr. C VIDYARAJ",
        "event_type": "IN",
        "device_id": "MOCK-DEVICE-01",
        "timestamp": "2025-02-18T08:55:00",
    })
    assert p_in.status_code == 201
    in_data = p_in.get_json()
    assert in_data["computed_status_today"] == "PRESENT"
    assert in_data["daily_attendance"]["is_on_campus"] is True

    # 2. Duplicate punch in prevention
    p_dup = client.post("/attendance/punch", json={
        "faculty_id": "Dr. C VIDYARAJ",
        "event_type": "IN",
        "device_id": "MOCK-DEVICE-01",
        "timestamp": "2025-02-18T08:58:00",
    })
    assert p_dup.status_code == 409
    assert "already punched IN" in p_dup.get_json()["error"]

    # 3. Punch out at end of day
    p_out = client.post("/attendance/punch", json={
        "faculty_id": "Dr. C VIDYARAJ",
        "event_type": "OUT",
        "device_id": "MOCK-DEVICE-01",
        "timestamp": "2025-02-18T16:35:00",
    })
    assert p_out.status_code == 201
    out_data = p_out.get_json()
    assert out_data["computed_status_today"] == "PRESENT"
    assert out_data["daily_attendance"]["is_on_campus"] is False
    assert out_data["daily_attendance"]["work_duration_hours"] >= 7.0

    # 4. Late punch in for another faculty member
    p_late = client.post("/attendance/punch", json={
        "faculty_id": "FAC001",
        "event_type": "IN",
        "device_id": "MOCK-DEVICE-01",
        "timestamp": "2025-02-18T09:45:00",
    })
    assert p_late.status_code == 201
    assert p_late.get_json()["computed_status_today"] == "LATE"


def test_leave_submission_and_student_notifications(client):
    # Preview affected slots for Tuesday
    prev = client.post("/leave/preview-affected", json={
        "faculty_id": "Dr. C VIDYARAJ",
        "date": "2025-02-18",
    })
    assert prev.status_code == 200
    p_data = prev.get_json()
    assert p_data["affected_slots_count"] >= 2
    assert p_data["affected_students_count"] > 0

    # Submit leave notice
    sub = client.post("/leave", json={
        "faculty_id": "Dr. C VIDYARAJ",
        "date": "2025-02-18",
        "reason": "Family function",
        "created_by": "Dr. C VIDYARAJ",
    })
    assert sub.status_code == 201
    s_data = sub.get_json()
    assert s_data["notifications_sent"] > 0
    leave_id = s_data["leave"]["id"]

    # Verify a notification was dispatched
    stu_res = client.get("/notifications/student/STU001")
    assert stu_res.status_code == 200
    notifs = stu_res.get_json()["notifications"]
    assert len(notifs) >= 1
    assert "Dr. C VIDYARAJ is on leave" in notifs[0]["message"]

    # Assign substitute teacher
    sub_res = client.post(f"/leave/{leave_id}/substitute", json={
        "substitute_faculty_id": "FAC001",
    })
    assert sub_res.status_code == 200

    # Cancel leave and check retraction notice
    canc = client.delete(f"/leave/{leave_id}")
    assert canc.status_code == 200
    canc_data = canc.get_json()
    assert canc_data["retraction_notifications_sent"] > 0
