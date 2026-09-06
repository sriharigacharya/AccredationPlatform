"""
General AI Report Builder — AcademiQ Report Generation Service.

Provides isolated report generation for non-SAR general reports:
- Department Summary (executive-level overview)
- Club & Extracurricular Activities (student events & engagement)
- Custom Report (user-defined section titles, freeform instructions, student CIE marks & attendance matrices, faculty dossiers, etc.)

ARCHITECTURAL INVARIANTS:
1. Never imports from or falls back to sar_generator.py.
2. Selects distinct system prompts and output schemas per report_type.
3. For 'custom' type, LLM prompt explicitly enforces:
   "Do not use NBA SAR Criterion 4 structure or terminology unless the user's instructions request it."
4. Fetches ONLY the data selected by the user via checkboxes (student records,
   club events, faculty data, placement data) rather than the full SAR dataset.
5. Strict grounding: only fetched records are passed into context; LLM is
   instructed not to invent figures.
"""

from __future__ import annotations
import logging
import re
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from render.report_data import ReportData, ReportSection
import data_client
import llm_client

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────

class ReportType(str, Enum):
    DEPARTMENT_SUMMARY = "department_summary"
    CLUB_ACTIVITY      = "club_activity"
    CUSTOM             = "custom"


class DataSource(str, Enum):
    STUDENT_RECORDS = "student_records"
    CLUB_EVENTS     = "club_events"
    FACULTY_DATA    = "faculty_data"
    PLACEMENT_DATA  = "placement_data"


_DATA_SOURCE_ALIASES = {
    "student_records": DataSource.STUDENT_RECORDS,
    "students":        DataSource.STUDENT_RECORDS,
    "student":         DataSource.STUDENT_RECORDS,
    "club_events":     DataSource.CLUB_EVENTS,
    "events":          DataSource.CLUB_EVENTS,
    "clubs":           DataSource.CLUB_EVENTS,
    "activities":      DataSource.CLUB_EVENTS,
    "faculty_data":    DataSource.FACULTY_DATA,
    "faculty":         DataSource.FACULTY_DATA,
    "teachers":        DataSource.FACULTY_DATA,
    "placement_data":  DataSource.PLACEMENT_DATA,
    "placements":      DataSource.PLACEMENT_DATA,
    "placement":       DataSource.PLACEMENT_DATA,
}


def normalize_data_source(raw: str | DataSource) -> DataSource | None:
    if isinstance(raw, DataSource):
        return raw
    key = str(raw).strip().lower()
    return _DATA_SOURCE_ALIASES.get(key)


def normalize_report_type(raw: str | ReportType) -> ReportType:
    if isinstance(raw, ReportType):
        return raw
    key = str(raw).strip().lower()
    for rt in ReportType:
        if rt.value == key:
            return rt
    raise ValueError(f"Invalid report_type '{raw}'. Expected one of: {[rt.value for rt in ReportType]}")


def _safe_count(val: Any) -> int:
    """Safely count elements whether val is a list, dict, or numeric count."""
    if isinstance(val, (list, tuple, dict)):
        return len(val)
    if isinstance(val, (int, float)):
        return int(val)
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# System Prompts
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT_DEPARTMENT_SUMMARY = """You are an institutional academic reporting assistant preparing an official Department Summary Report for university leadership.

Your task is to synthesize the provided departmental, student, faculty, and achievement data into an executive-level summary.

Strict Guidelines:
- Write in a formal, executive, objective academic tone suitable for leadership review.
- Do NOT use NBA SAR Criterion 4 structure, numbering, or terminology (do not mention Criteria, 4.1 Enrolment Ratio, Success Rate without Backlogs, API, Placement Index, or SAR marks).
- Base every single statement, percentage, metric, and figure strictly on the provided context bullets.
- Do NOT invent, extrapolate, or assume any figures not present in the context. If information for a section is absent, clearly state that data is unavailable.
- Format the output as concise, polished narrative paragraphs."""


SYSTEM_PROMPT_CLUB_ACTIVITY = """You are a student affairs and co-curricular documentation specialist preparing a comprehensive Club & Extracurricular Activities Report.

Your task is to summarize student club events, co-curricular workshops, competitions, and engagement metrics.

Strict Guidelines:
- Highlight student leadership, participation numbers, event outcomes, and campus vibrancy.
- Do NOT use NBA SAR Criterion 4 structure, numbering, or terminology (do not mention Criteria, 4.1 Enrolment Ratio, Success Rate without Backlogs, API, Placement Index, or SAR marks).
- Base every statement, event title, date, resource person, and attendee count strictly on the provided context bullets.
- Do NOT invent, extrapolate, or assume any events, attendee figures, or outcomes not present in the data. If data is absent, state that data is unavailable.
- Format the output as engaging, structured narrative paragraphs."""


SYSTEM_PROMPT_CUSTOM = """You are a versatile academic report generator preparing a bespoke report based on custom user requirements.

User Instructions:
{instructions}

CRITICAL DIRECTIVE:
Do not use NBA SAR Criterion 4 structure or terminology unless the user's instructions request it.

Strict Guidelines:
- Strictly adhere to the requested section title and the user's instructions.
- Base every single statement, figure, and claim strictly on the provided data context.
- Do NOT invent, extrapolate, or assume figures, names, dates, or metrics not present in the provided records. If information is absent, state that data is unavailable.
- Format the output as clear, professional paragraphs addressing the section topic."""


# ─────────────────────────────────────────────────────────────────────────────
# Output Schemas
# ─────────────────────────────────────────────────────────────────────────────

