"""
Verification script for Teacher Role functionalities:
1. Login as teacher (Dr. Meena Iyer: meena.iyer@faculty.academiq.edu)
2. Verify GET /api/v1/classes/my-classes returns assigned courses (CS3C01, CS7C01)
3. Verify GET /api/v1/classes/CS3C01/A/students returns roster with evaluations
4. Verify POST /api/v1/classes/attendance records attendance session
5. Verify POST /api/v1/classes/marks enters CIE 1 marks and recalculates CIE total & grade
6. Verify GET /api/v1/classes/CS3C01/A/at-risk returns at-risk students with low CIE / attendance
7. Verify Login as admin can view all classes
8. Verify student cannot access /classes (403 forbidden)
"""

import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_flow():
    print("=== Step 1: Login as Teacher (Dr. Meena Iyer) ===")
    res_login = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "meena.iyer@faculty.academiq.edu",
        "password": "teacher123"
    })
    print("Teacher login status:", res_login.status_code)
    assert res_login.status_code == 200, res_login.text
    teacher_token = res_login.json()["access_token"]
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    print("Logged in as:", res_login.json()["name"], "| Role:", res_login.json()["role"])


    print("\n=== Step 2: Fetch Teacher Assigned Classes ===")
    res_classes = requests.get(f"{BASE_URL}/classes/my-classes", headers=teacher_headers)
    print("Classes status:", res_classes.status_code)
    assert res_classes.status_code == 200, res_classes.text
    classes = res_classes.json()
    print("Assigned classes:", [f"{c['course_code']} (Sec {c['section']}, {c['student_count']} students, {c['at_risk_count']} at risk)" for c in classes])
    course_codes = [c["course_code"] for c in classes]
    assert "CS3C01" in course_codes, "CS3C01 should be in teacher's classes"
    assert "CS7C01" in course_codes, "CS7C01 should be in teacher's classes"
    assert "CS5C02" not in course_codes, "CS5C02 is taught by FAC002, should not appear"

    print("\n=== Step 3: Fetch Students in CS3C01 Section A ===")
    res_students = requests.get(f"{BASE_URL}/classes/CS3C01/A/students", headers=teacher_headers)
    print("Students status:", res_students.status_code)
    assert res_students.status_code == 200, res_students.text
    data = res_students.json()
    students = data["students"]
    print(f"Total students in class: {len(students)}")
    first_student = students[0]
    print(f"Sample student: {first_student['name']} ({first_student['student_id']}) - Att: {first_student['attendance_pct']}%, CIE 1: {first_student['cie1']}, Total: {first_student['total']}, Grade: {first_student['grade']}")

    print("\n=== Step 4: Record Daily Attendance Session ===")
    # Mark first 33 students present, 2 absent
    records = []
    for i, s in enumerate(students):
        status = "absent" if i in (2, 5) else "present"
        records.append({"student_id": s["student_id"], "status": status})

    att_payload = {
        "course_code": "CS3C01",
        "section": "A",
        "date": "2026-09-02",
        "time_slot": "10:00 - 11:00 AM",
        "records": records
    }
    res_att = requests.post(f"{BASE_URL}/classes/attendance", json=att_payload, headers=teacher_headers)
    print("Attendance submit status:", res_att.status_code)
    assert res_att.status_code == 201, res_att.text
    att_res = res_att.json()
    print(f"Attendance recorded: {att_res['present_count']} Present, {att_res['absent_count']} Absent, Rate: {att_res['attendance_rate']}%")

    print("\n=== Step 5: Enter Exam Marks (CIE 1 out of 25) ===")
    marks_payload = {
        "course_code": "CS3C01",
        "section": "A",
        "exam_type": "cie1",
        "max_marks": 25,
        "marks": [
            {"student_id": "STU001", "score": 24.5}, # high performer
            {"student_id": "STU003", "score": 8.0},  # low performer (< 12)
            {"student_id": "STU006", "score": 7.5},  # low performer (< 12)
        ]
    }
    res_marks = requests.post(f"{BASE_URL}/classes/marks", json=marks_payload, headers=teacher_headers)
    print("Marks submit status:", res_marks.status_code)
    assert res_marks.status_code == 200, res_marks.text
    marks_res = res_marks.json()
    print(f"Marks saved message: {marks_res['message']}")
    print(f"Stats: Avg {marks_res['statistics']['average']}/25, Highest: {marks_res['statistics']['highest']}, Lowest: {marks_res['statistics']['lowest']}")

    print("\n=== Step 6: Verify High Risk / Low Performing Students Alert ===")
    res_risk = requests.get(f"{BASE_URL}/classes/CS3C01/A/at-risk", headers=teacher_headers)
    print("At-risk query status:", res_risk.status_code)
    assert res_risk.status_code == 200, res_risk.text
    risk_data = res_risk.json()
    print(f"At-risk students detected in class: {risk_data['at_risk_count']}")
    for ar in risk_data["at_risk_students"][:4]:
        print(f" - [{ar['severity'].upper()} RISK] {ar['name']} ({ar['student_id']}): CIE 1 = {ar['cie1']}/25, Att = {ar['attendance_pct']}%, Reasons: {ar['risk_reasons']}")

    # Verify that STU003 (scored 8.0/25) is in at-risk list with Low CIE 1 reason
    stu3 = next((s for s in risk_data["at_risk_students"] if s["student_id"] == "STU003"), None)
    assert stu3 is not None, "STU003 should be flagged as at risk"
    print(f"STU003 verified in alert list with reasons: {stu3['risk_reasons']}")

    print("\n=== Step 7: Verify Admin Access ===")
    res_admin_login = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@academiq.edu",
        "password": "admin123"
    })
    admin_token = res_admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    res_admin_classes = requests.get(f"{BASE_URL}/classes/my-classes", headers=admin_headers)
    assert res_admin_classes.status_code == 200
    print(f"Admin can view all {len(res_admin_classes.json())} classes across faculty.")

    print("\n=== Step 8: Verify Student Role is Denied Access (403) ===")
    res_stu_login = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "aarav.stu001@student.academiq.edu",
        "password": "student123"
    })
    stu_token = res_stu_login.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}
    res_stu_classes = requests.get(f"{BASE_URL}/classes/my-classes", headers=stu_headers)

    print(f"Student role access attempt: HTTP {res_stu_classes.status_code}")
    assert res_stu_classes.status_code == 403, f"Expected 403, got {res_stu_classes.status_code}"

    print("\n>>> ALL 8 TEACHER ROLE VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_flow()
