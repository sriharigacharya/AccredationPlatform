"""
Assignment routes — create, list, detail.
Faculty: full CRUD.  Student: read own assignments only.
"""

from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, Assignment, AssignmentTarget, Student

assignments_bp = Blueprint("assignments", __name__)


def _resolve_targets(target_type, target_id):
    """Resolve a target_type + target_id into a list of student_id strings."""
    if target_type == "student":
        s = Student.query.filter_by(student_id=target_id).first()
        return [s.student_id] if s else []

    elif target_type == "section":
        students = Student.query.filter_by(section=target_id).all()
        return [s.student_id for s in students]

    elif target_type == "batch":
        # batch = semester value (e.g. "3", "5", "7")
        students = Student.query.filter_by(semester=int(target_id)).all()
        return [s.student_id for s in students]

    return []


# ── POST /assignments/ ───────────────────────────────────────────────────────
@assignments_bp.post("/")
def create_assignment():
    """Create assignment (faculty only — enforced by gateway role check)."""
    role = request.headers.get("X-User-Role", "")
    if role not in ("admin", "teacher"):
        return jsonify({"error": "Only faculty can create assignments"}), 403

    data = request.get_json(force=True) or {}
    required = ["title", "target_type", "target_id"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    if data.get("type") not in ("homework", "project"):
        data["type"] = "homework"

    if data["target_type"] not in ("student", "section", "batch"):
        return jsonify({"error": "target_type must be student, section, or batch"}), 400

    # Parse due_date
    due_date = None
    if data.get("due_date"):
        try:
            due_date = datetime.fromisoformat(data["due_date"].replace("Z", "+00:00"))
        except Exception:
            return jsonify({"error": "Invalid due_date format. Use ISO 8601."}), 400

    # Faculty ID: from linked_id header or payload
    faculty_id = request.headers.get("X-Linked-Id") or data.get("faculty_id", "")
    if not faculty_id:
        return jsonify({"error": "Could not determine faculty_id"}), 400

    # Resolve targets
    student_ids = _resolve_targets(data["target_type"], data["target_id"])
    if not student_ids:
        return jsonify({"error": f"No students found for {data['target_type']}={data['target_id']}"}), 404

    # Create
    a = Assignment(
        type=data["type"],
        title=data["title"],
        description=data.get("description", ""),
        faculty_id=faculty_id,
        target_type=data["target_type"],
        target_id=data["target_id"],
        due_date=due_date,
    )
    db.session.add(a)
    db.session.flush()  # get a.id

    for sid in student_ids:
        db.session.add(AssignmentTarget(assignment_id=a.id, student_id=sid))

    db.session.commit()
    return jsonify(a.to_dict(include_targets=True)), 201


# ── GET /assignments/ ────────────────────────────────────────────────────────
@assignments_bp.get("/")
def list_assignments():
    """
    Faculty: GET /assignments/?faculty_id=FAC001
    Student: GET /assignments/?student_id=me  (resolved from X-Linked-Id)
    """
    role = request.headers.get("X-User-Role", "")

    # Student view — scoped to self
    student_id = request.args.get("student_id")
    if student_id == "me":
        student_id = request.headers.get("X-Linked-Id", "")
    if student_id:
        # Find all assignment IDs targeting this student
        target_rows = AssignmentTarget.query.filter_by(student_id=student_id).all()
        if not target_rows:
            return jsonify([])
        asgn_ids = list({t.assignment_id for t in target_rows})
        assignments = Assignment.query.filter(Assignment.id.in_(asgn_ids)) \
                          .order_by(Assignment.created_at.desc()).all()
        return jsonify([a.to_dict() for a in assignments])

    # Faculty view — by faculty_id
    faculty_id = request.args.get("faculty_id")
    if not faculty_id:
        faculty_id = request.headers.get("X-Linked-Id", "")

    if role == "admin":
        # Admin can see all
        if faculty_id:
            assignments = Assignment.query.filter_by(faculty_id=faculty_id) \
                              .order_by(Assignment.created_at.desc()).all()
        else:
            assignments = Assignment.query.order_by(Assignment.created_at.desc()).all()
    elif role == "teacher":
        assignments = Assignment.query.filter_by(faculty_id=faculty_id) \
                          .order_by(Assignment.created_at.desc()).all()
    else:
        return jsonify({"error": "Access denied"}), 403

    return jsonify([a.to_dict() for a in assignments])


# ── GET /assignments/<id> ────────────────────────────────────────────────────
@assignments_bp.get("/<int:assignment_id>")
def get_assignment(assignment_id):
    a = Assignment.query.get_or_404(assignment_id)

    role = request.headers.get("X-User-Role", "")
    linked_id = request.headers.get("X-Linked-Id", "")

    # Student: only if they are a target
    if role == "student":
        is_target = AssignmentTarget.query.filter_by(
            assignment_id=a.id, student_id=linked_id
        ).first()
        if not is_target:
            return jsonify({"error": "Access denied"}), 403

    return jsonify(a.to_dict(include_targets=(role in ("admin", "teacher"))))


# ── GET /assignments/<id>/students ───────────────────────────────────────────
@assignments_bp.get("/<int:assignment_id>/students")
def get_assignment_students(assignment_id):
    """Faculty-only: list all student_ids for an assignment."""
    role = request.headers.get("X-User-Role", "")
    if role not in ("admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    a = Assignment.query.get_or_404(assignment_id)
    student_ids = [t.student_id for t in a.targets]

    # Enrich with student names
    students = Student.query.filter(Student.student_id.in_(student_ids)).all()
    student_map = {s.student_id: s for s in students}

    result = []
    for sid in student_ids:
        s = student_map.get(sid)
        result.append({
            "student_id": sid,
            "name": s.name if s else "Unknown",
            "section": s.section if s else "—",
            "semester": s.semester if s else 0,
        })

    return jsonify({
        "assignment_id": a.id,
        "title": a.title,
        "students": result,
        "count": len(result),
    })


# ── DELETE /assignments/<id> ─────────────────────────────────────────────────
@assignments_bp.delete("/<int:assignment_id>")
def delete_assignment(assignment_id):
    role = request.headers.get("X-User-Role", "")
    if role not in ("admin", "teacher"):
        return jsonify({"error": "Only faculty can delete assignments"}), 403

    a = Assignment.query.get_or_404(assignment_id)

    # Teachers can only delete their own
    if role == "teacher":
        linked_id = request.headers.get("X-Linked-Id", "")
        if a.faculty_id != linked_id:
            return jsonify({"error": "You can only delete your own assignments"}), 403

    db.session.delete(a)
    db.session.commit()
    return jsonify({"deleted": True, "id": assignment_id})
