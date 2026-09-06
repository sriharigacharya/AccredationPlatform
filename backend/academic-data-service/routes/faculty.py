"""Faculty routes for academic-data-service."""

import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, Faculty, Department, FacultyProfileUpdate
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
    query_filter = (Faculty.faculty_id == faculty_id)
    if str(faculty_id).isdigit():
        query_filter = query_filter | (Faculty.id == int(faculty_id))
    fac = Faculty.query.filter(query_filter).first_or_404()
    return jsonify(fac.to_dict())


@faculty_bp.put("/<faculty_id>")
def update_faculty(faculty_id):
    """PUT /faculty/:faculty_id — Direct update (Admin only)."""
    role = request.headers.get("X-User-Role", "").lower()
    if role != "admin":
        return jsonify({"error": "Direct updates require administrator privileges. Please submit a profile update request for approval."}), 403

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


# ── Course Allocation (Admin Only) ───────────────────────────────────────────
@faculty_bp.route("/<faculty_id>/courses", methods=["PUT", "POST"], strict_slashes=False)
def allocate_courses(faculty_id):
    """Admin-only endpoint to directly assign or update allocated courses."""
    role = request.headers.get("X-User-Role", "").lower()
    if role != "admin":
        return jsonify({"error": "Only administrators can assign or modify allocated courses."}), 403

    fac = Faculty.query.filter_by(faculty_id=faculty_id).first_or_404()
    data = request.get_json(force=True) or {}
    courses = data.get("courses_taught")
    if courses is None:
        courses = data.get("courses", [])

    if not isinstance(courses, list):
        return jsonify({"error": "courses_taught must be a list of course names"}), 400

    # Clean and filter non-empty strings
    cleaned_courses = [str(c).strip() for c in courses if str(c).strip()]
    fac.courses_taught = json.dumps(cleaned_courses)
    db.session.commit()

    return jsonify({
        "message": f"Allocated courses updated successfully for {fac.name}",
        "courses_taught": cleaned_courses,
        "faculty": fac.to_dict()
    }), 200


# ── Teacher Profile Update Requests ──────────────────────────────────────────
@faculty_bp.route("/<faculty_id>/update-request", methods=["POST"], strict_slashes=False)
def submit_update_request(faculty_id):
    """
    Teacher submits proposed profile updates for admin approval.
    Editable by teacher: publications, fdp_participation, research_projects,
    certifications, awards, phone, qualification, experience, designation.
    NOTE: courses_taught cannot be changed by teachers — course allocation is admin only.
    """
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")
    user_id = request.headers.get("X-User-Id", "")

    # Security check: faculty member can only submit for themselves, or admin can submit
    if role != "admin" and linked_id != faculty_id and user_id != faculty_id:
        return jsonify({"error": "You can only submit profile update requests for your own profile"}), 403

    fac = Faculty.query.filter_by(faculty_id=faculty_id).first_or_404()
    data = request.get_json(force=True) or {}

    def to_json_str(val):
        if val is None:
            return None
        if isinstance(val, list):
            # Clean list of strings
            cleaned = [str(x).strip() for x in val if str(x).strip()]
            return json.dumps(cleaned)
        return str(val)

    # Check if there is already an active pending request for this faculty member
    existing = FacultyProfileUpdate.query.filter_by(
        faculty_id=faculty_id,
        status="pending"
    ).first()

    # Capture live snapshot of faculty data
    snapshot = json.dumps(fac.to_dict())

    # Build proposed field values
    pubs   = to_json_str(data.get("publications"))
    fdps   = to_json_str(data.get("fdp_participation"))
    grants = to_json_str(data.get("research_projects"))
    certs  = to_json_str(data.get("certifications"))
    awards = to_json_str(data.get("awards"))
    phone  = data.get("phone")
    qual   = data.get("qualification")
    exp    = data.get("experience")
    desig  = data.get("designation")
    note   = data.get("change_summary") or data.get("note", "")

    if existing:
        # Update the existing pending request with new proposed values
        existing.publications      = pubs if "publications" in data else existing.publications
        existing.fdp_participation = fdps if "fdp_participation" in data else existing.fdp_participation
        existing.research_projects = grants if "research_projects" in data else existing.research_projects
        existing.certifications    = certs if "certifications" in data else existing.certifications
        existing.awards            = awards if "awards" in data else existing.awards
        existing.phone             = phone if "phone" in data else existing.phone
        existing.qualification     = qual if "qualification" in data else existing.qualification
        existing.experience        = exp if "experience" in data else existing.experience
        existing.designation       = desig if "designation" in data else existing.designation
        existing.change_summary    = note or existing.change_summary
        existing.original_snapshot = snapshot
        existing.updated_at        = datetime.utcnow()
        db.session.commit()
        return jsonify({
            "message": "Existing pending update request updated successfully",
            "request": existing.to_dict()
        }), 200

    new_req = FacultyProfileUpdate(
        faculty_id       = faculty_id,
        status           = "pending",
        requested_by     = user_id or linked_id or faculty_id,
        change_summary   = note,
        publications      = pubs,
        fdp_participation = fdps,
        research_projects = grants,
        certifications    = certs,
        awards            = awards,
        phone             = phone,
        qualification     = qual,
        experience        = exp,
        designation       = desig,
        original_snapshot = snapshot,
    )
    db.session.add(new_req)
    db.session.commit()

    return jsonify({
        "message": "Profile update request submitted successfully. Pending admin approval.",
        "request": new_req.to_dict()
    }), 201


