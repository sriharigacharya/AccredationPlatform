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
    include_event_ids: list[int] | None = None,
) -> ReportData:
    """
    Main entry point for NBA report assembly.
    app_config: Flask app.config (for service URLs).
    include_event_ids: list of event IDs selected for detailed Summary Sheets.
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
    # Note on section counts:
    # When scope="criterion:4", resolve_scope returns 12 nodes in exact SAR tree hierarchy:
    #   - 3 Structural Header Sections (marks=0, criterion_header):
    #       1. "4"   — Students' Performance (Root Criterion Header)
    #       2. "4.2" — Success Rate in Stipulated Period (Sub-criterion 4.2 Group Header)
    #       3. "4.6" — Professional Activities (Sub-criterion 4.6 Group Header)
    #   - 9 Leaf Content Subsections (marks=150 total):
    #       4. "4.1"   (20m), 5. "4.2.1" (25m), 6. "4.2.2" (15m), 7. "4.3" (15m),
    #       8. "4.4"   (15m), 9. "4.5"   (40m), 10. "4.6.1" (5m), 11. "4.6.2" (5m), 12. "4.6.3" (10m)
    # Total compiled document sections = 3 headers + 9 leaf subsections = 12 sections.
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
            include_event_ids=include_event_ids,
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
    include_event_ids: list[int] | None = None,
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

    # For any leaf or sub-node in unbuilt criteria (Criteria 1, 2, 3, 5, 6, 7, 8, 9)
    root_id = node.id.split(".")[0]
    if root_id.isdigit() and root_id != "4":
        return ReportSection(
            **base,
            narrative=(
                f"[{node.title}]\n\n"
                "Status: Not Available — Section Not Yet Implemented\n\n"
                "This section is part of the NBA SAR UG Tier-II format schema, but its automated data "
                f"compilation pipeline is scheduled for a future release. (Marks allocated: {node.marks:.0f})"
            ),
            has_placeholders=True,
        )

    if node.node_type == "narrative":
        narrative_text = ""
        has_placeholder = True
        try:
            from models import ReportNarrative
            dept_code = dept.get("code") or dept.get("id") or "CSE"
            rec = ReportNarrative.query.filter_by(
                node_id=node.id,
                department_id=dept_code,
                academic_year=academic_year,
            ).first()
            if rec and rec.narrative_text:
                narrative_text = rec.narrative_text
                has_placeholder = False
        except Exception:
            pass

        if not narrative_text:
            if node.id == "4.6.2":
                narrative_text = (
                    f"[{node.title}]\n\n"
                    "Data not available: Narrative has not yet been authored by Department Admin.\n"
                    "Use the narrative editor to document technical magazines, newsletters, and student editorial contributions.\n"
                    f"(Assessment Marks: {node.marks} marks)"
                )
            else:
                narrative_text = (
                    f"[{node.title}]\n\nPlease enter content for this section. "
                    "Use the 'Expand with AI' button to generate a draft from bullet points."
                )

        return ReportSection(
            **base,
            narrative=narrative_text,
            has_placeholders=has_placeholder,
        )

    if node.node_type in ("table", "formula_table", "events_table"):
        return _build_formula_or_table_section(
            node=node, base=base, dept=dept, students=students,
            faculty=faculty, qual_counts=qual_counts,
            cadre_counts=cadre_counts, required_faculty=required_faculty,
            academic_year=academic_year, app_config=app_config,
            include_event_ids=include_event_ids,
        )

    return ReportSection(**base)


def _build_formula_or_table_section(
    node, base, dept, students, faculty,
    qual_counts, cadre_counts, required_faculty, academic_year,
    app_config: dict | None = None,
    include_event_ids: list[int] | None = None,
) -> ReportSection:
    """Run the appropriate formula and build a table-format section."""
    fn = node.formula_fn
    academic_url = (app_config or {}).get("ACADEMIC_DATA_SERVICE_URL", "http://academic-data-service:8002")

    # ── Criterion 4 ───────────────────────────────────────────
    if fn == "club_events_summary" or node.id == "4.6.1":
        all_approved = data_client.fetch_approved_events(
            academic_url,
            department_code=dept.get("code"),
            academic_year=academic_year,
        )

        table_rows = []
        if all_approved:
            for idx, ev in enumerate(all_approved):
                table_rows.append([
                    idx + 1,
                    ev.get("title", "—"),
                    ev.get("club_name") or f"Club #{ev.get('club_id')}",
                    (ev.get("event_type") or "other").capitalize(),
                    (ev.get("event_date") or "")[:10] or "—",
                    ev.get("venue") or "—",
                    ev.get("attendee_count") or "—",
                ])
            is_placeholder = False
        else:
            table_rows = [["—", "Data not available", "—", "—", "—", "—", "—"]]
            is_placeholder = True

        # Layer 2 Summary Sheets: Only for selected events in include_event_ids
        summary_sheets = []
        if include_event_ids:
            summary_sheets = data_client.fetch_event_summary_sheets(
                academic_url,
                event_ids=include_event_ids,
            )

        return ReportSection(
            **base,
            table_headers=["Sl. No", "Event Title", "Club / Society", "Type", "Date", "Venue", "Attendees"],
            table_rows=table_rows,
            summary_sheets=summary_sheets,
            has_placeholders=is_placeholder,
            source_data={
                "total_approved_events": len(all_approved),
                "detailed_event_ids": include_event_ids or [],
                "summary_sheets_count": len(summary_sheets),
            },
        )

    if node.id == "4.6.3":
        report_data = data_client.fetch_verified_student_achievements(
            academic_url,
            academic_year=academic_year,
        )
        unified_by_year = report_data.get("unified_by_year", [])
        table_rows = []
        sl_no = 1
        for yr_grp in unified_by_year:
            for ach in yr_grp.get("achievements", []):
                stu_names = ach.get("student", {}).get("name") if isinstance(ach.get("student"), dict) else (ach.get("student_id") or "—")
                table_rows.append([
                    sl_no,
                    stu_names,
                    ach.get("event_name", "—"),
                    (ach.get("activity_type") or "other").capitalize(),
                    (ach.get("event_scope") or "within_state").replace("_", " ").title(),
                    (ach.get("event_date") or "")[:10] or "—",
                    ach.get("venue") or "—",
                    ach.get("result_description") or "—",
                ])
                sl_no += 1

        is_placeholder = len(table_rows) == 0
        if is_placeholder:
            table_rows = [["—", "Data not available", "—", "—", "—", "—", "—", "—"]]

        return ReportSection(
            **base,
            table_headers=["Sl. No", "Student Name / ID", "Event Name", "Activity Type", "Scope", "Date", "Venue", "Result / Prize"],
            table_rows=table_rows,
            has_placeholders=is_placeholder,
            source_data={
                "total_verified_achievements": report_data.get("total_verified_achievements", 0 if is_placeholder else len(table_rows)),
                "academic_years_count": report_data.get("academic_years_count", len(unified_by_year)),
            },
        )

    if fn == "enrolment_ratio" or node.id == "4.1":
        verified_admissions = data_client.fetch_verified_admission_records(
            academic_url,
            department=dept.get("code"),
            academic_year=academic_year,
        )
        if verified_admissions:
            rec = verified_admissions[0]
            enrolled = rec.get("total_admitted", 0) or rec.get("first_year_admitted_net_migration", 0)
            intake   = rec.get("sanctioned_intake", 0)
            is_placeholder = False
            result = formulas.enrolment_ratio(enrolled, intake)
            table_rows = [
                ["Sanctioned Intake (N)", intake],
                ["Students Admitted (N1+N2+N3)", enrolled],
                ["Enrolment Ratio (%)", f"{result['er_pct']:.1f}%"],
                ["Marks Scored", f"{result['marks']:.0f} / 20"],
            ]
        else:
            is_placeholder = True
            result = {"enrolled": 0, "sanctioned_intake": 0, "er_pct": 0.0, "marks": 0.0}
            table_rows = [
                ["Sanctioned Intake (N)", "Data not available"],
                ["Students Admitted (N1+N2+N3)", "Data not available"],
                ["Enrolment Ratio (%)", "Data not available"],
                ["Marks Scored", "0 / 20"],
            ]

        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=table_rows,
            has_placeholders=is_placeholder,
            source_data={"enrolled": result.get("enrolled", 0), "sanctioned_intake": result.get("sanctioned_intake", 0), "records": verified_admissions},
        )

    if fn == "success_rate_without_backlog" or node.id == "4.2.1":
        batches_summary = data_client.fetch_verified_batch_progress_summary(
            academic_url,
            department=dept.get("code", "CSE"),
        )
        completed_batches = [b for b in batches_summary if b.get("year_IV")]
        if completed_batches:
            si_values = [
                (b["year_IV"]["students_without_backlog"] / b["total_admitted"]) if b.get("total_admitted", 0) > 0 else 0.0
                for b in completed_batches
            ]
            avg_si = sum(si_values) / len(si_values) if si_values else 0.0
            result = formulas.success_rate_without_backlog(avg_si)
            table_rows = [
                ["Average Success Index (Without Backlog)", f"{result['avg_si']:.4f}"],
                ["Success Rate (%)", f"{result['avg_si_pct']:.1f}%"],
                ["Assessment Marks", f"{result['marks']:.1f} / 25"],
            ]
            is_placeholder = False
        else:
            result = {"avg_si": 0.0, "avg_si_pct": 0.0, "marks": 0.0}
            table_rows = [
                ["Average Success Index (Without Backlog)", "Data not available"],
                ["Success Rate (%)", "Data not available"],
                ["Assessment Marks", "0.0 / 25"],
            ]
            is_placeholder = True

        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=table_rows,
            has_placeholders=is_placeholder,
            source_data={"avg_si": result.get("avg_si", 0.0), "batches": completed_batches},
        )

    if fn == "success_rate_with_backlog" or node.id == "4.2.2":
        batches_summary = data_client.fetch_verified_batch_progress_summary(
            academic_url,
            department=dept.get("code", "CSE"),
        )
        completed_batches = [b for b in batches_summary if b.get("year_IV")]
        if completed_batches:
            si_values = [
                (b["year_IV"]["students_total_passed"] / b["total_admitted"]) if b.get("total_admitted", 0) > 0 else 0.0
                for b in completed_batches
            ]
            avg_si = sum(si_values) / len(si_values) if si_values else 0.0
            result = formulas.success_rate_with_backlog(avg_si)
            table_rows = [
                ["Average Success Index (With Backlogs Allowed)", f"{result['avg_si']:.4f}"],
                ["Success Rate (%)", f"{result['avg_si_pct']:.1f}%"],
                ["Assessment Marks", f"{result['marks']:.1f} / 15"],
            ]
            is_placeholder = False
        else:
            result = {"avg_si": 0.0, "avg_si_pct": 0.0, "marks": 0.0}
            table_rows = [
                ["Average Success Index (With Backlogs Allowed)", "Data not available"],
                ["Success Rate (%)", "Data not available"],
                ["Assessment Marks", "0.0 / 15"],
            ]
            is_placeholder = True

        return ReportSection(
            **base,
            formula_result=result,
            table_headers=["Parameter", "Value"],
            table_rows=table_rows,
            has_placeholders=is_placeholder,
            source_data={"avg_si": result.get("avg_si", 0.0), "batches": completed_batches},
        )

    if fn in ("api_year1", "api_year2", "api_year3") or node.id in ("4.3", "4.4"):
        study_year_map = {"api_year1": "I", "api_year2": "II", "api_year3": "III"}
        study_yr = study_year_map.get(fn, "II" if node.id == "4.3" else "III")
        perf_records = data_client.fetch_verified_academic_performance(
            academic_url,
            department=dept.get("code"),
            academic_year=academic_year,
            year_of_study=study_yr,
        )

        if perf_records:
            records_data = [
                {
                    "academic_year": r.get("academic_year"),
                    "year_of_study": r.get("year_of_study"),
                    "mean_cgpa_or_percentage": float(r.get("mean_cgpa_or_percentage") or 0.0),
                    "successful_students_count": int(r.get("successful_students_count") or 0),
                    "appeared_students_count": int(r.get("appeared_students_count") or 0),
                }
                for r in perf_records
            ]
            result = formulas.academic_performance_index(records_by_year=records_data, max_marks=float(node.marks or 15.0))
            rows = []
            for y in result.get("years", []):
                rows.append([
                    y.get("academic_year") or "—",
                    y.get("appeared_students_count", 0),
                    y.get("successful_students_count", 0),
                    f"{y.get('mean_cgpa_or_percentage', 0.0):.2f}",
                    f"{y.get('success_ratio', 0.0):.4f}",
                    f"{y.get('api', 0.0):.2f}",
                ])
            return ReportSection(
                **base,
                formula_result=result,
                table_headers=["Academic Year", "Appeared Students", "Successful Students", "Mean CGPA", "Success Ratio", "API"],
                table_rows=rows,
                has_placeholders=False,
                source_data={"records": perf_records, "summary": result},
            )
        else:
            result = {"avg_api": 0.0, "marks": 0.0, "years": []}
            return ReportSection(
                **base,
                formula_result=result,
                table_headers=["Academic Year", "Appeared Students", "Successful Students", "Mean CGPA", "Success Ratio", "API"],
                table_rows=[["Data not available", "—", "—", "—", "—", "—"]],
                has_placeholders=True,
                source_data={"records": []},
            )

    if fn == "placement_index" or node.id == "4.5":
        placement_summary = data_client.fetch_verified_placement_summary(academic_url)
        years_data = placement_summary.get("years", [])

        if years_data:
            placements_for_formula = [
                {
                    "cohort_year": y.get("cohort_year"),
                    "academic_year": y.get("academic_year"),
                    "total": y.get("final_year_cohort_total", 0),
                    "placed": y.get("verified_placed", 0),
                    "higher_studies": y.get("verified_higher_studies", 0),
                    "entrepreneurs": y.get("verified_entrepreneurs", 0),
                }
                for y in years_data
            ]
            result = formulas.placement_index(placements_for_formula)
            rows = []
            for y in result.get("years", []):
                rows.append([
                    y.get("academic_year") or str(y.get("cohort_year")),
                    y.get("total", 0),
                    y.get("placed", 0),
                    y.get("higher_studies", 0),
                    y.get("entrepreneurs", 0),
                    y.get("career_positive_total", 0),
                    f"{y.get('placement_index_pct', 0.0):.1f}%",
                ])
            return ReportSection(
                **base,
                formula_result=result,
                table_headers=["Academic Year", "Cohort Total (N)", "Placed (x)", "Higher Studies (y)", "Entrepreneurs (z)", "Total (x+y+z)", "Placement Index P (%)"],
                table_rows=rows,
                has_placeholders=False,
                source_data=placement_summary,
            )
        else:
            result = {"avg_placement_index_pct": 0.0, "marks": 0.0, "years": []}
            return ReportSection(
                **base,
                formula_result=result,
                table_headers=["Academic Year", "Cohort Total (N)", "Placed (x)", "Higher Studies (y)", "Entrepreneurs (z)", "Total (x+y+z)", "Placement Index P (%)"],
                table_rows=[["Data not available", "—", "—", "—", "—", "—", "—"]],
                has_placeholders=True,
                source_data={"placement": []},
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
                ["SFR", f"{result['sfr']:.1f} : 1" if result.get("sfr") is not None else "—"],
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
