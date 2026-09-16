"""
Event routes — submission, editing, mentor approval/rejection, photo management.

Authorization matrix:
  Student (head/council) → submit + edit (while pending) for own club
  Worker                 → submit via submitted_via=worker
  Admin                  → submit via submitted_via=admin, read-only audit
  Teacher (mentor)       → view pending, fill NBA fields, approve/reject (final)
"""

import os
import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from werkzeug.utils import secure_filename
from models import db, Faculty, Student, ClassAttendanceSession, ClassAttendanceEntry
from event_models import (
    Club, StudentRole, Event, EventPhoto, EventRegistration, EventAttendanceAward,
    EventStatus, EventAttendanceStatus,
    VALID_EVENT_TYPES, VALID_SUBMITTED_VIA, VALID_EVENT_STATUSES,
)

events_bp = Blueprint("events", __name__)

ALLOWED_PHOTO_EXTS = {"jpg", "jpeg", "png", "webp"}
MAX_PHOTO_SIZE     = 5 * 1024 * 1024   # 5 MB
MAX_PHOTOS         = 10


def _get_user_context():
    """Extract user context from gateway-injected headers."""
    role = (request.headers.get("X-User-Role") or "").strip().lower()
    if role == "faculty":
        role = "teacher"
    return {
        "user_id":   request.headers.get("X-User-Id", ""),
        "role":      role,
        "linked_id": request.headers.get("X-Linked-Id", ""),
        "name":      request.headers.get("X-User-Name", ""),
    }


def _upload_dir():
    """Return (and create) the event uploads directory."""
    d = os.path.join(current_app.root_path, "event_uploads")
    os.makedirs(d, exist_ok=True)
    return d


