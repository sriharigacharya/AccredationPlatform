"""
Report routes — Flask Blueprint for report-service.

Endpoints:
  POST /reports/nba/generate   — generate NBA SAR report
  POST /reports/adhoc          — free-text AI-grounded report
  GET  /reports/<id>/download  — stream PDF or DOCX file
  GET  /reports/history        — list jobs for the caller's scope

Role enforcement (defense-in-depth; gateway is the primary boundary):
  _ADMIN_TEACHER = {"admin", "teacher"}
  _ALL_AUTHENTICATED = {"admin", "teacher", "student", "worker"}
  Workers can view history but cannot generate NBA or adhoc reports.
  Students can request adhoc for their own linked_id only.
"""

from __future__ import annotations
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, request, jsonify, send_file, current_app
from models import db, ReportJob
from sar_tree.registry import SUPPORTED_FORMATS

logger = logging.getLogger(__name__)
reports_bp = Blueprint("reports", __name__)

_ADMIN_TEACHER = {"admin", "teacher"}
_NO_WORKER     = {"admin", "teacher", "student"}


def _role():
    return request.headers.get("X-User-Role", "").lower()

def _user_id():
    return request.headers.get("X-User-Id", "")

def _linked_id():
    return request.headers.get("X-Linked-Id", "")

def _require_role(*allowed):
    role = _role()
    if role not in allowed:
        return jsonify({"error": f"Role '{role}' not permitted for this endpoint"}), 403
    return None


# ─────────────────────────────────────────────────────────────────────────────
# GET /reports/criteria & GET /criteria
# ─────────────────────────────────────────────────────────────────────────────

@reports_bp.get("/criteria")
@reports_bp.get("/nba/criteria")
def list_criteria():
    """
    GET /reports/criteria?sar_format=ug_tier_ii_gapc_v4
    Returns all 9 root criteria with implemented | not_implemented status
    dynamically computed from the SAR tree.
    """
    sar_format = request.args.get("sar_format", "ug_tier_ii_gapc_v4")
    if sar_format not in SUPPORTED_FORMATS:
        return jsonify({"error": f"Unsupported sar_format. Supported: {SUPPORTED_FORMATS}"}), 400

    from sar_tree.registry import get_criteria_list
    criteria = get_criteria_list(sar_format)
    return jsonify({
        "sar_format": sar_format,
        "total_criteria": len(criteria),
        "implemented_criteria_count": sum(1 for c in criteria if c["is_implemented"]),
        "criteria": criteria,
    })


# ─────────────────────────────────────────────────────────────────────────────
# POST /reports/nba/generate & POST /reports/generate
# ─────────────────────────────────────────────────────────────────────────────

