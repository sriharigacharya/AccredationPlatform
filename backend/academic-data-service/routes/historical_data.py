"""
Routes for Historical Data Upload & Verification Workflow:
  - Admission Details (Criterion 4.1)
  - Batch Progression & Success Rate (Criterion 4.2)
  - Academic Performance Index (Criterion 4.3 / 4.4)

Role Rules:
  - Worker: Upload/submit only -> verification_status="pending". Cannot verify.
  - Admin: Upload/submit -> auto-verified ("verified"). Can verify/reject/edit worker records.
  - Faculty: Read-only.

All-or-Nothing Bulk Import:
  - Validates row-by-row before committing.
  - Any validation failure rejects the whole file with row-level error breakdown.
"""

import io
import csv
import re
from datetime import datetime
from flask import Blueprint, request, jsonify, Response
from models import db, Department
from historical_models import (
    AdmissionRecord, AcademicBatch, BatchYearProgress, AcademicPerformanceRecord,
    VALID_VERIFICATION_STATUSES, VALID_YEARS_OF_STUDY,
)

historical_data_bp = Blueprint("historical_data", __name__)


def _get_user_context():
    """Extract user context from gateway-injected headers."""
    return {
        "user_id":   request.headers.get("X-User-Id", "anonymous"),
        "role":      (request.headers.get("X-User-Role", "")).lower(),
        "linked_id": request.headers.get("X-Linked-Id", ""),
        "name":      request.headers.get("X-User-Name", ""),
    }


def _parse_csv_file(file_storage):
    """
    Parse uploaded CSV file into list of dicts.
    Handles UTF-8, UTF-8-BOM, and basic comma/semicolon delimited formats.
    """
    content = file_storage.read()
    if isinstance(content, bytes):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
    else:
        text = str(content)

    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for r in reader:
        # Strip whitespace from keys and values
        clean_r = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in r.items() if k}
        if any(clean_r.values()):
            rows.append(clean_r)
    return rows


def _validate_academic_year(yr: str) -> bool:
    """Validate academic year format like 2025-26 or 2025."""
    if not yr:
        return False
    yr = yr.strip()
    return bool(re.match(r"^\d{4}(-\d{2,4})?$", yr))


# ─────────────────────────────────────────────────────────────────────────────
# 1. Admission Records (Criterion 4.1 Enrolment Ratio)
# ─────────────────────────────────────────────────────────────────────────────

@historical_data_bp.get("/admission-records/template.csv")
def download_admission_template():
    """Download standard CSV template for Admission Records."""
    output = "academic_year,department,sanctioned_intake,first_year_admitted_net_migration,lateral_entry_admitted,separate_division_admitted\n"
    output += "2025-26,CSE,180,175,18,0\n"
    output += "2024-25,CSE,180,172,18,0\n"
    output += "2023-24,CSE,120,118,12,0\n"
    output += "2022-23,CSE,120,115,12,0\n"
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=admission_records_template.csv"},
    )


