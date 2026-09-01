"""
builder.py — assembles ReportData from SAR tree + live data.

Orchestration:
  1. Resolve which nodes to include (scope → node IDs via registry)
  2. For each node, fetch required data via data_client
  3. For formula_table nodes, run the formula → numeric result
  4. For narrative nodes, return structured bullets (LLM expansion is
     optional and done at the route level, not here, so builder is
     fully testable without an LLM connection)
  5. Return populated ReportData

The builder never makes LLM calls. Narrative text is initially populated
with the input bullets as plain text; the route handler can optionally
call llm_client.narrate() to replace with expanded prose.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Any

from sar_tree.registry import get_tree, resolve_scope
from render.report_data import ReportData, ReportSection
import formulas
import data_client

logger = logging.getLogger(__name__)


def build_report_data(
    app_config: dict,
    sar_format: str,
    department_code: str,
    academic_year: str,
    scope: str,
    report_id: str = "",
    report_type: str = "nba",
) -> ReportData:
    """
    Main entry point for NBA report assembly.
    app_config: Flask app.config (for service URLs).
    """
    academic_url = app_config.get("ACADEMIC_DATA_SERVICE_URL", "http://academic-data-service:8002")

    # ── Fetch base data ───────────────────────────────────────
    dept     = data_client.fetch_department(academic_url, department_code)
    students = data_client.fetch_all_students(academic_url, dept_code=department_code)
    faculty  = data_client.fetch_all_faculty(academic_url, dept_code=department_code)

    # Derived counts used across multiple criteria
    qual_counts    = data_client.derive_faculty_qualification_counts(faculty)
    cadre_counts   = data_client.derive_faculty_cadre_counts(faculty)
    required_faculty = data_client.derive_required_faculty(len(students))

    # ── Resolve scope ─────────────────────────────────────────
    node_ids        = resolve_scope(sar_format, scope)
    nodes_dict, _   = get_tree(sar_format)

    # ── Build sections ────────────────────────────────────────
    sections: list[ReportSection] = []
    for nid in node_ids:
        node = nodes_dict.get(nid)
        if node is None:
            continue
        section = _build_section(
            node=node,
            dept=dept,
            students=students,
            faculty=faculty,
            qual_counts=qual_counts,
            cadre_counts=cadre_counts,
            required_faculty=required_faculty,
            academic_year=academic_year,
            app_config=app_config,
        )
        sections.append(section)

    return ReportData(
        sar_format=sar_format,
        report_type=report_type,
        scope=scope,
        academic_year=academic_year,
        generated_at=datetime.now(timezone.utc).isoformat(),
        department=dept,
        sections=sections,
        institution_name=dept.get("name", "Institution"),
        program_name="B.E. " + dept.get("name", "Engineering"),
        report_id=report_id,
    )


def build_adhoc_report_data(
    app_config: dict,
    query: str,
    scope_type: str,
    target_id: str | None,
    metric_focus: str,
    narrative: str,
    report_id: str = "",
) -> ReportData:
    """Build a ReportData for a free-text adhoc report."""
    academic_url = app_config.get("ACADEMIC_DATA_SERVICE_URL", "http://academic-data-service:8002")

    dept     = {}
    sections = []

    # Fetch scoped data
    if scope_type == "student" and target_id:
        try:
            student = data_client.fetch_student(academic_url, target_id)
            section = ReportSection(
                id="adhoc_student",
                title=f"Performance Report: {student.get('name', target_id)}",
                marks=0,
                content_type="narrative",
                level=1,
                narrative=narrative,
                source_data={"student": student},
            )
            sections.append(section)
            dept = {"name": "Department", "code": ""}
        except Exception as e:
            logger.warning(f"[builder] Could not fetch student {target_id}: {e}")

    elif scope_type == "faculty" and target_id:
        try:
            fac = data_client.fetch_faculty(academic_url, target_id)
            section = ReportSection(
                id="adhoc_faculty",
                title=f"Faculty Report: {fac.get('name', target_id)}",
                marks=0,
                content_type="narrative",
                level=1,
                narrative=narrative,
                source_data={"faculty": fac},
            )
            sections.append(section)
        except Exception as e:
            logger.warning(f"[builder] Could not fetch faculty {target_id}: {e}")

    else:
        # Department/class level
        section = ReportSection(
            id="adhoc_dept",
            title=f"Report: {query[:80]}",
            marks=0,
            content_type="narrative",
            level=1,
            narrative=narrative,
        )
        sections.append(section)

    return ReportData(
        sar_format="adhoc",
        report_type="adhoc",
        scope=f"{scope_type}:{target_id or 'unknown'}",
        academic_year=datetime.now(timezone.utc).strftime("%Y-%m"),
        generated_at=datetime.now(timezone.utc).isoformat(),
        department=dept,
        sections=sections,
        report_id=report_id,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Per-node section builders
# ─────────────────────────────────────────────────────────────────────────────

def _build_section(
    node,
    dept: dict,
    students: list[dict],
    faculty: list[dict],
    qual_counts: dict,
    cadre_counts: dict,
    required_faculty: int,
    academic_year: str,
    app_config: dict,
) -> ReportSection:
    """Dispatch to the appropriate builder based on node type."""
    base = dict(
        id=node.id,
        title=node.title,
        marks=node.marks,
        content_type=node.node_type,
        level=node.level,
    )

    if node.node_type == "criterion_header":
        return ReportSection(**base)

    if node.node_type == "static":
        return ReportSection(**base, narrative=_static_content(node.id))

    if node.node_type == "narrative":
        return ReportSection(
            **base,
            narrative=f"[{node.title}]\n\nPlease enter content for this section. "
                       "Use the 'Expand with AI' button to generate a draft from bullet points.",
        )

    if node.node_type in ("table", "formula_table"):
        return _build_formula_or_table_section(
            node=node, base=base, dept=dept, students=students,
            faculty=faculty, qual_counts=qual_counts,
            cadre_counts=cadre_counts, required_faculty=required_faculty,
            academic_year=academic_year,
        )

    return ReportSection(**base)


def _build_formula_or_table_section(
    node, base, dept, students, faculty,
    qual_counts, cadre_counts, required_faculty, academic_year,
) -> ReportSection:
    """Run the appropriate formula and build a table-format section."""
    fn = node.formula_fn

    # ── Criterion 4 ───────────────────────────────────────────
    if fn == "enrolment_ratio":
        enrol = data_client.get_enrolment_data(dept)
        result = formulas.enrolment_ratio(enrol["enrolled"], enrol["sanctioned_intake"])
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=[
                ["Sanctioned Intake", enrol["sanctioned_intake"]],
                ["Students Enrolled", enrol["enrolled"]],
                ["Enrolment Ratio (%)", f"{result['er_pct']:.1f}"],
                ["Marks Scored", f"{result['marks']:.0f} / 20"],
            ],
            has_placeholders=enrol.get("_placeholder", False),
            source_data=enrol,
        )

    if fn == "success_rate":
        sr_pct = data_client.get_success_rate_data(students)
        result = formulas.success_rate(sr_pct)
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=[
                ["Average Success Rate (%)", f"{sr_pct:.1f}"],
                ["Marks Scored", f"{result['marks']:.1f} / 15"],
            ],
            has_placeholders=True,  # year-cohort data needs schema extension
            source_data={"success_rate_pct": sr_pct},
        )

    if fn in ("api_year1", "api_year2", "api_year3"):
        sem_map = {"api_year1": 1, "api_year2": 3, "api_year3": 5}
        sem = sem_map[fn]
        api_data = data_client.get_api_data(students, semester_filter=sem)
        result   = formulas.academic_performance_index(**api_data)
        year_label = {"api_year1": "1st", "api_year2": "2nd", "api_year3": "3rd"}[fn]
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=[
                ["Students in Assessment Semester", result["total_students"]],
                ["Average GPA", f"{result['avg_gpa']:.2f}"],
                ["API Marks", f"{result['marks']:.1f} / 10"],
            ],
            source_data=api_data,
        )

    if fn == "placement_index":
        placement = data_client.get_placement_data(dept)
        result    = formulas.placement_index(placement)
        rows = []
        for p in placement:
            total = p.get("total", 0)
            pct   = ((p.get("placed", 0) + p.get("higher_studies", 0) +
                      p.get("entrepreneurs", 0)) / total * 100) if total else 0
            rows.append([p.get("year", "—"), p.get("placed", 0),
                         p.get("higher_studies", 0), p.get("entrepreneurs", 0),
                         total, f"{pct:.1f}%"])
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Year", "Placed", "Higher Studies", "Entrepreneurs", "Total", "P (%)"],
            table_rows=rows,
            has_placeholders=any(p.get("_placeholder") for p in placement),
            source_data={"placement": placement},
        )

    # ── Criterion 5 ───────────────────────────────────────────
    if fn == "student_faculty_ratio":
        result = formulas.student_faculty_ratio(len(students), len(faculty))
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=[
                ["Total Students", len(students)],
                ["Total Faculty", len(faculty)],
                ["SFR", f"{result['sfr']:.1f} : 1"],
                ["Marks Scored", f"{result['marks']:.0f} / 30"],
            ],
            source_data={"students": len(students), "faculty": len(faculty)},
        )

    if fn == "faculty_qualification_index":
        result = formulas.faculty_qualification_index(
            phd_count=qual_counts["phd"],
            mtech_count=qual_counts["mtech"],
            required_faculty=required_faculty,
        )
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Qualification", "Count"],
            table_rows=[
                ["Ph.D",          qual_counts["phd"]],
                ["M.Tech/ME/MS",  qual_counts["mtech"]],
                ["Others",        qual_counts["others"]],
                ["Required Faculty (RF)", required_faculty],
                ["FQI",           f"{result['fqi']:.2f}"],
                ["Marks Scored",  f"{result['marks']:.1f} / 25"],
            ],
            source_data=qual_counts,
        )

    if fn == "faculty_cadre_proportion":
        # Tier-II normative cadre: 1 Prof : 2 Assoc : 6 Asst per 9 faculty blocks
        rf = required_faculty
        result = formulas.faculty_cadre_proportion(
            actual_professors=cadre_counts["professors"],
            actual_assoc_professors=cadre_counts["assoc_professors"],
            actual_asst_professors=cadre_counts["asst_professors"],
            required_professors=max(1, rf // 9),
            required_assoc_professors=max(1, rf * 2 // 9),
            required_asst_professors=max(1, rf * 6 // 9),
        )
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Cadre", "Required", "Actual"],
            table_rows=[
                ["Professor",            result["required"]["professors"],    cadre_counts["professors"]],
                ["Associate Professor",  result["required"]["assoc"],         cadre_counts["assoc_professors"]],
                ["Assistant Professor",  result["required"]["asst"],          cadre_counts["asst_professors"]],
                ["Marks Scored",         "— / 25",                            f"{result['marks']:.1f}"],
            ],
            source_data=cadre_counts,
        )

    if fn == "faculty_retention":
        # Placeholder retention cohort data — needs schema extension
        cohorts = {"A": 0, "B": 1, "C": max(0, len(faculty)-3),
                   "D": 1, "E": min(2, len(faculty))}
        result = formulas.faculty_retention(cohorts, required_faculty)
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Tenure Band", "Count"],
            table_rows=[
                ["< 1 year  (A)", cohorts["A"]],
                ["1-2 years (B)", cohorts["B"]],
                ["2-3 years (C)", cohorts["C"]],
                ["3-4 years (D)", cohorts["D"]],
                ["4+ years  (E)", cohorts["E"]],
                ["Marks Scored",  f"{result['marks']:.1f} / 10"],
            ],
            has_placeholders=True,
            source_data=cohorts,
        )

    if fn == "first_year_sfr":
        fy_students = [s for s in students if s.get("semester") == 1]
        result = formulas.first_year_sfr(
            first_year_students=len(fy_students),
            lateral_entry_students=0,
            required_faculty_fy=max(1, len(fy_students) // 15),
        )
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=[
                ["First Year Students (NS1)", result["first_year"]],
                ["Lateral Entry Students (NS2)", result["lateral"]],
                ["FYSFR %", f"{result['fysfr_pct']:.1f}"],
                ["Marks Scored", f"{result['marks']:.0f} / 5"],
            ],
            source_data={"fy_students": len(fy_students)},
        )

    if fn == "fdp_participation_score":
        # fdp_participation is a JSON list in faculty records
        import json
        records = []
        for f in faculty:
            raw = f.get("fdp_participation") or []
            items = json.loads(raw) if isinstance(raw, str) else raw
            for item in items:
                if isinstance(item, str):
                    records.append({"faculty_id": f["faculty_id"], "days": 5, "year": "recent"})
        result = formulas.fdp_participation_score(records, required_faculty)
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=[
                ["Faculty with FDP participation", result["participating_faculty"]],
                ["Total faculty points", result["total_faculty_pts"]],
                ["Marks Scored (Tier-II cap: 10)", f"{result['marks']:.1f} / 10"],
            ],
            source_data={"fdp_records": len(records)},
        )

    if fn == "fdp_organised_score":
        result = formulas.fdp_organised_score([1, 1, 1])  # placeholder: 1 FDP/year
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Year", "FDPs Organised", "Marks"],
            table_rows=[
                ["Year 1", 1, 2], ["Year 2", 1, 2], ["Year 3", 1, 2],
                ["Total", 3, f"{result['marks']:.0f} / 10"],
            ],
            has_placeholders=True,
            source_data={},
        )

    if fn in ("research_funding_score", "consultancy_score"):
        amount = data_client.get_research_funding(dept, node.id)
        result = formulas.research_funding_score(amount)
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=[
                ["Cumulative Amount (3 years, ₹ Lakhs)", amount],
                ["Marks Scored", f"{result['marks']:.0f} / 15"],
            ],
            has_placeholders=(amount == 0.0),
            source_data={"amount_lakhs": amount},
        )

    if fn == "seed_money_score":
        result = formulas.seed_money_score(0.0, 0.0)
        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Component", "Amount (₹ Lakhs)", "Marks"],
            table_rows=[
                ["Received", 0, result["received_marks"]],
                ["Utilised", 0, result["utilised_marks"]],
                ["Total", "—", f"{result['marks']:.0f} / 10"],
            ],
            has_placeholders=True,
            source_data={},
        )

    if fn in ("co_attainment", "po_attainment"):
        return ReportSection(
            **base,
            narrative=(
                "CO/PO attainment data requires course-level assessment records. "
                "Enter attainment levels in the table below and mark scores will be computed."
            ),
            table_headers=["Course/CO", "Direct Attainment (%)", "Indirect Attainment (%)", "Final Attainment"],
            table_rows=[["—", "—", "—", "—"]],
            has_placeholders=True,
        )

    # Fallback for unimplemented formula nodes
    return ReportSection(
        **base,
        narrative=f"[Formula not yet implemented for node {node.id}]",
        has_placeholders=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Static section content
# ─────────────────────────────────────────────────────────────────────────────

def _static_content(node_id: str) -> str:
    _content = {
        "part_c": (
            "DECLARATION\n\n"
            "We, the undersigned, certify that the information furnished in this "
            "Self-Assessment Report is accurate to the best of our knowledge and belief. "
            "We also certify that all the programs offered in the institution meet "
            "the requirements as specified in the Accreditation Manual.\n\n"
            "Signature of Head of Department: _______________\n"
            "Signature of Principal/Director: _______________\n"
            "Date: _______________"
        ),
        "ann_i": (
            "ANNEXURE I — Knowledge and Attitude Profile (WK1–WK9)\n\n"
            "WK1: Knowledge of mathematics, statistics and their applications.\n"
            "WK2: Knowledge of science: Physical, Chemical, Life sciences, Earth sciences.\n"
            "WK3: Knowledge of engineering fundamentals.\n"
            "WK4: In-depth technical knowledge in the discipline.\n"
            "WK5: Knowledge of design and manufacturing processes.\n"
            "WK6: Knowledge of engineering tools, including simulation and computing.\n"
            "WK7: Knowledge of engineering standards, codes, regulations and legal frameworks.\n"
            "WK8: Knowledge of project and financial management, entrepreneurship.\n"
            "WK9: Understanding of professional and ethical responsibilities."
        ),
        "ann_ii": (
            "ANNEXURE II — Program Outcomes (PO1–PO11)\n\n"
            "PO1: Engineering Knowledge — Apply the knowledge of mathematics, science, "
            "engineering fundamentals, and an engineering specialization to the solution "
            "of complex engineering problems.\n"
            "PO2: Problem Analysis — Identify, formulate, review research literature, and "
            "analyze complex engineering problems reaching substantiated conclusions.\n"
            "PO3: Design/Development of Solutions — Design solutions for complex engineering "
            "problems and design system components or processes that meet the specified needs.\n"
            "PO4: Conduct Investigations of Complex Problems.\n"
            "PO5: Modern Tool Usage.\n"
            "PO6: The Engineer and Society.\n"
            "PO7: Environment and Sustainability.\n"
            "PO8: Ethics.\n"
            "PO9: Individual and Team Work.\n"
            "PO10: Communication.\n"
            "PO11: Project Management and Finance.\n\n"
            "Program Specific Outcomes (PSOs):\n"
            "[Enter institution-specific PSOs here]"
        ),
        "ann_iii": (
            "ANNEXURE III — Allied Departments / Cluster Reference\n\n"
            "Refer to the NBA GAPC V4.0 document Annexure III for the complete list "
            "of allied disciplines and cluster reference data applicable to this program."
        ),
    }
    return _content.get(node_id, f"[Static content for {node_id}]")
