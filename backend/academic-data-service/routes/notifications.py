"""
Schedule Notifications Routes — AcademiQ
Provides endpoints for students to retrieve class absence/reschedule notices,
mark notifications as read, and power real-time banners on student portals.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, date
from models import db, ScheduleNotification, LeaveNotice

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.get("/student/<student_id>")
def get_student_notifications(student_id):
    """
    Returns schedule notifications for a student.
    Query parameter ?today=true returns alerts active today.
    """
    is_today_only = request.args.get("today", "false").lower() == "true"

    query = ScheduleNotification.query.filter_by(student_id=student_id)

    if is_today_only:
        today = date.today()
        query = query.join(LeaveNotice).filter(LeaveNotice.date == today)

    notifs = query.order_by(ScheduleNotification.sent_at.desc()).limit(50).all()
    unread_count = sum(1 for n in notifs if not n.read_at)

    return jsonify({
        "student_id": student_id,
        "unread_count": unread_count,
        "notifications": [n.to_dict() for n in notifs],
    })


@notifications_bp.post("/<int:notif_id>/read")
def mark_notification_read(notif_id):
    """Marks a single notification as read."""
    notif = ScheduleNotification.query.get(notif_id)
    if not notif:
        return jsonify({"error": "Notification not found"}), 404

    notif.read_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"message": "Marked as read", "notification": notif.to_dict()})


@notifications_bp.post("/student/<student_id>/mark-all-read")
def mark_all_student_notifications_read(student_id):
    """Marks all unread notifications for a student as read."""
    ScheduleNotification.query.filter_by(student_id=student_id, read_at=None).update(
        {"read_at": datetime.utcnow()}
    )
    db.session.commit()

    return jsonify({"message": "All notifications marked as read."})
