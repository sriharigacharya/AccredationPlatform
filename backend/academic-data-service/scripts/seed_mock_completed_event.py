"""
Seed Mock Completed Event with Attended Students
Event: National AI & Edge Cloud Hackathon 2026
Attendees: 16 students from CSE (12 Present, 4 Walk-In, 2 Absent)
"""

import os
import sys
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import db, Student, Faculty
from event_models import (
    Club, Event, EventRegistration, EventAttendanceAward,
    EventStatus, EventAttendanceStatus
)

def seed_completed_event():
    print("[*] Seeding Mock Completed Event...")
    
    # 1. Get or create Club
    club = Club.query.filter(Club.name.ilike("%ACM%")).first()
    if not club:
        club = Club.query.first()
    if not club:
        club = Club(
            name="ACM Student Chapter",
            category="technical",
            description="ACM student chapter conducting hackathons, coding workshops, and cloud conferences.",
            mentor_faculty_id="FAC001"
        )
        db.session.add(club)
        db.session.flush()

    mentor = Faculty.query.filter_by(faculty_id=club.mentor_faculty_id).first() or Faculty.query.first()
    mentor_id = mentor.faculty_id if mentor else "FAC001"

    # 2. Check if this mock completed event already exists
    event_title = "National AI & Edge Cloud Hackathon 2026"
    event = Event.query.filter_by(title=event_title).first()
    
    past_date = datetime.utcnow() - timedelta(days=3)

    if not event:
        event = Event(
            club_id=club.id,
            title=event_title,
            event_type="hackathon",
            description="A 24-hour inter-collegiate coding and cloud deployment hackathon focused on GenAI agent workflows, containerized microservices, and edge computing. Over 18 student teams built and deployed live prototypes with industry mentorship.",
            venue="APJ Abdul Kalam Tech Auditorium & CS Labs 3-4",
            event_date=past_date,
            time_slot="09:00 AM - 05:00 PM",
            start_time="09:00",
            end_time="17:00",
            organized_by_student_id="STU001",
            submitted_via="club_head",
            status="approved",
            is_completed=True,
            attendee_count=16,
            guest_names=json.dumps([
                "Dr. K. S. Venkatesh (Principal Cloud Architect, Google Cloud)",
                "Ms. Shweta Rao (Senior Architect, AWS Enterprise)",
                "Prof. N. K. Sharma (IEEE Computer Society Chair)"
            ]),
            report_text="""The National AI & Edge Cloud Hackathon 2026 was successfully conducted with enthusiastic participation from 18 teams across multiple colleges. 

Key Highlights:
1. Keynote presentation was delivered by Dr. K. S. Venkatesh on LLM agent orchestration and containerized edge workloads.
2. Teams engaged in 24 hours of intensive sprint engineering, deploying dockerized microservices and automated evaluation benchmarks.
3. 16 student attendees demonstrated fully functional projects during the live jury evaluation.
4. Top 3 teams were awarded cash prizes of INR 50,000, 30,000, and 20,000 along with cloud credits and certificates of distinction.

Criterion 4.6 Compliance:
All participating students were verified on-premise, and duty leaves were recommended for affected theory and lab sessions.""",
            po_mapping="PO1 (Engineering Knowledge), PO3 (Design & Development of Solutions), PO5 (Modern Tool Usage), PSO1, PSO2",
            resource_person="Dr. K. S. Venkatesh (Principal Cloud Architect, Google Cloud)",
            skill_orientation="Cloud Infrastructure, Docker & Kubernetes, GenAI Agents, Distributed Systems",
            reviewed_by=mentor_id,
            reviewed_at=past_date - timedelta(days=2),
        )
        db.session.add(event)
        db.session.flush()
        print(f"[+] Created completed event: ID {event.id} - '{event.title}'")
    else:
        event.is_completed = True
        event.status = "approved"
        event.attendee_count = 16
        event.event_date = past_date
        db.session.flush()
        print(f"[*] Found existing event: ID {event.id} - updated status to completed")

    # 3. Seed Attended Students (Registrations)
    students = Student.query.order_by(Student.id.asc()).limit(20).all()
    if not students:
        print("[!] No students found to register.")
        return

    # Clear old registrations for this event to avoid duplicate conflicts
    EventRegistration.query.filter_by(event_id=event.id).delete()
    
    # 12 Present, 4 Walk-in, 2 Absent
    present_students = students[:12]
    walkin_students  = students[12:16]
    absent_students  = students[16:18]

    for s in present_students:
        reg = EventRegistration(
            event_id=event.id,
            student_id=s.student_id,
            status=EventAttendanceStatus.PRESENT,
            registered_at=past_date - timedelta(days=4, hours=2)
        )
        db.session.add(reg)

    for s in walkin_students:
        reg = EventRegistration(
            event_id=event.id,
            student_id=s.student_id,
            status=EventAttendanceStatus.WALK_IN,
            registered_at=past_date + timedelta(hours=1)
        )
        db.session.add(reg)

    for s in absent_students:
        reg = EventRegistration(
            event_id=event.id,
            student_id=s.student_id,
            status=EventAttendanceStatus.ABSENT,
            registered_at=past_date - timedelta(days=4)
        )
        db.session.add(reg)

    event.attendee_count = len(present_students) + len(walkin_students)

    db.session.commit()
    print(f"[+] Successfully seeded event attendance: {len(present_students)} Present, {len(walkin_students)} Walk-In, {len(absent_students)} Absent.")

if __name__ == "__main__":
    from app import create_app
    app = create_app()
    with app.app_context():
        seed_completed_event()
