"""
Seed & Migration Script: 24 Sections Across 4 Years + 600 Students + 1 Month Attendance + Timetable
=====================================================================================================
1. Removes demo faculty (FAC001 Dr. Meena Iyer, FAC002 Prof. Ravi Shankar) not in timetable docx.
2. Removes demo students (STU001-STU100) assigned to them.
3. Reassigns demo clubs (ACM, Robotics) to legitimate faculty.
4. Creates 24 canonical sections across 4 years (4 CSE + 2 AIML per year):
   - Year 1 (Sem 1): Sec A, B, C, D (CSE), Sec E, F (AIML)
   - Year 2 (Sem 3): Sec A, B, C, D (CSE), Sec E, F (AIML)
   - Year 3 (Sem 5): Sec A, B, C, D (CSE), Sec E, F (AIML)
   - Year 4 (Sem 7): Sec A, B, C, D (CSE), Sec E, F (AIML)
5. Seeds 25 students per section (600 students total) with realistic Indian names, USNs,
   CIE1, CIE2, Quiz1, Quiz2, EL, SEE, GPA, and course performance.
6. Enrolls every student in StudentEnrollment.
7. Seeds 30+ days (at least 1 full month) of daily class attendance in class_attendance_sessions & class_attendance_entries.
8. Generates student timetable slots from legitimate faculty (FAC003-FAC044):
   - Sem 7: Classes strictly Monday - Wednesday. Thursday - Saturday alloted for Major Project.
   - All years: Includes intentional free hours per week (rendered as Free Period in UI).
"""

import os
import sys
import json
import random
from datetime import datetime, date, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import (
    db, Faculty, Department, Student, Subject, Section,
    StudentEnrollment, TimetableSlot, Assignment, AssignmentTarget,
    ClassAttendanceSession, ClassAttendanceEntry
)
from event_models import Club
from werkzeug.security import generate_password_hash
from sqlalchemy import text


FIRST_NAMES = [
    "Aaditya", "Aarav", "Abhinav", "Aditeya", "Aditya", "Akash", "Alok", "Amartya",
    "Amit", "Anand", "Animesh", "Aniruddha", "Ankit", "Anshul", "Anupam", "Arjun",
    "Arnav", "Arya", "Ashish", "Ashwin", "Ayush", "Bhavik", "Bhupesh", "Chetan",
    "Chinmay", "Darshan", "Deepak", "Devendra", "Dhruv", "Divyansh", "Gaurav", "Giridhar",
    "Gopal", "Gowtham", "Harish", "Harsh", "Hemant", "Himanshu", "Ishan", "Jayant",
    "Jitendra", "Kalyan", "Kapil", "Karan", "Kartik", "Kaustubh", "Kiran", "Kuldeep",
    "Madhav", "Manish", "Manthan", "Mayank", "Mihir", "Milind", "Mukesh", "Naveen",
    "Nikhil", "Nilesh", "Nirmal", "Nishant", "Omkar", "Pankaj", "Parth", "Pradeep",
    "Prajwal", "Pranav", "Prashant", "Prateek", "Praveen", "Priyansh", "Raghav", "Rahul",
    "Rajat", "Rajeev", "Rajesh", "Rakesh", "Ramana", "Ramesh", "Rishabh", "Ritesh",
    "Rohan", "Rohit", "Sachin", "Sagar", "Sameer", "Sandeep", "Sanjay", "Sanket",
    "Santosh", "Sarthak", "Satish", "Saurabh", "Shashank", "Shivam", "Shravan", "Shreyas",
    "Siddharth", "Sourabh", "Subhash", "Suhas", "Sujay", "Sumeet", "Suraj", "Suresh",
    "Swapnil", "Tanmay", "Tarun", "Tejas", "Utkarsh", "Vaibhav", "Varun", "Vedant",
    "Venkatesh", "Vignesh", "Vijay", "Vikas", "Vikram", "Vinay", "Vineet", "Vipul",
    "Vishal", "Yash", "Yogesh", "Aakanksha", "Aanchal", "Aditi", "Aishwarya", "Akshata",
    "Amrita", "Ananya", "Anjali", "Ankita", "Anusha", "Apoorva", "Archana", "Arpita",
    "Bhavna", "Chaitali", "Chandana", "Deepika", "Diksha", "Divya", "Garima", "Gayatri",
    "Geeta", "Harini", "Harshita", "Isha", "Ishita", "Janhavi", "Kavya", "Keerthi",
    "Khushboo", "Komal", "Krutika", "Lavanya", "Madhuri", "Malavika", "Mansi", "Meera",
    "Megha", "Monika", "Namrata", "Neha", "Nikita", "Nisha", "Pallavi", "Payal",
    "Pooja", "Pragati", "Pranjal", "Prerna", "Priya", "Priyanka", "Radha", "Radhika",
    "Raksha", "Rashmi", "Richa", "Riddhi", "Ritu", "Riya", "Roshni", "Ruchika",
    "Sakshi", "Samiksha", "Sandhya", "Sangeeta", "Sanjana", "Sarika", "Shalini", "Shambhavi",
    "Sharmila", "Sheetal", "Shikha", "Shivani", "Shraddha", "Shreya", "Shruti", "Simran",
    "Sneha", "Sonali", "Spandana", "Srishti", "Sukanya", "Sunita", "Surabhi", "Sushma",
    "Swati", "Tanvi", "Trisha", "Urvashi", "Vaishnavi", "Vandana", "Varsha", "Vidya"
]