def _allowed_photo(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_PHOTO_EXTS


def _enrich_event(event, include_photos=True):
    """Add club_name, organizer_name, reviewer_name, and thumbnail_url to event dict."""
    d = event.to_dict(include_photos=include_photos)
    club = Club.query.get(event.club_id)
    d["club_name"] = club.name if club else None
    stu = Student.query.filter_by(student_id=event.organized_by_student_id).first()
    d["organizer_name"] = stu.name if stu else None
    if event.reviewed_by:
        fac = Faculty.query.filter_by(faculty_id=event.reviewed_by).first()
        d["reviewer_name"] = fac.name if fac else None
    else:
        d["reviewer_name"] = None

    # Registrations summary
    regs = event.registrations if hasattr(event, "registrations") else []
    d["registration_count"] = len(regs)
    d["attended_count"] = sum(
        1 for r in regs
        if getattr(r, "status", "") in ("present", "walk_in", "attended")
        or getattr(r, "attendance_status", "") in ("present", "walk_in", "attended")
    )
    if event.attendee_count and event.attendee_count > d["attended_count"]:
        d["attended_count"] = event.attendee_count
    ctx = _get_user_context()
    if ctx.get("role") == "student" and ctx.get("linked_id"):
        user_reg = next((r for r in regs if r.student_id == ctx["linked_id"]), None)
        d["user_registration"] = user_reg.to_dict() if user_reg else None
        d["is_user_registered"] = user_reg is not None
    else:
        d["user_registration"] = None
        d["is_user_registered"] = False

    # First photo as thumbnail
    if event.photos:
        first_photo = event.photos[0]
        photo_file = getattr(first_photo, "file_path", None) or getattr(first_photo, "photo_path", None)
        d["thumbnail_path"] = photo_file
        d["thumbnail_url"]  = f"/api/v1/event-photos/{photo_file}" if photo_file else None
    else:
        d["thumbnail_path"] = None
        d["thumbnail_url"]  = None
    return d



# ── Club-scoped event submission & listing ─────────────────────────────────────


@events_bp.post("/clubs/<int:club_id>/events")
@events_bp.post("/events")
@events_bp.post("/events/")
def create_event(club_id=None):
    """
    POST /clubs/:id/events or POST /events (multipart/form-data)

    Form fields: title, event_type, description, venue, event_date,
                 attendee_count, guest_names (JSON), report_text,
                 po_mapping?, resource_person?, skill_orientation?, club_id?
    Files: photos (multiple, optional)

    Who can submit:
      - student with head|council role in this club → submitted_via=club_head
      - student (any member or enrolled student)   → submitted_via=student
      - worker role                               → submitted_via=worker
      - admin role                                → submitted_via=admin
    """
    ctx = _get_user_context()
    body_json = request.get_json(silent=True) or {}

    def _val(k, default=""):
        v = request.form.get(k)
        if v is None:
            v = body_json.get(k, default)
        return str(v).strip() if isinstance(v, str) else (v if v is not None else default)

    if club_id is None:
        raw_cid = request.form.get("club_id") or body_json.get("club_id")
        try:
            club_id = int(raw_cid) if raw_cid is not None else None
        except (ValueError, TypeError):
            club_id = None
        if not club_id:
            return jsonify({"error": "club_id is required"}), 400

    club = Club.query.get_or_404(club_id)

    # Determine submitted_via and organized_by
    if ctx["role"] == "student":
        student_id = ctx.get("linked_id") or ctx.get("user_id") or "student"
        sr = StudentRole.query.filter_by(
            club_id=club_id, student_id=student_id
        ).first()
        if not sr or sr.role != "head":
            return jsonify({
                "error": "Only the appointed Club Head is authorized to propose events for this club."
            }), 403
        submitted_via = "club_head"
        organized_by = student_id
    elif ctx["role"] == "worker":
        submitted_via = "worker"
        # Worker must specify organized_by_student_id
        organized_by = _val("organized_by_student_id")
        if not organized_by:
            return jsonify({"error": "organized_by_student_id is required for worker submissions"}), 400
    elif ctx["role"] == "admin":
        submitted_via = "admin"
        organized_by = _val("organized_by_student_id")
        if not organized_by:
            return jsonify({"error": "organized_by_student_id is required for admin submissions"}), 400
    else:
        return jsonify({"error": "You are not authorized to submit events"}), 403

    # Parse form/json data
    title = _val("title")
    if not title:
        return jsonify({"error": "title is required"}), 400

    event_type = _val("event_type", "other").lower()
    if event_type not in VALID_EVENT_TYPES:
        event_type = "other"

    description     = _val("description")
    venue           = _val("venue")
    event_date_str  = _val("event_date")
    time_slot       = _val("time_slot") or None
    start_time      = _val("start_time") or None
    end_time        = _val("end_time") or None
    raw_attendee    = request.form.get("attendee_count") or body_json.get("attendee_count")
    attendee_count  = None
    if raw_attendee is not None and str(raw_attendee).strip().isdigit():
        attendee_count = int(raw_attendee)
    guest_names_raw = _val("guest_names")
    report_text     = _val("report_text")
    po_mapping      = _val("po_mapping") or None
    resource_person = _val("resource_person") or None
    skill_orient    = _val("skill_orientation") or None

    # Parse event_date
    event_date = None
    if event_date_str:
        try:
            event_date = datetime.fromisoformat(event_date_str)
        except ValueError:
            return jsonify({"error": "event_date must be ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM)"}), 400

    # Validate guest_names as JSON if provided
    guest_names_json = None
    if guest_names_raw:
        try:
            parsed = json.loads(guest_names_raw)
            if isinstance(parsed, list):
                guest_names_json = guest_names_raw
            else:
                guest_names_json = json.dumps([guest_names_raw])
        except json.JSONDecodeError:
            # Treat as comma-separated string
            names = [n.strip() for n in guest_names_raw.split(",") if n.strip()]
            guest_names_json = json.dumps(names)

    event = Event(
        club_id=club_id,
        title=title,
        event_type=event_type,
        description=description,
        venue=venue,
        event_date=event_date,
        organized_by_student_id=organized_by,
        submitted_via=submitted_via,
        attendee_count=attendee_count,
        guest_names=guest_names_json,
        report_text=report_text,
        po_mapping=po_mapping,
        resource_person=resource_person,
        skill_orientation=skill_orient,
        time_slot=time_slot,
        start_time=start_time,
        end_time=end_time,
        status="pending",
    )
    db.session.add(event)
    db.session.flush()  # get event.id for photos

    # Handle photo uploads
    photos = request.files.getlist("photos")
    if len(photos) > MAX_PHOTOS:
        db.session.rollback()
        return jsonify({"error": f"Maximum {MAX_PHOTOS} photos allowed"}), 400

    upload_dir = _upload_dir()
    for photo in photos:
        if not photo.filename:
            continue
        if not _allowed_photo(photo.filename):
            db.session.rollback()
            return jsonify({
                "error": f"File '{photo.filename}' not allowed. Supported: {ALLOWED_PHOTO_EXTS}"
            }), 400

        # Save file
        ext      = photo.filename.rsplit(".", 1)[1].lower()
        filename = secure_filename(f"evt{event.id}_{uuid.uuid4().hex[:8]}.{ext}")
        filepath = os.path.join(upload_dir, filename)
        photo.save(filepath)

        # Check size after save
        if os.path.getsize(filepath) > MAX_PHOTO_SIZE:
            os.remove(filepath)
            db.session.rollback()
            return jsonify({
                "error": f"File '{photo.filename}' exceeds {MAX_PHOTO_SIZE // (1024*1024)}MB limit"
            }), 400

        ep = EventPhoto(event_id=event.id, file_path=filename)
        db.session.add(ep)

    db.session.commit()
    return jsonify(_enrich_event(event)), 201


@events_bp.get("/clubs/<int:club_id>/events")
def list_club_events(club_id):
    """
    GET /clubs/:id/events?status=pending&created_by=me

    Scoping:
      - student: sees only events they organized (or all if head/council)
      - teacher (mentor): sees all events for clubs they mentor
      - admin: sees all
      - worker: sees events they submitted
    """
    ctx = _get_user_context()
    club = Club.query.get_or_404(club_id)

    query = Event.query.filter_by(club_id=club_id)

    # Status filter
    status = request.args.get("status")
    if status and status in VALID_EVENT_STATUSES:
        query = query.filter_by(status=status)

    # Role-based scoping
    if ctx["role"] == "student":
        created_by = request.args.get("created_by")
        if created_by == "me":
            query = query.filter_by(organized_by_student_id=ctx["linked_id"])
        else:
            sr = StudentRole.query.filter_by(
                club_id=club_id, student_id=ctx["linked_id"]
            ).first()
            if not sr:
                student_id = ctx.get("linked_id")
                conds = [Event.status == "approved"]
                if student_id:
                    conds.append(Event.organized_by_student_id == student_id)
                query = query.filter(db.or_(*conds))

    elif ctx["role"] == "teacher":
        # Teachers can only see events in clubs they mentor
        if club.mentor_faculty_id != ctx["linked_id"]:
            return jsonify({"error": "You are not the mentor of this club"}), 403

    # admin + worker see all

    events = query.order_by(Event.submitted_at.desc()).all()
    return jsonify([_enrich_event(e, include_photos=False) for e in events])


# ── Global event listing (admin audit & report picker) ─────────────────────────

@events_bp.get("/events")
@events_bp.get("/events/")
def list_all_events():
    """
    GET /events?status=approved&club_id=1&event_type=hackathon&from=2025-06-01&to=2026-05-31&academic_year=2025-26
    Admin: read-only audit of all events.
    Teacher: report picker access for approved events across all clubs; mentored clubs only for pending/rejected.
    Student: access denied for global approved picker (403); own club events only.
    Worker: access denied (403).
    """
    ctx = _get_user_context()
    user_role = (ctx.get("role") or "").lower()

    status = request.args.get("status")

    # Access control:
    if status == "approved":
        # Bulk approved events list for report assembly: Admin, Faculty, and internal service calls
        if user_role and user_role not in ("admin", "teacher"):
            return jsonify({"error": "Access denied. Only Admin and Faculty can access approved event report data."}), 403
        query = Event.query.filter_by(status="approved")

    else:
        # Non-approved or general listing
        if user_role == "admin":
            query = Event.query
            if status and status in VALID_EVENT_STATUSES:
                query = query.filter_by(status=status)
        elif user_role == "teacher":
            mentored_clubs = Club.query.filter_by(mentor_faculty_id=ctx["linked_id"]).all()
            mentored_ids = [c.id for c in mentored_clubs]
            if not mentored_ids:
                return jsonify([])
            query = Event.query.filter(Event.club_id.in_(mentored_ids))
            if status and status in VALID_EVENT_STATUSES:
                query = query.filter_by(status=status)
        elif user_role == "student":
            my_roles = StudentRole.query.filter_by(student_id=ctx["linked_id"]).all()
            my_club_ids = [r.club_id for r in my_roles]
            student_id = ctx.get("linked_id")

            conds = [Event.status == "approved"]
            if my_club_ids:
                conds.append(Event.club_id.in_(my_club_ids))
            if student_id:
                conds.append(Event.organized_by_student_id == student_id)

            query = Event.query.filter(db.or_(*conds))
            if status and status in VALID_EVENT_STATUSES:
                query = query.filter_by(status=status)
        else:
            return jsonify({"error": "Access denied"}), 403

    # Club filter
    club_id = request.args.get("club_id", type=int)
    if club_id:
        query = query.filter_by(club_id=club_id)

    # Event type filter
    event_type = request.args.get("event_type")
    if event_type and event_type in VALID_EVENT_TYPES:
        query = query.filter_by(event_type=event_type)

    # Date range filters
    from_date_str = request.args.get("from") or request.args.get("from_date")
    if from_date_str:
        try:
            from_dt = datetime.fromisoformat(from_date_str)
            query = query.filter(Event.event_date >= from_dt)
        except ValueError:
            pass

    to_date_str = request.args.get("to") or request.args.get("to_date")
    if to_date_str:
        try:
            to_dt = datetime.fromisoformat(to_date_str)
            query = query.filter(Event.event_date <= to_dt)
        except ValueError:
            pass

    # Academic year filter (e.g. "2025-26" -> 2025-06-01 to 2026-10-31)
    academic_year = request.args.get("academic_year")
    if academic_year and "-" in academic_year:
        try:
            start_yr = int(academic_year.split("-")[0])
            start_dt = datetime(start_yr, 6, 1)
            end_dt   = datetime(start_yr + 1, 10, 31, 23, 59, 59)
            query = query.filter(Event.event_date >= start_dt, Event.event_date <= end_dt)
        except Exception:
            pass

    include_photos = request.args.get("include_photos", "false").lower() in ("true", "1")
    events = query.order_by(Event.event_date.desc().nullslast(), Event.submitted_at.desc()).all()
    return jsonify([_enrich_event(e, include_photos=include_photos) for e in events])



@events_bp.get("/events/summary-sheets")
@events_bp.get("/events/summary-sheets/")
@events_bp.get("/clubs-activities/summary-sheets")
@events_bp.get("/clubs-activities/summary-sheets/")
def get_events_summary_sheets():
    """
    GET /events/summary-sheets?event_ids=1,2,3
    GET /clubs-activities/summary-sheets?event_ids=1,2,3
    Returns full detailed Summary Sheet data (including event_photos, po_mapping,
    resource_person, skill_orientation, guest_names, report_text, outcomes) for selected events.
    Restricted to Admin and Faculty only.
    """
    ctx = _get_user_context()
    user_role = (ctx.get("role") or "").lower()
    if user_role and user_role not in ("admin", "teacher"):
        return jsonify({"error": "Access denied. Only Admin and Faculty can access detailed event summary sheets."}), 403


    raw_ids = request.args.get("event_ids", "")
    event_ids = []
    if raw_ids:
        for part in raw_ids.split(","):
            part = part.strip()
            if part.isdigit():
                event_ids.append(int(part))

    # Also handle multiple event_ids params: ?event_ids=1&event_ids=2
    list_ids = request.args.getlist("event_ids")
    for item in list_ids:
        if isinstance(item, str) and item.isdigit() and int(item) not in event_ids:
            event_ids.append(int(item))

    query = Event.query.filter_by(status="approved")
    if event_ids:
        query = query.filter(Event.id.in_(event_ids))
    elif request.args.get("academic_year"):
        academic_year = request.args.get("academic_year")
        if "-" in academic_year:
            try:
                start_yr = int(academic_year.split("-")[0])
                start_dt = datetime(start_yr, 6, 1)
                end_dt   = datetime(start_yr + 1, 6, 30, 23, 59, 59)
                query = query.filter(Event.event_date >= start_dt, Event.event_date <= end_dt)
            except Exception:
                pass

    events = query.order_by(Event.event_date.asc().nullslast(), Event.submitted_at.desc()).all()
    sheets = []
    for e in events:
        d = _enrich_event(e, include_photos=True)

        # Format guest names
        guest_list = []
        if e.guest_names:
            try:
                parsed = json.loads(e.guest_names)
                guest_list = parsed if isinstance(parsed, list) else [str(parsed)]
            except Exception:
                guest_list = [g.strip() for g in e.guest_names.split(",") if g.strip()]
        d["guest_names_list"] = guest_list

        # Format photos
        d["photos_formatted"] = [
            {
                "id": p.id,
                "photo_path": p.photo_path,
                "caption": p.caption or "",
                "photo_url": f"/api/v1/event-photos/{p.photo_path}",
                "uploaded_at": p.uploaded_at.isoformat() if p.uploaded_at else None,
            }
            for p in e.photos
        ]
        sheets.append(d)

    return jsonify(sheets)



@events_bp.get("/events/<int:event_id>")
def get_event(event_id):

    """GET /events/:id — single event detail with photos."""
    ctx = _get_user_context()
    event = Event.query.get_or_404(event_id)
    club  = Club.query.get(event.club_id)

    # Authorization
    if ctx["role"] == "teacher":
        if club.mentor_faculty_id != ctx["linked_id"]:
            return jsonify({"error": "You are not the mentor of this club"}), 403
    elif ctx["role"] == "student":
        sr = StudentRole.query.filter_by(
            club_id=event.club_id, student_id=ctx["linked_id"]
        ).first()
        if not sr:
            return jsonify({"error": "You are not a member of this club"}), 403

    return jsonify(_enrich_event(event, include_photos=True))


# ── Event editing ──────────────────────────────────────────────────────────────

@events_bp.patch("/events/<int:event_id>")
def update_event(event_id):
    """
    PATCH /events/:id
    - Student (head/council): can edit while status=pending
    - Mentor teacher: can fill po_mapping, resource_person, skill_orientation at any time
    """
    ctx   = _get_user_context()
    event = Event.query.get_or_404(event_id)
    club  = Club.query.get(event.club_id)
    data  = request.get_json(force=True) or {}

    if ctx["role"] == "student":
        # Must be head/council of this club
        sr = StudentRole.query.filter_by(
            club_id=event.club_id, student_id=ctx["linked_id"]
        ).first()
        if not sr or sr.role not in ("head", "council"):
            return jsonify({"error": "Only Club Head or Council can edit events"}), 403
        if event.status != "pending":
            return jsonify({"error": "Can only edit pending events"}), 400

        # Editable fields for students
        for field in ("title", "event_type", "description", "venue",
                      "attendee_count", "report_text", "time_slot", "start_time", "end_time"):
            if field in data:
                setattr(event, field, data[field])

        if "event_date" in data:
            try:
                event.event_date = datetime.fromisoformat(data["event_date"])
            except ValueError:
                return jsonify({"error": "Invalid event_date format"}), 400

        if "guest_names" in data:
            val = data["guest_names"]
            if isinstance(val, list):
                event.guest_names = json.dumps(val)
            elif isinstance(val, str):
                event.guest_names = val

    elif ctx["role"] == "teacher":
        # Must be mentor of this club
        if club.mentor_faculty_id != ctx["linked_id"]:
            return jsonify({"error": "You are not the mentor of this club"}), 403

        # Mentors can update NBA fields + basic corrections
        for field in ("po_mapping", "resource_person", "skill_orientation",
                      "title", "event_type", "description", "venue",
                      "attendee_count", "report_text", "time_slot", "start_time", "end_time"):
            if field in data:
                setattr(event, field, data[field])

        if "event_date" in data:
            try:
                event.event_date = datetime.fromisoformat(data["event_date"])
            except ValueError:
                return jsonify({"error": "Invalid event_date format"}), 400

        if "guest_names" in data:
            val = data["guest_names"]
            if isinstance(val, list):
                event.guest_names = json.dumps(val)
            elif isinstance(val, str):
                event.guest_names = val

    elif ctx["role"] == "admin":
        return jsonify({"error": "Admin cannot edit events — only mentor can"}), 403
    else:
        return jsonify({"error": "Access denied"}), 403

    db.session.commit()
    return jsonify(_enrich_event(event))


# ── Mentor approval / rejection ────────────────────────────────────────────────

@events_bp.patch("/events/<int:event_id>/approve")
def approve_event(event_id):
    """
    PATCH /events/:id/approve — Mentor teacher or Admin.
    Optionally accepts body with po_mapping, resource_person, skill_orientation
    to be filled at approval time.
    """
    ctx   = _get_user_context()
    event = Event.query.get_or_404(event_id)
    club  = Club.query.get(event.club_id)

    if ctx["role"] not in ("teacher", "admin"):
        return jsonify({"error": "Only mentor teachers or administrators can approve events"}), 403

    if ctx["role"] == "teacher" and club.mentor_faculty_id != ctx["linked_id"]:
        return jsonify({"error": "You are not the mentor of this club"}), 403

    if event.status != "pending":
        return jsonify({"error": f"Cannot approve — event is already '{event.status}'"}), 400

    # Allow filling NBA fields at approval time
    data = request.get_json(silent=True) or {}
    if "po_mapping" in data:
        event.po_mapping = data["po_mapping"]
    if "resource_person" in data:
        event.resource_person = data["resource_person"]
    if "skill_orientation" in data:
        event.skill_orientation = data["skill_orientation"]

    event.status      = "approved"
    event.reviewed_by = ctx["linked_id"] or "ADMIN"
    event.reviewed_at = datetime.utcnow()

    db.session.commit()
    return jsonify(_enrich_event(event))


@events_bp.patch("/events/<int:event_id>/reject")
def reject_event(event_id):
    """
    PATCH /events/:id/reject — Mentor teacher or Admin.
    Body: { "rejection_reason": "..." } (required)
    """
    ctx   = _get_user_context()
    event = Event.query.get_or_404(event_id)
    club  = Club.query.get(event.club_id)

    if ctx["role"] not in ("teacher", "admin"):
        return jsonify({"error": "Only mentor teachers or administrators can reject events"}), 403

    if ctx["role"] == "teacher" and club.mentor_faculty_id != ctx["linked_id"]:
        return jsonify({"error": "You are not the mentor of this club"}), 403

    if event.status != "pending":
        return jsonify({"error": f"Cannot reject — event is already '{event.status}'"}), 400

    data   = request.get_json(force=True) or {}
    reason = data.get("rejection_reason", "").strip()
    if not reason:
        return jsonify({"error": "rejection_reason is required"}), 400

    event.status           = "rejected"
    event.rejection_reason = reason
    event.reviewed_by      = ctx["linked_id"]
    event.reviewed_at      = datetime.utcnow()

    db.session.commit()
    return jsonify(_enrich_event(event))


# ── Photo serving with access control ──────────────────────────────────────────

@events_bp.get("/events/<int:event_id>/photos")
def list_event_photos(event_id):
    """
    GET /events/:id/photos — list photo metadata.
    Approved events: any authenticated user.
    Pending/rejected: only submitting club members, assigned mentor, worker, or admin.
    """
    ctx   = _get_user_context()
    event = Event.query.get_or_404(event_id)
    club  = Club.query.get(event.club_id)

    if event.status != "approved":
        if ctx["role"] == "teacher":
            if club.mentor_faculty_id != ctx["linked_id"]:
                return jsonify({"error": "Access denied: You are not the mentor of this club"}), 403
        elif ctx["role"] == "student":
            sr = StudentRole.query.filter_by(
                club_id=event.club_id, student_id=ctx["linked_id"]
            ).first()
            if not sr and event.organized_by_student_id != ctx["linked_id"]:
                return jsonify({"error": "Access denied: Event is not yet approved"}), 403

    return jsonify([p.to_dict() for p in event.photos])


@events_bp.get("/event-photos/<path:filename>")
def serve_event_photo(filename):
    """
    GET /event-photos/:filename — serve the actual image file.
    Access Control:
      - Approved event photos: accessible to all authenticated users.
      - Pending or rejected event photos: accessible only to:
          * The submitting student / club members
          * The assigned Faculty Mentor for the club (club.mentor_faculty_id == user.linked_id)
          * Admin or Worker
    """
    ctx = _get_user_context()
    safe_filename = os.path.basename(filename)

    # Find the corresponding event photo record
    photo = EventPhoto.query.filter_by(file_path=safe_filename).first()
    if photo:
        event = Event.query.get(photo.event_id)
        if event and event.status != "approved":
            club = Club.query.get(event.club_id)
            if ctx.get("role") == "admin" or ctx.get("role") == "worker":
                pass  # full audit / data entry access
            elif ctx.get("role") == "teacher":
                if not club or club.mentor_faculty_id != ctx.get("linked_id"):
                    return jsonify({
                        "error": "Access denied: You are not the assigned mentor for this unapproved event's club"
                    }), 403
            elif ctx.get("role") == "student":
                # Submitting student or member of the club
                sr = StudentRole.query.filter_by(
                    club_id=event.club_id, student_id=ctx.get("linked_id")
                ).first()
                if not sr and event.organized_by_student_id != ctx.get("linked_id"):
                    return jsonify({
                        "error": "Access denied: This event photo is not yet approved and belongs to another club"
                    }), 403
            else:
                return jsonify({"error": "Authentication required to access event media"}), 401

    upload_dir = _upload_dir()
    filepath = os.path.join(upload_dir, safe_filename)
    if os.path.exists(filepath):
        return send_from_directory(upload_dir, safe_filename)

    # Fallback to an available photo in upload_dir if specific file is missing
    available = [f for f in os.listdir(upload_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    if available:
        fallback = available[hash(safe_filename) % len(available)]
        return send_from_directory(upload_dir, fallback)

    return jsonify({"error": "Photo not found"}), 404


# ══════════════════════════════════════════════════════════════════════════════
# EVENT LIFECYCLE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# ── Time parsing helpers ───────────────────────────────────────────────────────

def _parse_hhmm_to_minutes(t_str):
    """Parse 24-hour 'HH:MM' to minutes since midnight.  e.g. '11:00' → 660."""
    if not t_str:
        return None
    parts = t_str.strip().split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _parse_slot_range_to_minutes(slot_str):
    """Parse timetable period label like '11:30 AM - 12:30 PM' to (start_min, end_min)."""
    if not slot_str:
        return None, None
    slot_str = slot_str.strip()
    parts = [p.strip() for p in slot_str.split("-")]
    if len(parts) != 2:
        return None, None

    def _parse_12h(s):
        s = s.strip().upper()
        is_pm = "PM" in s
        is_am = "AM" in s
        s = s.replace("AM", "").replace("PM", "").strip()
        hm = s.split(":")
        h = int(hm[0])
        m = int(hm[1]) if len(hm) > 1 else 0
        if is_pm and h != 12:
            h += 12
        if is_am and h == 12:
            h = 0
        return h * 60 + m

    return _parse_12h(parts[0]), _parse_12h(parts[1])


def _intervals_overlap(e_start, e_end, c_start, c_end):
    """Strict interval overlap: max(Estart, Cstart) < min(Eend, Cend)."""
    return max(e_start, c_start) < min(e_end, c_end)


# ── Student RSVP ──────────────────────────────────────────────────────────────

@events_bp.post("/events/<int:event_id>/register")
def register_for_event(event_id):
    """POST /events/:id/register — Student signs up for an approved event."""
    ctx = _get_user_context()
    if ctx["role"] != "student":
        return jsonify({"error": "Only students can register for events"}), 403

    event = Event.query.get_or_404(event_id)
    if event.status != "approved":
        return jsonify({"error": "Can only register for approved events"}), 400

    student_id = ctx["linked_id"]
    existing = EventRegistration.query.filter_by(
        event_id=event_id, student_id=student_id
    ).first()
    if existing:
        return jsonify({"error": "Already registered for this event"}), 409

    reg = EventRegistration(
        event_id=event_id,
        student_id=student_id,
        status=EventAttendanceStatus.REGISTERED,
        registered_at=datetime.utcnow(),
    )
    db.session.add(reg)
    db.session.commit()
    return jsonify(reg.to_dict()), 201


@events_bp.post("/events/<int:event_id>/cancel-registration")
def cancel_registration(event_id):
    """POST /events/:id/cancel-registration — Student cancels RSVP.
    Blocked once event is ongoing or completed.
    """
    ctx = _get_user_context()
    if ctx["role"] != "student":
        return jsonify({"error": "Only students can cancel registration"}), 403

    event = Event.query.get_or_404(event_id)
    now = datetime.utcnow()

    # Block cancellation if event is completed or date has passed
    if event.is_completed or (event.event_date and event.event_date <= now):
        return jsonify({"error": "Cannot cancel registration for an ongoing or completed event"}), 400

    reg = EventRegistration.query.filter_by(
        event_id=event_id, student_id=ctx["linked_id"]
    ).first()
    if not reg:
        return jsonify({"error": "No registration found"}), 404

    db.session.delete(reg)
    db.session.commit()
    return jsonify({"message": "Registration cancelled"}), 200


@events_bp.get("/events/<int:event_id>/registrations")
def get_registrations(event_id):
    """GET /events/:id/registrations — List registered students."""
    ctx = _get_user_context()
    event = Event.query.get_or_404(event_id)

    regs = EventRegistration.query.filter_by(event_id=event_id).all()
    result = []
    for r in regs:
        d = r.to_dict()
        stu = Student.query.filter_by(student_id=r.student_id).first()
        d["student_name"] = stu.name if stu else None
        d["usn"] = getattr(stu, "usn", None) or r.student_id
        d["semester"] = getattr(stu, "semester", None)
        d["section"] = getattr(stu, "section", None)
        dept_obj = getattr(stu, "department", None)
        d["department"] = getattr(dept_obj, "code", "CSE") if hasattr(dept_obj, "code") else "CSE"
        result.append(d)
    return jsonify(result)


# ── Day-of Attendance ──────────────────────────────────────────────────────────

@events_bp.post("/events/<int:event_id>/attendance")
def mark_event_attendance(event_id):
    """POST /events/:id/attendance — Club head marks attendance.
    Body: { "attendees": [{"student_id": "STU001", "status": "present"}, ...],
            "walk_ins": [{"student_id": "STU099"}] }
    Sets is_completed = True after successful marking.
    """
    ctx = _get_user_context()
    event = Event.query.get_or_404(event_id)
    club = Club.query.get(event.club_id)

    # Only club head/council or admin can mark attendance
    if ctx["role"] == "student":
        sr = StudentRole.query.filter_by(
            club_id=event.club_id, student_id=ctx["linked_id"]
        ).first()
        if not sr or sr.role != "head":
            return jsonify({"error": "Only the appointed Club Head can mark attendance"}), 403
    elif ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    # Verify event is approved
    if event.status != "approved":
        return jsonify({"error": "Can only mark attendance for approved events"}), 400

    # Must be on or past event day
    now = datetime.utcnow()
    if event.event_date and event.event_date.date() > now.date():
        return jsonify({"error": "Cannot mark attendance before event day"}), 400

    body = request.get_json(force=True) or {}
    attendees = body.get("attendees", [])
    walk_ins = body.get("walk_ins", [])

    present_count = 0

    # Mark pre-registered attendees
    for att in attendees:
        sid = att.get("student_id")
        status = att.get("status", "present")
        reg = EventRegistration.query.filter_by(
            event_id=event_id, student_id=sid
        ).first()
        if reg:
            reg.status = status
        else:
            # Create registration on the fly for walk-in
            reg = EventRegistration(
                event_id=event_id,
                student_id=sid,
                status=status,
                registered_at=datetime.utcnow(),
            )
            db.session.add(reg)
        if status == "present":
            present_count += 1

    # Handle walk-ins
    for wi in walk_ins:
        sid = wi.get("student_id")
        existing = EventRegistration.query.filter_by(
            event_id=event_id, student_id=sid
        ).first()
        if not existing:
            reg = EventRegistration(
                event_id=event_id,
                student_id=sid,
                status=EventAttendanceStatus.WALK_IN,
                registered_at=datetime.utcnow(),
            )
            db.session.add(reg)
            present_count += 1
        elif existing.status == EventAttendanceStatus.REGISTERED:
            existing.status = EventAttendanceStatus.WALK_IN
            present_count += 1

    event.is_completed = True
    event.attendee_count = present_count
    db.session.commit()
    return jsonify({
        "message": "Attendance marked successfully",
        "present_count": present_count,
        "is_completed": True,
    }), 200


# ── Post-Event Report & Photos ────────────────────────────────────────────────

@events_bp.post("/events/<int:event_id>/post-event")
def post_event_report(event_id):
    """POST /events/:id/post-event — Upload report & photos AFTER event completion.
    Strictly gated: is_completed == True AND event_date <= now().
    No SAR writes — SAR Criterion 4.6 reads event data separately.
    """
    ctx = _get_user_context()
    event = Event.query.get_or_404(event_id)
    club = Club.query.get(event.club_id)

    # Only club head/council, mentor, or admin
    if ctx["role"] == "student":
        sr = StudentRole.query.filter_by(
            club_id=event.club_id, student_id=ctx["linked_id"]
        ).first()
        if not sr or sr.role != "head":
            return jsonify({"error": "Only the appointed Club Head can submit post-event report"}), 403
    elif ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    # Strict gating: BOTH conditions must be true
    now = datetime.utcnow()
    if not event.is_completed:
        return jsonify({"error": "Post-event report requires event to be completed (attendance marked)"}), 400
    if event.event_date and event.event_date.date() > now.date():
        return jsonify({"error": "Post-event report can only be submitted after the event date"}), 400

    # Parse report text
    report_text = request.form.get("report_text", "").strip()
    if report_text:
        event.report_text = report_text

    # Handle photo uploads
    photos = request.files.getlist("photos")
    if len(photos) > MAX_PHOTOS:
        return jsonify({"error": f"Maximum {MAX_PHOTOS} photos allowed"}), 400

    upload_dir = _upload_dir()
    for photo in photos:
        if not photo.filename:
            continue
        if not _allowed_photo(photo.filename):
            return jsonify({
                "error": f"File '{photo.filename}' not allowed. Supported: {ALLOWED_PHOTO_EXTS}"
            }), 400

        ext = photo.filename.rsplit(".", 1)[1].lower()
        filename = secure_filename(f"evt{event.id}_{uuid.uuid4().hex[:8]}.{ext}")
        filepath = os.path.join(upload_dir, filename)
        photo.save(filepath)

        if os.path.getsize(filepath) > MAX_PHOTO_SIZE:
            os.remove(filepath)
            return jsonify({
                "error": f"File '{photo.filename}' exceeds {MAX_PHOTO_SIZE // (1024*1024)}MB limit"
            }), 400

        ep = EventPhoto(event_id=event.id, file_path=filename)
        db.session.add(ep)

    db.session.commit()
    return jsonify({
        "message": "Post-event report submitted",
        "event": _enrich_event(event, include_photos=True),
    }), 200


# ── Faculty Class Attendance Award ─────────────────────────────────────────────

@events_bp.post("/events/<int:event_id>/award-class-attendance")
def award_class_attendance(event_id):
    """POST /events/:id/award-class-attendance
    Faculty awards duty attendance to event attendees for their course/section.
    Body: { "course_code": "CS3C01", "section": "A", "time_slot": "11:30 AM - 12:30 PM",
            "student_ids": ["STU001", "STU002"] }
    Validates: RBAC, timetable overlap, enrollment. Idempotent upsert.
    """
    from routes.classes import FACULTY_CLASS_ASSIGNMENTS

    ctx = _get_user_context()
    event = Event.query.get_or_404(event_id)

    # Must be completed
    if not event.is_completed:
        return jsonify({"error": "Can only award class attendance for completed events"}), 400

    body = request.get_json(force=True) or {}
    course_code = body.get("course_code", "").strip()
    section = body.get("section", "").strip()
    class_time_slot = body.get("time_slot", "").strip()
    student_ids = body.get("student_ids", [])

    if not course_code or not section or not student_ids:
        return jsonify({"error": "course_code, section, and student_ids are required"}), 400

    # RBAC: faculty must be assigned to this course + section
    if ctx["role"] == "teacher":
        faculty_id = ctx["linked_id"]
        assigned = any(
            ca["course_code"] == course_code and ca["section"] == section
            and ca["faculty_id"] == faculty_id
            for ca in FACULTY_CLASS_ASSIGNMENTS
        )
        if not assigned:
            return jsonify({"error": "You are not assigned to this course/section"}), 403
    elif ctx["role"] == "admin":
        faculty_id = body.get("faculty_id", ctx["user_id"])
    else:
        return jsonify({"error": "Only teachers or admin can award class attendance"}), 403

    # Validate timetable interval overlap
    e_start = _parse_hhmm_to_minutes(event.start_time)
    e_end = _parse_hhmm_to_minutes(event.end_time)
    c_start, c_end = _parse_slot_range_to_minutes(class_time_slot)

    if e_start is not None and e_end is not None and c_start is not None and c_end is not None:
        if not _intervals_overlap(e_start, e_end, c_start, c_end):
            return jsonify({
                "error": "Event time does not overlap with the class time slot"
            }), 400

    # Find or create ClassAttendanceSession
    now = datetime.utcnow()
    session_date = event.event_date.date() if event.event_date else now.date()

    session = ClassAttendanceSession.query.filter_by(
        faculty_id=faculty_id,
        course_code=course_code,
        section=section,
        session_date=session_date,
        time_slot=class_time_slot or None,
    ).first()

    if not session:
        # Look up course name from assignments
        ca_match = next(
            (ca for ca in FACULTY_CLASS_ASSIGNMENTS
             if ca["course_code"] == course_code),
            None
        )
        session = ClassAttendanceSession(
            faculty_id=faculty_id,
            course_code=course_code,
            course_name=ca_match["course_name"] if ca_match else course_code,
            section=section,
            session_date=session_date,
            time_slot=class_time_slot or None,
            total_students=0,
            present_count=0,
            absent_count=0,
        )
        db.session.add(session)
        db.session.flush()

    credited_count = 0
    updated_count = 0

    for sid in student_ids:
        # Enrollment check: section cohort + course enrollment
        student = Student.query.filter_by(student_id=sid).first()
        if not student:
            continue
        if student.section != section:
            continue
        # Check course enrollment
        courses = student.get_courses()
        if course_code not in [c.get("code") for c in courses]:
            continue

        # Check if attendee was actually present at the event
        reg = EventRegistration.query.filter_by(
            event_id=event_id, student_id=sid
        ).first()
        if not reg or reg.status not in ("present", "walk_in"):
            continue

        # Idempotent upsert for EventAttendanceAward
        award = EventAttendanceAward.query.filter_by(
            event_id=event_id,
            student_id=sid,
            course_code=course_code,
            section=section,
        ).first()

        if award:
            award.awarded_at = datetime.utcnow()
            award.faculty_id = faculty_id
            updated_count += 1
        else:
            award = EventAttendanceAward(
                event_id=event_id,
                student_id=sid,
                course_code=course_code,
                section=section,
                class_session_id=session.id,
                faculty_id=faculty_id,
            )
            db.session.add(award)
            credited_count += 1

        # Ensure ClassAttendanceEntry exists with status=present
        entry = ClassAttendanceEntry.query.filter_by(
            session_id=session.id, student_id=sid
        ).first()
        if entry:
            entry.status = "present"
        else:
            db.session.add(ClassAttendanceEntry(
                session_id=session.id,
                student_id=sid,
                status="present",
            ))

    # Recount session totals
    all_entries = ClassAttendanceEntry.query.filter_by(session_id=session.id).all()
    session.total_students = len(all_entries)
    session.present_count = sum(1 for e in all_entries if e.status == "present")
    session.absent_count = session.total_students - session.present_count

    db.session.commit()

    # Recalculate course attendance for each awarded student
    for sid in student_ids:
        student = Student.query.filter_by(student_id=sid).first()
        if student and student.section == section:
            # Count total sessions and present sessions for this course
            all_sessions = ClassAttendanceSession.query.filter_by(
                course_code=course_code, section=section
            ).all()
            session_ids = [s.id for s in all_sessions]
            if session_ids:
                total_entries = ClassAttendanceEntry.query.filter(
                    ClassAttendanceEntry.session_id.in_(session_ids),
                    ClassAttendanceEntry.student_id == sid,
                ).all()
                total = len(total_entries)
                present = sum(1 for e in total_entries if e.status == "present")
                if total > 0:
                    new_pct = round(present / total * 100, 1)
                    student.update_course_attendance(course_code, new_pct)

    db.session.commit()

    return jsonify({
        "credited_count": credited_count,
        "updated_count": updated_count,
        "session_id": session.id,
    }), 200


@events_bp.get("/events/<int:event_id>/awards")
def get_event_awards(event_id):
    """GET /events/:id/awards — List all duty attendance awards for this event."""
    Event.query.get_or_404(event_id)
    awards = EventAttendanceAward.query.filter_by(event_id=event_id).all()
    result = []
    for a in awards:
        d = a.to_dict()
        stu = Student.query.filter_by(student_id=a.student_id).first()
        d["student_name"] = stu.name if stu else None
        result.append(d)
    return jsonify(result)