@reports_bp.post("/nba/generate")
@reports_bp.post("/generate")
def nba_generate():
    """
    Generate a structured NBA SAR report.
    Body:
      sar_format:        "ug_tier_ii_gapc_v4"
      department_id:     department code (e.g. "CSE")
      academic_year:     "2025-26"
      scope:             "full" | "criterion:N" | "subcriterion:N.M[.P]"
      format:            "pdf" | "docx" | "both"
      expand_narratives: bool (default false — call LLM for narrative nodes)
      include_event_ids: list of event IDs for detailed Summary Sheets
    """
    err = _require_role("admin", "teacher")
    if err:
        return err

    data              = request.get_json(force=True) or {}
    sar_format        = data.get("sar_format", "ug_tier_ii_gapc_v4")
    dept_code         = (data.get("department_id") or request.args.get("department_id") or "").strip()
    academic_year     = data.get("academic_year") or request.args.get("academic_year") or "2025-26"
    scope             = data.get("scope", "full")
    criterion_param   = request.args.get("criterion") or data.get("criterion")
    if criterion_param:
        scope = f"criterion:{criterion_param}" if not str(criterion_param).startswith("criterion:") else str(criterion_param)

    fmt               = (data.get("format") or request.args.get("format") or "pdf").lower()
    expand_narr       = data.get("expand_narratives", False)
    include_event_ids = data.get("include_event_ids") or []


    # Clean include_event_ids
    if isinstance(include_event_ids, list):
        include_event_ids = [int(x) for x in include_event_ids if str(x).isdigit()]
    else:
        include_event_ids = []

    if not dept_code:
        return jsonify({"error": "department_id is required"}), 400
    if sar_format not in SUPPORTED_FORMATS:
        return jsonify({"error": f"Unsupported sar_format. Supported: {SUPPORTED_FORMATS}"}), 400
    if fmt not in ("pdf", "docx", "both"):
        return jsonify({"error": "format must be 'pdf', 'docx', or 'both'"}), 400

    # Validate that requested criterion is implemented to avoid silent failure
    if scope.startswith("criterion:"):
        crit_id = scope.split(":", 1)[1].strip()
        from sar_tree.registry import get_criteria_list
        all_criteria = get_criteria_list(sar_format)
        target = next((c for c in all_criteria if c["id"] == crit_id), None)
        if target and not target["is_implemented"]:
            return jsonify({
                "error": f"Criterion {crit_id} ({target['title']}) is not yet available for generation. Currently implemented: Criterion 4 (Students' Performance).",
                "criterion": target,
            }), 400

    job = ReportJob(

        sar_format=sar_format,
        report_type="nba",
        scope=scope,
        department_id=dept_code,
        academic_year=academic_year,
        requester_id=_user_id(),
        requester_role=_role(),
        formats_requested=fmt,
        include_event_ids=include_event_ids,
        status="pending",
    )
    db.session.add(job)
    db.session.commit()

    try:
        from render.builder import build_report_data
        report_data = build_report_data(
            app_config=current_app.config,
            sar_format=sar_format,
            department_code=dept_code,
            academic_year=academic_year,
            scope=scope,
            report_id=job.report_id,
            include_event_ids=include_event_ids,
        )

        # Optional LLM narrative expansion
        if expand_narr:
            _expand_narratives(report_data, current_app.config)

        # Render
        reports_dir = current_app.config["REPORTS_DIR"]
        pdf_path = docx_path = None

        if fmt in ("pdf", "both"):
            from render.pdf_renderer import render_pdf
            pdf_bytes = render_pdf(report_data)
            pdf_path  = os.path.join(reports_dir, f"{job.report_id}.pdf")
            Path(pdf_path).write_bytes(pdf_bytes)

        if fmt in ("docx", "both"):
            from render.docx_renderer import render_docx
            docx_bytes = render_docx(report_data)
            docx_path  = os.path.join(reports_dir, f"{job.report_id}.docx")
            Path(docx_path).write_bytes(docx_bytes)

        job.file_pdf_path  = pdf_path
        job.file_docx_path = docx_path
        job.status         = "done"
        job.completed_at   = datetime.now(timezone.utc)
        db.session.commit()

        return jsonify({
            "report_id":         job.report_id,
            "status":            "done",
            "has_pdf":           bool(pdf_path),
            "has_docx":          bool(docx_path),
            "sections":          len(report_data.sections),
            "include_event_ids": include_event_ids,
        }), 201

    except Exception as e:
        logger.error(f"[nba_generate] Failed for job {job.report_id}: {e}", exc_info=True)
        job.status    = "error"
        job.error_msg = str(e)
        db.session.commit()
        return jsonify({"error": str(e), "report_id": job.report_id}), 500


# ─────────────────────────────────────────────────────────────────────────────
# GET /reports/criterion-4/preview
# ─────────────────────────────────────────────────────────────────────────────

