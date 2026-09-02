"""
HTTP client for fetching data from academic-data-service and prediction-service.
All data fetching for report generation lives here — routes and renderers
never make HTTP calls directly.

Data availability notes (as of current academic-data-service schema):
  - Students: student_id, semester, attendance_pct, internal_marks,
    assignment_score_pct, previous_gpa, backlogs, engagement, final_result
  - Faculty: faculty_id, designation, qualification, experience,
    courses_taught, publications, fdp_participation, research_projects, awards
  - Departments: code, name, vision, mission, peos, pos, cos,
    placement_stats, research_stats

Fields marked # NEEDS_SCHEMA require data not yet in academic-data-service.
They return clearly-labeled placeholder data so reports render correctly;
replace with real queries once the schema is extended.
"""

from __future__ import annotations
import logging
import requests

logger = logging.getLogger(__name__)
_TIMEOUT = 15


def _get(base_url: str, path: str, params: dict | None = None) -> dict | list:
    url = base_url.rstrip("/") + path
    resp = requests.get(url, params=params, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


# ─────────────────────────────────────────────────────────────────────────────
# Department
# ─────────────────────────────────────────────────────────────────────────────

def fetch_department(base_url: str, dept_code: str) -> dict:
    """Fetch single department by code from academic-data-service."""
    departments: list = _get(base_url, "/departments/")
    for d in departments:
        if d.get("code", "").upper() == dept_code.upper():
            return d
    raise ValueError(f"Department '{dept_code}' not found")


def fetch_department_summary(base_url: str, dept_id: int) -> dict:
    return _get(base_url, f"/departments/{dept_id}/summary")


# ─────────────────────────────────────────────────────────────────────────────
# Students
# ─────────────────────────────────────────────────────────────────────────────

def fetch_all_students(base_url: str, dept_code: str | None = None) -> list[dict]:
    params = {}
    if dept_code:
        params["department"] = dept_code
    return _get(base_url, "/students/", params)


def fetch_student(base_url: str, student_id: str) -> dict:
    return _get(base_url, f"/students/{student_id}")


def fetch_student_stats(base_url: str) -> dict:
    return _get(base_url, "/students/stats/overview")


# ─────────────────────────────────────────────────────────────────────────────
# Faculty
# ─────────────────────────────────────────────────────────────────────────────

def fetch_all_faculty(base_url: str, dept_code: str | None = None) -> list[dict]:
    params = {}
    if dept_code:
        params["department"] = dept_code
    return _get(base_url, "/faculty/", params)


def fetch_faculty(base_url: str, faculty_id: str) -> dict:
    return _get(base_url, f"/faculty/{faculty_id}")


def fetch_faculty_stats(base_url: str) -> dict:
    return _get(base_url, "/faculty/stats/overview")


# ─────────────────────────────────────────────────────────────────────────────
# Derived data builders (avoid repeating computation across nodes)
# ─────────────────────────────────────────────────────────────────────────────

def derive_faculty_qualification_counts(faculty_list: list[dict]) -> dict:
    """
    Parse faculty qualification strings to count PhD and MTech holders.
    Returns {"phd": n, "mtech": n, "others": n, "total": n}
    """
    phd = mtech = others = 0
    for f in faculty_list:
        qual = (f.get("qualification") or "").lower()
        if "ph.d" in qual or "phd" in qual:
            phd += 1
        elif "m.tech" in qual or "m.e" in qual or "m.s" in qual or "mtech" in qual:
            mtech += 1
        else:
            others += 1
    return {"phd": phd, "mtech": mtech, "others": others, "total": len(faculty_list)}


def derive_faculty_cadre_counts(faculty_list: list[dict]) -> dict:
    """
    Parse faculty designation strings to count Professor/Assoc.Prof/Asst.Prof.
    Returns {"professors": n, "assoc_professors": n, "asst_professors": n}
    """
    profs = assoc = asst = 0
    for f in faculty_list:
        desig = (f.get("designation") or "").lower()
        if "professor & hod" in desig or ("professor" in desig and "associate" not in desig
                                           and "assistant" not in desig):
            profs += 1
        elif "associate professor" in desig:
            assoc += 1
        else:
            asst += 1
    return {"professors": profs, "assoc_professors": assoc, "asst_professors": asst}


def derive_required_faculty(total_students: int, sfr_norm: float = 15.0) -> int:
    """
    Estimate required faculty count based on the normative SFR.
    # NEEDS_SCHEMA: ideally this comes from NBA-approved intake strength.
    """
    return max(1, int(total_students / sfr_norm))


def get_enrolment_data(dept: dict) -> dict:
    """
    # NEEDS_SCHEMA: actual sanctioned intake not in current schema.
    Returns placeholder data — replace with real admission data when available.
    """
    return {
        "enrolled": 60,          # placeholder
        "sanctioned_intake": 60,  # placeholder
        "_placeholder": True,
    }


def get_placement_data(dept: dict) -> list[dict]:
    """
    Parse dept.placement_stats JSON if available; else return placeholder.
    # NEEDS_SCHEMA: structured placement data not yet guaranteed in schema.
    """
    import json
    raw = dept.get("placement_stats")
    if raw:
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
            if isinstance(data, list) and data:
                return data
        except Exception:
            pass
    # Placeholder for 3 assessment years
    return [
        {"year": "2023-24", "placed": 45, "higher_studies": 5, "entrepreneurs": 2, "total": 60, "_placeholder": True},
        {"year": "2022-23", "placed": 40, "higher_studies": 4, "entrepreneurs": 1, "total": 60, "_placeholder": True},
        {"year": "2021-22", "placed": 38, "higher_studies": 6, "entrepreneurs": 1, "total": 58, "_placeholder": True},
    ]


def get_success_rate_data(students: list[dict]) -> float:
    """
    Compute success rate % from available student records.
    # NEEDS_SCHEMA: year-cohort pass rates need historical data.
    Uses current snapshot as proxy.
    """
    if not students:
        return 0.0
    passed  = sum(1 for s in students if (s.get("final_result") or "").lower() == "pass")
    return (passed / len(students)) * 100


def get_api_data(students: list[dict], semester_filter: int | None = None) -> dict:
    """
    Compute Academic Performance Index inputs from student records.
    """
    filtered = students
    if semester_filter is not None:
        filtered = [s for s in students if s.get("semester") == semester_filter]
    if not filtered:
        return {"grade_points_sum": 0.0, "total_students": 0}
    gpa_sum = sum(s.get("previous_gpa", 0.0) for s in filtered)
    return {"grade_points_sum": gpa_sum, "total_students": len(filtered)}


def get_research_funding(dept: dict, node_id: str) -> float:
    """
    # NEEDS_SCHEMA: no sponsored research funding data in current schema.
    Returns placeholder. node_id distinguishes 6.2.3 (research) vs 6.2.4 (consultancy).
    """
    import json
    raw = dept.get("research_stats")
    if raw:
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
            if isinstance(data, dict):
                key = "sponsored_research_lakhs" if node_id == "6.2.3" else "consultancy_lakhs"
                if key in data:
                    return float(data[key])
        except Exception:
            pass
    return 0.0  # placeholder — update once research_stats JSON is structured


# ─────────────────────────────────────────────────────────────────────────────
# Prediction service
# ─────────────────────────────────────────────────────────────────────────────

def fetch_at_risk(predict_url: str, threshold: float = 0.5) -> list[dict]:
    url  = predict_url.rstrip("/") + "/predict/atrisk"
    resp = requests.get(url, params={"threshold": threshold}, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("at_risk", [])


def fetch_batch_predictions(predict_url: str, students: list[dict]) -> list[dict]:
    url  = predict_url.rstrip("/") + "/predict/batch"
    resp = requests.post(url, json={"students": students}, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("predictions", [])


# ─────────────────────────────────────────────────────────────────────────────
# Club & College Events (Feature 2 / Criterion 4.6.1)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_approved_events(
    base_url: str,
    department_code: str | None = None,
    academic_year: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict]:
    """Fetch all mentor-approved club/college events from academic-data-service."""
    params = {"status": "approved", "include_photos": "true"}
    if academic_year:
        params["academic_year"] = academic_year
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date
    try:
        res = _get(base_url, "/events", params)
        return res if isinstance(res, list) else []
    except Exception as e:
        logger.warning(f"[data_client] Could not fetch approved events: {e}")
        return []


def fetch_event_summary_sheets(base_url: str, event_ids: list[int] | None = None) -> list[dict]:
    """Fetch full detailed summary sheets for specific events (or all approved)."""
    params = {}
    if event_ids:
        params["event_ids"] = ",".join(str(i) for i in event_ids)
    try:
        res = _get(base_url, "/events/summary-sheets", params)
        return res if isinstance(res, list) else []
    except Exception as e:
        logger.warning(f"[data_client] Could not fetch event summary sheets: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Historical Criterion 4 Data (Verified Only)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_verified_admission_records(
    base_url: str,
    department: str | None = None,
    academic_year: str | None = None,
) -> list[dict]:
    """Fetch only verified admission records (Table 4.1)."""
    params = {"status": "verified"}
    if department:
        params["department"] = department
    if academic_year:
        params["academic_year"] = academic_year
    try:
        res = _get(base_url, "/admission-records", params)
        return res if isinstance(res, list) else []
    except Exception as e:
        logger.warning(f"[data_client] Could not fetch verified admission records: {e}")
        return []


def fetch_verified_batch_progress_summary(base_url: str, department: str = "CSE") -> list[dict]:
    """Fetch verified batch progress summary for Success Rate (Table 4.2)."""
    params = {"status": "verified", "department": department}
    try:
        res = _get(base_url, "/batch-progress/summary", params)
        return res if isinstance(res, list) else []
    except Exception as e:
        logger.warning(f"[data_client] Could not fetch verified batch progress summary: {e}")
        return []


def fetch_verified_academic_performance(
    base_url: str,
    department: str | None = None,
    academic_year: str | None = None,
    year_of_study: str | None = None,
) -> list[dict]:
    """Fetch verified academic performance API records (Table 4.3/4.4)."""
    params = {"status": "verified"}
    if department:
        params["department"] = department
    if academic_year:
        params["academic_year"] = academic_year
    if year_of_study:
        params["year_of_study"] = year_of_study
    try:
        res = _get(base_url, "/academic-performance", params)
        return res if isinstance(res, list) else []
    except Exception as e:
        logger.warning(f"[data_client] Could not fetch verified academic performance records: {e}")
        return []


def fetch_verified_placement_summary(
    base_url: str,
    cohort_years: list[int] | None = None,
) -> dict:
    """
    Fetch verified 4-year placement summary from /placements/summary (Feature 4).
    Feeds Criterion 4.5: Assessment = 40 × Average Placement Index.
    """
    params = {}
    if cohort_years:
        params["cohort_years"] = ",".join(str(y) for y in cohort_years)
    try:
        res = _get(base_url, "/placements/summary", params)
        return res if isinstance(res, dict) else {}
    except Exception as e:
        logger.warning(f"[data_client] Could not fetch verified placement summary: {e}")
        return {}


def fetch_verified_student_achievements(
    base_url: str,
    academic_year: str | None = None,
) -> dict:
    """
    Fetch verified student achievements from /student-achievements/report (Feature 5).
    Feeds Criterion 4.6.3: Student Participation in Inter-Institute Events (10 marks).
    """
    params = {}
    if academic_year:
        params["academic_year"] = academic_year
    try:
        res = _get(base_url, "/student-achievements/report", params)
        return res if isinstance(res, dict) else {}
    except Exception as e:
        logger.warning(f"[data_client] Could not fetch verified student achievements: {e}")
        return {}




