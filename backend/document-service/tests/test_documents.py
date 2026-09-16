"""
Tests for Document Service (AcademiQ)
Covers file validation (allowed_file), upload flow, background job polling, list/filter, and delete endpoints.
"""

import io
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Set up module mocks before importing service code
mock_pymongo = MagicMock()
sys.modules["pymongo"] = mock_pymongo
mock_celery = MagicMock()
sys.modules["celery"] = mock_celery
sys.modules["celery.result"] = mock_celery

# Add service directory to sys.path
SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

import pytest
from app import create_app
import routes.documents as doc_routes


@pytest.fixture
def test_setup(tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()

    app = create_app()
    app.config["TESTING"] = True
    app.config["UPLOAD_FOLDER"] = str(upload_dir)

    # In-memory document storage mock
    docs_db = {}

    mock_collection = MagicMock()

    def insert_one(doc):
        docs_db[doc["_id"]] = dict(doc)
        res = MagicMock()
        res.inserted_id = doc["_id"]
        return res

    def update_one(filter_dict, update_dict):
        doc_id = filter_dict.get("_id")
        if doc_id in docs_db and "$set" in update_dict:
            docs_db[doc_id].update(update_dict["$set"])

    def find_one(filter_dict, projection=None):
        if "_id" in filter_dict:
            doc = docs_db.get(filter_dict["_id"])
            return dict(doc) if doc else None
        if "job_id" in filter_dict:
            for d in docs_db.values():
                if d.get("job_id") == filter_dict["job_id"]:
                    return dict(d)
        return None

    def find(query=None, projection=None):
        results = list(docs_db.values())
        if query and "doc_type" in query:
            results = [d for d in results if d.get("doc_type") == query["doc_type"]]
        cursor = MagicMock()
        cursor.sort.return_value = cursor
        cursor.limit.return_value = results
        return cursor

    def delete_one(filter_dict):
        doc_id = filter_dict.get("_id")
        if doc_id in docs_db:
            del docs_db[doc_id]

    mock_collection.insert_one = insert_one
    mock_collection.update_one = update_one
    mock_collection.find_one = find_one
    mock_collection.find = find
    mock_collection.delete_one = delete_one

    app.mongo = MagicMock()
    app.mongo.documents = mock_collection

    with app.app_context():
        yield app.test_client(), docs_db, upload_dir


def test_allowed_file():
    """Validate allowed file extensions for document ingestion."""
    assert doc_routes.allowed_file("report.pdf") is True
    assert doc_routes.allowed_file("syllabus.docx") is True
    assert doc_routes.allowed_file("certificate.png") is True
    assert doc_routes.allowed_file("scan.jpg") is True
    assert doc_routes.allowed_file("notes.txt") is True

    assert doc_routes.allowed_file("malicious.exe") is False
    assert doc_routes.allowed_file("script.sh") is False
    assert doc_routes.allowed_file("no_extension") is False


def test_upload_document_validation(test_setup):
    """POST /documents/upload validates presence and type of file."""
    client, _, _ = test_setup

    # Missing file
    resp_no_file = client.post("/documents/upload", data={})
    assert resp_no_file.status_code == 400

    # Disallowed file type
    bad_file = (io.BytesIO(b"binary"), "virus.exe")
    resp_bad = client.post("/documents/upload", data={"file": bad_file}, content_type="multipart/form-data")
    assert resp_bad.status_code == 400
    assert "File type not supported" in resp_bad.get_json()["error"]


def test_upload_document_success(test_setup):
    """POST /documents/upload saves file, persists metadata, and enqueues task."""
    client, docs_db, upload_dir = test_setup

    with patch("routes.documents.process_document.apply_async") as mock_task:
        task_instance = MagicMock()
        task_instance.id = "job-12345"
        mock_task.return_value = task_instance

        file_data = (io.BytesIO(b"%PDF-1.4 mock content"), "nba_sar_criterion4.pdf")
        resp = client.post(
            "/documents/upload",
            data={
                "file": file_data,
                "doc_type": "SAR",
                "description": "Criterion 4 Evidence",
                "collection": "academiq_docs"
            },
            content_type="multipart/form-data"
        )
        assert resp.status_code == 202
        data = resp.get_json()
        assert data["job_id"] == "job-12345"
        assert data["status"] == "queued"
        doc_id = data["doc_id"]

        # Verify saved in mock mongo
        assert doc_id in docs_db
        assert docs_db[doc_id]["doc_type"] == "SAR"
        assert docs_db[doc_id]["job_id"] == "job-12345"


def test_job_status_polling(test_setup):
    """GET /documents/job/:job_id polls Celery and Mongo status."""
    client, docs_db, _ = test_setup
    docs_db["doc-999"] = {
        "_id": "doc-999",
        "job_id": "job-abc",
        "status": "done",
        "pages": 12,
        "chunks": 48,
        "error": None
    }

    with patch("celery.result.AsyncResult") as mock_async_result:
        res = MagicMock()
        res.state = "SUCCESS"
        mock_async_result.return_value = res

        resp = client.get("/documents/job/job-abc")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["job_id"] == "job-abc"
        assert data["doc_id"] == "doc-999"
        assert data["status"] == "done"
        assert data["pages"] == 12
        assert data["chunks"] == 48


def test_list_and_get_documents(test_setup):
    """GET /documents and GET /documents/:doc_id return document metadata."""
    client, docs_db, _ = test_setup
    docs_db["doc-1"] = {"_id": "doc-1", "doc_type": "SAR", "description": "Doc 1"}
    docs_db["doc-2"] = {"_id": "doc-2", "doc_type": "guideline", "description": "Doc 2"}

    # List all
    resp_all = client.get("/documents/")
    assert resp_all.status_code == 200
    assert len(resp_all.get_json()) == 2

    # Filter by doc_type
    resp_filtered = client.get("/documents/?doc_type=SAR")
    assert resp_filtered.status_code == 200
    filtered = resp_filtered.get_json()
    assert len(filtered) == 1
    assert filtered[0]["doc_type"] == "SAR"

    # Get single
    resp_single = client.get("/documents/doc-1")
    assert resp_single.status_code == 200
    assert resp_single.get_json()["_id"] == "doc-1"

    # Not found
    assert client.get("/documents/non-existent").status_code == 404


def test_delete_document(test_setup):
    """DELETE /documents/:doc_id removes document from storage and metadata."""
    client, docs_db, upload_dir = test_setup

    stored_file = upload_dir / "doc-del_file.pdf"
    stored_file.write_text("dummy")

    docs_db["doc-del"] = {
        "_id": "doc-del",
        "stored_name": "doc-del_file.pdf",
        "doc_type": "SAR"
    }

    resp = client.delete("/documents/doc-del")
    assert resp.status_code == 200
    assert not stored_file.exists()
    assert "doc-del" not in docs_db

    # Second delete returns 404
    assert client.delete("/documents/doc-del").status_code == 404
