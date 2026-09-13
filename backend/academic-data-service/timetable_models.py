"""
Timetable, Attendance & Leave Notification Models — AcademiQ
Covers:
  - Subject, Section, StudentEnrollment
  - TimetableSlot (Period 1-6 weekly schedule)
  - AttendanceEvent, FacultyDailyAttendance (biometric swipe / punch system)
  - LeaveNotice, ScheduleNotification
  - IngestionWarning (Admin queue for unresolved raw text / legend codes)
"""

from datetime import datetime, date, time
from models import db


class Subject(db.Model):
    __tablename__ = "subjects"

    id             = db.Column(db.Integer, primary_key=True)
    code           = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name           = db.Column(db.String(200), nullable=False)
    department_id  = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    is_confirmed   = db.Column(db.Boolean, default=False)
    raw_extracted  = db.Column(db.String(100), nullable=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    slots = db.relationship("TimetableSlot", backref="subject", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "department_id": self.department_id,
            "is_confirmed": self.is_confirmed,
            "raw_extracted": self.raw_extracted,
        }


class Section(db.Model):
    __tablename__ = "sections"

    id             = db.Column(db.Integer, primary_key=True)
    semester       = db.Column(db.String(20), nullable=False)  # "2", "4", "6", "PG"
    section_label  = db.Column(db.String(20), nullable=False)  # "A", "B", "C", "D1", "D2", etc.
    department_id  = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    default_room   = db.Column(db.String(50), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("semester", "section_label", name="uq_semester_section"),
    )

    slots = db.relationship("TimetableSlot", backref="section", lazy=True)
    enrollments = db.relationship("StudentEnrollment", backref="section", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "semester": self.semester,
            "section_label": self.section_label,
            "display_name": f"Sem {self.semester} - Sec {self.section_label}",
            "default_room": self.default_room,
            "department_id": self.department_id,
        }


class StudentEnrollment(db.Model):
    __tablename__ = "student_enrollments"

    id            = db.Column(db.Integer, primary_key=True)
    student_id    = db.Column(db.String(50), nullable=False, index=True)  # STU001 or USN
    section_id    = db.Column(db.Integer, db.ForeignKey("sections.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_term = db.Column(db.String(50), default="2024-25-EVEN", nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("student_id", "section_id", "academic_term", name="uq_student_section_term"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "section_id": self.section_id,
            "academic_term": self.academic_term,
        }


class TimetableSlot(db.Model):
    __tablename__ = "timetable_slots"

    id                  = db.Column(db.Integer, primary_key=True)
    faculty_id          = db.Column(db.String(50), nullable=False, index=True)  # FK to Faculty.faculty_id
    subject_id          = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=True, index=True)
    section_id          = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=False, index=True)
    day_of_week         = db.Column(db.String(10), nullable=False, index=True)  # Mon, Tue, Wed, Thu, Fri, Sat
    period_index        = db.Column(db.Integer, nullable=False, index=True)      # 1..6
    start_time          = db.Column(db.String(10), nullable=False)              # "09:00"
    end_time            = db.Column(db.String(10), nullable=False)              # "10:00"
    room                = db.Column(db.String(50), nullable=True, index=True)
    is_lab              = db.Column(db.Boolean, default=False)
    co_faculty_id       = db.Column(db.String(50), nullable=True)               # e.g. "FAC015"
    co_faculty_initials = db.Column(db.String(50), nullable=True)               # e.g. "GL", "UKP"
    raw_text            = db.Column(db.Text, nullable=True)                     # original parsed cell text
    academic_term       = db.Column(db.String(50), default="2024-25-EVEN", nullable=False, index=True)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self, faculty_map=None):
        fac_name = faculty_map.get(self.faculty_id, self.faculty_id) if faculty_map else self.faculty_id
        co_name = faculty_map.get(self.co_faculty_id, self.co_faculty_id) if (faculty_map and self.co_faculty_id) else self.co_faculty_initials

        return {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "faculty_name": fac_name,
            "subject_id": self.subject_id,
            "subject_code": self.subject.code if self.subject else None,
            "subject_name": self.subject.name if self.subject else (self.raw_text or "Unassigned Subject"),
            "section_id": self.section_id,
            "semester": self.section.semester if self.section else None,
            "section_label": self.section.section_label if self.section else None,
            "section_display": f"Sem {self.section.semester}-{self.section.section_label}" if self.section else None,
            "day_of_week": self.day_of_week,
            "period_index": self.period_index,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "time_label": f"{self.start_time} - {self.end_time}",
            "room": self.room,
            "is_lab": self.is_lab,
            "co_faculty_id": self.co_faculty_id,
            "co_faculty_initials": self.co_faculty_initials,
            "co_faculty_name": co_name,
            "raw_text": self.raw_text,
            "academic_term": self.academic_term,
        }


