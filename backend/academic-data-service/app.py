"""
Academic Data Service — AcademiQ
Handles: students, faculty, departments CRUD + analytics + clubs/events.
"""

import os
from datetime import datetime
from flask import Flask

from flask_cors import CORS
from models import db
from routes.students       import students_bp
from routes.faculty        import faculty_bp
from routes.departments    import departments_bp
from routes.assignments    import assignments_bp
from routes.clubs          import clubs_bp
from routes.student_roles  import student_roles_bp
from routes.events         import events_bp
from routes.placements     import placements_bp
from routes.student_achievements import student_achievements_bp
from routes.historical_data import historical_data_bp
from routes.classes import classes_bp
import event_models        # noqa: F401
import placement_models    # noqa: F401
import achievement_models  # noqa: F401
import historical_models   # noqa: F401 — ensure tables are registered with SQLAlchemy


def create_app():
    app = Flask(__name__)
    CORS(app)

    pg_user = os.getenv("POSTGRES_USER", "academiq")
    pg_pass = os.getenv("POSTGRES_PASSWORD", "academiq_pass")
    pg_host = os.getenv("POSTGRES_HOST", "postgres")
    pg_port = os.getenv("POSTGRES_PORT", "5432")
    pg_db   = os.getenv("POSTGRES_DB", "academiq")

    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"postgresql://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    app.register_blueprint(students_bp,             url_prefix="/students")
    app.register_blueprint(faculty_bp,              url_prefix="/faculty")
    app.register_blueprint(departments_bp,          url_prefix="/departments")
    app.register_blueprint(assignments_bp,          url_prefix="/assignments")
    app.register_blueprint(clubs_bp,                url_prefix="/clubs")
    app.register_blueprint(student_roles_bp,        url_prefix="/student-roles")
    app.register_blueprint(classes_bp,              url_prefix="/classes")
    app.register_blueprint(events_bp)               # routes use /clubs/:id/events + /events/
    app.register_blueprint(placements_bp)           # routes use /profile/placement + /placements/
    app.register_blueprint(student_achievements_bp) # routes use /student-achievements + /achievement-proofs/
    app.register_blueprint(historical_data_bp)      # routes use /admission-records, /batch-progress, /academic-performance


    @app.get("/health")
    def health():
        return {"status": "ok", "service": "academic-data-service"}

    with app.app_context():
        db.create_all()
        _run_db_migrations()
        _seed_demo_data()
        _seed_demo_clubs()
        _seed_demo_placements()
        _seed_demo_achievements()
        _seed_demo_historical_data()

    return app


def _run_db_migrations():
    """Add any missing columns to existing tables for backwards compatibility."""
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS courses_data TEXT",
        "ALTER TABLE departments ADD COLUMN IF NOT EXISTS academic_activities TEXT",
        "ALTER TABLE departments ADD COLUMN IF NOT EXISTS training_programmes TEXT",
        "ALTER TABLE departments ADD COLUMN IF NOT EXISTS clubs TEXT",
        "ALTER TABLE departments ADD COLUMN IF NOT EXISTS awards TEXT",
        "ALTER TABLE departments ADD COLUMN IF NOT EXISTS industry_interaction TEXT",
    ]
    for sql in migrations:
        try:
            db.session.execute(text(sql))
            db.session.commit()
        except Exception:
            db.session.rollback()





