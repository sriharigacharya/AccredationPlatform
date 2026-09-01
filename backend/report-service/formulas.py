"""
NBA SAR formula functions — pure Python, no Flask context required.
All functions are unit-testable independently.

CRITICAL: Do NOT share formula parameter tables across SAR formats.
Even when two formats use the same formula shape (e.g. SFR, FQI), their
banding thresholds and cap values may differ. Each format gets its own
parameterized call. Currently implemented for ug_tier_ii_gapc_v4.

Formula sources: NBA SAR UG Tier-II GAPC V4.0, January 2025.
Formulas marked # VERIFY should be confirmed against the actual document
when a filled SAR becomes available.
"""

from __future__ import annotations
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Utility helpers
# ─────────────────────────────────────────────────────────────────────────────

def _band(value: float, breakpoints: list[tuple[float, float]]) -> float:
    """
    General banded scoring helper.
    breakpoints: list of (threshold, marks) sorted DESCENDING by threshold.
    Returns marks for the first threshold the value meets or exceeds.
    """
    for threshold, marks in breakpoints:
        if value >= threshold:
            return marks
    return 0.0


def _cap(value: float, cap: float) -> float:
    return min(value, cap)


# ─────────────────────────────────────────────────────────────────────────────
# Criterion 4 — Students' Performance
# ─────────────────────────────────────────────────────────────────────────────

def enrolment_ratio(
    enrolled: int,
    sanctioned_intake: int,
    max_marks: float = 20.0,
) -> dict[str, Any]:
    """
    4.1 Enrolment Ratio (20 marks).
    ER = (enrolled / sanctioned_intake) × 100
    Banding: ≥90%→20, ≥80%→16, ≥70%→12, ≥60%→8, ≥50%→4, else 0.
    # VERIFY: confirm exact breakpoints from NBA document.
    """
    if sanctioned_intake <= 0:
        return {"er_pct": 0.0, "marks": 0.0, "enrolled": enrolled, "intake": sanctioned_intake}
    er = (enrolled / sanctioned_intake) * 100
    marks = _band(er, [(90, 20), (80, 16), (70, 12), (60, 8), (50, 4)])
    return {"er_pct": round(er, 2), "marks": round(marks, 2),
            "enrolled": enrolled, "intake": sanctioned_intake}


def success_rate(
    avg_sr_pct: float,
    max_marks: float = 15.0,
) -> dict[str, Any]:
    """
    4.2 Success Rate in Stipulated Period (15 marks).
    marks = 1.5 × avg_sr_pct / 10, capped at 15.
    avg_sr_pct = average success rate % over last 3 assessment years.
    """
    marks = _cap(1.5 * avg_sr_pct / 10, max_marks)
    return {"avg_sr_pct": round(avg_sr_pct, 2), "marks": round(marks, 2)}


def academic_performance_index(
    grade_points_sum: float,
    total_students: int,
    max_marks: float = 10.0,
) -> dict[str, Any]:
    """
    4.3/4.4/4.5 Academic Performance Index (API) — 10 marks per year.
    Parameterized by year_offset; caller fetches correct year's data.
    API = (grade_points_sum / total_students) scaled to max_marks.
    GPA is out of 10; marks = (avg_gpa / 10) × max_marks.
    # VERIFY: confirm exact NBA API formula from document.
    """
    if total_students <= 0:
        return {"avg_gpa": 0.0, "marks": 0.0, "total_students": 0}
    avg_gpa = grade_points_sum / total_students
    marks   = _cap((avg_gpa / 10.0) * max_marks, max_marks)
    return {"avg_gpa": round(avg_gpa, 3), "marks": round(marks, 2),
            "total_students": total_students}


def placement_index(
    placements_by_year: list[dict],
    max_marks: float = 30.0,
) -> dict[str, Any]:
    """
    4.6 Placement/Higher Studies/Entrepreneurship (30 marks).
    P(year) = ((placed + higher_studies + entrepreneurs) / final_year_total) × 100
    marks = 0.3 × avg(P over 3 years), flat multiplier, no banding.
    placements_by_year: list of {placed, higher_studies, entrepreneurs, total}.
    """
    p_values = []
    for yr in placements_by_year:
        total = yr.get("total", 0)
        if total > 0:
            p = ((yr.get("placed", 0) + yr.get("higher_studies", 0) +
                  yr.get("entrepreneurs", 0)) / total) * 100
            p_values.append(p)
    avg_p = sum(p_values) / len(p_values) if p_values else 0.0
    marks = _cap(0.3 * avg_p, max_marks)
    return {"avg_placement_pct": round(avg_p, 2), "marks": round(marks, 2),
            "years": len(p_values)}


# ─────────────────────────────────────────────────────────────────────────────
# Criterion 5 — Faculty Information
# ─────────────────────────────────────────────────────────────────────────────

