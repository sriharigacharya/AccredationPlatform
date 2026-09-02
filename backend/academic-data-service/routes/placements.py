"""
Placement Routes — AcademiQ
Handles: student placement submission, offer letter upload, verification workflow,
and Criterion 4 Placement Index summary calculations.
"""

import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from werkzeug.utils import secure_filename
from models import db, Student, Department
from placement_models import StudentPlacement, VALID_PLACEMENT_STATUSES

placements_bp = Blueprint("placements", __name__)

ALLOWED_DOC_EXTS = {"pdf", "png", "jpg", "jpeg", "webp"}
MAX_DOC_SIZE     = 10 * 1024 * 1024  # 10 MB


def _get_user_context():
    """Extract user context from gateway-injected headers."""
    return {
        "user_id":   request.headers.get("X-User-Id", ""),
        "role":      request.headers.get("X-User-Role", ""),
        "linked_id": request.headers.get("X-Linked-Id", ""),
        "name":      request.headers.get("X-User-Name", ""),
    }


def _upload_dir():
    """Return (and create) the offer letters directory."""
    d = os.path.join(current_app.root_path, "offer_letters")
    os.makedirs(d, exist_ok=True)
    return d


def _allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_DOC_EXTS


# ── Student Placement Submission (Self or Admin) ───────────────────────────────

@placements_bp.post("/profile/placement")
@placements_bp.post("/placements/my")
def submit_placement():
    """
    POST /profile/placement (multipart/form-data)
    Student self-submission or Admin/Worker entry.

    Form fields:
      - student_id: optional for student (defaults to linked_id); required for worker/admin
      - status: placed | higher_studies | entrepreneur | not_placed
      - company_or_institution: text
      - role_or_program: text
      - ctc_or_stipend: text (e.g. "8.5 LPA")
      - academic_year: e.g. "2025-26"
      - final_year_cohort_year: int e.g. 2026
      - offer_letter: file (PDF/Image) - REQUIRED if status == 'placed'
    """
    ctx = _get_user_context()

    # Determine student_id
    if ctx["role"] == "student":
        student_id = ctx["linked_id"]
        if not student_id:
            return jsonify({"error": "Student linked ID missing from auth token"}), 400
    elif ctx["role"] in ("admin", "worker", "teacher"):
        student_id = request.form.get("student_id", "").strip() or request.json.get("student_id", "").strip() if request.is_json else request.form.get("student_id", "").strip()
        if not student_id:
            return jsonify({"error": "student_id is required"}), 400
    else:
        return jsonify({"error": "Access denied"}), 403

    # Check student exists
    stu = Student.query.filter_by(student_id=student_id).first()
    if not stu:
        return jsonify({"error": f"Student '{student_id}' not found"}), 404

    # Extract fields (support both form and json if no file)
    if request.content_type and "multipart/form-data" in request.content_type:
        data = request.form
        file = request.files.get("offer_letter")
    else:
        data = request.get_json(silent=True) or {}
        file = None

    status = data.get("status", "not_placed").lower().strip()
    if status not in VALID_PLACEMENT_STATUSES:
        return jsonify({"error": f"Invalid status. Allowed: {VALID_PLACEMENT_STATUSES}"}), 400

    company_inst = data.get("company_or_institution", "").strip()
    role_prog    = data.get("role_or_program", "").strip()
    ctc_stipend  = data.get("ctc_or_stipend", "").strip()
    acad_year    = data.get("academic_year", "2025-26").strip()

    try:
        cohort_yr = int(data.get("final_year_cohort_year", 2026))
    except (ValueError, TypeError):
        cohort_yr = 2026

    # Fetch existing record if any
    placement = StudentPlacement.query.filter_by(student_id=student_id).first()

    # Edit Lock Rule: Student cannot edit if already verified by admin
    if placement and placement.verified_by_admin and ctx["role"] == "student":
        return jsonify({
            "error": "This placement record has been verified by Administrator and is locked for editing. "
                     "Please contact an administrator to reopen your record."
        }), 403

    # Handle file upload
    stored_filename = placement.offer_letter_path if placement else None
    if file and file.filename:
        if not _allowed_file(file.filename):
            return jsonify({
                "error": f"File type not supported. Allowed formats: {', '.join(ALLOWED_DOC_EXTS)}"
            }), 400

        ext = file.filename.rsplit(".", 1)[1].lower()
        new_filename = secure_filename(f"offer_{student_id}_{uuid.uuid4().hex[:8]}.{ext}")
        upload_path = os.path.join(_upload_dir(), new_filename)
        file.save(upload_path)

        # Check size
        if os.path.getsize(upload_path) > MAX_DOC_SIZE:
            os.remove(upload_path)
            return jsonify({"error": f"File exceeds maximum size of {MAX_DOC_SIZE // (1024*1024)}MB"}), 400

        stored_filename = new_filename

    # Acceptance criterion: Offer letter is required when status = placed
    if status == "placed" and not stored_filename:
        return jsonify({
            "error": "An offer letter document (PDF or image) is mandatory when placement status is 'Placed'."
        }), 400

    if not placement:
        placement = StudentPlacement(
            student_id=student_id,
            status=status,
            company_or_institution=company_inst,
            role_or_program=role_prog,
            ctc_or_stipend=ctc_stipend,
            offer_letter_path=stored_filename,
            academic_year=acad_year,
            final_year_cohort_year=cohort_yr,
            verified_by_admin=False,
        )
        db.session.add(placement)
    else:
        placement.status = status
        placement.company_or_institution = company_inst
        placement.role_or_program = role_prog
        placement.ctc_or_stipend = ctc_stipend
        if stored_filename:
            placement.offer_letter_path = stored_filename
        placement.academic_year = acad_year
        placement.final_year_cohort_year = cohort_yr
        # If student edited an unverified record, it remains unverified
        if ctx["role"] == "student":
            placement.verified_by_admin = False

    db.session.commit()
    return jsonify(placement.to_dict(include_student=True)), 201 if not placement.id else 200


