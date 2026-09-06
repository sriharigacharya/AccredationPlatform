"""
report_service package — AcademiQ Report Generation Services.

Contains two isolated report generation modules:
- sar_generator: NBA SAR Criterion 4 generation (untouched existing logic)
- general_report_builder: General AI Report Builder (department_summary, club_activity, custom)
"""

from .sar_generator import generate_sar_report, build_sar_report_data
from .general_report_builder import (
    ReportType,
    DataSource,
    build_general_report,
    SYSTEM_PROMPT_DEPARTMENT_SUMMARY,
    SYSTEM_PROMPT_CLUB_ACTIVITY,
    SYSTEM_PROMPT_CUSTOM,
)

__all__ = [
    "generate_sar_report",
    "build_sar_report_data",
    "ReportType",
    "DataSource",
    "build_general_report",
    "SYSTEM_PROMPT_DEPARTMENT_SUMMARY",
    "SYSTEM_PROMPT_CLUB_ACTIVITY",
    "SYSTEM_PROMPT_CUSTOM",
]
