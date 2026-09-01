"""
PDF renderer — WeasyPrint: ReportData → PDF bytes.
Reads from ReportData only; never calls data_client or formulas.
"""

from __future__ import annotations
import logging
import os
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from render.report_data import ReportData

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).parent / "templates"


def render_pdf(report: ReportData) -> bytes:
    """
    Render a ReportData to PDF bytes using WeasyPrint.
    Returns raw PDF bytes suitable for streaming or writing to disk.
    """
    try:
        from weasyprint import HTML, CSS
    except ImportError as e:
        raise RuntimeError(
            "WeasyPrint is not installed. Add it to requirements.txt."
        ) from e

    html_str = _render_html(report)

    # WeasyPrint renders from HTML string; CSS is inlined via the Jinja template
    pdf_bytes = HTML(string=html_str, base_url=str(_TEMPLATES_DIR)).write_pdf()
    logger.info(f"[pdf_renderer] Generated PDF: {len(pdf_bytes):,} bytes for report_id={report.report_id}")
    return pdf_bytes


def _render_html(report: ReportData) -> str:
    """Render the Jinja2 HTML template with report data."""
    css_path = _TEMPLATES_DIR / "report.css"
    css_content = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template("base.html")
    return template.render(
        report=report,
        sections=report.sections,
        css_content=css_content,
    )
