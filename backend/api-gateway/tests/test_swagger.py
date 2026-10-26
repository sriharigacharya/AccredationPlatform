"""
Unit tests for AcademiQ API Gateway Swagger Documentation Feature.
"""

import sys
import os
import json
import pytest

# Add api-gateway directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_swagger_ui_html(client):
    """GET /docs returns interactive Swagger UI HTML page."""
    res = client.get("/docs")
    assert res.status_code == 200
    assert "text/html" in res.headers["Content-Type"]
    html = res.data.decode("utf-8")
    assert "AcademiQ API Documentation" in html
    assert "swagger-ui" in html
    assert "quickLogin" in html
    assert "admin@academiq.edu" in html


def test_swagger_ui_aliases(client):
    """Aliases /swagger, /api/docs, and /api/v1/docs serve Swagger UI."""
    for path in ["/swagger", "/api/docs", "/api/v1/docs", "/api/v1/swagger"]:
        res = client.get(path)
        assert res.status_code == 200
        assert "text/html" in res.headers["Content-Type"]


def test_openapi_json_spec(client):
    """GET /openapi.json returns valid OpenAPI 3.0.3 schema."""
    res = client.get("/openapi.json")
    assert res.status_code == 200
    assert "application/json" in res.headers["Content-Type"]
    
    data = res.get_json()
    assert data["openapi"] == "3.0.3"
    assert "AcademiQ" in data["info"]["title"]
    assert "paths" in data
    assert "components" in data
    assert "bearerAuth" in data["components"]["securitySchemes"]
    
    # Verify core paths across all services
    paths = data["paths"]
    assert "/auth/login" in paths
    assert "/students" in paths
    assert "/predict/student" in paths
    assert "/rag/query" in paths
    assert "/reports/nba/generate" in paths
    assert "/documents/upload" in paths
    assert "/contact/call" in paths
    assert "/timetable" in paths
    assert "/attendance/punch" in paths
    assert "/events" in paths


def test_service_scoped_openapi_specs(client):
    """Scoped endpoints return filtered specs for each microservice."""
    # Auth Service
    res_auth = client.get("/openapi/auth.json")
    assert res_auth.status_code == 200
    data_auth = res_auth.get_json()
    assert "/auth/login" in data_auth["paths"]
    assert "/predict/student" not in data_auth["paths"]

    # Prediction Service
    res_pred = client.get("/openapi/prediction.json")
    assert res_pred.status_code == 200
    data_pred = res_pred.get_json()
    assert "/predict/student" in data_pred["paths"]
    assert "/predict/atrisk" in data_pred["paths"]
    assert "/auth/login" not in data_pred["paths"]

    # Report Service
    res_reports = client.get("/openapi/reports.json")
    assert res_reports.status_code == 200
    data_reports = res_reports.get_json()
    assert "/reports/nba/generate" in data_reports["paths"]
    assert "/criteria" in data_reports["paths"]


def test_openapi_yaml_spec(client):
    """GET /openapi.yaml returns YAML formatted spec."""
    res = client.get("/openapi.yaml")
    assert res.status_code == 200
    content = res.data.decode("utf-8")
    assert "openapi: 3.0.3" in content or "openapi" in content


def test_gateway_root_discovery(client):
    """Root endpoint / advertises swagger documentation links."""
    res = client.get("/")
    assert res.status_code == 200
    data = res.get_json()
    assert data["swagger_ui"] == "/docs"
    assert data["openapi_spec"] == "/openapi.json"
