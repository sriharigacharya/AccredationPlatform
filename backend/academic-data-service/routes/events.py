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
from models import db, Faculty, Student
from event_models import (
    Club, StudentRole, Event, EventPhoto,
    VALID_EVENT_TYPES, VALID_SUBMITTED_VIA, VALID_EVENT_STATUSES,
)

events_bp = Blueprint("events", __name__)

ALLOWED_PHOTO_EXTS = {"jpg", "jpeg", "png", "webp"}
MAX_PHOTO_SIZE     = 5 * 1024 * 1024   # 5 MB
MAX_PHOTOS         = 10


def _get_user_context():
    """Extract user context from gateway-injected headers."""
    return {
        "user_id":   request.headers.get("X-User-Id", ""),
        "role":      request.headers.get("X-User-Role", ""),
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
def create_event(club_id):
    """
    POST /clubs/:id/events (multipart/form-data)

    Form fields: title, event_type, description, venue, event_date,
                 attendee_count, guest_names (JSON), report_text,
                 po_mapping?, resource_person?, skill_orientation?
    Files: photos (multiple, optional)

    Who can submit:
      - student with head|council role in this club → submitted_via=club_head
      - worker role → submitted_via=worker
      - admin role → submitted_via=admin
    """
    ctx = _get_user_context()
    club = Club.query.get_or_404(club_id)

    # Determine submitted_via and organized_by
    if ctx["role"] == "student":
        sr = StudentRole.query.filter_by(
            club_id=club_id, student_id=ctx["linked_id"]
        ).first()
        if not sr or sr.role not in ("head", "council"):
            return jsonify({
                "error": "Only Club Head or Council members can submit events"
            }), 403
        submitted_via = "club_head"
        organized_by  = ctx["linked_id"]
    elif ctx["role"] == "worker":
        submitted_via = "worker"
        # Worker must specify organized_by_student_id
        organized_by = request.form.get("organized_by_student_id", "").strip()
        if not organized_by:
            return jsonify({"error": "organized_by_student_id is required for worker submissions"}), 400
    elif ctx["role"] == "admin":
        submitted_via = "admin"
        organized_by = request.form.get("organized_by_student_id", "").strip()
        if not organized_by:
            return jsonify({"error": "organized_by_student_id is required for admin submissions"}), 400
    else:
        return jsonify({"error": "You are not authorized to submit events"}), 403

    # Parse form data
    title = request.form.get("title", "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    event_type = request.form.get("event_type", "other").lower()
    if event_type not in VALID_EVENT_TYPES:
        event_type = "other"

    description     = request.form.get("description", "").strip()
    venue           = request.form.get("venue", "").strip()
    event_date_str  = request.form.get("event_date", "").strip()
    attendee_count  = request.form.get("attendee_count", type=int)
    guest_names_raw = request.form.get("guest_names", "").strip()
    report_text     = request.form.get("report_text", "").strip()
    po_mapping      = request.form.get("po_mapping", "").strip() or None
    resource_person = request.form.get("resource_person", "").strip() or None
    skill_orient    = request.form.get("skill_orientation", "").strip() or None

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
            # Students can see all events in clubs where they have a role
            sr = StudentRole.query.filter_by(
                club_id=club_id, student_id=ctx["linked_id"]
            ).first()
            if not sr:
                return jsonify({"error": "You are not a member of this club"}), 403

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
            if not my_club_ids:
                return jsonify([])
            query = Event.query.filter(Event.club_id.in_(my_club_ids))
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
                      "attendee_count", "report_text"):
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
                      "attendee_count", "report_text"):
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
    if not photo:
        return jsonify({"error": "Photo not found"}), 404

    event = Event.query.get(photo.event_id)
    if not event:
        return jsonify({"error": "Associated event not found"}), 404

    club = Club.query.get(event.club_id)

    # If event is not approved, enforce strict ownership/mentor checks
    if event.status != "approved":
        if ctx["role"] == "admin" or ctx["role"] == "worker":
            pass  # full audit / data entry access
        elif ctx["role"] == "teacher":
            if not club or club.mentor_faculty_id != ctx["linked_id"]:
                return jsonify({
                    "error": "Access denied: You are not the assigned mentor for this unapproved event's club"
                }), 403
        elif ctx["role"] == "student":
            # Submitting student or member of the club
            sr = StudentRole.query.filter_by(
                club_id=event.club_id, student_id=ctx["linked_id"]
            ).first()
            if not sr and event.organized_by_student_id != ctx["linked_id"]:
                return jsonify({
                    "error": "Access denied: This event photo is not yet approved and belongs to another club"
                }), 403
        else:
            return jsonify({"error": "Authentication required to access event media"}), 401

    upload_dir = _upload_dir()
    return send_from_directory(upload_dir, safe_filename)