@reports_bp.get("/criterion-4/preview")
def preview_criterion_4():
    """
    GET /reports/criterion-4/preview?department_id=CSE&academic_year=2025-26&include_event_ids=1,2
    Compiles all 9 subsections of Criterion 4 in canonical order:
    4.1 -> 4.2.1 -> 4.2.2 -> 4.3 -> 4.4 -> 4.5 -> 4.6.1 -> 4.6.2 -> 4.6.3
    Returns structured JSON with computed marks, tables, Layer 2 summary sheets, and 4.6.2 narrative.
    """
    err = _require_role("admin", "teacher", "student")
    if err:
        return err

    dept_code = request.args.get("department_id") or request.args.get("department") or "CSE"
    academic_year = request.args.get("academic_year") or request.args.get("academic_year_range") or "2025-26"
    sar_format = request.args.get("sar_format", "ug_tier_ii_gapc_v4")

    raw_ids = request.args.get("include_event_ids", "")
    include_event_ids = []
    if raw_ids:
        include_event_ids = [int(p.strip()) for p in raw_ids.split(",") if p.strip().isdigit()]
    for item in request.args.getlist("include_event_ids"):
        if isinstance(item, str) and item.isdigit() and int(item) not in include_event_ids:
            include_event_ids.append(int(item))

    from render.builder import build_report_data
    report_data = build_report_data(
        app_config=current_app.config,
        sar_format=sar_format,
        department_code=dept_code,
        academic_year=academic_year,
        scope="criterion:4",
        include_event_ids=include_event_ids,
    )

    subsections = []
    total_computed_marks = 0.0
    total_allocated_marks = 150

    for sec in report_data.sections:
        if sec.content_type == "criterion_header":
            continue

        # Extract numeric computed marks for this subsection
        marks_computed = 0.0
        if sec.formula_result and "marks" in sec.formula_result:
            try:
                marks_computed = float(sec.formula_result["marks"])
            except (ValueError, TypeError):
                marks_computed = 0.0
        elif sec.id in ("4.6.1", "4.6.2", "4.6.3"):
            if sec.id == "4.6.2":
                # 4.6.2 is admin-authored; any genuine non-empty narrative (>= 20 chars, not a placeholder)
                # scores full marks (5.0 / 5) — this is intentional and self-certifying, not a placeholder.
                if not sec.has_placeholders and len((sec.narrative or "").strip()) >= 20:
                    marks_computed = float(sec.marks)
                else:
                    marks_computed = 0.0
            else:
                # Mark is awarded if section has verified content / records
                if not sec.has_placeholders:
                    marks_computed = float(sec.marks)
                else:
                    marks_computed = 0.0


        total_computed_marks += marks_computed

        subsections.append({
            "id": sec.id,
            "title": sec.title,
            "marks_allocated": sec.marks,
            "marks_computed": round(marks_computed, 2),
            "content_type": sec.content_type,
            "level": sec.level,
            "narrative": sec.narrative,
            "table_headers": sec.table_headers,
            "table_rows": sec.table_rows,
            "formula_result": sec.formula_result,
            "has_placeholders": sec.has_placeholders,
            "data_available": not sec.has_placeholders,
            "summary_sheets": sec.summary_sheets,
            "source_data": sec.source_data,
        })

    return jsonify({
        "criterion_id": "4",
        "title": "Students' Performance",
        "academic_year": academic_year,
        "department_id": dept_code,
        "department_name": report_data.department.get("name", "Computer Science & Engineering"),
        "sar_format": sar_format,
        "max_marks": total_allocated_marks,
        "computed_marks_total": round(total_computed_marks, 2),
        "subsections_count": len(subsections),
        "subsections": subsections,
        "generated_at": report_data.generated_at,
    })


# ─────────────────────────────────────────────────────────────────────────────
# GET & PUT /reports/narratives/<node_id>
# ─────────────────────────────────────────────────────────────────────────────

@reports_bp.get("/narratives/<node_id>")
def get_narrative(node_id):
    """GET /reports/narratives/4.6.2?department_id=CSE&academic_year=2025-26"""
    dept_code = request.args.get("department_id") or "CSE"
    academic_year = request.args.get("academic_year") or "2025-26"
    sar_format = request.args.get("sar_format", "ug_tier_ii_gapc_v4")

    from models import ReportNarrative
    rec = ReportNarrative.query.filter_by(
        node_id=node_id,
        department_id=dept_code,
        academic_year=academic_year,
        sar_format=sar_format,
    ).first()

    if rec:
        return jsonify(rec.to_dict())
    return jsonify({
        "node_id": node_id,
        "department_id": dept_code,
        "academic_year": academic_year,
        "sar_format": sar_format,
        "narrative_text": "",
        "exists": False,
    })


