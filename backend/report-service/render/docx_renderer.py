"""
DOCX renderer — python-docx: ReportData → DOCX bytes.
Consumes the same ReportData as pdf_renderer so both formats
can never silently drift apart in content.
No LibreOffice conversion step — python-docx constructs the document directly.
"""

from __future__ import annotations
import io
import logging
from typing import Any

from render.report_data import ReportData, ReportSection

logger = logging.getLogger(__name__)


def render_docx(report: ReportData) -> bytes:
    """
    Render a ReportData to DOCX bytes using python-docx.
    Returns raw bytes suitable for streaming or writing to disk.
    """
    try:
        from docx import Document
        from docx.shared import Pt, RGBColor, Cm, Inches
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.oxml.ns import qn
        from docx.oxml import OxmlElement
    except ImportError as e:
        raise RuntimeError("python-docx is not installed. Add it to requirements.txt.") from e

    doc = Document()

    # ── Document margins ──────────────────────────────────────
    from docx.oxml.ns import qn
    section = doc.sections[0]
    section.page_width  = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin   = Cm(2.5)
    section.right_margin  = Cm(2.0)
    section.top_margin    = Cm(2.5)
    section.bottom_margin = Cm(2.0)

    # ── Define styles ─────────────────────────────────────────
    _setup_styles(doc)

    # ── Title page ────────────────────────────────────────────
    _add_title_page(doc, report)

    # ── Sections ──────────────────────────────────────────────
    for sec in report.sections:
        _add_section(doc, sec)

    # ── Signature block ───────────────────────────────────────
    doc.add_page_break()
    doc.add_paragraph("DECLARATION / SIGNATURES", style="Heading 2")
    sig_table = doc.add_table(rows=2, cols=2)
    sig_table.style = "Table Grid"
    sig_table.cell(0, 0).text = "Head of Department"
    sig_table.cell(0, 1).text = "Principal / Director"
    sig_table.cell(1, 0).text = "Date: ___________"
    sig_table.cell(1, 1).text = "Date: ___________"

    # ── Serialise to bytes ────────────────────────────────────
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    docx_bytes = buf.read()
    logger.info(f"[docx_renderer] Generated DOCX: {len(docx_bytes):,} bytes for report_id={report.report_id}")
    return docx_bytes


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _setup_styles(doc):
    """Ensure all custom styles exist in the document."""
    from docx.shared import Pt, RGBColor
    styles = doc.styles

    def _get_or_create(name, base="Normal"):
        try:
            return styles[name]
        except KeyError:
            style = styles.add_style(name, 1)  # 1 = WD_STYLE_TYPE.PARAGRAPH
            style.base_style = styles[base]
            return style

    formula_style = _get_or_create("FormulaResult", "Normal")
    formula_style.font.size = Pt(11)
    formula_style.font.bold = True
    formula_style.font.color.rgb = RGBColor(0x27, 0x67, 0x49)

    placeholder_style = _get_or_create("PlaceholderWarning", "Normal")
    placeholder_style.font.size = Pt(9)
    placeholder_style.font.color.rgb = RGBColor(0x74, 0x42, 0x10)
    placeholder_style.font.italic = True


def _add_title_page(doc, report: ReportData):
    from docx.shared import Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc.add_page_break()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("NATIONAL BOARD OF ACCREDITATION")
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0x71, 0x80, 0x96)

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = p2.add_run("SELF-ASSESSMENT REPORT (SAR)")
    r2.bold = True
    r2.font.size = Pt(20)
    r2.font.color.rgb = RGBColor(0x1a, 0x36, 0x5d)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub.add_run("UG Engineering Programs — Tier-II Institution | GAPC V4.0 | January 2025").font.size = Pt(10)

    doc.add_paragraph()

    inst = doc.add_paragraph()
    inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_inst = inst.add_run(report.institution_name)
    r_inst.bold = True
    r_inst.font.size = Pt(16)

    prog = doc.add_paragraph()
    prog.alignment = WD_ALIGN_PARAGRAPH.CENTER
    prog.add_run(report.program_name).font.size = Pt(13)

    dept = doc.add_paragraph()
    dept.alignment = WD_ALIGN_PARAGRAPH.CENTER
    dept.add_run(f"Department of {report.department.get('name', '—')}").font.size = Pt(11)

    doc.add_paragraph()
    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.add_run(f"Academic Year: {report.academic_year}  |  Generated: {report.generated_at[:10]}")

    doc.add_page_break()