class AttendanceEvent(db.Model):
    __tablename__ = "attendance_events"

    id            = db.Column(db.Integer, primary_key=True)
    faculty_id    = db.Column(db.String(50), nullable=False, index=True)
    event_type    = db.Column(db.String(10), nullable=False)  # "IN" | "OUT"
    event_time    = db.Column(db.DateTime, nullable=False, index=True)
    device_id     = db.Column(db.String(50), default="MOCK-DEVICE-01", nullable=False)
    source        = db.Column(db.String(20), default="MOCK_DEVICE", nullable=False)  # MOCK_DEVICE | MANUAL_ADMIN
    admin_note    = db.Column(db.Text, nullable=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self, faculty_map=None):
        fac_name = faculty_map.get(self.faculty_id, self.faculty_id) if faculty_map else self.faculty_id
        return {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "faculty_name": fac_name,
            "event_type": self.event_type,
            "event_time": self.event_time.isoformat(),
            "time_str": self.event_time.strftime("%I:%M:%S %p"),
            "date_str": self.event_time.strftime("%Y-%m-%d"),
            "device_id": self.device_id,
            "source": self.source,
            "admin_note": self.admin_note,
            "created_at": self.created_at.isoformat(),
        }


class FacultyDailyAttendance(db.Model):
    __tablename__ = "faculty_daily_attendance"

    id                     = db.Column(db.Integer, primary_key=True)
    faculty_id             = db.Column(db.String(50), nullable=False, index=True)
    date                   = db.Column(db.Date, nullable=False, index=True)
    first_in               = db.Column(db.DateTime, nullable=True)
    last_out               = db.Column(db.DateTime, nullable=True)
    status                 = db.Column(db.String(30), default="NOT_YET_MARKED", nullable=False)
    # Status: PRESENT | LATE | ABSENT | ON_LEAVE | HALF_DAY | NOT_YET_MARKED
    work_duration_minutes  = db.Column(db.Integer, default=0)
    scheduled_first_start  = db.Column(db.String(10), nullable=True)
    scheduled_last_end     = db.Column(db.String(10), nullable=True)
    computed_at            = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("faculty_id", "date", name="uq_faculty_attendance_date"),
    )

    def to_dict(self, faculty_map=None):
        fac_name = faculty_map.get(self.faculty_id, self.faculty_id) if faculty_map else self.faculty_id
        hours = round(self.work_duration_minutes / 60.0, 1) if self.work_duration_minutes else 0.0

        return {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "faculty_name": fac_name,
            "date": self.date.isoformat() if self.date else None,
            "first_in": self.first_in.isoformat() if self.first_in else None,
            "first_in_time": self.first_in.strftime("%I:%M %p") if self.first_in else None,
            "last_out": self.last_out.isoformat() if self.last_out else None,
            "last_out_time": self.last_out.strftime("%I:%M %p") if self.last_out else None,
            "status": self.status,
            "work_duration_minutes": self.work_duration_minutes,
            "work_duration_hours": hours,
            "scheduled_first_start": self.scheduled_first_start,
            "scheduled_last_end": self.scheduled_last_end,
            "is_on_campus": bool(self.first_in and (not self.last_out or self.last_out < self.first_in)),
            "computed_at": self.computed_at.isoformat() if self.computed_at else None,
        }


class LeaveNotice(db.Model):
    __tablename__ = "leave_notices"

    id                      = db.Column(db.Integer, primary_key=True)
    faculty_id              = db.Column(db.String(50), nullable=False, index=True)
    date                    = db.Column(db.Date, nullable=False, index=True)
    start_time              = db.Column(db.String(10), nullable=True)  # None = full day, or "09:00"
    end_time                = db.Column(db.String(10), nullable=True)  # None = full day, or "13:30"
    reason                  = db.Column(db.Text, nullable=True)
    status                  = db.Column(db.String(20), default="NOTIFIED", nullable=False)
    # status: SUBMITTED | NOTIFIED | CANCELLED
    substitute_faculty_id   = db.Column(db.String(50), nullable=True)
    substitute_faculty_name = db.Column(db.String(200), nullable=True)
    created_by              = db.Column(db.String(50), nullable=False)
    created_at              = db.Column(db.DateTime, default=datetime.utcnow)
    cancelled_at            = db.Column(db.DateTime, nullable=True)

    notifications = db.relationship("ScheduleNotification", backref="leave_notice", lazy=True, cascade="all, delete-orphan")

    def to_dict(self, faculty_map=None):
        fac_name = faculty_map.get(self.faculty_id, self.faculty_id) if faculty_map else self.faculty_id
        sub_name = self.substitute_faculty_name or (faculty_map.get(self.substitute_faculty_id, self.substitute_faculty_id) if (faculty_map and self.substitute_faculty_id) else None)

        return {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "faculty_name": fac_name,
            "date": self.date.isoformat() if self.date else None,
            "date_display": self.date.strftime("%a, %d %b %Y") if self.date else None,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "is_full_day": not (self.start_time and self.end_time),
            "time_window": f"{self.start_time} - {self.end_time}" if (self.start_time and self.end_time) else "Full Day",
            "reason": self.reason,
            "status": self.status,
            "substitute_faculty_id": self.substitute_faculty_id,
            "substitute_faculty_name": sub_name,
            "notifications_count": len(self.notifications),
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
        }