def student_faculty_ratio(
    total_students: int,
    total_faculty: int,
    max_marks: float = 30.0,
) -> dict[str, Any]:
    """
    5.1 Student-Faculty Ratio (SFR) — 30 marks.
    SFR = S / TF
    Breakpoints (Tier-II GAPC V4.0):
    <15→30, <17→27, <19→24, <21→21, <23→18, <25→15, ≥25→0
    """
    if total_faculty <= 0:
        return {"sfr": None, "marks": 0.0, "students": total_students, "faculty": total_faculty}
    sfr   = total_students / total_faculty
    marks = _band(1/sfr if sfr > 0 else 0,
                  [(1/15, 30), (1/17, 27), (1/19, 24), (1/21, 21),
                   (1/23, 18), (1/25, 15)])
    # Simpler direct comparison is cleaner:
    if   sfr < 15: marks = 30
    elif sfr < 17: marks = 27
    elif sfr < 19: marks = 24
    elif sfr < 21: marks = 21
    elif sfr < 23: marks = 18
    elif sfr < 25: marks = 15
    else:          marks = 0
    return {"sfr": round(sfr, 2), "marks": float(marks),
            "students": total_students, "faculty": total_faculty}


def faculty_qualification_index(
    phd_count: int,
    mtech_count: int,
    required_faculty: int,
    max_marks: float = 25.0,
) -> dict[str, Any]:
    """
    5.2 Faculty Qualification Index (FQI) — 25 marks.
    FQI = 2.5 × [(10X + 4Y) / RF], capped at 25.
    X = faculty with PhD, Y = faculty with MTech/ME/MS, RF = required faculty.
    """
    if required_faculty <= 0:
        return {"fqi": 0.0, "marks": 0.0}
    fqi   = 2.5 * ((10 * phd_count + 4 * mtech_count) / required_faculty)
    marks = _cap(fqi, max_marks)
    return {"fqi": round(fqi, 3), "marks": round(marks, 2),
            "phd_count": phd_count, "mtech_count": mtech_count,
            "required_faculty": required_faculty}


def faculty_cadre_proportion(
    actual_professors: int,
    actual_assoc_professors: int,
    actual_asst_professors: int,
    required_professors: int,
    required_assoc_professors: int,
    required_asst_professors: int,
    max_marks: float = 25.0,
) -> dict[str, Any]:
    """
    5.3 Faculty Cadre Proportion — 25 marks.
    marks = (AF1/RF1 + AF2/RF2 × 0.6 + AF3/RF3 × 0.4) × 12.5, capped at 25.
    AF = actual, RF = required; 1=Professor, 2=Assoc.Prof, 3=Asst.Prof.
    """
    p1 = (actual_professors / required_professors) if required_professors > 0 else 0
    p2 = (actual_assoc_professors / required_assoc_professors * 0.6) if required_assoc_professors > 0 else 0
    p3 = (actual_asst_professors / required_asst_professors * 0.4) if required_asst_professors > 0 else 0
    marks = _cap((p1 + p2 + p3) * 12.5, max_marks)
    return {
        "marks": round(marks, 2),
        "actual": {"professors": actual_professors,
                   "assoc": actual_assoc_professors,
                   "asst": actual_asst_professors},
        "required": {"professors": required_professors,
                     "assoc": required_assoc_professors,
                     "asst": required_asst_professors},
    }


def faculty_retention(
    cohort_counts: dict[str, int],
    required_faculty: int,
    max_marks: float = 10.0,
) -> dict[str, Any]:
    """
    5.5 Faculty Retention — 10 marks.
    cohort_counts: {"A": n, "B": n, "C": n, "D": n, "E": n}
    A=<1yr, B=1-2yr, C=2-3yr, D=3-4yr, E=4+yr (retained faculty).
    marks = (A×0 + B×1 + C×2 + D×3 + E×4) / RF × 2.5, capped at 10.
    """
    a = cohort_counts.get("A", 0)
    b = cohort_counts.get("B", 0)
    c = cohort_counts.get("C", 0)
    d = cohort_counts.get("D", 0)
    e = cohort_counts.get("E", 0)
    if required_faculty <= 0:
        return {"marks": 0.0}
    numerator = a * 0 + b * 1 + c * 2 + d * 3 + e * 4
    marks = _cap((numerator / required_faculty) * 2.5, max_marks)
    return {"marks": round(marks, 2), "cohorts": cohort_counts,
            "required_faculty": required_faculty}


# ─────────────────────────────────────────────────────────────────────────────
# Criterion 6 — Faculty Contribution
# ─────────────────────────────────────────────────────────────────────────────

