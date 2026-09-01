"""
Auth Service — AcademiQ
Roles: student | teacher | admin | worker
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

VALID_ROLES = ("student", "teacher", "admin", "worker")


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.String(20), unique=True, nullable=False, index=True)
    # e.g. U001, U002 — auto-generated if not supplied
    email         = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.String(20), nullable=False, default="student")
    # role ∈ {"student", "teacher", "admin", "worker"}
    name          = db.Column(db.String(200), nullable=False)
    linked_id     = db.Column(db.String(50))
    # linked_id → student_id (for students) or faculty_id (for teachers); null for admin/worker
    is_active     = db.Column(db.Boolean, default=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id":         self.id,
            "user_id":    self.user_id,
            "email":      self.email,
            "role":       self.role,
            "name":       self.name,
            "linked_id":  self.linked_id,
            "is_active":  self.is_active,
            "created_at": self.created_at.isoformat(),
        }
