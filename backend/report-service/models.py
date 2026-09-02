"""
SQLAlchemy models for report-service.

Schema note: any future per-section cache table must use the composite key
(sar_format, node_id), NOT node_id alone — node IDs collide intentionally
across SAR formats (e.g. '6.1.2.2' exists in both ug_tier_ii_gapc_v4 and
ug_tier_i_gapc_v4 with different mark caps and formula parameters).
ReportJob itself uses a UUID primary key and stores sar_format as a column
so this constraint is satisfied.
"""

import uuid
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _new_uuid():
    return str(uuid.uuid4())


class ReportJob(db.Model):
    """
    One row per report generation request.
    Stores metadata, file paths, and status so reports can be
    re-downloaded without being regenerated.
    """
    __tablename__ = "report_jobs"

    id               = db.Column(db.Integer, primary_key=True)
    report_id        = db.Column(db.String(36), unique=True, nullable=False,
                                  default=_new_uuid, index=True)

    # SAR-format composite key fields (see schema note above)
    sar_format       = db.Column(db.String(50), nullable=False)   # e.g. "ug_tier_ii_gapc_v4"
    report_type      = db.Column(db.String(50), nullable=False)   # "nba" | "adhoc"
    scope            = db.Column(db.String(100), nullable=False)  # "full" | "criterion:5" | ...

    # Who and what
    department_id    = db.Column(db.String(50))                   # dept code or id
    academic_year    = db.Column(db.String(20))                   # "2025-26"
    requester_id     = db.Column(db.String(100))                  # X-User-Id from gateway
    requester_role   = db.Column(db.String(20))                   # admin | teacher | student
    target           = db.Column(db.String(200))                  # student_id / adhoc query text

    # Formats requested: "pdf", "docx", or "pdf,docx"
    formats_requested = db.Column(db.String(20), default="pdf")

    # Selected event IDs included for detailed summary sheets (Criterion 4)
    include_event_ids = db.Column(db.JSON, default=list)

    # Output paths (relative to REPORTS_DIR)
    file_pdf_path    = db.Column(db.String(500))
    file_docx_path   = db.Column(db.String(500))

    # Status lifecycle: pending → done | error
    status           = db.Column(db.String(20), default="pending", index=True)
    error_msg        = db.Column(db.Text)

    created_at       = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at     = db.Column(db.DateTime)

    def to_dict(self):
        return {
            "report_id":         self.report_id,
            "sar_format":        self.sar_format,
            "report_type":       self.report_type,
            "scope":             self.scope,
            "department_id":     self.department_id,
            "academic_year":     self.academic_year,
            "requester_id":      self.requester_id,
            "requester_role":    self.requester_role,
            "target":            self.target,
            "formats_requested": self.formats_requested,
            "include_event_ids": self.include_event_ids or [],
            "status":            self.status,
            "error_msg":         self.error_msg,
            "has_pdf":           bool(self.file_pdf_path),
            "has_docx":          bool(self.file_docx_path),
            "created_at":        self.created_at.isoformat(),
            "completed_at":      self.completed_at.isoformat() if self.completed_at else None,
        }


class ReportNarrative(db.Model):
    """
    Stores admin-authored narratives for SAR report sections (e.g. 4.6.2 Publications).
    Composite key by (sar_format, node_id, department_id, academic_year).
    """
    __tablename__ = "report_narratives"

    id             = db.Column(db.Integer, primary_key=True)
    sar_format     = db.Column(db.String(50), nullable=False, default="ug_tier_ii_gapc_v4")
    node_id        = db.Column(db.String(50), nullable=False, index=True)   # e.g. "4.6.2"
    department_id  = db.Column(db.String(50), nullable=False, index=True)   # dept code or id
    academic_year  = db.Column(db.String(20), nullable=False, index=True)   # "2025-26"
    narrative_text = db.Column(db.Text, nullable=False)
    author_id      = db.Column(db.String(100))
    author_role    = db.Column(db.String(50))
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("sar_format", "node_id", "department_id", "academic_year", name="uq_report_narrative"),
    )

    def to_dict(self):
        return {
            "id":             self.id,
            "sar_format":     self.sar_format,
            "node_id":        self.node_id,
            "department_id":  self.department_id,
            "academic_year":  self.academic_year,
            "narrative_text": self.narrative_text,
            "author_id":      self.author_id,
            "author_role":    self.author_role,
            "updated_at":     self.updated_at.isoformat() if self.updated_at else None,
        }


