from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class ParentRecord(db.Model):
    """
    PRIVACY NOTE: Primary phone numbers are stored in plaintext.
    Production hardening (not implemented here for demo):
    - Encrypt at rest (e.g., SQLAlchemy encrypted column)
    - Access audit log (every read of primary_mobile should be logged)
    - DPDP Act 2023 compliance: explicit consent workflow, right to withdraw
    - Number masking: never expose raw number to frontend — only Twilio proxy SID
    """
    __tablename__ = "parent_records"

    id               = db.Column(db.Integer, primary_key=True)
    student_id       = db.Column(db.String(50), nullable=False, index=True, unique=True)
    parent_name      = db.Column(db.String(200), nullable=False)
    relationship     = db.Column(db.String(50))   # Father | Mother | Guardian
    primary_mobile   = db.Column(db.String(20), nullable=False)
    alternate_mobile = db.Column(db.String(20))
    preferred_contact_method = db.Column(db.String(20), default="Call")  # Call | SMS | WhatsApp
    consent_to_contact = db.Column(db.Boolean, default=True)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at       = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, mask_number=True):
        """
        If mask_number=True (for teacher/student role), hide raw phone digits.
        Admin sees the full number — enforced at route level via X-User-Role header.
        """
        primary = ("*" * 6 + self.primary_mobile[-4:]) if mask_number and self.primary_mobile else self.primary_mobile
        alt     = ("*" * 6 + self.alternate_mobile[-4:]) if mask_number and self.alternate_mobile else self.alternate_mobile

        return {
            "id":                       self.id,
            "student_id":               self.student_id,
            "parent_name":              self.parent_name,
            "relationship":             self.relationship,
            "primary_mobile":           primary,
            "alternate_mobile":         alt,
            "preferred_contact_method": self.preferred_contact_method,
            "consent_to_contact":       self.consent_to_contact,
            "created_at":               self.created_at.isoformat(),
        }


class ContactLog(db.Model):
    """Audit log for every call/SMS attempt."""
    __tablename__ = "contact_logs"

    id               = db.Column(db.Integer, primary_key=True)
    student_id       = db.Column(db.String(50), nullable=False, index=True)
    initiated_by     = db.Column(db.String(100))  # faculty_id / user_id
    contact_method   = db.Column(db.String(20))   # Call | SMS | WhatsApp
    status           = db.Column(db.String(50))   # success | failed | mock | consent_denied
    twilio_sid       = db.Column(db.String(100))  # call/message SID from Twilio
    message          = db.Column(db.Text)         # SMS body if applicable
    error_message    = db.Column(db.Text)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":             self.id,
            "student_id":     self.student_id,
            "initiated_by":   self.initiated_by,
            "contact_method": self.contact_method,
            "status":         self.status,
            "twilio_sid":     self.twilio_sid,
            "message":        self.message,
            "error_message":  self.error_message,
            "created_at":     self.created_at.isoformat(),
        }
