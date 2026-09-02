"""
Classes & Evaluations Routes — AcademiQ
Dedicated endpoints for the Teacher Role:
- Class list and student rosters
- Attendance taking for daily sessions
- Exam-wise marks entry (CIE 1, CIE 2, Quizzes, EL, SEE)
- Real-time at-risk & low performance alert detection
"""

import json
from datetime import datetime, date
from flask import Blueprint, request, jsonify
from models import db, Student, Faculty, ClassAttendanceSession, ClassAttendanceEntry

classes_bp = Blueprint("classes", __name__)

# Standard Curriculum Map linking Faculty to their assigned courses and sections
FACULTY_CLASS_ASSIGNMENTS = [
    {
        "course_code": "CS3C01",
        "course_name": "Data Structures & Algorithms",
        "section": "A",
        "semester": 3,
        "faculty_id": "FAC001",
        "credits": 4,
    },
    {
        "course_code": "CS7C01",
        "course_name": "Machine Learning",
        "section": "C",
        "semester": 7,
        "faculty_id": "FAC001",
        "credits": 4,
    },
    {
        "course_code": "CS5C02",
        "course_name": "Operating Systems",
        "section": "B",
        "semester": 5,
        "faculty_id": "FAC002",
        "credits": 4,
    },
    {
        "course_code": "CS7C03",
        "course_name": "Cloud Computing",
        "section": "C",
        "semester": 7,
        "faculty_id": "FAC002",
        "credits": 3,
    },
]

EXAM_MAX_MARKS = {
    "cie1": 25.0,
    "cie2": 25.0,
    "quiz1": 10.0,
    "quiz2": 10.0,
    "el": 30.0,
    "see": 100.0,
}


def _get_context():
    return {
        "role": (request.headers.get("X-User-Role") or "").lower(),
        "linked_id": request.headers.get("X-Linked-Id") or "",
        "user_id": request.headers.get("X-User-Id") or "",
    }


# ── GET /classes/my-classes ──────────────────────────────────────────────────

@classes_bp.get("/my-classes")
@classes_bp.get("/my-classes/")
def get_my_classes():
    """
    Returns courses taught by the current teacher (or all courses if admin).
    """
    ctx = _get_context()
    user_role = ctx["role"]
    linked_id = ctx["linked_id"]

    if user_role and user_role not in ("admin", "teacher"):
        return jsonify({"error": "Access denied. Only teachers and administrators can view classes."}), 403

    classes = []
    for ca in FACULTY_CLASS_ASSIGNMENTS:
        # Admin can view all classes; teachers only view classes matching their linked faculty ID
        if user_role == "teacher" and linked_id and ca["faculty_id"] != linked_id:
            continue

        fac = Faculty.query.filter_by(faculty_id=ca["faculty_id"]).first()
        student_count = Student.query.filter_by(section=ca["section"]).count()

        # Count low performing students in this class
        students = Student.query.filter_by(section=ca["section"]).all()
        at_risk_count = 0
        for s in students:
            r = s.get_course_risk_status(ca["course_code"])
            if r["is_at_risk"]:
                at_risk_count += 1

        classes.append({
            "course_code": ca["course_code"],
            "course_name": ca["course_name"],
            "section": ca["section"],
            "semester": ca["semester"],
            "faculty_id": ca["faculty_id"],
            "faculty_name": fac.name if fac else ca["faculty_id"],
            "student_count": student_count,
            "at_risk_count": at_risk_count,
            "credits": ca["credits"],
            "evaluations_available": list(EXAM_MAX_MARKS.keys()),
        })

    return jsonify(classes)


# ── GET /classes/<course_code>/<section>/students ───────────────────────────