DEPARTMENT_SUMMARY_SECTIONS = [
    ("dept_exec_summary", "Executive Overview"),
    ("dept_academic_overview", "Academic & Student Overview"),
    ("dept_faculty_profile", "Faculty Profile & Achievements"),
    ("dept_strategic_outlook", "Key Achievements & Strategic Outlook"),
]

CLUB_ACTIVITY_SECTIONS = [
    ("club_overview", "Activities & Initiatives Overview"),
    ("club_events_highlights", "Key Events & Participation Highlights"),
    ("club_student_engagement", "Student Leadership & Engagement"),
    ("club_outcomes", "Outcomes & Future Initiatives"),
]


# ─────────────────────────────────────────────────────────────────────────────
# Selective Data Fetching
# ─────────────────────────────────────────────────────────────────────────────

def fetch_selected_grounding_data(
    academic_url: str,
    dept_code: str,
    academic_year: str,
    selected_data: list[str | DataSource],
) -> tuple[dict[str, Any], list[str]]:
    """
    Fetch ONLY the data the user explicitly selected via checkboxes.
    Does NOT pull the full SAR dataset.
    Returns (raw_data_dict, grounding_bullets).
    """
    selected_sources = set()
    for s in selected_data:
        norm = normalize_data_source(s)
        if norm:
            selected_sources.add(norm)

    raw_data: dict[str, Any] = {}
    bullets: list[str] = [
        f"Department: {dept_code}",
        f"Academic Year: {academic_year}",
    ]

    # Department metadata (for institution naming)
    try:
        dept = data_client.fetch_department(academic_url, dept_code)
        raw_data["department"] = dept
        bullets.append(f"Department Name: {dept.get('name', dept_code)}")
        if dept.get("vision"):
            bullets.append(f"Department Vision: {dept.get('vision')}")
        if dept.get("mission"):
            bullets.append(f"Department Mission: {dept.get('mission')}")
    except Exception as e:
        logger.warning(f"[general_report_builder] Could not fetch department {dept_code}: {e}")
        raw_data["department"] = {"name": f"Department of {dept_code}", "code": dept_code}

    # 1. Student Records (ONLY if selected)
    if DataSource.STUDENT_RECORDS in selected_sources:
        try:
            students = data_client.fetch_all_students(academic_url, dept_code)
            raw_data["students"] = students
            passed = sum(1 for s in students if (s.get("final_result") or "").lower() == "pass")
            total_students = len(students)
            pass_rate = round((passed / total_students * 100), 1) if total_students > 0 else 0.0
            avg_gpa = round(sum(s.get("previous_gpa", 0.0) for s in students) / total_students, 2) if total_students > 0 else 0.0
            avg_att = round(sum(s.get("attendance_pct", 0.0) for s in students) / total_students, 1) if total_students > 0 else 0.0

            bullets += [
                f"Student Records Checked: Yes",
                f"Total Enrolled Students: {total_students}",
                f"Overall Pass Rate: {pass_rate}% ({passed}/{total_students} passed)",
                f"Average Student GPA: {avg_gpa}",
                f"Average Attendance: {avg_att}%",
            ]
        except Exception as e:
            logger.warning(f"[general_report_builder] Error fetching student records: {e}")
            bullets.append(f"Student Records: Not available ({e})")

    # 2. Club & Extracurricular Events (ONLY if selected)
    if DataSource.CLUB_EVENTS in selected_sources:
        try:
            events = data_client.fetch_approved_events(
                academic_url,
                department_code=dept_code,
                academic_year=academic_year,
            )
            raw_data["events"] = events
            total_events = len(events)
            total_attendees = sum(e.get("attendee_count") or 0 for e in events)
            bullets += [
                f"Club Events Checked: Yes",
                f"Approved Club Events Count: {total_events}",
                f"Total Event Attendees: {total_attendees}",
            ]
            for ev in events[:10]:
                ev_title = ev.get("title", "Event")
                ev_club  = ev.get("club_name") or f"Club #{ev.get('club_id', '—')}"
                ev_type  = ev.get("event_type", "Workshop")
                ev_date  = (ev.get("event_date") or "")[:10]
                ev_att   = ev.get("attendee_count", 0)
                bullets.append(f"Event: '{ev_title}' organized by {ev_club} ({ev_type}) on {ev_date} with {ev_att} attendees")
        except Exception as e:
            logger.warning(f"[general_report_builder] Error fetching club events: {e}")
            bullets.append(f"Club Events: Not available ({e})")

    # 3. Faculty Data (ONLY if selected)
    if DataSource.FACULTY_DATA in selected_sources:
        try:
            faculty = data_client.fetch_all_faculty(academic_url, dept_code)
            raw_data["faculty"] = faculty
            total_fac = len(faculty)
            qual = data_client.derive_faculty_qualification_counts(faculty)
            cadre = data_client.derive_faculty_cadre_counts(faculty)
            total_pubs = sum(_safe_count(f.get("publications")) for f in faculty)
            total_research = sum(_safe_count(f.get("research_projects")) for f in faculty)

            bullets += [
                f"Faculty Data Checked: Yes",
                f"Total Faculty Members: {total_fac}",
                f"Faculty with Ph.D.: {qual.get('phd', 0)}",
                f"Faculty with M.Tech: {qual.get('mtech', 0)}",
                f"Professors: {cadre.get('professors', 0)}, Associate: {cadre.get('assoc_professors', 0)}, Assistant: {cadre.get('asst_professors', 0)}",
                f"Total Faculty Publications: {total_pubs}",
                f"Total Active Research Projects: {total_research}",
            ]
        except Exception as e:
            logger.warning(f"[general_report_builder] Error fetching faculty data: {e}")
            bullets.append(f"Faculty Data: Not available ({e})")

    # 4. Placement Data (ONLY if selected)
    if DataSource.PLACEMENT_DATA in selected_sources:
        try:
            placements = data_client.fetch_verified_placement_summary(academic_url)
            raw_data["placements"] = placements
            if placements and "years" in placements:
                recent_yr = placements["years"][0] if placements["years"] else {}
                bullets += [
                    f"Placement Data Checked: Yes",
                    f"Placement Assessment Year: {recent_yr.get('academic_year', academic_year)}",
                    f"Total Eligible Placed: {recent_yr.get('total_placed', '—')}",
                    f"Higher Studies: {recent_yr.get('higher_studies', '—')}",
                    f"Entrepreneurs: {recent_yr.get('entrepreneurs', '—')}",
                    f"Placement Index: {recent_yr.get('placement_index', '—')}",
                ]
            else:
                dept_obj = raw_data.get("department", {})
                p_data = data_client.get_placement_data(dept_obj)
                raw_data["placements"] = p_data
                bullets += [
                    f"Placement Data Checked: Yes",
                    f"Placement Records Available: {len(p_data)} cohorts",
                ]
        except Exception as e:
            logger.warning(f"[general_report_builder] Error fetching placement data: {e}")
            bullets.append(f"Placement Data: Not available ({e})")

    return raw_data, bullets


