"""
Club management routes — Admin only for CRUD, all auth for listing.
"""

from flask import Blueprint, request, jsonify
from models import db, Faculty
from event_models import Club, StudentRole, VALID_CLUB_CATEGORIES

clubs_bp = Blueprint("clubs", __name__)


def _get_user_context():
    """Extract user context from gateway-injected headers."""
    return {
        "user_id":   request.headers.get("X-User-Id", ""),
        "role":      request.headers.get("X-User-Role", ""),
        "linked_id": request.headers.get("X-Linked-Id", ""),
        "name":      request.headers.get("X-User-Name", ""),
    }


@clubs_bp.get("/")
def list_clubs():
    """
    GET /clubs/?category=technical&mentor=FAC001
    All authenticated users can list clubs.
    Teachers see a `is_mentor` flag for clubs they mentor.
    """
    ctx = _get_user_context()
    query = Club.query

    # Filters
    category = request.args.get("category")
    if category:
        query = query.filter_by(category=category)

    mentor = request.args.get("mentor")
    if mentor:
        query = query.filter_by(mentor_faculty_id=mentor)

    clubs = query.order_by(Club.name).all()
    result = []
    for c in clubs:
        d = c.to_dict(include_mentor=True)
        # For teachers, flag clubs they mentor
        if ctx["role"] == "teacher" and ctx["linked_id"]:
            d["is_mentor"] = (c.mentor_faculty_id == ctx["linked_id"])
        # For students, include their role in this club
        if ctx["role"] == "student" and ctx["linked_id"]:
            sr = StudentRole.query.filter_by(
                club_id=c.id, student_id=ctx["linked_id"]
            ).first()
            d["my_role"] = sr.role if sr else None
        result.append(d)

    return jsonify(result)


@clubs_bp.get("/<int:club_id>")
def get_club(club_id):
    """GET /clubs/:id — single club detail with mentor info and roles."""
    club = Club.query.get_or_404(club_id)
    return jsonify(club.to_dict(include_mentor=True, include_roles=True))


@clubs_bp.post("/")
def create_club():
    """
    POST /clubs/ — Admin only.
    Body: { "name", "category", "description", "mentor_faculty_id" }
    """
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json(force=True) or {}
    name       = data.get("name", "").strip()
    category   = data.get("category", "other").lower()
    desc       = data.get("description", "").strip()
    mentor_fid = data.get("mentor_faculty_id", "").strip()

    if not name:
        return jsonify({"error": "Club name is required"}), 400
    if not mentor_fid:
        return jsonify({"error": "mentor_faculty_id is required"}), 400
    if category not in VALID_CLUB_CATEGORIES:
        return jsonify({"error": f"category must be one of: {', '.join(VALID_CLUB_CATEGORIES)}"}), 400

    # Validate mentor exists
    fac = Faculty.query.filter_by(faculty_id=mentor_fid).first()
    if not fac:
        return jsonify({"error": f"Faculty '{mentor_fid}' not found"}), 404

    # Check duplicate name
    if Club.query.filter_by(name=name).first():
        return jsonify({"error": f"Club '{name}' already exists"}), 409

    club = Club(
        name=name,
        category=category,
        description=desc,
        mentor_faculty_id=mentor_fid,
    )
    db.session.add(club)
    db.session.commit()

    return jsonify(club.to_dict(include_mentor=True)), 201


@clubs_bp.patch("/<int:club_id>")
def update_club(club_id):
    """
    PATCH /clubs/:id — Admin only.
    Updatable: name, category, description, mentor_faculty_id.
    """
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    club = Club.query.get_or_404(club_id)
    data = request.get_json(force=True) or {}

    if "name" in data:
        new_name = data["name"].strip()
        if new_name and new_name != club.name:
            existing = Club.query.filter_by(name=new_name).first()
            if existing and existing.id != club.id:
                return jsonify({"error": f"Club '{new_name}' already exists"}), 409
            club.name = new_name

    if "category" in data:
        cat = data["category"].lower()
        if cat in VALID_CLUB_CATEGORIES:
            club.category = cat

    if "description" in data:
        club.description = data["description"]

    if "mentor_faculty_id" in data:
        mentor_fid = data["mentor_faculty_id"].strip()
        if mentor_fid:
            fac = Faculty.query.filter_by(faculty_id=mentor_fid).first()
            if not fac:
                return jsonify({"error": f"Faculty '{mentor_fid}' not found"}), 404
            club.mentor_faculty_id = mentor_fid

    db.session.commit()
    return jsonify(club.to_dict(include_mentor=True))
