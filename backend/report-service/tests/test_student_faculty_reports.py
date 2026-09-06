"""
Tests for Individual Student Report and Faculty Report Generation.
Verifies that:
1. build_student_report_data produces structured dossier with student profile, courses, and synthesis.
2. build_faculty_report_data produces structured dossier with faculty credentials, courses, publications, and projects.
3. PDF and DOCX render without error.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch
import pytest
from render.builder import build_student_report_data, build_faculty_report_data
from render.pdf_renderer import render_pdf
from render.docx_renderer import render_docx

MOCK_CONFIG = {
    "ACADEMIC_DATA_SERVICE_URL": "http://mock-academic:8002",
    "NLP_RAG_SERVICE_URL": "http://mock-nlp:8005",
    "PREDICTION_SERVICE_URL": "http://mock-predict:8006",
    "REPORTS_DIR": "/tmp/reports",
}

MOCK_STUDENT = {
    "id": 11,
    "student_id": "STU011",
    "name": "Farhan Sheikh",
    "email": "farhan@student.edu",
    "phone": "9000000011",
    "semester": 3,
    "section": "A",
    "attendance_pct": 91.7,
    "cgpa": 4.8,
    "previous_gpa": 4.8,
    "internal_marks": 30.0,
    "assignment_score_pct": 40.0,
    "backlogs": 6,
    "final_result": "Fail",
    "engagement": "Low",
    "department": {"code": "CSE", "name": "Computer Science & Engineering"},
    "courses": [
        {"code": "CS3C01", "name": "Data Structures & Algorithms", "credits": 4, "attendance_pct": 66.7, "status": "pending"},
        {"code": "CS3C02", "name": "Digital Logic", "credits": 4, "attendance_pct": 100.0, "status": "pending"},
    ]
}

MOCK_FACULTY = {
    "id": 1,
    "faculty_id": "FAC001",
    "name": "Dr. Meena Iyer",
    "email": "meena@faculty.edu",
    "phone": "9876500001",
    "designation": "Associate Professor",
    "qualification": "Ph.D (CSE)",
    "experience": "15 years",
    "department_id": 1,
    "courses_taught": ["Data Structures", "Machine Learning"],
    "publications": ["Deep Learning in Healthcare — IEEE 2024", "NLP Survey — Springer 2023"],
    "research_projects": ["SERB Grant: Medical Diagnosis (18L)"],
    "awards": ["Best Faculty Award 2022"],
    "fdp_participation": ["AICTE FDP on ML 2024"],
}


def test_build_student_report_data():
    with patch("data_client.fetch_student", return_value=MOCK_STUDENT):
        report = build_student_report_data(MOCK_CONFIG, "STU011", "2025-26", "rep-stu-1")
        assert report.report_type == "student_report"
        assert report.scope == "student:STU011"
        assert len(report.sections) >= 3

        # Section 1: Profile table
        sec1 = report.sections[0]
        assert "Profile" in sec1.title
        assert sec1.table_headers == ["Metric / Attribute", "Student Record Detail"]
        flat_rows = " ".join([str(cell) for row in sec1.table_rows for cell in row])
        assert "STU011" in flat_rows
        assert "Farhan Sheikh" in flat_rows
        assert "91.7%" in flat_rows

        # PDF & DOCX rendering
        pdf_bytes = render_pdf(report)
        assert len(pdf_bytes) > 5000
        docx_bytes = render_docx(report)
        assert len(docx_bytes) > 5000


def test_build_faculty_report_data():
    with patch("data_client.fetch_faculty", return_value=MOCK_FACULTY), \
         patch("data_client.fetch_department", return_value={"name": "Computer Science & Engineering", "code": "CSE"}):
        report = build_faculty_report_data(MOCK_CONFIG, "FAC001", "2025-26", "rep-fac-1")
        assert report.report_type == "faculty_report"
        assert report.scope == "faculty:FAC001"
        assert len(report.sections) >= 4

        # Section 1: Profile table
        sec1 = report.sections[0]
        assert "Profile" in sec1.title
        flat_rows = " ".join([str(cell) for row in sec1.table_rows for cell in row])
        assert "FAC001" in flat_rows
        assert "Dr. Meena Iyer" in flat_rows

        # PDF & DOCX rendering
        pdf_bytes = render_pdf(report)
        assert len(pdf_bytes) > 5000
        docx_bytes = render_docx(report)
        assert len(docx_bytes) > 5000