LAST_NAMES = [
    "Acharya", "Agarwal", "Ayyangar", "Balaji", "Bansal", "Bapat", "Basu", "Bhandari",
    "Bhat", "Bhattacharya", "Chakraborty", "Chandran", "Chaudhary", "Chauhan", "Choudhury",
    "Das", "Deo", "Deshmukh", "Devi", "Dey", "Dubey", "Dutta", "Ganguly", "Garg",
    "Gokhale", "Gopalakrishnan", "Gupta", "Hegde", "Iyer", "Jadhav", "Jha", "Joshi",
    "Kamath", "Kapoor", "Kaur", "Kaushik", "Khatri", "Kini", "Kumar", "Lahiri",
    "Maheshwari", "Malhotra", "Mani", "Marathe", "Mehta", "Menon", "Mitra", "Modi",
    "Murthy", "Nadar", "Naidu", "Nair", "Nambiar", "Nayak", "Pandit", "Parekh",
    "Patel", "Patnaik", "Pillai", "Prasad", "Raghunathan", "Raju", "Ranganathan", "Rao",
    "Rathore", "Reddy", "Saha", "Saxena", "Sen", "Seth", "Sharma", "Shetty",
    "Singh", "Sinha", "Srinivasan", "Srivastava", "Sundaram", "Swaminathan", "Tambe", "Thakur",
    "Tiwari", "Tripathi", "Upadhyay", "Varma", "Venkatesh", "Verma"
]

