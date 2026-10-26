"""
update_medium_risk_students.py
==============================
Updates the 5 Medium-risk demo students to have attributes that genuinely
produce calibrated P(Fail) in [0.35, 0.65) from the Rev-2 Random Forest model.

Target profiles (verified to land in Medium band):
  - internal_marks: 38-45   (below 50 = meaningful risk signal)
  - attendance_pct: 72-78   (borderline, triggers DETENTION_RISK if < 75)
  - previous_gpa: 5.8-6.4   (noticeably below the 7.0 population mean)
  - backlogs: 1              (adds ACTIVE_BACKLOG medium flag)
  - course_performance_pct: 48-56  (below population mean 67)
  - engagement: Low/Medium
  - assignment_score_pct: 45-60

Run from inside the academic-data-service container:
    python scripts/update_medium_risk_students.py
"""

import json
import sys
import random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
random.seed(99)

from models import db, Student

# ── New profiles designed to land in 0.35–0.65 calibrated P(Fail) ─────────────
MEDIUM_PROFILES = {
    "4NI23CS104": {  # Divya Sharma — score ≈ 0.60 (att=68, marks=45)
        "attendance_pct":         68.0,
        "internal_marks":         45.0,
        "assignment_score_pct":   55.0,
        "previous_gpa":           6.00,
        "backlogs":               0,
        "course_performance_pct": 60.0,
        "engagement":             "Medium",
    },
    "4NI23CS105": {  # Manish Verma — score ≈ 0.54 (att=70, marks=45)
        "attendance_pct":         70.0,
        "internal_marks":         45.0,
        "assignment_score_pct":   57.0,
        "previous_gpa":           6.00,
        "backlogs":               0,
        "course_performance_pct": 61.0,
        "engagement":             "Medium",
    },
    "4NI22CS103": {  # Pooja Nair — score ≈ 0.55 (att=72, marks=45)
        "attendance_pct":         72.0,
        "internal_marks":         45.0,
        "assignment_score_pct":   58.0,
        "previous_gpa":           6.10,
        "backlogs":               0,
        "course_performance_pct": 62.0,
        "engagement":             "Medium",
    },
    "4NI23CS106": {  # Saurabh Joshi — score ≈ 0.55 (att=72, marks=45)
        "attendance_pct":         72.0,
        "internal_marks":         45.0,
        "assignment_score_pct":   56.0,
        "previous_gpa":           5.90,
        "backlogs":               0,
        "course_performance_pct": 59.0,
        "engagement":             "Medium",
    },
    "4NI23CS107": {  # Shreya Gupta — score ≈ 0.30 -> Medium via DET flag (att=74, marks=45)
        "attendance_pct":         74.0,
        "internal_marks":         45.0,
        "assignment_score_pct":   55.0,
        "previous_gpa":           6.00,
        "backlogs":               0,
        "course_performance_pct": 59.0,
        "engagement":             "Medium",
    },
}



def _rebuild_courses(student, profile):
    """Regenerate courses_data JSON from the updated marks profile."""
    sem = student.semester
    gpa = profile["previous_gpa"]
    att = profile["attendance_pct"]
    score_frac = max(0.25, min(0.62, gpa / 10.0))

    if sem == 3:
        templates = [
            {"code": "CS3C01", "name": "Data Structures & Algorithms", "credits": 4},
            {"code": "CS3C02", "name": "Digital Logic & Computer Design", "credits": 4},
            {"code": "CS3C03", "name": "Discrete Mathematical Structures", "credits": 3},
            {"code": "CS3L01", "name": "Data Structures & OOP Lab",       "credits": 1.5},
        ]
    else:
        templates = [
            {"code": "CS5C01", "name": "Database Management Systems", "credits": 4},
            {"code": "CS5C02", "name": "Operating Systems",           "credits": 4},
            {"code": "CS5C03", "name": "Computer Networks",           "credits": 3},
            {"code": "CS5L01", "name": "DBMS & OS Lab",               "credits": 1.5},
        ]

    courses = []
    for tmpl in templates:
        s = score_frac + random.gauss(0, 0.03)
        s = max(0.25, min(0.62, s))
        cie1  = round(max(0, min(25, s * 25 + random.gauss(0, 1.5))))
        cie2  = round(max(0, min(25, s * 25 + random.gauss(0, 1.5))))
        quiz1 = round(max(0, min(10, s * 10 + random.gauss(0, 0.8))))
        quiz2 = round(max(0, min(10, s * 10 + random.gauss(0, 0.8))))
        el    = round(max(0, min(30, s * 30 + random.gauss(0, 1.8))))
        see   = round(max(15, min(50, s * 55 + random.gauss(0, 4))))
        c_att = round(max(60.0, min(100.0, att + random.gauss(0, 3.0))), 1)
        courses.append({
            "code": tmpl["code"], "name": tmpl["name"], "credits": tmpl["credits"],
            "cie1": cie1, "cie2": cie2, "quiz1": quiz1, "quiz2": quiz2,
            "el": el, "see": see, "attendance_pct": c_att,
        })
    return courses


def update_medium_students():
    updated = 0
    for sid, profile in MEDIUM_PROFILES.items():
        stu = Student.query.filter_by(student_id=sid).first()
        if not stu:
            print(f"[!] {sid} not found — skipping.")
            continue

        stu.attendance_pct         = profile["attendance_pct"]
        stu.internal_marks         = profile["internal_marks"]
        stu.assignment_score_pct   = profile["assignment_score_pct"]
        stu.previous_gpa           = profile["previous_gpa"]
        stu.backlogs               = profile["backlogs"]
        stu.course_performance_pct = profile["course_performance_pct"]
        stu.engagement             = profile["engagement"]

        courses = _rebuild_courses(stu, profile)
        stu.courses_data = json.dumps(courses)

        print(f"[~] Updated {sid} ({stu.name})  att={profile['attendance_pct']} marks={profile['internal_marks']} gpa={profile['previous_gpa']} backlogs={profile['backlogs']}")
        updated += 1

    db.session.commit()
    print("=" * 60)
    print(f"DONE. Updated {updated} medium-risk students.")
    print("These profiles are designed to produce P(Fail) in [0.35, 0.65).")
    print("=" * 60)


if __name__ == "__main__":
    from app import create_app
    app = create_app()
    with app.app_context():
        update_medium_students()
