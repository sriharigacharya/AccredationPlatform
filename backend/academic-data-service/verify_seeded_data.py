from app import create_app
from models import db, Student, ClassAttendanceSession
import json

app = create_app()
with app.app_context():
    print("--- Sessions Summary ---")
    for code in ['CS3C01', 'CS5C02', 'CS7C01', 'CS7C03']:
        count = ClassAttendanceSession.query.filter_by(course_code=code).count()
        print(f"Course {code}: {count} sessions")

    print("\n--- Sample Students ---")
    for sid in ['STU001', 'STU003', 'STU036', 'STU041', 'STU069', 'STU072']:
        s = Student.query.filter_by(student_id=sid).first()
        courses = json.loads(s.courses_data or '[]')
        first_c = courses[0] if courses else {}
        print(f"{sid} ({s.name}, Sec {s.section}): Overall Att={s.attendance_pct}%, Int Marks={s.internal_marks}")
        print(f"   First Course ({first_c.get('code')}): Att={first_c.get('attendance_pct')}%, CIE1={first_c.get('cie1')}, CIE2={first_c.get('cie2')}, Quiz1={first_c.get('quiz1')}, EL={first_c.get('el')}, CIE Raw={first_c.get('cie_raw')}")