@placements_bp.get("/profile/placement")
@placements_bp.get("/placements/my")
def get_my_placement():
    """
    GET /profile/placement?student_id=me
    Returns current student's placement record.
    """
    ctx = _get_user_context()
    student_id = request.args.get("student_id")

    if student_id == "me" or not student_id:
        if ctx["role"] == "student":
            student_id = ctx["linked_id"]
        else:
            return jsonify({"error": "student_id parameter required"}), 400

    placement = StudentPlacement.query.filter_by(student_id=student_id).first()
    if not placement:
        return jsonify({
            "student_id": student_id,
            "status": "not_placed",
            "verified_by_admin": False,
            "has_offer_letter": False,
        })

    return jsonify(placement.to_dict(include_student=True))


# ── Admin & Faculty Verification Endpoints ─────────────────────────────────────

@placements_bp.get("/placements/")
def list_placements():
    """
    GET /placements/?academic_year=2025-26&cohort_year=2026&status=placed&verified=true
    Admin & Faculty verification roster.
    """
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "teacher", "worker"):
        return jsonify({"error": "Admin/Faculty access required"}), 403

    query = StudentPlacement.query

    acad_year = request.args.get("academic_year")
    if acad_year:
        query = query.filter_by(academic_year=acad_year)

    cohort_year = request.args.get("cohort_year", type=int)
    if cohort_year:
        query = query.filter_by(final_year_cohort_year=cohort_year)

    status = request.args.get("status")
    if status and status in VALID_PLACEMENT_STATUSES:
        query = query.filter_by(status=status)

    verified = request.args.get("verified")
    if verified is not None:
        is_verified = verified.lower() in ("true", "1", "yes")
        query = query.filter_by(verified_by_admin=is_verified)

    placements = query.order_by(StudentPlacement.submitted_at.desc()).all()
    return jsonify([p.to_dict(include_student=True) for p in placements])


