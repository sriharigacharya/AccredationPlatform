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
    def compute_course_grade(course):
        """Compute CIE total, SEE total, grand total, grade, and grade points for one course dict."""
        cie1  = course.get("cie1")  or 0
        cie2  = course.get("cie2")  or 0
        quiz1 = course.get("quiz1") or 0
        quiz2 = course.get("quiz2") or 0
        el    = course.get("el")    or 0
        see   = course.get("see")   or 0

        cie_raw = cie1 + cie2 + quiz1 + quiz2 + el   # out of 100
        cie_reduced = round(cie_raw * 50 / 100, 1)    # out of 50
        see_reduced = round(see * 50 / 100, 1)        # out of 50
        total = round(cie_reduced + see_reduced, 1)    # out of 100

        grade, gp = "F", 0
        for threshold, g, points in Student.GRADE_TABLE:
            if total >= threshold:
                grade, gp = g, points
                break

        return {
            "cie_raw": cie_raw, "cie_reduced": cie_reduced,
            "see_raw": see, "see_reduced": see_reduced,
            "total": total, "grade": grade, "grade_points": gp,
        }

    def get_courses(self):
        """Parse courses_data JSON and attach computed grades."""
        import json
        if not self.courses_data:
            return []
        try:
            courses = json.loads(self.courses_data)
        except Exception:
            return []
        for c in courses:
            c.update(self.compute_course_grade(c))
        return courses

    def compute_sgpa(self):
        """Compute SGPA from courses_data."""
        courses = self.get_courses()
        if not courses:
            return self.previous_gpa or 0.0
        total_credits = 0
        weighted_sum = 0
        for c in courses:
            cr = c.get("credits", 4)
            total_credits += cr
            weighted_sum += c["grade_points"] * cr
        return round(weighted_sum / total_credits, 2) if total_credits > 0 else 0.0

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