@historical_data_bp.post("/admission-records/bulk-import")
def bulk_import_admission_records():
    """
    POST /admission-records/bulk-import (multipart/form-data with file)
    Atomic all-or-nothing row-by-row validation.
    """
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "worker"):
        return jsonify({"error": "Only Admin or Data Worker can import admission records"}), 403

    if "file" not in request.files:
        return jsonify({"error": "CSV/Excel file is required"}), 400

    file_obj = request.files["file"]
    if not file_obj.filename:
        return jsonify({"error": "No file selected"}), 400

    try:
        rows = _parse_csv_file(file_obj)
    except Exception as e:
        return jsonify({"error": f"Failed to parse CSV file: {str(e)}"}), 400

    if not rows:
        return jsonify({"error": "The uploaded file contains no data rows"}), 400

    errors = []
    valid_records = []
    is_admin = (ctx["role"] == "admin")

    for idx, r in enumerate(rows, start=2):  # row 1 is header
        yr = r.get("academic_year", "")
        dept = r.get("department", "").upper()
        intake_str = r.get("sanctioned_intake", "")
        n1_str = r.get("first_year_admitted_net_migration", "")
        n2_str = r.get("lateral_entry_admitted", "0")
        n3_str = r.get("separate_division_admitted", "0")

        # Validation
        if not _validate_academic_year(yr):
            errors.append({"row": idx, "field": "academic_year", "message": f"Invalid academic year format '{yr}'. Expected YYYY-YY (e.g. 2025-26)."})
        if not dept:
            errors.append({"row": idx, "field": "department", "message": "Department is required."})

        intake = n1 = n2 = n3 = 0
        try:
            intake = int(intake_str)
            if intake <= 0:
                errors.append({"row": idx, "field": "sanctioned_intake", "message": "Sanctioned intake must be greater than 0."})
        except ValueError:
            errors.append({"row": idx, "field": "sanctioned_intake", "message": f"Invalid integer for sanctioned intake '{intake_str}'."})

        try:
            n1 = int(n1_str)
            if n1 < 0:
                errors.append({"row": idx, "field": "first_year_admitted_net_migration", "message": "First year admitted cannot be negative."})
        except ValueError:
            errors.append({"row": idx, "field": "first_year_admitted_net_migration", "message": f"Invalid integer '{n1_str}'."})

        try:
            n2 = int(n2_str) if n2_str else 0
            if n2 < 0:
                errors.append({"row": idx, "field": "lateral_entry_admitted", "message": "Lateral entry cannot be negative."})
        except ValueError:
            errors.append({"row": idx, "field": "lateral_entry_admitted", "message": f"Invalid integer '{n2_str}'."})

        try:
            n3 = int(n3_str) if n3_str else 0
            if n3 < 0:
                errors.append({"row": idx, "field": "separate_division_admitted", "message": "Separate division admitted cannot be negative."})
        except ValueError:
            errors.append({"row": idx, "field": "separate_division_admitted", "message": f"Invalid integer '{n3_str}'."})

        if not any(e["row"] == idx for e in errors):
            total = n1 + n2 + n3
            valid_records.append(AdmissionRecord(
                academic_year=yr,
                department=dept,
                sanctioned_intake=intake,
                first_year_admitted_net_migration=n1,
                lateral_entry_admitted=n2,
                separate_division_admitted=n3,
                total_admitted=total,
                uploaded_by=ctx["user_id"],
                submitted_via="admin" if is_admin else "worker",
                verification_status="verified" if is_admin else "pending",
                verified_by=ctx["user_id"] if is_admin else None,
                verified_at=datetime.utcnow() if is_admin else None,
            ))

    # All-or-nothing rejection
    if errors:
        return jsonify({
            "error": "Validation failed on uploaded file. No records were committed.",
            "total_rows": len(rows),
            "error_count": len(errors),
            "errors": errors,
        }), 400

    # Commit all valid records
    db.session.add_all(valid_records)
    db.session.commit()

    return jsonify({
        "message": f"Successfully imported {len(valid_records)} admission records.",
        "imported_count": len(valid_records),
        "status": "verified" if is_admin else "pending",
    }), 201


@historical_data_bp.post("/admission-records")
def create_admission_record():
    """Manual single-record admission entry."""
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "worker"):
        return jsonify({"error": "Only Admin or Data Worker can enter admission records"}), 403

    data = request.get_json(force=True) or {}
    yr   = data.get("academic_year", "").strip()
    dept = data.get("department", "").strip().upper()

    if not _validate_academic_year(yr):
        return jsonify({"error": "Invalid academic_year format (expected e.g. 2025-26)"}), 400
    if not dept:
        return jsonify({"error": "department is required"}), 400

    try:
        intake = int(data.get("sanctioned_intake", 0))
        n1     = int(data.get("first_year_admitted_net_migration", 0))
        n2     = int(data.get("lateral_entry_admitted", 0))
        n3     = int(data.get("separate_division_admitted", 0))
        if intake <= 0 or n1 < 0 or n2 < 0 or n3 < 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Numerical intake and admitted counts must be positive integers"}), 400

    is_admin = (ctx["role"] == "admin")
    total = n1 + n2 + n3
    rec = AdmissionRecord(
        academic_year=yr,
        department=dept,
        sanctioned_intake=intake,
        first_year_admitted_net_migration=n1,
        lateral_entry_admitted=n2,
        separate_division_admitted=n3,
        total_admitted=total,
        uploaded_by=ctx["user_id"],
        submitted_via="admin" if is_admin else "worker",
        verification_status="verified" if is_admin else "pending",
        verified_by=ctx["user_id"] if is_admin else None,
        verified_at=datetime.utcnow() if is_admin else None,
    )
    db.session.add(rec)
    db.session.commit()
    return jsonify({"message": "Admission record created", "record": rec.to_dict()}), 201


