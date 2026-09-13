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
