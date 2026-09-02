"""
API Gateway Proxy Middleware — AcademiQ
Enforces role-based access at the network boundary (not just the UI).

Roles: student | teacher | admin | worker

Security contract:
  - worker : documents only — all other services return 403
  - student : own academic record (read-only), own prediction, RAG chat only
  - teacher : students/faculty/contact/parents/rag/predict — no admin tools
  - admin   : everything

The ROUTE_TABLE is the single source of truth for permissions.
ANY route not in the table returns 404 (fail-closed).
"""

import jwt
import logging
import requests as req
from flask import Blueprint, request, jsonify, current_app, Response

proxy_bp = Blueprint("proxy", __name__)
logger   = logging.getLogger(__name__)

# ── Role sets (reused across table for readability) ───────────────────────────
_ADMIN          = {"admin"}
_ADMIN_TEACHER  = {"admin", "teacher"}
_STAFF          = {"admin", "teacher"}          # no student, no worker
_ALL_AUTH       = {"admin", "teacher", "student", "worker"}
_NO_WORKER      = {"admin", "teacher", "student"}
_WORKER_ONLY    = {"worker", "admin"}           # admin can always access everything

# ── Route table ───────────────────────────────────────────────────────────────
# (path_prefix, service_config_key, requires_auth, allowed_roles_set | None)
#
# • allowed_roles=None  → any authenticated user (still requires valid JWT)
# • allowed_roles=set   → only those roles; others get 403
# • requires_auth=False → public (no JWT needed)
#
# Order matters: first matching prefix wins.