@historical_data_bp.get("/admission-records")
def list_admission_records():
    """List admission records with optional filters."""
    query = AdmissionRecord.query

    status = request.args.get("status")
    if status and status in VALID_VERIFICATION_STATUSES:
        query = query.filter_by(verification_status=status)

    dept = request.args.get("department")
    if dept:
        query = query.filter_by(department=dept.upper())

    yr = request.args.get("academic_year")
    if yr:
        query = query.filter_by(academic_year=yr)

    records = query.order_by(AdmissionRecord.academic_year.desc(), AdmissionRecord.created_at.desc()).all()
    return jsonify([r.to_dict() for r in records])


@historical_data_bp.patch("/admission-records/<int:rec_id>/verify")
def verify_admission_record(rec_id):
    """Admin verifies a pending admission record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to verify records"}), 403

    rec = AdmissionRecord.query.get_or_404(rec_id)
    rec.verification_status = "verified"
    rec.verified_by = ctx["user_id"]
    rec.verified_at = datetime.utcnow()
    rec.rejection_reason = None
    db.session.commit()
    return jsonify({"message": "Record verified", "record": rec.to_dict()})


@historical_data_bp.patch("/admission-records/<int:rec_id>/reject")
def reject_admission_record(rec_id):
    """Admin rejects an admission record with reason."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to reject records"}), 403

    data   = request.get_json(force=True) or {}
    reason = data.get("rejection_reason", "").strip()
    if not reason:
        return jsonify({"error": "rejection_reason is required"}), 400

    rec = AdmissionRecord.query.get_or_404(rec_id)
    rec.verification_status = "rejected"
    rec.verified_by = ctx["user_id"]
    rec.verified_at = datetime.utcnow()
    rec.rejection_reason = reason
    db.session.commit()
    return jsonify({"message": "Record rejected", "record": rec.to_dict()})


@historical_data_bp.patch("/admission-records/<int:rec_id>")
def update_admission_record(rec_id):
    """Admin inline edit for admission record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to edit records"}), 403

    rec  = AdmissionRecord.query.get_or_404(rec_id)
    data = request.get_json(force=True) or {}

    for f in ("academic_year", "department"):
        if f in data:
            setattr(rec, f, data[f])

    for f in ("sanctioned_intake", "first_year_admitted_net_migration", "lateral_entry_admitted", "separate_division_admitted"):
        if f in data:
            setattr(rec, f, int(data[f]))

    rec.total_admitted = (
        rec.first_year_admitted_net_migration +
        rec.lateral_entry_admitted +
        rec.separate_division_admitted
    )
    db.session.commit()
    return jsonify({"message": "Record updated", "record": rec.to_dict()})


@historical_data_bp.delete("/admission-records/<int:rec_id>")
def delete_admission_record(rec_id):
    """Admin deletes an admission record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to delete records"}), 403

    rec = AdmissionRecord.query.get_or_404(rec_id)
    db.session.delete(rec)
    db.session.commit()
    return jsonify({"message": "Record deleted", "id": rec_id})


# ─────────────────────────────────────────────────────────────────────────────
# 2. Batch Progression & Success Rate (Criterion 4.2)
# ─────────────────────────────────────────────────────────────────────────────

@historical_data_bp.get("/batch-progress/template.csv")
def download_batch_progress_template():
    """Download standard CSV template for Batch Progression."""
    output = "year_of_entry,department,total_admitted,year_of_study,students_without_backlog,students_total_passed\n"
    output += "2021-22,CSE,190,I,160,185\n"
    output += "2021-22,CSE,190,II,155,182\n"
    output += "2021-22,CSE,190,III,150,180\n"
    output += "2021-22,CSE,190,IV,148,178\n"
    output += "2020-21,CSE,190,I,158,184\n"
    output += "2020-21,CSE,190,II,152,180\n"
    output += "2020-21,CSE,190,III,149,178\n"
    output += "2020-21,CSE,190,IV,146,176\n"
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=batch_progress_template.csv"},
    )


