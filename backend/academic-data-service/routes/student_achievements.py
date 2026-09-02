"""
Student Achievements Routes — AcademiQ
Handles:
  - Student self-submission & Worker/Admin fallback submission for external competitions
  - Faculty/Admin verification queue (approve / reject with remarks)
  - Unified report endpoint for NBA Criterion 4 (Section 4.6.3) grouped by academic year
  - Multi-file attachments (mandatory certificate proof + optional event photos)

"""

import os
import json
import uuid
from datetime import datetime, date
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from werkzeug.utils import secure_filename

from models import db, Student
from achievement_models import StudentAchievement

student_achievements_bp = Blueprint("student_achievements", __name__)

ALLOWED_DOC_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_PHOTO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
VALID_ACTIVITY_TYPES = {"technical", "sports", "cultural", "other"}
VALID_EVENT_SCOPES = {"within_state", "outside_state", "national", "international"}
VALID_STATUSES = {"pending", "verified", "rejected"}


def _get_user_context() -> dict:
    """Extract user context from headers injected by API gateway."""
    return {
        "user_id":   request.headers.get("X-User-Id", ""),
        "role":      request.headers.get("X-User-Role", "student"),
        "linked_id": request.headers.get("X-User-Linked-Id", ""),
        "name":      request.headers.get("X-User-Name", ""),
    }


def _proofs_dir() -> str:
    path = os.path.join(current_app.root_path, "achievement_uploads", "proofs")
    os.makedirs(path, exist_ok=True)
    return path


def _photos_dir() -> str:
    path = os.path.join(current_app.root_path, "achievement_uploads", "photos")
    os.makedirs(path, exist_ok=True)
    return path


def _save_file(file_obj, target_dir: str, allowed_exts: set) -> str:
    orig_name = secure_filename(file_obj.filename)
    _, ext = os.path.splitext(orig_name.lower())
    if ext not in allowed_exts:
        raise ValueError(f"Unsupported file format '{ext}'. Allowed: {', '.join(allowed_exts)}")
    unique_name = f"{uuid.uuid4().hex[:12]}_{orig_name}"
    file_obj.save(os.path.join(target_dir, unique_name))
    return unique_name


# ── Submission Endpoints ───────────────────────────────────────────────────────

@student_achievements_bp.post("/student-achievements")
def submit_achievement():
    """
    POST /student-achievements
    Submits a new student achievement record.
    Supports multipart/form-data with proof document and optional photos.
    Submitted via:
      - student (self/team)
      - worker / admin (fallback entry on behalf of students)
    """
    ctx = _get_user_context()
    is_multipart = request.content_type and "multipart/form-data" in request.content_type
    data = request.form.to_dict() if is_multipart else (request.get_json() or {})

    # Determine primary student_id
    if ctx["role"] == "student":
        primary_student_id = ctx["linked_id"] or data.get("student_id")
        submitted_via = "student"
    else:
        primary_student_id = data.get("student_id")
        submitted_via = ctx["role"] if ctx["role"] in ("worker", "admin") else "admin"

    if not primary_student_id:
        return jsonify({"error": "student_id is required"}), 400

    # Parse team student_ids if provided
    raw_team = data.get("student_ids")
    if isinstance(raw_team, list):
        team_ids = [str(sid).strip().upper() for sid in raw_team if str(sid).strip()]
    elif isinstance(raw_team, str) and raw_team.strip():
        try:
            parsed = json.loads(raw_team)
            if isinstance(parsed, list):
                team_ids = [str(sid).strip().upper() for sid in parsed if str(sid).strip()]
            else:
                team_ids = [s.strip().upper() for s in raw_team.split(",") if s.strip()]
        except Exception:
            team_ids = [s.strip().upper() for s in raw_team.split(",") if s.strip()]
    else:
        team_ids = [primary_student_id.upper()]

    if primary_student_id.upper() not in team_ids:
        team_ids.insert(0, primary_student_id.upper())

    # Mandatory fields
    event_name         = data.get("event_name", "").strip()
    organizing_body    = data.get("organizing_body", "").strip()
    activity_type      = data.get("activity_type", "technical").strip().lower()
    event_scope        = data.get("event_scope", "within_state").strip().lower()
    event_date_str     = data.get("event_date", "").strip()
    academic_year      = data.get("academic_year", "2025-26").strip()
    venue              = data.get("venue", "").strip()
    result_description = data.get("result_description", "").strip()
    remarks            = data.get("remarks", "").strip() or None

    if not event_name or not organizing_body or not result_description or not venue:
        return jsonify({"error": "event_name, organizing_body, venue, and result_description are required"}), 400

    if activity_type not in VALID_ACTIVITY_TYPES:
        activity_type = "technical"
    if event_scope not in VALID_EVENT_SCOPES:
        event_scope = "within_state"

    try:
        event_date = datetime.strptime(event_date_str, "%Y-%m-%d").date() if event_date_str else date.today()
    except ValueError:
        event_date = date.today()

    # Proof document handling (Mandatory)
    proof_filename = None
    if is_multipart and "proof_file" in request.files:
        p_file = request.files["proof_file"]
        if p_file and p_file.filename:
            try:
                proof_filename = _save_file(p_file, _proofs_dir(), ALLOWED_DOC_EXTENSIONS)
            except ValueError as e:
                return jsonify({"error": str(e)}), 400

    if not proof_filename:
        # Check if pre-existing path was supplied
        proof_filename = data.get("proof_file_path")

    if not proof_filename:
        return jsonify({"error": "Certificate or proof document (proof_file) is required"}), 400

    # Photos handling (Optional multiple)
    photo_filenames = []
    if is_multipart and "photos" in request.files:
        photo_files = request.files.getlist("photos")
        for pf in photo_files:
            if pf and pf.filename:
                try:
                    p_name = _save_file(pf, _photos_dir(), ALLOWED_PHOTO_EXTENSIONS)
                    photo_filenames.append(p_name)
                except ValueError as e:
                    return jsonify({"error": f"Photo upload error: {str(e)}"}), 400

    achievement = StudentAchievement(
        student_id=primary_student_id.upper(),
        student_ids=team_ids,
        activity_type=activity_type,
        event_name=event_name,
        organizing_body=organizing_body,
        event_scope=event_scope,
        event_date=event_date,
        academic_year=academic_year,
        venue=venue,
        result_description=result_description,
        remarks=remarks,
        proof_file_path=proof_filename,
        photo_paths=photo_filenames,
        submitted_via=submitted_via,
        submitted_by=ctx["user_id"] or ctx["name"] or primary_student_id,
        verification_status="pending",
    )

    db.session.add(achievement)
    db.session.commit()

    return jsonify(achievement.to_dict(include_students=True)), 201


