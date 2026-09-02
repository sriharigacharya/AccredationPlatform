"""
Event Models — AcademiQ
Tables: clubs, student_roles, events, event_photos
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from models import db


VALID_CLUB_CATEGORIES = ("technical", "cultural", "sports", "social", "literary", "other")
VALID_STUDENT_ROLES   = ("head", "council", "member")
VALID_EVENT_TYPES     = ("hackathon", "workshop", "seminar", "webinar", "competition",
                         "conference", "guest_lecture", "cultural_fest", "sports_meet",
                         "social_outreach", "other")
VALID_SUBMITTED_VIA   = ("club_head", "worker", "admin")
VALID_EVENT_STATUSES  = ("pending", "approved", "rejected")


class Club(db.Model):
    __tablename__ = "clubs"

    id                = db.Column(db.Integer, primary_key=True)
    name              = db.Column(db.String(200), unique=True, nullable=False)
    category          = db.Column(db.String(50), nullable=False, default="other")
    description       = db.Column(db.Text)
    mentor_faculty_id = db.Column(db.String(50), nullable=False, index=True)
    # mentor_faculty_id → matches faculty.faculty_id (e.g. "FAC001")
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at        = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    student_roles = db.relationship("StudentRole", backref="club", lazy=True, cascade="all, delete-orphan")
    events        = db.relationship("Event",       backref="club", lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_mentor=False, include_roles=False):
        d = {
            "id":                self.id,
            "name":              self.name,
            "category":          self.category,
            "description":       self.description,
            "mentor_faculty_id": self.mentor_faculty_id,
            "created_at":        self.created_at.isoformat(),
            "updated_at":        self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_mentor:
            from models import Faculty
            fac = Faculty.query.filter_by(faculty_id=self.mentor_faculty_id).first()
            d["mentor"] = {"faculty_id": fac.faculty_id, "name": fac.name} if fac else None
        if include_roles:
            d["roles"] = [r.to_dict() for r in self.student_roles]
        return d


class StudentRole(db.Model):
    __tablename__ = "student_roles"

    id          = db.Column(db.Integer, primary_key=True)
    student_id  = db.Column(db.String(50), nullable=False, index=True)
    # student_id → matches students.student_id (e.g. "STU001")
    club_id     = db.Column(db.Integer, db.ForeignKey("clubs.id", ondelete="CASCADE"),
                            nullable=False, index=True)
    role        = db.Column(db.String(20), nullable=False, default="member")
    # role ∈ {"head", "council", "member"}
    assigned_by = db.Column(db.String(50))   # user_id of admin who assigned
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("student_id", "club_id", name="uq_student_club"),
    )

    def to_dict(self):
        return {
            "id":          self.id,
            "student_id":  self.student_id,
            "club_id":     self.club_id,
            "role":        self.role,
            "assigned_by": self.assigned_by,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
        }


class Event(db.Model):
    __tablename__ = "events"

    id                      = db.Column(db.Integer, primary_key=True)
    club_id                 = db.Column(db.Integer, db.ForeignKey("clubs.id", ondelete="CASCADE"),
                                        nullable=False, index=True)
    title                   = db.Column(db.String(300), nullable=False)
    event_type              = db.Column(db.String(50), nullable=False, default="other")
    description             = db.Column(db.Text)
    venue                   = db.Column(db.String(300))
    event_date              = db.Column(db.DateTime)
    organized_by_student_id = db.Column(db.String(50), nullable=False, index=True)
    submitted_via           = db.Column(db.String(20), nullable=False, default="club_head")
    # submitted_via ∈ {"club_head", "worker", "admin"}

    attendee_count          = db.Column(db.Integer)
    guest_names             = db.Column(db.Text)   # JSON array string
    report_text             = db.Column(db.Text)

    # NBA fields — optional at submission, filled by mentor at approval
    po_mapping              = db.Column(db.Text)   # e.g. "PO1, PO3, PO9"
    resource_person         = db.Column(db.String(300))
    skill_orientation       = db.Column(db.String(300))

    # Workflow
    status                  = db.Column(db.String(20), nullable=False, default="pending", index=True)
    # status ∈ {"pending", "approved", "rejected"}
    submitted_at            = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_by             = db.Column(db.String(50))   # faculty_id of mentor who reviewed
    reviewed_at             = db.Column(db.DateTime)
    rejection_reason        = db.Column(db.Text)

    # Relationships
    photos = db.relationship("EventPhoto", backref="event", lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_photos=False):
        import json
        d = {
            "id":                      self.id,
            "club_id":                 self.club_id,
            "title":                   self.title,
            "event_type":              self.event_type,
            "description":             self.description,
            "venue":                   self.venue,
            "event_date":              self.event_date.isoformat() if self.event_date else None,
            "organized_by_student_id": self.organized_by_student_id,
            "submitted_via":           self.submitted_via,
            "attendee_count":          self.attendee_count,
            "guest_names":             _safe_json(self.guest_names),
            "report_text":             self.report_text,
            "po_mapping":              self.po_mapping,
            "resource_person":         self.resource_person,
            "skill_orientation":       self.skill_orientation,
            "status":                  self.status,
            "submitted_at":            self.submitted_at.isoformat() if self.submitted_at else None,
            "reviewed_by":             self.reviewed_by,
            "reviewed_at":             self.reviewed_at.isoformat() if self.reviewed_at else None,
            "rejection_reason":        self.rejection_reason,
        }
        if include_photos:
            d["photos"] = [p.to_dict() for p in self.photos]
        return d


class EventPhoto(db.Model):
    __tablename__ = "event_photos"

    id          = db.Column(db.Integer, primary_key=True)
    event_id    = db.Column(db.Integer, db.ForeignKey("events.id", ondelete="CASCADE"),
                            nullable=False, index=True)
    file_path   = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":          self.id,
            "event_id":    self.event_id,
            "file_path":   self.file_path,
            "uploaded_at":  self.uploaded_at.isoformat() if self.uploaded_at else None,
        }


def _safe_json(val):
    """Parse JSON string or return raw value."""
    import json
    if val is None:
        return []
    try:
        return json.loads(val)
    except Exception:
        return val
