"""
Faculty Attendance Routes & Biometric Punch Engine — AcademiQ
Handles:
  - POST /attendance/punch  (used by mock biometric device & physical kiosks)
  - GET  /attendance/today  (live campus roster: who is on campus, who is late, etc.)
  - GET  /attendance/faculty/<id> (monthly attendance report and history)
  - POST /attendance/manual (admin override / correction)
  - POST /attendance/reset-demo (reset demo punch state)
"""

import os
import json
import uuid
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from datetime import datetime, date, timedelta, time
from models import (
    db,
    Faculty,
    AttendanceEvent,
    FacultyDailyAttendance,
    LeaveNotice,
    TimetableSlot,
)
from timetable_models import TeacherEventAttendanceRequest

attendance_bp = Blueprint("attendance", __name__)

ALLOWED_PROOF_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
MAX_PROOF_SIZE = 15 * 1024 * 1024  # 15 MB


def _get_proofs_dir():
    folder = current_app.config.get("ATTENDANCE_PROOFS_FOLDER")
    if not folder:
        folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), "attendance_proofs")
    os.makedirs(folder, exist_ok=True)
    return folder


def _build_faculty_map():
    faculty = Faculty.query.all()
    return {f.faculty_id: f.name for f in faculty}


def recompute_daily_attendance(faculty_id, target_date):
    """
    Recomputes the FacultyDailyAttendance record for a given faculty and date.
    Rules:
      - Approved leave covers day -> ON_LEAVE
      - No IN event -> NOT_YET_MARKED or ABSENT
      - IN after scheduled first class (with 15 min grace, default 09:15) -> LATE
      - OUT before scheduled last class ends (or < 4 hours on campus) -> HALF_DAY
      - Otherwise -> PRESENT
    """
    faculty = Faculty.query.filter_by(faculty_id=faculty_id).first()
    if not faculty:
        return None

    # Get all punch events for this faculty on this date
    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = datetime.combine(target_date, datetime.max.time())

    events = (
        AttendanceEvent.query.filter(
            AttendanceEvent.faculty_id == faculty_id,
            AttendanceEvent.event_time >= start_dt,
            AttendanceEvent.event_time <= end_dt,
        )
        .order_by(AttendanceEvent.event_time)
        .all()
    )

    day_code = target_date.strftime("%a")  # "Mon", "Tue"
    # Find scheduled classes for today
    scheduled_slots = (
        TimetableSlot.query.filter_by(faculty_id=faculty_id, day_of_week=day_code)
        .order_by(TimetableSlot.period_index)
        .all()
    )

    first_scheduled_start = scheduled_slots[0].start_time if scheduled_slots else "09:00"
    last_scheduled_end = scheduled_slots[-1].end_time if scheduled_slots else "16:30"

    # Check for approved leave notice
    leave = LeaveNotice.query.filter(
        LeaveNotice.faculty_id == faculty_id,
        LeaveNotice.date == target_date,
        LeaveNotice.status.in_(["SUBMITTED", "NOTIFIED"]),
    ).first()

    daily = FacultyDailyAttendance.query.filter_by(
        faculty_id=faculty_id, date=target_date
    ).first()

    if not daily:
        daily = FacultyDailyAttendance(
            faculty_id=faculty_id,
            date=target_date,
            scheduled_first_start=first_scheduled_start,
            scheduled_last_end=last_scheduled_end,
        )
        db.session.add(daily)

    daily.scheduled_first_start = first_scheduled_start
    daily.scheduled_last_end = last_scheduled_end

    if leave and not leave.start_time:
        # Full day leave
        daily.status = "ON_LEAVE"
        daily.computed_at = datetime.utcnow()
        db.session.flush()
        return daily

    # Check for approved event attendance request (On-Duty / Event OD)
    event_req = TeacherEventAttendanceRequest.query.filter(
        TeacherEventAttendanceRequest.faculty_id == faculty_id,
        TeacherEventAttendanceRequest.event_date == target_date,
        TeacherEventAttendanceRequest.status == "approved",
    ).first()

    if event_req:
        daily.status = "PRESENT"
        daily.scheduled_first_start = event_req.start_time or "09:00"
        daily.scheduled_last_end = event_req.end_time or "17:00"
        if not daily.work_duration_minutes or daily.work_duration_minutes == 0:
            daily.work_duration_minutes = 480
        daily.computed_at = datetime.utcnow()
        db.session.flush()
        return daily

    if not events:
        # No punch events yet
        # If past cutoff (e.g. past 11:00 AM on today, or past date) -> ABSENT
        now = datetime.now()
        if target_date < now.date() or (target_date == now.date() and now.hour >= 11):
            daily.status = "ABSENT"
        else:
            daily.status = "NOT_YET_MARKED"
        daily.first_in = None
        daily.last_out = None
        daily.work_duration_minutes = 0
        daily.computed_at = datetime.utcnow()
        db.session.flush()
        return daily

    first_in_event = next((e for e in events if e.event_type == "IN"), None)
    last_out_event = next((e for e in reversed(events) if e.event_type == "OUT"), None)

    daily.first_in = first_in_event.event_time if first_in_event else None
    daily.last_out = last_out_event.event_time if last_out_event else None

    # Calculate duration
    if daily.first_in and daily.last_out and daily.last_out > daily.first_in:
        daily.work_duration_minutes = int((daily.last_out - daily.first_in).total_seconds() // 60)
    elif daily.first_in:
        # Currently on campus
        now = datetime.now()
        if target_date == now.date():
            daily.work_duration_minutes = int((now - daily.first_in).total_seconds() // 60)
        else:
            daily.work_duration_minutes = 0
    else:
        daily.work_duration_minutes = 0

    # Determine status
    if not daily.first_in:
        daily.status = "ABSENT"
    else:
        # Parse scheduled start (e.g. "09:00" -> 09:15 cutoff with 15 min grace)
        try:
            h, m = map(int, first_scheduled_start.split(":"))
            cutoff_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=h, minute=m) + timedelta(minutes=15)
        except Exception:
            cutoff_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=9, minute=15)

        is_late = daily.first_in > cutoff_dt

        # Check half day: if punched out early (< 240 mins or before scheduled last class)
        is_half_day = False
        if daily.last_out:
            try:
                lh, lm = map(int, last_scheduled_end.split(":"))
                sched_end_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=lh, minute=lm) - timedelta(minutes=30)
                if daily.last_out < sched_end_dt or daily.work_duration_minutes < 240:
                    is_half_day = True
            except Exception:
                if daily.work_duration_minutes < 240:
                    is_half_day = True

        if is_half_day:
            daily.status = "HALF_DAY"
        elif is_late:
            daily.status = "LATE"
        else:
            daily.status = "PRESENT"

    daily.computed_at = datetime.utcnow()
    db.session.flush()
    return daily


