"""
Student role assignment routes — Admin only for assign/remove, all auth for listing.
"""

from flask import Blueprint, request, jsonify
from models import db, Student
from event_models import StudentRole, Club, VALID_STUDENT_ROLES

student_roles_bp = Blueprint("student_roles", __name__)


def _get_user_context():
    """Extract user context from gateway-injected headers."""
    return {
        "user_id":   request.headers.get("X-User-Id", ""),
        "role":      request.headers.get("X-User-Role", ""),
        "linked_id": request.headers.get("X-Linked-Id", ""),
        "name":      request.headers.get("X-User-Name", ""),
    }


@student_roles_bp.get("/")
def list_roles():
    """
    GET /student-roles/?club_id=1&student_id=STU001&role=head
    All authenticated users can list roles.
    """
    query = StudentRole.query

    club_id = request.args.get("club_id", type=int)
    if club_id:
        query = query.filter_by(club_id=club_id)

    student_id = request.args.get("student_id")
    if student_id:
        query = query.filter_by(student_id=student_id)

    role = request.args.get("role")
    if role and role in VALID_STUDENT_ROLES:
        query = query.filter_by(role=role)

    roles = query.order_by(StudentRole.assigned_at.desc()).all()

    # Enrich with student name and club name
    result = []
    for sr in roles:
        d = sr.to_dict()
        stu = Student.query.filter_by(student_id=sr.student_id).first()
        d["student_name"] = stu.name if stu else None
        club = Club.query.get(sr.club_id)
        d["club_name"] = club.name if club else None
        result.append(d)

    return jsonify(result)


@student_roles_bp.post("/")
def assign_role():
    """
    POST /student-roles/ — Admin only.
    Body: { "student_id": "STU001", "club_id": 1, "role": "head" }
    """
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json(force=True) or {}
    student_id = data.get("student_id", "").strip()
    club_id    = data.get("club_id")
    role       = data.get("role", "member").lower()

    if not student_id:
        return jsonify({"error": "student_id is required"}), 400
    if not club_id:
        return jsonify({"error": "club_id is required"}), 400
    if role not in VALID_STUDENT_ROLES:
        return jsonify({"error": f"role must be one of: {', '.join(VALID_STUDENT_ROLES)}"}), 400

    # Validate student exists
    stu = Student.query.filter_by(student_id=student_id).first()
    if not stu:
        return jsonify({"error": f"Student '{student_id}' not found"}), 404

    # Validate club exists
    club = Club.query.get(club_id)
    if not club:
        return jsonify({"error": f"Club {club_id} not found"}), 404

    # Check for existing assignment
    existing = StudentRole.query.filter_by(student_id=student_id, club_id=club_id).first()
    if existing:
        # Update role instead of rejecting
        existing.role = role
        existing.assigned_by = ctx["user_id"]
        db.session.commit()
        d = existing.to_dict()
        d["student_name"] = stu.name
        d["club_name"] = club.name
        return jsonify(d)

    # Enforce: only one head per club
    if role == "head":
        current_head = StudentRole.query.filter_by(club_id=club_id, role="head").first()
        if current_head:
            return jsonify({
                "error": f"Club already has a head (student {current_head.student_id}). "
                         f"Remove or reassign them first."
            }), 409

    sr = StudentRole(
        student_id=student_id,
        club_id=club_id,
        role=role,
        assigned_by=ctx["user_id"],
    )
    db.session.add(sr)
    db.session.commit()

    d = sr.to_dict()
    d["student_name"] = stu.name
    d["club_name"] = club.name
    return jsonify(d), 201


@student_roles_bp.delete("/<int:role_id>")
def remove_role(role_id):
    """DELETE /student-roles/:id — Admin only."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    sr = StudentRole.query.get_or_404(role_id)
    db.session.delete(sr)
    db.session.commit()

    return jsonify({"deleted": True, "id": role_id})