# ── Listing & Query Endpoints ──────────────────────────────────────────────────

@student_achievements_bp.get("/student-achievements")
def list_achievements():
    """
    GET /student-achievements
    Query parameters:
      - status: pending | verified | rejected | all
      - student_id: specific student ID or 'me'
      - activity_type: technical | sports | cultural | other
      - academic_year: e.g. 2025-26
      - event_scope: within_state | outside_state | national | international
      - search: string filter
    """
    ctx = _get_user_context()
    query = StudentAchievement.query

    status = request.args.get("status")
    if status and status in VALID_STATUSES:
        query = query.filter_by(verification_status=status)

    student_id = request.args.get("student_id")
    if student_id:
        target_id = ctx["linked_id"].upper() if student_id == "me" else student_id.upper()
        # Find where student is primary student_id OR in student_ids JSON list
        # For Postgres JSON search:
        query = query.filter(
            db.or_(
                StudentAchievement.student_id == target_id,
                StudentAchievement.student_ids.contains(target_id)
            )
        )

    act_type = request.args.get("activity_type")
    if act_type and act_type in VALID_ACTIVITY_TYPES:
        query = query.filter_by(activity_type=act_type)

    acad_year = request.args.get("academic_year")
    if acad_year:
        query = query.filter_by(academic_year=acad_year)

    scope = request.args.get("event_scope")
    if scope and scope in VALID_EVENT_SCOPES:
        query = query.filter_by(event_scope=scope)

    search = request.args.get("search")
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            db.or_(
                StudentAchievement.event_name.ilike(term),
                StudentAchievement.organizing_body.ilike(term),
                StudentAchievement.result_description.ilike(term),
                StudentAchievement.venue.ilike(term),
                StudentAchievement.student_id.ilike(term),
            )
        )

    achievements = query.order_by(StudentAchievement.event_date.desc(), StudentAchievement.submitted_at.desc()).all()
    return jsonify([a.to_dict(include_students=True) for a in achievements])


@student_achievements_bp.get("/student-achievements/<int:achievement_id>")
def get_achievement(achievement_id):
    """GET /student-achievements/:id — single record."""
    achievement = StudentAchievement.query.get_or_404(achievement_id)
    return jsonify(achievement.to_dict(include_students=True))