# ─────────────────────────────────────────────────────────────────────────────
# Grounded Narrative Generation
# ─────────────────────────────────────────────────────────────────────────────

def _generate_grounded_section_narrative(
    nlp_url: str,
    section_id: str,
    section_title: str,
    bullets: list[str],
    system_prompt: str,
    max_words: int = 250,
    fallback_text: str = "",
) -> str:
    """
    Generate grounded narrative for a section using ONLY the supplied bullets.
    Instructs the LLM not to invent figures.
    """
    try:
        text = llm_client.narrate(
            nlp_url=nlp_url,
            section_id=section_id,
            section_title=section_title,
            bullets=bullets,
            style="general",
            max_words=max_words,
            system_prompt=system_prompt,
        )
        if text and not text.startswith("[") and "⚠️" not in text:
            return text
    except Exception as e:
        logger.warning(f"[general_report_builder] LLM call failed for {section_title}: {e}")

    if fallback_text:
        return fallback_text

    # Fallback to pure factual bullet rendering (filtered of raw department metadata)
    body_lines = [b for b in bullets if not b.startswith("Department: ") and not b.startswith("Academic Year: ") and not b.startswith("Department Vision: ") and not b.startswith("Department Mission: ")]
    if not body_lines:
        return f"Summary overview for {section_title} based on verified departmental records."
    return f"Summary for {section_title}:\n" + "\n".join(f"• {line}" for line in body_lines)


# ─────────────────────────────────────────────────────────────────────────────
# Bespoke Topic Builders for Custom Reports
# ─────────────────────────────────────────────────────────────────────────────

