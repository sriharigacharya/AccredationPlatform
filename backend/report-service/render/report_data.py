"""
ReportData dataclass — the single source of truth for report content.

Both pdf_renderer.py and docx_renderer.py consume this; any content
that appears in one format MUST appear here first. This design prevents
the two renderers from drifting apart.

builder.py populates ReportData; renderers only read it.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ReportSection:
    """
    Represents one SAR node's rendered content.
    content_type mirrors the SARNode.node_type.
    """
    id:           str                 # e.g. "4.1"
    title:        str                 # e.g. "Enrolment Ratio"
    marks:        int                 # max marks
    content_type: str                 # narrative | table | formula_table | static | criterion_header
    level:        int                 # 1 | 2 | 3

    # For narrative sections: text already expanded (possibly by LLM)
    narrative:    str = ""

    # For table / formula_table sections
    table_headers:    list[str]            = field(default_factory=list)
    table_rows:       list[list[Any]]      = field(default_factory=list)

    # For formula_table sections: computed result summary
    formula_result:   dict[str, Any]       = field(default_factory=dict)

    # Placeholder flag — displayed as a banner in the rendered output
    has_placeholders: bool = False

    # Raw data that was used to populate this section (for audit/grounding)
    source_data:  dict[str, Any] = field(default_factory=dict)


@dataclass
class ReportData:
    """
    Complete report ready for rendering.
    Both pdf_renderer and docx_renderer accept this and nothing else.
    """
    # Identity
    sar_format:    str          # "ug_tier_ii_gapc_v4"
    report_type:   str          # "nba" | "adhoc"
    scope:         str          # "full" | "criterion:5" | ...
    academic_year: str          # "2025-26"
    generated_at:  str          # ISO 8601 timestamp

    # Department info
    department: dict[str, Any]  # {id, code, name, vision, mission, peos, pos, cos, ...}

    # Ordered list of sections to render
    sections: list[ReportSection] = field(default_factory=list)

    # Document metadata
    institution_name: str = "Institution Name"
    program_name:     str = "B.E. Computer Science and Engineering"
    report_id:        str = ""