def _seed_demo_data():
    """Insert demo students + faculty if DB is empty.
    
    Layout:
      Department : CSE (Computer Science & Engineering)
      Sections   : A (35 students, Sem 3), B (33 students, Sem 5), C (32 students, Sem 7)
      Faculty    : FAC001 – teaches Data Structures & Algorithms + Machine Learning
                   FAC002 – teaches Computer Networks + Operating Systems
    """
    from models import Student, Faculty, Department
    if Department.query.count() > 0:
        return  # already seeded

    dept = Department(
        code="CSE",
        name="Computer Science & Engineering",
        vision="To be a centre of excellence producing globally competent engineers who contribute to society through innovation.",
        mission="Impart quality education, promote research and foster innovation in computing and related disciplines.",
        peos='["PEO1: Apply technical knowledge to solve real-world engineering problems","PEO2: Excel in industry and higher studies through continuous learning","PEO3: Lead with ethics, teamwork and professional responsibility"]',
        pos='["PO1: Engineering knowledge","PO2: Problem analysis","PO3: Design/development of solutions","PO4: Conduct investigations of complex problems","PO5: Modern tool usage","PO6: Engineer and society","PO7: Environment and sustainability","PO8: Ethics","PO9: Individual and team work","PO10: Communication","PO11: Project management and finance","PO12: Life-long learning"]',
        cos='["CO1: Understand and apply fundamental computing principles","CO2: Design and implement software solutions","CO3: Analyse systems and optimise for performance","CO4: Communicate technical findings effectively","CO5: Work collaboratively on complex projects"]',
        placement_stats='{"2022-23":{"eligible":120,"placed":98,"percentage":81.7,"avg_package_lpa":6.4},"2023-24":{"eligible":118,"placed":104,"percentage":88.1,"avg_package_lpa":7.2},"2024-25":{"eligible":115,"placed":109,"percentage":94.8,"avg_package_lpa":8.5}}',
        research_stats='{"publications":42,"patents":3,"funded_projects":7,"conferences":28}',
        infrastructure='["450-seat computer lab with GPU cluster","High-speed 1 Gbps campus Wi-Fi","Digital library with IEEE/Springer access","Innovation and Entrepreneurship Cell","Smart classrooms with IoT integration"]',
        academic_activities='["Guest lectures series — 12 per semester","Industrial visits to TCS, Infosys, ISRO","Hackathon — CodeStorm (annual)","Technical symposium — TechFusion","NSS and social outreach programmes"]',
        training_programmes='["Python & ML Bootcamp (40 hrs)","Cloud Computing with AWS (30 hrs)","Full-Stack Web Development (50 hrs)","Data Structures Intensive (20 hrs)","Communication Skills & Aptitude (15 hrs)"]',
        clubs='["ACM Student Chapter","IEEE Student Branch","CodeChef Campus Chapter","Robotics Club","Cybersecurity Club"]',
        awards='["Best CSE Department Award – Anna University 2024","NBA Accredited 2022-2025","NAAC A+ Institution 2023","Best Research Output Award – State Level 2024"]',
        industry_interaction='["MoU with TCS – Internship pipeline","MoU with Infosys – Campus Connect Programme","MoU with IBM – AI Centre of Excellence","Industry Advisory Board with 8 senior professionals","Annual Industry-Academia conclave"]',
    )
    db.session.add(dept)
    db.session.flush()

    import json, random

    # ─── 2 Faculty members ──────────────────────────────────────────────────
    faculty_records = [
        {
            "faculty_id": "FAC001",
            "name": "Dr. Meena Iyer",
            "email": "meena.iyer@faculty.academiq.edu",
            "phone": "9876500001",
            "designation": "Associate Professor",
            "qualification": "Ph.D (Computer Science & Engineering)",
            "experience": "15 years",
            "courses_taught": json.dumps([
                "Data Structures & Algorithms",
                "Machine Learning",
                "Design & Analysis of Algorithms",
                "Artificial Intelligence"
            ]),
            "publications": json.dumps([
                "Deep Learning in Healthcare Diagnostics — IEEE Transactions 2024",
                "Survey of NLP Techniques for Tamil Language Processing — Springer 2023",
                "Federated Learning for Privacy-Preserving Medical Imaging — IJCAI 2023",
                "Graph Neural Networks for Social Network Analysis — ACM 2022",
            ]),
            "fdp_participation": json.dumps([
                "AICTE FDP on AI/ML — IIT Madras 2024 (7 days)",
                "NPTEL Online Certification — Machine Learning 2023",
                "SERB Workshop on Deep Learning — IISc Bangalore 2023",
                "ATAL FDP on Data Science — NIT Trichy 2022",
            ]),
            "certifications": json.dumps([
                "TCS Research Excellence Grant 2023",
                "Google Certified ML Engineer (Associate)",
                "Coursera Deep Learning Specialisation",
            ]),
            "research_projects": json.dumps([
                "SERB-funded project: Explainable AI for Medical Diagnosis (₹18 L, 2023-25)",
                "DST-funded: NLP for Regional Language Processing (₹12 L, 2022-24)",
            ]),
            "awards": json.dumps([
                "Best Faculty Award — Anna University 2022",
                "Innovative Researcher Award — Institution 2023",
                "Women in Engineering Award — IEEE Madras Section 2024",
            ]),
        },
        {
            "faculty_id": "FAC002",
            "name": "Prof. Ravi Shankar",
            "email": "ravi.shankar@faculty.academiq.edu",
            "phone": "9876500002",
            "designation": "Assistant Professor",
            "qualification": "M.Tech (Computer Networks & Information Security)",
            "experience": "8 years",
            "courses_taught": json.dumps([
                "Computer Networks",
                "Operating Systems",
                "Network Security & Cryptography",
                "Cloud Computing",
            ]),
            "publications": json.dumps([
                "SDN-based Traffic Optimization for Campus Networks — Elsevier 2024",
                "Zero-Trust Architecture in Educational Institutions — IEEE Access 2023",
                "Performance Analysis of 5G mmWave Networks — COMSNETS 2022",
            ]),
            "fdp_participation": json.dumps([
                "Cisco CCNA Certification FDP — 2024",
                "NPTEL Cloud Computing Certification — 2023",
                "ATAL FDP on Cybersecurity — NIT Surathkal 2023",
                "AWS Academy Cloud Foundations — 2022",
            ]),
            "certifications": json.dumps([
                "Cisco Certified Network Associate (CCNA) 2024",
                "AWS Certified Cloud Practitioner 2023",
                "CompTIA Security+ 2023",
            ]),
            "research_projects": json.dumps([
                "Institution-funded: SDN for Smart Campus Network Management (₹5 L, 2024-25)",
            ]),
            "awards": json.dumps([
                "Best Paper Award — ICCCN 2024",
                "Outstanding Teaching Award — Institution 2023",
            ]),
        },
    ]

    for fd in faculty_records:
        f = Faculty(
            faculty_id=fd["faculty_id"],
            name=fd["name"],
            email=fd["email"],
            phone=fd["phone"],
            department_id=dept.id,
            designation=fd["designation"],
            qualification=fd["qualification"],
            experience=fd["experience"],
            courses_taught=fd["courses_taught"],
            publications=fd["publications"],
            fdp_participation=fd["fdp_participation"],
            certifications=fd["certifications"],
            research_projects=fd["research_projects"],
            awards=fd["awards"],
        )
        db.session.add(f)

    # ─── Student data ────────────────────────────────────────────────────────
    # 100 students: Section A = 35 (Sem 3), Section B = 33 (Sem 5), Section C = 32 (Sem 7)
    # Each student gets realistic CIE/Quiz/EL/SEE course-level evaluation data.
    #
    # Evaluation format:
    #   CIE1 (/25) + CIE2 (/25) + Quiz1 (/10) + Quiz2 (/10) + EL (/30) = CIE raw (/100)
    #   CIE reduced = raw × 50/100 = /50
    #   SEE raw (/100), reduced = raw × 50/100 = /50
    #   Grand total = CIE_reduced + SEE_reduced = /100
    #
    # Format: (student_id, name, section, semester, att%, gpa_hint, backlogs, engagement, result)
    # Course data is generated procedurally from these hints for realism.

    SECTION_COURSES = {
        "A": [  # Semester 3
            {"code": "CS3C01", "name": "Data Structures & Algorithms", "credits": 4},
            {"code": "CS3C02", "name": "Digital Logic & Design", "credits": 4},
            {"code": "CS3C03", "name": "Computer Organization & Architecture", "credits": 4},
            {"code": "CS3C04", "name": "Discrete Mathematics", "credits": 3},
            {"code": "CS3L01", "name": "Data Structures Lab", "credits": 2},
            {"code": "MA3B01", "name": "Probability & Statistics", "credits": 3},
        ],
        "B": [  # Semester 5
            {"code": "CS5C01", "name": "Database Management Systems", "credits": 4},
            {"code": "CS5C02", "name": "Operating Systems", "credits": 4},
            {"code": "CS5C03", "name": "Theory of Computation", "credits": 3},
            {"code": "CS5C04", "name": "Software Engineering", "credits": 4},
            {"code": "CS5L01", "name": "DBMS Lab", "credits": 2},
            {"code": "CS6C04", "name": "Web Technologies & Applications", "credits": 3},
        ],
        "C": [  # Semester 7
            {"code": "CS7C01", "name": "Machine Learning", "credits": 4},
            {"code": "CS7C02", "name": "Compiler Design", "credits": 4},
            {"code": "CS7C03", "name": "Cloud Computing", "credits": 3},
            {"code": "CS8E501","name": "Storage Area Networks", "credits": 3},
            {"code": "CS7P01", "name": "Project Phase 1", "credits": 4},
            {"code": "CS7L01", "name": "ML Lab", "credits": 2},
        ],
    }

    def gen_courses(section, att_base, gpa_hint, eng):
        """Generate realistic per-course CIE/Quiz/EL/SEE data for a student."""
        import random as rng
        courses = []
        # Skill level drives all scores; correlated to GPA hint
        skill = gpa_hint / 10.0  # 0.0 – 1.0

        for tmpl in SECTION_COURSES[section]:
            noise = rng.gauss(0, 0.08)
            s = max(0.15, min(1.0, skill + noise))

            cie1  = round(max(0, min(25, s * 25 + rng.gauss(0, 2))))
            cie2  = round(max(0, min(25, s * 25 + rng.gauss(0, 2.5))))
            quiz1 = round(max(0, min(10, s * 10 + rng.gauss(0, 1.2))))
            quiz2 = round(max(0, min(10, s * 10 + rng.gauss(0, 1.2))))
            el    = round(max(0, min(30, s * 30 + rng.gauss(0, 3))))
            see   = round(max(0, min(100, s * 100 + rng.gauss(0, 8))))
            c_att = round(max(30, min(100, att_base + rng.gauss(0, 4))), 1)

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

    students_raw = [
        # ── SECTION A — 35 students, Semester 3 ──────────────────────────────
        ("STU001", "Aarav Sharma",       "A", 3, 88, 8.1, 0, "High",   "Pass"),
        ("STU002", "Aditi Rao",          "A", 3, 72, 7.0, 1, "Medium", "Pass"),
        ("STU003", "Akash Patel",        "A", 3, 55, 5.5, 3, "Low",    "Fail"),
        ("STU004", "Ananya Iyer",        "A", 3, 91, 9.0, 0, "High",   "Pass"),
        ("STU005", "Arjun Nair",         "A", 3, 63, 6.2, 2, "Low",    "Pass"),
        ("STU006", "Bhavya Krishnan",    "A", 3, 48, 5.0, 5, "Low",    "Fail"),
        ("STU007", "Chirag Mehta",       "A", 3, 79, 7.8, 0, "Medium", "Pass"),
        ("STU008", "Deepika Suresh",     "A", 3, 85, 8.4, 0, "High",   "Pass"),
        ("STU009", "Dhruv Gupta",        "A", 3, 58, 5.9, 2, "Low",    "Pass"),
        ("STU010", "Divya Menon",        "A", 3, 76, 7.4, 0, "Medium", "Pass"),
        ("STU011", "Farhan Sheikh",      "A", 3, 44, 4.8, 6, "Low",    "Fail"),
        ("STU012", "Gayatri Pillai",     "A", 3, 82, 7.9, 0, "Medium", "Pass"),
        ("STU013", "Harish Reddy",       "A", 3, 67, 6.5, 1, "Medium", "Pass"),
        ("STU014", "Ishita Verma",       "A", 3, 93, 9.3, 0, "High",   "Pass"),
        ("STU015", "Jayesh Thakkar",     "A", 3, 60, 6.0, 2, "Low",    "Pass"),
        ("STU016", "Kavitha Srinivasan", "A", 3, 74, 7.1, 1, "Medium", "Pass"),
        ("STU017", "Kiran Bose",         "A", 3, 50, 5.2, 4, "Low",    "Fail"),
        ("STU018", "Lakshmi Narayan",    "A", 3, 88, 8.6, 0, "High",   "Pass"),
        ("STU019", "Manoj Tiwari",       "A", 3, 66, 6.4, 1, "Medium", "Pass"),
        ("STU020", "Meera Pillai",       "A", 3, 95, 9.5, 0, "High",   "Pass"),
        ("STU021", "Nikhil Joshi",       "A", 3, 70, 6.8, 1, "Medium", "Pass"),
        ("STU022", "Nisha Agarwal",      "A", 3, 53, 5.4, 3, "Low",    "Fail"),
        ("STU023", "Pavan Kumar",        "A", 3, 78, 7.6, 0, "Medium", "Pass"),
        ("STU024", "Pooja Shankar",      "A", 3, 84, 8.2, 0, "High",   "Pass"),
        ("STU025", "Prakash Raj",        "A", 3, 61, 6.1, 2, "Low",    "Pass"),
        ("STU026", "Priya Balaji",       "A", 3, 90, 9.0, 0, "High",   "Pass"),
        ("STU027", "Rahul Desai",        "A", 3, 56, 5.7, 3, "Low",    "Fail"),
        ("STU028", "Ramya Natarajan",    "A", 3, 75, 7.3, 0, "Medium", "Pass"),
        ("STU029", "Rohit Saxena",       "A", 3, 68, 6.7, 1, "Medium", "Pass"),
        ("STU030", "Sakshi Bhatt",       "A", 3, 87, 8.5, 0, "High",   "Pass"),
        ("STU031", "Sandeep Pillai",     "A", 3, 46, 4.9, 5, "Low",    "Fail"),
        ("STU032", "Shreya Kulkarni",    "A", 3, 80, 7.9, 0, "Medium", "Pass"),
        ("STU033", "Suresh Babu",        "A", 3, 64, 6.3, 2, "Low",    "Pass"),
        ("STU034", "Tanvi Kapoor",       "A", 3, 92, 9.1, 0, "High",   "Pass"),
        ("STU035", "Vikram Rao",         "A", 3, 57, 5.8, 3, "Low",    "Fail"),

        # ── SECTION B — 33 students, Semester 5 ──────────────────────────────
        ("STU036", "Aishwarya Naidu",    "B", 5, 86, 8.3, 0, "High",   "Pass"),
        ("STU037", "Ajay Pandey",        "B", 5, 69, 6.7, 1, "Medium", "Pass"),
        ("STU038", "Amrita Ghosh",       "B", 5, 52, 5.3, 4, "Low",    "Fail"),
        ("STU039", "Anand Venkat",       "B", 5, 90, 9.0, 0, "High",   "Pass"),
        ("STU040", "Anjali Mishra",      "B", 5, 76, 7.5, 0, "Medium", "Pass"),
        ("STU041", "Arun Selvam",        "B", 5, 61, 6.2, 2, "Low",    "Pass"),
        ("STU042", "Aswini Murugan",     "B", 5, 83, 8.1, 0, "High",   "Pass"),
        ("STU043", "Balachandran K",     "B", 5, 45, 4.7, 6, "Low",    "Fail"),
        ("STU044", "Chandana Ravi",      "B", 5, 77, 7.6, 0, "Medium", "Pass"),
        ("STU045", "Darshan Hegde",      "B", 5, 94, 9.4, 0, "High",   "Pass"),
        ("STU046", "Divyesh Parekh",     "B", 5, 63, 6.4, 2, "Medium", "Pass"),
        ("STU047", "Geeta Krishnaswamy", "B", 5, 47, 5.0, 5, "Low",    "Fail"),
        ("STU048", "Gowtham Rajan",      "B", 5, 81, 8.0, 0, "High",   "Pass"),
        ("STU049", "Haritha Nambiar",    "B", 5, 72, 7.1, 1, "Medium", "Pass"),
        ("STU050", "Hemanth Reddy",      "B", 5, 58, 5.8, 3, "Low",    "Pass"),
        ("STU051", "Indira Devi",        "B", 5, 88, 8.7, 0, "High",   "Pass"),
        ("STU052", "Jagan Mohan",        "B", 5, 65, 6.5, 1, "Medium", "Pass"),
        ("STU053", "Keerthi Suresh",     "B", 5, 50, 5.1, 4, "Low",    "Fail"),
        ("STU054", "Kiran Madhuri",      "B", 5, 79, 7.8, 0, "Medium", "Pass"),
        ("STU055", "Lavanya Ramesh",     "B", 5, 91, 9.1, 0, "High",   "Pass"),
        ("STU056", "Madan Babu",         "B", 5, 54, 5.5, 3, "Low",    "Fail"),
        ("STU057", "Megha Shetty",       "B", 5, 84, 8.3, 0, "High",   "Pass"),
        ("STU058", "Mohan Raj",          "B", 5, 68, 6.8, 1, "Medium", "Pass"),
        ("STU059", "Nandini Krishnan",   "B", 5, 73, 7.2, 0, "Medium", "Pass"),
        ("STU060", "Naveen Kumar",       "B", 5, 43, 4.5, 7, "Low",    "Fail"),
        ("STU061", "Pallavi Iyer",       "B", 5, 89, 8.8, 0, "High",   "Pass"),
        ("STU062", "Pradeep Varma",      "B", 5, 62, 6.3, 2, "Low",    "Pass"),
        ("STU063", "Prasanna Kumar",     "B", 5, 78, 7.7, 0, "Medium", "Pass"),
        ("STU064", "Rajesh Menon",       "B", 5, 55, 5.6, 3, "Low",    "Fail"),
        ("STU065", "Revathi Shankar",    "B", 5, 85, 8.4, 0, "High",   "Pass"),
        ("STU066", "Sankar Krishnan",    "B", 5, 71, 7.0, 1, "Medium", "Pass"),
        ("STU067", "Saranya Murali",     "B", 5, 48, 5.0, 5, "Low",    "Fail"),
        ("STU068", "Sathish Babu",       "B", 5, 93, 9.2, 0, "High",   "Pass"),

        # ── SECTION C — 32 students, Semester 7 ──────────────────────────────
        ("STU069", "Abhinav Jain",       "C", 7, 87, 8.4, 0, "High",   "Pass"),
        ("STU070", "Adithya Srinivas",   "C", 7, 70, 6.9, 1, "Medium", "Pass"),
        ("STU071", "Akshaya Kumar",      "C", 7, 53, 5.4, 4, "Low",    "Fail"),
        ("STU072", "Amruta Desai",       "C", 7, 92, 9.2, 0, "High",   "Pass"),
        ("STU073", "Anilkumar Patil",    "C", 7, 64, 6.5, 2, "Medium", "Pass"),
        ("STU074", "Archana Venkat",     "C", 7, 46, 4.8, 6, "Low",    "Fail"),
        ("STU075", "Arunachalam S",      "C", 7, 80, 7.9, 0, "Medium", "Pass"),
        ("STU076", "Bharathi Devi",      "C", 7, 95, 9.5, 0, "High",   "Pass"),
        ("STU077", "Chandrasekhar M",    "C", 7, 57, 5.7, 3, "Low",    "Fail"),
        ("STU078", "Deepa Lakshmi",      "C", 7, 75, 7.4, 0, "Medium", "Pass"),
        ("STU079", "Dhinesh Kumar",      "C", 7, 82, 8.1, 0, "High",   "Pass"),
        ("STU080", "Elakkiya Murugan",   "C", 7, 49, 5.1, 5, "Low",    "Fail"),
        ("STU081", "Geetha Rajan",       "C", 7, 76, 7.5, 0, "Medium", "Pass"),
        ("STU082", "Gopalakrishnan T",   "C", 7, 88, 8.7, 0, "High",   "Pass"),
        ("STU083", "Hariharan P",        "C", 7, 61, 6.2, 2, "Low",    "Pass"),
        ("STU084", "Indumathi Raj",      "C", 7, 84, 8.3, 0, "High",   "Pass"),
        ("STU085", "Jayakumar M",        "C", 7, 52, 5.3, 4, "Low",    "Fail"),
        ("STU086", "Kamala Devi",        "C", 7, 91, 9.1, 0, "High",   "Pass"),
        ("STU087", "Karthikeyan R",      "C", 7, 67, 6.7, 1, "Medium", "Pass"),
        ("STU088", "Kumari Anbalagan",   "C", 7, 44, 4.6, 6, "Low",    "Fail"),
        ("STU089", "Loganathan S",       "C", 7, 79, 7.8, 0, "Medium", "Pass"),
        ("STU090", "Malathi Arumugam",   "C", 7, 86, 8.5, 0, "High",   "Pass"),
        ("STU091", "Murugesan K",        "C", 7, 56, 5.7, 3, "Low",    "Fail"),
        ("STU092", "Nalini Krishnan",    "C", 7, 73, 7.3, 0, "Medium", "Pass"),
        ("STU093", "Palanivel S",        "C", 7, 89, 8.8, 0, "High",   "Pass"),
        ("STU094", "Pavithra Sekar",     "C", 7, 60, 6.1, 2, "Low",    "Pass"),
        ("STU095", "Ramachandran V",     "C", 7, 83, 8.2, 0, "High",   "Pass"),
        ("STU096", "Saraswathi Nair",    "C", 7, 47, 5.0, 5, "Low",    "Fail"),
        ("STU097", "Senthilkumar A",     "C", 7, 77, 7.7, 0, "Medium", "Pass"),
        ("STU098", "Sudha Rajan",        "C", 7, 93, 9.3, 0, "High",   "Pass"),
        ("STU099", "Thiyagarajan P",     "C", 7, 63, 6.4, 2, "Medium", "Pass"),
        ("STU100", "Usha Kiran",         "C", 7, 85, 8.4, 0, "High",   "Pass"),
    ]

    random.seed(42)  # reproducible demo data

    for (sid, name, section, sem, att, gpa, backlogs, eng, result) in students_raw:
        first = name.split()[0].lower()
        courses = gen_courses(section, att, gpa, eng)

        # Compute backward-compat summary fields from course data
        if courses:
            avg_cie_raw = sum(c["cie1"]+c["cie2"]+c["quiz1"]+c["quiz2"]+c["el"] for c in courses) / len(courses)
            avg_see     = sum(c["see"] for c in courses) / len(courses)
            avg_att     = sum(c["attendance_pct"] for c in courses) / len(courses)
            # internal_marks = CIE raw avg (out of 100)
            internal_marks = round(avg_cie_raw, 1)
            # assignment = quiz avg pct (out of 10)
            avg_quiz = sum(c["quiz1"]+c["quiz2"] for c in courses) / len(courses)
            assign_pct = round(avg_quiz / 20 * 100, 1)
            # course_performance = grand total avg (CIE_red + SEE_red)
            from models import Student
            totals = []
            for c in courses:
                g = Student.compute_course_grade(c)
                totals.append(g["total"])
            course_perf = round(sum(totals) / len(totals), 1) if totals else 0
        else:
            avg_att = att
            internal_marks = 0
            assign_pct = 0
            course_perf = 0

        s = Student(
            student_id=sid,
            name=name,
            department_id=dept.id,
            section=section,
            semester=sem,
            attendance_pct=round(avg_att, 1),
            internal_marks=internal_marks,
            assignment_score_pct=assign_pct,
            previous_gpa=float(gpa),
            backlogs=backlogs,
            course_performance_pct=course_perf,
            engagement=eng,
            final_result=result,
            courses_data=json.dumps(courses),
            email=f"{first}.{sid.lower()}@student.academiq.edu",
            phone=f"9{sid[3:]:0>9}",
        )
        db.session.add(s)

    db.session.commit()

    # ── Demo Assignments & Targets ──────────────────────────────────────────
    from models import Assignment, AssignmentTarget
    from datetime import datetime, timedelta

    if not Assignment.query.first():
        now = datetime.utcnow()
        demo_assignments = [
            {
                "type": "homework",
                "title": "Data Structures Problem Set 3: Trees & Graphs",
                "description": "Implement AVL Tree balancing and Graph BFS/DFS traversal algorithms in Python or C++. Submit code repository link and PDF report.",
                "faculty_id": "FAC001",
                "target_type": "section",
                "target_id": "A",
                "due_date": now + timedelta(days=7),
            },
            {
                "type": "project",
                "title": "Machine Learning Capstone: Predictive Performance Model",
                "description": "Build an end-to-end classification pipeline with hyperparameter tuning, ROC-AUC curves, and confusion matrix analysis on the student master dataset.",
                "faculty_id": "FAC001",
                "target_type": "batch",
                "target_id": "5",
                "due_date": now + timedelta(days=21),
            },
            {
                "type": "homework",
                "title": "Database Systems: Normalization & Indexing Case Study",
                "description": "Decompose unnormalized schemas up to BCNF and write SQL queries demonstrating performance improvement using B-tree indexing.",
                "faculty_id": "FAC002",
                "target_type": "section",
                "target_id": "B",
                "due_date": now + timedelta(days=10),
            },
            {
                "type": "homework",
                "title": "Algorithm Design: Dynamic Programming Assignment",
                "description": "Solve the 0/1 Knapsack and Longest Common Subsequence problems with memoization and bottom-up DP table construction.",
                "faculty_id": "FAC001",
                "target_type": "student",
                "target_id": "STU001",
                "due_date": now + timedelta(days=4),
            },
        ]

        for ad in demo_assignments:
            a = Assignment(
                type=ad["type"],
                title=ad["title"],
                description=ad["description"],
                faculty_id=ad["faculty_id"],
                target_type=ad["target_type"],
                target_id=ad["target_id"],
                due_date=ad["due_date"],
            )
            db.session.add(a)
            db.session.flush()

            # Resolve targets
            if ad["target_type"] == "student":
                targets = [ad["target_id"]]
            elif ad["target_type"] == "section":
                stus = Student.query.filter_by(section=ad["target_id"]).all()
                targets = [s.student_id for s in stus]
            elif ad["target_type"] == "batch":
                stus = Student.query.filter_by(semester=int(ad["target_id"])).all()
                targets = [s.student_id for s in stus]
            else:
                targets = []

            for sid in targets:
                db.session.add(AssignmentTarget(assignment_id=a.id, student_id=sid))

        db.session.commit()
        print(f"[academic-data-service] Seeded {len(demo_assignments)} demo assignments with targets.")

    print(f"[academic-data-service] Demo data seeded: 1 department, {len(faculty_records)} faculty, {len(students_raw)} students across 3 sections.")