@attendance_bp.post("/punch")
def record_punch():
    """
    Biometric Swipe / Punch endpoint.
    Payload:
      faculty_id: string (e.g. "FAC001" or "Dr. C VIDYARAJ")
      event_type: "IN" | "OUT"
      device_id:  string (default: "MOCK-DEVICE-01")
      timestamp:  ISO string (optional, defaults to server now)
    """
    data = request.get_json(force=True, silent=True) or {}
    faculty_input = data.get("faculty_id", "").strip()
    event_type = data.get("event_type", "").strip().upper()
    device_id = data.get("device_id", "MOCK-DEVICE-01").strip()
    ts_raw = data.get("timestamp")

    if not faculty_input:
        return jsonify({"error": "faculty_id is required"}), 400
    if event_type not in ["IN", "OUT"]:
        return jsonify({"error": "event_type must be 'IN' or 'OUT'"}), 400

    # Resolve faculty
    faculty = Faculty.query.filter_by(faculty_id=faculty_input).first()
    if not faculty:
        # Search by clean name or partial name
        faculty = Faculty.query.filter(
            (Faculty.name.ilike(faculty_input)) |
            (Faculty.name.ilike(f"%{faculty_input}%"))
        ).first()

    if not faculty:
        return jsonify({"error": f"Faculty '{faculty_input}' not recognized"}), 404

    if ts_raw:
        try:
            punch_time = datetime.fromisoformat(ts_raw.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            punch_time = datetime.now()
    else:
        punch_time = datetime.now()

    punch_date = punch_time.date()

    # Get last event for this faculty today
    start_dt = datetime.combine(punch_date, datetime.min.time())
    end_dt = datetime.combine(punch_date, datetime.max.time())

    last_event = (
        AttendanceEvent.query.filter(
            AttendanceEvent.faculty_id == faculty.faculty_id,
            AttendanceEvent.event_time >= start_dt,
            AttendanceEvent.event_time <= end_dt,
        )
        .order_by(AttendanceEvent.event_time.desc())
        .first()
    )

    # State validation
    if event_type == "IN":
        if last_event and last_event.event_type == "IN":
            return jsonify({
                "error": f"{faculty.name} is already punched IN at {last_event.event_time.strftime('%I:%M %p')}. Must punch OUT first.",
                "last_event": last_event.to_dict(),
            }), 409
    elif event_type == "OUT":
        if not last_event or last_event.event_type == "OUT":
            return jsonify({
                "error": f"{faculty.name} is not currently punched IN. Must punch IN before punching OUT.",
            }), 409

    # Record attendance event
    event = AttendanceEvent(
        faculty_id=faculty.faculty_id,
        event_type=event_type,
        event_time=punch_time,
        device_id=device_id,
        source="MOCK_DEVICE",
    )
    db.session.add(event)
    db.session.flush()

    daily = recompute_daily_attendance(faculty.faculty_id, punch_date)
    db.session.commit()

    faculty_map = _build_faculty_map()

    return jsonify({
        "message": f"Successfully punched {event_type} for {faculty.name}",
        "attendance_event": event.to_dict(faculty_map),
        "daily_attendance": daily.to_dict(faculty_map) if daily else None,
        "computed_status_today": daily.status if daily else "PRESENT",
    }), 201


@attendance_bp.get("/today")
def get_today_attendance():
    """
    Returns live attendance status for all faculty for today.
    Includes on-campus headcount, late arrivals, departures, etc.
    """
    date_str = request.args.get("date")
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except Exception:
            target_date = date.today()
    else:
        target_date = date.today()

    faculty_list = Faculty.query.order_by(Faculty.name).all()
    faculty_map = {f.faculty_id: f.name for f in faculty_list}

    # Ensure all faculty have a computed daily attendance row
    results = []
    counts = {
        "total_faculty": len(faculty_list),
        "on_campus": 0,
        "present": 0,
        "late": 0,
        "half_day": 0,
        "on_leave": 0,
        "absent": 0,
        "not_marked": 0,
    }

    for f in faculty_list:
        daily = FacultyDailyAttendance.query.filter_by(
            faculty_id=f.faculty_id, date=target_date
        ).first()

        if not daily:
            daily = recompute_daily_attendance(f.faculty_id, target_date)

        d_dict = daily.to_dict(faculty_map) if daily else {
            "faculty_id": f.faculty_id,
            "faculty_name": f.name,
            "date": target_date.isoformat(),
            "first_in": None,
            "first_in_time": None,
            "last_out": None,
            "last_out_time": None,
            "status": "NOT_YET_MARKED",
            "is_on_campus": False,
            "work_duration_hours": 0.0,
        }

        status = d_dict.get("status", "NOT_YET_MARKED")
        if d_dict.get("is_on_campus"):
            counts["on_campus"] += 1

        if status == "PRESENT":
            counts["present"] += 1
        elif status == "LATE":
            counts["late"] += 1
        elif status == "HALF_DAY":
            counts["half_day"] += 1
        elif status == "ON_LEAVE":
            counts["on_leave"] += 1
        elif status == "ABSENT":
            counts["absent"] += 1
        else:
            counts["not_marked"] += 1

        results.append(d_dict)

    # Recent 25 raw events for live activity stream
    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = datetime.combine(target_date, datetime.max.time())
    recent_events = (
        AttendanceEvent.query.filter(
            AttendanceEvent.event_time >= start_dt,
            AttendanceEvent.event_time <= end_dt,
        )
        .order_by(AttendanceEvent.event_time.desc())
        .limit(25)
        .all()
    )

    return jsonify({
        "date": target_date.isoformat(),
        "summary": counts,
        "faculty_attendance": results,
        "recent_events": [e.to_dict(faculty_map) for e in recent_events],
    })


@attendance_bp.get("/faculty/<faculty_id>")
def get_faculty_attendance_history(faculty_id):
    """Returns monthly history and summary metrics for an individual faculty member."""
    faculty = Faculty.query.filter_by(faculty_id=faculty_id).first()
    if not faculty:
        faculty = Faculty.query.filter(
            (Faculty.id == int(faculty_id) if faculty_id.isdigit() else False) |
            (Faculty.name.ilike(f"%{faculty_id}%"))
        ).first()

    if not faculty:
        return jsonify({"error": "Faculty not found"}), 404

    month = request.args.get("month")  # "2025-02"
    if month:
        try:
            year, m = map(int, month.split("-"))
            start_date = date(year, m, 1)
            # end of month
            if m == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, m + 1, 1) - timedelta(days=1)
        except Exception:
            start_date = date.today().replace(day=1)
            end_date = date.today()
    else:
        # Default: last 30 days
        end_date = date.today()
        start_date = end_date - timedelta(days=30)

    records = (
        FacultyDailyAttendance.query.filter(
            FacultyDailyAttendance.faculty_id == faculty.faculty_id,
            FacultyDailyAttendance.date >= start_date,
            FacultyDailyAttendance.date <= end_date,
        )
        .order_by(FacultyDailyAttendance.date.desc())
        .all()
    )

    faculty_map = _build_faculty_map()

    total_days = len(records)
    present_days = sum(1 for r in records if r.status in ["PRESENT", "LATE"])
    late_days = sum(1 for r in records if r.status == "LATE")
    leave_days = sum(1 for r in records if r.status == "ON_LEAVE")
    half_days = sum(1 for r in records if r.status == "HALF_DAY")
    absent_days = sum(1 for r in records if r.status == "ABSENT")

    attendance_pct = round((present_days / total_days * 100), 1) if total_days > 0 else 100.0

    # Today's status
    today_rec = FacultyDailyAttendance.query.filter_by(
        faculty_id=faculty.faculty_id, date=date.today()
    ).first()

    return jsonify({
        "faculty": faculty.to_dict(),
        "date_range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "metrics": {
            "total_days": total_days,
            "present_days": present_days,
            "late_days": late_days,
            "half_days": half_days,
            "leave_days": leave_days,
            "absent_days": absent_days,
            "attendance_percentage": attendance_pct,
        },
        "today": today_rec.to_dict(faculty_map) if today_rec else None,
        "history": [r.to_dict(faculty_map) for r in records],
    })