@historical_data_bp.post("/batch-progress/bulk-import")
def bulk_import_batch_progress():
    """
    POST /batch-progress/bulk-import (multipart/form-data with file)
    Atomic all-or-nothing batch progression import.
    """
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "worker"):
        return jsonify({"error": "Only Admin or Data Worker can import batch progression data"}), 403

    if "file" not in request.files:
        return jsonify({"error": "CSV/Excel file is required"}), 400

    file_obj = request.files["file"]
    if not file_obj.filename:
        return jsonify({"error": "No file selected"}), 400

    try:
        rows = _parse_csv_file(file_obj)
    except Exception as e:
        return jsonify({"error": f"Failed to parse CSV: {str(e)}"}), 400

    if not rows:
        return jsonify({"error": "The uploaded file contains no data rows"}), 400

    errors = []
    is_admin = (ctx["role"] == "admin")

    # Step 1: Validate all rows
    validated_rows = []
    for idx, r in enumerate(rows, start=2):
        yr_entry = r.get("year_of_entry", "").strip()
        dept     = r.get("department", "").strip().upper()
        tot_str  = r.get("total_admitted", "").strip()
        study_yr = r.get("year_of_study", "").strip().upper()
        noback_s = r.get("students_without_backlog", "").strip()
        passed_s = r.get("students_total_passed", "").strip()

        if not _validate_academic_year(yr_entry):
            errors.append({"row": idx, "field": "year_of_entry", "message": f"Invalid year of entry '{yr_entry}'."})
        if not dept:
            errors.append({"row": idx, "field": "department", "message": "Department is required."})
        if study_yr not in VALID_YEARS_OF_STUDY:
            errors.append({"row": idx, "field": "year_of_study", "message": f"year_of_study must be one of {list(VALID_YEARS_OF_STUDY)} (got '{study_yr}')."})

        total_adm = noback = passed = 0
        try:
            total_adm = int(tot_str)
            if total_adm <= 0:
                errors.append({"row": idx, "field": "total_admitted", "message": "total_admitted must be > 0."})
        except ValueError:
            errors.append({"row": idx, "field": "total_admitted", "message": f"Invalid total_admitted '{tot_str}'."})

        try:
            noback = int(noback_s)
            if noback < 0:
                errors.append({"row": idx, "field": "students_without_backlog", "message": "students_without_backlog cannot be negative."})
        except ValueError:
            errors.append({"row": idx, "field": "students_without_backlog", "message": f"Invalid integer '{noback_s}'."})

        try:
            passed = int(passed_s)
            if passed < 0:
                errors.append({"row": idx, "field": "students_total_passed", "message": "students_total_passed cannot be negative."})
        except ValueError:
            errors.append({"row": idx, "field": "students_total_passed", "message": f"Invalid integer '{passed_s}'."})

        if noback > passed and passed > 0:
            errors.append({"row": idx, "field": "students_without_backlog", "message": "students_without_backlog cannot exceed students_total_passed."})
        if passed > total_adm and total_adm > 0:
            errors.append({"row": idx, "field": "students_total_passed", "message": "students_total_passed cannot exceed total_admitted."})

        if not any(e["row"] == idx for e in errors):
            validated_rows.append({
                "year_of_entry": yr_entry,
                "department": dept,
                "total_admitted": total_adm,
                "year_of_study": study_yr,
                "students_without_backlog": noback,
                "students_total_passed": passed,
            })

    if errors:
        return jsonify({
            "error": "Validation failed on uploaded file. No records were committed.",
            "total_rows": len(rows),
            "error_count": len(errors),
            "errors": errors,
        }), 400

    # Step 2: Ensure batches exist and insert progress records
    progress_entities = []
    for item in validated_rows:
        batch = AcademicBatch.query.filter_by(
            year_of_entry=item["year_of_entry"],
            department=item["department"],
        ).first()

        if not batch:
            batch = AcademicBatch(
                year_of_entry=item["year_of_entry"],
                department=item["department"],
                total_admitted=item["total_admitted"],
            )
            db.session.add(batch)
            db.session.flush()
        else:
            if item["total_admitted"] > 0:
                batch.total_admitted = item["total_admitted"]

        prog = BatchYearProgress(
            batch_id=batch.id,
            year_of_study=item["year_of_study"],
            students_without_backlog=item["students_without_backlog"],
            students_total_passed=item["students_total_passed"],
            uploaded_by=ctx["user_id"],
            submitted_via="admin" if is_admin else "worker",
            verification_status="verified" if is_admin else "pending",
            verified_by=ctx["user_id"] if is_admin else None,
            verified_at=datetime.utcnow() if is_admin else None,
        )
        progress_entities.append(prog)

    db.session.add_all(progress_entities)
    db.session.commit()

    return jsonify({
        "message": f"Successfully imported {len(progress_entities)} batch progression records.",
        "imported_count": len(progress_entities),
        "status": "verified" if is_admin else "pending",
    }), 201


