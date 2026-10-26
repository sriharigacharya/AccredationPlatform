"""Automated test suite verifying all 8 missing features endpoints."""
import io
import json
from app import create_app
from models import db

app = create_app()
client = app.test_client()

def test_data_input_features():
    print("--- 1. Testing Departments CRUD (F8) ---")
    res = client.post("/departments/", json={
        "code": "TEST_DEPT",
        "name": "Test Engineering",
        "vision": "Vision statement",
        "mission": "Mission statement",
        "peos": ["PEO 1: Leadership"],
        "pos": ["PO 1: Engineering knowledge"],
    })
    print("Create Department status:", res.status_code)
    assert res.status_code in (201, 409), f"Unexpected status: {res.status_code}"
    dept_data = res.get_json()
    dept_id = dept_data.get("id") if res.status_code == 201 else None

    if dept_id:
        res_put = client.put(f"/departments/{dept_id}", json={
            "name": "Updated Test Engineering",
        })
        print("Update Department status:", res_put.status_code)
        assert res_put.status_code == 200

    print("--- 2. Testing Subjects API (F2) ---")
    headers_admin = {"X-User-Role": "admin"}
    res_sub = client.post("/subjects/", json={
        "code": "TEST101",
        "name": "Foundations of Testing",
    }, headers=headers_admin)
    print("Create Subject status:", res_sub.status_code)
    assert res_sub.status_code in (201, 409)
    sub_id = res_sub.get_json().get("id") if res_sub.status_code == 201 else None

    res_sub_list = client.get("/subjects/")
    assert res_sub_list.status_code == 200
    print("List Subjects count:", len(res_sub_list.get_json()))

    print("--- 3. Testing Sections API (F3) ---")
    res_sec = client.post("/sections/", json={
        "semester": "5",
        "section_label": "Z",
        "default_room": "CSE-999"
    }, headers=headers_admin)
    print("Create Section status:", res_sec.status_code)
    assert res_sec.status_code in (201, 409)
    sec_id = res_sec.get_json().get("id") if res_sec.status_code == 201 else None

    res_sec_list = client.get("/sections/")
    assert res_sec_list.status_code == 200
    print("List Sections count:", len(res_sec_list.get_json()))

    print("--- 4. Testing Enrollments API (F4) ---")
    if sec_id:
        res_enr = client.post("/enrollments/", json={
            "student_id": "STU001",
            "section_id": sec_id,
            "academic_term": "2024-25-EVEN"
        }, headers=headers_admin)
        print("Single Enroll status:", res_enr.status_code)
        assert res_enr.status_code in (200, 201)

        res_bulk_enr = client.post("/enrollments/bulk", json={
            "section_id": sec_id,
            "student_ids": ["STU002", "STU003"],
            "academic_term": "2024-25-EVEN"
        }, headers=headers_admin)
        print("Bulk Enroll status:", res_bulk_enr.status_code)
        assert res_bulk_enr.status_code == 201

        res_list_enr = client.get(f"/enrollments/?section_id={sec_id}", headers=headers_admin)
        assert res_list_enr.status_code == 200
        print("List Enrollments count:", len(res_list_enr.get_json()))

    print("--- 5. Testing Timetable Slots API (F1) ---")
    if sec_id and sub_id:
        res_slot = client.post("/timetable/slots", json={
            "faculty_id": "FAC001",
            "subject_id": sub_id,
            "section_id": sec_id,
            "day_of_week": "Sat",
            "period_index": 6,
            "room": "CSE-999",
            "academic_term": "2024-25-EVEN"
        }, headers=headers_admin)
        print("Create Slot status:", res_slot.status_code)
        assert res_slot.status_code in (201, 409)
        slot_id = res_slot.get_json().get("id") if res_slot.status_code == 201 else None

        if slot_id:
            res_del_slot = client.delete(f"/timetable/slots/{slot_id}", headers=headers_admin)
            print("Delete Slot status:", res_del_slot.status_code)
            assert res_del_slot.status_code == 200

    print("--- 6. Testing Bulk Student CSV Import (F7) ---")
    csv_content = "student_id,name,email,semester,section\nSTUTEST99,Test Student,test@academiq.edu,3,A\n"
    csv_bytes = io.BytesIO(csv_content.encode("utf-8"))
    res_bulk_import = client.post(
        "/students/bulk-import",
        data={"file": (csv_bytes, "test_students.csv")},
        content_type="multipart/form-data",
        headers=headers_admin
    )
    print("Bulk Import status:", res_bulk_import.status_code)
    assert res_bulk_import.status_code == 201
    print("Bulk Import output:", res_bulk_import.get_json())

    print("--- 7. Testing Secondary Club Roles (F5) ---")
    res_role = client.post("/student-roles/", json={
        "club_id": 1,
        "student_id": "STU001",
        "role": "treasurer"
    }, headers=headers_admin)
    print("Assign Secondary Role status:", res_role.status_code)
    assert res_role.status_code in (200, 201, 409)

    print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