def _seed_demo_clubs():
    """Seed demo clubs, student roles, and sample events on first boot."""
    from event_models import Club, StudentRole, Event, EventPhoto
    from datetime import datetime, timedelta
    import json

    if Club.query.count() > 0:
        return  # already seeded

    # ── 3 Demo Clubs ──────────────────────────────────────────────────────────
    clubs_data = [
        {
            "name": "ACM Student Chapter",
            "category": "technical",
            "description": "Association for Computing Machinery student chapter. Organizes hackathons, coding contests, and tech talks.",
            "mentor_faculty_id": "FAC001",
        },
        {
            "name": "Robotics Club",
            "category": "technical",
            "description": "Design, build and program robots. Participates in national robotics competitions and conducts workshops.",
            "mentor_faculty_id": "FAC002",
        },
        {
            "name": "Literary & Debate Club",
            "category": "literary",
            "description": "Fosters public speaking, creative writing, and critical thinking through debates, MUNs, and literary fests.",
            "mentor_faculty_id": "FAC001",
        },
    ]

    created_clubs = []
    for cd in clubs_data:
        club = Club(**cd)
        db.session.add(club)
        db.session.flush()
        created_clubs.append(club)

    # ── Student Role Assignments ──────────────────────────────────────────────
    roles_data = [
        {"student_id": "STU001", "club_id": created_clubs[0].id, "role": "head",    "assigned_by": "U001"},
        {"student_id": "STU004", "club_id": created_clubs[0].id, "role": "council", "assigned_by": "U001"},
        {"student_id": "STU007", "club_id": created_clubs[0].id, "role": "member",  "assigned_by": "U001"},
        {"student_id": "STU036", "club_id": created_clubs[1].id, "role": "head",    "assigned_by": "U001"},
        {"student_id": "STU039", "club_id": created_clubs[1].id, "role": "council", "assigned_by": "U001"},
        {"student_id": "STU069", "club_id": created_clubs[2].id, "role": "head",    "assigned_by": "U001"},
        {"student_id": "STU072", "club_id": created_clubs[2].id, "role": "council", "assigned_by": "U001"},
    ]

    for rd in roles_data:
        sr = StudentRole(**rd)
        db.session.add(sr)

    db.session.flush()

    # ── Sample Events ─────────────────────────────────────────────────────────
    now = datetime.utcnow()
    events_data = [
        {
            "club_id":                 created_clubs[0].id,
            "title":                   "CodeStorm 2026 — 24hr Hackathon",
            "event_type":              "hackathon",
            "description":             "Annual 24-hour hackathon with 50+ teams building solutions for sustainable development goals. Industry mentors from TCS, Infosys, and Zoho.",
            "venue":                   "Main Auditorium & CS Labs",
            "event_date":              datetime(2026, 2, 15, 9, 0),
            "organized_by_student_id": "STU001",
            "submitted_via":           "club_head",
            "attendee_count":          180,
            "guest_names":             json.dumps(["Mr. Ramesh Kumar (TCS)", "Ms. Priya Nair (Infosys)", "Dr. Venkat Raman (Zoho)"]),
            "report_text":             "CodeStorm 2026 was a resounding success with 52 teams participating. The winning team built an AI-powered waste segregation system. Judges praised the quality of submissions.",
            "po_mapping":              "PO1, PO3, PO5, PO9, PO12",
            "resource_person":         "Mr. Ramesh Kumar, Senior Architect, TCS",
            "skill_orientation":       "Problem solving, Teamwork, Innovation, Technical implementation",
            "status":                  "approved",
            "reviewed_by":             "FAC001",
            "reviewed_at":             datetime(2026, 2, 20, 14, 0),
        },
        {
            "club_id":                 created_clubs[0].id,
            "title":                   "Workshop: Cloud-Native Development with Kubernetes",
            "event_type":              "workshop",
            "description":             "Hands-on workshop covering Docker containerization, Kubernetes orchestration, and CI/CD pipelines.",
            "venue":                   "Computer Lab 3",
            "event_date":              datetime(2026, 3, 20, 10, 0),
            "organized_by_student_id": "STU004",
            "submitted_via":           "club_head",
            "attendee_count":          65,
            "guest_names":             json.dumps(["Mr. Anil Mehta (Google Cloud)"]),
            "report_text":             "Intensive 6-hour workshop. Students deployed a multi-container application to GKE. Excellent feedback with 4.7/5 satisfaction rating.",
            "status":                  "pending",
        },
        {
            "club_id":                 created_clubs[1].id,
            "title":                   "RoboWars 2026 — Inter-College Competition",
            "event_type":              "competition",
            "description":             "Battle-bot competition featuring 20 teams from 8 colleges. Categories: lightweight, heavyweight, and autonomous.",
            "venue":                   "Sports Complex",
            "event_date":              datetime(2026, 1, 20, 9, 30),
            "organized_by_student_id": "STU036",
            "submitted_via":           "club_head",
            "attendee_count":          300,
            "guest_names":             json.dumps(["Prof. S. Krishnamurthy (IIT Madras)", "Mr. Dinesh Babu (Fanuc India)"]),
            "report_text":             "Successfully conducted inter-college robotics competition. Our college team won 2nd place in heavyweight category. Event covered by The Hindu and local TV channels.",
            "po_mapping":              "PO1, PO2, PO3, PO4, PO5, PO9",
            "resource_person":         "Prof. S. Krishnamurthy, Dept of Mechanical Engineering, IIT Madras",
            "skill_orientation":       "Engineering design, Embedded systems, Teamwork, Competition spirit",
            "status":                  "approved",
            "reviewed_by":             "FAC002",
            "reviewed_at":             datetime(2026, 1, 25, 16, 0),
        },
        {
            "club_id":                 created_clubs[2].id,
            "title":                   "Inter-Department Debate Championship",
            "event_type":              "competition",
            "description":             "Annual debate championship covering topics on AI ethics, climate policy, and education reform.",
            "venue":                   "Seminar Hall A",
            "event_date":              datetime(2025, 11, 10, 11, 0),
            "organized_by_student_id": "STU069",
            "submitted_via":           "club_head",
            "attendee_count":          120,
            "guest_names":             json.dumps(["Adv. Lakshmi Narayanan (High Court)", "Dr. Padma Subramaniam (JNU)"]),
            "report_text":             "8 departments participated with 3 rounds of elimination. CSE team reached finals. Event enhanced critical thinking and public speaking skills.",
            "status":                  "rejected",
            "reviewed_by":             "FAC001",
            "reviewed_at":             datetime(2025, 11, 15, 15, 0),
            "rejection_reason":        "Report lacks detailed attendance sheet and individual participant feedback. Please resubmit with the signed attendance register scan and participant feedback summary.",
        },
    ]


    for ed in events_data:
        event = Event(**ed)
        db.session.add(event)
    db.session.commit()

    # Seed Event Photos
    created_events = Event.query.all()
    if created_events:
        for idx, (ev, photo_name) in enumerate([
            (created_events[0] if len(created_events) >= 1 else None, "codestorm_hackathon.jpg"),
            (created_events[1] if len(created_events) >= 2 else None, "k8s_workshop.jpg"),
            (created_events[2] if len(created_events) >= 3 else None, "robowars_arena.jpg"),
        ]):
            if ev and not EventPhoto.query.filter_by(event_id=ev.id).first():
                db.session.add(EventPhoto(event_id=ev.id, file_path=photo_name))
        db.session.commit()


    print(f"[academic-data-service] Seeded {len(created_clubs)} demo clubs, {len(roles_data)} student roles, {len(events_data)} sample events.")