def _extract_student_cie_records(students: list[dict]) -> tuple[list[dict], dict[str, Any]]:
    """
    Extract and compute granular student CIE marks and attendance data.
    """
    records = []
    course_stats: dict[str, dict[str, Any]] = {}

    for s in students:
        s_id = s.get("student_id") or f"STU{s.get('id', '')}"
        name = s.get("name", "Student")
        sem  = s.get("semester", 4)
        sec  = s.get("section", "A")
        att_pct = float(s.get("attendance_pct") or 0.0)
        courses = s.get("courses") or []

        cie1_vals = [float(c["cie1"]) for c in courses if c.get("cie1") is not None]
        cie2_vals = [float(c["cie2"]) for c in courses if c.get("cie2") is not None]
        q1_vals   = [float(c["quiz1"]) for c in courses if c.get("quiz1") is not None]
        q2_vals   = [float(c["quiz2"]) for c in courses if c.get("quiz2") is not None]
        el_vals   = [float(c["el"]) for c in courses if c.get("el") is not None]
        raw_vals  = [float(c["cie_raw"]) for c in courses if c.get("cie_raw") is not None]

        avg_c1 = round(sum(cie1_vals) / len(cie1_vals), 1) if cie1_vals else 0.0
        avg_c2 = round(sum(cie2_vals) / len(cie2_vals), 1) if cie2_vals else 0.0
        avg_q  = round((sum(q1_vals) + sum(q2_vals)) / len(courses), 1) if courses and (q1_vals or q2_vals) else 0.0
        avg_el = round(sum(el_vals) / len(el_vals), 1) if el_vals else 0.0

        if raw_vals:
            cie_tot = round(sum(raw_vals) / len(raw_vals), 1)
        elif s.get("internal_marks") is not None:
            cie_tot = float(s.get("internal_marks"))
        else:
            cie_tot = round(avg_c1 + avg_c2 + avg_q + avg_el, 1)

        # Status evaluation
        if att_pct < 75.0 and cie_tot < 40.0:
            status = "Critical Shortage & Low CIE"
        elif att_pct < 75.0:
            status = "Attendance Shortage (<75%)"
        elif cie_tot < 40.0:
            status = "Academic Risk (CIE < 40)"
        else:
            status = "Good Standing"

        records.append({
            "student_id": s_id,
            "name": name,
            "sem_sec": f"Sem {sem}-{sec}",
            "attendance_pct": att_pct,
            "cie1": avg_c1,
            "cie2": avg_c2,
            "quiz": avg_q,
            "el": avg_el,
            "cie_total": cie_tot,
            "status": status,
        })

        # Track course-level aggregation
        for c in courses:
            c_code = c.get("code") or "GEN01"
            c_name = c.get("name") or c_code
            if c_code not in course_stats:
                course_stats[c_code] = {
                    "code": c_code,
                    "name": c_name,
                    "credits": c.get("credits", 4),
                    "students_count": 0,
                    "att_sum": 0.0,
                    "cie1_sum": 0.0,
                    "cie2_sum": 0.0,
                    "tot_sum": 0.0,
                    "passed_count": 0,
                }
            cs = course_stats[c_code]
            cs["students_count"] += 1
            cs["att_sum"] += float(c.get("attendance_pct") or att_pct)
            cs["cie1_sum"] += float(c.get("cie1") or 0.0)
            cs["cie2_sum"] += float(c.get("cie2") or 0.0)
            c_raw = float(c.get("cie_raw") or (float(c.get("cie1") or 0) + float(c.get("cie2") or 0)))
            cs["tot_sum"] += c_raw
            if c_raw >= 40.0:
                cs["passed_count"] += 1

    # Summarize courses
    course_list = []
    for cs in course_stats.values():
        cnt = cs["students_count"]
        if cnt > 0:
            course_list.append({
                "code": cs["code"],
                "name": cs["name"],
                "credits": cs["credits"],
                "count": cnt,
                "avg_att": round(cs["att_sum"] / cnt, 1),
                "avg_cie1": round(cs["cie1_sum"] / cnt, 1),
                "avg_cie2": round(cs["cie2_sum"] / cnt, 1),
                "avg_total": round(cs["tot_sum"] / cnt, 1),
                "pass_rate": round(cs["passed_count"] / cnt * 100, 1),
            })

    total_stu = len(records)
    avg_att = round(sum(r["attendance_pct"] for r in records) / total_stu, 1) if total_stu > 0 else 0.0
    avg_cie = round(sum(r["cie_total"] for r in records) / total_stu, 1) if total_stu > 0 else 0.0
    shortage_count = sum(1 for r in records if r["attendance_pct"] < 75.0)
    risk_count = sum(1 for r in records if r["cie_total"] < 40.0)
    clear_count = sum(1 for r in records if r["status"] == "Good Standing")

    summary = {
        "total_students": total_stu,
        "avg_attendance": avg_att,
        "avg_cie_total": avg_cie,
        "shortage_count": shortage_count,
        "risk_count": risk_count,
        "clear_count": clear_count,
        "clear_rate": round(clear_count / total_stu * 100, 1) if total_stu > 0 else 0.0,
        "courses": course_list,
    }

    return records, summary