@student_achievements_bp.patch("/student-achievements/<int:achievement_id>")
def update_achievement(achievement_id):
    """
    PATCH /student-achievements/:id
    Allows student to edit an unverified/rejected submission, or Admin to update.
    """
    ctx = _get_user_context()
    achievement = StudentAchievement.query.get_or_404(achievement_id)

    # Permission check: submitting student or admin/worker
    is_owner = (ctx["role"] == "student" and (achievement.student_id == ctx["linked_id"] or ctx["linked_id"] in (achievement.student_ids or [])))
    if not is_owner and ctx["role"] not in ("admin", "teacher", "worker"):
        return jsonify({"error": "Access denied"}), 403

    # If student is editing a verified record, deny (must be reopened by admin)
    if ctx["role"] == "student" and achievement.verification_status == "verified":
        return jsonify({"error": "Verified achievements are locked from edits. Contact administrator to update."}), 403

    is_multipart = request.content_type and "multipart/form-data" in request.content_type
    data = request.form.to_dict() if is_multipart else (request.get_json() or {})

    # Update basic fields if provided
    if "event_name" in data and data["event_name"].strip():
        achievement.event_name = data["event_name"].strip()
    if "organizing_body" in data and data["organizing_body"].strip():
        achievement.organizing_body = data["organizing_body"].strip()
    if "activity_type" in data and data["activity_type"] in VALID_ACTIVITY_TYPES:
        achievement.activity_type = data["activity_type"]
    if "event_scope" in data and data["event_scope"] in VALID_EVENT_SCOPES:
        achievement.event_scope = data["event_scope"]
    if "academic_year" in data and data["academic_year"].strip():
        achievement.academic_year = data["academic_year"].strip()
    if "venue" in data and data["venue"].strip():
        achievement.venue = data["venue"].strip()
    if "result_description" in data and data["result_description"].strip():
        achievement.result_description = data["result_description"].strip()
    if "remarks" in data:
        achievement.remarks = data["remarks"].strip() or None
    if "event_date" in data and data["event_date"].strip():
        try:
            achievement.event_date = datetime.strptime(data["event_date"].strip(), "%Y-%m-%d").date()
        except ValueError:
            pass

    # Update team members if provided
    if "student_ids" in data:
        raw_team = data["student_ids"]
        if isinstance(raw_team, list):
            achievement.student_ids = [str(sid).strip().upper() for sid in raw_team if str(sid).strip()]
        elif isinstance(raw_team, str):
            try:
                parsed = json.loads(raw_team)
                if isinstance(parsed, list):
                    achievement.student_ids = [str(sid).strip().upper() for sid in parsed if str(sid).strip()]
                else:
                    achievement.student_ids = [s.strip().upper() for s in raw_team.split(",") if s.strip()]
            except Exception:
                achievement.student_ids = [s.strip().upper() for s in raw_team.split(",") if s.strip()]

    # Proof document replacement
    if is_multipart and "proof_file" in request.files:
        p_file = request.files["proof_file"]
        if p_file and p_file.filename:
            try:
                achievement.proof_file_path = _save_file(p_file, _proofs_dir(), ALLOWED_DOC_EXTENSIONS)
            except ValueError as e:
                return jsonify({"error": str(e)}), 400

    # Photos addition
    if is_multipart and "photos" in request.files:
        photo_files = request.files.getlist("photos")
        current_photos = list(achievement.photo_paths or [])
        for pf in photo_files:
            if pf and pf.filename:
                try:
                    p_name = _save_file(pf, _photos_dir(), ALLOWED_PHOTO_EXTENSIONS)
                    current_photos.append(p_name)
                except ValueError as e:
                    return jsonify({"error": str(e)}), 400
        achievement.photo_paths = current_photos

    # If student re-submits a rejected record, reset to pending
    if ctx["role"] == "student" and achievement.verification_status == "rejected":
        achievement.verification_status = "pending"
        achievement.rejection_reason    = None

    achievement.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(achievement.to_dict(include_students=True))


@student_achievements_bp.delete("/student-achievements/<int:achievement_id>")
def delete_achievement(achievement_id):
    """DELETE /student-achievements/:id — delete submission."""
    ctx = _get_user_context()
    achievement = StudentAchievement.query.get_or_404(achievement_id)

    is_owner = (ctx["role"] == "student" and achievement.student_id == ctx["linked_id"])
    if not is_owner and ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    if ctx["role"] == "student" and achievement.verification_status == "verified":
        return jsonify({"error": "Verified achievements cannot be deleted by students"}), 403

    db.session.delete(achievement)
    db.session.commit()
    return jsonify({"message": "Achievement record deleted successfully", "id": achievement_id})


