"""
Seed Script: Expand Student Database to match NBA Criterion 4 Report

Requirements:
  - Semester 3 (Year II): Exactly 185 students (Appeared: 185)
    - Exactly 180 students with final_result = 'Pass'
    - Average CGPA of the 180 Pass students = EXACTLY 7.85
    - Exactly 5 students with final_result = 'Fail' (backlogs > 0)
    - Distributed across Sections A (62), B (62), C (61)
  - Semester 5 (Year III): Exactly 180 students (Appeared: 180)
    - Exactly 176 students with final_result = 'Pass'
    - Average CGPA of the 176 Pass students = EXACTLY 8.12
    - Exactly 4 students with final_result = 'Fail' (backlogs > 0)
    - Distributed across Sections A (60), B (60), C (60)
  - Semester 7 (Year IV / Class of 2026): Exactly 32 students (STU069 - STU100 preserved)
    - Placements in 2025-26: 8 verified (5 placed, 2 higher studies, 1 entrepreneur) -> 25.0%
    - Denominator N = 32
  - Preserves existing STU001 - STU100 so all auth accounts, event attendance, and club roles remain intact.
"""

import json
import random
import sys
from pathlib import Path

# Add app directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models import db, Student, Department

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
    "Acharya", "Agarwal", "Agrawal", "Ayyangar", "Balaji", "Banerjee", "Bansal", "Bapat",
    "Barman", "Basu", "Bhandari", "Bhardwaj", "Bhat", "Bhattacharya", "Bose", "Chakraborty",
    "Chandran", "Chatterjee", "Chaudhary", "Chauhan", "Chopra", "Choudhury", "Das", "Dasgupta",
    "Deo", "Deshmukh", "Deshpande", "Devi", "Dey", "Dixit", "Dubey", "Dutta",
    "Gaikwad", "Ganguly", "Garg", "Ghosh", "Gokhale", "Gopalakrishnan", "Goyal", "Gupta",
    "Hegde", "Iyengar", "Iyer", "Jadhav", "Jain", "Jha", "Joshi", "Kale",
    "Kamath", "Kapoor", "Kashyap", "Kaur", "Kaushik", "Khan", "Khatri", "Kini",
    "Kulkarni", "Kumar", "Lahiri", "Mahajan", "Maheshwari", "Malhotra", "Mandal", "Mani",
    "Marathe", "Meena", "Mehta", "Menon", "Mishra", "Mitra", "Modi", "Mukherjee",
    "Murthy", "Nadar", "Nagarajan", "Naidu", "Naik", "Nair", "Nambiar", "Narayan",
    "Natarajan", "Nayak", "Pai", "Pandey", "Pandit", "Pant", "Parab", "Parekh",
    "Patel", "Patil", "Patnaik", "Pillai", "Pradhan", "Prasad", "Purohit", "Radhakrishnan",
    "Raghunathan", "Rajan", "Rajput", "Raju", "Ramachandran", "Raman", "Ranganathan", "Rao",
    "Rastogi", "Rathore", "Reddy", "Roy", "Saha", "Saini", "Samant", "Saxena",
    "Sen", "Sengupta", "Seth", "Shah", "Sharma", "Shetty", "Shukla", "Singh",
    "Sinha", "Sridhar", "Srinivasan", "Srivastava", "Subramanian", "Sundaram", "Swaminathan", "Talwar",
    "Tambe", "Thakur", "Tiwari", "Tripathi", "Upadhyay", "Varma", "Venkatesh", "Verma", "Yadav"
]


def _gen_curriculum_courses(semester, section, att, gpa, is_pass):
    """Generate realistic 4-course curriculum with scores matching gpa and pass status."""
    templates = Student.get_default_courses_for_semester(semester, section)
    courses = []
    target_pct = min(98.0, max(35.0, gpa * 9.5)) if is_pass else random.uniform(32.0, 44.0)

    for idx, tmpl in enumerate(templates):
        s = (target_pct / 100.0) + random.gauss(0, 0.04)
        s = max(0.25, min(0.98, s))

        cie1 = round(max(0, min(25, s * 25 + random.gauss(0, 1.5))))
        cie2 = round(max(0, min(25, s * 25 + random.gauss(0, 1.5))))
        quiz1 = round(max(0, min(10, s * 10 + random.gauss(0, 0.8))))
        quiz2 = round(max(0, min(10, s * 10 + random.gauss(0, 0.8))))
        el = round(max(0, min(30, s * 30 + random.gauss(0, 1.8))))

        if is_pass:
            see = round(max(40, min(100, s * 100 + random.gauss(0, 5))))
        else:
            see = round(random.uniform(20, 36)) if idx == 0 else round(max(35, min(80, s * 80)))

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


