"""
Timetable Routes — AcademiQ
Provides:
  - Faculty individual schedule (6 periods x Mon-Sat) + workload
  - Section schedule for students
  - Master timetable with room clash detection
  - Metadata lookups (faculty, sections, rooms)
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db, Faculty, Subject, Section, TimetableSlot, StudentEnrollment, Student

timetable_bp = Blueprint("timetable", __name__)

DAYS_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

PERIOD_MAP = {
    1: {"start": "09:00", "end": "10:00", "label": "Period 1 (09:00 - 10:00)"},
    2: {"start": "10:00", "end": "11:00", "label": "Period 2 (10:00 - 11:00)"},
    3: {"start": "11:30", "end": "12:30", "label": "Period 3 (11:30 - 12:30)"},
    4: {"start": "12:30", "end": "13:30", "label": "Period 4 (12:30 - 13:30)"},
    5: {"start": "14:30", "end": "15:30", "label": "Period 5 (14:30 - 15:30)"},
    6: {"start": "15:30", "end": "16:30", "label": "Period 6 (15:30 - 16:30)"},
}


def _build_faculty_map():
    faculty = Faculty.query.all()
    return {f.faculty_id: f.name for f in faculty}


@timetable_bp.get("/meta")
def get_metadata():
    """Returns lists of faculty, sections, and rooms for UI dropdowns."""
    faculty = Faculty.query.order_by(Faculty.name).all()
    sections = Section.query.order_by(Section.semester, Section.section_label).all()
    subjects = Subject.query.order_by(Subject.name).all()

    # Distinct rooms
    rooms = (
        db.session.query(TimetableSlot.room)
        .filter(TimetableSlot.room.isnot(None), TimetableSlot.room != "")
        .distinct()
        .order_by(TimetableSlot.room)
        .all()
    )
    room_list = [r[0] for r in rooms]

    return jsonify({
        "faculty": [{"faculty_id": f.faculty_id, "name": f.name, "initials": f.initials, "email": f.email} for f in faculty],
        "sections": [s.to_dict() for s in sections],
        "subjects": [s.to_dict() for s in subjects],
        "rooms": room_list,
        "periods": PERIOD_MAP,
        "days": DAYS_ORDER,
    })


@timetable_bp.get("/faculty/<faculty_id>")
def get_faculty_timetable(faculty_id):
    """Returns a faculty member's weekly schedule across Mon-Sat."""
    term = request.args.get("term", "2024-25-EVEN")

    faculty = Faculty.query.filter_by(faculty_id=faculty_id).first()
    if not faculty:
        if str(faculty_id).isdigit():
            faculty = Faculty.query.filter_by(id=int(faculty_id)).first()
        else:
            faculty = Faculty.query.filter(Faculty.name.ilike(f"%{faculty_id}%")).first()


    if not faculty:
        return jsonify({"error": f"Faculty '{faculty_id}' not found"}), 404

    faculty_map = _build_faculty_map()

    slots = (
        TimetableSlot.query.filter_by(faculty_id=faculty.faculty_id, academic_term=term)
        .order_by(TimetableSlot.period_index)
        .all()
    )

    # Organize into Mon-Sat grid
    grid = {d: [] for d in DAYS_ORDER}
    theory_count = 0
    lab_count = 0

    for s in slots:
        slot_dict = s.to_dict(faculty_map)
        day = s.day_of_week
        if day in grid:
            grid[day].append(slot_dict)

        if s.is_lab:
            lab_count += 1
        else:
            theory_count += 1

    # Sort each day by period_index
    for d in grid:
        grid[d].sort(key=lambda x: x["period_index"])

    # Determine current / next class right now
    now = datetime.now()
    today_code = now.strftime("%a")  # "Mon", "Tue" etc.
    now_time = now.strftime("%H:%M")

    current_class = None
    next_class = None
    todays_slots = grid.get(today_code, [])

    for s in todays_slots:
        if s["start_time"] <= now_time <= s["end_time"]:
            current_class = s
            break
        elif s["start_time"] > now_time and next_class is None:
            next_class = s

    return jsonify({
        "faculty": faculty.to_dict(),
        "academic_term": term,
        "grid": grid,
        "workload": {
            "theory_periods": theory_count,
            "lab_periods": lab_count,
            "total_periods": theory_count + lab_count,
        },
        "current_class": current_class,
        "next_class": next_class,
    })


