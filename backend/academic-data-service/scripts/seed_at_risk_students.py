"""
Seed Script: 10 At-Risk Students for ML Risk Tier Prediction Demonstration
============================================================================
Adds 10 students whose academic attributes are deliberately crafted to trigger
Medium Risk (5 students) and High Risk (5 students) predictions from the
Random-Forest model in the prediction-service.

USN Format: matches existing institution format — 4NI<YY><DEPT><###>
  - Sem 3 (admitted 2023) : 4NI23CS101 – 4NI23CS107
  - Sem 5 (admitted 2022) : 4NI22CS101 – 4NI22CS103

Risk-tier thresholds (from predict.py):
  - High   : fail_prob >= 0.70
  - Medium : fail_prob >= 0.40 and < 0.70
  - Low    : fail_prob < 0.40

Feature ranges used to steer predictions:
  - High Risk   : low attendance (55-65%), low GPA (4.5-5.2),
                  backlogs 3-4, Low engagement, poor marks
  - Medium Risk : borderline attendance (74-78%), GPA (6.75-7.0),
                  no backlogs, Medium engagement

Run from inside the academic-data-service container:
    python scripts/seed_at_risk_students.py
"""

import json
import sys
import random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models import db, Student, Department

# ── Deterministic seed for reproducibility ─────────────────────────────────
random.seed(42)


# USN prefix conventions:
#   4NI23CS  = Sem 3 (Year 2, admitted 2023), CSE dept
#   4NI22CS  = Sem 5 (Year 3, admitted 2022), CSE dept
AT_RISK_STUDENTS = [
    # ── HIGH RISK (5 students) — fail_prob >= 0.70 ─────────────────────────
    # Attributes: very low attendance, very low GPA, 3-4 backlogs, Low engagement
    {
        "student_id": "4NI23CS101",
        "name": "Arjun Chauhan",
        "semester": 3,
        "section": "A",
        "attendance_pct": 57.2,
        "assignment_score_pct": 32.5,
        "previous_gpa": 4.50,
        "backlogs": 4,
        "course_performance_pct": 45.0,
        "engagement": "Low",
        "final_result": "Fail",
        "risk_tier": "High",
    },
    {
        "student_id": "4NI23CS102",
        "name": "Priya Sinha",
        "semester": 3,
        "section": "B",
        "attendance_pct": 61.0,
        "assignment_score_pct": 38.0,
        "previous_gpa": 4.80,
        "backlogs": 3,
        "course_performance_pct": 48.0,
        "engagement": "Low",
        "final_result": "Fail",
        "risk_tier": "High",
    },
    {
        "student_id": "4NI22CS101",
        "name": "Rohit Pandey",
        "semester": 5,
        "section": "A",
        "attendance_pct": 55.8,
        "assignment_score_pct": 29.0,
        "previous_gpa": 4.60,
        "backlogs": 4,
        "course_performance_pct": 46.0,
        "engagement": "Low",
        "final_result": "Fail",
        "risk_tier": "High",
    },
    {
        "student_id": "4NI22CS102",
        "name": "Neha Dubey",
        "semester": 5,
        "section": "C",
        "attendance_pct": 63.5,
        "assignment_score_pct": 35.5,
        "previous_gpa": 5.10,
        "backlogs": 3,
        "course_performance_pct": 51.0,
        "engagement": "Low",
        "final_result": "Fail",
        "risk_tier": "High",
    },
    {
        "student_id": "4NI23CS103",
        "name": "Karan Thakur",
        "semester": 3,
        "section": "C",
        "attendance_pct": 59.3,
        "assignment_score_pct": 31.0,
        "previous_gpa": 4.70,
        "backlogs": 4,
        "course_performance_pct": 47.0,
        "engagement": "Low",
        "final_result": "Fail",
        "risk_tier": "High",
    },

    # ── MEDIUM RISK (5 students) — fail_prob 0.40–0.69 ─────────────────────
    # Attributes: borderline attendance (74-78%), GPA 6.75-7.00,
    # no backlogs, Medium engagement — verified to land in 0.48-0.68 fail_prob
    {
        "student_id": "4NI23CS104",
        "name": "Divya Sharma",
        "semester": 3,
        "section": "A",
        "attendance_pct": 75.5,
        "assignment_score_pct": 67.0,
        "previous_gpa": 6.80,
        "backlogs": 0,
        "course_performance_pct": 68.0,
        "engagement": "Medium",
        "final_result": "Pass",
        "risk_tier": "Medium",
    },
    {
        "student_id": "4NI23CS105",
        "name": "Manish Verma",
        "semester": 3,
        "section": "B",
        "attendance_pct": 78.0,
        "assignment_score_pct": 70.0,
        "previous_gpa": 7.00,
        "backlogs": 0,
        "course_performance_pct": 70.0,
        "engagement": "Medium",
        "final_result": "Pass",
        "risk_tier": "Medium",
    },
    {
        "student_id": "4NI22CS103",
        "name": "Pooja Nair",
        "semester": 5,
        "section": "B",
        "attendance_pct": 76.2,
        "assignment_score_pct": 68.0,
        "previous_gpa": 6.85,
        "backlogs": 0,
        "course_performance_pct": 68.5,
        "engagement": "Medium",
        "final_result": "Pass",
        "risk_tier": "Medium",
    },
    {
        "student_id": "4NI23CS106",
        "name": "Saurabh Joshi",
        "semester": 3,
        "section": "D",
        "attendance_pct": 76.0,
        "assignment_score_pct": 65.0,
        "previous_gpa": 6.80,
        "backlogs": 0,
        "course_performance_pct": 68.0,
        "engagement": "Medium",
        "final_result": "Pass",
        "risk_tier": "Medium",
    },
    {
        "student_id": "4NI23CS107",
        "name": "Shreya Gupta",
        "semester": 3,
        "section": "C",
        "attendance_pct": 74.8,
        "assignment_score_pct": 66.0,
        "previous_gpa": 6.75,
        "backlogs": 0,
        "course_performance_pct": 67.5,
        "engagement": "Medium",
        "final_result": "Pass",
        "risk_tier": "Medium",
    },
]