@placements_bp.get("/placements/<int:placement_id>")
def get_placement(placement_id):
    """GET /placements/:id — single placement record."""
    placement = StudentPlacement.query.get_or_404(placement_id)
    return jsonify(placement.to_dict(include_student=True))


@placements_bp.get("/placements/student/<string:student_id>")
def get_student_placement(student_id):
    """GET /placements/student/:student_id — placement record by student_id."""
    placement = StudentPlacement.query.filter_by(student_id=student_id).first()
    if not placement:
        return jsonify({"status": "not_placed", "verified_by_admin": False, "student_id": student_id}), 404
    return jsonify(placement.to_dict(include_student=True))


@placements_bp.patch("/placements/<int:placement_id>/verify")
def verify_placement(placement_id):
    """
    PATCH /placements/:id/verify — Admin/Faculty marks record as verified.
    """
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Only Admin or Faculty can verify placements"}), 403

    placement = StudentPlacement.query.get_or_404(placement_id)
    placement.verified_by_admin = True
    placement.verified_by       = ctx["user_id"] or ctx["linked_id"] or ctx["name"]
    placement.verified_at       = datetime.utcnow()

    db.session.commit()
    return jsonify(placement.to_dict(include_student=True))


@placements_bp.patch("/placements/<int:placement_id>/unverify")
def unverify_placement(placement_id):
    """
    PATCH /placements/:id/unverify — Admin reopens placement verification for edits.
    """
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Admin access required to reopen placement records"}), 403

    placement = StudentPlacement.query.get_or_404(placement_id)
    placement.verified_by_admin = False
    placement.verified_by       = None
    placement.verified_at       = None

    db.session.commit()
    return jsonify(placement.to_dict(include_student=True))


# ── Cohort Summary & Placement Index (Criterion 4.5) ───────────────────────────

DEFAULT_COHORT_YEARS = [
    {"year": 2026, "academic_year": "2025-26", "label": "CAY (2025-26)"},
    {"year": 2025, "academic_year": "2024-25", "label": "LYG (2024-25)"},
    {"year": 2024, "academic_year": "2023-24", "label": "LYGm1 (2023-24)"},
    {"year": 2023, "academic_year": "2022-23", "label": "LYGm2 (2022-23)"},
]


