"""
SQLAlchemy models for Historical Data Upload & Verification Workflow:
  - AdmissionRecord (Criterion 4.1 Enrolment Ratio)
  - AcademicBatch & BatchYearProgress (Criterion 4.2 Success Rate / Progression)
  - AcademicPerformanceRecord (Criterion 4.3 / 4.4 Academic Performance Index)

Includes audit columns and verification lifecycle:
  - uploaded_by: User ID of uploader
  - submitted_via: 'worker' | 'admin'
  - verification_status: 'pending' | 'verified' | 'rejected'
  - verified_by, verified_at, rejection_reason
"""

from datetime import datetime
from models import db


VALID_SUBMITTED_VIA = {"worker", "admin"}
VALID_VERIFICATION_STATUSES = {"pending", "verified", "rejected"}
VALID_YEARS_OF_STUDY = {"I", "II", "III", "IV"}


class AdmissionRecord(db.Model):
    """
    Criterion 4.1 — Admission Details / Enrolment Ratio
    sanctioned_intake (N)
    first_year_admitted_net_migration (N1)
    lateral_entry_admitted (N2)
    separate_division_admitted (N3)
    total_admitted = N1 + N2 + N3
    """
    __tablename__ = "admission_records"

    id                                = db.Column(db.Integer, primary_key=True)
    academic_year                     = db.Column(db.String(20), nullable=False, index=True)  # e.g. "2025-26"
    department                        = db.Column(db.String(50), nullable=False, index=True)  # e.g. "CSE"
    sanctioned_intake                 = db.Column(db.Integer, nullable=False, default=0)      # N
    first_year_admitted_net_migration = db.Column(db.Integer, nullable=False, default=0)      # N1
    lateral_entry_admitted            = db.Column(db.Integer, nullable=False, default=0)      # N2
    separate_division_admitted        = db.Column(db.Integer, nullable=False, default=0)      # N3
    total_admitted                    = db.Column(db.Integer, nullable=False, default=0)      # N1 + N2 + N3

    # Verification & Audit
    uploaded_by         = db.Column(db.String(100), nullable=False)
    submitted_via       = db.Column(db.String(20), default="worker", nullable=False)  # worker | admin
    verification_status = db.Column(db.String(20), default="pending", nullable=False, index=True)  # pending | verified | rejected
    verified_by         = db.Column(db.String(100))
    verified_at         = db.Column(db.DateTime)
    rejection_reason    = db.Column(db.Text)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at          = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id":                                self.id,
            "academic_year":                     self.academic_year,
            "department":                        self.department,
            "sanctioned_intake":                 self.sanctioned_intake,
            "first_year_admitted_net_migration": self.first_year_admitted_net_migration,
            "lateral_entry_admitted":            self.lateral_entry_admitted,
            "separate_division_admitted":        self.separate_division_admitted,
            "total_admitted":                    self.total_admitted,
            "uploaded_by":                       self.uploaded_by,
            "submitted_via":                     self.submitted_via,
            "verification_status":               self.verification_status,
            "verified_by":                       self.verified_by,
            "verified_at":                       self.verified_at.isoformat() if self.verified_at else None,
            "rejection_reason":                  self.rejection_reason,
            "created_at":                        self.created_at.isoformat() if self.created_at else None,
        }


class AcademicBatch(db.Model):
    """
    Criterion 4.2 — Academic Batch Header
    e.g. Batch entering in 2021-22 with total_admitted=190.
    """
    __tablename__ = "academic_batches"

    id             = db.Column(db.Integer, primary_key=True)
    year_of_entry  = db.Column(db.String(20), nullable=False, index=True)  # e.g. "2021-22"
    department     = db.Column(db.String(50), nullable=False, index=True)  # e.g. "CSE"
    total_admitted = db.Column(db.Integer, nullable=False, default=0)      # N1 + N2 + N3 of that batch
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    progress_records = db.relationship("BatchYearProgress", backref="batch", cascade="all, delete-orphan", lazy=True)

    def to_dict(self, include_progress=False):
        d = {
            "id":             self.id,
            "year_of_entry":  self.year_of_entry,
            "department":     self.department,
            "total_admitted": self.total_admitted,
            "created_at":     self.created_at.isoformat() if self.created_at else None,
        }
        if include_progress:
            d["progress"] = [p.to_dict() for p in self.progress_records]
        return d


