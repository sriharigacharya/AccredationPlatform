"""Faculty routes for academic-data-service."""

import json
from flask import Blueprint, request, jsonify
from models import db, Faculty, Department
from sqlalchemy import func

faculty_bp = Blueprint("faculty", __name__)


@faculty_bp.get("/")
def list_faculty():
    """GET /faculty?department=CSE&search=..."""
    query     = Faculty.query
    dept_code = request.args.get("department")
    search    = request.args.get("search", "")

    if dept_code:
        dept = Department.query.filter_by(code=dept_code.upper()).first()
        if dept:
            query = query.filter_by(department_id=dept.id)
    if search:
        query = query.filter(
            Faculty.name.ilike(f"%{search}%") | Faculty.faculty_id.ilike(f"%{search}%")
        )

    fac_list = query.order_by(Faculty.name).all()
    return jsonify([f.to_dict() for f in fac_list])


@faculty_bp.post("/")
def create_faculty():
    """POST /faculty — create faculty record."""
    data = request.get_json(force=True) or {}
    required = ["faculty_id", "name"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required"}), 400

    if Faculty.query.filter_by(faculty_id=data["faculty_id"]).first():
        return jsonify({"error": "faculty_id already exists"}), 409

    dept_id = data.get("department_id")
    if not dept_id:
        dept = Department.query.first()
        dept_id = dept.id if dept else None

    def to_json(val):
        if isinstance(val, list):
            return json.dumps(val)
        return val

    fac = Faculty(
        faculty_id=data["faculty_id"],
        name=data["name"],
        email=data.get("email"),
        phone=data.get("phone"),
        department_id=dept_id,
        designation=data.get("designation"),
        qualification=data.get("qualification"),
        experience=data.get("experience"),
        courses_taught=to_json(data.get("courses_taught", [])),
        publications=to_json(data.get("publications", [])),
        fdp_participation=to_json(data.get("fdp_participation", [])),
        certifications=to_json(data.get("certifications", [])),
        research_projects=to_json(data.get("research_projects", [])),
        awards=to_json(data.get("awards", [])),
    )
    db.session.add(fac)
    db.session.commit()
    return jsonify(fac.to_dict()), 201


@faculty_bp.get("/<faculty_id>")
def get_faculty(faculty_id):
    """GET /faculty/:faculty_id — full profile."""
    fac = Faculty.query.filter_by(faculty_id=faculty_id).first_or_404()
    return jsonify(fac.to_dict())


@faculty_bp.put("/<faculty_id>")
def update_faculty(faculty_id):
    """PUT /faculty/:faculty_id."""
    fac = Faculty.query.filter_by(faculty_id=faculty_id).first_or_404()
    data = request.get_json(force=True) or {}

    def to_json(val):
        if isinstance(val, list):
            return json.dumps(val)
        return val

    simple_fields = ["name","email","phone","designation","qualification","experience","department_id"]
    json_fields   = ["courses_taught","publications","fdp_participation","certifications",
                     "research_projects","awards"]

    for f in simple_fields:
        if f in data:
            setattr(fac, f, data[f])
    for f in json_fields:
        if f in data:
            setattr(fac, f, to_json(data[f]))

    db.session.commit()
    return jsonify(fac.to_dict())


@faculty_bp.delete("/<faculty_id>")
def delete_faculty(faculty_id):
    """DELETE /faculty/:faculty_id."""
    fac = Faculty.query.filter_by(faculty_id=faculty_id).first_or_404()
    db.session.delete(fac)
    db.session.commit()
    return jsonify({"message": "Faculty record deleted"})


@faculty_bp.get("/<faculty_id>/report")
def faculty_report(faculty_id):
    """GET /faculty/:faculty_id/report — aggregated report card."""
    fac = Faculty.query.filter_by(faculty_id=faculty_id).first_or_404()
    d   = fac.to_dict()

    import json
    def count_list(val):
        try:
            return len(json.loads(val)) if val else 0
        except Exception:
            return 0

    report = {
        **d,
        "report": {
            "publication_count":  count_list(fac.publications),
            "fdp_count":          count_list(fac.fdp_participation),
            "certification_count":count_list(fac.certifications),
            "research_count":     count_list(fac.research_projects),
            "award_count":        count_list(fac.awards),
            "courses_count":      count_list(fac.courses_taught),
        }
    }
    return jsonify(report)


@faculty_bp.get("/stats/overview")
def faculty_stats():
    """GET /faculty/stats/overview — department-level summary."""
    total = Faculty.query.count()

    pub_count = 0
    fdp_count = 0
    for fac in Faculty.query.all():
        import json
        try:
            pub_count += len(json.loads(fac.publications or "[]"))
        except Exception:
            pass
        try:
            fdp_count += len(json.loads(fac.fdp_participation or "[]"))
        except Exception:
            pass

    return jsonify({
        "total_faculty":    total,
        "total_publications": pub_count,
        "total_fdps":       fdp_count,
    })