@classes_bp.get("/<course_code>/<section>/students")
def get_class_students(course_code, section):
    """
    Returns student roster for a class section with course evaluations and risk status.
    """
    ctx = _get_context()
    if ctx["role"] and ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    students = Student.query.filter_by(section=section).order_by(Student.student_id).all()
    roster = []

    for s in students:
        courses = s.get_courses()
        course_eval = next((c for c in courses if c.get("code") == course_code), None)

        if not course_eval:
            # Fallback if course entry was not in JSON
            course_eval = {
                "code": course_code,
                "attendance_pct": s.attendance_pct,
                "cie1": None,
                "cie2": None,
                "quiz1": None,
                "quiz2": None,
                "el": None,
                "see": None,
                "cie_raw": 0,
                "total": 0,
                "grade": "F",
            }

        risk = s.get_course_risk_status(course_code)

        roster.append({
            "id": s.id,
            "student_id": s.student_id,
            "name": s.name,
            "email": s.email,
            "phone": s.phone,
            "section": s.section,
            "semester": s.semester,
            "attendance_pct": course_eval.get("attendance_pct", s.attendance_pct),
            "cie1": course_eval.get("cie1"),
            "cie2": course_eval.get("cie2"),
            "quiz1": course_eval.get("quiz1"),
            "quiz2": course_eval.get("quiz2"),
            "el": course_eval.get("el"),
            "see": course_eval.get("see"),
            "cie_raw": course_eval.get("cie_raw", 0),
            "cie_reduced": course_eval.get("cie_reduced", 0),
            "total": course_eval.get("total", 0),
            "grade": course_eval.get("grade", "F"),
            "is_at_risk": risk["is_at_risk"],
            "risk_severity": risk["severity"],
            "risk_reasons": risk["reasons"],
        })

    return jsonify({
        "course_code": course_code,
        "section": section,
        "total_students": len(roster),
        "students": roster,
    })


# ── POST /classes/attendance ────────────────────────────────────────────────

@classes_bp.post("/attendance")
def record_class_attendance():
    """
    Take attendance for a class session.
    Body:
      course_code: "CS3C01"
      section:     "A"
      date:        "2026-09-02"
      time_slot:   "09:00 - 10:00" (optional)
      records:     [ { student_id: "STU001", status: "present" | "absent" }, ... ]
    """
    ctx = _get_context()
    if ctx["role"] and ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied. Only faculty and admins can mark attendance."}), 403

    data = request.get_json(force=True) or {}
    course_code = data.get("course_code")
    section = data.get("section")
    records = data.get("records") or []
    date_str = data.get("date")

    if not course_code or not section or not records:
        return jsonify({"error": "course_code, section, and records are required"}), 400

    faculty_id = ctx["linked_id"] or "FAC001"
    session_date = date.today()
    if date_str:
        try:
            session_date = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        except ValueError:
            pass

    present_count = sum(1 for r in records if r.get("status") == "present")
    absent_count = len(records) - present_count

    # Find assignment for course name
    ca = next((c for c in FACULTY_CLASS_ASSIGNMENTS if c["course_code"] == course_code), None)
    course_name = ca["course_name"] if ca else course_code

    session = ClassAttendanceSession(
        faculty_id=faculty_id,
        course_code=course_code,
        course_name=course_name,
        section=section,
        session_date=session_date,
        time_slot=data.get("time_slot", "Regular Lecture"),
        total_students=len(records),
        present_count=present_count,
        absent_count=absent_count,
    )
    db.session.add(session)
    db.session.flush()

    # Save attendance entries and adjust student cumulative percentage
    for r in records:
        stu_id = r.get("student_id")
        status = r.get("status", "present")
        db.session.add(ClassAttendanceEntry(
            session_id=session.id,
            student_id=stu_id,
            status=status,
        ))

        # Update student cumulative course attendance
        student = Student.query.filter_by(student_id=stu_id).first()
        if student:
            history = db.session.query(ClassAttendanceEntry.status).\
                join(ClassAttendanceSession, ClassAttendanceSession.id == ClassAttendanceEntry.session_id).\
                filter(ClassAttendanceSession.course_code == course_code, ClassAttendanceEntry.student_id == stu_id).all()

            if history:
                tot = len(history)
                pres = sum(1 for (st,) in history if st == "present")
                new_pct = round((pres / tot) * 100.0, 1)
            else:
                new_pct = 100.0 if status == "present" else 0.0

            student.update_course_attendance(course_code, new_pct)

    db.session.commit()

    return jsonify({
        "message": "Attendance successfully recorded",
        "session_id": session.id,
        "date": session.session_date.isoformat(),
        "time_slot": session.time_slot,
        "present_count": present_count,
        "absent_count": absent_count,
        "attendance_rate": round((present_count / len(records) * 100.0), 1) if records else 100.0,
    }), 201


