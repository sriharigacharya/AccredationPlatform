"""
Tests for NLP / RAG Service (AcademiQ)
Covers RBAC staff enforcement (_require_staff), query validation, summarization, and narrative endpoints.
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add service directory to sys.path
SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

import pytest
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        yield app.test_client()


def test_health(client):
    """Health check returns status ok and service name."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"
    assert data["service"] == "nlp-rag-service"


def test_rag_query_role_guard_blocks_student_and_worker(client):
    """Students and workers cannot query RAG endpoints (RBAC 403)."""
    for role in ["student", "worker"]:
        resp = client.post("/rag/query", json={"query": "Test query"}, headers={"X-User-Role": role})
        assert resp.status_code == 403
        assert "not permitted" in resp.get_json()["error"]


def test_rag_query_allows_staff_roles(client):
    """Teachers and Admins are permitted to query."""
    with patch("routes.rag.retrieve_chunks") as mock_retriever, \
         patch("routes.rag.generate_answer") as mock_generator:
        mock_retriever.return_value = [
            {"doc_id": "doc1", "doc_type": "SAR", "text": "PEO CSE detail", "score": 0.95}
        ]
        mock_generator.return_value = "The PEOs of the CSE department are..."

        for role in ["teacher", "admin"]:
            resp = client.post("/rag/query", json={"query": "What are the PEOs?"}, headers={"X-User-Role": role})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["answer"] == "The PEOs of the CSE department are..."
            assert len(data["sources"]) == 1
            assert data["sources"][0]["doc_id"] == "doc1"


def test_rag_query_missing_query(client):
    """POST /rag/query with empty query returns 400."""
    resp = client.post("/rag/query", json={"query": ""}, headers={"X-User-Role": "teacher"})
    assert resp.status_code == 400
    assert "query is required" in resp.get_json()["error"]


def test_rag_query_no_chunks_found(client):
    """When no relevant chunks exist, returns courteous fallback message."""
    with patch("routes.rag.retrieve_chunks", return_value=[]):
        resp = client.post("/rag/query", json={"query": "Random query"}, headers={"X-User-Role": "teacher"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert "could not find relevant information" in data["answer"]
        assert data["sources"] == []


def test_summarize_role_guard_and_execution(client):
    """Summarize guards role and generates summary for staff."""
    # Student blocked
    s_resp = client.post("/rag/summarize", json={"text": "Long document..."}, headers={"X-User-Role": "student"})
    assert s_resp.status_code == 403

    # Missing text -> 400
    m_resp = client.post("/rag/summarize", json={"text": ""}, headers={"X-User-Role": "teacher"})
    assert m_resp.status_code == 400

    # Staff allowed with mocked summarizer
    with patch("routes.rag.summarize_text", return_value="Summary text"):
        t_resp = client.post("/rag/summarize", json={"text": "Long document content"}, headers={"X-User-Role": "teacher"})
        assert t_resp.status_code == 200
        assert t_resp.get_json()["summary"] == "Summary text"


def test_narrate_endpoint(client):
    """POST /rag/narrate generates narrative prose from bullet points."""
    # Missing bullets -> 400
    empty_resp = client.post("/rag/narrate", json={"bullets": []})
    assert empty_resp.status_code == 400

    # Successful narrative call
    with patch("rag.generator.generate_narrative", return_value="Criterion 4 narrative prose."):
        resp = client.post("/rag/narrate", json={
            "section_id": "4.1",
            "section_title": "Enrolment Ratio",
            "bullets": ["Students enrolled: 58", "Sanctioned intake: 60"]
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["section_id"] == "4.1"
        assert data["narrative"] == "Criterion 4 narrative prose."