@placements_bp.get("/placements/summary")
def placement_summary():
    """
    GET /placements/summary?cohort_years=2026,2025,2024,2023
    Calculates Criterion 4.5 Placement, Higher Studies & Entrepreneurship Index
    matching official NBA SAR Table B.4.8:
      P(year) = (Verified Placed + Higher Studies + Entrepreneurs) / Final-Year Cohort (N)
      Average Placement = (P_CAY + P_LYG + P_LYGm1 + P_LYGm2) / k (where k = available years)
      Assessment = 40 × Average Placement (max 40 marks)

    If fewer than 4 years are available, averages over available years and flags
    as provisional.
    """
    cohort_years_param = request.args.get("cohort_years")
    if cohort_years_param:
        try:
            target_years = [int(y.strip()) for y in cohort_years_param.split(",") if y.strip()]
        except ValueError:
            target_years = [2026, 2025, 2024, 2023]
    else:
        target_years = [2026, 2025, 2024, 2023]

    # Current final-year students count in DB
    current_final_year_students = Student.query.filter(Student.semester >= 7).all()
    base_cohort_size = len(current_final_year_students) if current_final_year_students else 32

    year_meta_map = {
        2026: {"academic_year": "2025-26", "label": "CAY (2025-26)"},
        2025: {"academic_year": "2024-25", "label": "LYG (2024-25)"},
        2024: {"academic_year": "2023-24", "label": "LYGm1 (2023-24)"},
        2023: {"academic_year": "2022-23", "label": "LYGm2 (2022-23)"},
    }

    years_data = []

    for yr in target_years:
        meta = year_meta_map.get(yr, {
            "academic_year": f"{yr-1}-{str(yr)[-2:]}",
            "label": f"Cohort {yr}",
        })

        placements_for_year = StudentPlacement.query.filter_by(
            final_year_cohort_year=yr
        ).all()

        total_submitted = len(placements_for_year)
        v_placed = 0
        v_higher = 0
        v_entrepreneur = 0
        v_not_placed = 0
        unverified_count = 0

        for p in placements_for_year:
            if p.verified_by_admin:
                if p.status == "placed":
                    v_placed += 1
                elif p.status == "higher_studies":
                    v_higher += 1
                elif p.status == "entrepreneur":
                    v_entrepreneur += 1
                elif p.status == "not_placed":
                    v_not_placed += 1
            else:
                unverified_count += 1

        v_career_positive = v_placed + v_higher + v_entrepreneur
        total_verified = v_career_positive + v_not_placed

        # Denominator N: Total final-year students in that cohort
        final_year_n = base_cohort_size

        p_ratio = (v_career_positive / final_year_n) if final_year_n > 0 else 0.0
        p_pct   = round(p_ratio * 100, 2)

        has_data = total_submitted > 0 or total_verified > 0

        years_data.append({
            "cohort_year": yr,
            "academic_year": meta["academic_year"],
            "label": meta["label"],
            "final_year_cohort_total": final_year_n,
            "total_submitted": total_submitted,
            "total_verified": total_verified,
            "unverified_pending": unverified_count,
            "verified_placed": v_placed,
            "verified_higher_studies": v_higher,
            "verified_entrepreneurs": v_entrepreneur,
            "verified_not_placed": v_not_placed,
            "verified_career_positive_total": v_career_positive,
            "placement_index_ratio": round(p_ratio, 4),
            "placement_index_pct": p_pct,
            "has_data": has_data,
        })

    # Available years calculation
    available_years = [y for y in years_data if y["has_data"]]
    k = len(available_years)

    if k == 0:
        avg_p_ratio = 0.0
        avg_p_pct   = 0.0
        assessment  = 0.0
        is_provisional = True
        provisional_notice = "No cohort placement data available yet."
    else:
        avg_p_ratio = sum(y["placement_index_ratio"] for y in available_years) / k
        avg_p_pct   = round(avg_p_ratio * 100, 2)
        assessment  = round(min(40.0, 40.0 * avg_p_ratio), 2)
        is_provisional = (k < 4)
        provisional_notice = (
            f"Provisional Assessment: Calculated across {k} available cohort year(s) instead of 4 completed cycles."
            if is_provisional else None
        )

    return jsonify({
        "years": years_data,
        "years_count": len(target_years),
        "years_available": k,
        "is_provisional": is_provisional,
        "provisional_notice": provisional_notice,
        "average_placement_index": round(avg_p_ratio, 4),
        "average_placement_pct": avg_p_pct,
        "assessment": assessment,
        "nba_criterion_4_marks": assessment,
        "max_marks": 40.0,
        "formula": "Assessment = 40 × Average Placement Index (averaged across CAY, LYG, LYGm1, LYGm2)",
    })


# ── Offer Letter Secure Serving ────────────────────────────────────────────────

@placements_bp.get("/offer-letters/<path:filename>")
def serve_offer_letter(filename):
    """
    GET /offer-letters/:filename
    Access control:
      - Admin and Faculty (teacher) can view for verification
      - Student can view only their own offer letter
      - Data Worker is explicitly excluded (403 Forbidden) due to personal compensation privacy
    """
    ctx = _get_user_context()
    safe_filename = os.path.basename(filename)

    placement = StudentPlacement.query.filter_by(offer_letter_path=safe_filename).first()
    if not placement:
        return jsonify({"error": "Offer letter document not found"}), 404

    # Strict Role & Ownership Access Control
    if ctx["role"] == "student":
        if placement.student_id != ctx["linked_id"]:
            return jsonify({"error": "Access denied: You can only view your own offer letter"}), 403
    elif ctx["role"] in ("admin", "teacher"):
        pass  # Authorized
    else:
        # Worker or unauthorized roles
        return jsonify({
            "error": "Access denied: Confidential compensation data — access restricted to student, faculty, and administrator."
        }), 403

    return send_from_directory(_upload_dir(), safe_filename)
