"""
SAR Report Generator Service — NBA Criterion 4 and Tier-II SAR Reports.

This module encapsulates the existing NBA SAR generation logic and MUST remain
untouched. It handles:
- UG Tier-II GAPC V4.0 Criteria calculations (Criterion 4 Students' Performance:
  4.1 Enrolment Ratio, 4.2 Success Rate, 4.3 3rd Year API, 4.4 2nd Year API,
  4.5 Placement Index, 4.6.1 Professional Activities / Events, 4.6.2 Technical Magazines,
  4.6.3 Inter-Institute Participation).
- NBA SAR tree traversal and formula evaluations.
- SAR-specific narrative formatting and placeholders.
"""

from __future__ import annotations
import logging
from typing import Any

from render.builder import build_report_data
from render.report_data import ReportData

logger = logging.getLogger(__name__)


def build_sar_report_data(
    app_config: dict,
    sar_format: str = "ug_tier_ii_gapc_v4",
    department_code: str = "CSE",
    academic_year: str = "2025-26",
    scope: str = "full",
    report_id: str = "",
    include_event_ids: list[int] | None = None,
) -> ReportData:
    """
    Build structured ReportData for an NBA SAR report.
    Delegates to render.builder.build_report_data for canonical SAR node generation.
    """
    return build_report_data(
        app_config=app_config,
        sar_format=sar_format,
        department_code=department_code,
        academic_year=academic_year,
        scope=scope,
        report_id=report_id,
        include_event_ids=include_event_ids,
    )


def expand_sar_narratives(report_data: ReportData, app_config: dict) -> None:
    """
    Optionally call LLM to expand narrative bullets into SAR prose.
    Modifies report_data.sections in place using SAR Tier-II style.
    """
    import llm_client
    nlp_url = app_config.get("NLP_RAG_SERVICE_URL")
    for sec in report_data.sections:
        if sec.content_type == "narrative" and sec.narrative.startswith("["):
            expanded = llm_client.narrate(
                nlp_url=nlp_url,
                section_id=sec.id,
                section_title=sec.title,
                bullets=[sec.narrative],
                style="sar_tier_ii",
                max_words=250,
            )
            if expanded and not expanded.startswith("["):
                sec.narrative = expanded


def generate_sar_report(
    app_config: dict,
    sar_format: str = "ug_tier_ii_gapc_v4",
    department_code: str = "CSE",
    academic_year: str = "2025-26",
    scope: str = "full",
    report_id: str = "",
    include_event_ids: list[int] | None = None,
    expand_narratives: bool = False,
) -> ReportData:
    """
    Complete pipeline to generate an NBA SAR report.
    """
    data = build_sar_report_data(
        app_config=app_config,
        sar_format=sar_format,
        department_code=department_code,
        academic_year=academic_year,
        scope=scope,
        report_id=report_id,
        include_event_ids=include_event_ids,
    )
    if expand_narratives:
        expand_sar_narratives(data, app_config)
    return data
