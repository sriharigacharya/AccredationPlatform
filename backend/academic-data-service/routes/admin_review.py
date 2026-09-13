"""
Admin Review Queue Routes — AcademiQ
Allows Admins to:
  - Review and confirm unverified subject codes from the timetable legend
  - Inspect ingestion warnings (unassigned faculty, unmapped raw slots)
  - Manually update a subject code/name across timetable slots
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db, Subject, IngestionWarning, TimetableSlot

admin_review_bp = Blueprint("admin_review", __name__)


@admin_review_bp.get("/legend")
def list_legend_items():
    """Lists subject legend items, filterable by confirmed status."""
    is_confirmed = request.args.get("confirmed")
    query = Subject.query

    if is_confirmed is not None:
        val = is_confirmed.lower() == "true"
        query = query.filter_by(is_confirmed=val)

    subjects = query.order_by(Subject.is_confirmed, Subject.code).all()

    # Total counts
    total = len(subjects)
    confirmed_count = sum(1 for s in subjects if s.is_confirmed)
    pending_count = total - confirmed_count

    return jsonify({
        "total": total,
        "confirmed_count": confirmed_count,
        "pending_count": pending_count,
        "subjects": [s.to_dict() for s in subjects],
    })


@admin_review_bp.put("/legend/<int:subject_id>")
def confirm_subject(subject_id):
    """Admin confirms or edits a subject name."""
    subj = Subject.query.get(subject_id)
    if not subj:
        return jsonify({"error": "Subject not found"}), 404

    data = request.get_json(force=True, silent=True) or {}
    new_name = data.get("name")
    if new_name:
        subj.name = new_name.strip()
    subj.is_confirmed = True

    db.session.commit()
    return jsonify({
        "message": f"Subject '{subj.code}' confirmed as '{subj.name}'.",
        "subject": subj.to_dict(),
    })


@admin_review_bp.get("/warnings")
def list_ingestion_warnings():
    """Lists unresolved timetable ingestion warnings."""
    resolved = request.args.get("resolved")
    query = IngestionWarning.query

    if resolved is not None:
        val = resolved.lower() == "true"
        query = query.filter_by(is_resolved=val)

    warnings = query.order_by(IngestionWarning.created_at.desc()).all()

    return jsonify({
        "total": len(warnings),
        "unresolved_count": sum(1 for w in warnings if not w.is_resolved),
        "warnings": [w.to_dict() for w in warnings],
    })


@admin_review_bp.put("/warnings/<int:warning_id>/resolve")
def resolve_warning(warning_id):
    """Marks an ingestion warning as resolved."""
    w = IngestionWarning.query.get(warning_id)
    if not w:
        return jsonify({"error": "Warning not found"}), 404

    data = request.get_json(force=True, silent=True) or {}
    w.is_resolved = True
    w.resolved_by = data.get("resolved_by", "admin")

    db.session.commit()
    return jsonify({"message": "Warning resolved.", "warning": w.to_dict()})