def fdp_participation_score(
    faculty_fdp_records: list[dict],
    required_faculty: int,
    max_marks: float = 10.0,
) -> dict[str, Any]:
    """
    6.1.2.2 Faculty Participation in STTP/FDP — 10 marks (Tier-II cap).
    Per faculty: 2–5 days → 3 pts, >5 days → 5 pts (max 5 per faculty).
    AP = 2 × (sum_of_points / (0.5 × RF)) per year, capped at 10/year.
    Average over assessment years, final cap at 10.
    faculty_fdp_records: [{faculty_id, days, year}]
    NOTE: The 10-mark cap differs from Tier-I (which is 5). Do NOT use
    the Tier-I cap here.
    """
    by_faculty: dict[str, int] = {}
    for rec in faculty_fdp_records:
        fid   = rec.get("faculty_id", "unknown")
        days  = int(rec.get("days", 0))
        pts   = 5 if days > 5 else (3 if days >= 2 else 0)
        by_faculty[fid] = min(by_faculty.get(fid, 0) + pts, 5)

    total_pts = sum(by_faculty.values())
    denom     = 0.5 * required_faculty if required_faculty > 0 else 1
    ap        = _cap(2 * (total_pts / denom), 10.0)
    marks     = _cap(ap, max_marks)
    return {"marks": round(marks, 2), "total_faculty_pts": total_pts,
            "participating_faculty": len(by_faculty)}


def fdp_organised_score(
    fdp_counts_by_year: list[int],
    max_marks: float = 10.0,
) -> dict[str, Any]:
    """
    6.1.4 FDP/STTP organised by department — 10 marks.
    marks per year = 2 × count, capped at 4/year.
    Total = sum across years, capped at 10.
    """
    year_marks = [_cap(2 * c, 4) for c in fdp_counts_by_year]
    marks      = _cap(sum(year_marks), max_marks)
    return {"marks": round(marks, 2), "year_marks": year_marks,
            "counts_by_year": fdp_counts_by_year}


def research_funding_score(
    cumulative_amount_lakhs: float,
    max_marks: float = 15.0,
    # Tier-II specific breakpoints — DO NOT share with Tier-I tree
    breakpoints: list[tuple[float, float]] | None = None,
) -> dict[str, Any]:
    """
    6.2.3 Sponsored Research / 6.2.4 Consultancy — 15 marks each.
    Banded on cumulative 3-year amount (in lakhs):
    >15→15, >12→12, >9→9, >6→6, >3→3, >1→1, else 0.
    Breakpoints are parameterized so Tier-I's different banding can't
    silently override Tier-II's.
    """
    if breakpoints is None:
        # Tier-II GAPC V4.0 breakpoints
        breakpoints = [(15, 15), (12, 12), (9, 9), (6, 6), (3, 3), (1, 1)]
    marks = _band(cumulative_amount_lakhs, breakpoints)
    return {"marks": round(marks, 2),
            "cumulative_amount_lakhs": cumulative_amount_lakhs}


def seed_money_score(
    amount_received_lakhs: float,
    amount_utilized_lakhs: float,
    max_marks: float = 10.0,
) -> dict[str, Any]:
    """
    6.2.5 Institution Seed Money / Internal Research Grant — 10 marks.
    Received component (max 6): >6L→6, >4L→4, >2L→2, else 0.
    Utilised component (max 4): proportional to utilisation rate.
    # VERIFY: exact utilization formula.
    """
    recv_marks = _band(amount_received_lakhs, [(6, 6), (4, 4), (2, 2)])
    # Utilization rate: capped at 4 if utilization ≥ received, proportional otherwise
    if amount_received_lakhs > 0:
        util_rate   = min(amount_utilized_lakhs / amount_received_lakhs, 1.0)
        util_marks  = _cap(util_rate * 4, 4.0)
    else:
        util_marks = 0.0
    marks = _cap(recv_marks + util_marks, max_marks)
    return {"marks": round(marks, 2), "received_marks": round(recv_marks, 2),
            "utilised_marks": round(util_marks, 2),
            "received_lakhs": amount_received_lakhs,
            "utilised_lakhs": amount_utilized_lakhs}


# ─────────────────────────────────────────────────────────────────────────────
# Criterion 9 — Student Support System
# ─────────────────────────────────────────────────────────────────────────────

def first_year_sfr(
    first_year_students: int,
    lateral_entry_students: int,
    required_faculty_fy: int,
    max_marks: float = 5.0,
) -> dict[str, Any]:
    """
    9.1 First Year Student-Faculty Ratio (FYSFR) — 5 marks.
    pct = ((NS1 × 0.8) + (NS2 × 0.2)) / RF4
    >90%→5, >80%→4, >70%→3, >60%→2, >50%→1, else 0.
    """
    if required_faculty_fy <= 0:
        return {"fysfr_pct": 0.0, "marks": 0.0}
    pct   = ((first_year_students * 0.8) + (lateral_entry_students * 0.2)) / required_faculty_fy
    pct_r = pct * 100
    marks = _band(pct_r, [(90, 5), (80, 4), (70, 3), (60, 2), (50, 1)])
    return {"fysfr_pct": round(pct_r, 2), "marks": float(marks),
            "first_year": first_year_students, "lateral": lateral_entry_students}