def _seed_demo_placements():
    """Seed sample placement data for final-year students (Section C / Semester 7)."""
    from placement_models import StudentPlacement
    from datetime import datetime, timedelta

    if StudentPlacement.query.count() > 0:
        return  # already seeded

    now = datetime.utcnow()
    demo_placements = [
        {
            "student_id": "STU069",
            "status": "placed",
            "company_or_institution": "Microsoft India",
            "role_or_program": "Software Development Engineer (SDE 1)",
            "ctc_or_stipend": "18.5 LPA",
            "offer_letter_path": "demo_offer_msft_stu069.pdf",
            "academic_year": "2025-26",
            "final_year_cohort_year": 2026,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=20),
        },
        {
            "student_id": "STU070",
            "status": "placed",
            "company_or_institution": "Tata Consultancy Services (TCS Digital)",
            "role_or_program": "Digital Innovator / Systems Engineer",
            "ctc_or_stipend": "7.5 LPA",
            "offer_letter_path": "demo_offer_tcs_stu070.pdf",
            "academic_year": "2025-26",
            "final_year_cohort_year": 2026,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=18),
        },
        {
            "student_id": "STU072",
            "status": "higher_studies",
            "company_or_institution": "Carnegie Mellon University",
            "role_or_program": "Master of Science in Computer Science (MS CS)",
            "ctc_or_stipend": "Teaching Assistantship ($2,400/mo)",
            "offer_letter_path": "demo_admit_cmu_stu072.pdf",
            "academic_year": "2025-26",
            "final_year_cohort_year": 2026,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=15),
        },
        {
            "student_id": "STU073",
            "status": "placed",
            "company_or_institution": "Infosys Ltd",
            "role_or_program": "Specialist Programmer",
            "ctc_or_stipend": "9.5 LPA",
            "offer_letter_path": "demo_offer_infosys_stu073.pdf",
            "academic_year": "2025-26",
            "final_year_cohort_year": 2026,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=12),
        },
        {
            "student_id": "STU075",
            "status": "entrepreneur",
            "company_or_institution": "NextGen AI Labs Pvt Ltd",
            "role_or_program": "Founder & CTO (Incubated at Campus AIC)",
            "ctc_or_stipend": "Seed grant: ₹10,00,000",
            "offer_letter_path": "demo_incubator_cert_stu075.pdf",
            "academic_year": "2025-26",
            "final_year_cohort_year": 2026,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=10),
        },
        {
            "student_id": "STU076",
            "status": "placed",
            "company_or_institution": "Amazon Web Services (AWS)",
            "role_or_program": "Cloud Support Associate",
            "ctc_or_stipend": "14.0 LPA",
            "offer_letter_path": "demo_offer_aws_stu076.pdf",
            "academic_year": "2025-26",
            "final_year_cohort_year": 2026,
            "verified_by_admin": False,
        },
        {
            "student_id": "STU078",
            "status": "higher_studies",
            "company_or_institution": "IISc Bangalore",
            "role_or_program": "M.Tech in Artificial Intelligence (GATE AIR 42)",
            "ctc_or_stipend": "MHRD Scholarship (₹12,400/mo)",
            "offer_letter_path": "demo_iisc_admit_stu078.pdf",
            "academic_year": "2025-26",
            "final_year_cohort_year": 2026,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=8),
        },
        {
            "student_id": "STU001",
            "status": "placed",
            "company_or_institution": "Google India",
            "role_or_program": "Software Engineering Intern -> FTE",
            "ctc_or_stipend": "22.0 LPA",
            "offer_letter_path": "demo_offer_google_stu001.pdf",
            "academic_year": "2025-26",
            "final_year_cohort_year": 2026,
            "verified_by_admin": False,
        },
    ]

    # Historical Cohort 2025 (LYG 2024-25) — 24 Verified
    for i in range(1, 21):
        demo_placements.append({
            "student_id": f"ALUM_2025_{i:02d}",
            "status": "placed",
            "company_or_institution": ["Oracle India", "Cisco", "Qualcomm", "Wipro", "TCS", "Accenture", "Zoho"][i % 7],
            "role_or_program": "Associate Software Engineer",
            "ctc_or_stipend": f"{6.5 + (i % 8) * 1.5:.1f} LPA",
            "offer_letter_path": f"hist_offer_2025_{i}.pdf",
            "academic_year": "2024-25",
            "final_year_cohort_year": 2025,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=380),
        })
    for i in range(21, 24):
        demo_placements.append({
            "student_id": f"ALUM_2025_{i:02d}",
            "status": "higher_studies",
            "company_or_institution": ["University of Texas at Dallas", "TU Munich", "IIT Bombay"][i - 21],
            "role_or_program": "MS in Data Science / Informatics",
            "ctc_or_stipend": "Graduate Assistantship",
            "offer_letter_path": f"hist_admit_2025_{i}.pdf",
            "academic_year": "2024-25",
            "final_year_cohort_year": 2025,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=375),
        })
    demo_placements.append({
        "student_id": "ALUM_2025_24",
        "status": "entrepreneur",
        "company_or_institution": "Kavach CyberSec Solutions",
        "role_or_program": "Co-founder & Security Lead",
        "ctc_or_stipend": "Bootstrapped Revenue",
        "offer_letter_path": "hist_cert_2025_24.pdf",
        "academic_year": "2024-25",
        "final_year_cohort_year": 2025,
        "verified_by_admin": True,
        "verified_by": "U001",
        "verified_at": now - timedelta(days=370),
    })

    # Historical Cohort 2024 (LYGm1 2023-24) — 26 Verified
    for i in range(1, 23):
        demo_placements.append({
            "student_id": f"ALUM_2024_{i:02d}",
            "status": "placed",
            "company_or_institution": ["Capgemini", "Cognizant", "Dell Technologies", "IBM", "Intel", "SAP Labs"][i % 6],
            "role_or_program": "Graduate Trainee / Systems Engineer",
            "ctc_or_stipend": f"{7.0 + (i % 7) * 1.2:.1f} LPA",
            "offer_letter_path": f"hist_offer_2024_{i}.pdf",
            "academic_year": "2023-24",
            "final_year_cohort_year": 2024,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=740),
        })
    for i in range(23, 26):
        demo_placements.append({
            "student_id": f"ALUM_2024_{i:02d}",
            "status": "higher_studies",
            "company_or_institution": ["NYU Tandon", "Northeastern University", "IIT Delhi"][i - 23],
            "role_or_program": "MS in Cybersecurity / CS",
            "ctc_or_stipend": "Fellowship",
            "offer_letter_path": f"hist_admit_2024_{i}.pdf",
            "academic_year": "2023-24",
            "final_year_cohort_year": 2024,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=730),
        })
    demo_placements.append({
        "student_id": "ALUM_2024_26",
        "status": "entrepreneur",
        "company_or_institution": "Edutech VR Lab",
        "role_or_program": "Founder",
        "ctc_or_stipend": "Seed Capital",
        "offer_letter_path": "hist_cert_2024_26.pdf",
        "academic_year": "2023-24",
        "final_year_cohort_year": 2024,
        "verified_by_admin": True,
        "verified_by": "U001",
        "verified_at": now - timedelta(days=725),
    })

    # Historical Cohort 2023 (LYGm2 2022-23) — 25 Verified
    for i in range(1, 22):
        demo_placements.append({
            "student_id": f"ALUM_2023_{i:02d}",
            "status": "placed",
            "company_or_institution": ["Mindtree", "LTI", "Hexaware", "TCS", "Accenture", "Infosys"][i % 6],
            "role_or_program": "Software Engineer",
            "ctc_or_stipend": f"{6.0 + (i % 6) * 1.0:.1f} LPA",
            "offer_letter_path": f"hist_offer_2023_{i}.pdf",
            "academic_year": "2022-23",
            "final_year_cohort_year": 2023,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=1100),
        })
    for i in range(22, 25):
        demo_placements.append({
            "student_id": f"ALUM_2023_{i:02d}",
            "status": "higher_studies",
            "company_or_institution": ["Arizona State University", "IIT Madras", "BITS Pilani"][i - 22],
            "role_or_program": "M.Tech / MS in Software Engineering",
            "ctc_or_stipend": "Research Assistantship",
            "offer_letter_path": f"hist_admit_2023_{i}.pdf",
            "academic_year": "2022-23",
            "final_year_cohort_year": 2023,
            "verified_by_admin": True,
            "verified_by": "U001",
            "verified_at": now - timedelta(days=1090),
        })
    demo_placements.append({
        "student_id": "ALUM_2023_25",
        "status": "entrepreneur",
        "company_or_institution": "AgriTech Drone AI",
        "role_or_program": "Founder & CEO",
        "ctc_or_stipend": "Govt Startup Grant",
        "offer_letter_path": "hist_cert_2023_25.pdf",
        "academic_year": "2022-23",
        "final_year_cohort_year": 2023,
        "verified_by_admin": True,
        "verified_by": "U001",
        "verified_at": now - timedelta(days=1085),
    })

    for pd in demo_placements:
        sp = StudentPlacement(**pd)
        db.session.add(sp)

    db.session.commit()
    print(f"[academic-data-service] Seeded {len(demo_placements)} demo student placement records across 4 cohorts.")