@classes_bp.get("/<course_code>/<section>/attendance-sessions")
def get_class_attendance_sessions(course_code, section):
    """
    Returns recent attendance sessions for this class.
    """
    ctx = _get_context()
    if ctx["role"] and ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    sessions = ClassAttendanceSession.query.filter_by(course_code=course_code, section=section)\
        .order_by(ClassAttendanceSession.session_date.desc(), ClassAttendanceSession.id.desc()).limit(30).all()

    return jsonify([s.to_dict() for s in sessions])


@classes_bp.get("/attendance-sessions/<int:session_id>")
def get_attendance_session_detail(session_id):
    """
    Get full attendance session details including student roster and present/absent statuses.
    """
    ctx = _get_context()
    if ctx["role"] and ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    session = ClassAttendanceSession.query.get_or_404(session_id)

    if ctx["role"] == "teacher" and ctx["linked_id"] and session.faculty_id != ctx["linked_id"]:
        ca = CourseAssignment.query.filter_by(
            faculty_id=ctx["linked_id"],
            course_code=session.course_code,
            section=session.section
        ).first()
        if not ca:
            return jsonify({"error": "You are not assigned to this class"}), 403

    entries = ClassAttendanceEntry.query.filter_by(session_id=session.id).all()
    entry_map = {e.student_id: e.status for e in entries}

    students = Student.query.filter_by(section=session.section).order_by(Student.student_id).all()
    roster = []
    for s in students:
        roster.append({
            "student_id": s.student_id,
            "name": s.name,
            "email": s.email,
            "status": entry_map.get(s.student_id, "present"),
        })

    data = session.to_dict()
    data["roster"] = roster
    return jsonify(data)


@classes_bp.patch("/attendance-sessions/<int:session_id>")
def update_attendance_session(session_id):
    """
    Update past session attendance records with a mandatory change comment.
    Body:
      records: [{"student_id": "STU001", "status": "present"}, ...]
      change_comment: "Medical certificate submitted for STU003; on-duty OD form approved."
    """
    ctx = _get_context()
    if ctx["role"] and ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied. Only teachers and admins can modify attendance."}), 403

    session = ClassAttendanceSession.query.get_or_404(session_id)

    if ctx["role"] == "teacher" and ctx["linked_id"] and session.faculty_id != ctx["linked_id"]:
        ca = CourseAssignment.query.filter_by(
            faculty_id=ctx["linked_id"],
            course_code=session.course_code,
            section=session.section
        ).first()
        if not ca:
            return jsonify({"error": "You are not assigned to this class"}), 403

    data = request.get_json(force=True) or {}
    records = data.get("records") or []
    change_comment = (data.get("change_comment") or "").strip()

    if not change_comment:
        return jsonify({"error": "A comment explaining why the attendance was modified is mandatory for audit compliance."}), 400

    if not records:
        return jsonify({"error": "No attendance records provided"}), 400

    present_count = sum(1 for r in records if r.get("status") == "present")
    absent_count = len(records) - present_count

    session.present_count = present_count
    session.absent_count = absent_count
    session.is_edited = True
    session.change_comment = change_comment
    session.edited_at = datetime.utcnow()
    session.edited_by = ctx["linked_id"] or ctx["role"].upper()

    # Update or create entries
    for r in records:
        stu_id = r.get("student_id")
        status = r.get("status", "present")
        entry = ClassAttendanceEntry.query.filter_by(session_id=session.id, student_id=stu_id).first()
        if entry:
            entry.status = status
        else:
            db.session.add(ClassAttendanceEntry(session_id=session.id, student_id=stu_id, status=status))

    # Recompute course-level attendance for students in this class
    for r in records:
        stu_id = r.get("student_id")
        student = Student.query.filter_by(student_id=stu_id).first()
        if student:
            history = db.session.query(ClassAttendanceEntry.status).join(ClassAttendanceSession)\
                .filter(
                    ClassAttendanceSession.course_code == session.course_code,
                    ClassAttendanceSession.section == session.section,
                    ClassAttendanceEntry.student_id == stu_id
                ).all()
            tot = len(history)
            pres = sum(1 for (st,) in history if st == "present")
            new_att_pct = round((pres / tot) * 100.0, 1) if tot > 0 else 100.0
            student.update_course_attendance(session.course_code, new_att_pct)

    db.session.commit()

    return jsonify({
        "message": "Attendance session successfully updated and audit note logged",
        "session": session.to_dict(),
        "present_count": present_count,
        "absent_count": absent_count,
        "change_comment": change_comment,
    })