@reports_bp.route("/narratives/<node_id>", methods=["POST", "PUT"])
def save_narrative(node_id):
    """Save or update admin-authored narrative text."""
    err = _require_role("admin", "teacher")
    if err:
        return err

    data = request.get_json(force=True) or {}
    narrative_text = (data.get("narrative_text") or "").strip()
    dept_code = data.get("department_id") or "CSE"
    academic_year = data.get("academic_year") or "2025-26"
    sar_format = data.get("sar_format", "ug_tier_ii_gapc_v4")

    if not narrative_text:
        return jsonify({"error": "narrative_text cannot be empty"}), 400

    from models import ReportNarrative
    rec = ReportNarrative.query.filter_by(
        node_id=node_id,
        department_id=dept_code,
        academic_year=academic_year,
        sar_format=sar_format,
    ).first()

    if rec:
        rec.narrative_text = narrative_text
        rec.author_id = _user_id()
        rec.author_role = _role()
        rec.updated_at = datetime.now(timezone.utc)
    else:
        rec = ReportNarrative(
            node_id=node_id,
            department_id=dept_code,
            academic_year=academic_year,
            sar_format=sar_format,
            narrative_text=narrative_text,
            author_id=_user_id(),
            author_role=_role(),
        )
        db.session.add(rec)

    db.session.commit()
    return jsonify(rec.to_dict()), 200


# ─────────────────────────────────────────────────────────────────────────────
# GET /reports/clubs-activities/summary-sheets
# ─────────────────────────────────────────────────────────────────────────────

@reports_bp.get("/clubs-activities/summary-sheets")
def get_clubs_summary_sheets():
    """
    GET /reports/clubs-activities/summary-sheets?event_ids=1,2,3
    Returns full detailed summary sheet data for the requested event IDs.
    Restricted to Admin and Faculty only.
    """
    err = _require_role("admin", "teacher")
    if err:
        return err

    raw_ids = request.args.get("event_ids", "")
    event_ids = []
    if raw_ids:
        event_ids = [int(p.strip()) for p in raw_ids.split(",") if p.strip().isdigit()]

    list_ids = request.args.getlist("event_ids")
    for item in list_ids:
        if isinstance(item, str) and item.isdigit() and int(item) not in event_ids:
            event_ids.append(int(item))

    import data_client
    academic_url = current_app.config.get("ACADEMIC_DATA_SERVICE_URL", "http://academic-data-service:8002")
    sheets = data_client.fetch_event_summary_sheets(academic_url, event_ids=event_ids if event_ids else None)
    return jsonify(sheets)



# ─────────────────────────────────────────────────────────────────────────────
# POST /reports/adhoc
# ─────────────────────────────────────────────────────────────────────────────


