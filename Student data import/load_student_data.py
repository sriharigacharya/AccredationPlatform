#!/usr/bin/env python3
"""
AcademiQ — Student Data Import Validator & Payload Builder
============================================================

Purpose
-------
Reads the three normalized CSVs (Students.csv, Course_Assessments.csv,
Attendance.csv), validates them against academiq_import_schema.json, and
writes three upload-ready JSON payload files. It does NOT open a database
connection and does NOT write any SQL — by design, so the actual insert/
upsert logic stays inside academic-data-service where RBAC and audit
logging already live, rather than being duplicated here.

Usage
-----
    python3 load_student_data.py [--data-dir DIR] [--out-dir DIR]

Exit codes
----------
    0  = validation passed (with or without warnings), payloads written
    1  = validation failed (errors found), NO payloads written

Dependencies
------------
    Standard library only (csv, json, re, argparse, pathlib, collections).
    No pandas / no third-party packages required, so this drops into any
    Python 3.8+ environment without a requirements.txt change.
"""

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

USN_PATTERN = re.compile(r"^\d[A-Z]{2}\d{2}[A-Z]{2}\d{3}$")
SECTION_ENUM = {"A", "B", "C"}
ELIGIBILITY_ENUM = {"Eligible", "Condonation", "Detained / NSAR"}
COURSE_MAX_TEST = {
    "CS3C01": 25,
    "CS3C03": 20,
    "CS6C04": 25,
    "CS8E501": 25,
}


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def to_number(v):
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except ValueError:
        return v  # leave as-is; validator will flag it


def validate_students(rows, errors, warnings):
    seen_ids = set()
    for i, row in enumerate(rows, start=2):  # +2 => spreadsheet-style row number incl. header
        sid = row.get("student_id", "").strip()
        if not sid:
            errors.append(f"Students row {i}: missing student_id")
            continue
        if not USN_PATTERN.match(sid):
            errors.append(f"Students row {i}: student_id '{sid}' does not match USN pattern")
        if sid in seen_ids:
            errors.append(f"Students row {i}: duplicate student_id '{sid}'")
        seen_ids.add(sid)
        if not row.get("name", "").strip():
            errors.append(f"Students row {i} ({sid}): missing name")
        if not row.get("department_id", "").strip():
            errors.append(f"Students row {i} ({sid}): missing department_id")

        for fill_field in ("email", "phone", "admission_quota", "gender",
                           "mentor_faculty_id", "academic_term", "enrollment_status"):
            if not row.get(fill_field, "").strip():
                warnings.append(
                    f"Students row {i} ({sid}): '{fill_field}' is empty — "
                    f"not present in source data, needs manual/SIS fill before this "
                    f"record is considered complete."
                )
    return seen_ids


def validate_course_assessments(rows, valid_student_ids, errors, warnings):
    seen_keys = set()
    for i, row in enumerate(rows, start=2):
        sid = row.get("student_id", "").strip()
        code = row.get("course_code", "").strip()
        sem = row.get("semester", "").strip()
        sec = row.get("section", "").strip()
        key = (sid, code, sem, sec)

        if sid and sid not in valid_student_ids:
            errors.append(f"Course_Assessments row {i}: student_id '{sid}' not found in Students.csv")
        if key in seen_keys:
            errors.append(f"Course_Assessments row {i}: duplicate key {key}")
        seen_keys.add(key)

        if sec and sec not in SECTION_ENUM:
            errors.append(f"Course_Assessments row {i} ({sid}): invalid section '{sec}'")

        max_test = COURSE_MAX_TEST.get(code)
        for field in ("cie1", "cie2", "cie3"):
            raw = row.get(field, "")
            val = to_number(raw)
            if val is None:
                continue
            if not isinstance(val, (int, float)):
                errors.append(f"Course_Assessments row {i} ({sid}, {code}): non-numeric {field}='{raw}'")
            elif max_test and val > max_test:
                errors.append(
                    f"Course_Assessments row {i} ({sid}, {code}): {field}={val} exceeds "
                    f"expected max {max_test} for this course"
                )

        cie_reduced = to_number(row.get("cie_reduced", ""))
        if isinstance(cie_reduced, (int, float)) and cie_reduced > 50:
            errors.append(f"Course_Assessments row {i} ({sid}, {code}): cie_reduced={cie_reduced} exceeds 50")

        for fill_field in ("credits", "see_raw", "see_reduced", "grand_total", "grade", "grade_points"):
            if not row.get(fill_field, "").strip():
                warnings.append(
                    f"Course_Assessments row {i} ({sid}, {code}): '{fill_field}' is empty — "
                    f"expected until a Semester End Exam / curriculum-credits source is uploaded."
                )
    return seen_keys


