"""Parent record routes."""

from flask import Blueprint, request, jsonify, current_app
from models import db, ParentRecord

parents_bp = Blueprint("parents", __name__)


def _is_admin(request_role: str) -> bool:
    return request_role == "admin"


@parents_bp.get("/<student_id>")
def get_parent(student_id):
    """
    GET /parents/:student_id
    Headers: X-User-Role (set by gateway)
    Teacher sees masked number; admin sees full number.
    """
    role   = request.headers.get("X-User-Role", "teacher")
    record = ParentRecord.query.filter_by(student_id=student_id).first_or_404()
    return jsonify(record.to_dict(mask_number=not _is_admin(role)))


@parents_bp.post("/")
def create_or_update_parent():
    """POST /parents — create or update parent record for a student."""
    data = request.get_json(force=True) or {}
    sid  = data.get("student_id")
    if not sid:
        return jsonify({"error": "student_id is required"}), 400

    record = ParentRecord.query.filter_by(student_id=sid).first()
    if record:
        # Update existing
        for f in ["parent_name","relationship","primary_mobile","alternate_mobile",
                  "preferred_contact_method","consent_to_contact"]:
            if f in data:
                setattr(record, f, data[f])
        db.session.commit()
        return jsonify(record.to_dict(mask_number=False))
    else:
        if not data.get("parent_name") or not data.get("primary_mobile"):
            return jsonify({"error": "parent_name and primary_mobile are required"}), 400
        record = ParentRecord(
            student_id=sid,
            parent_name=data["parent_name"],
            relationship=data.get("relationship", "Guardian"),
            primary_mobile=data["primary_mobile"],
            alternate_mobile=data.get("alternate_mobile"),
            preferred_contact_method=data.get("preferred_contact_method", "Call"),
            consent_to_contact=data.get("consent_to_contact", True),
        )
        db.session.add(record)
        db.session.commit()
        return jsonify(record.to_dict(mask_number=False)), 201


@parents_bp.delete("/<student_id>")
def delete_parent(student_id):
    """DELETE /parents/:student_id — admin only."""
    role = request.headers.get("X-User-Role", "teacher")
    if not _is_admin(role):
        return jsonify({"error": "Admin access required"}), 403
    record = ParentRecord.query.filter_by(student_id=student_id).first_or_404()
    db.session.delete(record)
    db.session.commit()
    return jsonify({"message": "Parent record deleted"})