@timetable_bp.get("/section/<int:section_id>")
def get_section_timetable(section_id):
    """Returns a section's weekly schedule."""
    term = request.args.get("term", "2024-25-EVEN")

    section = Section.query.get(section_id)
    if not section:
        return jsonify({"error": "Section not found"}), 404

    faculty_map = _build_faculty_map()

    slots = (
        TimetableSlot.query.filter_by(section_id=section.id, academic_term=term)
        .order_by(TimetableSlot.period_index)
        .all()
    )

    grid = {d: [] for d in DAYS_ORDER}
    for s in slots:
        if s.day_of_week in grid:
            grid[s.day_of_week].append(s.to_dict(faculty_map))

    for d in grid:
        grid[d].sort(key=lambda x: x["period_index"])

    enrolled_count = StudentEnrollment.query.filter_by(section_id=section.id, academic_term=term).count()

    return jsonify({
        "section": section.to_dict(),
        "enrolled_students": enrolled_count,
        "academic_term": term,
        "grid": grid,
    })


@timetable_bp.get("/slots")
def list_slots():
    """Master timetable query with filters and clash detection."""
    term = request.args.get("term", "2024-25-EVEN")
    faculty_id = request.args.get("faculty_id")
    section_id = request.args.get("section_id")
    room = request.args.get("room")
    day = request.args.get("day")
    period = request.args.get("period")

    query = TimetableSlot.query.filter_by(academic_term=term)

    if faculty_id:
        query = query.filter_by(faculty_id=faculty_id)
    if section_id:
        query = query.filter_by(section_id=int(section_id))
    if room:
        query = query.filter(TimetableSlot.room.ilike(f"%{room}%"))
    if day:
        query = query.filter_by(day_of_week=day)
    if period:
        query = query.filter_by(period_index=int(period))

    slots = query.order_by(TimetableSlot.day_of_week, TimetableSlot.period_index).all()
    faculty_map = _build_faculty_map()

    slot_dicts = [s.to_dict(faculty_map) for s in slots]

    # Room clash detection across all slots for this term
    all_term_slots = TimetableSlot.query.filter_by(academic_term=term).all()
    room_schedule = {}
    clashes = []

    for s in all_term_slots:
        if not s.room:
            continue
        key = (s.room.strip().upper(), s.day_of_week, s.period_index)
        if key not in room_schedule:
            room_schedule[key] = []
        room_schedule[key].append(s)

    for (r, d, p), conflicting in room_schedule.items():
        if len(conflicting) > 1:
            # Clashes: multiple classes booked in same room at same period
            clashes.append({
                "room": r,
                "day": d,
                "period_index": p,
                "period_label": PERIOD_MAP.get(p, {}).get("label", f"Period {p}"),
                "slots": [c.to_dict(faculty_map) for c in conflicting],
                "message": f"Room {r} is double-booked on {d} during Period {p} for {len(conflicting)} classes."
            })

    return jsonify({
        "total": len(slot_dicts),
        "slots": slot_dicts,
        "clashes_count": len(clashes),
        "clashes": clashes,
    })


@timetable_bp.get("/rooms")
def get_room_matrix():
    """Returns matrix of room occupancy by day and period."""
    term = request.args.get("term", "2024-25-EVEN")
    day = request.args.get("day", "Mon")

    faculty_map = _build_faculty_map()

    slots = (
        TimetableSlot.query.filter_by(academic_term=term, day_of_week=day)
        .order_by(TimetableSlot.room, TimetableSlot.period_index)
        .all()
    )

    rooms = set(s.room for s in slots if s.room)
    room_matrix = {}

    for r in sorted(list(rooms)):
        room_matrix[r] = {p: None for p in range(1, 7)}

    for s in slots:
        if s.room and s.room in room_matrix:
            room_matrix[s.room][s.period_index] = s.to_dict(faculty_map)

    return jsonify({
        "day": day,
        "periods": PERIOD_MAP,
        "room_matrix": room_matrix,
    })


# ── Slot CRUD (Admin only) ─────────────────────────────────────────────────────

