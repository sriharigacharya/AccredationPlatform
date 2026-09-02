"""
Placement Models — AcademiQ
Table: student_placements
Feeds Criterion 4 Placement Index: (Placed + Higher Studies + Entrepreneurs) / Final Year Students
"""

from datetime import datetime
from models import db


VALID_PLACEMENT_STATUSES = ("placed", "higher_studies", "entrepreneur", "not_placed")


class StudentPlacement(db.Model):
    __tablename__ = "student_placements"

    id                      = db.Column(db.Integer, primary_key=True)
    student_id              = db.Column(db.String(50), nullable=False, unique=True, index=True)
    # student_id matches students.student_id (e.g. STU001)

    status                  = db.Column(db.String(30), nullable=False, default="not_placed", index=True)
    # status ∈ {"placed", "higher_studies", "entrepreneur", "not_placed"}

    company_or_institution  = db.Column(db.String(300))
    role_or_program         = db.Column(db.String(300))
    ctc_or_stipend          = db.Column(db.String(100))  # e.g., "12.5 LPA", "₹50,000/mo"
    offer_letter_path       = db.Column(db.String(500))  # filename stored in offer_letters/

    academic_year           = db.Column(db.String(20), default="2025-26")  # e.g., "2025-26"
    final_year_cohort_year  = db.Column(db.Integer, default=2026, index=True)  # graduating year

    verified_by_admin       = db.Column(db.Boolean, default=False, index=True)
    verified_by             = db.Column(db.String(50))   # user_id or faculty_id of verifier
    verified_at             = db.Column(db.DateTime)

    submitted_at            = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at              = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_student=False):
        d = {
            "id":                     self.id,
            "student_id":             self.student_id,
            "status":                 self.status,
            "company_or_institution": self.company_or_institution,
            "role_or_program":        self.role_or_program,
            "ctc_or_stipend":         self.ctc_or_stipend,
            "offer_letter_path":      self.offer_letter_path,
            "has_offer_letter":       bool(self.offer_letter_path),
            "academic_year":          self.academic_year,
            "final_year_cohort_year": self.final_year_cohort_year,
            "verified_by_admin":      self.verified_by_admin,
            "verified_by":            self.verified_by,
            "verified_at":            self.verified_at.isoformat() if self.verified_at else None,
            "submitted_at":           self.submitted_at.isoformat() if self.submitted_at else None,
            "updated_at":             self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_student:
            from models import Student
            stu = Student.query.filter_by(student_id=self.student_id).first()
            if stu:
                d["student"] = {
                    "name":       stu.name,
                    "email":      stu.email,
                    "semester":   stu.semester,
                    "section":    stu.section,
                    "department": stu.department.code if stu.department else None,
                    "cgpa":       stu.previous_gpa,
                }
        return d