@historical_data_bp.post("/batch-progress")
def create_batch_progress_record():
    """Manual single progression entry."""
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "worker"):
        return jsonify({"error": "Only Admin or Data Worker can enter batch progression records"}), 403

    data     = request.get_json(force=True) or {}
    yr_entry = data.get("year_of_entry", "").strip()
    dept     = data.get("department", "").strip().upper()
    study_yr = data.get("year_of_study", "").strip().upper()

    if not _validate_academic_year(yr_entry):
        return jsonify({"error": "Invalid year_of_entry"}), 400
    if not dept:
        return jsonify({"error": "department is required"}), 400
    if study_yr not in VALID_YEARS_OF_STUDY:
        return jsonify({"error": f"year_of_study must be one of {list(VALID_YEARS_OF_STUDY)}"}), 400

    try:
        total_adm = int(data.get("total_admitted", 0))
        noback    = int(data.get("students_without_backlog", 0))
        passed    = int(data.get("students_total_passed", 0))
        if total_adm <= 0 or noback < 0 or passed < 0 or passed > total_adm or noback > passed:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid student count numbers"}), 400

    batch = AcademicBatch.query.filter_by(year_of_entry=yr_entry, department=dept).first()
    if not batch:
        batch = AcademicBatch(year_of_entry=yr_entry, department=dept, total_admitted=total_adm)
        db.session.add(batch)
        db.session.flush()

    is_admin = (ctx["role"] == "admin")
    prog = BatchYearProgress(
        batch_id=batch.id,
        year_of_study=study_yr,
        students_without_backlog=noback,
        students_total_passed=passed,
        uploaded_by=ctx["user_id"],
        submitted_via="admin" if is_admin else "worker",
        verification_status="verified" if is_admin else "pending",
        verified_by=ctx["user_id"] if is_admin else None,
        verified_at=datetime.utcnow() if is_admin else None,
    )
    db.session.add(prog)
    db.session.commit()
    return jsonify({"message": "Batch progress record created", "record": prog.to_dict()}), 201


@historical_data_bp.get("/batch-progress")
def list_batch_progress():
    """List batch progression records with filters."""
    query = BatchYearProgress.query.join(AcademicBatch)

    status = request.args.get("status")
    if status and status in VALID_VERIFICATION_STATUSES:
        query = query.filter(BatchYearProgress.verification_status == status)

    dept = request.args.get("department")
    if dept:
        query = query.filter(AcademicBatch.department == dept.upper())

    yr = request.args.get("year_of_entry")
    if yr:
        query = query.filter(AcademicBatch.year_of_entry == yr)

    records = query.order_by(AcademicBatch.year_of_entry.desc(), BatchYearProgress.year_of_study.asc()).all()
    return jsonify([r.to_dict() for r in records])


@historical_data_bp.get("/batch-progress/summary")
def get_batch_progress_summary():
    """
    Returns summarized Table 4.2 data per batch cohort.
    Only includes verified records if status=verified requested.
    """
    dept = request.args.get("department", "CSE").upper()
    status_filter = request.args.get("status", "verified")

    batches = AcademicBatch.query.filter_by(department=dept).order_by(AcademicBatch.year_of_entry.desc()).all()
    summary = []
    for b in batches:
        q = BatchYearProgress.query.filter_by(batch_id=b.id)
        if status_filter:
            q = q.filter_by(verification_status=status_filter)
        progs = {p.year_of_study: p for p in q.all()}

        # Success rate for final year (IV)
        sr_without_backlog = 0.0
        sr_total_passed    = 0.0
        if "IV" in progs and b.total_admitted > 0:
            sr_without_backlog = round((progs["IV"].students_without_backlog / b.total_admitted) * 100, 2)
            sr_total_passed    = round((progs["IV"].students_total_passed / b.total_admitted) * 100, 2)

        summary.append({
            "batch_id": b.id,
            "year_of_entry": b.year_of_entry,
            "department": b.department,
            "total_admitted": b.total_admitted,
            "year_I": progs.get("I").to_dict() if "I" in progs else None,
            "year_II": progs.get("II").to_dict() if "II" in progs else None,
            "year_III": progs.get("III").to_dict() if "III" in progs else None,
            "year_IV": progs.get("IV").to_dict() if "IV" in progs else None,
            "success_rate_without_backlog_pct": sr_without_backlog,
            "success_rate_total_passed_pct": sr_total_passed,
        })
    return jsonify(summary)


