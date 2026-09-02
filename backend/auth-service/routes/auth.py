"""
Auth routes — /auth/login, /auth/register, /auth/me, /auth/users, /auth/verify
4 roles: student | teacher | admin | worker
"""

import os
import jwt
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, VALID_ROLES

auth_bp = Blueprint("auth", __name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _next_user_id() -> str:
    """Auto-generate next user_id like U005, U006…"""
    last = User.query.order_by(User.id.desc()).first()
    num  = (last.id + 1) if last else 1
    return f"U{num:03d}"


def make_token(user: User) -> str:
    secret    = current_app.config["JWT_SECRET"]
    algorithm = current_app.config["JWT_ALGORITHM"]
    hours     = current_app.config["JWT_EXPIRY_HOURS"]
    payload   = {
        "user_id":   user.user_id,       # e.g. "U001"
        "db_id":     user.id,            # integer PK (for DB lookups)
        "email":     user.email,
        "role":      user.role,          # student | teacher | admin | worker
        "name":      user.name,
        "linked_id": user.linked_id,     # student_id / faculty_id / null
        "exp":       datetime.now(timezone.utc) + timedelta(hours=hours),
        "iat":       datetime.now(timezone.utc),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_token(token: str) -> dict:
    secret    = current_app.config["JWT_SECRET"]
    algorithm = current_app.config["JWT_ALGORITHM"]
    return jwt.decode(token, secret, algorithms=[algorithm])


def get_bearer() -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def _require_admin():
    """Return (payload, None) or (None, error_response)."""
    token = get_bearer()
    if not token:
        return None, (jsonify({"error": "Authentication required"}), 401)
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        return None, (jsonify({"error": "Token expired"}), 401)
    except Exception:
        return None, (jsonify({"error": "Invalid token"}), 401)
    if payload.get("role") != "admin":
        return None, (jsonify({"error": "Admin access required"}), 403)
    return payload, None


# ── Routes ────────────────────────────────────────────────────────────────────

@auth_bp.post("/login")
def login():
    """
    POST /auth/login
    Body: { "email": "...", "password": "..." }
    Returns: {
        "access_token", "token_type", "role", "user_id", "name", "linked_id",
        "redirect": "/dashboard" | "/teacher" | "/worker" | "/my-record"
    }
    The `redirect` field lets the frontend know exactly where to send the user.
    """
    data = request.get_json(force=True) or {}
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    # Common demo email aliases
    alias_map = {
        "teacher@academiq.edu": "meena.iyer@faculty.academiq.edu",
        "student@academiq.edu": "aarav.stu001@student.academiq.edu",
    }
    lookup_email = alias_map.get(email, email)

    user = User.query.filter(
        ((User.email == email) | (User.email == lookup_email)),
        User.is_active == True
    ).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401


    # Role-based redirect hint for the frontend
    redirect_map = {
        "admin":   "/dashboard",
        "teacher": "/dashboard",
        "student": "/my-record",
        "worker":  "/documents",
    }

    token = make_token(user)
    return jsonify({
        "access_token": token,
        "token_type":   "Bearer",
        "role":         user.role,
        "user_id":      user.user_id,
        "name":         user.name,
        "linked_id":    user.linked_id,
        "redirect":     redirect_map.get(user.role, "/dashboard"),
    })


@auth_bp.post("/register")
def register():
    """
    POST /auth/register
    Body: { "email", "password", "name", "role"?, "linked_id"? }
    Rules:
      - admin/teacher/worker accounts require an admin token.
      - student accounts require admin token too (self-registration disabled).
      - Exception: first ever call with role=admin is allowed to bootstrap.
    """
    data      = request.get_json(force=True) or {}
    email     = data.get("email", "").strip().lower()
    password  = data.get("password", "")
    name      = data.get("name", "").strip()
    role      = data.get("role", "student").lower()
    linked_id = data.get("linked_id") or data.get("ref_id")  # accept both names
    user_id   = data.get("user_id")  # optional override

    if not all([email, password, name]):
        return jsonify({"error": "email, password, and name are required"}), 400

    if role not in VALID_ROLES:
        return jsonify({"error": f"role must be one of: {', '.join(VALID_ROLES)}"}), 400

    # Guard: all account creation requires admin — except first-ever bootstrap
    token = get_bearer()
    if token:
        try:
            payload = decode_token(token)
            if payload.get("role") != "admin":
                return jsonify({"error": "Only admins can create accounts"}), 403
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
    else:
        # Allow only if no admin exists yet (first-boot bootstrap)
        if User.query.filter_by(role="admin").count() > 0:
            return jsonify({"error": "Authentication required to create accounts"}), 401

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        user_id       = user_id or _next_user_id(),
        email         = email,
        password_hash = generate_password_hash(password),
        role          = role,
        name          = name,
        linked_id     = linked_id,
    )
    db.session.add(user)
    db.session.commit()

    token = make_token(user)
    return jsonify({
        "access_token": token,
        "token_type":   "Bearer",
        "role":         user.role,
        "user_id":      user.user_id,
        "name":         user.name,
        "linked_id":    user.linked_id,
    }), 201


@auth_bp.get("/me")
def me():
    """GET /auth/me — return profile from token."""
    token = get_bearer()
    if not token:
        return jsonify({"error": "Missing token"}), 401
    try:
        payload = decode_token(token)
        user = User.query.get(payload["db_id"])
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify(user.to_dict())
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except Exception:
        return jsonify({"error": "Invalid token"}), 401


@auth_bp.get("/users")
def list_users():
    """GET /auth/users — admin only."""
    _, err = _require_admin()
    if err:
        return err
    users = User.query.order_by(User.id).all()
    return jsonify([u.to_dict() for u in users])


@auth_bp.put("/users/<int:user_pk>")
def update_user(user_pk):
    """PUT /auth/users/:pk — admin only. Update role, name, linked_id, active."""
    _, err = _require_admin()
    if err:
        return err

    user = User.query.get_or_404(user_pk)
    data = request.get_json(force=True) or {}
    if "name" in data:
        user.name = data["name"]
    if "role" in data and data["role"] in VALID_ROLES:
        user.role = data["role"]
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if "linked_id" in data:
        user.linked_id = data["linked_id"]

    db.session.commit()
    return jsonify(user.to_dict())


@auth_bp.delete("/users/<int:user_pk>")
def delete_user(user_pk):
    """DELETE /auth/users/:pk — admin only."""
    _, err = _require_admin()
    if err:
        return err
    user = User.query.get_or_404(user_pk)
    user.is_active = False   # soft-delete
    db.session.commit()
    return jsonify({"deleted": True, "user_id": user.user_id})


@auth_bp.post("/verify")
def verify():
    """
    POST /auth/verify — internal endpoint called by api-gateway.
    Body: { "token": "..." }
    Returns decoded payload or 401.
    """
    data  = request.get_json(force=True) or {}
    token = data.get("token")
    if not token:
        return jsonify({"error": "token required"}), 400
    try:
        payload = decode_token(token)
        return jsonify({"valid": True, "payload": payload})
    except jwt.ExpiredSignatureError:
        return jsonify({"valid": False, "error": "Token expired"}), 401
    except Exception:
        return jsonify({"valid": False, "error": "Invalid token"}), 401
