"""Subject (Course) management routes — AcademiQ.

Role-based enforcement:
  admin   : full CRUD
  teacher : read + create
  student : read-only
"""

from flask import Blueprint, request, jsonify
from models import db, Department
from timetable_models import Subject

subjects_bp = Blueprint("subjects", __name__)


def _get_role() -> str:
    return request.headers.get("X-User-Role", "")


# ── List ───────────────────────────────────────────────────────────────────────

@subjects_bp.get("/")
def list_subjects():
    """GET /subjects?department_id=1"""
    dept_id = request.args.get("department_id", type=int)
    search  = request.args.get("search", "")
    q = Subject.query
    if dept_id:
        q = q.filter_by(department_id=dept_id)
    if search:
        q = q.filter(
            Subject.name.ilike(f"%{search}%") | Subject.code.ilike(f"%{search}%")
        )
    return jsonify([s.to_dict() for s in q.order_by(Subject.code).all()])


# ── Create ─────────────────────────────────────────────────────────────────────

@subjects_bp.post("/")
def create_subject():
    """POST /subjects — Admin or Teacher only."""
    role = _get_role()
    if role not in ("admin", "teacher"):
        return jsonify({"error": "Admin or Teacher access required"}), 403

    data = request.get_json(force=True) or {}
    code = (data.get("code") or "").strip().upper()
    name = (data.get("name") or "").strip()

    if not code:
        return jsonify({"error": "code is required"}), 400
    if not name:
        return jsonify({"error": "name is required"}), 400
    if Subject.query.filter_by(code=code).first():
        return jsonify({"error": f"Subject code '{code}' already exists"}), 409

    # Validate department FK if provided
    dept_id = data.get("department_id")
    if dept_id:
        if not Department.query.get(int(dept_id)):
            return jsonify({"error": f"Department {dept_id} not found"}), 404
        dept_id = int(dept_id)

    s = Subject(
        code=code,
        name=name,
        department_id=dept_id,
        is_confirmed=True,
    )
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


# ── Update ─────────────────────────────────────────────────────────────────────

@subjects_bp.put("/<int:subject_id>")
def update_subject(subject_id):
    """PUT /subjects/:id — Admin only."""
    if _get_role() != "admin":
        return jsonify({"error": "Admin access required"}), 403

    s = Subject.query.get_or_404(subject_id)
    data = request.get_json(force=True) or {}

    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        s.name = name

    if "department_id" in data:
        dept_id = data["department_id"]
        if dept_id is not None:
            if not Department.query.get(int(dept_id)):
                return jsonify({"error": f"Department {dept_id} not found"}), 404
            s.department_id = int(dept_id)
        else:
            s.department_id = None

    if "code" in data:
        new_code = (data["code"] or "").strip().upper()
        if new_code and new_code != s.code:
            if Subject.query.filter_by(code=new_code).first():
                return jsonify({"error": f"Subject code '{new_code}' already exists"}), 409
            s.code = new_code

    db.session.commit()
    return jsonify(s.to_dict())


# ── Delete ─────────────────────────────────────────────────────────────────────

@subjects_bp.delete("/<int:subject_id>")
def delete_subject(subject_id):
    """DELETE /subjects/:id — Admin only."""
    if _get_role() != "admin":
        return jsonify({"error": "Admin access required"}), 403

    s = Subject.query.get_or_404(subject_id)

    # Guard: refuse deletion if timetable slots reference this subject
    from timetable_models import TimetableSlot
    slot_count = TimetableSlot.query.filter_by(subject_id=subject_id).count()
    if slot_count > 0:
        return jsonify({
            "error": f"Cannot delete subject — {slot_count} timetable slot(s) reference it. Remove those slots first."
        }), 409

    db.session.delete(s)
    db.session.commit()
    return jsonify({"deleted": True, "id": subject_id})
