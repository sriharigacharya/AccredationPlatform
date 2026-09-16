import os
import sys
import json
from pathlib import Path

# Add backend/academic-data-service root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app
from models import db, Student, Faculty
from event_models import Club, StudentRole
from werkzeug.security import generate_password_hash
from sqlalchemy import text

app = create_app()

with app.app_context():
    print("[*] Checking users table in PostgreSQL...")
    
    # Check current users
    user_rows = db.session.execute(text("SELECT email, role, linked_id FROM users")).fetchall()
    existing_emails = {row[0].lower() for row in user_rows}
    print(f"[*] Found {len(existing_emails)} existing user accounts in 'users' table.")
    
    # Ensure password hashes
    student_pw_hash = generate_password_hash("student123")
    
    # 1. Provision any missing students into users
    students = Student.query.order_by(Student.student_id).all()
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
            
    if added_students > 0:
        db.session.commit()
        print(f"[+] Provisioned {added_students} new student accounts into 'users' table.")
    else:
        print("[*] All student accounts already provisioned.")
        
    # Verify total users
    total_users = db.session.execute(text("SELECT COUNT(*) FROM users")).scalar()
    print(f"[+] Total accounts in users table now: {total_users}")
    
    # 2. Extract Complete Member Directory
    # A. System Admins & Workers
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
    faculty_members = Faculty.query.order_by(Faculty.faculty_id).all()
    faculty_list = []
    for f in faculty_members:
        courses = [a.course_code for a in f.assignments] if hasattr(f, 'assignments') and f.assignments else []
        faculty_list.append({
            "faculty_id": f.faculty_id,
            "name": f.name,
            "email": f.email,
            "role": "teacher",
            "password": "teacher123",
            "department": f.department.name if hasattr(f.department, 'name') else (f.department.code if hasattr(f.department, 'code') else str(f.department or "Computer Science & Engineering")),
            "designation": f.designation or "Assistant Professor",
            "assigned_courses": courses
        })
        
    # C. Student Clubs & Club Heads
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
        
    # D. All Students (Grouped by Semester)
    all_students = Student.query.order_by(Student.semester.desc(), Student.section, Student.student_id).all()
    students_by_sem = {7: [], 5: [], 3: []}
    
    for s in all_students:
        sem = s.semester
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
            "semester": s.semester,
            "section": s.section,
            "cgpa": f"{float(s.previous_gpa or 0):.2f}",
            "attendance": f"{float(s.attendance_pct or 75):.1f}%",
            "result": s.final_result or "Pass"
        })
        
    directory_data = {
        "institution": "AcademiQ National Institute of Technology & Engineering",
        "department": "Computer Science & Engineering",
        "academic_year": "2025-26",
        "portal_url": "http://localhost:3000/login",
        "total_members": len(admin_worker_list) + len(faculty_list) + sum(len(v) for v in students_by_sem.values()),
        "summary": {
            "admins_and_workers": len(admin_worker_list),
            "faculty": len(faculty_list),
            "club_heads": len(head_student_ids),
            "students_sem7": len(students_by_sem.get(7, [])),
            "students_sem5": len(students_by_sem.get(5, [])),
            "students_sem3": len(students_by_sem.get(3, [])),
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
