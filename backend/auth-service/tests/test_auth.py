"""
Unit tests for Auth Service:
- Login authentication, credential checks, JWT issuance (AUTH-01, AUTH-02)
- Token verification and session info (AUTH-03)
- User CRUD and Admin authorization enforcement (AUTH-05)
"""

import os
import sys
import pytest
import jwt
from werkzeug.security import generate_password_hash

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from flask import Flask
from models import db, User
from routes.auth import auth_bp, make_token


@pytest.fixture
def app():
    test_app = Flask(__name__)
    test_app.config["TESTING"] = True
    test_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    test_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    test_app.config["JWT_SECRET"] = "test-secret-key-12345"
    test_app.config["JWT_ALGORITHM"] = "HS256"
    test_app.config["JWT_EXPIRY_HOURS"] = 24

    db.init_app(test_app)
    test_app.register_blueprint(auth_bp, url_prefix="/auth")

    with test_app.app_context():
        db.create_all()

        # Seed test users
        admin = User(
            user_id="U001",
            email="admin@academiq.edu",
            password_hash=generate_password_hash("admin123"),
            role="admin",
            name="System Admin",
            linked_id=None,
        )
        teacher = User(
            user_id="U002",
            email="meena.iyer@faculty.academiq.edu",
            password_hash=generate_password_hash("teacher123"),
            role="teacher",
            name="Dr. Meena Iyer",
            linked_id="FAC001",
        )
        student = User(
            user_id="U003",
            email="aarav.stu001@student.academiq.edu",
            password_hash=generate_password_hash("student123"),
            role="student",
            name="Aarav Sharma",
            linked_id="STU001",
        )
        worker = User(
            user_id="U004",
            email="worker@academiq.edu",
            password_hash=generate_password_hash("worker123"),
            role="worker",
            name="Data Entry Worker",
            linked_id=None,
        )
        db.session.add_all([admin, teacher, student, worker])
        db.session.commit()

        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def test_login_success(client):
    """Login with valid email and password returns JWT with role and redirect."""
    res = client.post("/auth/login", json={
        "email": "admin@academiq.edu",
        "password": "admin123"
    })
    assert res.status_code == 200
    data = res.json
    assert "access_token" in data
    assert data["role"] == "admin"
    assert data["user_id"] == "U001"
    assert data["redirect"] == "/dashboard"


def test_login_demo_aliases(client):
    """Common demo aliases resolve correctly."""
    res = client.post("/auth/login", json={
        "email": "teacher@academiq.edu",
        "password": "teacher123"
    })
    assert res.status_code == 200
    assert res.json["role"] == "teacher"
    assert res.json["linked_id"] == "FAC001"


def test_login_invalid_password(client):
    """Invalid password returns 401."""
    res = client.post("/auth/login", json={
        "email": "admin@academiq.edu",
        "password": "wrongpassword"
    })
    assert res.status_code == 401
    assert "Invalid credentials" in res.json["error"]


def test_me_token_verification(client, app):
    """Protected /auth/me returns decoded payload for valid token."""
    with app.app_context():
        user = User.query.filter_by(user_id="U002").first()
        token = make_token(user)

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json
    assert data["user_id"] == "U002"
    assert data["role"] == "teacher"
    assert data["linked_id"] == "FAC001"


def test_users_admin_guard(client, app):
    """Listing users requires admin token; teacher token gets 403."""
    with app.app_context():
        admin = User.query.filter_by(role="admin").first()
        admin_token = make_token(admin)
        teacher = User.query.filter_by(role="teacher").first()
        teacher_token = make_token(teacher)

    # Teacher attempt
    res_t = client.get("/auth/users", headers={"Authorization": f"Bearer {teacher_token}"})
    assert res_t.status_code == 403

    # Admin attempt
    res_a = client.get("/auth/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_a.status_code == 200
    assert len(res_a.json) == 4


def test_create_and_delete_user_admin(client, app):
    """Admin can register and delete a user."""
    with app.app_context():
        admin = User.query.filter_by(role="admin").first()
        admin_token = make_token(admin)

    # Register new user (requires admin token)
    new_user_data = {
        "email": "new.teacher@academiq.edu",
        "password": "password123",
        "role": "teacher",
        "name": "New Faculty Member",
        "linked_id": "FAC005",
    }
    res_c = client.post("/auth/register", json=new_user_data, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_c.status_code == 201
    user_id = res_c.json["user_id"]

    with app.app_context():
        u = User.query.filter_by(user_id=user_id).first()
        u_pk = u.id

    # Delete user
    res_d = client.delete(f"/auth/users/{u_pk}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_d.status_code == 200
    assert res_d.json["deleted"] is True
