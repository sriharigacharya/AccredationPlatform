"""
Student Achievement Models — AcademiQ
Tracks external student achievements (hackathons, sports, cultural, technical fests)
supporting individual and team submissions, attached certificates and photos,
and verification workflow for NBA Criterion 4 (Section 4.6.3).
"""


from datetime import datetime
from models import db


class StudentAchievement(db.Model):
    """
    Unified record of external student achievements (representing the college).
    Covers technical, sports, cultural, and other competitions.
    """
    __tablename__ = "student_achievements"

    id                  = db.Column(db.Integer, primary_key=True)
    # Primary student / Submitter / Team Lead
    student_id          = db.Column(db.String(32), db.ForeignKey("students.student_id"), nullable=False, index=True)
    # JSON list of student IDs for team events (e.g. ["STU069", "STU070", "STU073"])
    student_ids         = db.Column(db.JSON, default=list, nullable=False)

    # Activity categorization: stored for internal search/filter only (NOT for report splitting)
    activity_type       = db.Column(db.String(32), nullable=False, index=True)  # technical | sports | cultural | other

    event_name          = db.Column(db.String(255), nullable=False)
    organizing_body     = db.Column(db.String(255), nullable=False)
    event_scope         = db.Column(db.String(32), default="within_state", nullable=False)  # within_state | outside_state | national | international
    event_date          = db.Column(db.Date, nullable=False, index=True)
    academic_year       = db.Column(db.String(16), nullable=False, index=True)  # e.g. "2025-26"
    venue               = db.Column(db.String(255), nullable=False)
    result_description  = db.Column(db.String(255), nullable=False)             # e.g. "Won 1st Prize & ₹1,00,000 Award"
    remarks             = db.Column(db.Text, nullable=True)

    # Proof document & optional photos
    proof_file_path     = db.Column(db.String(255), nullable=False)             # Certificate / award letter
    photo_paths         = db.Column(db.JSON, default=list, nullable=False)      # List of filenames

    # Submission source
    submitted_via       = db.Column(db.String(16), default="student", nullable=False)  # student | worker | admin
    submitted_by        = db.Column(db.String(64), nullable=True)

    # Verification workflow
    verification_status = db.Column(db.String(16), default="pending", nullable=False, index=True)  # pending | verified | rejected
    rejection_reason    = db.Column(db.Text, nullable=True)
    verified_by         = db.Column(db.String(64), nullable=True)
    verified_at         = db.Column(db.DateTime, nullable=True)

    submitted_at        = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at          = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship to primary student
    student             = db.relationship("Student", foreign_keys=[student_id], backref=db.backref("achievements", lazy=True))

    def to_dict(self, include_students=True):
        data = {
            "id":                  self.id,
            "student_id":          self.student_id,
            "student_ids":         self.student_ids or [self.student_id],
            "activity_type":       self.activity_type,
            "event_name":          self.event_name,
            "organizing_body":     self.organizing_body,
            "event_scope":         self.event_scope,
            "event_date":          self.event_date.isoformat() if self.event_date else None,
            "academic_year":       self.academic_year,
            "venue":               self.venue,
            "result_description":  self.result_description,
            "remarks":             self.remarks,
            "proof_file_path":     self.proof_file_path,
            "proof_url":           f"/api/v1/achievement-proofs/{self.proof_file_path}" if self.proof_file_path else None,
            "photo_paths":         self.photo_paths or [],
            "photo_urls":          [f"/api/v1/achievement-photos/{p}" for p in (self.photo_paths or [])],
            "submitted_via":       self.submitted_via,
            "submitted_by":        self.submitted_by,
            "verification_status": self.verification_status,
            "rejection_reason":    self.rejection_reason,
            "verified_by":         self.verified_by,
            "verified_at":         self.verified_at.isoformat() if self.verified_at else None,
            "submitted_at":        self.submitted_at.isoformat() if self.submitted_at else None,
            "updated_at":          self.updated_at.isoformat() if self.updated_at else None,
            "is_team":             len(self.student_ids or []) > 1,
            "team_size":           len(self.student_ids or [self.student_id]),
        }

        if include_students:
            from models import Student
            primary_student = Student.query.filter_by(student_id=self.student_id).first()
            data["student"] = {
                "student_id": self.student_id,
                "name": primary_student.name if primary_student else self.student_id,
                "section": primary_student.section if primary_student else None,
                "semester": primary_student.semester if primary_student else None,
            }

            # Resolve team members
            team_members = []
            all_ids = self.student_ids or [self.student_id]
            if all_ids:
                students_found = Student.query.filter(Student.student_id.in_(all_ids)).all()
                stu_map = {s.student_id: s for s in students_found}
                for sid in all_ids:
                    s_obj = stu_map.get(sid)
                    team_members.append({
                        "student_id": sid,
                        "name": s_obj.name if s_obj else sid,
                        "section": s_obj.section if s_obj else None,
                        "semester": s_obj.semester if s_obj else None,
                    })
            data["team_members"] = team_members

        return data
