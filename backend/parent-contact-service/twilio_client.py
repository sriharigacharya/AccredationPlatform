"""
Twilio client wrapper for parent-contact-service.
When TWILIO_ENABLED=false, these functions are never called
(the routes check the flag before calling here).
"""

import os
from flask import current_app


def _get_client():
    try:
        from twilio.rest import Client
        return Client(
            current_app.config["TWILIO_ACCOUNT_SID"],
            current_app.config["TWILIO_AUTH_TOKEN"],
        )
    except ImportError:
        raise RuntimeError("twilio package not installed. Add 'twilio' to requirements.txt.")


def send_sms(to_number: str, body: str) -> dict:
    """Send an SMS to the parent's phone number."""
    client = _get_client()
    from_number = current_app.config["TWILIO_FROM_NUMBER"]
    msg = client.messages.create(
        body=body,
        from_=from_number,
        to=f"+91{to_number}" if not to_number.startswith("+") else to_number,
    )
    return {"sid": msg.sid, "status": msg.status}


def initiate_call(to_number: str) -> dict:
    """
    Initiate a direct call to the parent.
    PRIVACY NOTE: This exposes the caller's number to the parent.
    Use initiate_proxy_call() to hide both parties' numbers.
    """
    client = _get_client()
    from_number = current_app.config["TWILIO_FROM_NUMBER"]
    to = f"+91{to_number}" if not to_number.startswith("+") else to_number
    call = client.calls.create(
        to=to,
        from_=from_number,
        # Simple TwiML: just connects the call
        twiml="<Response><Say>This is a call from your child's college. Please hold.</Say></Response>",
    )
    return {"sid": call.sid, "status": call.status}


def initiate_proxy_call(caller_number: str, callee_number: str) -> dict:
    """
    Twilio Proxy call: both caller and callee see a proxy number.
    Neither party sees the other's real number.
    Requires TWILIO_PROXY_SERVICE_SID to be set.
    """
    client = _get_client()
    proxy_service_sid = current_app.config.get("TWILIO_PROXY_SERVICE_SID")
    if not proxy_service_sid:
        raise ValueError("TWILIO_PROXY_SERVICE_SID not configured.")

    # Create a proxy session
    session = client.proxy.v1.services(proxy_service_sid).sessions.create()
    # Add participants
    client.proxy.v1.services(proxy_service_sid).sessions(session.sid).participants.create(
        identifier=f"+91{caller_number}" if not caller_number.startswith("+") else caller_number,
    )
    client.proxy.v1.services(proxy_service_sid).sessions(session.sid).participants.create(
        identifier=f"+91{callee_number}" if not callee_number.startswith("+") else callee_number,
    )
    return {"sid": session.sid, "status": "session_created"}
