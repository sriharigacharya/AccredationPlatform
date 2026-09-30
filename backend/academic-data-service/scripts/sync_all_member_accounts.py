import os
import sys
import json
from pathlib import Path

# Add backend/academic-data-service root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app
from models import db, Student, Faculty, StudentEnrollment
from event_models import Club, StudentRole
from werkzeug.security import generate_password_hash
from sqlalchemy import text

app = create_app()

with app.app_context():
    print("[*] Checking users and student accounts in PostgreSQL...")

    # 1. Update Club Mentors and Leadership Roles
    acm = Club.query.filter(Club.name.ilike("%ACM%")).first()
    if acm:
        acm.mentor_faculty_id = "FAC003"  # Dr. C VIDYARAJ

    robotics = Club.query.filter(Club.name.ilike("%Robotics%")).first()
    if robotics:
        robotics.mentor_faculty_id = "FAC005"  # Dr. SHABANA SULTANA

    lit = Club.query.filter(Club.name.ilike("%Literary%")).first()
    if lit:
        lit.mentor_faculty_id = "FAC004"  # Dr. ANNAPURNA V K

    # Update student roles for club heads
    role_updates = [
        {"club_id": 1, "role": "head", "new_student_id": "4NI24CS001"},  # Aaditya Agarwal (ACM Head)
        {"club_id": 2, "role": "head", "new_student_id": "4NI22CS001"},  # Sameer Malhotra (Robotics Head)
        {"club_id": 3, "role": "head", "new_student_id": "4NI21CS001"},  # Ashish Raju (Literary Head)
    ]
    for r in role_updates:
        existing_role = StudentRole.query.filter_by(club_id=r["club_id"], role=r["role"]).first()
        if existing_role:
            existing_role.student_id = r["new_student_id"]
        else:
            db.session.add(StudentRole(
                club_id=r["club_id"],
                student_id=r["new_student_id"],
                role=r["role"],
                assigned_by="U001"
            ))

    db.session.commit()
    print("[+] Verified and updated club mentors and club heads.")

    # 2. Check and Provision Users
    user_rows = db.session.execute(text("SELECT email, role, linked_id FROM users")).fetchall()
    existing_emails = {row[0].lower() for row in user_rows}
    print(f"[*] Found {len(existing_emails)} existing user accounts in 'users' table.")

    student_pw_hash = generate_password_hash("student123")
    teacher_pw_hash = generate_password_hash("teacher123")

    # A. Provision missing faculty
    faculty_members = Faculty.query.order_by(Faculty.faculty_id).all()
    added_faculty = 0
    for f in faculty_members:
        if f.email.lower() not in existing_emails:
            u_id = f"U_{f.faculty_id}"
            db.session.execute(
                text("""
                    INSERT INTO users (user_id, email, password_hash, role, name, linked_id, is_active, created_at, updated_at)
                    VALUES (:user_id, :email, :password_hash, 'teacher', :name, :linked_id, true, NOW(), NOW())
                """),
                {
                    "user_id": u_id,
                    "email": f.email,
                    "password_hash": teacher_pw_hash,
                    "name": f.name,
                    "linked_id": f.faculty_id,
                }
            )
            existing_emails.add(f.email.lower())
            added_faculty += 1
    if added_faculty > 0:
        db.session.commit()
        print(f"[+] Provisioned {added_faculty} faculty user accounts.")

    # B. Provision missing students (focusing on all enrolled 24-section students + any active student)
    students = Student.query.order_by(Student.semester, Student.section, Student.student_id).all()
    added_students = 0
    for s in students:
        if s.email.lower() not in existing_emails:
            u_id = f"U_S_{s.student_id}"
            db.session.execute(
                text("""
                    INSERT INTO users (user_id, email, password_hash, role, name, linked_id, is_active, created_at, updated_at)
                    VALUES (:user_id, :email, :password_hash, 'student', :name, :linked_id, true, NOW(), NOW())
                """),
                {
                    "user_id": u_id,
                    "email": s.email,
                    "password_hash": student_pw_hash,
                    "name": s.name,
                    "linked_id": s.student_id,
                }
            )
            existing_emails.add(s.email.lower())
            added_students += 1

    # Ensure demo student accounts link to 4NI24CS001
    first_stu = Student.query.filter_by(student_id="4NI24CS001").first()
    if first_stu:
        db.session.execute(text("""
            UPDATE users
            SET name = :name, linked_id = :lid, password_hash = :pw
            WHERE email IN ('student@academiq.edu', 'aarav.sharma@student.academiq.edu')
        """), {"name": first_stu.name, "lid": first_stu.student_id, "pw": student_pw_hash})

    if added_students > 0:
        db.session.commit()
        print(f"[+] Provisioned {added_students} new student accounts into 'users' table.")
    else:
        print("[*] All student accounts already provisioned.")

    # Verify total users in db
    total_users = db.session.execute(text("SELECT COUNT(*) FROM users")).scalar()
    print(f"[+] Total accounts in users table now: {total_users}")

    # 3. Extract Complete Member Directory Data
    # A. System Admins & Operations
    admin_workers = db.session.execute(
        text("SELECT user_id, email, role, name, linked_id FROM users WHERE role IN ('admin', 'worker') ORDER BY role, user_id")
    ).fetchall()

    admin_worker_list = []
    for row in admin_workers:
        pw = "admin123" if row[2] == "admin" else "worker123"
        admin_worker_list.append({
            "user_id": row[0],
            "email": row[1],
            "role": row[2],
            "name": row[3],
            "linked_id": row[4] or "—",
            "password": pw,
            "access_scope": "Full System Access" if row[2] == "admin" else "Document Ingestion & OCR Processing"
        })

    # B. Faculty Members
    faculty_list = []
    for f in faculty_members:
        courses = [a.course_code for a in f.assignments] if hasattr(f, 'assignments') and f.assignments else []
        faculty_list.append({
            "faculty_id": f.faculty_id,
            "name": f.name,
            "email": f.email,
            "role": "teacher",
            "password": "teacher123",
            "department": f.department.name if hasattr(f.department, 'name') and f.department else (f.department.code if hasattr(f.department, 'code') and f.department else "Computer Science & Engineering"),
            "designation": f.designation or "Assistant Professor",
            "assigned_courses": courses
        })

    # C. Student Clubs & Leadership
    clubs = Club.query.order_by(Club.id).all()
    club_list = []
    head_student_ids = {}
    for c in clubs:
        mentor = Faculty.query.filter_by(faculty_id=c.mentor_faculty_id).first()
        roles = StudentRole.query.filter_by(club_id=c.id).all()
        leads = [r for r in roles if r.role == 'head']
        c_head = None
        if leads:
            lead_stu = Student.query.filter_by(student_id=leads[0].student_id).first()
            if lead_stu:
                head_student_ids[lead_stu.student_id] = c.name
                c_head = {
                    "student_id": lead_stu.student_id,
                    "name": lead_stu.name,
                    "email": lead_stu.email,
                    "role": "student (Club Head)",
                    "password": "student123",
                    "semester": lead_stu.semester,
                    "section": lead_stu.section,
                }
        club_list.append({
            "club_id": c.id,
            "name": c.name,
            "category": c.category,
            "mentor_faculty_id": c.mentor_faculty_id,
            "mentor_name": mentor.name if mentor else c.mentor_faculty_id,
            "head": c_head
        })

    # D. All 600 Enrolled Students Across 24 Sections (4 Years: Sem 1, 3, 5, 7)
    enrolled_ids = {e.student_id for e in StudentEnrollment.query.all()}
    all_students = Student.query.filter(Student.student_id.in_(enrolled_ids)).order_by(Student.semester, Student.section, Student.student_id).all()
    
    # If no enrollments found for some reason, fallback to 4NI students
    if not all_students:
        all_students = Student.query.filter(Student.student_id.like("4NI%")).order_by(Student.semester, Student.section, Student.student_id).all()

    students_by_sem = {1: [], 3: [], 5: [], 7: []}
    for s in all_students:
        sem = int(s.semester) if s.semester else 1
        if sem not in students_by_sem:
            students_by_sem[sem] = []
        is_head = s.student_id in head_student_ids
        students_by_sem[sem].append({
            "student_id": s.student_id,
            "name": s.name,
            "email": s.email,
            "role": "student",
            "is_club_head": is_head,
            "club_name": head_student_ids.get(s.student_id),
            "password": "student123",
            "semester": sem,
            "section": s.section,
            "cgpa": f"{float(s.previous_gpa or 0):.2f}",
            "attendance": f"{float(s.attendance_pct or 75):.1f}%",
            "result": s.final_result or "Pass",
            "department": "AIML" if s.section in ["E", "F"] else "CSE"
        })

    directory_data = {
        "institution": "AcademiQ National Institute of Technology & Engineering",
        "department": "Department of Computer Science & Engineering and Artificial Intelligence",
        "academic_year": "2024-25 / 2025-26",
        "portal_url": "http://localhost:3000/login",
        "total_members": len(admin_worker_list) + len(faculty_list) + sum(len(v) for v in students_by_sem.values()),
        "summary": {
            "admins_and_workers": len(admin_worker_list),
            "faculty": len(faculty_list),
            "club_heads": len(head_student_ids),
            "students_sem1": len(students_by_sem.get(1, [])),
            "students_sem3": len(students_by_sem.get(3, [])),
            "students_sem5": len(students_by_sem.get(5, [])),
            "students_sem7": len(students_by_sem.get(7, [])),
            "total_students": sum(len(v) for v in students_by_sem.values()),
        },
        "admin_workers": admin_worker_list,
        "faculty": faculty_list,
        "clubs": club_list,
        "students_by_sem": students_by_sem
    }

    output_path = "/tmp/academiq_members_credentials.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(directory_data, f, indent=2)
    print(f"[OK] Directory data exported successfully to {output_path} (Total Members: {directory_data['total_members']})")
    print(f"     Admins/Workers: {directory_data['summary']['admins_and_workers']}, Faculty: {directory_data['summary']['faculty']}, Enrolled Students: {directory_data['summary']['total_students']}")
