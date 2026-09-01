"""
Academic Data Service — AcademiQ
Handles: students, faculty, departments CRUD + analytics.
"""

import os
from flask import Flask
from flask_cors import CORS
from models import db
from routes.students    import students_bp
from routes.faculty     import faculty_bp
from routes.departments import departments_bp
from routes.assignments import assignments_bp


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

    app.register_blueprint(students_bp,    url_prefix="/students")
    app.register_blueprint(faculty_bp,     url_prefix="/faculty")
    app.register_blueprint(departments_bp, url_prefix="/departments")
    app.register_blueprint(assignments_bp, url_prefix="/assignments")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "academic-data-service"}

    with app.app_context():
        db.create_all()
        _seed_demo_data()

    return app


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



if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8002))
    app = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")