class ScheduleNotification(db.Model):
    __tablename__ = "schedule_notifications"

    id                = db.Column(db.Integer, primary_key=True)
    student_id        = db.Column(db.String(50), nullable=False, index=True)
    leave_notice_id   = db.Column(db.Integer, db.ForeignKey("leave_notices.id", ondelete="CASCADE"), nullable=False, index=True)
    timetable_slot_id = db.Column(db.Integer, db.ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True, index=True)
    title             = db.Column(db.String(255), nullable=False)
    message           = db.Column(db.Text, nullable=False)
    channel           = db.Column(db.String(20), default="IN_APP", nullable=False)  # IN_APP | EMAIL | SMS
    is_urgent         = db.Column(db.Boolean, default=False)
    is_retracted      = db.Column(db.Boolean, default=False)
    sent_at           = db.Column(db.DateTime, default=datetime.utcnow)
    read_at           = db.Column(db.DateTime, nullable=True)

    slot = db.relationship("TimetableSlot", backref="notifications", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "leave_notice_id": self.leave_notice_id,
            "timetable_slot_id": self.timetable_slot_id,
            "title": self.title,
            "message": self.message,
            "channel": self.channel,
            "is_urgent": self.is_urgent,
            "is_retracted": self.is_retracted,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "sent_at_display": self.sent_at.strftime("%b %d, %I:%M %p") if self.sent_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "is_read": self.read_at is not None,
            "slot": self.slot.to_dict() if self.slot else None,
        }


class IngestionWarning(db.Model):
    __tablename__ = "ingestion_warnings"

    id            = db.Column(db.Integer, primary_key=True)
    academic_term = db.Column(db.String(50), default="2024-25-EVEN", nullable=False)
    source_file   = db.Column(db.String(100), nullable=False)
    row_number    = db.Column(db.Integer, nullable=True)
    raw_data      = db.Column(db.Text, nullable=True)
    reason        = db.Column(db.String(255), nullable=False)
    is_resolved   = db.Column(db.Boolean, default=False)
    resolved_by   = db.Column(db.String(50), nullable=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "academic_term": self.academic_term,
            "source_file": self.source_file,
            "row_number": self.row_number,
            "raw_data": self.raw_data,
            "reason": self.reason,
            "is_resolved": self.is_resolved,
            "resolved_by": self.resolved_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class TeacherEventAttendanceRequest(db.Model):
    __tablename__ = "teacher_event_attendance_requests"

    id                        = db.Column(db.Integer, primary_key=True)
    faculty_id                = db.Column(db.String(50), nullable=False, index=True)
    course_name               = db.Column(db.String(255), nullable=False)
    event_type                = db.Column(db.String(100), default="Workshop", nullable=False)
    organizer                 = db.Column(db.String(255), nullable=True)
    event_date                = db.Column(db.Date, nullable=False, index=True)
    start_time                = db.Column(db.String(10), nullable=True)
    end_time                  = db.Column(db.String(10), nullable=True)
    is_full_day               = db.Column(db.Boolean, default=True)
    description               = db.Column(db.Text, nullable=True)
    certificate_filename      = db.Column(db.String(255), nullable=False)
    certificate_original_name = db.Column(db.String(255), nullable=True)
    certificate_file_type     = db.Column(db.String(100), nullable=True)
    status                    = db.Column(db.String(20), default="pending", nullable=False, index=True)  # pending | approved | rejected | cancelled
    requested_by              = db.Column(db.String(50), nullable=False)  # user_id / email
    reviewed_by               = db.Column(db.String(50), nullable=True)   # admin user_id
    reviewed_at               = db.Column(db.DateTime, nullable=True)
    admin_remarks             = db.Column(db.Text, nullable=True)
    created_at                = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at                = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, faculty_map=None):
        fac_name = faculty_map.get(self.faculty_id, self.faculty_id) if faculty_map else self.faculty_id
        return {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "faculty_name": fac_name,
            "course_name": self.course_name,
            "event_name": self.course_name,
            "event_type": self.event_type,
            "organizer": self.organizer,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "event_date_display": self.event_date.strftime("%a, %d %b %Y") if self.event_date else None,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "is_full_day": self.is_full_day,
            "time_window": f"{self.start_time} - {self.end_time}" if (self.start_time and self.end_time and not self.is_full_day) else "Full Day",
            "description": self.description,
            "certificate_filename": self.certificate_filename,
            "certificate_original_name": self.certificate_original_name,
            "certificate_file_type": self.certificate_file_type,
            "certificate_url": f"/api/v1/attendance/proofs/{self.certificate_filename}",
            "status": self.status,
            "requested_by": self.requested_by,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "admin_remarks": self.admin_remarks,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

