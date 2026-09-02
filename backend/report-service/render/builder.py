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

        # Layer 2 Summary Sheets: Default to all approved events if none explicitly selected
        selected_ids = include_event_ids if include_event_ids is not None else [e["id"] for e in all_approved if "id" in e]
        summary_sheets = []
        if selected_ids:
            summary_sheets = data_client.fetch_event_summary_sheets(
                academic_url,
                event_ids=selected_ids,
            )

        return ReportSection(
            **base,
            table_headers=["Sl. No", "Event Title", "Club / Society", "Type", "Date", "Venue", "Attendees"],
            table_rows=table_rows,
            summary_sheets=summary_sheets,
            has_placeholders=is_placeholder,
            source_data={
                "total_approved_events": len(all_approved),
                "detailed_event_ids": selected_ids or [],
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
        achievements_list = []
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
                achievements_list.append(ach)
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
                "achievements": achievements_list,
            },
        )

    if fn == "enrolment_ratio" or node.id == "4.1":
        verified_admissions = data_client.fetch_verified_admission_records(
            academic_url,
            department=dept.get("code"),
            academic_year=None,
        )
        if verified_admissions:
            sorted_adm = sorted(verified_admissions, key=lambda r: r.get("academic_year", ""), reverse=True)[:3]
            er_values = []
            for r in sorted_adm:
                n = r.get("sanctioned_intake", 0)
                n1 = r.get("total_admitted", 0) or r.get("first_year_admitted_net_migration", 0)
                er = (n1 / n * 100.0) if n > 0 else 0.0
                er_values.append(er)

            avg_er = sum(er_values) / len(er_values) if er_values else 0.0
            if avg_er >= 90:
                marks = 20.0
            elif avg_er >= 80:
                marks = 18.0
            elif avg_er >= 70:
                marks = 16.0
            elif avg_er >= 60:
                marks = 14.0
            else:
                marks = 0.0

            first_rec = sorted_adm[0]
            enrolled = first_rec.get("total_admitted", 0) or first_rec.get("first_year_admitted_net_migration", 0)
            intake   = first_rec.get("sanctioned_intake", 0)
            result = {
                "enrolled": enrolled,
                "sanctioned_intake": intake,
                "er_pct": round(avg_er, 2),
                "marks": marks,
                "max_marks": 20.0,
                "assessment_formula": f"Average [(ER1+ER2+ER3)/3] = {avg_er:.2f}% | Assessment = {marks:.2f} / 20",
            }
            table_rows = [
                ["Sanctioned Intake (N)", intake],
                ["Students Admitted (N1+N2+N3)", enrolled],
                ["Enrolment Ratio (%)", f"{avg_er:.1f}%"],
                ["Marks Scored", f"{marks:.0f} / 20"],
            ]
            return ReportSection(
                **base,
                formula_result=result,
                table_headers=["Parameter", "Value"],
                table_rows=table_rows,
                has_placeholders=False,
                source_data={"enrolled": enrolled, "sanctioned_intake": intake, "records": sorted_adm},
            )
        else:
            result = {"enrolled": 0, "sanctioned_intake": 0, "er_pct": 0.0, "marks": 0.0, "max_marks": 20.0}
            return ReportSection(
                **base,
                formula_result=result,
                table_headers=["Parameter", "Value"],
                table_rows=[["Sanctioned Intake (N)", "Data not available"], ["Students Admitted (N1+N2+N3)", "Data not available"], ["Enrolment Ratio (%)", "Data not available"], ["Marks Scored", "0 / 20"]],
                has_placeholders=True,
                source_data={"records": []},
            )

    if fn == "success_rate_without_backlog" or node.id == "4.2.1":
        batches_summary = data_client.fetch_verified_batch_progress_summary(
            academic_url,
            department=dept.get("code", "CSE"),
        )
        completed_batches = [b for b in batches_summary if b.get("year_IV")]
        if completed_batches:
            batches_3 = completed_batches[:3]
            si_values = [
                (b["year_IV"]["students_without_backlog"] / b["total_admitted"]) if b.get("total_admitted", 0) > 0 else 0.0
                for b in batches_3
            ]
            avg_si = sum(si_values) / len(si_values) if si_values else 0.0
            marks = round(avg_si * 25.0, 2)
            result = {
                "avg_si": round(avg_si, 4),
                "avg_si_pct": round(avg_si * 100.0, 2),
                "marks": marks,
                "max_marks": 25.0,
                "formula_text": f"Success rate without backlogs = 25 × Average SI = 25 × {avg_si:.2f} = {marks:.2f}",
            }

            headers = ["ITEM"] + [f"Latest Year of Graduation, {'LYG' if i==0 else f'LYGm{i}'} ({b.get('year_of_entry') or b.get('cohort_year', '')})" for i, b in enumerate(batches_3)]
            row_admitted = ["Number of students admitted in corresponding First Year + lateral entry (N1+N2)"] + [b.get("total_admitted", 0) for b in batches_3]
            row_passed = ["Number of students who have graduated without backlogs in stipulated period"] + [b.get("year_IV", {}).get("students_without_backlog", 0) for b in batches_3]
            row_si = ["Success Index (SI)"] + [f"{si:.2f}" for si in si_values]
            row_avg = ["Average SI"] + [f"{avg_si:.2f}"] + ["—"] * (len(batches_3) - 1)

            return ReportSection(
                **base,
                formula_result=result,
                table_headers=headers,
                table_rows=[row_admitted, row_passed, row_si, row_avg],
                has_placeholders=False,
                source_data={"avg_si": avg_si, "batches": batches_3},
            )
        else:
            result = {"avg_si": 0.0, "avg_si_pct": 0.0, "marks": 0.0, "max_marks": 25.0}
            return ReportSection(
                **base,
                formula_result=result,
                table_headers=["ITEM", "LYG", "LYGm1", "LYGm2"],
                table_rows=[["Data not available", "—", "—", "—"]],
                has_placeholders=True,
                source_data={"batches": []},
            )

    if fn == "success_rate_with_backlog" or node.id == "4.2.2":
        batches_summary = data_client.fetch_verified_batch_progress_summary(
            academic_url,
            department=dept.get("code", "CSE"),
        )
        completed_batches = [b for b in batches_summary if b.get("year_IV")]
        if completed_batches:
            batches_3 = completed_batches[:3]
            si_values = [
                (b["year_IV"]["students_total_passed"] / b["total_admitted"]) if b.get("total_admitted", 0) > 0 else 0.0
                for b in batches_3
            ]
            avg_si = sum(si_values) / len(si_values) if si_values else 0.0
            marks = round(avg_si * 15.0, 2)
            result = {
                "avg_si": round(avg_si, 4),
                "avg_si_pct": round(avg_si * 100.0, 2),
                "marks": marks,
                "max_marks": 15.0,
                "formula_text": f"Success rate with backlogs = 15 × Average SI = 15 × {avg_si:.2f} = {marks:.2f}",
            }

            headers = ["ITEM"] + [f"Latest Year of Graduation, {'LYG' if i==0 else f'LYGm{i}'} ({b.get('year_of_entry') or b.get('cohort_year', '')})" for i, b in enumerate(batches_3)]
            row_admitted = ["Number of students admitted in corresponding First Year + lateral entry (N1+N2)"] + [b.get("total_admitted", 0) for b in batches_3]
            row_passed = ["Number of students who have graduated in stipulated period (with backlogs)"] + [b.get("year_IV", {}).get("students_total_passed", 0) for b in batches_3]
            row_si = ["Success Index (SI)"] + [f"{si:.2f}" for si in si_values]
            row_avg = ["Average SI"] + [f"{avg_si:.2f}"] + ["—"] * (len(batches_3) - 1)

            return ReportSection(
                **base,
                formula_result=result,
                table_headers=headers,
                table_rows=[row_admitted, row_passed, row_si, row_avg],
                has_placeholders=False,
                source_data={"avg_si": avg_si, "batches": batches_3},
            )
        else:
            result = {"avg_si": 0.0, "avg_si_pct": 0.0, "marks": 0.0, "max_marks": 15.0}
            return ReportSection(
                **base,
                formula_result=result,
                table_headers=["ITEM", "LYG", "LYGm1", "LYGm2"],
                table_rows=[["Data not available", "—", "—", "—"]],
                has_placeholders=True,
                source_data={"batches": []},
            )

    if fn in ("api_year1", "api_year2", "api_year3") or node.id in ("4.3", "4.4"):
        study_yr = "III" if node.id == "4.3" or fn == "api_year3" else "II"
        perf_records = data_client.fetch_verified_academic_performance(
            academic_url,
            department=dept.get("code"),
            academic_year=None,
            year_of_study=study_yr,
        )

        if perf_records:
            records_3 = sorted(perf_records, key=lambda r: r.get("academic_year", ""), reverse=True)[:3]
            api_values = []
            total_students_count = 0
            for r in records_3:
                cgpa = float(r.get("mean_cgpa_or_percentage") or 0.0)
                succ = int(r.get("successful_students_count") or 0)
                app = int(r.get("appeared_students_count") or 1)
                total_students_count += app
                api = cgpa * (succ / app) if app > 0 else 0.0
                api_values.append(api)

            avg_api = sum(api_values) / len(api_values) if api_values else 0.0
            marks = round(1.5 * avg_api, 2)
            result = {
                "avg_api": round(avg_api, 3),
                "marks": marks,
                "max_marks": 15.0,
                "total_students": total_students_count,
                "formula_text": f"Academic Performance = 1.5 * Average API = 1.5 * {avg_api:.2f} = {marks:.2f}",
            }

            headers = ["Academic Performance"] + [r.get("academic_year") for r in records_3]
            row_x = ["Mean of CGPA or Mean Percentage of all successful Students (X)"] + [f"{r.get('mean_cgpa_or_percentage', 0.0):.2f}" for r in records_3]
            row_y = ["Total no. of Successful Students (Y)"] + [r.get("successful_students_count", 0) for r in records_3]
            row_z = ["Total no. of Students appeared in the examination (Z)"] + [r.get("appeared_students_count", 0) for r in records_3]
            row_api = ["API = X * (Y / Z)"] + [f"{api:.2f}" for api in api_values]
            row_avg = ["Average API"] + [f"{avg_api:.2f}"] + ["—"] * (len(records_3) - 1)

            return ReportSection(
                **base,
                formula_result=result,
                table_headers=headers,
                table_rows=[row_x, row_y, row_z, row_api, row_avg],
                has_placeholders=False,
                source_data={"records": records_3, "summary": result},
            )
        else:
            result = {"avg_api": 0.0, "marks": 0.0, "max_marks": 15.0, "total_students": 0, "years": []}
            return ReportSection(
                **base,
                formula_result=result,
                table_headers=["Academic Performance", "Year 1", "Year 2", "Year 3"],
                table_rows=[["Data not available", "—", "—", "—"]],
                has_placeholders=True,
                source_data={"records": []},
            )

    if fn == "placement_index" or node.id == "4.5":
        placement_summary = data_client.fetch_verified_placement_summary(academic_url)
        years_data = placement_summary.get("years", [])

        if years_data:
            years_3 = years_data[:3]
            pi_values = []
            rows = []
            for y in years_3:
                pos = y.get("career_positive_total")
                placed = y.get("verified_placed") if y.get("verified_placed") is not None else y.get("placed", 0)
                higher = y.get("verified_higher_studies") if y.get("verified_higher_studies") is not None else y.get("higher_studies", 0)
                entr   = y.get("verified_entrepreneurs") if y.get("verified_entrepreneurs") is not None else y.get("entrepreneurs", 0)
                if pos is None:
                    pos = placed + higher + entr
                tot = y.get("final_year_cohort_total") or y.get("total", 0) or 1
                pi = (pos / tot) if tot > 0 else 0.0
                pi_values.append(pi)

                rows.append([
                    y.get("academic_year") or str(y.get("cohort_year")),
                    tot,
                    placed,
                    higher,
                    entr,
                    pos,
                    f"{pi * 100.0:.1f}%",
                ])

            avg_pi = sum(pi_values) / len(pi_values) if pi_values else 0.0
            marks = round(40.0 * avg_pi, 2)
            result = {
                "avg_placement_index": round(avg_pi, 4),
                "avg_placement_pct": round(avg_pi * 100.0, 2),
                "marks": marks,
                "max_marks": 40.0,
                "formula_text": f"Assessment Points = 40 * Average Placement = 40 x {avg_pi:.2f} = {marks:.2f}",
            }

            headers = ["Academic Year", "Cohort Total (N)", "Placed (x)", "Higher Studies (y)", "Entrepreneurs (z)", "Total (x+y+z)", "Placement Index P (%)"]

            return ReportSection(
                **base,
                formula_result=result,
                table_headers=headers,
                table_rows=rows,
                has_placeholders=False,
                source_data=placement_summary,
            )
        else:
            result = {"avg_placement_index": 0.0, "avg_placement_pct": 0.0, "marks": 0.0, "max_marks": 40.0, "years": []}
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
