"""
Auth Service — AcademiQ
Handles: user registration, login (JWT), role management.
Roles: student | teacher | admin | worker
"""

import os
from flask import Flask
from flask_cors import CORS
from models import db
from routes.auth import auth_bp


def create_app():
    app = Flask(__name__)
    CORS(app)

    # ── Database ──────────────────────────────────────────────
    pg_user = os.getenv("POSTGRES_USER", "academiq")
    pg_pass = os.getenv("POSTGRES_PASSWORD", "academiq_pass")
    pg_host = os.getenv("POSTGRES_HOST", "postgres")
    pg_port = os.getenv("POSTGRES_PORT", "5432")
    pg_db   = os.getenv("POSTGRES_DB", "academiq")

    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"postgresql://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET"]       = os.getenv("JWT_SECRET", "changeme")
    app.config["JWT_ALGORITHM"]    = os.getenv("JWT_ALGORITHM", "HS256")
    app.config["JWT_EXPIRY_HOURS"] = int(os.getenv("JWT_EXPIRY_HOURS", 24))

    db.init_app(app)

    # ── Routes ────────────────────────────────────────────────
    app.register_blueprint(auth_bp, url_prefix="/auth")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "auth-service", "roles": ["student", "teacher", "admin", "worker"]}

    # Create tables + seed demo accounts on first run
    with app.app_context():
        db.create_all()
        _seed_demo_users()

    return app


def _seed_demo_users():
    """
    Seed one demo account per role on first boot.
    Credentials are printed to the container log.
    """
    from models import User, VALID_ROLES
    from werkzeug.security import generate_password_hash

    demos = [
        {
            "user_id":   "U001",
            "email":     "admin@academiq.edu",
            "password":  "admin123",
            "role":      "admin",
            "name":      "System Administrator",
            "linked_id": None,
        },
        {
            "user_id":   "U002",
            "email":     "meena.iyer@faculty.academiq.edu",
            "password":  "teacher123",
            "role":      "teacher",
            "name":      "Dr. Meena Iyer",
            "linked_id": "FAC001",
        },
        {
            "user_id":   "U003",
            "email":     "ravi.shankar@faculty.academiq.edu",
            "password":  "teacher123",
            "role":      "teacher",
            "name":      "Prof. Ravi Shankar",
            "linked_id": "FAC002",
        },
        {
            "user_id":   "U004",
            "email":     "aarav.stu001@student.academiq.edu",
            "password":  "student123",
            "role":      "student",
            "name":      "Aarav Sharma",
            "linked_id": "STU001",
        },
        {
            "user_id":   "U005",
            "email":     "worker@academiq.edu",
            "password":  "worker123",
            "role":      "worker",
            "name":      "Demo Document Worker",
            "linked_id": None,
        },
        {
            "user_id":   "U006",
            "email":     "teacher@academiq.edu",
            "password":  "teacher123",
            "role":      "teacher",
            "name":      "Dr. Meena Iyer",
            "linked_id": "FAC001",
        },
        {
            "user_id":   "U007",
            "email":     "student@academiq.edu",
            "password":  "student123",
            "role":      "student",
            "name":      "Aarav Sharma",
            "linked_id": "STU001",
        },
    ]


    created = []
    for d in demos:
        if not User.query.filter_by(email=d["email"]).first():
            user = User(
                user_id=d["user_id"],
                email=d["email"],
                password_hash=generate_password_hash(d["password"]),
                role=d["role"],
                name=d["name"],
                linked_id=d["linked_id"],
            )
            db.session.add(user)
            created.append(f"  {d['role']:8s}  {d['email']:35s}  {d['password']}")

    if created:
        db.session.commit()
        print("[auth-service] Seeded demo accounts:")
        for line in created:
            print(line)


if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8001))
    app = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