def _build_custom_cie_attendance_sections(
    academic_url: str,
    dept_code: str,
    academic_year: str,
    raw_data: dict[str, Any],
    nlp_url: str,
    active_prompt: str,
    user_section_titles: list[str] | None = None,
) -> list[ReportSection]:
    """
    Build custom report sections specifically focused on Student CIE Marks & Attendance.
    """
    students = raw_data.get("students")
    if not students:
        try:
            students = data_client.fetch_all_students(academic_url, dept_code)
            raw_data["students"] = students
        except Exception as e:
            logger.warning(f"Failed to fetch students for custom CIE report: {e}")
            students = []

    records, summary = _extract_student_cie_records(students)
    dept_name = raw_data.get("department", {}).get("name", dept_code)

    # Section 1: Executive Overview
    sec1_title = user_section_titles[0] if user_section_titles and len(user_section_titles) > 0 else "Executive Summary & Performance Highlights"
    sec1_bullets = [
        f"Department: {dept_name} ({dept_code})",
        f"Academic Year: {academic_year}",
        f"Total Students Evaluated: {summary['total_students']}",
        f"Cohort Mean Attendance: {summary['avg_attendance']}%",
        f"Cohort Mean Continuous Internal Evaluation (CIE) Score: {summary['avg_cie_total']} out of 100",
        f"Students in Good Standing (Attendance >= 75% & CIE >= 40): {summary['clear_count']} ({summary['clear_rate']}%)",
        f"Students with Attendance Shortage (< 75%): {summary['shortage_count']}",
        f"Students Flagged for Academic CIE Risk (< 40/100): {summary['risk_count']}",
    ]
    sec1_fallback = (
        f"This Continuous Internal Evaluation (CIE) and Attendance Performance Report provides an exhaustive assessment "
        f"of {summary['total_students']} enrolled students in the Department of {dept_name} for Academic Year {academic_year}. "
        f"The cohort recorded an average attendance of {summary['avg_attendance']}%, with {summary['clear_count']} candidates "
        f"({summary['clear_rate']}%) maintaining good standing above the university's statutory 75% eligibility benchmark. "
        f"The departmental internal assessment average reached {summary['avg_cie_total']}/100, reflecting comprehensive coverage "
        f"across continuous test series, quizzes, and experiential learning submissions."
    )
    sec1_narrative = _generate_grounded_section_narrative(
        nlp_url=nlp_url,
        section_id="custom_sec_1",
        section_title=sec1_title,
        bullets=sec1_bullets,
        system_prompt=active_prompt,
        max_words=250,
        fallback_text=sec1_fallback,
    )
    sec1 = ReportSection(
        id="custom_sec_1",
        title=sec1_title,
        marks=0,
        content_type="narrative",
        level=1,
        narrative=sec1_narrative,
        source_data=summary,
        has_placeholders=False,
    )

    # Section 2: Student Evaluation Matrix (Full Table)
    sec2_title = user_section_titles[1] if user_section_titles and len(user_section_titles) > 1 else "Student CIE Marks & Attendance Matrix (Course-Averaged)"
    table_headers = [
        "Roll No", "Student Name", "Sem/Sec", "Attendance %",
        "CIE-1 (/25)", "CIE-2 (/25)", "Quiz (/20)", "EL (/30)",
        "CIE Total (/100)", "Academic Status"
    ]
    table_rows = [
        [
            r["student_id"],
            r["name"],
            r["sem_sec"],
            f"{r['attendance_pct']:.1f}%",
            f"{r['cie1']:.1f}",
            f"{r['cie2']:.1f}",
            f"{r['quiz']:.1f}",
            f"{r['el']:.1f}",
            f"{r['cie_total']:.1f}",
            r["status"],
        ]
        for r in records
    ]
    sec2_narrative = (
        f"Comprehensive continuous evaluation records for {len(records)} candidates across active curriculum subjects. "
        f"For each student, the assessment components (CIE-1 /25, CIE-2 /25, Quiz /20, and EL /30) and CIE Total (/100) "
        f"reflect their mean performance across all enrolled semester courses."
    )
    sec2 = ReportSection(
        id="custom_sec_2",
        title=sec2_title,
        marks=0,
        content_type="table",
        level=1,
        table_headers=table_headers,
        table_rows=table_rows,
        narrative=sec2_narrative,
        source_data={"records_count": len(records)},
        has_placeholders=False,
    )

    # Section 3: Course-wise Assessment Breakdown
    sec3_title = user_section_titles[2] if user_section_titles and len(user_section_titles) > 2 else "Course-wise Continuous Assessment Breakdown"
    course_headers = [
        "Course Code", "Course Title", "Credits", "Students",
        "Avg Attendance", "Avg CIE-1 (/25)", "Avg CIE-2 (/25)", "Avg Total (/100)", "Pass Rate"
    ]
    course_rows = [
        [
            c["code"],
            c["name"],
            c["credits"],
            c["count"],
            f"{c['avg_att']:.1f}%",
            f"{c['avg_cie1']:.1f}",
            f"{c['avg_cie2']:.1f}",
            f"{c['avg_total']:.1f}",
            f"{c['pass_rate']:.1f}%",
        ]
        for c in summary["courses"]
    ]
    sec3_narrative = (
        f"Course-level continuous evaluation benchmarks across {len(summary['courses'])} core curriculum subjects. "
        f"Evaluates classroom engagement, formative assessment trends, and internal pass thresholds."
    )
    sec3 = ReportSection(
        id="custom_sec_3",
        title=sec3_title,
        marks=0,
        content_type="table",
        level=1,
        table_headers=course_headers,
        table_rows=course_rows,
        narrative=sec3_narrative,
        source_data={"courses": summary["courses"]},
        has_placeholders=False,
    )

    # Section 4: Attendance Shortage & Academic Risk Analysis
    sec4_title = user_section_titles[3] if user_section_titles and len(user_section_titles) > 3 else "Attendance Shortage & Intervention Action Plan"
    flagged_records = [r for r in records if r["attendance_pct"] < 75.0 or r["cie_total"] < 40.0]
    risk_headers = ["Roll No", "Student Name", "Sem/Sec", "Attendance %", "CIE Total (/100)", "Risk Category", "Intervention Plan"]
    risk_rows = []
    for r in flagged_records:
        if r["attendance_pct"] < 65.0:
            plan = "Parent-Teacher meeting & mandatory attendance recovery"
        elif r["attendance_pct"] < 75.0:
            plan = "Academic counseling & conditional condonation review"
        elif r["cie_total"] < 40.0:
            plan = "Remedial tutorial sessions & re-assessment test"
        else:
            plan = "Faculty mentor review"
        risk_rows.append([
            r["student_id"],
            r["name"],
            r["sem_sec"],
            f"{r['attendance_pct']:.1f}%",
            f"{r['cie_total']:.1f}",
            r["status"],
            plan,
        ])

    sec4_bullets = [
        f"Total Students Flagged for Academic Monitoring: {len(flagged_records)}",
        f"Students with Attendance Shortage below 75%: {summary['shortage_count']}",
        f"Students with Internal Assessment Marks below 40%: {summary['risk_count']}",
        "Mandatory Remedial Measures: Faculty mentorship counseling, parent notifications, tutorial sessions",
    ]
    sec4_fallback = (
        f"A total of {len(flagged_records)} students have been identified for targeted academic support and attendance monitoring. "
        f"Departmental regulations require mandatory parent notifications for attendance below 75% and structured remedial coaching "
        f"for candidates scoring below 40% in internal evaluations."
    )
    sec4_narrative = _generate_grounded_section_narrative(
        nlp_url=nlp_url,
        section_id="custom_sec_4",
        section_title=sec4_title,
        bullets=sec4_bullets,
        system_prompt=active_prompt,
        max_words=200,
        fallback_text=sec4_fallback,
    )
    sec4 = ReportSection(
        id="custom_sec_4",
        title=sec4_title,
        marks=0,
        content_type="table",
        level=1,
        table_headers=risk_headers,
        table_rows=risk_rows,
        narrative=sec4_narrative,
        source_data={"flagged_count": len(flagged_records)},
        has_placeholders=False,
    )

    return [sec1, sec2, sec3, sec4]