# ── POST /classes/marks ─────────────────────────────────────────────────────


@classes_bp.post("/marks")
def enter_exam_marks():
    """
    Enter exam marks (CIE 1, CIE 2, Quizzes, EL, SEE) for students.
    Body:
      course_code: "CS3C01"
      section:     "A"
      exam_type:   "cie1" | "cie2" | "quiz1" | "quiz2" | "el" | "see"
      marks:       [ { student_id: "STU001", score: 22.5 }, ... ]
    """
    ctx = _get_context()
    if ctx["role"] and ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied. Only faculty and admins can enter exam marks."}), 403

    data = request.get_json(force=True) or {}
    course_code = data.get("course_code")
    section = data.get("section")
    exam_type = (data.get("exam_type") or "").lower()
    marks_list = data.get("marks") or []

    if not course_code or not section or not exam_type or not marks_list:
        return jsonify({"error": "course_code, section, exam_type, and marks are required"}), 400

    if exam_type not in EXAM_MAX_MARKS:
        return jsonify({"error": f"Invalid exam_type. Supported: {list(EXAM_MAX_MARKS.keys())}"}), 400

    max_mark = EXAM_MAX_MARKS[exam_type]
    updated_count = 0
    scores = []

    for m in marks_list:
        stu_id = m.get("student_id")
        score = m.get("score")
        if score is None:
            continue

        try:
            score = float(score)
        except (ValueError, TypeError):
            continue

        # Cap score between 0 and max_mark
        score = max(0.0, min(max_mark, score))
        scores.append(score)

        student = Student.query.filter_by(student_id=stu_id).first()
        if student:
            student.update_course_marks(course_code, exam_type, score)
            updated_count += 1

    db.session.commit()

    class_avg = round(sum(scores) / len(scores), 2) if scores else 0.0
    highest = max(scores) if scores else 0.0
    lowest = min(scores) if scores else 0.0
    passing_count = sum(1 for s in scores if s >= (max_mark * 0.48))

    return jsonify({
        "message": f"{exam_type.upper()} marks successfully updated for {updated_count} students",
        "course_code": course_code,
        "section": section,
        "exam_type": exam_type,
        "max_marks": max_mark,
        "updated_students": updated_count,
        "statistics": {
            "average": class_avg,
            "highest": highest,
            "lowest": lowest,
            "passing_count": passing_count,
            "pass_percentage": round((passing_count / len(scores) * 100.0), 1) if scores else 0.0,
        }
    }), 200


# ── GET /classes/<course_code>/<section>/at-risk ─────────────────────────────

@classes_bp.get("/<course_code>/<section>/at-risk")
def get_class_at_risk(course_code, section):
    """
    Returns low performing and at-risk students for the class with explicit reasons.
    """
    ctx = _get_context()
    if ctx["role"] and ctx["role"] not in ("admin", "teacher"):
        return jsonify({"error": "Access denied"}), 403

    students = Student.query.filter_by(section=section).all()
    at_risk_students = []

    for s in students:
        risk = s.get_course_risk_status(course_code)
        if risk["is_at_risk"]:
            courses = s.get_courses()
            course_eval = next((c for c in courses if c.get("code") == course_code), {})
            at_risk_students.append({
                "id": s.id,
                "student_id": s.student_id,
                "name": s.name,
                "email": s.email,
                "phone": s.phone,
                "section": s.section,
                "semester": s.semester,
                "attendance_pct": course_eval.get("attendance_pct", s.attendance_pct),
                "cie1": course_eval.get("cie1"),
                "cie2": course_eval.get("cie2"),
                "cie_raw": course_eval.get("cie_raw", 0),
                "grade": course_eval.get("grade", "F"),
                "severity": risk["severity"],
                "risk_reasons": risk["reasons"],
            })

    # Sort high severity first
    severity_order = {"high": 0, "medium": 1, "low": 2}
    at_risk_students.sort(key=lambda s: severity_order.get(s["severity"], 3))

    return jsonify({
        "course_code": course_code,
        "section": section,
        "at_risk_count": len(at_risk_students),
        "total_students": len(students),
        "at_risk_students": at_risk_students,
    })
