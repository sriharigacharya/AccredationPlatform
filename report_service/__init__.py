import sys
import os

# Ensure backend/report-service is in sys.path
_svc_dir = os.path.join(os.path.dirname(__file__), "backend", "report-service")
if os.path.exists(_svc_dir) and _svc_dir not in sys.path:
    sys.path.insert(0, _svc_dir)

from report_service.sar_generator import generate_sar_report, build_sar_report_data
from report_service.general_report_builder import (
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