@attendance_bp.post("/manual")
def manual_attendance_override():
    """Admin manual override of punch or status."""
    data = request.get_json(force=True, silent=True) or {}
    faculty_id = data.get("faculty_id")
    date_str = data.get("date", date.today().isoformat())
    event_type = data.get("event_type", "IN")
    time_str = data.get("time_str")  # "09:30"
    admin_note = data.get("admin_note", "Admin manual correction")

    if not faculty_id:
        return jsonify({"error": "faculty_id is required"}), 400

    faculty = Faculty.query.filter_by(faculty_id=faculty_id).first()
    if not faculty:
        return jsonify({"error": "Faculty not found"}), 404

    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()

    if time_str:
        h, m = map(int, time_str.split(":"))
        event_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=h, minute=m)
    else:
        event_dt = datetime.now()

    event = AttendanceEvent(
        faculty_id=faculty.faculty_id,
        event_type=event_type,
        event_time=event_dt,
        device_id="ADMIN-CONSOLE",
        source="MANUAL_ADMIN",
        admin_note=admin_note,
    )
    db.session.add(event)
    db.session.flush()

    daily = recompute_daily_attendance(faculty.faculty_id, target_date)
    db.session.commit()

    faculty_map = _build_faculty_map()
    return jsonify({
        "message": "Manual attendance record added successfully",
        "event": event.to_dict(faculty_map),
        "daily": daily.to_dict(faculty_map),
    })