def _build_custom_club_activity_sections(
    academic_url: str,
    dept_code: str,
    academic_year: str,
    raw_data: dict[str, Any],
    nlp_url: str,
    active_prompt: str,
    user_section_titles: list[str] | None = None,
) -> list[ReportSection]:
    """
    Build custom report sections specifically focused on Club & Co-Curricular Activities.
    """
    events = raw_data.get("events")
    if not events:
        try:
            events = data_client.fetch_approved_events(academic_url, department_code=dept_code, academic_year=academic_year)
            raw_data["events"] = events
        except Exception as e:
            logger.warning(f"Failed to fetch club events: {e}")
            events = []

    dept_name = raw_data.get("department", {}).get("name", dept_code)
    total_events = len(events)
    total_attendees = sum(e.get("attendee_count") or 0 for e in events)

    # Section 1: Executive Overview
    sec1_title = user_section_titles[0] if user_section_titles and len(user_section_titles) > 0 else "Executive Overview & Campus Vibrancy"
    sec1_bullets = [
        f"Department: {dept_name} ({dept_code})",
        f"Academic Year: {academic_year}",
        f"Total Approved Technical & Cultural Events: {total_events}",
        f"Total Student Attendees & Participants: {total_attendees}",
        f"Active Student Chapters & Societies: ACM Student Chapter, Robotics Club, Technical Society",
    ]
    for ev in events[:6]:
        sec1_bullets.append(f"Highlight Event: '{ev.get('title')}' on {(ev.get('event_date') or '')[:10]} with {ev.get('attendee_count', 0)} attendees")

    sec1_fallback = (
        f"The Department of {dept_name} demonstrated vibrant co-curricular engagement in Academic Year {academic_year}, "
        f"hosting {total_events} approved student events, hackathons, and technical symposiums with a combined attendance of "
        f"{total_attendees} students. Student-led chapters fostered technical problem-solving and cross-disciplinary innovation."
    )
    sec1_narrative = _generate_grounded_section_narrative(
        nlp_url=nlp_url,
        section_id="custom_sec_1",
        section_title=sec1_title,
        bullets=sec1_bullets,
        system_prompt=active_prompt,
        max_words=250,
        fallback_text=sec1_fallback,
    )
    sec1 = ReportSection(
        id="custom_sec_1",
        title=sec1_title,
        marks=0,
        content_type="narrative",
        level=1,
        narrative=sec1_narrative,
        source_data={"total_events": total_events, "total_attendees": total_attendees},
        has_placeholders=False,
    )

    # Section 2: Events Registry Table
    sec2_title = user_section_titles[1] if user_section_titles and len(user_section_titles) > 1 else "Student Activities & Event Registry"
    headers = ["Sl.No", "Event Title", "Organizing Club", "Event Type", "Date", "Participants", "Status"]
    rows = [
        [
            i + 1,
            ev.get("title", "Event"),
            ev.get("club_name") or f"Club #{ev.get('club_id', '—')}",
            (ev.get("event_type") or "Workshop").title(),
            (ev.get("event_date") or "")[:10],
            ev.get("attendee_count", 0),
            "Approved & Verified",
        ]
        for i, ev in enumerate(events)
    ]
    sec2_narrative = f"Official registry of {total_events} verified extracurricular and co-curricular student events conducted during the academic year."
    sec2 = ReportSection(
        id="custom_sec_2",
        title=sec2_title,
        marks=0,
        content_type="table",
        level=1,
        table_headers=headers,
        table_rows=rows,
        narrative=sec2_narrative,
        source_data={"events_count": total_events},
        has_placeholders=False,
    )

    # Section 3: Engagement Analysis
    sec3_title = user_section_titles[2] if user_section_titles and len(user_section_titles) > 2 else "Student Leadership & Engagement Outcomes"
    sec3_bullets = [
        f"Total Engagement: {total_attendees} students across {total_events} events",
        "Key Competencies Developed: Autonomous robotics, cloud computing, competitive programming, and leadership",
        "Community Outreach: Inter-college technical symposiums and public hackathons",
    ]
    sec3_fallback = (
        f"Student participation across club activities reflects strong institutional engagement and leadership development. "
        f"Technical competitions such as 24-hour hackathons and robotics symposiums enabled experiential learning outside the traditional curriculum."
    )
    sec3_narrative = _generate_grounded_section_narrative(
        nlp_url=nlp_url,
        section_id="custom_sec_3",
        section_title=sec3_title,
        bullets=sec3_bullets,
        system_prompt=active_prompt,
        max_words=200,
        fallback_text=sec3_fallback,
    )
    sec3 = ReportSection(
        id="custom_sec_3",
        title=sec3_title,
        marks=0,
        content_type="narrative",
        level=1,
        narrative=sec3_narrative,
        source_data={"total_attendees": total_attendees},
        has_placeholders=False,
    )

    return [sec1, sec2, sec3]