@timetable_bp.post("/slots")
def create_slot():
    """
    POST /timetable/slots — Admin only.
    Body: {
      "faculty_id": "FAC001",
      "subject_id": 12,           (optional)
      "section_id": 3,
      "day_of_week": "Mon",
      "period_index": 2,          (1–6)
      "room": "CSE-B2",           (optional)
      "is_lab": false,
      "co_faculty_id": "FAC007",  (optional)
      "academic_term": "2024-25-EVEN"
    }
    """
    role = request.headers.get("X-User-Role", "")
    if role != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json(force=True) or {}

    # ── Required fields ────────────────────────────────────────────────────────
    faculty_id = (data.get("faculty_id") or "").strip()
    if not faculty_id:
        return jsonify({"error": "faculty_id is required"}), 400

    raw_sec = data.get("section_id")
    if not raw_sec:
        return jsonify({"error": "section_id is required"}), 400
    try:
        section_id = int(raw_sec)
    except (TypeError, ValueError):
        return jsonify({"error": "section_id must be an integer"}), 400

    day = (data.get("day_of_week") or "").strip()
    if day not in DAYS_ORDER:
        return jsonify({"error": f"day_of_week must be one of: {', '.join(DAYS_ORDER)}"}), 400

    raw_period = data.get("period_index")
    if raw_period is None:
        return jsonify({"error": "period_index is required"}), 400
    try:
        period = int(raw_period)
    except (TypeError, ValueError):
        return jsonify({"error": "period_index must be an integer"}), 400

    pinfo = PERIOD_MAP.get(period)
    if not pinfo:
        return jsonify({"error": "period_index must be between 1 and 6"}), 400

    term = data.get("academic_term", "2024-25-EVEN")

    # ── Validate faculty exists (C-1) ──────────────────────────────────────────
    fac = Faculty.query.filter_by(faculty_id=faculty_id).first()
    if not fac:
        return jsonify({"error": f"Faculty '{faculty_id}' not found"}), 404

    # ── Validate section exists ────────────────────────────────────────────────
    from timetable_models import Section
    sec = Section.query.get(section_id)
    if not sec:
        return jsonify({"error": f"Section {section_id} not found"}), 404

    # ── Validate subject if provided ───────────────────────────────────────────
    subject_id = data.get("subject_id")
    if subject_id is not None:
        try:
            subject_id = int(subject_id)
        except (TypeError, ValueError):
            return jsonify({"error": "subject_id must be an integer"}), 400
        from timetable_models import Subject
        if not Subject.query.get(subject_id):
            return jsonify({"error": f"Subject {subject_id} not found"}), 404

    # ── Section clash check ────────────────────────────────────────────────────
    section_clash = TimetableSlot.query.filter_by(
        section_id=section_id,
        day_of_week=day,
        period_index=period,
        academic_term=term,
    ).first()
    if section_clash:
        existing_sub = section_clash.subject.name if section_clash.subject else (section_clash.raw_text or "another subject")
        return jsonify({
            "error": f"Section '{sec.semester}-{sec.section_label}' is already scheduled for '{existing_sub}' at {day} Period {period}."
        }), 409

    # ── Faculty clash check (H-1) ──────────────────────────────────────────────
    faculty_clash = TimetableSlot.query.filter_by(
        faculty_id=faculty_id,
        day_of_week=day,
        period_index=period,
        academic_term=term,
    ).first()
    if faculty_clash:
        clashing_sub = faculty_clash.subject.name if faculty_clash.subject else (faculty_clash.raw_text or "another class")
        return jsonify({
            "error": f"Faculty '{fac.name}' is already teaching '{clashing_sub}' at {day} Period {period}."
        }), 409

    # ── Room clash check (optional — warn, don't block) ─────────────────────
    room = (data.get("room") or "").strip()
    room_warning = None
    if room:
        room_clash = TimetableSlot.query.filter_by(
            room=room,
            day_of_week=day,
            period_index=period,
            academic_term=term,
        ).first()
        if room_clash:
            room_warning = f"Warning: Room '{room}' is already booked at {day} Period {period}."

    # ── Validate optional co_faculty_id ───────────────────────────────────────
    co_faculty_id = (data.get("co_faculty_id") or "").strip() or None
    if co_faculty_id:
        co_fac = Faculty.query.filter_by(faculty_id=co_faculty_id).first()
        if not co_fac:
            return jsonify({"error": f"Co-faculty '{co_faculty_id}' not found"}), 404

    slot = TimetableSlot(
        faculty_id    = faculty_id,
        subject_id    = subject_id,
        section_id    = section_id,
        day_of_week   = day,
        period_index  = period,
        start_time    = pinfo["start"],
        end_time      = pinfo["end"],
        room          = room,
        is_lab        = bool(data.get("is_lab", False)),
        co_faculty_id = co_faculty_id,
        academic_term = term,
    )
    db.session.add(slot)
    db.session.commit()

    fm = _build_faculty_map()
    response = slot.to_dict(fm)
    if room_warning:
        response["warning"] = room_warning
    return jsonify(response), 201


@timetable_bp.delete("/slots/<int:slot_id>")
def delete_slot(slot_id):
    """DELETE /timetable/slots/:id — Admin only."""
    role = request.headers.get("X-User-Role", "")
    if role != "admin":
        return jsonify({"error": "Admin access required"}), 403

    slot = TimetableSlot.query.get_or_404(slot_id)
    db.session.delete(slot)
    db.session.commit()
    return jsonify({"deleted": True, "id": slot_id})
