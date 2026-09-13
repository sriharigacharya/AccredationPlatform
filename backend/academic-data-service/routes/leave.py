"""
Leave Management & Student Absence Notification Routes — AcademiQ
Handles:
  - POST   /leave/preview-affected   (live preview of affected classes & students)
  - POST   /leave                    (submit leave & dispatch notifications)
  - DELETE /leave/<id>               (cancel leave & retract notifications)
  - POST   /leave/<id>/substitute    (assign substitute faculty & notify students)
  - GET    /leave                    (list active/past leaves)
  - GET    /notifications/student/<id> (student's class schedule alerts)
  - POST   /notifications/<id>/read  (mark notification read)
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from models import (
    db,
    Faculty,
    Subject,
    Section,
    TimetableSlot,
    StudentEnrollment,
    Student,
    LeaveNotice,
    ScheduleNotification,
    FacultyDailyAttendance,
)
from routes.attendance import recompute_daily_attendance

leave_bp = Blueprint("leave", __name__)


def _build_faculty_map():
    faculty = Faculty.query.all()
    return {f.faculty_id: f.name for f in faculty}


def find_overlapping_slots(faculty_id, target_date, start_time=None, end_time=None, term="2024-25-EVEN"):
    """
    Finds TimetableSlot records for a faculty member on target_date's day of week
    that overlap with the optional [start_time, end_time] window.
    """
    day_code = target_date.strftime("%a")  # "Mon", "Tue", etc.

    query = TimetableSlot.query.filter_by(
        faculty_id=faculty_id,
        day_of_week=day_code,
        academic_term=term,
    )

    slots = query.order_by(TimetableSlot.period_index).all()

    if not start_time and not end_time:
        # Full day leave -> all slots for this day
        return slots

    overlapping = []
    for s in slots:
        # Check overlap: max(start1, start2) < min(end1, end2)
        s_start = s.start_time
        s_end = s.end_time
        win_start = start_time or "00:00"
        win_end = end_time or "23:59"

        if max(s_start, win_start) < min(s_end, win_end):
            overlapping.append(s)

    return overlapping


def resolve_affected_students_for_slot(slot, term="2024-25-EVEN"):
    """Resolves all student IDs enrolled in the section for a slot."""
    # First check StudentEnrollment
    enrollments = StudentEnrollment.query.filter_by(
        section_id=slot.section_id, academic_term=term
    ).all()

    student_ids = set(e.student_id for e in enrollments)

    # Fallback or supplement from Student table if enrollment is sparse
    if not student_ids and slot.section:
        sem_int = int(slot.section.semester) if slot.section.semester.isdigit() else 3
        sec_lbl = slot.section.section_label
        direct_students = Student.query.filter_by(section=sec_lbl, semester=sem_int).all()
        for ds in direct_students:
            student_ids.add(ds.student_id)

    return list(student_ids)


@leave_bp.post("/preview-affected")
def preview_affected():
    """
    Calculates affected slots and enrolled student counts prior to confirming leave.
    Payload: { faculty_id, date, start_time?, end_time?, term? }
    """
    data = request.get_json(force=True, silent=True) or {}
    faculty_id = data.get("faculty_id")
    date_str = data.get("date")
    start_time = data.get("start_time") or None
    end_time = data.get("end_time") or None
    term = data.get("term", "2024-25-EVEN")

    if not faculty_id or not date_str:
        return jsonify({"error": "faculty_id and date are required"}), 400

    faculty = Faculty.query.filter_by(faculty_id=faculty_id).first()
    if not faculty:
        faculty = Faculty.query.filter(Faculty.name.ilike(f"%{faculty_id}%")).first()
    if not faculty:
        return jsonify({"error": "Faculty not found"}), 404

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400

    slots = find_overlapping_slots(faculty.faculty_id, target_date, start_time, end_time, term)
    faculty_map = _build_faculty_map()

    total_affected_students = set()
    slot_details = []

    for s in slots:
        stu_ids = resolve_affected_students_for_slot(s, term)
        total_affected_students.update(stu_ids)
        s_dict = s.to_dict(faculty_map)
        s_dict["affected_student_count"] = len(stu_ids)
        slot_details.append(s_dict)

    return jsonify({
        "faculty": faculty.to_dict(),
        "date": target_date.isoformat(),
        "date_display": target_date.strftime("%a, %d %b %Y"),
        "is_full_day": not (start_time and end_time),
        "time_window": f"{start_time} - {end_time}" if (start_time and end_time) else "Full Day",
        "affected_slots_count": len(slot_details),
        "affected_slots": slot_details,
        "affected_students_count": len(total_affected_students),
    })


@leave_bp.post("")
def submit_leave():
    """
    Submits a leave notice and dispatches targeted notifications to affected students.
    Payload: { faculty_id, date, start_time?, end_time?, reason, created_by?, term? }
    """
    data = request.get_json(force=True, silent=True) or {}
    faculty_id = data.get("faculty_id")
    date_str = data.get("date")
    start_time = data.get("start_time") or None
    end_time = data.get("end_time") or None
    reason = data.get("reason", "Personal leave")
    created_by = data.get("created_by", faculty_id or "admin")
    term = data.get("term", "2024-25-EVEN")

    if not faculty_id or not date_str:
        return jsonify({"error": "faculty_id and date are required"}), 400

    faculty = Faculty.query.filter_by(faculty_id=faculty_id).first()
    if not faculty:
        faculty = Faculty.query.filter(Faculty.name.ilike(f"%{faculty_id}%")).first()
    if not faculty:
        return jsonify({"error": "Faculty not found"}), 404

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400

    # Create Leave Notice
    leave = LeaveNotice(
        faculty_id=faculty.faculty_id,
        date=target_date,
        start_time=start_time,
        end_time=end_time,
        reason=reason,
        status="NOTIFIED",
        created_by=created_by,
    )
    db.session.add(leave)
    db.session.flush()

    # Recompute daily attendance for that faculty
    recompute_daily_attendance(faculty.faculty_id, target_date)

    # Find overlapping slots and generate student notifications
    slots = find_overlapping_slots(faculty.faculty_id, target_date, start_time, end_time, term)
    date_display = target_date.strftime("%a, %d %b")

    is_urgent = target_date <= date.today() + timedelta(days=1)
    notif_count = 0

    for s in slots:
        subject_name = s.subject.name if s.subject else (s.raw_text or "Class")
        room_info = f", Room {s.room}" if s.room else ""
        time_info = f"{s.start_time}–{s.end_time}"
        sec_info = f"Sem {s.section.semester}-{s.section.section_label}" if s.section else ""

        title = f"Class Cancelled: {subject_name} ({sec_info})"
        message = (
            f"Heads up: {faculty.name} is on leave on {date_display}. "
            f"Your {subject_name} session ({time_info}{room_info}) will not be held. "
            f"Please check your schedule for updates."
        )

        student_ids = resolve_affected_students_for_slot(s, term)
        for sid in student_ids:
            notif = ScheduleNotification(
                student_id=sid,
                leave_notice_id=leave.id,
                timetable_slot_id=s.id,
                title=title,
                message=message,
                channel="IN_APP",
                is_urgent=is_urgent,
            )
            db.session.add(notif)
            notif_count += 1

    db.session.commit()
    faculty_map = _build_faculty_map()

    return jsonify({
        "message": f"Leave notice submitted. Sent {notif_count} student notifications.",
        "leave": leave.to_dict(faculty_map),
        "notifications_sent": notif_count,
        "affected_classes": len(slots),
    }), 201


@leave_bp.delete("/<int:leave_id>")
def cancel_leave(leave_id):
    """
    Cancels a leave notice and dispatches a retraction/correction notice to students.
    """
    leave = LeaveNotice.query.get(leave_id)
    if not leave:
        return jsonify({"error": "Leave notice not found"}), 404

    leave.status = "CANCELLED"
    leave.cancelled_at = datetime.utcnow()

    faculty = Faculty.query.filter_by(faculty_id=leave.faculty_id).first()
    fac_name = faculty.name if faculty else leave.faculty_id
    date_display = leave.date.strftime("%a, %d %b")

    # Send correction notification to all students who were alerted
    existing_notifs = ScheduleNotification.query.filter_by(leave_notice_id=leave.id).all()
    notified_students = set(n.student_id for n in existing_notifs)

    retraction_count = 0
    for sid in notified_students:
        corr_notif = ScheduleNotification(
            student_id=sid,
            leave_notice_id=leave.id,
            timetable_slot_id=None,
            title=f"Schedule Update: Class Restored",
            message=(
                f"Notice: {fac_name}'s leave on {date_display} has been cancelled. "
                f"Your regular classes will proceed as scheduled."
            ),
            channel="IN_APP",
            is_urgent=False,
            is_retracted=True,
        )
        db.session.add(corr_notif)
        retraction_count += 1

    # Recompute faculty daily attendance back
    recompute_daily_attendance(leave.faculty_id, leave.date)
    db.session.commit()

    return jsonify({
        "message": "Leave notice cancelled and students notified of class restoration.",
        "retraction_notifications_sent": retraction_count,
    })


@leave_bp.post("/<int:leave_id>/substitute")
def assign_substitute(leave_id):
    """
    Assigns a substitute teacher for the leave period and alerts students.
    Payload: { substitute_faculty_id, notes? }
    """
    leave = LeaveNotice.query.get(leave_id)
    if not leave:
        return jsonify({"error": "Leave notice not found"}), 404

    data = request.get_json(force=True, silent=True) or {}
    sub_id = data.get("substitute_faculty_id")
    if not sub_id:
        return jsonify({"error": "substitute_faculty_id is required"}), 400

    sub_faculty = Faculty.query.filter_by(faculty_id=sub_id).first()
    if not sub_faculty:
        sub_faculty = Faculty.query.filter(Faculty.name.ilike(f"%{sub_id}%")).first()

    sub_name = sub_faculty.name if sub_faculty else sub_id

    leave.substitute_faculty_id = sub_faculty.faculty_id if sub_faculty else sub_id
    leave.substitute_faculty_name = sub_name

    faculty = Faculty.query.filter_by(faculty_id=leave.faculty_id).first()
    fac_name = faculty.name if faculty else leave.faculty_id
    date_display = leave.date.strftime("%a, %d %b")

    # Send update notifications to affected students
    existing_notifs = ScheduleNotification.query.filter_by(leave_notice_id=leave.id).all()
    notified_students = set(n.student_id for n in existing_notifs)

    sub_notif_count = 0
    for sid in notified_students:
        notif = ScheduleNotification(
            student_id=sid,
            leave_notice_id=leave.id,
            timetable_slot_id=None,
            title=f"Substitute Assigned: {sub_name}",
            message=(
                f"Update for {date_display}: {fac_name} is on leave. "
                f"Your session will now be covered by {sub_name}. "
                f"Please report to class at the scheduled time."
            ),
            channel="IN_APP",
            is_urgent=True,
        )
        db.session.add(notif)
        sub_notif_count += 1

    db.session.commit()
    faculty_map = _build_faculty_map()

    return jsonify({
        "message": f"Substitute {sub_name} assigned. Sent {sub_notif_count} update notices.",
        "leave": leave.to_dict(faculty_map),
    })


@leave_bp.get("")
def list_leaves():
    """Returns list of leave notices."""
    faculty_id = request.args.get("faculty_id")
    status = request.args.get("status")

    query = LeaveNotice.query
    if faculty_id:
        query = query.filter_by(faculty_id=faculty_id)
    if status:
        query = query.filter_by(status=status)

    leaves = query.order_by(LeaveNotice.date.desc()).all()
    faculty_map = _build_faculty_map()

    return jsonify({
        "total": len(leaves),
        "leaves": [l.to_dict(faculty_map) for l in leaves],
    })


@leave_bp.get("/notifications/student/<student_id>")
def get_student_notifications(student_id):
    """
    Returns schedule notifications for a student.
    Query parameter ?today=true returns alerts active today.
    """
    is_today_only = request.args.get("today", "false").lower() == "true"

    query = ScheduleNotification.query.filter_by(student_id=student_id)

    if is_today_only:
        today = date.today()
        # Find leaves happening today
        query = query.join(LeaveNotice).filter(LeaveNotice.date == today)

    notifs = query.order_by(ScheduleNotification.sent_at.desc()).limit(50).all()
    unread_count = sum(1 for n in notifs if not n.read_at)

    return jsonify({
        "student_id": student_id,
        "unread_count": unread_count,
        "notifications": [n.to_dict() for n in notifs],
    })


@leave_bp.post("/notifications/<int:notif_id>/read")
def mark_notification_read(notif_id):
    """Marks a single notification as read."""
    notif = ScheduleNotification.query.get(notif_id)
    if not notif:
        return jsonify({"error": "Notification not found"}), 404

    notif.read_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"message": "Marked as read", "notification": notif.to_dict()})


@leave_bp.post("/notifications/student/<student_id>/mark-all-read")
def mark_all_student_notifications_read(student_id):
    """Marks all unread notifications for a student as read."""
    ScheduleNotification.query.filter_by(student_id=student_id, read_at=None).update(
        {"read_at": datetime.utcnow()}
    )
    db.session.commit()

    return jsonify({"message": "All notifications marked as read."})
