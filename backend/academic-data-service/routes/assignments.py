"""
Assignment routes — create, list, detail, student submissions.
Faculty: full CRUD and inspect student submissions.
Student: read own targeted assignments, submit coursework (text/file), view own submission.
"""

import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from models import db, Assignment, AssignmentTarget, AssignmentSubmission, Student, Faculty

assignments_bp = Blueprint("assignments", __name__)

ASSIGNMENT_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assignment_uploads")
os.makedirs(ASSIGNMENT_UPLOAD_FOLDER, exist_ok=True)

ALLOWED_ASSIGNMENT_EXTS = {
    "pdf", "docx", "doc", "zip", "tar", "gz", "py", "java", "cpp", "c", "txt", "ipynb", "png", "jpg", "jpeg"
}


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
        try:
            sem_val = int(target_id)
            students = Student.query.filter_by(semester=sem_val).all()
            return [s.student_id for s in students]
        except (ValueError, TypeError):
            return []

    return []


# ── POST /assignments ────────────────────────────────────────────────────────
@assignments_bp.route("", methods=["POST"], strict_slashes=False)
@assignments_bp.route("/", methods=["POST"], strict_slashes=False)
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

    course_code = (data.get("course_code") or "").strip()
    course_name = (data.get("course_name") or "").strip()

    # Create
    a = Assignment(
        type=data["type"],
        title=data["title"],
        description=data.get("description", ""),
        faculty_id=faculty_id,
        course_code=course_code or None,
        course_name=course_name or None,
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


# ── GET /assignments ─────────────────────────────────────────────────────────
@assignments_bp.route("", methods=["GET"], strict_slashes=False)
@assignments_bp.route("/", methods=["GET"], strict_slashes=False)
def list_assignments():
    """
    Faculty: GET /assignments/?faculty_id=FAC001
    Student: GET /assignments/?student_id=me (or automatic if role=student)
    """
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")

    # Student view — scoped to own targeted assignments
    student_id = request.args.get("student_id")
    if role == "student" or student_id == "me":
        student_id = linked_id or student_id

    if student_id and role == "student":
        target_rows = AssignmentTarget.query.filter_by(student_id=student_id).all()
        if not target_rows:
            return jsonify([])
        asgn_ids = list({t.assignment_id for t in target_rows})
        assignments = Assignment.query.filter(Assignment.id.in_(asgn_ids)) \
                          .order_by(Assignment.created_at.desc()).all()

        # Look up submissions for this student
        submissions = AssignmentSubmission.query.filter(
            AssignmentSubmission.assignment_id.in_(asgn_ids),
            AssignmentSubmission.student_id == student_id
        ).all()
        sub_map = {s.assignment_id: s for s in submissions}

        # Look up faculty names
        fac_ids = list({a.faculty_id for a in assignments if a.faculty_id})
        faculty_records = Faculty.query.filter(Faculty.faculty_id.in_(fac_ids)).all() if fac_ids else []
        fac_map = {f.faculty_id: f.name for f in faculty_records}

        res = []
        for a in assignments:
            d = a.to_dict()
            d["faculty_name"] = fac_map.get(a.faculty_id, a.faculty_id)
            sub = sub_map.get(a.id)
            if sub:
                d["is_submitted"] = True
                d["submission"] = sub.to_dict()
            else:
                d["is_submitted"] = False
                d["submission"] = None
            res.append(d)
        return jsonify(res)

    # Faculty view — by faculty_id
    faculty_id = request.args.get("faculty_id")
    if not faculty_id:
        faculty_id = linked_id

    if role == "admin":
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

    # Enrich faculty name
    fac_ids = list({a.faculty_id for a in assignments if a.faculty_id})
    faculty_records = Faculty.query.filter(Faculty.faculty_id.in_(fac_ids)).all() if fac_ids else []
    fac_map = {f.faculty_id: f.name for f in faculty_records}

    res = []
    for a in assignments:
        d = a.to_dict()
        d["faculty_name"] = fac_map.get(a.faculty_id, a.faculty_id)
        res.append(d)

    return jsonify(res)


# ── GET /assignments/<id> ────────────────────────────────────────────────────
@assignments_bp.get("/<int:assignment_id>")
def get_assignment(assignment_id):
    a = Assignment.query.get_or_404(assignment_id)
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")

    # Student: only if they are a target
    if role == "student":
        is_target = AssignmentTarget.query.filter_by(
            assignment_id=a.id, student_id=linked_id
        ).first()
        if not is_target:
            return jsonify({"error": "Access denied"}), 403

    d = a.to_dict(include_targets=(role in ("admin", "teacher")))
    f = Faculty.query.filter_by(faculty_id=a.faculty_id).first()
    if f:
        d["faculty_name"] = f.name
    return jsonify(d)


# ── POST /assignments/<id>/submit ────────────────────────────────────────────
@assignments_bp.post("/<int:assignment_id>/submit")
def submit_assignment(assignment_id):
    """
    Student submits coursework. Supports text/link and optional file upload.
    """
    role = request.headers.get("X-User-Role", "").lower()
    student_id = request.headers.get("X-Linked-Id", "")

    if role not in ("student", "admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    a = Assignment.query.get_or_404(assignment_id)

    # If student, verify target enrollment
    if role == "student":
        if not student_id:
            return jsonify({"error": "Student linked_id missing"}), 400
        is_target = AssignmentTarget.query.filter_by(
            assignment_id=a.id, student_id=student_id
        ).first()
        if not is_target:
            return jsonify({"error": "You are not enrolled in the targeted cohort for this assignment"}), 403
    else:
        # Admin / teacher proxy submission
        student_id = request.form.get("student_id") or (request.get_json(silent=True) or {}).get("student_id") or student_id

    submission_text = ""
    uploaded_file = None

    if request.content_type and "multipart/form-data" in request.content_type:
        submission_text = request.form.get("submission_text", "").strip()
        uploaded_file = request.files.get("file") or request.files.get("attachment")
    else:
        body = request.get_json(silent=True) or {}
        submission_text = (body.get("submission_text") or body.get("content") or "").strip()

    if not submission_text and not uploaded_file:
        return jsonify({"error": "Please provide submission text/links or attach a solution file"}), 400

    stored_filename = None
    orig_filename = None

    if uploaded_file and uploaded_file.filename:
        orig_filename = secure_filename(uploaded_file.filename)
        ext = orig_filename.rsplit(".", 1)[-1].lower() if "." in orig_filename else ""
        if ext not in ALLOWED_ASSIGNMENT_EXTS:
            return jsonify({"error": f"File type '.{ext}' not supported. Allowed formats: {', '.join(sorted(ALLOWED_ASSIGNMENT_EXTS))}"}), 400

        unique_name = f"sub_{assignment_id}_{student_id}_{uuid.uuid4().hex[:8]}.{ext}"
        dest_path = os.path.join(ASSIGNMENT_UPLOAD_FOLDER, unique_name)
        uploaded_file.save(dest_path)
        stored_filename = unique_name

    now = datetime.utcnow()
    status = "submitted"
    if a.due_date and now > a.due_date:
        status = "late"

    sub = AssignmentSubmission.query.filter_by(assignment_id=a.id, student_id=student_id).first()

    if sub:
        if submission_text:
            sub.submission_text = submission_text
        if stored_filename:
            if sub.attachment_path:
                old_p = os.path.join(ASSIGNMENT_UPLOAD_FOLDER, sub.attachment_path)
                if os.path.exists(old_p):
                    try:
                        os.remove(old_p)
                    except Exception:
                        pass
            sub.attachment_path = stored_filename
            sub.original_filename = orig_filename
        sub.status = status
        sub.updated_at = now
    else:
        sub = AssignmentSubmission(
            assignment_id=a.id,
            student_id=student_id,
            submission_text=submission_text,
            attachment_path=stored_filename,
            original_filename=orig_filename,
            status=status,
            submitted_at=now,
            updated_at=now,
        )
        db.session.add(sub)

    db.session.commit()
    return jsonify({
        "message": "Assignment solution submitted successfully",
        "submission": sub.to_dict()
    }), 201


# ── GET /assignments/<id>/submission ─────────────────────────────────────────
@assignments_bp.get("/<int:assignment_id>/submission")
def get_student_submission(assignment_id):
    """Fetch current student's submission for an assignment."""
    role = request.headers.get("X-User-Role", "").lower()
    linked_id = request.headers.get("X-Linked-Id", "")

    if role == "student":
        student_id = linked_id
    else:
        student_id = request.args.get("student_id") or linked_id

    sub = AssignmentSubmission.query.filter_by(assignment_id=assignment_id, student_id=student_id).first()
    return jsonify({"submission": sub.to_dict() if sub else None})


# ── GET /assignments/<id>/students ───────────────────────────────────────────
@assignments_bp.get("/<int:assignment_id>/students")
def get_assignment_students(assignment_id):
    """Faculty-only: list all student targets with real submission status."""
    role = request.headers.get("X-User-Role", "").lower()
    if role not in ("admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    a = Assignment.query.get_or_404(assignment_id)
    student_ids = [t.student_id for t in a.targets]

    # Enrich with student names
    students = Student.query.filter(Student.student_id.in_(student_ids)).all()
    student_map = {s.student_id: s for s in students}

    # Fetch submissions
    submissions = AssignmentSubmission.query.filter(
        AssignmentSubmission.assignment_id == a.id,
        AssignmentSubmission.student_id.in_(student_ids)
    ).all()
    sub_map = {s.student_id: s for s in submissions}

    result = []
    for sid in student_ids:
        s = student_map.get(sid)
        sub = sub_map.get(sid)
        result.append({
            "student_id": sid,
            "name": s.name if s else "Unknown",
            "section": s.section if s else "—",
            "semester": s.semester if s else 0,
            "submitted": sub is not None,
            "submitted_at": sub.submitted_at.isoformat() if sub and sub.submitted_at else None,
            "submission_text": sub.submission_text if sub else None,
            "attachment_path": sub.attachment_path if sub else None,
            "original_filename": sub.original_filename if sub else None,
            "status": sub.status if sub else "pending",
            "grade": sub.grade if sub else None,
            "feedback": sub.feedback if sub else None,
        })

    return jsonify({
        "assignment_id": a.id,
        "title": a.title,
        "course_code": a.course_code,
        "course_name": a.course_name,
        "students": result,
        "count": len(result),
        "submitted_count": len(submissions),
    })


# ── GET /assignments/submissions/download/<filename> ─────────────────────────
@assignments_bp.get("/submissions/download/<filename>")
def download_submission_file(filename):
    """Download or view an assignment submission proof attachment."""
    safe_name = secure_filename(filename)
    return send_from_directory(ASSIGNMENT_UPLOAD_FOLDER, safe_name, as_attachment=True)


# ── DELETE /assignments/<id> ─────────────────────────────────────────────────
@assignments_bp.delete("/<int:assignment_id>")
def delete_assignment(assignment_id):
    role = request.headers.get("X-User-Role", "").lower()
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
