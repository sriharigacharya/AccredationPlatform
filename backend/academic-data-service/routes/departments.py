"""Department routes for academic-data-service."""

import json
from flask import Blueprint, request, jsonify
from models import db, Department

departments_bp = Blueprint("departments", __name__)


@departments_bp.get("/")
def list_departments():
    """GET /departments — list all departments."""
    depts = Department.query.all()
    return jsonify([d.to_dict() for d in depts])


@departments_bp.post("/")
def create_department():
    """POST /departments — create a new department."""
    data = request.get_json(force=True) or {}
    if not data.get("code") or not data.get("name"):
        return jsonify({"error": "code and name are required"}), 400
    if Department.query.filter_by(code=data["code"].upper()).first():
        return jsonify({"error": "Department code already exists"}), 409

    def to_json(val):
        if isinstance(val, list):
            return json.dumps(val)
        return val

    dept = Department(
        code=data["code"].upper(),
        name=data["name"],
        vision=data.get("vision"),
        mission=data.get("mission"),
        peos=to_json(data.get("peos")),
        pos=to_json(data.get("pos")),
        cos=to_json(data.get("cos")),
        placement_stats=to_json(data.get("placement_stats")),
        research_stats=to_json(data.get("research_stats")),
        infrastructure=to_json(data.get("infrastructure")),
        academic_activities=to_json(data.get("academic_activities")),
        training_programmes=to_json(data.get("training_programmes")),
        clubs=to_json(data.get("clubs")),
        awards=to_json(data.get("awards")),
        industry_interaction=to_json(data.get("industry_interaction")),
    )
    db.session.add(dept)
    db.session.commit()
    return jsonify(dept.to_dict()), 201


@departments_bp.get("/<int:dept_id>")
def get_department(dept_id):
    """GET /departments/:id — full department profile."""
    dept = Department.query.get_or_404(dept_id)
    return jsonify(dept.to_dict())


@departments_bp.put("/<int:dept_id>")
def update_department(dept_id):
    """PUT /departments/:id — update department info."""
    dept = Department.query.get_or_404(dept_id)
    data = request.get_json(force=True) or {}

    def to_json(val):
        if isinstance(val, list):
            return json.dumps(val)
        return val

    simple = ["name","vision","mission"]
    json_f  = ["peos","pos","cos","placement_stats","research_stats","infrastructure",
                "academic_activities","training_programmes","clubs","awards","industry_interaction"]

    for f in simple:
        if f in data:
            setattr(dept, f, data[f])
    for f in json_f:
        if f in data:
            setattr(dept, f, to_json(data[f]))

    db.session.commit()
    return jsonify(dept.to_dict())


@departments_bp.get("/<int:dept_id>/summary")
def department_summary(dept_id):
    """GET /departments/:id/summary — compact card for dashboards."""
    dept = Department.query.get_or_404(dept_id)
    from models import Student, Faculty

    student_count = Student.query.filter_by(department_id=dept_id).count()
    faculty_count = Faculty.query.filter_by(department_id=dept_id).count()

    return jsonify({
        "id":             dept.id,
        "code":           dept.code,
        "name":           dept.name,
        "student_count":  student_count,
        "faculty_count":  faculty_count,
        "vision":         dept.vision,
        "mission":        dept.mission,
    })