# ── Faculty & Admin Verification Actions ───────────────────────────────────────

@student_achievements_bp.patch("/student-achievements/<int:achievement_id>/verify")
def verify_achievement(achievement_id):
    """
    PATCH /student-achievements/:id/verify
    Admin or Faculty marks record as verified.
    """
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Only Faculty or Admin can verify achievements"}), 403

    achievement = StudentAchievement.query.get_or_404(achievement_id)
    achievement.verification_status = "verified"
    achievement.rejection_reason    = None
    achievement.verified_by         = ctx["user_id"] or ctx["linked_id"] or ctx["name"] or "Faculty Verifier"
    achievement.verified_at         = datetime.utcnow()

    db.session.commit()
    return jsonify(achievement.to_dict(include_students=True))


@student_achievements_bp.patch("/student-achievements/<int:achievement_id>/reject")
def reject_achievement(achievement_id):
    """
    PATCH /student-achievements/:id/reject
    Admin or Faculty rejects record with a mandatory or optional reason.
    """
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Only Faculty or Admin can reject achievements"}), 403

    body = request.get_json() or {}
    reason = body.get("rejection_reason", "").strip() or "Proof document insufficient or event criteria not met."

    achievement = StudentAchievement.query.get_or_404(achievement_id)
    achievement.verification_status = "rejected"
    achievement.rejection_reason    = reason
    achievement.verified_by         = ctx["user_id"] or ctx["linked_id"] or ctx["name"] or "Faculty Verifier"
    achievement.verified_at         = datetime.utcnow()

    db.session.commit()
    return jsonify(achievement.to_dict(include_students=True))


# ── Unified NBA Report Query (Criterion 4.6.3) ─────────────────────────────────

@student_achievements_bp.get("/student-achievements/report")
@student_achievements_bp.get("/reports/student-achievements")
def achievements_report():
    """
    GET /student-achievements/report?academic_year=
    Unified table query for NBA Criterion 4 (Section 4.6.3).
    CRITICAL ACCEPTANCE CRITERIA:
      1. ONLY verification_status == 'verified' records are returned.
      2. Technical, sports, cultural, and other achievements are NOT separated;
         they are rendered together in ONE UNIFIED TABLE grouped by academic year.
    """
    acad_year = request.args.get("academic_year")

    # Strict verified-only filter
    query = StudentAchievement.query.filter_by(verification_status="verified")
    if acad_year:
        query = query.filter_by(academic_year=acad_year)

    achievements = query.order_by(
        StudentAchievement.academic_year.desc(),
        StudentAchievement.event_date.desc()
    ).all()

    # Group by academic year
    years_map = {}
    for a in achievements:
        ay = a.academic_year
        if ay not in years_map:
            years_map[ay] = []
        years_map[ay].append(a.to_dict(include_students=True))

    # Format into grouped array
    grouped_years = []
    for ay in sorted(years_map.keys(), reverse=True):
        items = years_map[ay]
        grouped_years.append({
            "academic_year": ay,
            "total_achievements": len(items),
            "technical_count": sum(1 for x in items if x["activity_type"] == "technical"),
            "sports_count": sum(1 for x in items if x["activity_type"] == "sports"),
            "cultural_count": sum(1 for x in items if x["activity_type"] == "cultural"),
            "other_count": sum(1 for x in items if x["activity_type"] == "other"),
            "achievements": items,
        })

    return jsonify({
        "total_verified_achievements": len(achievements),
        "academic_years_count": len(grouped_years),
        "unified_by_year": grouped_years,
        "nba_section": "Criterion 4 — Section 4.6.3: Student Participation in Inter-Institute Events",
        "format_note": "Unified single-table presentation combining Technical, Sports, and Cultural achievements grouped chronologically by academic year.",
    })



# ── File Serving Endpoints ─────────────────────────────────────────────────────

@student_achievements_bp.get("/achievement-proofs/<path:filename>")
def serve_achievement_proof(filename):
    """GET /achievement-proofs/:filename — serves certificate/proof document."""
    safe_filename = os.path.basename(filename)
    return send_from_directory(_proofs_dir(), safe_filename)


@student_achievements_bp.get("/achievement-photos/<path:filename>")
def serve_achievement_photo(filename):
    """GET /achievement-photos/:filename — serves achievement event photos."""
    safe_filename = os.path.basename(filename)
    return send_from_directory(_photos_dir(), safe_filename)