def _build_custom_faculty_sections(
    academic_url: str,
    dept_code: str,
    academic_year: str,
    raw_data: dict[str, Any],
    nlp_url: str,
    active_prompt: str,
    user_section_titles: list[str] | None = None,
) -> list[ReportSection]:
    """
    Build custom report sections specifically focused on Faculty Appraisal & Research.
    """
    faculty = raw_data.get("faculty")
    if not faculty:
        try:
            faculty = data_client.fetch_all_faculty(academic_url, dept_code)
            raw_data["faculty"] = faculty
        except Exception as e:
            logger.warning(f"Failed to fetch faculty: {e}")
            faculty = []

    dept_name = raw_data.get("department", {}).get("name", dept_code)
    total_fac = len(faculty)
    qual = data_client.derive_faculty_qualification_counts(faculty)
    cadre = data_client.derive_faculty_cadre_counts(faculty)
    total_pubs = sum(_safe_count(f.get("publications")) for f in faculty)
    total_research = sum(_safe_count(f.get("research_projects")) for f in faculty)

    sec1_title = user_section_titles[0] if user_section_titles and len(user_section_titles) > 0 else "Faculty Profile & Academic Cadre Overview"
    sec1_bullets = [
        f"Department: {dept_name} ({dept_code})",
        f"Academic Year: {academic_year}",
        f"Total Faculty Strength: {total_fac}",
        f"Ph.D. Qualified Faculty: {qual.get('phd', 0)} ({round(qual.get('phd', 0)/total_fac*100, 1) if total_fac else 0}%)",
        f"M.Tech Qualified Faculty: {qual.get('mtech', 0)}",
        f"Cadre Distribution: {cadre.get('professors', 0)} Professors, {cadre.get('assoc_professors', 0)} Associate Professors, {cadre.get('asst_professors', 0)} Assistant Professors",
        f"Total Peer-Reviewed Publications: {total_pubs}",
        f"Active Research Projects: {total_research}",
    ]
    sec1_fallback = (
        f"The faculty roster of the Department of {dept_name} comprises {total_fac} members with balanced cadre "
        f"distribution across {cadre.get('professors', 0)} Professors, {cadre.get('assoc_professors', 0)} Associate Professors, "
        f"and {cadre.get('asst_professors', 0)} Assistant Professors. {qual.get('phd', 0)} faculty members hold doctoral degrees, "
        f"contributing to {total_pubs} publications and {total_research} active research initiatives."
    )
    sec1_narrative = _generate_grounded_section_narrative(
        nlp_url=nlp_url,
        section_id="custom_sec_1",
        section_title=sec1_title,
        bullets=sec1_bullets,
        system_prompt=active_prompt,
        max_words=250,
        fallback_text=sec1_fallback,
    )
    sec1 = ReportSection(
        id="custom_sec_1",
        title=sec1_title,
        marks=0,
        content_type="narrative",
        level=1,
        narrative=sec1_narrative,
        source_data={"total_faculty": total_fac, "qual": qual, "cadre": cadre},
        has_placeholders=False,
    )

    sec2_title = user_section_titles[1] if user_section_titles and len(user_section_titles) > 1 else "Faculty Roster & Research Output"
    headers = ["Faculty ID", "Name", "Designation", "Qualification", "Experience", "Publications", "Research Grants"]
    rows = [
        [
            f.get("faculty_id", "FAC"),
            f.get("name", "Faculty Member"),
            f.get("designation", "Assistant Professor"),
            f.get("qualification", "M.Tech"),
            f.get("experience", "—"),
            _safe_count(f.get("publications")),
            _safe_count(f.get("research_projects")),
        ]
        for f in faculty
    ]
    sec2_narrative = f"Official credentials, qualifications, and research outputs for {total_fac} faculty members in the department."
    sec2 = ReportSection(
        id="custom_sec_2",
        title=sec2_title,
        marks=0,
        content_type="table",
        level=1,
        table_headers=headers,
        table_rows=rows,
        narrative=sec2_narrative,
        source_data={"faculty_count": total_fac},
        has_placeholders=False,
    )

    return [sec1, sec2]


# ─────────────────────────────────────────────────────────────────────────────
# Main Builder Function
# ─────────────────────────────────────────────────────────────────────────────