@attendance_bp.post("/reset-demo")
def reset_demo():
    """Reset today's attendance events and computed records for fresh demo testing."""
    today = date.today()
    start_dt = datetime.combine(today, datetime.min.time())
    end_dt = datetime.combine(today, datetime.max.time())

    AttendanceEvent.query.filter(
        AttendanceEvent.event_time >= start_dt,
        AttendanceEvent.event_time <= end_dt,
    ).delete()

    FacultyDailyAttendance.query.filter_by(date=today).delete()
    db.session.commit()

    return jsonify({"message": "Today's attendance records reset successfully."})


# ══════════════════════════════════════════════════════════════════════════════
# Teacher Event Attendance Requests & Certificate Proofs
# ══════════════════════════════════════════════════════════════════════════════

@attendance_bp.post("/event-requests")
def submit_event_attendance_request():
    """
    Teacher submits a request to grant attendance for a day they attended
    an academic event/course/FDP/workshop. Certificate upload is mandatory.
    """
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")
    user_id = request.headers.get("X-User-Id", "")

    # Retrieve form data
    faculty_id = (request.form.get("faculty_id") or linked_id or user_id).strip()
    course_name = (request.form.get("course_name") or request.form.get("event_name", "")).strip()
    event_type = (request.form.get("event_type") or "Workshop").strip()
    organizer = (request.form.get("organizer") or "").strip()
    event_date_raw = (request.form.get("event_date") or "").strip()
    start_time = (request.form.get("start_time") or "09:00").strip()
    end_time = (request.form.get("end_time") or "17:00").strip()
    is_full_day_raw = request.form.get("is_full_day", "true")
    is_full_day = str(is_full_day_raw).lower() in ["true", "1", "yes"]
    description = (request.form.get("description") or "").strip()

    # Security check: Teacher can only request for themselves
    if role != "admin" and linked_id and faculty_id != linked_id:
        return jsonify({"error": "You can only submit event attendance requests for your own profile"}), 403

    if not faculty_id:
        return jsonify({"error": "faculty_id is required"}), 400

    if not course_name:
        return jsonify({"error": "Course / Event name is required"}), 400

    if not event_date_raw:
        return jsonify({"error": "Event date is required"}), 400

    try:
        event_date = datetime.strptime(event_date_raw, "%Y-%m-%d").date()
    except Exception:
        return jsonify({"error": "Invalid event_date format. Use YYYY-MM-DD"}), 400

    # Resolve faculty
    faculty = Faculty.query.filter_by(faculty_id=faculty_id).first()
    if not faculty:
        faculty = Faculty.query.filter(
            (Faculty.name.ilike(faculty_id)) | (Faculty.name.ilike(f"%{faculty_id}%"))
        ).first()

    if not faculty:
        return jsonify({"error": f"Faculty '{faculty_id}' not found"}), 404

    # File upload validation: Certificate is mandatory
    if "certificate" not in request.files:
        return jsonify({"error": "Certificate proof is required. Please upload a certificate file (PDF, PNG, JPG, WEBP)."}), 400

    file = request.files["certificate"]
    if not file or not file.filename:
        return jsonify({"error": "Certificate proof file cannot be empty. Please select a valid file."}), 400

    original_filename = file.filename
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_PROOF_EXTENSIONS:
        return jsonify({
            "error": f"Invalid file type '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_PROOF_EXTENSIONS))}"
        }), 400

    # Save certificate file with unique safe name
    unique_suffix = uuid.uuid4().hex[:8]
    stored_filename = f"cert_{faculty.faculty_id}_{event_date.strftime('%Y%m%d')}_{unique_suffix}{ext}"
    proofs_dir = _get_proofs_dir()
    filepath = os.path.join(proofs_dir, stored_filename)
    try:
        file.save(filepath)
    except Exception as e:
        return jsonify({"error": f"Failed to save certificate file: {str(e)}"}), 500

    mime_type = file.mimetype or ("application/pdf" if ext == ".pdf" else f"image/{ext.lstrip('.')}")

    # Create request record
    event_req = TeacherEventAttendanceRequest(
        faculty_id=faculty.faculty_id,
        course_name=course_name,
        event_type=event_type,
        organizer=organizer,
        event_date=event_date,
        start_time=start_time,
        end_time=end_time,
        is_full_day=is_full_day,
        description=description,
        certificate_filename=stored_filename,
        certificate_original_name=original_filename,
        certificate_file_type=mime_type,
        status="pending",
        requested_by=user_id or faculty.faculty_id,
    )
    db.session.add(event_req)
    db.session.commit()

    faculty_map = _build_faculty_map()
    return jsonify({
        "message": "Event attendance request submitted successfully with certificate proof. Awaiting administrator review.",
        "request": event_req.to_dict(faculty_map),
    }), 201