class BatchYearProgress(db.Model):
    """
    Criterion 4.2 — Progression through Year I, II, III, IV
    Tracks students passing without backlog and total students passed.
    """
    __tablename__ = "batch_year_progress"

    id                       = db.Column(db.Integer, primary_key=True)
    batch_id                 = db.Column(db.Integer, db.ForeignKey("academic_batches.id"), nullable=False, index=True)
    year_of_study            = db.Column(db.String(10), nullable=False)  # I | II | III | IV
    students_without_backlog = db.Column(db.Integer, nullable=False, default=0)
    students_total_passed    = db.Column(db.Integer, nullable=False, default=0)

    # Verification & Audit
    uploaded_by         = db.Column(db.String(100), nullable=False)
    submitted_via       = db.Column(db.String(20), default="worker", nullable=False)
    verification_status = db.Column(db.String(20), default="pending", nullable=False, index=True)
    verified_by         = db.Column(db.String(100))
    verified_at         = db.Column(db.DateTime)
    rejection_reason    = db.Column(db.Text)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at          = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        batch = AcademicBatch.query.get(self.batch_id) if self.batch_id else None
        return {
            "id":                       self.id,
            "batch_id":                 self.batch_id,
            "year_of_entry":            batch.year_of_entry if batch else None,
            "department":               batch.department if batch else None,
            "total_admitted":           batch.total_admitted if batch else 0,
            "year_of_study":            self.year_of_study,
            "students_without_backlog": self.students_without_backlog,
            "students_total_passed":    self.students_total_passed,
            "uploaded_by":              self.uploaded_by,
            "submitted_via":            self.submitted_via,
            "verification_status":      self.verification_status,
            "verified_by":              self.verified_by,
            "verified_at":              self.verified_at.isoformat() if self.verified_at else None,
            "rejection_reason":         self.rejection_reason,
            "created_at":               self.created_at.isoformat() if self.created_at else None,
        }


class AcademicPerformanceRecord(db.Model):
    """
    Criterion 4.3 / 4.4 — Academic Performance Index (API)
    Year II / Year III mean CGPA, appearing count, successful count.
    """
    __tablename__ = "academic_performance_records"

    id                        = db.Column(db.Integer, primary_key=True)
    academic_year             = db.Column(db.String(20), nullable=False, index=True)  # e.g. "2024-25"
    year_of_study             = db.Column(db.String(10), nullable=False)              # II | III
    department                = db.Column(db.String(50), nullable=False, index=True)  # e.g. "CSE"
    mean_cgpa_or_percentage   = db.Column(db.Float, nullable=False, default=0.0)      # e.g. 7.85
    successful_students_count = db.Column(db.Integer, nullable=False, default=0)
    appeared_students_count   = db.Column(db.Integer, nullable=False, default=0)

    # Verification & Audit
    uploaded_by         = db.Column(db.String(100), nullable=False)
    submitted_via       = db.Column(db.String(20), default="worker", nullable=False)
    verification_status = db.Column(db.String(20), default="pending", nullable=False, index=True)
    verified_by         = db.Column(db.String(100))
    verified_at         = db.Column(db.DateTime)
    rejection_reason    = db.Column(db.Text)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at          = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id":                        self.id,
            "academic_year":             self.academic_year,
            "year_of_study":             self.year_of_study,
            "department":                self.department,
            "mean_cgpa_or_percentage":   self.mean_cgpa_or_percentage,
            "successful_students_count": self.successful_students_count,
            "appeared_students_count":   self.appeared_students_count,
            "uploaded_by":              self.uploaded_by,
            "submitted_via":            self.submitted_via,
            "verification_status":      self.verification_status,
            "verified_by":              self.verified_by,
            "verified_at":              self.verified_at.isoformat() if self.verified_at else None,
            "rejection_reason":         self.rejection_reason,
            "created_at":               self.created_at.isoformat() if self.created_at else None,
        }
