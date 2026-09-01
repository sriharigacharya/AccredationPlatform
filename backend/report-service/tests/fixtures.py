"""
Shared test fixtures — fixed data that can be used without any network calls.
"""
from render.report_data import ReportData, ReportSection

FIXED_DEPT = {
    "id": 1, "code": "CSE", "name": "Computer Science and Engineering",
    "vision": "To be a centre of excellence.", "mission": "To educate.",
    "peos": '["PEO1: Graduates will excel in their field."]',
    "pos":  '["PO1: Engineering knowledge."]',
    "placement_stats": None, "research_stats": None,
}

FIXED_STUDENTS = [
    {"student_id": f"STU{i:03d}", "semester": (i % 8) + 1,
     "attendance_pct": 75 + i, "internal_marks": 70 + i,
     "previous_gpa": 7.0 + i * 0.1, "backlogs": 0,
     "final_result": "pass", "engagement": "high"}
    for i in range(30)
]

FIXED_FACULTY = [
    {"faculty_id": "FAC001", "name": "Dr. A", "designation": "Professor",
     "qualification": "Ph.D", "experience": 15, "publications": 20,
     "fdp_participation": "[]", "research_projects": 3},
    {"faculty_id": "FAC002", "name": "Prof. B", "designation": "Associate Professor",
     "qualification": "Ph.D", "experience": 10, "publications": 10,
     "fdp_participation": "[]", "research_projects": 1},
    {"faculty_id": "FAC003", "name": "Mr. C", "designation": "Assistant Professor",
     "qualification": "M.Tech", "experience": 5, "publications": 2,
     "fdp_participation": "[]", "research_projects": 0},
    {"faculty_id": "FAC004", "name": "Ms. D", "designation": "Assistant Professor",
     "qualification": "M.E", "experience": 3, "publications": 1,
     "fdp_participation": "[]", "research_projects": 0},
]


def make_minimal_report_data(sections=None) -> ReportData:
    """Build a minimal ReportData suitable for render tests."""
    if sections is None:
        sections = [
            ReportSection(
                id="5.1", title="Student-Faculty Ratio", marks=30,
                content_type="formula_table", level=2,
                formula_result={"sfr": 7.5, "marks": 30},
                table_headers=["Parameter", "Value"],
                table_rows=[["Total Students", 30], ["Total Faculty", 4],
                             ["SFR", "7.5 : 1"], ["Marks Scored", "30 / 30"]],
            ),
            ReportSection(
                id="5.2", title="Faculty Qualification Index", marks=25,
                content_type="formula_table", level=2,
                formula_result={"fqi": 10.0, "marks": 25},
                table_headers=["Qualification", "Count"],
                table_rows=[["Ph.D", 2], ["M.Tech/ME/MS", 2], ["Marks", "25 / 25"]],
            ),
        ]
    return ReportData(
        sar_format="ug_tier_ii_gapc_v4",
        report_type="nba",
        scope="criterion:5",
        academic_year="2025-26",
        generated_at="2026-08-16T00:00:00Z",
        department=FIXED_DEPT,
        sections=sections,
        institution_name="Test Institution",
        program_name="B.E. Computer Science and Engineering",
        report_id="test-report-001",
    )
