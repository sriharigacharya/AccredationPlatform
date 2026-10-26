"""Student routes for academic-data-service.

Role-based enforcement (defense-in-depth — gateway is the primary boundary):
  student : read-only, scoped to their own linked_id (X-Linked-Id header)
  teacher : read + write for all students
  admin   : full CRUD
"""

import json
from flask import Blueprint, request, jsonify
from models import db, Student, Department

students_bp = Blueprint("students", __name__)


def _get_role() -> str:
    return request.headers.get("X-User-Role", "teacher")


def _get_linked_id() -> str | None:
    """student_id from the JWT, forwarded by the gateway as X-Linked-Id."""
    return request.headers.get("X-Linked-Id") or None


def _is_readonly_role(role: str) -> bool:
    """student role is read-only and scoped to their own record."""
    return role == "student"


@students_bp.get("/")
def list_students():
    """
    GET /students?semester=4&department=CSE&search=...
    - admin/teacher: returns all matching students
    - student: returns only their own record (ignores filters, uses X-Linked-Id)
    """
    role      = _get_role()
    linked_id = _get_linked_id()

    # Student role — scoped to own record only
    if _is_readonly_role(role):
        if not linked_id:
            return jsonify([])
        s = Student.query.filter_by(student_id=linked_id).first()
        return jsonify([s.to_dict(include_dept=True)] if s else [])

    # Admin / Teacher — full list with filters
    query = Student.query
    semester  = request.args.get("semester", type=int)
    dept_code = request.args.get("department")
    section   = request.args.get("section")
    search    = request.args.get("search", "")

    if semester:
        query = query.filter_by(semester=semester)
    if dept_code:
        dept = Department.query.filter_by(code=dept_code.upper()).first()
        if dept:
            query = query.filter_by(department_id=dept.id)
    if section:
        query = query.filter_by(section=section.upper())
    if search:
        query = query.filter(
            Student.name.ilike(f"%{search}%") | Student.student_id.ilike(f"%{search}%")
        )

    students = query.order_by(Student.student_id).all()
    return jsonify([s.to_dict(include_dept=True) for s in students])