ROUTE_TABLE = [
    # ── Auth (public) ─────────────────────────────────────────
    ("/auth/login",     "AUTH_SERVICE_URL", False, None),
    ("/auth/register",  "AUTH_SERVICE_URL", False, None),
    ("/auth/verify",    "AUTH_SERVICE_URL", False, None),

    # ── Auth (protected) ──────────────────────────────────────
    ("/auth/me",        "AUTH_SERVICE_URL", True,  _ALL_AUTH),
    ("/auth/users",     "AUTH_SERVICE_URL", True,  _ADMIN),

    # ── Academic data ─────────────────────────────────────────
    # Worker has ZERO access to academic-data-service (403 enforced here)
    # Student gets read-only enforced by the service itself via X-User-Role header
    ("/students",       "ACADEMIC_DATA_SERVICE_URL",  True, _NO_WORKER),
    ("/faculty",        "ACADEMIC_DATA_SERVICE_URL",  True, _NO_WORKER),
    ("/departments",    "ACADEMIC_DATA_SERVICE_URL",  True, _NO_WORKER),
    ("/assignments",    "ACADEMIC_DATA_SERVICE_URL",  True, _NO_WORKER),
    ("/classes",        "ACADEMIC_DATA_SERVICE_URL",  True, _STAFF),


    # ── Clubs & Events ────────────────────────────────────────
    # Fine-grained role checks (mentor-only approve, head/council submit)
    # happen inside academic-data-service, not at gateway level.
    ("/clubs",          "ACADEMIC_DATA_SERVICE_URL",  True, _ALL_AUTH),
    ("/student-roles",  "ACADEMIC_DATA_SERVICE_URL",  True, _ALL_AUTH),
    ("/events",         "ACADEMIC_DATA_SERVICE_URL",  True, _ALL_AUTH),
    ("/event-photos",   "ACADEMIC_DATA_SERVICE_URL",  True, _ALL_AUTH),

    # ── Placements & Offer Letters ────────────────────────────
    ("/profile/placement", "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),
    ("/placements",        "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),
    ("/offer-letters",     "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),

    # ── Student Achievements (External Competitions) ──────────
    ("/student-achievements", "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),
    ("/achievement-proofs",   "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),
    ("/achievement-photos",   "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),

    # ── Historical Criterion 4 Data (Admission, Batches, Performance) ──
    ("/admission-records",    "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),
    ("/batch-progress",       "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),
    ("/academic-performance", "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),
    ("/academic-batches",     "ACADEMIC_DATA_SERVICE_URL", True, _ALL_AUTH),



    # ── Parent contact ────────────────────────────────────────
    # Worker has NO access to parent-contact-service
    ("/parents",        "PARENT_CONTACT_SERVICE_URL", True, _STAFF),
    ("/contact",        "PARENT_CONTACT_SERVICE_URL", True, _STAFF),

    # ── Documents ─────────────────────────────────────────────
    # Worker CAN access documents (upload/download only — their sole service)
    ("/documents",      "DOCUMENT_SERVICE_URL",       True, _ALL_AUTH),

    # ── RAG / NLP ─────────────────────────────────────────────
    # Worker cannot access RAG (no student data context needed)
    ("/rag",            "NLP_RAG_SERVICE_URL",        True, _NO_WORKER),
    ("/embed",          "NLP_RAG_SERVICE_URL",        True, _ADMIN),
    ("/collections",    "NLP_RAG_SERVICE_URL",        True, _ADMIN_TEACHER),

    # ── Predictions ───────────────────────────────────────────
    # Worker cannot access predictions
    ("/predict/train",  "PREDICTION_SERVICE_URL",     True, _ADMIN),
    ("/predict",        "PREDICTION_SERVICE_URL",     True, _NO_WORKER),

    # ── Reports ───────────────────────────────────────────────
    # Criteria discovery: accessible to all authenticated roles (Admin, Teacher, Student, Worker)
    ("/criteria",         "REPORT_SERVICE_URL",          True, _ALL_AUTH),
    ("/reports/criteria", "REPORT_SERVICE_URL",          True, _ALL_AUTH),
    # NBA generation: admin and teacher only (workers/students cannot generate NBA SARs)
    ("/reports/nba",      "REPORT_SERVICE_URL",          True, _ADMIN_TEACHER),
    # Adhoc + download + history: admin, teacher, student (no worker)
    ("/reports",          "REPORT_SERVICE_URL",          True, _NO_WORKER),
]




# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_token(token: str) -> dict:
    secret    = current_app.config["JWT_SECRET"]
    algorithm = current_app.config["JWT_ALGORITHM"]
    return jwt.decode(token, secret, algorithms=[algorithm])


def _get_bearer() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def _match_route(path: str):
    """
    Find the first matching route entry for the given path.
    Returns (prefix, svc_key, requires_auth, allowed_roles) or (None, None, True, None).
    """
    for prefix, svc_key, requires_auth, roles in ROUTE_TABLE:
        if (path == prefix
                or path.startswith(prefix + "/")
                or path.startswith(prefix + "?")):
            return prefix, svc_key, requires_auth, roles
    return None, None, True, None


# ── Main proxy handler ────────────────────────────────────────────────────────

@proxy_bp.route("/<path:subpath>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def proxy(subpath):
    """
    1. Match route (fail-closed: unknown routes → 404)
    2. Validate JWT (if required)
    3. Enforce role (if restricted) → 403 on mismatch
    4. Forward request + inject X-User-* headers
    5. Return upstream response verbatim
    """
    path = "/" + subpath

    prefix, svc_key, requires_auth, allowed_roles = _match_route(path)
    if svc_key is None:
        return jsonify({"error": f"No route configured for {path}"}), 404

    user_payload = None

    # ── Step 1: JWT verification ───────────────────────────────
    if requires_auth:
        token = _get_bearer()
        if not token:
            return jsonify({
                "error": "Authentication required",
                "hint":  "Include Authorization: Bearer <token>"
            }), 401

        try:
            user_payload = _decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired — please login again"}), 401
        except Exception:
            return jsonify({"error": "Invalid token"}), 401

    # ── Step 2: Role enforcement (gateway-level) ───────────────
    if requires_auth and allowed_roles is not None:
        user_role = user_payload.get("role", "")
        if user_role not in allowed_roles:
            logger.warning(
                f"[gateway] 403 role={user_role} path={path} "
                f"allowed={allowed_roles}"
            )
            return jsonify({
                "error":        "Access denied",
                "your_role":    user_role,
                "allowed_roles": sorted(allowed_roles),
                "path":         path,
            }), 403

    # ── Step 3: Build upstream URL ─────────────────────────────
    base_url = current_app.config[svc_key]
    qs       = request.query_string.decode("utf-8")
    upstream = f"{base_url}{path}" + (f"?{qs}" if qs else "")

    # ── Step 4: Forward headers (inject user context) ──────────
    forward_headers = {
        k: v for k, v in request.headers
        if k.lower() not in ("host", "content-length")
    }
    if user_payload:
        forward_headers["X-User-Id"]    = str(user_payload.get("user_id", ""))
        forward_headers["X-User-Db-Id"] = str(user_payload.get("db_id", ""))
        forward_headers["X-User-Role"]  = user_payload.get("role", "")
        forward_headers["X-User-Name"]  = user_payload.get("name", "")
        forward_headers["X-Linked-Id"]  = user_payload.get("linked_id", "") or ""

    # ── Step 5: Forward request ────────────────────────────────
    try:
        resp = req.request(
            method         = request.method,
            url            = upstream,
            headers        = forward_headers,
            data           = request.get_data(),
            timeout        = 60,
            allow_redirects= False,
            stream         = True,
        )

    except req.exceptions.ConnectionError:
        logger.error(f"[gateway] Cannot connect to {svc_key} at {base_url}")
        return jsonify({"error": f"Service unavailable: {svc_key.lower().replace('_url', '')}"}), 503
    except req.exceptions.Timeout:
        return jsonify({"error": "Upstream service timed out"}), 504
    except Exception as e:
        logger.error(f"[gateway] Unexpected proxy error: {e}")
        return jsonify({"error": "Internal gateway error"}), 500

    # ── Step 6: Return upstream response ───────────────────────
    excluded_headers = {"content-encoding", "transfer-encoding", "connection"}
    response_headers = {
        k: v for k, v in resp.headers.items()
        if k.lower() not in excluded_headers
    }

    return Response(
        response     = resp.content,
        status       = resp.status_code,
        headers      = response_headers,
        content_type = resp.headers.get("Content-Type", "application/json"),
    )