@faculty_bp.route("/update-requests", methods=["GET"], strict_slashes=False)
def list_update_requests():
    """
    List profile update requests.
    Admin: sees all requests (filterable by ?status=pending|approved|rejected).
    Teacher: sees only their own requests.
    """
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")
    status_filter = request.args.get("status")
    fac_filter = request.args.get("faculty_id")

    query = FacultyProfileUpdate.query

    if role != "admin":
        if not linked_id:
            return jsonify([]), 200
        query = query.filter_by(faculty_id=linked_id)
    elif fac_filter:
        query = query.filter_by(faculty_id=fac_filter)

    if status_filter:
        query = query.filter_by(status=status_filter.lower())

    records = query.order_by(FacultyProfileUpdate.created_at.desc()).all()
    return jsonify([r.to_dict() for r in records]), 200


@faculty_bp.route("/update-requests/<int:request_id>", methods=["GET"], strict_slashes=False)
def get_update_request(request_id):
    """Get single update request with diff."""
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")

    req_item = FacultyProfileUpdate.query.get_or_404(request_id)
    if role != "admin" and req_item.faculty_id != linked_id:
        return jsonify({"error": "Access denied"}), 403

    return jsonify(req_item.to_dict()), 200


@faculty_bp.route("/update-requests/<int:request_id>/approve", methods=["POST"], strict_slashes=False)
def approve_update_request(request_id):
    """Admin approves and merges proposed profile changes into the live Faculty record."""
    role = request.headers.get("X-User-Role", "").lower()
    admin_id = request.headers.get("X-User-Id", "") or "admin"

    if role != "admin":
        return jsonify({"error": "Only administrators can approve profile changes."}), 403

    req_item = FacultyProfileUpdate.query.get_or_404(request_id)
    if req_item.status != "pending":
        return jsonify({"error": f"Request is already {req_item.status}"}), 400

    fac = Faculty.query.filter_by(faculty_id=req_item.faculty_id).first_or_404()

    # Merge proposed changes into live Faculty model
    if req_item.publications is not None:
        fac.publications = req_item.publications
    if req_item.fdp_participation is not None:
        fac.fdp_participation = req_item.fdp_participation
    if req_item.research_projects is not None:
        fac.research_projects = req_item.research_projects
    if req_item.certifications is not None:
        fac.certifications = req_item.certifications
    if req_item.awards is not None:
        fac.awards = req_item.awards
    if req_item.phone is not None:
        fac.phone = req_item.phone
    if req_item.qualification is not None:
        fac.qualification = req_item.qualification
    if req_item.experience is not None:
        fac.experience = req_item.experience
    if req_item.designation is not None:
        fac.designation = req_item.designation

    req_item.status = "approved"
    req_item.reviewed_by = admin_id
    req_item.reviewed_at = datetime.utcnow()

    db.session.commit()

    return jsonify({
        "message": f"Profile update approved and applied to {fac.name}'s directory profile.",
        "request": req_item.to_dict(),
        "faculty": fac.to_dict()
    }), 200


@faculty_bp.route("/update-requests/<int:request_id>/reject", methods=["POST"], strict_slashes=False)
def reject_update_request(request_id):
    """Admin rejects proposed profile updates."""
    role = request.headers.get("X-User-Role", "").lower()
    admin_id = request.headers.get("X-User-Id", "") or "admin"

    if role != "admin":
        return jsonify({"error": "Only administrators can reject profile changes."}), 403

    req_item = FacultyProfileUpdate.query.get_or_404(request_id)
    if req_item.status != "pending":
        return jsonify({"error": f"Request is already {req_item.status}"}), 400

    data = request.get_json(force=True) or {}
    reason = data.get("reason") or data.get("rejection_reason") or "Changes not approved by department administration."

    req_item.status = "rejected"
    req_item.rejection_reason = reason
    req_item.reviewed_by = admin_id
    req_item.reviewed_at = datetime.utcnow()

    db.session.commit()

    return jsonify({
        "message": "Profile update request has been rejected.",
        "request": req_item.to_dict()
    }), 200


@faculty_bp.route("/update-requests/<int:request_id>", methods=["DELETE"], strict_slashes=False)
def cancel_update_request(request_id):
    """Cancel / withdraw a pending request."""
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")

    req_item = FacultyProfileUpdate.query.get_or_404(request_id)
    if role != "admin" and req_item.faculty_id != linked_id:
        return jsonify({"error": "Access denied"}), 403

    if req_item.status != "pending":
        return jsonify({"error": "Only pending update requests can be cancelled"}), 400

    db.session.delete(req_item)
    db.session.commit()

    return jsonify({"message": "Profile update request cancelled successfully."}), 200


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