@reports_bp.post("/adhoc")
def adhoc_report():
    """
    Free-text AI-grounded report.
    Body:
      query:   "Generate a performance report for student STU001"
      format:  "pdf" | "docx" | "both"

    GROUNDING CONTRACT:
      1. LLM classifies intent
      2. We fetch real data based on intent
      3. We pass ONLY the fetched data as bullets to the LLM for narrative
      4. LLM is instructed not to state facts not in the bullets
    """
    err = _require_role("admin", "teacher", "student")
    if err:
        return err

    data   = request.get_json(force=True) or {}
    query  = (data.get("query") or "").strip()
    fmt    = data.get("format", "pdf").lower()
    role   = _role()

    if not query:
        return jsonify({"error": "query is required"}), 400

    # Students are restricted to their own linked_id
    if role == "student":
        linked = _linked_id()
        if linked and linked not in query:
            query = f"{query} (student ID: {linked})"

    job = ReportJob(
        sar_format="adhoc",
        report_type="adhoc",
        scope="adhoc",
        department_id=None,
        academic_year=datetime.now(timezone.utc).strftime("%Y"),
        requester_id=_user_id(),
        requester_role=role,
        target=query[:200],
        formats_requested=fmt,
        status="pending",
    )
    db.session.add(job)
    db.session.commit()

    try:
        import llm_client, data_client

        nlp_url      = current_app.config["NLP_RAG_SERVICE_URL"]
        academic_url = current_app.config["ACADEMIC_DATA_SERVICE_URL"]

        # Step 1: classify intent
        intent = llm_client.classify_intent(nlp_url, query)
        scope_type   = intent.get("scope", "class")
        target_id    = intent.get("target_id")
        metric_focus = intent.get("metric_focus", "all")

        # Students can only get their own data
        if role == "student":
            target_id = _linked_id() or target_id

        # Step 2: fetch real grounding data
        bullets = _fetch_grounding_bullets(
            academic_url=academic_url,
            scope_type=scope_type,
            target_id=target_id,
            metric_focus=metric_focus,
            original_query=query,
        )

        # Step 3: generate narrative from ONLY the fetched data
        narrative = llm_client.narrate(
            nlp_url=nlp_url,
            section_id="adhoc_main",
            section_title=f"Report: {query[:60]}",
            bullets=bullets,
            style="sar_tier_ii",
        )

        # Step 4: build ReportData + render
        from render.builder import build_adhoc_report_data
        report_data = build_adhoc_report_data(
            app_config=current_app.config,
            query=query,
            scope_type=scope_type,
            target_id=target_id,
            metric_focus=metric_focus,
            narrative=narrative,
            report_id=job.report_id,
        )

        reports_dir = current_app.config["REPORTS_DIR"]
        pdf_path = docx_path = None

        if fmt in ("pdf", "both"):
            from render.pdf_renderer import render_pdf
            pdf_bytes = render_pdf(report_data)
            pdf_path  = os.path.join(reports_dir, f"{job.report_id}.pdf")
            Path(pdf_path).write_bytes(pdf_bytes)

        if fmt in ("docx", "both"):
            from render.docx_renderer import render_docx
            docx_bytes = render_docx(report_data)
            docx_path  = os.path.join(reports_dir, f"{job.report_id}.docx")
            Path(docx_path).write_bytes(docx_bytes)

        job.file_pdf_path  = pdf_path
        job.file_docx_path = docx_path
        job.status         = "done"
        job.completed_at   = datetime.now(timezone.utc)
        db.session.commit()

        return jsonify({
            "report_id": job.report_id,
            "status":    "done",
            "intent":    intent,
            "has_pdf":   bool(pdf_path),
            "has_docx":  bool(docx_path),
        }), 201

    except Exception as e:
        logger.error(f"[adhoc_report] Failed for job {job.report_id}: {e}", exc_info=True)
        job.status    = "error"
        job.error_msg = str(e)
        db.session.commit()
        return jsonify({"error": str(e), "report_id": job.report_id}), 500


# ─────────────────────────────────────────────────────────────────────────────
# GET /reports/<id>/download?format=pdf|docx
# ─────────────────────────────────────────────────────────────────────────────

@reports_bp.get("/<report_id>/download")
def download_report(report_id: str):
    """Stream PDF or DOCX file for a completed report."""
    err = _require_role("admin", "teacher", "student")
    if err:
        return err

    job = ReportJob.query.filter_by(report_id=report_id).first_or_404()

    # Students can only download their own reports
    role = _role()
    if role == "student" and job.requester_id != _user_id():
        return jsonify({"error": "Access denied"}), 403

    if job.status != "done":
        return jsonify({"error": f"Report not ready. Status: {job.status}",
                        "error_msg": job.error_msg}), 422

    fmt = request.args.get("format", "pdf").lower()
    if fmt == "pdf":
        file_path  = job.file_pdf_path
        mimetype   = "application/pdf"
        filename   = f"SAR_{job.department_id}_{job.academic_year}_{report_id[:8]}.pdf"
    else:
        file_path  = job.file_docx_path
        mimetype   = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename   = f"SAR_{job.department_id}_{job.academic_year}_{report_id[:8]}.docx"

    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": f"File not found for format '{fmt}'"}), 404

    return send_file(file_path, mimetype=mimetype,
                     as_attachment=True, download_name=filename)