@students_bp.post("/")
def create_student():
    """POST /students — create a new student record. Teacher or Admin only."""
    role = _get_role()
    if _is_readonly_role(role):
        return jsonify({"error": "Students cannot create records"}), 403

    data = request.get_json(force=True) or {}
    required = ["student_id", "name"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required"}), 400

    if Student.query.filter_by(student_id=data["student_id"]).first():
        return jsonify({"error": "student_id already exists"}), 409

    dept_id = data.get("department_id")
    if not dept_id:
        dept = Department.query.first()
        dept_id = dept.id if dept else None

    semester = int(data.get("semester", 1))
    section = (data.get("section") or "A").upper()

    # Automatically initialize standard curriculum courses for this semester/section
    courses_list = data.get("courses_data")
    if not courses_list or not isinstance(courses_list, list):
        courses_list = Student.get_default_courses_for_semester(semester, section)
    courses_data_json = json.dumps(courses_list)

    s = Student(
        student_id=data["student_id"].strip().upper(),
        name=data["name"].strip(),
        email=data.get("email"),
        phone=data.get("phone"),
        department_id=dept_id,
        semester=semester,
        section=section,
        attendance_pct=100.0,
        internal_marks=0.0,
        assignment_score_pct=0.0,
        previous_gpa=float(data.get("previous_gpa") or data.get("cgpa") or 0.0),
        backlogs=int(data.get("backlogs") or 0),
        course_performance_pct=0.0,
        engagement=data.get("engagement", "Medium"),
        final_result="Pending",
        courses_data=courses_data_json,
    )
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201



def _find_student(student_id):
    """Lookup student by canonical student_id or primary key id."""
    query_filter = (Student.student_id == student_id)
    if str(student_id).isdigit():
        query_filter = query_filter | (Student.id == int(student_id))
    return Student.query.filter(query_filter).first_or_404()


@students_bp.get("/<student_id>")
def get_student(student_id):
    """
    GET /students/:student_id — full profile.
    student role: only allowed to fetch their own linked_id.
    """
    role      = _get_role()
    linked_id = _get_linked_id()

    s = _find_student(student_id)

    if _is_readonly_role(role) and student_id != linked_id and s.student_id != linked_id:
        return jsonify({"error": "You can only view your own record"}), 403

    return jsonify(s.to_dict(include_dept=True))


@students_bp.put("/<student_id>")
def update_student(student_id):
    """PUT /students/:student_id — update fields. Teacher or Admin only."""
    role = _get_role()
    if _is_readonly_role(role):
        return jsonify({"error": "Students cannot modify records"}), 403

    s = _find_student(student_id)
    data = request.get_json(force=True) or {}

    for field in ["name", "email", "phone", "semester", "attendance_pct", "internal_marks",
                  "assignment_score_pct", "previous_gpa", "backlogs",
                  "course_performance_pct", "engagement", "final_result", "department_id"]:
        if field in data:
            setattr(s, field, data[field])

    # Handle courses_data update
    if "courses_data" in data:
        cd = data["courses_data"]
        if isinstance(cd, list):
            s.courses_data = json.dumps(cd)
        elif isinstance(cd, str):
            s.courses_data = cd

    db.session.commit()
    return jsonify(s.to_dict())


@students_bp.delete("/<student_id>")
def delete_student(student_id):
    """DELETE /students/:student_id — Admin only."""
    role = _get_role()
    if role not in ("admin",):
        return jsonify({"error": "Admin access required to delete records"}), 403

    s = _find_student(student_id)
    db.session.delete(s)
    db.session.commit()
    return jsonify({"message": "Student deleted"}), 200


@students_bp.patch("/<student_id>/risk")
def update_student_risk(student_id):
    """
    PATCH /students/:student_id/risk

    Called exclusively by the prediction-service batch job to persist
    pre-computed ML risk results.  Accepts:
        ml_risk_score, ml_risk_level, ml_risk_flags,
        ml_risk_computed_at, ml_low_confidence
    """
    import json as _json
    from datetime import datetime

    s = _find_student(student_id)
    data = request.get_json(force=True) or {}

    if "ml_risk_score" in data:
        s.ml_risk_score = float(data["ml_risk_score"])
    if "ml_risk_level" in data:
        s.ml_risk_level = str(data["ml_risk_level"])
    if "ml_risk_flags" in data:
        flags = data["ml_risk_flags"]
        s.ml_risk_flags = flags if isinstance(flags, str) else _json.dumps(flags)
    if "ml_risk_computed_at" in data:
        try:
            s.ml_risk_computed_at = datetime.fromisoformat(
                data["ml_risk_computed_at"].replace("Z", "+00:00")
            )
        except Exception:
            s.ml_risk_computed_at = datetime.utcnow()
    if "ml_low_confidence" in data:
        s.ml_low_confidence = bool(data["ml_low_confidence"])

    db.session.commit()
    return jsonify({"ok": True, "student_id": s.student_id}), 200


@students_bp.get("/atrisk")
def at_risk_students():
    """
    GET /students/atrisk?threshold=<float>&limit=<int>

    Returns students whose pre-computed ml_risk_score >= threshold.
    This is a pure DB query — no ML inference — so it responds instantly.

    Called by prediction-service /predict/atrisk as the fast DB-backed path.
    """
    import json as _json

    threshold = float(request.args.get("threshold", 0.35))
    limit     = int(request.args.get("limit", 50))

    # Only query students where ml_risk_score has been computed
    query = Student.query.filter(
        Student.ml_risk_score != None,  # noqa: E711
        Student.ml_risk_score >= threshold,
    ).order_by(Student.ml_risk_score.desc()).limit(limit)

    students = query.all()

    at_risk = []
    for s in students:
        try:
            flags = _json.loads(s.ml_risk_flags) if s.ml_risk_flags else []
        except Exception:
            flags = []

        at_risk.append({
            **s.to_dict(include_dept=False),
            "risk_score":       s.ml_risk_score,
            "risk_level":       s.ml_risk_level,
            "model_tier":       s.ml_risk_level,
            "flags":            flags,
            "low_confidence":   s.ml_low_confidence,
            "computed_at":      s.ml_risk_computed_at.isoformat() if s.ml_risk_computed_at else None,
            # Dashboard-friendly aliases
            "probability":      s.ml_risk_score,
            "attendance_rate":  s.attendance_pct,
        })

    # Count total at-risk students (without limit)
    total_count = Student.query.filter(
        Student.ml_risk_score != None,  # noqa: E711
        Student.ml_risk_score >= threshold,
    ).count()

    return jsonify({
        "at_risk":   at_risk,
        "count":     total_count,
        "threshold": threshold,
        "source":    "db_persisted",
    })


@students_bp.get("/<student_id>/analytics")
def student_analytics(student_id):
    """
    GET /students/:student_id/analytics
    Returns computed risk indicators without running the ML model.
    student role: only their own record.
    """
    role      = _get_role()
    linked_id = _get_linked_id()

    s = _find_student(student_id)

    if _is_readonly_role(role) and student_id != linked_id and s.student_id != linked_id:
        return jsonify({"error": "You can only view your own analytics"}), 403

    # Rule-based risk flags
    risks = []
    if s.attendance_pct < 75:
        risks.append({"type": "attendance", "message": f"Attendance {s.attendance_pct:.1f}% below 75% threshold",
                      "severity": "high" if s.attendance_pct < 60 else "medium"})
    if s.backlogs > 0:
        risks.append({"type": "backlogs", "message": f"{s.backlogs} active backlog(s)",
                      "severity": "high" if s.backlogs >= 3 else "medium"})
    if s.internal_marks < 50:
        risks.append({"type": "internals", "message": f"Internal marks {s.internal_marks} below passing threshold",
                      "severity": "high"})
    if s.previous_gpa < 6.0:
        risks.append({"type": "gpa", "message": f"GPA {s.previous_gpa} below 6.0", "severity": "medium"})
    if s.engagement == "Low":
        risks.append({"type": "engagement", "message": "Low engagement detected", "severity": "low"})

    overall_risk = "high"   if any(r["severity"] == "high"   for r in risks) else \
                   "medium" if any(r["severity"] == "medium" for r in risks) else \
                   "low"    if risks else "none"

    return jsonify({
        "student_id":   s.student_id,
        "overall_risk": overall_risk,
        "risk_flags":   risks,
        "ml_risk_score": s.ml_risk_score,
        "ml_risk_level": s.ml_risk_level,
        "performance_summary": {
            "attendance_pct":         s.attendance_pct,
            "internal_marks":         s.internal_marks,
            "assignment_score_pct":   s.assignment_score_pct,
            "previous_gpa":           s.previous_gpa,
            "backlogs":               s.backlogs,
            "course_performance_pct": s.course_performance_pct,
            "engagement":             s.engagement,
        }
    })


@students_bp.get("/stats/overview")
def stats_overview():
    """GET /students/stats/overview — aggregate stats for dashboard. Admin/Teacher only."""
    role = _get_role()
    if _is_readonly_role(role):
        return jsonify({"error": "Admin or Teacher access required"}), 403

    total   = Student.query.count()
    passed  = Student.query.filter_by(final_result="Pass").count()
    failed  = Student.query.filter_by(final_result="Fail").count()
    at_risk = Student.query.filter(
        (Student.attendance_pct < 75) | (Student.backlogs > 0) | (Student.internal_marks < 50)
    ).count()

    from sqlalchemy import func
    avg_gpa    = db.session.query(func.avg(Student.previous_gpa)).scalar() or 0
    avg_attend = db.session.query(func.avg(Student.attendance_pct)).scalar() or 0

    return jsonify({
        "total_students": total,
        "passed":         passed,
        "failed":         failed,
        "at_risk":        at_risk,
        "pass_rate_pct":  round((passed / total * 100) if total > 0 else 0, 1),
        "avg_gpa":        round(float(avg_gpa), 2),
        "avg_attendance": round(float(avg_attend), 1),
    })



@students_bp.post("/bulk-import")
def bulk_import_students():
    """
    POST /students/bulk-import  (multipart/form-data, field: 'file')
    Admin only. Accepts CSV with headers matching Student fields.

    Required columns : student_id, name
    Optional columns : email, phone, semester, section, previous_gpa,
                       backlogs, engagement, department (dept code e.g. CSE)

    Returns: { created, created_ids, skipped, errors, total_processed }
    """
    import csv
    import io as _io

    role = _get_role()
    if role != "admin":
        return jsonify({"error": "Admin access required"}), 403

    f = request.files.get("file")
    if not f:
        return jsonify({"error": "file field is required"}), 400

    # File size cap (C-3 audit fix)
    MAX_CSV_BYTES = 5 * 1024 * 1024
    MAX_CSV_ROWS  = 2000

    f.stream.seek(0, 2)
    file_size = f.stream.tell()
    f.stream.seek(0)
    if file_size > MAX_CSV_BYTES:
        return jsonify({"error": "File too large. Maximum allowed size is 5 MB."}), 413

    try:
        stream = _io.StringIO(f.stream.read().decode("utf-8-sig"))
    except UnicodeDecodeError:
        return jsonify({"error": "File encoding not supported. Please save as UTF-8 CSV."}), 400

    reader = csv.DictReader(stream)
    sample = next(reader, None)
    if sample is None:
        return jsonify({"error": "CSV file is empty"}), 400
    missing_cols = [c for c in ("student_id", "name") if c not in sample]
    if missing_cols:
        return jsonify({"error": "CSV is missing required columns: " + ", ".join(missing_cols)}), 400

    stream.seek(0)
    reader = csv.DictReader(stream)

    created, skipped, errors = [], [], []
    row_num = 1

    for row in reader:
        row_num += 1
        if row_num > MAX_CSV_ROWS + 1:
            errors.append("Row limit of " + str(MAX_CSV_ROWS) + " reached. Remaining rows ignored.")
            break

        sid  = (row.get("student_id") or "").strip().upper()
        name = (row.get("name") or "").strip()

        if not sid:
            errors.append("Row " + str(row_num) + ": student_id is missing")
            continue
        if not name:
            errors.append("Row " + str(row_num) + " (" + sid + "): name is missing")
            continue

        if Student.query.filter_by(student_id=sid).first():
            skipped.append(sid)
            continue

        # Resolve department � always set dept_id (M-4 audit fix)
        dept_id = None
        dept_raw = (row.get("department") or row.get("department_code") or "").strip().upper()
        if dept_raw:
            dept = Department.query.filter_by(code=dept_raw).first()
            if dept:
                dept_id = dept.id
            else:
                errors.append("Row " + str(row_num) + " (" + sid + "): Department '" + dept_raw + "' not found - using default")
        if dept_id is None:
            default_dept = Department.query.first()
            dept_id = default_dept.id if default_dept else None

        try:
            semester = int(row.get("semester") or 1)
            section  = (row.get("section") or "A").strip().upper()
        except (ValueError, TypeError):
            errors.append("Row " + str(row_num) + " (" + sid + "): Invalid semester/section value")
            continue

        try:
            # Savepoint per row � failure here won't wipe prior successes (H-3 fix)
            sp = db.session.begin_nested()
            s = Student(
                student_id             = sid,
                name                   = name,
                email                  = (row.get("email") or "").strip() or None,
                phone                  = (row.get("phone") or "").strip() or None,
                department_id          = dept_id,
                semester               = semester,
                section                = section,
                previous_gpa           = float(row.get("previous_gpa") or 0),
                backlogs               = int(row.get("backlogs") or 0),
                engagement             = row.get("engagement", "Medium").strip() or "Medium",
                final_result           = "Pending",
                attendance_pct         = 100.0,
                internal_marks         = 0.0,
                assignment_score_pct   = 0.0,
                course_performance_pct = 0.0,
                courses_data           = json.dumps(
                    Student.get_default_courses_for_semester(semester, section)
                ),
            )
            db.session.add(s)
            db.session.flush()
            sp.commit()
            created.append(sid)
        except Exception as ex:
            sp.rollback()
            errors.append("Row " + str(row_num) + " (" + sid + "): " + str(ex))

    db.session.commit()
    return jsonify({
        "created":         len(created),
        "created_ids":     created,
        "skipped":         skipped,
        "errors":          errors,
        "total_processed": row_num - 1,
    }), 201