@attendance_bp.get("/event-requests")
def list_event_attendance_requests():
    """
    List event attendance requests.
    Teachers only see their own requests; Admins see all requests.
    Supports filtering by status (all, pending, approved, rejected) and faculty_id.
    """
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")
    user_id = request.headers.get("X-User-Id", "")

    status_filter = request.args.get("status", "all").strip().lower()
    faculty_filter = request.args.get("faculty_id", "").strip()

    query = TeacherEventAttendanceRequest.query

    # Enforce role boundary: Teachers only see their own requests
    if role != "admin":
        own_id = linked_id or user_id
        if own_id:
            query = query.filter_by(faculty_id=own_id)
    elif faculty_filter:
        query = query.filter_by(faculty_id=faculty_filter)

    if status_filter and status_filter != "all":
        query = query.filter_by(status=status_filter)

    items = query.order_by(TeacherEventAttendanceRequest.created_at.desc()).all()
    faculty_map = _build_faculty_map()

    # Compute summary counts
    base_query = TeacherEventAttendanceRequest.query
    if role != "admin" and (linked_id or user_id):
        base_query = base_query.filter_by(faculty_id=linked_id or user_id)

    all_items = base_query.all()
    pending_count = sum(1 for x in all_items if x.status == "pending")
    approved_count = sum(1 for x in all_items if x.status == "approved")
    rejected_count = sum(1 for x in all_items if x.status == "rejected")

    return jsonify({
        "total": len(items),
        "pending_count": pending_count,
        "approved_count": approved_count,
        "rejected_count": rejected_count,
        "requests": [item.to_dict(faculty_map) for item in items],
    })