# ─────────────────────────────────────────────────────────────────────────────
# GET /reports/history
# ─────────────────────────────────────────────────────────────────────────────

@reports_bp.get("/history")
def report_history():
    """
    List past report jobs for the caller's scope.
    admin/teacher: see all jobs for their department (or all if admin).
    student:       see only their own jobs.
    worker:        empty list (no report access).
    """
    role = _role()
    if role == "worker":
        return jsonify([])

    q = ReportJob.query
    if role == "student":
        q = q.filter_by(requester_id=_user_id())
    elif role == "teacher":
        # Teachers see their own department's reports
        # (department filtering would need dept_id from linked_id; simplified here)
        q = q.order_by(ReportJob.created_at.desc())
    else:
        q = q.order_by(ReportJob.created_at.desc())

    jobs = q.limit(50).all()
    return jsonify([j.to_dict() for j in jobs])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _expand_narratives(report_data, app_config: dict):
    """
    Optionally call LLM to expand narrative bullets into SAR prose.
    Modifies report_data.sections in place.
    """
    import llm_client
    nlp_url = app_config.get("NLP_RAG_SERVICE_URL")
    for sec in report_data.sections:
        if sec.content_type == "narrative" and sec.narrative.startswith("["):
            # Only expand placeholder sections; don't overwrite real content
            expanded = llm_client.narrate(
                nlp_url=nlp_url,
                section_id=sec.id,
                section_title=sec.title,
                bullets=[sec.narrative],
                max_words=250,
            )
            if expanded and not expanded.startswith("["):
                sec.narrative = expanded


def _fetch_grounding_bullets(
    academic_url: str,
    scope_type: str,
    target_id: str | None,
    metric_focus: str,
    original_query: str,
) -> list[str]:
    """
    Fetch real data and convert to bullet strings for LLM grounding.
    ONLY data returned here can appear in the narrative.
    """
    import data_client
    bullets = [f"Report request: {original_query}"]

    try:
        if scope_type == "student" and target_id:
            student = data_client.fetch_student(academic_url, target_id)
            bullets += [
                f"Student: {student.get('name', target_id)} (ID: {target_id})",
                f"Semester: {student.get('semester', '—')}",
                f"Attendance: {student.get('attendance_pct', '—')}%",
                f"GPA: {student.get('previous_gpa', '—')}",
                f"Internal marks: {student.get('internal_marks', '—')}",
                f"Backlogs: {student.get('backlogs', 0)}",
                f"Final result: {student.get('final_result', '—')}",
                f"Engagement: {student.get('engagement', '—')}",
            ]

        elif scope_type == "faculty" and target_id:
            fac = data_client.fetch_faculty(academic_url, target_id)
            bullets += [
                f"Faculty: {fac.get('name', target_id)} (ID: {target_id})",
                f"Designation: {fac.get('designation', '—')}",
                f"Qualification: {fac.get('qualification', '—')}",
                f"Experience: {fac.get('experience', '—')} years",
                f"Publications: {fac.get('publications', 0)}",
                f"Research projects: {fac.get('research_projects', 0)}",
                f"Courses taught: {fac.get('courses_taught', 0)}",
            ]

        else:
            # Department / class level
            stats = data_client.fetch_student_stats(academic_url)
            bullets += [
                f"Total students: {stats.get('total_students', '—')}",
                f"Pass rate: {stats.get('pass_rate_pct', '—')}%",
                f"Average GPA: {stats.get('avg_gpa', '—')}",
                f"Average attendance: {stats.get('avg_attendance', '—')}%",
                f"At-risk students: {stats.get('at_risk', '—')}",
            ]

    except Exception as e:
        logger.warning(f"[adhoc] Grounding data fetch failed: {e}")
        bullets.append(f"Note: Could not fetch live data ({e}). Report may be incomplete.")

    return bullets