CURRICULUM = {
    1: {  # Year 1 (Semester 1)
        "CSE": [
            {"code": "CS101", "name": "Problem Solving with C", "credits": 4, "is_lab": False},
            {"code": "MA101", "name": "Calculus & Linear Algebra", "credits": 4, "is_lab": False},
            {"code": "PH101", "name": "Engineering Physics", "credits": 3, "is_lab": False},
            {"code": "EE101", "name": "Basic Electrical Engineering", "credits": 3, "is_lab": False},
            {"code": "CS102", "name": "C Programming Laboratory", "credits": 2, "is_lab": True},
        ],
        "AIML": [
            {"code": "AI101", "name": "Python for Intelligent Systems", "credits": 4, "is_lab": False},
            {"code": "MA101", "name": "Calculus & Linear Algebra", "credits": 4, "is_lab": False},
            {"code": "PH101", "name": "Engineering Physics", "credits": 3, "is_lab": False},
            {"code": "EC101", "name": "Digital Logic & Systems", "credits": 3, "is_lab": False},
            {"code": "AI102", "name": "Python & AI Computing Lab", "credits": 2, "is_lab": True},
        ],
    },
    3: {  # Year 2 (Semester 3)
        "CSE": [
            {"code": "CS3C01", "name": "Data Structures & Algorithms", "credits": 4, "is_lab": False},
            {"code": "CS3C02", "name": "Digital Logic & Computer Design", "credits": 4, "is_lab": False},
            {"code": "CS3C03", "name": "Computer Organization & Architecture", "credits": 4, "is_lab": False},
            {"code": "CS3C04", "name": "Discrete Mathematical Structures", "credits": 3, "is_lab": False},
            {"code": "CS3L01", "name": "Data Structures Lab", "credits": 2, "is_lab": True},
        ],
        "AIML": [
            {"code": "CS3C01", "name": "Data Structures & Algorithms", "credits": 4, "is_lab": False},
            {"code": "AI3C01", "name": "Foundations of Data Science", "credits": 4, "is_lab": False},
            {"code": "AI3C02", "name": "Artificial Intelligence Concepts", "credits": 3, "is_lab": False},
            {"code": "MA3B01", "name": "Probability & Statistics for AI", "credits": 3, "is_lab": False},
            {"code": "AI3L01", "name": "Data Science & AI Lab", "credits": 2, "is_lab": True},
        ],
    },
    5: {  # Year 3 (Semester 5)
        "CSE": [
            {"code": "CS5C01", "name": "Database Management Systems", "credits": 4, "is_lab": False},
            {"code": "CS5C02", "name": "Operating Systems & Systems Programming", "credits": 4, "is_lab": False},
            {"code": "CS5C03", "name": "Theory of Computation & Automata", "credits": 3, "is_lab": False},
            {"code": "CS5C04", "name": "Software Engineering & Agile Practices", "credits": 3, "is_lab": False},
            {"code": "CS5L01", "name": "DBMS Laboratory", "credits": 2, "is_lab": True},
        ],
        "AIML": [
            {"code": "AI5C01", "name": "Supervised & Unsupervised Machine Learning", "credits": 4, "is_lab": False},
            {"code": "AI5C02", "name": "Deep Learning & Neural Architectures", "credits": 4, "is_lab": False},
            {"code": "CS5C01", "name": "Database Management Systems", "credits": 3, "is_lab": False},
            {"code": "AI5C03", "name": "Big Data Engineering & Analytics", "credits": 3, "is_lab": False},
            {"code": "AI5L01", "name": "Machine Learning Lab", "credits": 2, "is_lab": True},
        ],
    },
    7: {  # Year 4 (Semester 7)
        "CSE": [
            {"code": "CS7C01", "name": "Cloud Computing & Distributed Architectures", "credits": 4, "is_lab": False},
            {"code": "CS7C02", "name": "Compiler Design & Program Analysis", "credits": 4, "is_lab": False},
            {"code": "CS7E01", "name": "Storage Area Networks & Infrastructure", "credits": 3, "is_lab": False},
            {"code": "CS7P01", "name": "Major Project Phase I", "credits": 6, "is_lab": True},
            {"code": "CS7L01", "name": "Cloud & DevOps Laboratory", "credits": 2, "is_lab": True},
        ],
        "AIML": [
            {"code": "AI7C01", "name": "Natural Language Processing & LLMs", "credits": 4, "is_lab": False},
            {"code": "AI7C02", "name": "Computer Vision & Edge Perception", "credits": 4, "is_lab": False},
            {"code": "AI7E01", "name": "Reinforcement Learning & Autonomous Agents", "credits": 3, "is_lab": False},
            {"code": "AI7P01", "name": "Major Project Phase I (AI/ML Capstone)", "credits": 6, "is_lab": True},
            {"code": "AI7L01", "name": "NLP & Computer Vision Lab", "credits": 2, "is_lab": True},
        ],
    },
}


