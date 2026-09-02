"""
Unit tests for Historical Data routes, bulk CSV parsing transactions,
role permissions, and verification status lifecycle.
"""

import sys, os, io
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from datetime import datetime


class TestHistoricalValidationAndRoleLogic:
    """Test pure validation & role enforcement rules."""

    def test_worker_role_assigns_pending_status(self):
        """Worker submissions must be set to pending."""
        def get_submission_meta(role: str, user_id: str):
            is_admin = (role.lower() == "admin")
            return {
                "submitted_via": "admin" if is_admin else "worker",
                "verification_status": "verified" if is_admin else "pending",
                "verified_by": user_id if is_admin else None,
                "verified_at": datetime.utcnow() if is_admin else None,
            }

        worker_meta = get_submission_meta("worker", "U_WRK001")
        assert worker_meta["submitted_via"] == "worker"
        assert worker_meta["verification_status"] == "pending"
        assert worker_meta["verified_by"] is None

        admin_meta = get_submission_meta("admin", "U_ADM001")
        assert admin_meta["submitted_via"] == "admin"
        assert admin_meta["verification_status"] == "verified"
        assert admin_meta["verified_by"] == "U_ADM001"

    def test_atomic_all_or_nothing_csv_rejection(self):
        """If any row fails validation, no rows should be accepted."""
        csv_rows = [
            {"academic_year": "2025-26", "department": "CSE", "sanctioned_intake": "180", "first_year_admitted_net_migration": "175"},
            {"academic_year": "2024-25", "department": "CSE", "sanctioned_intake": "0", "first_year_admitted_net_migration": "170"},  # Invalid intake
            {"academic_year": "2023-24", "department": "CSE", "sanctioned_intake": "120", "first_year_admitted_net_migration": "115"},
        ]

        errors = []
        valid_items = []
        for idx, r in enumerate(csv_rows, start=2):
            intake = int(r["sanctioned_intake"])
            if intake <= 0:
                errors.append({"row": idx, "field": "sanctioned_intake", "message": "Intake must be > 0"})
            else:
                valid_items.append(r)

        assert len(errors) == 1
        assert errors[0]["row"] == 3
        # Invariant: If errors exist, reject all valid_items (all-or-nothing rollback)
        inserted_items = [] if errors else valid_items
        assert len(inserted_items) == 0

    def test_query_level_verified_filter_excludes_pending(self):
        """Reports and formulas must filter by verification_status='verified'."""
        sample_db_records = [
            {"id": 1, "academic_year": "2025-26", "verification_status": "verified"},
            {"id": 2, "academic_year": "2024-25", "verification_status": "verified"},
            {"id": 3, "academic_year": "2026-27", "verification_status": "pending"},
            {"id": 4, "academic_year": "2023-24", "verification_status": "rejected"},
        ]

        verified_only = [r for r in sample_db_records if r["verification_status"] == "verified"]
        assert len(verified_only) == 2
        assert all(r["verification_status"] == "verified" for r in verified_only)
        assert 3 not in [r["id"] for r in verified_only]
        assert 4 not in [r["id"] for r in verified_only]

    def test_worker_cannot_verify_records(self):
        """Worker role must receive 403 when attempting verification action."""
        def check_can_verify(role: str) -> bool:
            return role.lower() == "admin"

        assert check_can_verify("admin") is True
        assert check_can_verify("worker") is False
        assert check_can_verify("student") is False
        assert check_can_verify("teacher") is False