@historical_data_bp.patch("/batch-progress/<int:prog_id>/verify")
def verify_batch_progress(prog_id):
    """Admin verifies batch progress record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to verify records"}), 403

    rec = BatchYearProgress.query.get_or_404(prog_id)
    rec.verification_status = "verified"
    rec.verified_by = ctx["user_id"]
    rec.verified_at = datetime.utcnow()
    rec.rejection_reason = None
    db.session.commit()
    return jsonify({"message": "Record verified", "record": rec.to_dict()})


@historical_data_bp.patch("/batch-progress/<int:prog_id>/reject")
def reject_batch_progress(prog_id):
    """Admin rejects batch progress record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to reject records"}), 403

    data   = request.get_json(force=True) or {}
    reason = data.get("rejection_reason", "").strip()
    if not reason:
        return jsonify({"error": "rejection_reason is required"}), 400

    rec = BatchYearProgress.query.get_or_404(prog_id)
    rec.verification_status = "rejected"
    rec.verified_by = ctx["user_id"]
    rec.verified_at = datetime.utcnow()
    rec.rejection_reason = reason
    db.session.commit()
    return jsonify({"message": "Record rejected", "record": rec.to_dict()})


@historical_data_bp.patch("/batch-progress/<int:prog_id>")
def update_batch_progress(prog_id):
    """Admin inline edit for batch progress."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to edit records"}), 403

    rec  = BatchYearProgress.query.get_or_404(prog_id)
    data = request.get_json(force=True) or {}

    if "students_without_backlog" in data:
        rec.students_without_backlog = int(data["students_without_backlog"])
    if "students_total_passed" in data:
        rec.students_total_passed = int(data["students_total_passed"])
    if "year_of_study" in data and data["year_of_study"] in VALID_YEARS_OF_STUDY:
        rec.year_of_study = data["year_of_study"]

    db.session.commit()
    return jsonify({"message": "Record updated", "record": rec.to_dict()})


@historical_data_bp.delete("/batch-progress/<int:prog_id>")
def delete_batch_progress(prog_id):
    """Admin deletes batch progress record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to delete records"}), 403

    rec = BatchYearProgress.query.get_or_404(prog_id)
    db.session.delete(rec)
    db.session.commit()
    return jsonify({"message": "Record deleted", "id": prog_id})


# ─────────────────────────────────────────────────────────────────────────────
# 3. Academic Performance Records (Criterion 4.3 / 4.4 API)
# ─────────────────────────────────────────────────────────────────────────────

@historical_data_bp.get("/academic-performance/template.csv")
def download_academic_performance_template():
    """Download standard CSV template for Academic Performance (API)."""
    output = "academic_year,department,year_of_study,mean_cgpa_or_percentage,successful_students_count,appeared_students_count\n"
    output += "2024-25,CSE,II,7.85,180,185\n"
    output += "2024-25,CSE,III,8.12,176,180\n"
    output += "2023-24,CSE,II,7.62,174,180\n"
    output += "2023-24,CSE,III,7.95,170,175\n"
    output += "2022-23,CSE,II,7.50,115,120\n"
    output += "2022-23,CSE,III,7.80,112,118\n"
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=academic_performance_template.csv"},
    )


