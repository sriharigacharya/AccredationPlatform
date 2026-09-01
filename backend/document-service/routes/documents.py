"""Document upload and management routes."""

import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from tasks.celery_app import celery_app
from tasks.ocr_pipeline import process_document

docs_bp = Blueprint("documents", __name__)

ALLOWED_EXTENSIONS = {"pdf", "docx", "jpg", "jpeg", "png", "txt"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@docs_bp.post("/upload")
def upload_document():
    """
    POST /documents/upload  (multipart/form-data)
    Form fields:
      - file: the document file
      - doc_type: SAR | guideline | course_file | FDP | research | placement |
                  committee | certificate | meeting_minutes | other
      - description: optional text description
      - collection: optional Qdrant collection name (defaults to 'academiq_docs')
    
    Returns: { "job_id": "...", "doc_id": "...", "status": "queued" }
    """
    if "file" not in request.files:
        return jsonify({"error": "No file in request"}), 400

    file     = request.files["file"]
    doc_type = request.form.get("doc_type", "other")
    desc     = request.form.get("description", "")
    collection = request.form.get("collection", "academiq_docs")

    if not file.filename:
        return jsonify({"error": "No filename"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": f"File type not supported. Allowed: {ALLOWED_EXTENSIONS}"}), 400

    # Save file
    doc_id   = str(uuid.uuid4())
    filename = secure_filename(f"{doc_id}_{file.filename}")
    file_path= os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
    file.save(file_path)

    # Save metadata to MongoDB
    mongo = current_app.mongo
    doc_meta = {
        "_id":         doc_id,
        "original_name": file.filename,
        "stored_name": filename,
        "doc_type":    doc_type,
        "description": desc,
        "collection":  collection,
        "file_size":   os.path.getsize(file_path),
        "status":      "queued",
        "job_id":      None,
        "pages":       None,
        "chunks":      None,
        "error":       None,
        "uploaded_at": datetime.utcnow().isoformat(),
        "processed_at":None,
    }
    mongo.documents.insert_one(doc_meta)

    # Enqueue Celery task
    task = process_document.apply_async(
        args=[doc_id, file_path, doc_type, collection],
        queue="ocr_queue",
    )

    # Update job_id
    mongo.documents.update_one({"_id": doc_id}, {"$set": {"job_id": task.id, "status": "queued"}})

    return jsonify({
        "job_id":  task.id,
        "doc_id":  doc_id,
        "status":  "queued",
        "message": "Document uploaded. Processing started in background.",
    }), 202


@docs_bp.get("/job/<job_id>")
def job_status(job_id):
    """
    GET /documents/job/:job_id — poll processing status.
    Returns: { "status": "queued|processing|done|failed", "doc_id", "pages", "chunks" }
    """
    from celery.result import AsyncResult
    result = AsyncResult(job_id, app=celery_app)

    # Find document by job_id
    mongo  = current_app.mongo
    doc    = mongo.documents.find_one({"job_id": job_id}, {"_id": 1, "status": 1, "pages": 1, "chunks": 1, "error": 1})

    celery_status = result.state  # PENDING | STARTED | SUCCESS | FAILURE | RETRY

    status_map = {
        "PENDING": "queued",
        "STARTED": "processing",
        "RETRY":   "processing",
        "SUCCESS": "done",
        "FAILURE": "failed",
    }

    return jsonify({
        "job_id":  job_id,
        "doc_id":  str(doc["_id"]) if doc else None,
        "status":  status_map.get(celery_status, celery_status.lower()),
        "pages":   doc.get("pages") if doc else None,
        "chunks":  doc.get("chunks") if doc else None,
        "error":   doc.get("error") if doc else None,
    })


@docs_bp.get("/")
def list_documents():
    """GET /documents?doc_type=SAR&limit=50 — list all ingested documents."""
    doc_type = request.args.get("doc_type")
    limit    = int(request.args.get("limit", 50))
    mongo    = current_app.mongo

    query = {}
    if doc_type:
        query["doc_type"] = doc_type

    docs = list(
        mongo.documents.find(
            query,
            {"stored_name": 0}  # don't expose internal path
        ).sort("uploaded_at", -1).limit(limit)
    )

    # Convert ObjectId → str
    for d in docs:
        d["_id"] = str(d["_id"])

    return jsonify(docs)


@docs_bp.get("/<doc_id>")
def get_document(doc_id):
    """GET /documents/:doc_id — single document metadata."""
    mongo = current_app.mongo
    doc   = mongo.documents.find_one({"_id": doc_id}, {"stored_name": 0})
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    doc["_id"] = str(doc["_id"])
    return jsonify(doc)


@docs_bp.delete("/<doc_id>")
def delete_document(doc_id):
    """DELETE /documents/:doc_id — remove metadata and file."""
    mongo  = current_app.mongo
    doc    = mongo.documents.find_one({"_id": doc_id})
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    # Remove file
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    file_path = os.path.join(upload_folder, doc.get("stored_name", ""))
    if os.path.exists(file_path):
        os.remove(file_path)

    mongo.documents.delete_one({"_id": doc_id})
    return jsonify({"message": "Document deleted"})