def run_migration_and_seed():
    print("=" * 70)
    print("MIGRATION: Removing Demo Faculty, Provisioning 24 Sections & Roster")
    print("=" * 70)

    # ─── 1. Remove Demo Faculty (FAC001 & FAC002) ─────────────────────────────
    demo_fac_ids = ["FAC001", "FAC002"]
    removed_faculty_info = []

    for fid in demo_fac_ids:
        fac = Faculty.query.filter_by(faculty_id=fid).first()
        if fac:
            removed_faculty_info.append(f"{fac.name} ({fac.faculty_id}, {fac.email})")
            # Clear associated legacy entries
            TimetableSlot.query.filter_by(faculty_id=fid).delete()
            Assignment.query.filter_by(faculty_id=fid).delete()
            db.session.delete(fac)

    # Clean from auth users table if exists
    try:
        db.session.execute(text("DELETE FROM users WHERE linked_id IN ('FAC001', 'FAC002') OR email LIKE '%meena%' OR email LIKE '%ravi.shankar%'"))
    except Exception as e:
        print(f"[*] Note cleaning auth users: {e}")

    # Reassign clubs to verified faculty
    acm = Club.query.filter(Club.name.ilike("%ACM%")).first()
    if acm:
        acm.mentor_faculty_id = "FAC003"  # Dr. C VIDYARAJ

    robotics = Club.query.filter(Club.name.ilike("%Robotics%")).first()
    if robotics:
        robotics.mentor_faculty_id = "FAC005"  # Dr. SHABANA SULTANA

    db.session.commit()
    print(f"[+] Removed demo faculty: {removed_faculty_info}")

    # Ensure teacher@academiq.edu points to Dr. C VIDYARAJ (FAC003)
    try:
        pw_hash = generate_password_hash("teacher123")
        db.session.execute(text("""
            UPDATE users
            SET name = 'Dr. C VIDYARAJ', linked_id = 'FAC003', password_hash = :pw
            WHERE email = 'teacher@academiq.edu'
        """), {"pw": pw_hash})
        db.session.commit()
    except Exception as e:
        print(f"[*] Note updating demo teacher account: {e}")

    # ─── 2. Ensure Departments (CSE & AIML) ──────────────────────────────────
    cse_dept = Department.query.filter_by(code="CSE").first()
    if not cse_dept:
        cse_dept = Department(code="CSE", name="Computer Science & Engineering")
        db.session.add(cse_dept)
        db.session.flush()

    aiml_dept = Department.query.filter_by(code="AIML").first()
    if not aiml_dept:
        aiml_dept = Department(
            code="AIML",
            name="Artificial Intelligence & Machine Learning",
            vision="To be a premier center of excellence in Artificial Intelligence, data intelligence, and autonomous systems.",
            mission="Empower future engineers with deep learning algorithms, ethical AI development, and innovative research.",
        )
        db.session.add(aiml_dept)
        db.session.flush()

    db.session.commit()

    # ─── 3. Upsert 24 Sections Across 4 Years ─────────────────────────────────
    # 4 CSE (A, B, C, D) + 2 AIML (E, F) across Semesters 1, 3, 5, 7
    sections_map = {}  # (sem_str, label) -> Section
    total_sections_created = 0

    section_specs = [
        # Year 1 (Semester 1)
        ("1", "A", cse_dept.id, "L-101"),
        ("1", "B", cse_dept.id, "L-102"),
        ("1", "C", cse_dept.id, "L-103"),
        ("1", "D", cse_dept.id, "L-104"),
        ("1", "E", aiml_dept.id, "AI-101"),
        ("1", "F", aiml_dept.id, "AI-102"),
        # Year 2 (Semester 3)
        ("3", "A", cse_dept.id, "L-201"),
        ("3", "B", cse_dept.id, "L-202"),
        ("3", "C", cse_dept.id, "L-203"),
        ("3", "D", cse_dept.id, "L-204"),
        ("3", "E", aiml_dept.id, "AI-201"),
        ("3", "F", aiml_dept.id, "AI-202"),
        # Year 3 (Semester 5)
        ("5", "A", cse_dept.id, "L-301"),
        ("5", "B", cse_dept.id, "L-302"),
        ("5", "C", cse_dept.id, "L-303"),
        ("5", "D", cse_dept.id, "L-304"),
        ("5", "E", aiml_dept.id, "AI-301"),
        ("5", "F", aiml_dept.id, "AI-302"),
        # Year 4 (Semester 7)
        ("7", "A", cse_dept.id, "L-401"),
        ("7", "B", cse_dept.id, "L-402"),
        ("7", "C", cse_dept.id, "L-403"),
        ("7", "D", cse_dept.id, "L-404"),
        ("7", "E", aiml_dept.id, "AI-401"),
        ("7", "F", aiml_dept.id, "AI-402"),
    ]

    for sem, lbl, dept_id, room in section_specs:
        sec = Section.query.filter_by(semester=sem, section_label=lbl).first()
        if not sec:
            sec = Section(
                semester=sem,
                section_label=lbl,
                department_id=dept_id,
                default_room=room,
            )
            db.session.add(sec)
            db.session.flush()
            total_sections_created += 1
        else:
            sec.department_id = dept_id
            sec.default_room = room

        sections_map[(sem, lbl)] = sec

    db.session.commit()
    print(f"[+] Configured 24 sections across 4 years ({total_sections_created} newly created).")

    # Fetch verified faculty for assignment
    all_faculty = Faculty.query.filter(Faculty.faculty_id.not_in(["FAC001", "FAC002"])).order_by(Faculty.id).all()
    if not all_faculty:
        raise RuntimeError("No verified faculty found in database!")

    random.seed(42)  # reproducible generation

    name_idx = 0
    total_students_seeded = 0
    seeded_students_by_sec = {}

    batch_years = {
        1: ("2024", "2024-28"),
        3: ("2023", "2023-27"),
        5: ("2022", "2022-26"),
        7: ("2021", "2021-25"),
    }

    for (sem, lbl), sec in sections_map.items():
        sem_int = int(sem)
        dept_str = "AIML" if lbl in ["E", "F"] else "CSE"
        dept_obj = aiml_dept if dept_str == "AIML" else cse_dept
        prefix_yr, batch = batch_years[sem_int]
        course_list = CURRICULUM[sem_int][dept_str]

        sec_students = []

        # 25 students per section
        for s_idx in range(1, 26):
            # USN format: 4NI<YY><BRANCH><XXX>
            branch_code = "AI" if dept_str == "AIML" else "CS"
            roll_offset = (ord(lbl) - ord('A')) * 25 + s_idx if dept_str == "CSE" else (ord(lbl) - ord('E')) * 25 + s_idx
            student_id = f"4NI{prefix_yr[-2:]}{branch_code}{roll_offset:03d}"

            first = FIRST_NAMES[name_idx % len(FIRST_NAMES)]
            last = LAST_NAMES[(name_idx * 3 + s_idx) % len(LAST_NAMES)]
            full_name = f"{first} {last}"
            name_idx += 1

            # Realistic GPA, attendance, CIE
            gpa = round(random.uniform(7.1, 9.6), 2)
            if s_idx == 13:  # 1 lower score student for realism
                gpa = round(random.uniform(5.4, 6.2), 2)

            skill = gpa / 10.0
            base_att = round(random.uniform(78.0, 96.0), 1)

            # Generate course data
            courses_json = []
            for c in course_list:
                noise = random.gauss(0, 0.05)
                s_factor = max(0.2, min(1.0, skill + noise))
                cie1 = round(max(5, min(25, s_factor * 25 + random.gauss(0, 1.5))))
                cie2 = round(max(5, min(25, s_factor * 25 + random.gauss(0, 1.5))))
                q1 = round(max(2, min(10, s_factor * 10 + random.gauss(0, 0.8))))
                q2 = round(max(2, min(10, s_factor * 10 + random.gauss(0, 0.8))))
                el = round(max(8, min(30, s_factor * 30 + random.gauss(0, 2.0))))
                see = round(max(35, min(100, s_factor * 100 + random.gauss(0, 5.0))))
                c_att = round(max(65.0, min(99.0, base_att + random.gauss(0, 3.0))), 1)

                courses_json.append({
                    "code": c["code"],
                    "name": c["name"],
                    "credits": c["credits"],
                    "is_lab": c["is_lab"],
                    "cie1": cie1,
                    "cie2": cie2,
                    "quiz1": q1,
                    "quiz2": q2,
                    "el": el,
                    "see": see,
                    "attendance_pct": c_att,
                })

            avg_cie = sum(c["cie1"] + c["cie2"] + c["quiz1"] + c["quiz2"] + c["el"] for c in courses_json) / len(courses_json)
            avg_att = sum(c["attendance_pct"] for c in courses_json) / len(courses_json)
            avg_quiz = sum(c["quiz1"] + c["quiz2"] for c in courses_json) / len(courses_json)

            # Check existing
            stu = Student.query.filter_by(student_id=student_id).first()
            if not stu:
                stu = Student(
                    student_id=student_id,
                    name=full_name,
                    email=f"{first.lower()}.{student_id.lower()}@student.academiq.edu",
                    phone="8660042249",
                    department_id=dept_obj.id,
                    semester=sem_int,
                    section=lbl,
                    attendance_pct=round(avg_att, 1),
                    internal_marks=round(avg_cie, 1),
                    assignment_score_pct=round((avg_quiz / 20.0) * 100.0, 1),
                    previous_gpa=gpa,
                    backlogs=1 if gpa < 6.0 else 0,
                    course_performance_pct=round(gpa * 10.0, 1),
                    engagement="High" if gpa >= 8.2 else "Medium" if gpa >= 6.5 else "Low",
                    final_result="Fail" if gpa < 5.8 else "Pass",
                    courses_data=json.dumps(courses_json),
                )
                db.session.add(stu)
                total_students_seeded += 1
            else:
                stu.name = full_name
                stu.semester = sem_int
                stu.section = lbl
                stu.department_id = dept_obj.id
                stu.attendance_pct = round(avg_att, 1)
                stu.internal_marks = round(avg_cie, 1)
                stu.previous_gpa = gpa
                stu.courses_data = json.dumps(courses_json)

            sec_students.append(stu)

        seeded_students_by_sec[(sem, lbl)] = sec_students

    db.session.commit()
    print(f"[+] Seeded {total_students_seeded} students across all 24 sections (25 per section).")

    # ─── 4b. Re-link Student Achievements & Remove Legacy Demo Students ────────
    ach_mapping = {
        "STU001": "4NI24CS001",
        "STU002": "4NI24CS002",
        "STU003": "4NI24CS003",
        "STU006": "4NI24CS006",
        "STU069": "4NI21CS001",
        "STU072": "4NI21CS002",
        "STU073": "4NI21CS003",
        "STU075": "4NI21CS004",
        "STU078": "4NI21CS005",
    }
    for old_id, new_id in ach_mapping.items():
        db.session.execute(text("UPDATE student_achievements SET student_id = :new_id WHERE student_id = :old_id"), {"new_id": new_id, "old_id": old_id})
        db.session.execute(text("UPDATE student_achievements SET submitted_by = :new_id WHERE submitted_by = :old_id"), {"new_id": new_id, "old_id": old_id})
    db.session.commit()

    # Clear legacy demo students
    db.session.execute(text("DELETE FROM student_enrollments WHERE student_id LIKE 'STU0%'"))
    db.session.execute(text("DELETE FROM class_attendance_entries WHERE student_id LIKE 'STU0%'"))
    db.session.execute(text("DELETE FROM assignment_targets WHERE student_id LIKE 'STU0%'"))
    db.session.execute(text("DELETE FROM students WHERE student_id LIKE 'STU0%'"))
    db.session.commit()
    print("[+] Re-linked student achievements and cleared legacy demo students (STU001-STU100).")

    # ─── 5. Upsert StudentEnrollment for all 600 Students ─────────────────────
    StudentEnrollment.query.filter_by(academic_term="2024-25-EVEN").delete()
    enroll_count = 0

    for (sem, lbl), stus in seeded_students_by_sec.items():
        sec = sections_map[(sem, lbl)]
        for s in stus:
            enr = StudentEnrollment(
                student_id=s.student_id,
                section_id=sec.id,
                academic_term="2024-25-EVEN",
            )
            db.session.add(enr)
            enroll_count += 1

    db.session.commit()
    print(f"[+] Enrolled {enroll_count} students into their respective sections.")

    # ─── 6. Sync Auth User for student@academiq.edu ───────────────────────────
    try:
        first_stu = seeded_students_by_sec[("1", "A")][0]
        pw_hash = generate_password_hash("student123")
        db.session.execute(text("""
            UPDATE users
            SET name = :name, linked_id = :lid, password_hash = :pw
            WHERE email = 'student@academiq.edu'
        """), {"name": first_stu.name, "lid": first_stu.student_id, "pw": pw_hash})
        db.session.commit()
    except Exception as e:
        print(f"[*] Note updating demo student account: {e}")

    # ─── 7. Seed >= 30 Days of Daily Class Attendance ─────────────────────────
    print("[*] Generating 30+ days of class attendance sessions and entries...")
    ClassAttendanceEntry.query.delete()
    ClassAttendanceSession.query.delete()
    db.session.commit()

    # Generate 32 distinct academic session dates (working days across previous 7 weeks)
    current_dt = date(2025, 2, 28)
    session_dates = []
    d_step = current_dt
    while len(session_dates) < 32:
        if d_step.weekday() < 5:  # Mon - Fri
            session_dates.append(d_step)
        d_step -= timedelta(days=1)
    session_dates.reverse()

    time_slots = [
        "09:00 - 10:00",
        "10:00 - 11:00",
        "11:30 - 12:30",
        "12:30 - 13:30",
        "14:30 - 15:30",
    ]

    total_sessions_created = 0
    total_entries_created = 0

    fac_pool = all_faculty[:20]

    for (sem, lbl), stus in seeded_students_by_sec.items():
        sem_int = int(sem)
        dept_str = "AIML" if lbl in ["E", "F"] else "CSE"
        course_list = CURRICULUM[sem_int][dept_str]
        primary_course = course_list[0]
        assigned_fac = fac_pool[(sem_int * 3 + ord(lbl)) % len(fac_pool)]

        for s_date in session_dates:
            # For 7th sem: classes are only Mon, Tue, Wed (weekday 0, 1, 2)
            if sem_int == 7 and s_date.weekday() >= 3:
                continue

            t_slot = time_slots[s_date.weekday() % len(time_slots)]

            present_stus = []
            absent_stus = []

            for s in stus:
                is_present = random.random() < (s.attendance_pct / 100.0)
                if is_present:
                    present_stus.append(s.student_id)
                else:
                    absent_stus.append(s.student_id)

            cas = ClassAttendanceSession(
                faculty_id=assigned_fac.faculty_id,
                course_code=primary_course["code"],
                course_name=primary_course["name"],
                section=lbl,
                session_date=s_date,
                time_slot=t_slot,
                total_students=len(stus),
                present_count=len(present_stus),
                absent_count=len(absent_stus),
                created_at=datetime.combine(s_date, datetime.min.time()) + timedelta(hours=10),
            )
            db.session.add(cas)
            db.session.flush()
            total_sessions_created += 1

            for pid in present_stus:
                db.session.add(ClassAttendanceEntry(session_id=cas.id, student_id=pid, status="present"))
                total_entries_created += 1

            for aid in absent_stus:
                db.session.add(ClassAttendanceEntry(session_id=cas.id, student_id=aid, status="absent"))
                total_entries_created += 1

    db.session.commit()
    print(f"[+] Seeded {total_sessions_created} attendance sessions and {total_entries_created} attendance entries across {len(session_dates)} dates.")

    # ─── 8. Generate Student Timetable Slots from Teachers' Timetable ─────────
    print("[*] Generating student timetable slots across all 24 sections...")
    TimetableSlot.query.filter_by(academic_term="2024-25-EVEN").delete()

    PERIODS = [
        (1, "09:00", "10:00"),
        (2, "10:00", "11:00"),
        (3, "11:30", "12:30"),
        (4, "12:30", "13:30"),
        (5, "14:30", "15:30"),
        (6, "15:30", "16:30"),
    ]

    total_slots_created = 0

    for (sem, lbl), sec in sections_map.items():
        sem_int = int(sem)
        dept_str = "AIML" if lbl in ["E", "F"] else "CSE"
        course_list = CURRICULUM[sem_int][dept_str]
        sec_room = sec.default_room or f"L-{sem}01"

        if sem_int == 7:
            # ─────────────────────────────────────────────────────────────────
            # 7th SEMESTER RULE:
            # Mon - Wed: Academic theory and lab classes.
            # Thu - Sat: Dedicated Major Project Phase I.
            # ─────────────────────────────────────────────────────────────────
            academic_courses = [c for c in course_list if "Project" not in c["name"]]
            c_idx = 0

            for day in ["Mon", "Tue", "Wed"]:
                for p_idx, s_time, e_time in PERIODS:
                    if p_idx == 6:
                        continue  # Free period

                    if p_idx == 5 and day == "Wed":
                        continue  # Free period

                    course = academic_courses[c_idx % len(academic_courses)]
                    c_idx += 1

                    fac = all_faculty[(sem_int * 4 + c_idx + ord(lbl)) % len(all_faculty)]

                    subj = Subject.query.filter_by(code=course["code"]).first()
                    if not subj:
                        subj = Subject(code=course["code"], name=course["name"], is_confirmed=True)
                        db.session.add(subj)
                        db.session.flush()

                    slot = TimetableSlot(
                        faculty_id=fac.faculty_id,
                        subject_id=subj.id,
                        section_id=sec.id,
                        day_of_week=day,
                        period_index=p_idx,
                        start_time=s_time,
                        end_time=e_time,
                        room=sec_room if not course["is_lab"] else f"CS-LAB-{(ord(lbl) % 4) + 1}",
                        is_lab=course["is_lab"],
                        raw_text=f"{course['code']} {lbl} ({fac.initials or 'FAC'})",
                        academic_term="2024-25-EVEN",
                    )
                    db.session.add(slot)
                    total_slots_created += 1

            # Thursday, Friday, Saturday: Dedicated Major Project Phase I
            project_course = next((c for c in course_list if "Project" in c["name"]), course_list[-1])
            proj_subj = Subject.query.filter_by(code=project_course["code"]).first()
            if not proj_subj:
                proj_subj = Subject(code=project_course["code"], name=project_course["name"], is_confirmed=True)
                db.session.add(proj_subj)
                db.session.flush()

            proj_faculty = all_faculty[(sem_int * 7 + ord(lbl)) % len(all_faculty)]

            for day in ["Thu", "Fri", "Sat"]:
                for p_idx in [1, 2, 3, 4]:
                    p_info = next(p for p in PERIODS if p[0] == p_idx)
                    slot = TimetableSlot(
                        faculty_id=proj_faculty.faculty_id,
                        subject_id=proj_subj.id,
                        section_id=sec.id,
                        day_of_week=day,
                        period_index=p_idx,
                        start_time=p_info[1],
                        end_time=p_info[2],
                        room=f"PROJECT-LAB-{(ord(lbl) % 3) + 1}",
                        is_lab=True,
                        raw_text=f"MAJOR PROJECT {lbl} ({proj_faculty.initials or 'GUIDE'})",
                        academic_term="2024-25-EVEN",
                    )
                    db.session.add(slot)
                    total_slots_created += 1

        else:
            # ─────────────────────────────────────────────────────────────────
            # SEMESTERS 1, 3, 5:
            # Mon - Fri scheduled with 1-2 intentional free periods per day.
            # ─────────────────────────────────────────────────────────────────
            c_idx = 0
            for day in ["Mon", "Tue", "Wed", "Thu", "Fri"]:
                for p_idx, s_time, e_time in PERIODS:
                    # Free periods: Wed Period 5, Fri Period 6, Tue Period 4
                    if (day == "Wed" and p_idx == 5) or (day == "Fri" and p_idx == 6) or (day == "Tue" and p_idx == 4):
                        continue

                    course = course_list[c_idx % len(course_list)]
                    c_idx += 1
                    fac = all_faculty[(sem_int * 5 + c_idx + ord(lbl)) % len(all_faculty)]

                    subj = Subject.query.filter_by(code=course["code"]).first()
                    if not subj:
                        subj = Subject(code=course["code"], name=course["name"], is_confirmed=True)
                        db.session.add(subj)
                        db.session.flush()

                    slot = TimetableSlot(
                        faculty_id=fac.faculty_id,
                        subject_id=subj.id,
                        section_id=sec.id,
                        day_of_week=day,
                        period_index=p_idx,
                        start_time=s_time,
                        end_time=e_time,
                        room=sec_room if not course["is_lab"] else f"LAB-{(ord(lbl) % 4) + 1}",
                        is_lab=course["is_lab"],
                        raw_text=f"{course['code']} {lbl} ({fac.initials or 'FAC'})",
                        academic_term="2024-25-EVEN",
                    )
                    db.session.add(slot)
                    total_slots_created += 1

    db.session.commit()
    print(f"[+] Generated {total_slots_created} timetable slots across all 24 sections.")
    print("=" * 70)
    print("[SUCCESS] Full migration and seeding completed successfully!")
    print("=" * 70)


if __name__ == "__main__":
    from app import create_app
    app = create_app()
    with app.app_context():
        run_migration_and_seed()