def _make_courses_for(student: dict) -> list:
    """Generate realistic per-course evaluation data matching the student's profile."""
    sem = student["semester"]
    att = student["attendance_pct"]
    gpa = student["previous_gpa"]

    # Map GPA -> raw score fraction
    score_frac = max(0.28, min(0.85, gpa / 10.0))

    if sem == 3:
        templates = [
            {"code": "CS3C01", "name": "Data Structures & Algorithms", "credits": 4},
            {"code": "CS3C02", "name": "Digital Logic & Computer Design", "credits": 4},
            {"code": "CS3C03", "name": "Discrete Mathematical Structures", "credits": 3},
            {"code": "CS3L01", "name": "Data Structures & OOP Lab", "credits": 1.5},
        ]
    else:  # sem == 5
        templates = [
            {"code": "CS5C01", "name": "Database Management Systems", "credits": 4},
            {"code": "CS5C02", "name": "Operating Systems", "credits": 4},
            {"code": "CS5C03", "name": "Computer Networks", "credits": 3},
            {"code": "CS5L01", "name": "DBMS & OS Lab", "credits": 1.5},
        ]

    courses = []
    for tmpl in templates:
        s = score_frac + random.gauss(0, 0.03)
        s = max(0.28, min(0.85, s))

        cie1  = round(max(0, min(25, s * 25 + random.gauss(0, 1.5))))
        cie2  = round(max(0, min(25, s * 25 + random.gauss(0, 1.5))))
        quiz1 = round(max(0, min(10, s * 10 + random.gauss(0, 0.8))))
        quiz2 = round(max(0, min(10, s * 10 + random.gauss(0, 0.8))))
        el    = round(max(0, min(30, s * 30 + random.gauss(0, 1.8))))
        see   = round(max(15, min(55, s * 60 + random.gauss(0, 5))))  # Failing-range SEE
        c_att = round(max(45.0, min(100.0, att + random.gauss(0, 3.0))), 1)

        courses.append({
            "code": tmpl["code"],
            "name": tmpl["name"],
            "credits": tmpl["credits"],
            "cie1": cie1,
            "cie2": cie2,
            "quiz1": quiz1,
            "quiz2": quiz2,
            "el": el,
            "see": see,
            "attendance_pct": c_att,
        })
    return courses


def seed_at_risk_students():
    """Insert 10 at-risk demo students (5 High + 5 Medium risk) into the DB."""
    dept = Department.query.filter_by(code="CSE").first()
    if not dept:
        print("[!] Department CSE not found. Please run the main seed scripts first.")
        return

    inserted = 0
    skipped  = 0

    for sd in AT_RISK_STUDENTS:
        # Skip if already seeded (idempotent)
        if Student.query.filter_by(student_id=sd["student_id"]).first():
            print(f"[~] {sd['student_id']} already exists — skipping.")
            skipped += 1
            continue

        courses      = _make_courses_for(sd)
        courses_json = json.dumps(courses)
        int_marks    = round(
            sum(c["cie1"] + c["cie2"] + c["quiz1"] + c["quiz2"] + c["el"] for c in courses)
            / len(courses),
            1,
        )
        fname     = sd["name"].split()[0].lower()
        sid_lower = sd["student_id"].lower().replace("_", "")
        email     = f"{fname}.{sid_lower}@student.academiq.edu"

        new_stu = Student(
            student_id             = sd["student_id"],
            name                   = sd["name"],
            email                  = email,
            phone                  = "9000000000",
            department_id          = dept.id,
            semester               = sd["semester"],
            section                = sd["section"],
            attendance_pct         = sd["attendance_pct"],
            internal_marks         = int_marks,
            assignment_score_pct   = sd["assignment_score_pct"],
            previous_gpa           = sd["previous_gpa"],
            backlogs               = sd["backlogs"],
            course_performance_pct = sd["course_performance_pct"],
            engagement             = sd["engagement"],
            final_result           = sd["final_result"],
            courses_data           = courses_json,
        )
        db.session.add(new_stu)
        inserted += 1
        print(f"[+] Added {sd['student_id']} ({sd['name']}) — Expected Risk: {sd['risk_tier']}")

    db.session.commit()

    print("=" * 60)
    print("AT-RISK STUDENT SEEDING COMPLETE")
    print(f"  Inserted : {inserted}")
    print(f"  Skipped  : {skipped} (already existed)")
    print("-" * 60)
    print("Expected ML Risk Tier breakdown:")
    high   = [s for s in AT_RISK_STUDENTS if s["risk_tier"] == "High"]
    medium = [s for s in AT_RISK_STUDENTS if s["risk_tier"] == "Medium"]
    print(f"  High Risk   ({len(high)} students) : " + ", ".join(s["student_id"] for s in high))
    print(f"  Medium Risk ({len(medium)} students) : " + ", ".join(s["student_id"] for s in medium))
    print("=" * 60)
    print("\nVerify predictions via:")
    print("  GET  http://localhost:8005/predict/atrisk?threshold=0.4")
    print("  POST http://localhost:8005/predict/batch  (body: { \"students\": [...] })")


if __name__ == "__main__":
    from app import create_app
    app = create_app()
    with app.app_context():
        seed_at_risk_students()