@attendance_bp.get("/event-requests/<int:req_id>")
def get_event_attendance_request(req_id):
    """Retrieve a single event attendance request."""
    req_item = TeacherEventAttendanceRequest.query.get(req_id)
    if not req_item:
        return jsonify({"error": "Event attendance request not found"}), 404

    faculty_map = _build_faculty_map()
    return jsonify(req_item.to_dict(faculty_map))


@attendance_bp.post("/event-requests/<int:req_id>/approve")
def approve_event_attendance_request(req_id):
    """
    Admin approves the event attendance request:
      1. Grants attendance for that day (FacultyDailyAttendance status -> PRESENT).
      2. Automatically appends the course/event to the teacher's certifications list.
    """
    role = request.headers.get("X-User-Role", "").lower()
    if role != "admin":
        return jsonify({"error": "Administrator privilege required to approve event attendance requests"}), 403

    req_item = TeacherEventAttendanceRequest.query.get(req_id)
    if not req_item:
        return jsonify({"error": "Event attendance request not found"}), 404

    if req_item.status == "approved":
        return jsonify({"message": "Request is already approved.", "request": req_item.to_dict(_build_faculty_map())}), 200

    data = request.get_json(force=True, silent=True) or {}
    admin_remarks = data.get("admin_remarks") or data.get("remarks") or "Approved by administrator"
    admin_id = request.headers.get("X-User-Id", "admin")

    # Update request state
    req_item.status = "approved"
    req_item.reviewed_by = admin_id
    req_item.reviewed_at = datetime.utcnow()
    req_item.admin_remarks = admin_remarks

    # 1. AUTOMATION: Grant Attendance for that day
    daily = FacultyDailyAttendance.query.filter_by(
        faculty_id=req_item.faculty_id, date=req_item.event_date
    ).first()

    if not daily:
        daily = FacultyDailyAttendance(
            faculty_id=req_item.faculty_id,
            date=req_item.event_date,
        )
        db.session.add(daily)

    daily.status = "PRESENT"
    daily.scheduled_first_start = req_item.start_time or "09:00"
    daily.scheduled_last_end = req_item.end_time or "17:00"

    # Compute timestamps for audit punch events
    start_h, start_m = 9, 0
    end_h, end_m = 17, 0
    if req_item.start_time and ":" in req_item.start_time:
        try:
            start_h, start_m = map(int, req_item.start_time.split(":"))
        except Exception:
            pass
    if req_item.end_time and ":" in req_item.end_time:
        try:
            end_h, end_m = map(int, req_item.end_time.split(":"))
        except Exception:
            pass

    event_start_dt = datetime.combine(req_item.event_date, time(start_h, start_m))
    event_end_dt = datetime.combine(req_item.event_date, time(end_h, end_m))

    daily.first_in = event_start_dt
    daily.last_out = event_end_dt
    calc_duration = int((event_end_dt - event_start_dt).total_seconds() // 60)
    daily.work_duration_minutes = max(calc_duration, 480)
    daily.computed_at = datetime.utcnow()

    # Record biometric AttendanceEvent audit records
    ev_in = AttendanceEvent(
        faculty_id=req_item.faculty_id,
        event_type="IN",
        event_time=event_start_dt,
        device_id="EVENT-APPROVAL",
        source="EVENT_ATTENDANCE",
        admin_note=f"Granted via Event Attendance Approval: {req_item.course_name} ({req_item.organizer or 'Event'})",
    )
    ev_out = AttendanceEvent(
        faculty_id=req_item.faculty_id,
        event_type="OUT",
        event_time=event_end_dt,
        device_id="EVENT-APPROVAL",
        source="EVENT_ATTENDANCE",
        admin_note=f"Granted via Event Attendance Approval: {req_item.course_name}",
    )
    db.session.add(ev_in)
    db.session.add(ev_out)

    # 2. AUTOMATION: Automatically add to teacher's certifications
    faculty = Faculty.query.filter_by(faculty_id=req_item.faculty_id).first()
    added_cert = None
    if faculty:
        current_certs = []
        if faculty.certifications:
            try:
                loaded = json.loads(faculty.certifications)
                current_certs = loaded if isinstance(loaded, list) else [loaded]
            except Exception:
                current_certs = [faculty.certifications]

        # Format certification text
        org_label = f" — {req_item.organizer}" if req_item.organizer else ""
        year_label = req_item.event_date.strftime("%Y")
        cert_title = f"{req_item.course_name}{org_label} ({year_label})"

        # Check if already present to avoid duplicates
        already_exists = any(req_item.course_name.lower() in str(c).lower() for c in current_certs)
        if not already_exists:
            current_certs.append(cert_title)
            faculty.certifications = json.dumps(current_certs)
            added_cert = cert_title

    db.session.commit()

    faculty_map = _build_faculty_map()
    return jsonify({
        "message": f"Event request approved! Attendance granted for {req_item.event_date.strftime('%Y-%m-%d')} as PRESENT, and certification added to teacher profile.",
        "request": req_item.to_dict(faculty_map),
        "daily_attendance": daily.to_dict(faculty_map),
        "added_certification": added_cert,
        "faculty_certifications": json.loads(faculty.certifications) if (faculty and faculty.certifications) else [],
    }), 200


@attendance_bp.post("/event-requests/<int:req_id>/reject")
def reject_event_attendance_request(req_id):
    """Admin rejects the event attendance request."""
    role = request.headers.get("X-User-Role", "").lower()
    if role != "admin":
        return jsonify({"error": "Administrator privilege required to reject event attendance requests"}), 403

    req_item = TeacherEventAttendanceRequest.query.get(req_id)
    if not req_item:
        return jsonify({"error": "Event attendance request not found"}), 404

    data = request.get_json(force=True, silent=True) or {}
    reason = data.get("rejection_reason") or data.get("admin_remarks") or "Rejected by administrator"
    admin_id = request.headers.get("X-User-Id", "admin")

    req_item.status = "rejected"
    req_item.reviewed_by = admin_id
    req_item.reviewed_at = datetime.utcnow()
    req_item.admin_remarks = reason

    db.session.commit()
    faculty_map = _build_faculty_map()
    return jsonify({
        "message": "Event attendance request rejected.",
        "request": req_item.to_dict(faculty_map),
    }), 200


@attendance_bp.delete("/event-requests/<int:req_id>")
def cancel_event_attendance_request(req_id):
    """Teacher cancels their own pending event attendance request."""
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")
    user_id = request.headers.get("X-User-Id", "")

    req_item = TeacherEventAttendanceRequest.query.get(req_id)
    if not req_item:
        return jsonify({"error": "Event attendance request not found"}), 404

    # Security check: Teacher can only cancel their own request
    if role != "admin" and linked_id and req_item.faculty_id != linked_id:
        return jsonify({"error": "You can only withdraw your own attendance requests"}), 403

    if req_item.status != "pending":
        return jsonify({"error": f"Cannot cancel request with status '{req_item.status}'"}), 400

    req_item.status = "cancelled"
    db.session.commit()
    return jsonify({"message": "Event attendance request cancelled successfully."}), 200


@attendance_bp.get("/proofs/<path:filename>")
def serve_attendance_proof(filename):
    """Serve uploaded event attendance certificate proof for inline preview or download."""
    proofs_dir = _get_proofs_dir()
    safe_filename = secure_filename(os.path.basename(filename))
    filepath = os.path.join(proofs_dir, safe_filename)

    if not os.path.exists(filepath):
        return jsonify({"error": "Certificate file not found"}), 404

    return send_from_directory(proofs_dir, safe_filename)