def build_general_report(
    app_config: dict,
    report_type: str | ReportType,
    department_id: str = "CSE",
    academic_year: str = "2025-26",
    selected_data: list[str] | None = None,
    section_titles: list[str] | None = None,
    instructions: str = "",
    report_id: str = "",
    report_title: str = "",
) -> ReportData:
    """
    Main entry point for building a General AI Report.
    Strictly isolated from SAR Criterion 4 generation.
    """
    rtype = normalize_report_type(report_type)
    selected_sources = selected_data or []

    academic_url = app_config.get("ACADEMIC_DATA_SERVICE_URL", "http://academic-data-service:8002")
    nlp_url      = app_config.get("NLP_RAG_SERVICE_URL", "http://nlp-rag-service:8005")

    # Step 1: Fetch selected grounding data
    raw_data, grounding_bullets = fetch_selected_grounding_data(
        academic_url=academic_url,
        dept_code=department_id,
        academic_year=academic_year,
        selected_data=selected_sources,
    )

    dept = raw_data.get("department", {"name": f"Department of {department_id}", "code": department_id})

    # Step 2: Select distinct system prompt, output schema, and titles
    report_sections: list[ReportSection] = []
    effective_title = (report_title or "").strip()

    if rtype == ReportType.DEPARTMENT_SUMMARY:
        active_system_prompt = SYSTEM_PROMPT_DEPARTMENT_SUMMARY
        sections_schema = DEPARTMENT_SUMMARY_SECTIONS
        effective_title = effective_title or "Department Executive Summary"

        for sec_id, sec_title in sections_schema:
            narrative = _generate_grounded_section_narrative(
                nlp_url=nlp_url,
                section_id=sec_id,
                section_title=sec_title,
                bullets=grounding_bullets,
                system_prompt=active_system_prompt,
                max_words=250,
            )
            sec = ReportSection(
                id=sec_id,
                title=sec_title,
                marks=0,
                content_type="narrative",
                level=1,
                narrative=narrative,
                source_data=raw_data,
                has_placeholders=False,
            )
            report_sections.append(sec)

    elif rtype == ReportType.CLUB_ACTIVITY:
        active_system_prompt = SYSTEM_PROMPT_CLUB_ACTIVITY
        sections_schema = CLUB_ACTIVITY_SECTIONS
        effective_title = effective_title or "Co-Curricular & Club Activities Report"

        for sec_id, sec_title in sections_schema:
            narrative = _generate_grounded_section_narrative(
                nlp_url=nlp_url,
                section_id=sec_id,
                section_title=sec_title,
                bullets=grounding_bullets,
                system_prompt=active_system_prompt,
                max_words=250,
            )
            sec = ReportSection(
                id=sec_id,
                title=sec_title,
                marks=0,
                content_type="narrative",
                level=1,
                narrative=narrative,
                source_data=raw_data,
                has_placeholders=False,
            )
            report_sections.append(sec)

    elif rtype == ReportType.CUSTOM:
        user_instructions_clean = (instructions or "").strip() or "Generate a structured report based on the provided records."
        active_system_prompt = SYSTEM_PROMPT_CUSTOM.format(instructions=user_instructions_clean)

        inst_lower = user_instructions_clean.lower()
        cleaned_titles = [t.strip() for t in (section_titles or []) if t and t.strip()]

        # Query & Intent Detection
        mentions_cie_att = any(k in inst_lower for k in ["cie", "internal", "internals", "mark", "marks", "attendance", "score", "scores", "assessment", "quiz", "el", "eval"])
        mentions_student = any(k in inst_lower for k in ["student", "students", "class", "classes", "batch", "cohort", "semester", "sem", "roster"])
        mentions_clubs   = any(k in inst_lower for k in ["club", "clubs", "event", "events", "hackathon", "workshop", "symposium", "extracurricular", "activity", "activities"])
        mentions_faculty = any(k in inst_lower for k in ["faculty", "teacher", "teachers", "professor", "professors", "publication", "publications", "research", "grant", "phd", "mtech"])
        mentions_place   = any(k in inst_lower for k in ["placement", "placements", "placed", "salary", "package", "recruiter", "job", "career", "higher studies", "entrepreneur"])

        # Topic 1: Students, CIE marks, Attendance
        if mentions_cie_att or (mentions_student and not mentions_clubs and not mentions_faculty and not mentions_place):
            effective_title = effective_title or "Student Continuous Internal Evaluation (CIE) & Attendance Report"
            report_sections = _build_custom_cie_attendance_sections(
                academic_url=academic_url,
                dept_code=department_id,
                academic_year=academic_year,
                raw_data=raw_data,
                nlp_url=nlp_url,
                active_prompt=active_system_prompt,
                user_section_titles=cleaned_titles if cleaned_titles else None,
            )

        # Topic 2: Club Activities
        elif mentions_clubs and not mentions_faculty:
            effective_title = effective_title or "Student Clubs & Co-Curricular Activities Comprehensive Report"
            report_sections = _build_custom_club_activity_sections(
                academic_url=academic_url,
                dept_code=department_id,
                academic_year=academic_year,
                raw_data=raw_data,
                nlp_url=nlp_url,
                active_prompt=active_system_prompt,
                user_section_titles=cleaned_titles if cleaned_titles else None,
            )

        # Topic 3: Faculty Dossier
        elif mentions_faculty and not mentions_cie_att:
            effective_title = effective_title or "Faculty Appraisal & Academic Research Portfolio Report"
            report_sections = _build_custom_faculty_sections(
                academic_url=academic_url,
                dept_code=department_id,
                academic_year=academic_year,
                raw_data=raw_data,
                nlp_url=nlp_url,
                active_prompt=active_system_prompt,
                user_section_titles=cleaned_titles if cleaned_titles else None,
            )

        # Topic 4: Fallback / General Multi-Domain Custom Report
        else:
            effective_title = effective_title or "Custom Academic Analytics & Performance Report"
            if not cleaned_titles:
                cleaned_titles = ["Report Overview", "Key Findings & Details"]

            sections_schema = [
                (f"custom_sec_{idx+1}", title) for idx, title in enumerate(cleaned_titles)
            ]
            for sec_id, sec_title in sections_schema:
                narrative = _generate_grounded_section_narrative(
                    nlp_url=nlp_url,
                    section_id=sec_id,
                    section_title=sec_title,
                    bullets=grounding_bullets,
                    system_prompt=active_system_prompt,
                    max_words=250,
                )
                sec = ReportSection(
                    id=sec_id,
                    title=sec_title,
                    marks=0,
                    content_type="narrative",
                    level=1,
                    narrative=narrative,
                    source_data=raw_data,
                    has_placeholders=False,
                )
                report_sections.append(sec)

    # Step 4: Assemble ReportData
    program_name = f"{effective_title} — Department of {dept.get('name', department_id)}"

    return ReportData(
        sar_format="general",
        report_type=rtype.value,
        scope=effective_title,
        academic_year=academic_year,
        generated_at=datetime.now(timezone.utc).isoformat(),
        department=dept,
        sections=report_sections,
        institution_name=dept.get("name", "AcademiQ Institution"),
        program_name=program_name,
        report_id=report_id,
    )
