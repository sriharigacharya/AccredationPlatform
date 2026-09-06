import sys
import os

_svc_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "report-service")
if os.path.exists(_svc_dir) and _svc_dir not in sys.path:
    sys.path.insert(0, _svc_dir)

from report_service.sar_generator import *