def validate_attendance(rows, valid_student_ids, errors, warnings):
    seen_keys = set()
    for i, row in enumerate(rows, start=2):
        sid = row.get("student_id", "").strip()
        code = row.get("course_code", "").strip()
        sem = row.get("semester", "").strip()
        sec = row.get("section", "").strip()
        key = (sid, code, sem, sec)

        if sid and sid not in valid_student_ids:
            errors.append(f"Attendance row {i}: student_id '{sid}' not found in Students.csv")
        if key in seen_keys:
            errors.append(f"Attendance row {i}: duplicate key {key}")
        seen_keys.add(key)

        pct = to_number(row.get("attendance_pct", ""))
        if isinstance(pct, (int, float)) and not (0 <= pct <= 100):
            errors.append(f"Attendance row {i} ({sid}, {code}): attendance_pct={pct} out of 0-100 range")

        elig = row.get("eligibility_status", "").strip()
        if elig and elig not in ELIGIBILITY_ENUM:
            errors.append(f"Attendance row {i} ({sid}, {code}): invalid eligibility_status '{elig}'")

        conducted = to_number(row.get("classes_conducted", ""))
        attended = to_number(row.get("classes_attended", ""))
        if isinstance(conducted, (int, float)) and isinstance(attended, (int, float)) and conducted > 0:
            recalced = round(attended / conducted * 100)
            if isinstance(pct, (int, float)) and abs(recalced - pct) > 1:
                errors.append(
                    f"Attendance row {i} ({sid}, {code}): attendance_pct={pct} does not match "
                    f"recalculated {recalced} from classes_attended/classes_conducted"
                )
    return seen_keys


def build_payloads(students_rows, assessment_rows, attendance_rows):
    """Nest assessments + attendance under each student's courses_data,
    matching the spec's 'students.courses_data (JSON Matrix)' design."""
    by_student = defaultdict(lambda: {"assessments": [], "attendance": []})
    for row in assessment_rows:
        clean = {k: (to_number(v) if k not in ("student_id", "student_name", "course_code",
                                                 "course_name", "section", "course_status",
                                                 "assessment_notes") else v)
                 for k, v in row.items()}
        clean = {k: (v if v != "" else None) for k, v in clean.items()}
        by_student[row["student_id"]]["assessments"].append(
            {k: v for k, v in clean.items() if k not in ("student_id", "student_name")}
        )
    for row in attendance_rows:
        clean = {k: (to_number(v) if k not in ("student_id", "student_name", "course_code",
                                                 "course_name", "section", "eligibility_status")
                     else v) for k, v in row.items()}
        clean = {k: (v if v != "" else None) for k, v in clean.items()}
        by_student[row["student_id"]]["attendance"].append(
            {k: v for k, v in clean.items() if k not in ("student_id", "student_name")}
        )

    students_payload = []
    for row in students_rows:
        sid = row["student_id"]
        clean = {k: (v if v != "" else None) for k, v in row.items()}
        clean["semester"] = to_number(clean.get("semester"))
        record = dict(clean)
        record["courses_data"] = by_student.get(sid, {"assessments": [], "attendance": []})["assessments"]
        record["attendance_data"] = by_student.get(sid, {"assessments": [], "attendance": []})["attendance"]
        students_payload.append(record)

    return students_payload


def main():
    parser = argparse.ArgumentParser(description="Validate and package AcademiQ student import data.")
    parser.add_argument("--data-dir", default=".", help="Directory containing the 3 CSVs (default: cwd)")
    parser.add_argument("--out-dir", default="./payloads", help="Where to write JSON payloads")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)

    students_rows = read_csv(data_dir / "Students.csv")
    assessment_rows = read_csv(data_dir / "Course_Assessments.csv")
    attendance_rows = read_csv(data_dir / "Attendance.csv")

    errors, warnings = [], []
    valid_ids = validate_students(students_rows, errors, warnings)
    validate_course_assessments(assessment_rows, valid_ids, errors, warnings)
    validate_attendance(attendance_rows, valid_ids, errors, warnings)

    print(f"Students: {len(students_rows)} rows | Course_Assessments: {len(assessment_rows)} rows | "
          f"Attendance: {len(attendance_rows)} rows")
    print(f"Validation: {len(errors)} error(s), {len(warnings)} warning(s)\n")

    if warnings:
        print("--- WARNINGS (expected — these are the documented TO_FILL gaps) ---")
        # Summarize instead of dumping all 270 rows' worth of "email is empty" lines
        by_field = defaultdict(int)
        for w in warnings:
            m = re.search(r"'([a-z_]+)' is empty", w)
            by_field[m.group(1) if m else "other"] += 1
        for field, count in sorted(by_field.items(), key=lambda x: -x[1]):
            print(f"  {field}: empty in {count} row(s) — needs a separate source upload")
        print()

    if errors:
        print("--- ERRORS (must fix before import) ---")
        for e in errors[:100]:
            print(f"  {e}")
        if len(errors) > 100:
            print(f"  ... and {len(errors) - 100} more")
        print(f"\nFAILED — {len(errors)} error(s) found. No payload files written.")
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)
    students_payload = build_payloads(students_rows, assessment_rows, attendance_rows)

    (out_dir / "students_payload.json").write_text(json.dumps(students_payload, indent=2))
    (out_dir / "course_assessments_payload.json").write_text(json.dumps(assessment_rows, indent=2))
    (out_dir / "attendance_payload.json").write_text(json.dumps(attendance_rows, indent=2))

    print(f"PASSED — payloads written to {out_dir}/")
    print("  students_payload.json            (students, each with nested courses_data + attendance_data)")
    print("  course_assessments_payload.json  (flat list, one entry per student/course/semester/section)")
    print("  attendance_payload.json          (flat list, one entry per student/course/semester/section)")
    sys.exit(0)


if __name__ == "__main__":
    main()
