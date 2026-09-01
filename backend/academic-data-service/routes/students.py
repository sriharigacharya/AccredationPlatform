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

    # Handle courses_data as JSON
    courses_data = data.get("courses_data")
    if courses_data and isinstance(courses_data, list):
        courses_data = json.dumps(courses_data)

    s = Student(
        student_id=data["student_id"],
        name=data["name"],
        email=data.get("email"),
        phone=data.get("phone"),
        department_id=dept_id,
        semester=data.get("semester", 1),
        attendance_pct=data.get("attendance_pct", 0.0),
        internal_marks=data.get("internal_marks", 0.0),
        assignment_score_pct=data.get("assignment_score_pct", 0.0),
        previous_gpa=data.get("previous_gpa", 0.0),
        backlogs=data.get("backlogs", 0),
        course_performance_pct=data.get("course_performance_pct", 0.0),
        engagement=data.get("engagement", "Medium"),
        final_result=data.get("final_result"),
        courses_data=courses_data,
    )
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@students_bp.get("/<student_id>")
def get_student(student_id):
    """
    GET /students/:student_id — full profile.
    student role: only allowed to fetch their own linked_id.
    """
    role      = _get_role()
    linked_id = _get_linked_id()

    if _is_readonly_role(role) and student_id != linked_id:
        return jsonify({"error": "You can only view your own record"}), 403

    s = Student.query.filter_by(student_id=student_id).first_or_404()
    return jsonify(s.to_dict(include_dept=True))


@students_bp.put("/<student_id>")
def update_student(student_id):
    """PUT /students/:student_id — update fields. Teacher or Admin only."""
    role = _get_role()
    if _is_readonly_role(role):
        return jsonify({"error": "Students cannot modify records"}), 403

    s = Student.query.filter_by(student_id=student_id).first_or_404()
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

    s = Student.query.filter_by(student_id=student_id).first_or_404()
    db.session.delete(s)
    db.session.commit()
    return jsonify({"message": "Student deleted"}), 200


@students_bp.get("/<student_id>/analytics")
def student_analytics(student_id):
    """
    GET /students/:student_id/analytics
    Returns computed risk indicators without running the ML model.
    student role: only their own record.
    """
    role      = _get_role()
    linked_id = _get_linked_id()

    if _is_readonly_role(role) and student_id != linked_id:
        return jsonify({"error": "You can only view your own analytics"}), 403

    s = Student.query.filter_by(student_id=student_id).first_or_404()

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
        "student_id":   student_id,
        "overall_risk": overall_risk,
        "risk_flags":   risks,
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
