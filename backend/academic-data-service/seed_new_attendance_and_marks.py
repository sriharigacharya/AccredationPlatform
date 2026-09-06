"""
Seed Script: Clear all attendance and generate new mock attendance sessions and CIE marks.
"""
import json
import random
from datetime import date, datetime, timedelta
from app import create_app
from models import (
    db, Student, Faculty, Department,
    ClassAttendanceSession, ClassAttendanceEntry
)

app = create_app()

with app.app_context():
    print("=" * 60)
    print("1. CLEARING ALL EXISTING ATTENDANCE DATA...")
    del_entries = ClassAttendanceEntry.query.delete()
    del_sessions = ClassAttendanceSession.query.delete()
    db.session.commit()
    print(f"   Deleted {del_entries} attendance entries.")
    print(f"   Deleted {del_sessions} attendance sessions.")

    # Seed random with fixed seed for consistent, realistic distribution
    random.seed(2026)

    students_A = Student.query.filter_by(section='A').order_by(Student.student_id).all()
    students_B = Student.query.filter_by(section='B').order_by(Student.student_id).all()
    students_C = Student.query.filter_by(section='C').order_by(Student.student_id).all()

    print(f"   Found {len(students_A)} in Sec A, {len(students_B)} in Sec B, {len(students_C)} in Sec C.")

    # Designated at-risk student IDs (for realistic academic alerts)
    at_risk_A = {"STU003", "STU006", "STU011", "STU019"}
    at_risk_B = {"STU041", "STU046", "STU052"}
    at_risk_C = {"STU072", "STU078", "STU085", "STU093"}

    # ── 2. CREATE SESSIONS FOR CLASSES ──
    # Course assignments:
    # 1. CS3C01 - Sec A (Faculty: FAC001)
    # 2. CS5C02 - Sec B (Faculty: FAC002)
    # 3. CS7C01 - Sec C (Faculty: FAC001)
    # 4. CS7C03 - Sec C (Faculty: FAC002)

    class_configs = [
        {
            "course_code": "CS3C01",
            "course_name": "Data Structures & Algorithms",
            "section": "A",
            "faculty_id": "FAC001",
            "students": students_A,
            "at_risk_ids": at_risk_A,
            "dates": [
                ("2026-08-04", "09:00 AM - 10:00 AM", False, None),
                ("2026-08-07", "10:00 AM - 11:00 AM", False, None),
                ("2026-08-11", "09:00 AM - 10:00 AM", False, None),
                ("2026-08-14", "11:30 AM - 12:30 PM", False, None),
                ("2026-08-18", "09:00 AM - 10:00 AM", False, None),
                ("2026-08-21", "10:00 AM - 11:00 AM", False, None),
                ("2026-08-25", "09:00 AM - 10:00 AM", False, None),
                ("2026-08-28", "02:30 PM - 03:30 PM", False, None),
                ("2026-09-01", "09:00 AM - 10:00 AM", False, None),
                ("2026-09-02", "10:00 AM - 11:00 AM", False, None),
                ("2026-09-04", "11:30 AM - 12:30 PM", False, None),
                ("2026-09-05", "09:00 AM - 10:00 AM", True, "Verified medical certificate for STU003 and on-duty OD form for STU005."),
            ]
        },
        {
            "course_code": "CS5C02",
            "course_name": "Operating Systems",
            "section": "B",
            "faculty_id": "FAC002",
            "students": students_B,
            "at_risk_ids": at_risk_B,
            "dates": [
                ("2026-08-03", "10:00 AM - 11:00 AM", False, None),
                ("2026-08-06", "11:30 AM - 12:30 PM", False, None),
                ("2026-08-10", "10:00 AM - 11:00 AM", False, None),
                ("2026-08-13", "02:30 PM - 03:30 PM", False, None),
                ("2026-08-17", "10:00 AM - 11:00 AM", False, None),
                ("2026-08-20", "11:30 AM - 12:30 PM", False, None),
                ("2026-08-24", "10:00 AM - 11:00 AM", False, None),
                ("2026-08-27", "03:30 PM - 04:30 PM", False, None),
                ("2026-08-31", "10:00 AM - 11:00 AM", False, None),
                ("2026-09-02", "11:30 AM - 12:30 PM", False, None),
                ("2026-09-03", "10:00 AM - 11:00 AM", False, None),
                ("2026-09-05", "10:00 AM - 11:00 AM", True, "Attendance corrected after validating VTU inter-collegiate symposium duty certificate."),
            ]
        },
        {
            "course_code": "CS7C01",
            "course_name": "Machine Learning",
            "section": "C",
            "faculty_id": "FAC001",
            "students": students_C,
            "at_risk_ids": at_risk_C,
            "dates": [
                ("2026-08-04", "11:30 AM - 12:30 PM", False, None),
                ("2026-08-07", "02:30 PM - 03:30 PM", False, None),
                ("2026-08-11", "11:30 AM - 12:30 PM", False, None),
                ("2026-08-14", "03:30 PM - 04:30 PM", False, None),
                ("2026-08-18", "11:30 AM - 12:30 PM", False, None),
                ("2026-08-21", "02:30 PM - 03:30 PM", False, None),
                ("2026-08-25", "11:30 AM - 12:30 PM", False, None),
                ("2026-08-28", "09:00 AM - 10:00 AM", False, None),
                ("2026-09-01", "11:30 AM - 12:30 PM", False, None),
                ("2026-09-03", "02:30 PM - 03:30 PM", False, None),
                ("2026-09-04", "09:00 AM - 10:00 AM", False, None),
                ("2026-09-05", "11:30 AM - 12:30 PM", True, "Placement drive interview attendance verified and regularized."),
            ]
        },
        {
            "course_code": "CS7C03",
            "course_name": "Cloud Computing",
            "section": "C",
            "faculty_id": "FAC002",
            "students": students_C,
            "at_risk_ids": at_risk_C,
            "dates": [
                ("2026-08-05", "09:00 AM - 10:00 AM", False, None),
                ("2026-08-08", "10:00 AM - 11:00 AM", False, None),
                ("2026-08-12", "09:00 AM - 10:00 AM", False, None),
                ("2026-08-19", "09:00 AM - 10:00 AM", False, None),
                ("2026-08-22", "10:00 AM - 11:00 AM", False, None),
                ("2026-08-26", "09:00 AM - 10:00 AM", False, None),
                ("2026-08-29", "11:30 AM - 12:30 PM", False, None),
                ("2026-09-02", "09:00 AM - 10:00 AM", False, None),
                ("2026-09-04", "10:00 AM - 11:00 AM", False, None),
                ("2026-09-05", "02:30 PM - 03:30 PM", False, None),
            ]
        },
    ]

    print("\n2. CREATING NEW ATTENDANCE SESSIONS & ROSTER ENTRIES...")
    total_sessions_created = 0
    total_entries_created = 0

    # Dictionary to track attendance counts per student per course: { (student_id, course_code): [present_count, total_count] }
    student_course_attendance = {}

    for cfg in class_configs:
        code = cfg["course_code"]
        sec = cfg["section"]
        fac_id = cfg["faculty_id"]
        c_name = cfg["course_name"]
        stus = cfg["students"]
        at_risks = cfg["at_risk_ids"]

        for d_str, slot, is_edit, comment in cfg["dates"]:
            s_date = date.fromisoformat(d_str)

            session = ClassAttendanceSession(
                faculty_id=fac_id,
                course_code=code,
                course_name=c_name,
                section=sec,
                session_date=s_date,
                time_slot=slot,
                total_students=len(stus),
                present_count=0,
                absent_count=0,
                is_edited=is_edit,
                change_comment=comment,
                edited_at=datetime.utcnow() if is_edit else None,
                edited_by=fac_id if is_edit else None,
            )
            db.session.add(session)
            db.session.flush()

            p_count = 0
            a_count = 0

            for stu in stus:
                sid = stu.student_id
                key = (sid, code)
                if key not in student_course_attendance:
                    student_course_attendance[key] = [0, 0]
                student_course_attendance[key][1] += 1

                # Determine attendance status
                if sid in at_risks:
                    # At-risk students have ~50-65% attendance
                    is_present = random.random() < 0.58
                else:
                    # Normal students have ~85-96% attendance
                    is_present = random.random() < 0.90

                status = "present" if is_present else "absent"
                if is_present:
                    p_count += 1
                    student_course_attendance[key][0] += 1
                else:
                    a_count += 1

                db.session.add(ClassAttendanceEntry(
                    session_id=session.id,
                    student_id=sid,
                    status=status
                ))
                total_entries_created += 1

            session.present_count = p_count
            session.absent_count = a_count
            total_sessions_created += 1

    db.session.commit()
    print(f"   Created {total_sessions_created} attendance sessions across classes.")
    print(f"   Created {total_entries_created} student attendance roll-call records.")

    # ── 3. GENERATE FRESH CIE MARKS AND SYNCHRONIZE COURSES_DATA ──
    print("\n3. GENERATING NEW MOCK CIE MARKS & EVALUATION MATRICES...")

    all_students = Student.query.all()
    for s in all_students:
        courses = s.get_courses()
        is_at_risk_student = (s.student_id in at_risk_A or s.student_id in at_risk_B or s.student_id in at_risk_C)

        cie_raw_scores = []
        quiz_pct_scores = []
        att_pct_scores = []

        for c in courses:
            c_code = c.get("code")
            # 1. Attendance percentage
            key = (s.student_id, c_code)
            if key in student_course_attendance:
                pres, tot = student_course_attendance[key]
                course_att = round((pres / tot) * 100.0, 1) if tot > 0 else 85.0
            else:
                # Other courses in semester not explicitly in the 4 faculty-assigned tracking lists
                if is_at_risk_student:
                    course_att = round(random.uniform(58.0, 72.0), 1)
                else:
                    course_att = round(random.uniform(84.0, 97.0), 1)

            c["attendance_pct"] = course_att
            att_pct_scores.append(course_att)

            # 2. CIE Marks (CIE1, CIE2, Quiz1, Quiz2, EL)
            if is_at_risk_student:
                cie1 = round(random.uniform(9.0, 14.5), 1)   # Max 25 (threshold 12)
                cie2 = round(random.uniform(8.5, 14.0), 1)   # Max 25
                quiz1 = round(random.uniform(4.0, 6.5), 1)   # Max 10
                quiz2 = round(random.uniform(4.5, 7.0), 1)   # Max 10
                el = round(random.uniform(15.0, 21.0), 1)    # Max 30
            else:
                # Top / Solid performing student
                cie1 = round(random.uniform(16.0, 24.5), 1)
                cie2 = round(random.uniform(17.0, 25.0), 1)
                quiz1 = round(random.uniform(7.0, 10.0), 1)
                quiz2 = round(random.uniform(7.5, 10.0), 1)
                el = round(random.uniform(22.0, 29.5), 1)

            c["cie1"] = cie1
            c["cie2"] = cie2
            c["quiz1"] = quiz1
            c["quiz2"] = quiz2
            c["el"] = el
            c["see"] = None  # Ongoing semester: SEE is pending

            # Recompute course grade breakdown
            grade_info = Student.compute_course_grade(c)
            c.update(grade_info)

            cie_raw = c.get("cie_raw", 0.0)
            cie_raw_scores.append(cie_raw)
            quiz_pct = round(((quiz1 + quiz2) / 20.0) * 100.0, 1)
            quiz_pct_scores.append(quiz_pct)

        # Update student aggregate academic columns
        s.courses_data = json.dumps(courses)
        s.attendance_pct = round(sum(att_pct_scores) / len(att_pct_scores), 1) if att_pct_scores else 85.0
        s.internal_marks = round(sum(cie_raw_scores) / len(cie_raw_scores), 1) if cie_raw_scores else 75.0
        s.assignment_score_pct = round(sum(quiz_pct_scores) / len(quiz_pct_scores), 1) if quiz_pct_scores else 80.0
        # Course performance proxy (half of internal CIE raw)
        s.course_performance_pct = round(s.internal_marks * 0.5, 1)

    db.session.commit()
    print(f"   Synchronized {len(all_students)} student academic dossiers with new CIE marks and attendance.")
    print("=" * 60)
    print("MOCK DATA SEEDING COMPLETE!")