def seed_criterion4_student_records():
    """Populate and calibrate students table to exactly match Criteria 4.3 & 4.4."""
    dept = Department.query.filter_by(code="CSE").first()
    if not dept:
        print("[!] Department CSE not found.")
        return

    print("[*] Starting Student Database Expansion for Criterion 4...")

    # Sem 3 Pass (180 students): target mean = 7.85 -> target sum = 1413.00
    random.seed(2026)
    raw_gpas_sem3 = []
    for _ in range(180):
        g = random.gauss(7.85, 0.70)
        g = max(6.10, min(9.70, g))
        raw_gpas_sem3.append(round(g, 2))

    current_sum = sum(raw_gpas_sem3)
    diff = round(1413.00 - current_sum, 2)
    step = 0.01 if diff > 0 else -0.01
    remaining_steps = int(round(abs(diff) / 0.01))
    for i in range(remaining_steps):
        idx = i % 180
        raw_gpas_sem3[idx] = round(raw_gpas_sem3[idx] + step, 2)

    assert round(sum(raw_gpas_sem3), 2) == 1413.00, f"Sum error: {sum(raw_gpas_sem3)}"
    assert round(sum(raw_gpas_sem3) / 180.0, 4) == 7.85, f"Avg error: {sum(raw_gpas_sem3)/180.0}"
    print(f"[+] Sem 3 Pass CGPAs calibrated: 180 students, sum = {sum(raw_gpas_sem3):.2f}, mean = {sum(raw_gpas_sem3)/180.0:.2f}")

    # Sem 5 Pass (176 students): target mean = 8.12 -> target sum = 1429.12
    raw_gpas_sem5 = []
    for _ in range(176):
        g = random.gauss(8.12, 0.65)
        g = max(6.50, min(9.85, g))
        raw_gpas_sem5.append(round(g, 2))

    current_sum5 = sum(raw_gpas_sem5)
    diff5 = round(1429.12 - current_sum5, 2)
    step5 = 0.01 if diff5 > 0 else -0.01
    remaining_steps5 = int(round(abs(diff5) / 0.01))
    for i in range(remaining_steps5):
        idx = i % 176
        raw_gpas_sem5[idx] = round(raw_gpas_sem5[idx] + step5, 2)

    assert round(sum(raw_gpas_sem5), 2) == 1429.12, f"Sum error: {sum(raw_gpas_sem5)}"
    assert round(sum(raw_gpas_sem5) / 176.0, 4) == 8.12, f"Avg error: {sum(raw_gpas_sem5)/176.0}"
    print(f"[+] Sem 5 Pass CGPAs calibrated: 176 students, sum = {sum(raw_gpas_sem5):.2f}, mean = {sum(raw_gpas_sem5)/176.0:.2f}")

    # Failing GPAs
    fail_gpas_sem3 = [5.10, 4.80, 5.30, 4.90, 5.20]  # 5 students
    fail_gpas_sem5 = [5.20, 5.00, 4.90, 5.30]        # 4 students

    # ── UPDATE EXISTING STUDENTS (STU001 - STU035 in Sem 3) ──
    sem3_pass_assigned = 0
    sem3_fail_assigned = 0

    existing_sem3 = Student.query.filter_by(semester=3).order_by(Student.student_id).all()
    for s in existing_sem3:
        if s.final_result == "Fail" and sem3_fail_assigned < 2:
            s.previous_gpa = fail_gpas_sem3[sem3_fail_assigned]
            s.backlogs = random.randint(2, 4)
            s.attendance_pct = round(random.uniform(55.0, 72.0), 1)
            s.engagement = "Low"
            sem3_fail_assigned += 1
            is_pass = False
        else:
            s.final_result = "Pass"
            s.previous_gpa = raw_gpas_sem3[sem3_pass_assigned]
            s.backlogs = 0
            s.attendance_pct = round(random.uniform(78.0, 96.0), 1)
            s.engagement = "High" if s.previous_gpa >= 8.2 else "Medium"
            sem3_pass_assigned += 1
            is_pass = True

        courses = _gen_curriculum_courses(3, s.section, s.attendance_pct, s.previous_gpa, is_pass)
        s.courses_data = json.dumps(courses)
        s.internal_marks = round(sum(c["cie1"] + c["cie2"] + c["quiz1"] + c["quiz2"] + c["el"] for c in courses) / len(courses), 1)
        s.assignment_score_pct = round(random.uniform(75.0, 95.0), 1)
        s.course_performance_pct = round(s.previous_gpa * 10, 1)

    print(f"[+] Updated {len(existing_sem3)} existing Semester 3 students.")

    # ── UPDATE EXISTING STUDENTS (STU036 - STU068 in Sem 5) ──
    sem5_pass_assigned = 0
    sem5_fail_assigned = 0

    existing_sem5 = Student.query.filter_by(semester=5).order_by(Student.student_id).all()
    for s in existing_sem5:
        if s.final_result == "Fail" and sem5_fail_assigned < 1:
            s.previous_gpa = fail_gpas_sem5[sem5_fail_assigned]
            s.backlogs = random.randint(1, 3)
            s.attendance_pct = round(random.uniform(58.0, 73.0), 1)
            s.engagement = "Low"
            sem5_fail_assigned += 1
            is_pass = False
        else:
            s.final_result = "Pass"
            s.previous_gpa = raw_gpas_sem5[sem5_pass_assigned]
            s.backlogs = 0
            s.attendance_pct = round(random.uniform(80.0, 97.0), 1)
            s.engagement = "High" if s.previous_gpa >= 8.5 else "Medium"
            sem5_pass_assigned += 1
            is_pass = True

        courses = _gen_curriculum_courses(5, s.section, s.attendance_pct, s.previous_gpa, is_pass)
        s.courses_data = json.dumps(courses)
        s.internal_marks = round(sum(c["cie1"] + c["cie2"] + c["quiz1"] + c["quiz2"] + c["el"] for c in courses) / len(courses), 1)
        s.assignment_score_pct = round(random.uniform(78.0, 96.0), 1)
        s.course_performance_pct = round(s.previous_gpa * 10, 1)

    print(f"[+] Updated {len(existing_sem5)} existing Semester 5 students.")

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Add New Students for Semester 3 (to reach 185 total)
    # ─────────────────────────────────────────────────────────────────────────
    name_idx = 0
    used_names = set(s.name for s in Student.query.all())

    def get_unique_name():
        nonlocal name_idx
        while True:
            fn = FIRST_NAMES[name_idx % len(FIRST_NAMES)]
            ln = LAST_NAMES[(name_idx * 3 + 7) % len(LAST_NAMES)]
            name = f"{fn} {ln}"
            name_idx += 1
            if name not in used_names:
                used_names.add(name)
                return name

    max_stu_num = 100
    for s in Student.query.all():
        if s.student_id.startswith("STU") and s.student_id[3:].isdigit():
            max_stu_num = max(max_stu_num, int(s.student_id[3:]))

    new_sem3_count = 185 - len(existing_sem3)
    sec_counts_sem3 = {"A": len([s for s in existing_sem3 if s.section == "A"]),
                       "B": len([s for s in existing_sem3 if s.section == "B"]),
                       "C": len([s for s in existing_sem3 if s.section == "C"])}

    for _ in range(new_sem3_count):
        max_stu_num += 1
        sid = f"STU{max_stu_num:03d}"
        name = get_unique_name()

        if sec_counts_sem3["A"] < 62:
            sec = "A"
        elif sec_counts_sem3["B"] < 62:
            sec = "B"
        else:
            sec = "C"
        sec_counts_sem3[sec] += 1

        if sem3_pass_assigned < 180:
            gpa = raw_gpas_sem3[sem3_pass_assigned]
            sem3_pass_assigned += 1
            is_pass = True
            final_res = "Pass"
            backlogs = 0
            att = round(random.uniform(77.0, 97.0), 1)
            eng = "High" if gpa >= 8.2 else "Medium"
        else:
            gpa = fail_gpas_sem3[sem3_fail_assigned]
            sem3_fail_assigned += 1
            is_pass = False
            final_res = "Fail"
            backlogs = random.randint(1, 3)
            att = round(random.uniform(52.0, 71.0), 1)
            eng = "Low"

        courses = _gen_curriculum_courses(3, sec, att, gpa, is_pass)
        courses_json = json.dumps(courses)
        int_marks = round(sum(c["cie1"] + c["cie2"] + c["quiz1"] + c["quiz2"] + c["el"] for c in courses) / len(courses), 1)
        email = f"{name.split()[0].lower()}.{sid.lower()}@student.academiq.edu"
        phone = "8660042249"

        new_stu = Student(
            student_id=sid,
            name=name,
            email=email,
            phone=phone,
            department_id=dept.id,
            semester=3,
            section=sec,
            attendance_pct=att,
            internal_marks=int_marks,
            assignment_score_pct=round(random.uniform(75.0, 95.0), 1) if is_pass else round(random.uniform(40.0, 60.0), 1),
            previous_gpa=gpa,
            backlogs=backlogs,
            course_performance_pct=round(gpa * 10, 1),
            engagement=eng,
            final_result=final_res,
            courses_data=courses_json,
        )
        db.session.add(new_stu)

    db.session.flush()
    print(f"[+] Added {new_sem3_count} new Semester 3 students. Total Sem 3 = 185 (Pass: {sem3_pass_assigned}, Fail: {sem3_fail_assigned}).")

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Add New Students for Semester 5 (to reach 180 total)
    # ─────────────────────────────────────────────────────────────────────────
    new_sem5_count = 180 - len(existing_sem5)
    sec_counts_sem5 = {"A": len([s for s in existing_sem5 if s.section == "A"]),
                       "B": len([s for s in existing_sem5 if s.section == "B"]),
                       "C": len([s for s in existing_sem5 if s.section == "C"])}

    for _ in range(new_sem5_count):
        max_stu_num += 1
        sid = f"STU{max_stu_num:03d}"
        name = get_unique_name()

        if sec_counts_sem5["A"] < 60:
            sec = "A"
        elif sec_counts_sem5["B"] < 60:
            sec = "B"
        else:
            sec = "C"
        sec_counts_sem5[sec] += 1

        if sem5_pass_assigned < 176:
            gpa = raw_gpas_sem5[sem5_pass_assigned]
            sem5_pass_assigned += 1
            is_pass = True
            final_res = "Pass"
            backlogs = 0
            att = round(random.uniform(79.0, 98.0), 1)
            eng = "High" if gpa >= 8.4 else "Medium"
        else:
            gpa = fail_gpas_sem5[sem5_fail_assigned]
            sem5_fail_assigned += 1
            is_pass = False
            final_res = "Fail"
            backlogs = random.randint(1, 3)
            att = round(random.uniform(54.0, 72.0), 1)
            eng = "Low"

        courses = _gen_curriculum_courses(5, sec, att, gpa, is_pass)
        courses_json = json.dumps(courses)
        int_marks = round(sum(c["cie1"] + c["cie2"] + c["quiz1"] + c["quiz2"] + c["el"] for c in courses) / len(courses), 1)
        email = f"{name.split()[0].lower()}.{sid.lower()}@student.academiq.edu"
        phone = "8660042249"

        new_stu = Student(
            student_id=sid,
            name=name,
            email=email,
            phone=phone,
            department_id=dept.id,
            semester=5,
            section=sec,
            attendance_pct=att,
            internal_marks=int_marks,
            assignment_score_pct=round(random.uniform(78.0, 96.0), 1) if is_pass else round(random.uniform(42.0, 62.0), 1),
            previous_gpa=gpa,
            backlogs=backlogs,
            course_performance_pct=round(gpa * 10, 1),
            engagement=eng,
            final_result=final_res,
            courses_data=courses_json,
        )
        db.session.add(new_stu)

    db.session.commit()
    print(f"[+] Added {new_sem5_count} new Semester 5 students. Total Sem 5 = 180 (Pass: {sem5_pass_assigned}, Fail: {sem5_fail_assigned}).")

    # ─────────────────────────────────────────────────────────────────────────
    # 4. Verification Check
    # ─────────────────────────────────────────────────────────────────────────
    total_stu = Student.query.count()
    sem3_total = Student.query.filter_by(semester=3).count()
    sem3_pass  = Student.query.filter_by(semester=3, final_result="Pass").count()
    sem3_fail  = Student.query.filter_by(semester=3, final_result="Fail").count()
    sem3_gpas  = [s.previous_gpa for s in Student.query.filter_by(semester=3, final_result="Pass").all()]
    sem3_mean  = sum(sem3_gpas) / len(sem3_gpas) if sem3_gpas else 0

    sem5_total = Student.query.filter_by(semester=5).count()
    sem5_pass  = Student.query.filter_by(semester=5, final_result="Pass").count()
    sem5_fail  = Student.query.filter_by(semester=5, final_result="Fail").count()
    sem5_gpas  = [s.previous_gpa for s in Student.query.filter_by(semester=5, final_result="Pass").all()]
    sem5_mean  = sum(sem5_gpas) / len(sem5_gpas) if sem5_gpas else 0

    sem7_total = Student.query.filter_by(semester=7).count()

    print("=" * 60)
    print("VERIFICATION OF EXPANDED STUDENT DATABASE:")
    print(f"Total Students in Database: {total_stu}")
    print(f"Semester 3 (Year II)  : Total={sem3_total} (Exp: 185) | Pass={sem3_pass} (Exp: 180) | Fail={sem3_fail} (Exp: 5) | Mean CGPA={sem3_mean:.2f} (Exp: 7.85)")
    print(f"Semester 5 (Year III) : Total={sem5_total} (Exp: 180) | Pass={sem5_pass} (Exp: 176) | Fail={sem5_fail} (Exp: 4) | Mean CGPA={sem5_mean:.2f} (Exp: 8.12)")
    print(f"Semester 7 (Year IV)  : Total={sem7_total} (Exp: 32)")
    print("=" * 60)


if __name__ == "__main__":
    from app import create_app
    app = create_app()
    with app.app_context():
        seed_criterion4_student_records()
