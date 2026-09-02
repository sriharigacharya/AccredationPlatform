from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Department(db.Model):
    __tablename__ = "departments"

    id      = db.Column(db.Integer, primary_key=True)
    code    = db.Column(db.String(20), unique=True, nullable=False)
    name    = db.Column(db.String(200), nullable=False)
    vision  = db.Column(db.Text)
    mission = db.Column(db.Text)
    peos    = db.Column(db.Text)  # JSON array string
    pos     = db.Column(db.Text)  # JSON array string
    cos     = db.Column(db.Text)  # JSON array string
    placement_stats    = db.Column(db.Text)
    research_stats     = db.Column(db.Text)
    infrastructure     = db.Column(db.Text)
    academic_activities= db.Column(db.Text)
    training_programmes= db.Column(db.Text)
    clubs              = db.Column(db.Text)
    awards             = db.Column(db.Text)
    industry_interaction = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    students = db.relationship("Student", backref="department", lazy=True)
    faculty  = db.relationship("Faculty",  backref="department", lazy=True)

    def to_dict(self):
        import json
        def safe_json(val):
            if val is None:
                return []
            try:
                return json.loads(val)
            except Exception:
                return val

        return {
            "id":      self.id,
            "code":    self.code,
            "name":    self.name,
            "vision":  self.vision,
            "mission": self.mission,
            "peos":    safe_json(self.peos),
            "pos":     safe_json(self.pos),
            "cos":     safe_json(self.cos),
            "placement_stats":    safe_json(self.placement_stats),
            "research_stats":     safe_json(self.research_stats),
            "infrastructure":     safe_json(self.infrastructure),
            "academic_activities":safe_json(self.academic_activities),
            "training_programmes":safe_json(self.training_programmes),
            "clubs":              safe_json(self.clubs),
            "awards":             safe_json(self.awards),
            "industry_interaction": safe_json(self.industry_interaction),
            "created_at": self.created_at.isoformat(),
        }


