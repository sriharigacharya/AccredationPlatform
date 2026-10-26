"""Section management routes — AcademiQ.

Role-based enforcement:
  admin   : full CRUD
  teacher : read-only
  student : read-only
"""

from flask import Blueprint, request, jsonify
from models import db, Department
from timetable_models import Section, TimetableSlot, StudentEnrollment

sections_bp = Blueprint("sections", __name__)


def _get_role() -> str:
    return request.headers.get("X-User-Role", "")


# ── List ───────────────────────────────────────────────────────────────────────

@sections_bp.get("/")
def list_sections():
    """GET /sections?department_id=1&semester=5"""
    dept_id  = request.args.get("department_id", type=int)
    semester = request.args.get("semester")

    q = Section.query
    if dept_id:
        q = q.filter_by(department_id=dept_id)
    if semester:
        q = q.filter_by(semester=str(semester))

    sections = q.order_by(Section.semester, Section.section_label).all()

    result = []
    for s in sections:
        d = s.to_dict()
        d["slot_count"] = TimetableSlot.query.filter_by(section_id=s.id).count()
        d["enrolled_count"] = StudentEnrollment.query.filter_by(section_id=s.id).count()
        result.append(d)

    return jsonify(result)


# ── Create ─────────────────────────────────────────────────────────────────────

@sections_bp.post("/")
def create_section():
    """POST /sections — Admin only."""
    if _get_role() != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data     = request.get_json(force=True) or {}
    semester = (data.get("semester") or "").strip()
    label    = (data.get("section_label") or "").strip().upper()

    if not semester:
        return jsonify({"error": "semester is required"}), 400
    if not label:
        return jsonify({"error": "section_label is required"}), 400
    if Section.query.filter_by(semester=semester, section_label=label).first():
        return jsonify({"error": f"Section Sem {semester}-{label} already exists"}), 409

    # Validate department FK if provided
    dept_id = data.get("department_id")
    if dept_id:
        if not Department.query.get(int(dept_id)):
            return jsonify({"error": f"Department {dept_id} not found"}), 404
        dept_id = int(dept_id)

    sec = Section(
        semester=semester,
        section_label=label,
        department_id=dept_id,
        default_room=(data.get("default_room") or "").strip(),
    )
    db.session.add(sec)
    db.session.commit()

    d = sec.to_dict()
    d["slot_count"] = 0
    d["enrolled_count"] = 0
    return jsonify(d), 201


# ── Update ─────────────────────────────────────────────────────────────────────

@sections_bp.put("/<int:section_id>")
def update_section(section_id):
    """PUT /sections/:id — Admin only."""
    if _get_role() != "admin":
        return jsonify({"error": "Admin access required"}), 403

    sec  = Section.query.get_or_404(section_id)
    data = request.get_json(force=True) or {}

    if "default_room" in data:
        sec.default_room = (data["default_room"] or "").strip()

    if "department_id" in data:
        dept_id = data["department_id"]
        if dept_id is not None:
            if not Department.query.get(int(dept_id)):
                return jsonify({"error": f"Department {dept_id} not found"}), 404
            sec.department_id = int(dept_id)
        else:
            sec.department_id = None

    # Note: semester + section_label are not updatable (composite PK semantics)
    db.session.commit()
    return jsonify(sec.to_dict())


# ── Delete ─────────────────────────────────────────────────────────────────────

@sections_bp.delete("/<int:section_id>")
def delete_section(section_id):
    """DELETE /sections/:id — Admin only.
    Refuses if timetable slots reference this section (no CASCADE on that FK).
    """
    if _get_role() != "admin":
        return jsonify({"error": "Admin access required"}), 403

    sec = Section.query.get_or_404(section_id)

    # Guard: TimetableSlot.section_id has no ondelete=CASCADE — would crash
    slot_count = TimetableSlot.query.filter_by(section_id=section_id).count()
    if slot_count > 0:
        return jsonify({
            "error": (
                f"Cannot delete section '{sec.display_name if hasattr(sec, 'display_name') else sec.section_label}' "
                f"— {slot_count} timetable slot(s) are assigned to it. Remove them first."
            )
        }), 409

    db.session.delete(sec)
    db.session.commit()
    return jsonify({"deleted": True, "id": section_id})