def _seed_demo_achievements():
    """Seed sample external student achievements for NBA Criterion 4 (Section 4.6.3)."""
    from achievement_models import StudentAchievement

    from datetime import date, datetime, timedelta

    if StudentAchievement.query.count() > 0:
        return

    now = datetime.utcnow()
    demo_achievements = [
        {
            "student_id": "STU069",
            "student_ids": ["STU069", "STU070", "STU073"],
            "activity_type": "technical",
            "event_name": "Smart India Hackathon (SIH 2025)",
            "organizing_body": "Ministry of Education & AICTE, Govt. of India",
            "event_scope": "national",
            "event_date": date(2025, 11, 22),
            "academic_year": "2025-26",
            "venue": "IIT Roorkee Nodal Center, Uttarakhand",
            "result_description": "1st Prize & ₹1,00,000 Cash Award in AI/Healthcare Category",
            "remarks": "Developed automated diabetic retinopathy screening model using edge AI.",
            "proof_file_path": "sih_2025_winner_cert.pdf",
            "photo_paths": ["sih_2025_team_photo.jpg", "sih_2025_award_ceremony.jpg"],
            "submitted_via": "student",
            "submitted_by": "STU069",
            "verification_status": "verified",
            "verified_by": "FAC001",
            "verified_at": now - timedelta(days=40),
        },
        {
            "student_id": "STU072",
            "student_ids": ["STU072"],
            "activity_type": "sports",
            "event_name": "VTU 24th Inter-Collegiate State Athletics Meet",
            "organizing_body": "Visvesvaraya Technological University (VTU)",
            "event_scope": "within_state",
            "event_date": date(2025, 10, 15),
            "academic_year": "2025-26",
            "venue": "Kanteerava Stadium, Bengaluru",
            "result_description": "Gold Medal in 100m Sprint (Timing: 10.84s)",
            "remarks": "Qualified for All India Inter-University Nationals.",
            "proof_file_path": "vtu_athletics_gold_cert.pdf",
            "photo_paths": ["athletics_100m_podium.jpg"],
            "submitted_via": "student",
            "submitted_by": "STU072",
            "verification_status": "verified",
            "verified_by": "FAC002",
            "verified_at": now - timedelta(days=60),
        },
        {
            "student_id": "STU001",
            "student_ids": ["STU001", "STU075"],
            "activity_type": "technical",
            "event_name": "RoboSub International Challenge — Techfest 2025",
            "organizing_body": "IIT Bombay",
            "event_scope": "national",
            "event_date": date(2025, 12, 28),
            "academic_year": "2025-26",
            "venue": "IIT Bombay Campus, Powai, Mumbai",
            "result_description": "2nd Runner Up & Trophy in Autonomous Underwater Vehicle Track",
            "remarks": "Autonomous sonar navigation and optical target acquisition.",
            "proof_file_path": "techfest_robosub_cert.pdf",
            "photo_paths": ["robosub_team_trophy.jpg", "robosub_pool_test.jpg"],
            "submitted_via": "student",
            "submitted_by": "STU001",
            "verification_status": "verified",
            "verified_by": "FAC001",
            "verified_at": now - timedelta(days=25),
        },
        {
            "student_id": "STU078",
            "student_ids": ["STU078"],
            "activity_type": "cultural",
            "event_name": "National Youth Cultural Festival (Yuva Utsav 2025)",
            "organizing_body": "Association of Indian Universities (AIU)",
            "event_scope": "national",
            "event_date": date(2025, 9, 18),
            "academic_year": "2025-26",
            "venue": "Banaras Hindu University (BHU), Varanasi",
            "result_description": "1st Prize in Solo Classical Carnatic Vocal",
            "remarks": "Scored 98/100 by national jury.",
            "proof_file_path": "yuva_utsav_vocal_cert.pdf",
            "photo_paths": ["yuva_utsav_stage_photo.jpg"],
            "submitted_via": "worker",
            "submitted_by": "WORKER_DATA_ENTRY",
            "verification_status": "verified",
            "verified_by": "FAC003",
            "verified_at": now - timedelta(days=90),
        },
        {
            "student_id": "STU069",
            "student_ids": ["STU069", "STU076"],
            "activity_type": "technical",
            "event_name": "ACM-ICPC Asia-Amritapuri Regional Contest 2024",
            "organizing_body": "International Collegiate Programming Contest (ICPC)",
            "event_scope": "outside_state",
            "event_date": date(2024, 12, 14),
            "academic_year": "2024-25",
            "venue": "Amrita Vishwa Vidyapeetham, Kollam, Kerala",
            "result_description": "Rank 14 / 120 Teams & Honorable Mention Award",
            "remarks": "Solved 7 out of 11 algorithmic problems within 5 hours.",
            "proof_file_path": "icpc_regional_2024_cert.pdf",
            "photo_paths": ["icpc_team_hall.jpg"],
            "submitted_via": "student",
            "submitted_by": "STU069",
            "verification_status": "verified",
            "verified_by": "FAC001",
            "verified_at": now - timedelta(days=320),
        },
        {
            "student_id": "STU002",
            "student_ids": ["STU002"],
            "activity_type": "sports",
            "event_name": "South Zone Inter-University Badminton Championship 2024",
            "organizing_body": "SRM Institute of Science and Technology",
            "event_scope": "outside_state",
            "event_date": date(2024, 11, 5),
            "academic_year": "2024-25",
            "venue": "Chennai, Tamil Nadu",
            "result_description": "Silver Medal (Men's Singles Runner-Up)",
            "remarks": "Represented VTU university team.",
            "proof_file_path": "southzone_badminton_silver.pdf",
            "photo_paths": ["badminton_podium_silver.jpg"],
            "submitted_via": "admin",
            "submitted_by": "ADMIN_SPORTS_DEPT",
            "verification_status": "verified",
            "verified_by": "FAC002",
            "verified_at": now - timedelta(days=340),
        },
        {
            "student_id": "STU075",
            "student_ids": ["STU075", "STU076"],
            "activity_type": "technical",
            "event_name": "Kavach National Cybersecurity Hackathon 2026",
            "organizing_body": "MoE Innovation Cell & Bureau of Police Research (BPR&D)",
            "event_scope": "national",
            "event_date": date(2026, 2, 10),
            "academic_year": "2025-26",
            "venue": "IIT Delhi, New Delhi",
            "result_description": "Top 5 Finalist & ₹25,000 Consolation Prize",
            "remarks": "Dark web threat intelligence scraper and visualizer.",
            "proof_file_path": "kavach_hackathon_finalist.pdf",
            "photo_paths": ["kavach_presentation_booth.jpg"],
            "submitted_via": "student",
            "submitted_by": "STU075",
            "verification_status": "pending",
        },
        {
            "student_id": "STU073",
            "student_ids": ["STU073"],
            "activity_type": "cultural",
            "event_name": "State Youth Parliament Festival 2026",
            "organizing_body": "Ministry of Youth Affairs & Sports, Regional Directorate",
            "event_scope": "within_state",
            "event_date": date(2026, 1, 20),
            "academic_year": "2025-26",
            "venue": "Vidhana Soudha Banquet Hall, Bengaluru",
            "result_description": "Best Delegate Award & State Level Commendation",
            "remarks": "Spoke on National Education Policy and Digital Inclusion.",
            "proof_file_path": "youth_parliament_best_delegate.pdf",
            "photo_paths": ["parliament_speech_stage.jpg"],
            "submitted_via": "student",
            "submitted_by": "STU073",
            "verification_status": "pending",
        },
    ]

    for ad in demo_achievements:
        ach = StudentAchievement(**ad)
        db.session.add(ach)

    db.session.commit()
    print(f"[academic-data-service] Seeded {len(demo_achievements)} demo student achievement records.")