@historical_data_bp.post("/academic-performance/bulk-import")
def bulk_import_academic_performance():
    """
    POST /academic-performance/bulk-import (multipart/form-data with file)
    Atomic row validation for Academic Performance Index (API).
    """
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "worker"):
        return jsonify({"error": "Only Admin or Data Worker can import academic performance records"}), 403

    if "file" not in request.files:
        return jsonify({"error": "CSV/Excel file is required"}), 400

    file_obj = request.files["file"]
    if not file_obj.filename:
        return jsonify({"error": "No file selected"}), 400

    try:
        rows = _parse_csv_file(file_obj)
    except Exception as e:
        return jsonify({"error": f"Failed to parse CSV: {str(e)}"}), 400

    if not rows:
        return jsonify({"error": "The uploaded file contains no data rows"}), 400

    errors = []
    valid_records = []
    is_admin = (ctx["role"] == "admin")

    for idx, r in enumerate(rows, start=2):
        yr        = r.get("academic_year", "").strip()
        dept      = r.get("department", "").strip().upper()
        study_yr  = r.get("year_of_study", "").strip().upper()
        cgpa_str  = r.get("mean_cgpa_or_percentage", "").strip()
        succ_str  = r.get("successful_students_count", "").strip()
        app_str   = r.get("appeared_students_count", "").strip()

        if not _validate_academic_year(yr):
            errors.append({"row": idx, "field": "academic_year", "message": f"Invalid academic year '{yr}'."})
        if not dept:
            errors.append({"row": idx, "field": "department", "message": "Department is required."})
        if study_yr not in ("I", "II", "III", "IV"):
            errors.append({"row": idx, "field": "year_of_study", "message": f"Invalid year_of_study '{study_yr}'."})

        cgpa = succ = app_cnt = 0
        try:
            cgpa = float(cgpa_str)
            if cgpa < 0 or cgpa > 100:
                errors.append({"row": idx, "field": "mean_cgpa_or_percentage", "message": "CGPA/percentage must be between 0 and 100."})
        except ValueError:
            errors.append({"row": idx, "field": "mean_cgpa_or_percentage", "message": f"Invalid number '{cgpa_str}'."})

        try:
            succ = int(succ_str)
            if succ < 0:
                errors.append({"row": idx, "field": "successful_students_count", "message": "Cannot be negative."})
        except ValueError:
            errors.append({"row": idx, "field": "successful_students_count", "message": f"Invalid integer '{succ_str}'."})

        try:
            app_cnt = int(app_str)
            if app_cnt <= 0:
                errors.append({"row": idx, "field": "appeared_students_count", "message": "Appeared count must be > 0."})
        except ValueError:
            errors.append({"row": idx, "field": "appeared_students_count", "message": f"Invalid integer '{app_str}'."})

        if succ > app_cnt and app_cnt > 0:
            errors.append({"row": idx, "field": "successful_students_count", "message": "Successful count cannot exceed appeared count."})

        if not any(e["row"] == idx for e in errors):
            valid_records.append(AcademicPerformanceRecord(
                academic_year=yr,
                year_of_study=study_yr,
                department=dept,
                mean_cgpa_or_percentage=round(cgpa, 3),
                successful_students_count=succ,
                appeared_students_count=app_cnt,
                uploaded_by=ctx["user_id"],
                submitted_via="admin" if is_admin else "worker",
                verification_status="verified" if is_admin else "pending",
                verified_by=ctx["user_id"] if is_admin else None,
                verified_at=datetime.utcnow() if is_admin else None,
            ))

    if errors:
        return jsonify({
            "error": "Validation failed on uploaded file. No records were committed.",
            "total_rows": len(rows),
            "error_count": len(errors),
            "errors": errors,
        }), 400

    db.session.add_all(valid_records)
    db.session.commit()

    return jsonify({
        "message": f"Successfully imported {len(valid_records)} academic performance records.",
        "imported_count": len(valid_records),
        "status": "verified" if is_admin else "pending",
    }), 201


