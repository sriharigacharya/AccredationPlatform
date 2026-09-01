"""Contact initiation routes (call/SMS) for parent-contact-service."""

from flask import Blueprint, request, jsonify, current_app
from models import db, ParentRecord, ContactLog
from twilio_client import send_sms, initiate_call, initiate_proxy_call

contact_bp = Blueprint("contact", __name__)


def _log(student_id, initiated_by, method, status, sid=None, message=None, error=None):
    log = ContactLog(
        student_id=student_id,
        initiated_by=initiated_by,
        contact_method=method,
        status=status,
        twilio_sid=sid,
        message=message,
        error_message=error,
    )
    db.session.add(log)
    db.session.commit()
    return log


@contact_bp.post("/call")
def call_parent():
    """
    POST /contact/call
    Body: { "student_id": "STU001", "use_proxy": true }
    Headers: X-User-Id (faculty/user), X-User-Role
    
    PRIVACY NOTE: use_proxy=true → Twilio proxy call hides real number from faculty.
    If college decides proxy is not required, set use_proxy=false.
    Always checks consent_to_contact flag before proceeding.
    """
    data        = request.get_json(force=True) or {}
    student_id  = data.get("student_id")
    use_proxy   = data.get("use_proxy", True)
    initiated_by= request.headers.get("X-User-Id", "unknown")

    if not student_id:
        return jsonify({"error": "student_id is required"}), 400

    parent = ParentRecord.query.filter_by(student_id=student_id).first()
    if not parent:
        return jsonify({"error": "No parent record found for this student"}), 404

    # ── Consent check ─────────────────────────────────────────
    if not parent.consent_to_contact:
        _log(student_id, initiated_by, "Call", "consent_denied")
        return jsonify({
            "error":   "Contact blocked: parent has not given consent.",
            "student_id": student_id,
            # GUIDE DISCUSSION: Should faculty be shown the reason, or just blocked silently?
        }), 403

    if not current_app.config.get("TWILIO_ENABLED"):
        # ── Mock mode ─────────────────────────────────────────
        log = _log(student_id, initiated_by, "Call", "mock")
        return jsonify({
            "status":      "mock",
            "message":     f"[MOCK] Would call {parent.parent_name} via {'proxy' if use_proxy else 'direct'}.",
            "student_id":  student_id,
            "log_id":      log.id,
        })

    try:
        if use_proxy:
            result = initiate_proxy_call(
                caller_number=data.get("caller_number", current_app.config["TWILIO_FROM_NUMBER"]),
                callee_number=parent.primary_mobile,
            )
        else:
            result = initiate_call(to_number=parent.primary_mobile)

        log = _log(student_id, initiated_by, "Call", "success", sid=result.get("sid"))
        return jsonify({"status": "success", "call_sid": result.get("sid"), "log_id": log.id})
    except Exception as e:
        log = _log(student_id, initiated_by, "Call", "failed", error=str(e))
        return jsonify({"status": "failed", "error": str(e), "log_id": log.id}), 500


@contact_bp.post("/sms")
def sms_parent():
    """
    POST /contact/sms
    Body: { "student_id": "STU001", "message": "Please contact the college..." }
    """
    data        = request.get_json(force=True) or {}
    student_id  = data.get("student_id")
    message     = data.get("message", "").strip()
    initiated_by= request.headers.get("X-User-Id", "unknown")

    if not student_id or not message:
        return jsonify({"error": "student_id and message are required"}), 400

    parent = ParentRecord.query.filter_by(student_id=student_id).first()
    if not parent:
        return jsonify({"error": "No parent record found"}), 404

    if not parent.consent_to_contact:
        _log(student_id, initiated_by, "SMS", "consent_denied")
        return jsonify({"error": "Contact blocked: no consent"}), 403

    if not current_app.config.get("TWILIO_ENABLED"):
        log = _log(student_id, initiated_by, "SMS", "mock", message=message)
        return jsonify({
            "status":  "mock",
            "message": f"[MOCK] Would send SMS to {parent.parent_name}: '{message}'",
            "log_id":  log.id,
        })

    try:
        result = send_sms(to_number=parent.primary_mobile, body=message)
        log = _log(student_id, initiated_by, "SMS", "success", sid=result.get("sid"), message=message)
        return jsonify({"status": "success", "message_sid": result.get("sid"), "log_id": log.id})
    except Exception as e:
        log = _log(student_id, initiated_by, "SMS", "failed", error=str(e))
        return jsonify({"status": "failed", "error": str(e), "log_id": log.id}), 500


@contact_bp.get("/log")
def contact_log():
    """GET /contact/log?student_id=STU001&limit=20 — contact history."""
    student_id = request.args.get("student_id")
    limit      = int(request.args.get("limit", 50))

    query = ContactLog.query
    if student_id:
        query = query.filter_by(student_id=student_id)

    logs = query.order_by(ContactLog.created_at.desc()).limit(limit).all()
    return jsonify([l.to_dict() for l in logs])