def _add_section(doc, sec: ReportSection):
    from docx.shared import Pt, RGBColor

    # Criterion header
    if sec.content_type == "criterion_header":
        doc.add_page_break()
        h = doc.add_paragraph(style="Heading 1")
        h.add_run(f"Criterion {sec.id}: {sec.title}")
        return

    # Sub-section heading
    heading_level = min(sec.level + 1, 4)
    h = doc.add_paragraph(style=f"Heading {heading_level}")
    h.add_run(f"{sec.id}  {sec.title}  ({sec.marks} marks)")

    # Placeholder warning
    if sec.has_placeholders:
        pw = doc.add_paragraph(style="PlaceholderWarning")
        pw.add_run("⚠ Placeholder data — verify before submission.")

    # Formula result summary
    if sec.formula_result:
        fr = doc.add_paragraph(style="FormulaResult")
        marks = sec.formula_result.get("marks", "—")
        fr.add_run(f"Score: {marks} / {sec.marks} marks")
        for k, v in sec.formula_result.items():
            if k != "marks":
                fr.add_run(f"   |   {k}: {v}")

    # Table
    if sec.table_rows:
        cols = len(sec.table_headers) if sec.table_headers else len(sec.table_rows[0])
        tbl  = doc.add_table(rows=0, cols=cols)
        tbl.style = "Table Grid"

        if sec.table_headers:
            hdr_cells = tbl.add_row().cells
            for i, h_text in enumerate(sec.table_headers):
                hdr_cells[i].text = str(h_text)
                run = hdr_cells[i].paragraphs[0].runs[0]
                run.bold = True

        for row_data in sec.table_rows:
            row_cells = tbl.add_row().cells
            for i, cell_val in enumerate(row_data):
                row_cells[i].text = str(cell_val)

        doc.add_paragraph()

    # Detailed Summary Sheets (Section 4.6.1)
    if getattr(sec, "summary_sheets", None):
        h_sum = doc.add_paragraph(style="Heading 3")
        h_sum.add_run(f"Detailed Activity Summary Sheets ({len(sec.summary_sheets)} Selected Events)")

        for sheet in sec.summary_sheets:
            p_title = doc.add_paragraph()
            r_title = p_title.add_run(f"Event: {sheet.get('title', '—')}")
            r_title.bold = True
            r_title.font.size = Pt(11)

            p_meta = doc.add_paragraph()
            p_meta.add_run(f"Club: {sheet.get('club_name', '—')}  |  Type: {sheet.get('event_type', '—').capitalize()}  |  Date: {(sheet.get('event_date') or '')[:10]}")

            tbl_s = doc.add_table(rows=3, cols=2)
            tbl_s.style = "Table Grid"
            tbl_s.cell(0, 0).text = f"Venue: {sheet.get('venue') or 'Campus'}"
            tbl_s.cell(0, 1).text = f"Attendees: {sheet.get('attendee_count') or '—'}"
            tbl_s.cell(1, 0).text = f"Resource Person: {sheet.get('resource_person') or '—'}"
            tbl_s.cell(1, 1).text = f"Skill Orientation: {sheet.get('skill_orientation') or '—'}"
            tbl_s.cell(2, 0).text = f"PO Mapping: {sheet.get('po_mapping') or 'PO1, PO2, PO5, PO12'}"
            tbl_s.cell(2, 1).text = f"Mentor/Reviewer: {sheet.get('reviewer_name') or '—'}"

            if sheet.get("report_text") or sheet.get("description"):
                p_rep = doc.add_paragraph()
                r_rep_lbl = p_rep.add_run("Report / Outcomes: ")
                r_rep_lbl.bold = True
                p_rep.add_run(sheet.get("report_text") or sheet.get("description"))

            doc.add_paragraph()

    # Narrative / static text
    if sec.narrative:
        for line in sec.narrative.split("\n"):
            doc.add_paragraph(line)