@historical_data_bp.post("/academic-performance")
def create_academic_performance_record():
    """Manual single API entry."""
    ctx = _get_user_context()
    if ctx["role"] not in ("admin", "worker"):
        return jsonify({"error": "Only Admin or Data Worker can enter academic performance records"}), 403

    data     = request.get_json(force=True) or {}
    yr       = data.get("academic_year", "").strip()
    dept     = data.get("department", "").strip().upper()
    study_yr = data.get("year_of_study", "").strip().upper()

    if not _validate_academic_year(yr):
        return jsonify({"error": "Invalid academic_year"}), 400
    if not dept:
        return jsonify({"error": "department is required"}), 400
    if study_yr not in ("I", "II", "III", "IV"):
        return jsonify({"error": "Invalid year_of_study"}), 400

    try:
        cgpa    = float(data.get("mean_cgpa_or_percentage", 0.0))
        succ    = int(data.get("successful_students_count", 0))
        app_cnt = int(data.get("appeared_students_count", 0))
        if cgpa < 0 or succ < 0 or app_cnt <= 0 or succ > app_cnt:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numerical values"}), 400

    is_admin = (ctx["role"] == "admin")
    rec = AcademicPerformanceRecord(
        academic_year=yr,
        year_of_study=study_yr,
        department=dept,
        mean_cgpa_or_percentage=round(cgpa, 3),
        successful_students_count=succ,
        appeared_students_count=app_cnt,
        uploaded_by=ctx["user_id"],
        submitted_via="admin" if is_admin else "worker",
        verification_status="verified" if is_admin else "pending",
        verified_by=ctx["user_id"] if is_admin else None,
        verified_at=datetime.utcnow() if is_admin else None,
    )
    db.session.add(rec)
    db.session.commit()
    return jsonify({"message": "Academic performance record created", "record": rec.to_dict()}), 201


@historical_data_bp.get("/academic-performance")
def list_academic_performance_records():
    """List academic performance records with filters."""
    query = AcademicPerformanceRecord.query

    status = request.args.get("status")
    if status and status in VALID_VERIFICATION_STATUSES:
        query = query.filter_by(verification_status=status)

    dept = request.args.get("department")
    if dept:
        query = query.filter_by(department=dept.upper())

    yr = request.args.get("academic_year")
    if yr:
        query = query.filter_by(academic_year=yr)

    study_yr = request.args.get("year_of_study")
    if study_yr:
        query = query.filter_by(year_of_study=study_yr.upper())

    records = query.order_by(AcademicPerformanceRecord.academic_year.desc(), AcademicPerformanceRecord.year_of_study.asc()).all()
    return jsonify([r.to_dict() for r in records])


@historical_data_bp.patch("/academic-performance/<int:rec_id>/verify")
def verify_academic_performance_record(rec_id):
    """Admin verifies academic performance record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to verify records"}), 403

    rec = AcademicPerformanceRecord.query.get_or_404(rec_id)
    rec.verification_status = "verified"
    rec.verified_by = ctx["user_id"]
    rec.verified_at = datetime.utcnow()
    rec.rejection_reason = None
    db.session.commit()
    return jsonify({"message": "Record verified", "record": rec.to_dict()})


@historical_data_bp.patch("/academic-performance/<int:rec_id>/reject")
def reject_academic_performance_record(rec_id):
    """Admin rejects academic performance record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to reject records"}), 403

    data   = request.get_json(force=True) or {}
    reason = data.get("rejection_reason", "").strip()
    if not reason:
        return jsonify({"error": "rejection_reason is required"}), 400

    rec = AcademicPerformanceRecord.query.get_or_404(rec_id)
    rec.verification_status = "rejected"
    rec.verified_by = ctx["user_id"]
    rec.verified_at = datetime.utcnow()
    rec.rejection_reason = reason
    db.session.commit()
    return jsonify({"message": "Record rejected", "record": rec.to_dict()})


@historical_data_bp.patch("/academic-performance/<int:rec_id>")
def update_academic_performance_record(rec_id):
    """Admin inline edit for academic performance record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to edit records"}), 403

    rec  = AcademicPerformanceRecord.query.get_or_404(rec_id)
    data = request.get_json(force=True) or {}

    if "mean_cgpa_or_percentage" in data:
        rec.mean_cgpa_or_percentage = round(float(data["mean_cgpa_or_percentage"]), 3)
    if "successful_students_count" in data:
        rec.successful_students_count = int(data["successful_students_count"])
    if "appeared_students_count" in data:
        rec.appeared_students_count = int(data["appeared_students_count"])
    if "year_of_study" in data:
        rec.year_of_study = data["year_of_study"]

    db.session.commit()
    return jsonify({"message": "Record updated", "record": rec.to_dict()})


@historical_data_bp.delete("/academic-performance/<int:rec_id>")
def delete_academic_performance_record(rec_id):
    """Admin deletes academic performance record."""
    ctx = _get_user_context()
    if ctx["role"] != "admin":
        return jsonify({"error": "Admin role required to delete records"}), 403

    rec = AcademicPerformanceRecord.query.get_or_404(rec_id)
    db.session.delete(rec)
    db.session.commit()
    return jsonify({"message": "Record deleted", "id": rec_id})