def _seed_demo_historical_data():
    """Seed verified historical Criterion 4 data (Admission, Batch Progression, Academic Performance) and pending queue items."""
    from historical_models import AdmissionRecord, AcademicBatch, BatchYearProgress, AcademicPerformanceRecord

    # 1. Seed Admission Records (Table 4.1)
    if AdmissionRecord.query.count() == 0:
        demo_admissions = [
            # Verified records
            {"academic_year": "2025-26", "department": "CSE", "sanctioned_intake": 180, "first_year_admitted_net_migration": 175, "lateral_entry_admitted": 18, "separate_division_admitted": 0, "total_admitted": 193, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified", "verified_by": "U_ADM001", "verified_at": datetime.utcnow()},
            {"academic_year": "2024-25", "department": "CSE", "sanctioned_intake": 180, "first_year_admitted_net_migration": 172, "lateral_entry_admitted": 18, "separate_division_admitted": 0, "total_admitted": 190, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified", "verified_by": "U_ADM001", "verified_at": datetime.utcnow()},
            {"academic_year": "2023-24", "department": "CSE", "sanctioned_intake": 120, "first_year_admitted_net_migration": 118, "lateral_entry_admitted": 12, "separate_division_admitted": 0, "total_admitted": 130, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified", "verified_by": "U_ADM001", "verified_at": datetime.utcnow()},
            {"academic_year": "2022-23", "department": "CSE", "sanctioned_intake": 120, "first_year_admitted_net_migration": 115, "lateral_entry_admitted": 12, "separate_division_admitted": 0, "total_admitted": 127, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified", "verified_by": "U_ADM001", "verified_at": datetime.utcnow()},
            # Pending Worker submission for verification queue
            {"academic_year": "2026-27", "department": "CSE", "sanctioned_intake": 180, "first_year_admitted_net_migration": 178, "lateral_entry_admitted": 18, "separate_division_admitted": 0, "total_admitted": 196, "uploaded_by": "U_WRK001", "submitted_via": "worker", "verification_status": "pending"},
        ]
        for item in demo_admissions:
            db.session.add(AdmissionRecord(**item))
        db.session.commit()
        print(f"[academic-data-service] Seeded {len(demo_admissions)} demo admission records.")

    # 2. Seed Academic Batches & Progression (Table 4.2)
    if AcademicBatch.query.count() == 0:
        batches_data = [
            {
                "year_of_entry": "2021-22", "department": "CSE", "total_admitted": 190,
                "progress": [
                    {"year_of_study": "I",   "students_without_backlog": 165, "students_total_passed": 185, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "II",  "students_without_backlog": 158, "students_total_passed": 182, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "III", "students_without_backlog": 152, "students_total_passed": 180, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "IV",  "students_without_backlog": 148, "students_total_passed": 178, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                ]
            },
            {
                "year_of_entry": "2020-21", "department": "CSE", "total_admitted": 190,
                "progress": [
                    {"year_of_study": "I",   "students_without_backlog": 162, "students_total_passed": 184, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "II",  "students_without_backlog": 154, "students_total_passed": 180, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "III", "students_without_backlog": 150, "students_total_passed": 178, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "IV",  "students_without_backlog": 145, "students_total_passed": 176, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                ]
            },
            {
                "year_of_entry": "2019-20", "department": "CSE", "total_admitted": 130,
                "progress": [
                    {"year_of_study": "I",   "students_without_backlog": 110, "students_total_passed": 125, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "II",  "students_without_backlog": 105, "students_total_passed": 122, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "III", "students_without_backlog": 102, "students_total_passed": 120, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "IV",  "students_without_backlog": 98,  "students_total_passed": 118, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                ]
            },
            {
                "year_of_entry": "2022-23", "department": "CSE", "total_admitted": 190,
                "progress": [
                    {"year_of_study": "I",   "students_without_backlog": 168, "students_total_passed": 186, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "II",  "students_without_backlog": 160, "students_total_passed": 184, "verification_status": "verified", "submitted_via": "admin", "uploaded_by": "U_ADM001"},
                    {"year_of_study": "III", "students_without_backlog": 155, "students_total_passed": 181, "verification_status": "pending",  "submitted_via": "worker", "uploaded_by": "U_WRK001"},
                ]
            },
        ]

        for bdata in batches_data:
            progs = bdata.pop("progress")
            batch = AcademicBatch(**bdata)
            db.session.add(batch)
            db.session.flush()
            for p in progs:
                db.session.add(BatchYearProgress(batch_id=batch.id, **p))
        db.session.commit()
        print(f"[academic-data-service] Seeded {len(batches_data)} academic batches with progression records.")

    # 3. Seed Academic Performance (API) Records (Table 4.3/4.4)
    if AcademicPerformanceRecord.query.count() == 0:
        demo_perf = [
            {"academic_year": "2024-25", "year_of_study": "II",  "department": "CSE", "mean_cgpa_or_percentage": 7.85, "successful_students_count": 180, "appeared_students_count": 185, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified"},
            {"academic_year": "2024-25", "year_of_study": "III", "department": "CSE", "mean_cgpa_or_percentage": 8.12, "successful_students_count": 176, "appeared_students_count": 180, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified"},
            {"academic_year": "2023-24", "year_of_study": "II",  "department": "CSE", "mean_cgpa_or_percentage": 7.62, "successful_students_count": 174, "appeared_students_count": 180, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified"},
            {"academic_year": "2023-24", "year_of_study": "III", "department": "CSE", "mean_cgpa_or_percentage": 7.95, "successful_students_count": 170, "appeared_students_count": 175, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified"},
            {"academic_year": "2022-23", "year_of_study": "II",  "department": "CSE", "mean_cgpa_or_percentage": 7.50, "successful_students_count": 115, "appeared_students_count": 120, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified"},
            {"academic_year": "2022-23", "year_of_study": "III", "department": "CSE", "mean_cgpa_or_percentage": 7.80, "successful_students_count": 112, "appeared_students_count": 118, "uploaded_by": "U_ADM001", "submitted_via": "admin", "verification_status": "verified"},
            # Pending Worker submission for verification queue
            {"academic_year": "2025-26", "year_of_study": "II",  "department": "CSE", "mean_cgpa_or_percentage": 7.92, "successful_students_count": 185, "appeared_students_count": 190, "uploaded_by": "U_WRK001", "submitted_via": "worker", "verification_status": "pending"},
        ]
        for item in demo_perf:
            db.session.add(AcademicPerformanceRecord(**item))
        db.session.commit()
        print(f"[academic-data-service] Seeded {len(demo_perf)} academic performance records.")


if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8002))
    app = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")



