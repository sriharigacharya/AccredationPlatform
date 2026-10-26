"""StudentEnrollment management routes — AcademiQ.

Role-based enforcement:
  admin   : full CRUD + bulk operations
  teacher : read + single enroll
  student : read (own enrollments only via X-Linked-Id)
"""

from flask import Blueprint, request, jsonify
from models import db, Student
from timetable_models import StudentEnrollment, Section

enrollments_bp = Blueprint("enrollments", __name__)


def _get_role() -> str:
    return request.headers.get("X-User-Role", "")


def _get_linked_id() -> str | None:
    return request.headers.get("X-Linked-Id") or None


# ── List ───────────────────────────────────────────────────────────────────────

@enrollments_bp.get("/")
def list_enrollments():
    """GET /enrollments?section_id=3&term=2024-25-EVEN&student_id=STU001"""
    role = _get_role()
    if role not in ("admin", "teacher", "student"):
        return jsonify({"error": "Authentication required"}), 403

    # Students can only see their own enrollments
    if role == "student":
        linked_id = _get_linked_id()
        if not linked_id:
            return jsonify([])
        rows = StudentEnrollment.query.filter_by(student_id=linked_id).all()
        return jsonify([r.to_dict() for r in rows])

    # Admin / Teacher
    q = StudentEnrollment.query

    section_id = request.args.get("section_id", type=int)
    term       = request.args.get("term")
    student_id = request.args.get("student_id")

    if section_id:
        q = q.filter_by(section_id=section_id)
    if term:
        q = q.filter_by(academic_term=term)
    if student_id:
        q = q.filter_by(student_id=student_id.strip().upper())

    rows = q.order_by(StudentEnrollment.student_id).all()

    # Enrich with student name
    result = []
    for r in rows:
        d = r.to_dict()
        stu = Student.query.filter_by(student_id=r.student_id).first()
        d["student_name"] = stu.name if stu else None
        sec = Section.query.get(r.section_id)
        d["section_display"] = f"Sem {sec.semester}-{sec.section_label}" if sec else None
        result.append(d)

    return jsonify(result)


# ── Single Enroll ──────────────────────────────────────────────────────────────

@enrollments_bp.post("/")
def enroll_student():
    """POST /enrollments — Admin or Teacher.
    Body: { student_id, section_id, academic_term }
    Idempotent: returns 200 if already enrolled.
    """
    role = _get_role()
    if role not in ("admin", "teacher"):
        return jsonify({"error": "Admin or Teacher access required"}), 403

    data       = request.get_json(force=True) or {}
    student_id = (data.get("student_id") or "").strip().upper()

    # Cast section_id safely
    raw_sec = data.get("section_id")
    if not raw_sec:
        return jsonify({"error": "section_id is required"}), 400
    try:
        section_id = int(raw_sec)
    except (TypeError, ValueError):
        return jsonify({"error": "section_id must be an integer"}), 400

    term = data.get("academic_term", "2024-25-EVEN")

    if not student_id:
        return jsonify({"error": "student_id is required"}), 400

    # Validate student exists
    stu = Student.query.filter_by(student_id=student_id).first()
    if not stu:
        return jsonify({"error": f"Student '{student_id}' not found"}), 404

    # Validate section exists
    sec = Section.query.get(section_id)
    if not sec:
        return jsonify({"error": f"Section {section_id} not found"}), 404

    # Idempotency check
    existing = StudentEnrollment.query.filter_by(
        student_id=student_id, section_id=section_id, academic_term=term
    ).first()
    if existing:
        d = existing.to_dict()
        d["student_name"] = stu.name
        d["section_display"] = f"Sem {sec.semester}-{sec.section_label}"
        return jsonify(d), 200

    e = StudentEnrollment(student_id=student_id, section_id=section_id, academic_term=term)
    db.session.add(e)
    db.session.commit()

    d = e.to_dict()
    d["student_name"] = stu.name
    d["section_display"] = f"Sem {sec.semester}-{sec.section_label}"
    return jsonify(d), 201


# ── Bulk Enroll ────────────────────────────────────────────────────────────────

@enrollments_bp.post("/bulk")
def bulk_enroll():
    """POST /enrollments/bulk — Admin only.
    Body: {
      "section_id": 3,
      "academic_term": "2024-25-EVEN",
      "student_ids": ["STU001", "STU002"]     ← flat list per section
      OR
      "enrollments": [{ "student_id": "STU001", "section_id": 3 }]  ← multi-section
    }
    Uses per-row savepoints so one failure doesn't wipe prior successes.
    """
    if _get_role() != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json(force=True) or {}
    term = data.get("academic_term", "2024-25-EVEN")
    created, skipped, errors = [], [], []

    # Build list of (student_id, section_id) pairs
    pairs = []
    if "student_ids" in data:
        # Single-section shorthand
        raw_sec = data.get("section_id")
        if not raw_sec:
            return jsonify({"error": "section_id is required when using student_ids"}), 400
        try:
            sec_id = int(raw_sec)
        except (TypeError, ValueError):
            return jsonify({"error": "section_id must be an integer"}), 400
        for sid in data["student_ids"]:
            pairs.append((str(sid).strip().upper(), sec_id))
    else:
        for row in data.get("enrollments", []):
            sid    = (row.get("student_id") or "").strip().upper()
            raw_s  = row.get("section_id")
            if not sid or not raw_s:
                errors.append(f"Missing student_id or section_id in row: {row}")
                continue
            try:
                pairs.append((sid, int(raw_s)))
            except (TypeError, ValueError):
                errors.append(f"Invalid section_id in row: {row}")

    # Process with savepoints (fixes H-3 from audit)
    for student_id, section_id in pairs:
        try:
            # Validate student
            if not Student.query.filter_by(student_id=student_id).first():
                errors.append(f"Student '{student_id}' not found")
                continue
            # Validate section
            if not Section.query.get(section_id):
                errors.append(f"Section {section_id} not found for student '{student_id}'")
                continue
            # Idempotency
            if StudentEnrollment.query.filter_by(
                student_id=student_id, section_id=section_id, academic_term=term
            ).first():
                skipped.append(student_id)
                continue

            # Savepoint per row — failure here won't wipe prior successes
            sp = db.session.begin_nested()
            e  = StudentEnrollment(student_id=student_id, section_id=section_id, academic_term=term)
            db.session.add(e)
            db.session.flush()
            sp.commit()
            created.append(student_id)

        except Exception as ex:
            sp.rollback()
            skipped.append({"student_id": student_id, "reason": str(ex)})

    db.session.commit()
    return jsonify({
        "created":  len(created),
        "created_ids": created,
        "skipped":  skipped,
        "errors":   errors,
    }), 201


# ── Unenroll ───────────────────────────────────────────────────────────────────

@enrollments_bp.delete("/<int:enrollment_id>")
def unenroll(enrollment_id):
    """DELETE /enrollments/:id — Admin only."""
    if _get_role() != "admin":
        return jsonify({"error": "Admin access required"}), 403

    e = StudentEnrollment.query.get_or_404(enrollment_id)
    db.session.delete(e)
    db.session.commit()
    return jsonify({"deleted": True, "id": enrollment_id})