class Student(db.Model):
    __tablename__ = "students"

    id           = db.Column(db.Integer, primary_key=True)
    student_id   = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name         = db.Column(db.String(200), nullable=False)
    email        = db.Column(db.String(255))
    phone        = db.Column(db.String(20))
    department_id= db.Column(db.Integer, db.ForeignKey("departments.id"))

    # Academic metrics (kept for backward compat with prediction service)
    semester             = db.Column(db.Integer, default=1)
    section              = db.Column(db.String(10), default="A")   # class section: A / B / C
    attendance_pct       = db.Column(db.Float, default=0.0)
    internal_marks       = db.Column(db.Float, default=0.0)
    assignment_score_pct = db.Column(db.Float, default=0.0)
    previous_gpa         = db.Column(db.Float, default=0.0)
    backlogs             = db.Column(db.Integer, default=0)
    course_performance_pct = db.Column(db.Float, default=0.0)
    engagement           = db.Column(db.String(20), default="Medium")
    final_result         = db.Column(db.String(20))

    # NEW: Per-course evaluation breakdown (JSON array of dicts)
    # Each entry: { "code": "CS3C01", "name": "Data Structures",
    #   "cie1": 18, "cie2": 20, "quiz1": 7, "quiz2": 8, "el": 24,
    #   "see": 72, "attendance_pct": 88, "credits": 4 }
    courses_data         = db.Column(db.Text)   # JSON array

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Grade helpers ─────────────────────────────────────────────────
    # College evaluation:
    #   CIE raw = CIE1(/25) + CIE2(/25) + Quiz1(/10) + Quiz2(/10) + EL(/30) = 100
    #   CIE reduced = raw × 50/100 = 50
    #   SEE raw = /100, reduced = raw × 50/100 = 50
    #   Grand total = CIE_reduced + SEE_reduced = /100

    GRADE_TABLE = [
        (90, "S", 10), (80, "A", 9), (70, "B", 8),
        (60, "C", 7),  (55, "D", 6), (50, "E", 5),
        (0,  "F", 0),
    ]

    @staticmethod
    def get_default_courses_for_semester(semester=3, section="A"):
        """Returns standard department curriculum courses for a semester/section."""
        sem = int(semester or 3)
        if sem == 3:
            return [
                {"code": "CS3C01", "name": "Data Structures & Algorithms", "credits": 4, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": "CS3C02", "name": "Digital Logic & Computer Design", "credits": 4, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": "CS3C03", "name": "Discrete Mathematical Structures", "credits": 3, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": "CS3L01", "name": "Data Structures & OOP Lab", "credits": 1.5, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
            ]
        elif sem == 5:
            return [
                {"code": "CS5C01", "name": "Database Management Systems", "credits": 4, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": "CS5C02", "name": "Operating Systems", "credits": 4, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": "CS5C03", "name": "Computer Networks", "credits": 4, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": "CS5L01", "name": "DBMS & OS Laboratory", "credits": 1.5, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
            ]
        elif sem == 7:
            return [
                {"code": "CS7C01", "name": "Machine Learning", "credits": 4, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": "CS7C02", "name": "Information & Network Security", "credits": 4, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": "CS7C03", "name": "Cloud Computing", "credits": 3, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": "CS7P01", "name": "Major Project Phase-1", "credits": 3, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
            ]
        else:
            return [
                {"code": f"CS{sem}C01", "name": f"Core Computer Science - {sem}.1", "credits": 4, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": f"CS{sem}C02", "name": f"Core Computer Science - {sem}.2", "credits": 4, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
                {"code": f"CS{sem}L01", "name": f"Computer Science Laboratory - {sem}", "credits": 1.5, "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None, "attendance_pct": 100.0},
            ]

    @staticmethod
    def compute_course_grade(course):
        """Compute CIE total, SEE total, grand total, grade, and grade points for one course dict."""
        cie1  = course.get("cie1")
        cie2  = course.get("cie2")
        quiz1 = course.get("quiz1")
        quiz2 = course.get("quiz2")
        el    = course.get("el")
        see   = course.get("see")

        conducted_cie = [val for val in (cie1, cie2, quiz1, quiz2, el) if val is not None]
        has_cie = len(conducted_cie) > 0
        has_see = see is not None

        if not has_cie and not has_see:
            return {
                "cie_raw": None,
                "cie_reduced": None,
                "see_raw": None,
                "see_reduced": None,
                "total": None,
                "grade": "Pending",
                "grade_points": None,
                "status": "pending",
            }

        cie_raw = sum(conducted_cie) if has_cie else 0.0
        cie_reduced = round(cie_raw * 50 / 100, 1)

        if has_see:
            see_reduced = round(float(see) * 50 / 100, 1)
            total = round(cie_reduced + see_reduced, 1)
            grade, gp = "F", 0
            for threshold, g, points in Student.GRADE_TABLE:
                if total >= threshold:
                    grade, gp = g, points
                    break
            return {
                "cie_raw": cie_raw,
                "cie_reduced": cie_reduced,
                "see_raw": see,
                "see_reduced": see_reduced,
                "total": total,
                "grade": grade,
                "grade_points": gp,
                "status": "completed",
            }
        else:
            # Continuous internal evaluation in progress (SEE pending)
            # Grade points (GP) and final semester grades are only awarded after SEE!
            max_conducted = 0.0
            if cie1 is not None: max_conducted += 25.0
            if cie2 is not None: max_conducted += 25.0
            if quiz1 is not None: max_conducted += 10.0
            if quiz2 is not None: max_conducted += 10.0
            if el is not None: max_conducted += 30.0

            pct = round((cie_raw / max_conducted * 100.0), 1) if max_conducted > 0 else 0.0

            return {
                "cie_raw": cie_raw,
                "cie_reduced": cie_reduced,
                "see_raw": None,
                "see_reduced": None,
                "total": cie_reduced,
                "grade": f"CIE ({pct}%)",
                "grade_points": None,
                "status": "in_progress",
            }

    def get_courses(self):
        """Parse courses_data JSON and attach computed grades."""
        import json
        if not self.courses_data:
            self.courses_data = json.dumps(self.get_default_courses_for_semester(self.semester, self.section))
        try:
            courses = json.loads(self.courses_data)
        except Exception:
            courses = self.get_default_courses_for_semester(self.semester, self.section)
            self.courses_data = json.dumps(courses)

        for c in courses:
            c.update(self.compute_course_grade(c))
        return courses

    def compute_sgpa(self):
        """
        Compute official SGPA strictly from completed courses (CIE + SEE).
        Returns None while semester evaluations are in progress.
        """
        courses = self.get_courses()
        if not courses:
            return None

        # SGPA is only finalized when all semester courses have completed SEE
        has_any_in_progress = any(c.get("status") == "in_progress" or c.get("status") == "pending" for c in courses)
        if has_any_in_progress:
            return None

        total_credits = 0
        weighted_sum = 0
        for c in courses:
            gp = c.get("grade_points")
            if gp is not None:
                cr = c.get("credits", 4)
                total_credits += cr
                weighted_sum += gp * cr

        if total_credits == 0:
            return None

        return round(weighted_sum / total_credits, 2)


    def update_course_marks(self, course_code, exam_type, score):
        """Update a specific exam score (cie1, cie2, quiz1, quiz2, el, see) for a course."""
        import json
        if not self.courses_data:
            self.courses_data = json.dumps(self.get_default_courses_for_semester(self.semester, self.section))
        try:
            courses = json.loads(self.courses_data)
        except Exception:
            courses = self.get_default_courses_for_semester(self.semester, self.section)

        updated_course = None
        for c in courses:
            if c.get("code") == course_code:
                c[exam_type] = float(score) if score is not None else None
                c.update(self.compute_course_grade(c))
                updated_course = c
                break

        if not updated_course:
            new_c = {
                "code": course_code,
                "name": course_code,
                "credits": 4,
                "cie1": None, "cie2": None, "quiz1": None, "quiz2": None, "el": None, "see": None,
                "attendance_pct": self.attendance_pct or 100.0,
            }
            new_c[exam_type] = float(score) if score is not None else None
            new_c.update(self.compute_course_grade(new_c))
            courses.append(new_c)
            updated_course = new_c

        self.courses_data = json.dumps(courses)

        # Recalculate average internal marks across courses where CIE exists
        cie_list = [c.get("cie_raw") for c in courses if c.get("cie_raw") is not None]
        if cie_list:
            self.internal_marks = round(sum(cie_list) / len(cie_list), 1)

        # Recompute SGPA and update course_performance_pct
        new_sgpa = self.compute_sgpa()
        if new_sgpa is not None and new_sgpa > 0:
            self.course_performance_pct = round(new_sgpa * 10, 1)

        return updated_course


    def update_course_attendance(self, course_code, attendance_pct):
        """Update attendance percentage for a specific course and recompute overall attendance."""
        import json
        if not self.courses_data:
            return None
        try:
            courses = json.loads(self.courses_data)
        except Exception:
            return None

        found = False
        for c in courses:
            if c.get("code") == course_code:
                c["attendance_pct"] = round(float(attendance_pct), 1)
                found = True
                break

        if found:
            self.courses_data = json.dumps(courses)
            att_list = [c.get("attendance_pct", 0.0) for c in courses if "attendance_pct" in c]
            if att_list:
                self.attendance_pct = round(sum(att_list) / len(att_list), 1)

        return self.attendance_pct

    def get_course_risk_status(self, course_code):
        """Evaluate academic & attendance risk specifically for this course."""
        courses = self.get_courses()
        target = next((c for c in courses if c.get("code") == course_code), None)
        reasons = []
        severity = "low"

        if target:
            c_att = target.get("attendance_pct", 100.0)
            if c_att < 60.0:
                reasons.append(f"Critical Attendance Shortage: {c_att:.1f}% (<60%)")
                severity = "high"
            elif c_att < 75.0:
                reasons.append(f"Attendance Shortage: {c_att:.1f}% (<75%)")
                if severity != "high":
                    severity = "medium"

            cie1 = target.get("cie1")
            if cie1 is not None and cie1 < 12.0:
                reasons.append(f"Low CIE 1: {cie1}/25 (Failed threshold)")
                severity = "high"

            cie2 = target.get("cie2")
            if cie2 is not None and cie2 < 12.0:
                reasons.append(f"Low CIE 2: {cie2}/25 (Failed threshold)")
                severity = "high"

            cie_raw = target.get("cie_raw")
            if cie_raw is not None and target.get("status") == "completed" and cie_raw < 40:
                reasons.append(f"CIE Internal Total Low: {cie_raw}/100")
                severity = "high"


        if self.backlogs > 0:
            reasons.append(f"Student has {self.backlogs} standing backlogs")

        return {
            "is_at_risk": len(reasons) > 0,
            "severity": severity,
            "reasons": reasons,
        }

    def to_dict(self, include_dept=False):
        courses = self.get_courses()
        sgpa = self.compute_sgpa()

        d = {
            "id":                    self.id,
            "student_id":            self.student_id,
            "name":                  self.name,
            "email":                 self.email,
            "phone":                 self.phone,
            "department_id":         self.department_id,
            "semester":              self.semester,
            "section":               self.section,
            "attendance_pct":        self.attendance_pct,
            "internal_marks":        self.internal_marks,
            "assignment_score_pct":  self.assignment_score_pct,
            "previous_gpa":          self.previous_gpa,
            "cgpa":                  self.previous_gpa,
            "backlogs":              self.backlogs,

            "course_performance_pct":self.course_performance_pct,
            "engagement":            self.engagement,
            "final_result":          self.final_result,
            "courses":               courses,
            "sgpa":                  sgpa,
            "created_at":            self.created_at.isoformat(),
        }
        if include_dept and self.department:
            d["department"] = {"code": self.department.code, "name": self.department.name}
        return d



class Faculty(db.Model):
    __tablename__ = "faculty"

    id           = db.Column(db.Integer, primary_key=True)
    faculty_id   = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name         = db.Column(db.String(200), nullable=False)
    email        = db.Column(db.String(255))
    phone        = db.Column(db.String(20))
    department_id= db.Column(db.Integer, db.ForeignKey("departments.id"))

    designation  = db.Column(db.String(100))
    qualification= db.Column(db.String(200))
    experience   = db.Column(db.String(100))

    # Stored as JSON strings
    courses_taught   = db.Column(db.Text)  # JSON list
    publications     = db.Column(db.Text)  # JSON list
    fdp_participation= db.Column(db.Text)  # JSON list
    certifications   = db.Column(db.Text)  # JSON list
    research_projects= db.Column(db.Text)  # JSON list
    awards           = db.Column(db.Text)  # JSON list

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        import json
        def safe_json(val):
            if val is None:
                return []
            try:
                return json.loads(val)
            except Exception:
                return val

        return {
            "id":             self.id,
            "faculty_id":     self.faculty_id,
            "name":           self.name,
            "email":          self.email,
            "phone":          self.phone,
            "department_id":  self.department_id,
            "designation":    self.designation,
            "qualification":  self.qualification,
            "experience":     self.experience,
            "courses_taught":    safe_json(self.courses_taught),
            "publications":      safe_json(self.publications),
            "fdp_participation": safe_json(self.fdp_participation),
            "certifications":    safe_json(self.certifications),
            "research_projects": safe_json(self.research_projects),
            "awards":            safe_json(self.awards),
            "created_at":        self.created_at.isoformat(),
        }


class Assignment(db.Model):
    __tablename__ = "assignments"

    id           = db.Column(db.Integer, primary_key=True)
    type         = db.Column(db.String(20), nullable=False, default="homework")  # homework | project
    title        = db.Column(db.String(300), nullable=False)
    description  = db.Column(db.Text)
    faculty_id   = db.Column(db.String(50), nullable=False, index=True)  # FAC001, etc.
    target_type  = db.Column(db.String(20), nullable=False)  # student | section | batch
    target_id    = db.Column(db.String(50), nullable=False)  # STU001 | A | 2025 (batch year)
    due_date     = db.Column(db.DateTime)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    targets = db.relationship("AssignmentTarget", backref="assignment",
                              lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_targets=False):
        d = {
            "id":          self.id,
            "type":        self.type,
            "title":       self.title,
            "description": self.description,
            "faculty_id":  self.faculty_id,
            "target_type": self.target_type,
            "target_id":   self.target_id,
            "due_date":    self.due_date.isoformat() if self.due_date else None,
            "created_at":  self.created_at.isoformat(),
            "student_count": len(self.targets),
        }
        if include_targets:
            d["students"] = [t.student_id for t in self.targets]
        return d


class AssignmentTarget(db.Model):
    __tablename__ = "assignment_targets"

    id            = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id", ondelete="CASCADE"),
                              nullable=False, index=True)
    student_id    = db.Column(db.String(50), nullable=False, index=True)

    def to_dict(self):
        return {
            "id":            self.id,
            "assignment_id": self.assignment_id,
            "student_id":    self.student_id,
        }


class ClassAttendanceSession(db.Model):
    __tablename__ = "class_attendance_sessions"

    id             = db.Column(db.Integer, primary_key=True)
    faculty_id     = db.Column(db.String(50), nullable=False, index=True)
    course_code    = db.Column(db.String(50), nullable=False, index=True)
    course_name    = db.Column(db.String(200))
    section        = db.Column(db.String(10), nullable=False)
    session_date   = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    time_slot      = db.Column(db.String(50))
    total_students = db.Column(db.Integer, default=0)
    present_count  = db.Column(db.Integer, default=0)
    absent_count   = db.Column(db.Integer, default=0)
    is_edited      = db.Column(db.Boolean, default=False)
    change_comment = db.Column(db.Text)
    edited_at      = db.Column(db.DateTime)
    edited_by      = db.Column(db.String(50))
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    entries = db.relationship("ClassAttendanceEntry", backref="session",
                              lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_entries=False):
        d = {
            "id":             self.id,
            "faculty_id":     self.faculty_id,
            "course_code":    self.course_code,
            "course_name":    self.course_name,
            "section":        self.section,
            "session_date":   self.session_date.isoformat() if self.session_date else None,
            "time_slot":      self.time_slot,
            "total_students": self.total_students,
            "present_count":  self.present_count,
            "absent_count":   self.absent_count,
            "is_edited":      bool(self.is_edited),
            "change_comment": self.change_comment,
            "edited_at":      self.edited_at.isoformat() if self.edited_at else None,
            "edited_by":      self.edited_by,
            "created_at":     self.created_at.isoformat(),
        }
        if include_entries:
            d["entries"] = [e.to_dict() for e in self.entries]
        return d



class ClassAttendanceEntry(db.Model):
    __tablename__ = "class_attendance_entries"

    id         = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("class_attendance_sessions.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    student_id = db.Column(db.String(50), nullable=False, index=True)
    status     = db.Column(db.String(20), nullable=False, default="present")  # present | absent

    def to_dict(self):
        return {
            "id":         self.id,
            "session_id": self.session_id,
            "student_id": self.student_id,
            "status":     self.status,
        }

