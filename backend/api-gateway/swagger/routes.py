"""
Flask Blueprint for Swagger Documentation in AcademiQ API Gateway.
Exposes interactive Swagger UI and OpenAPI 3.0 specs.
"""

from flask import Blueprint, jsonify, Response, redirect, request
from swagger.spec_builder import get_openapi_spec
from swagger.swagger_ui_html import render_swagger_ui_html

swagger_bp = Blueprint("swagger", __name__)


@swagger_bp.get("/docs")
@swagger_bp.get("/swagger")
@swagger_bp.get("/api/docs")
def swagger_ui():
    """Renders interactive Swagger UI with live AcademiQ endpoints."""
    return render_swagger_ui_html(), 200, {"Content-Type": "text/html; charset=utf-8"}


@swagger_bp.get("/openapi.json")
@swagger_bp.get("/swagger.json")
def openapi_json():
    """Serves the Unified OpenAPI 3.0.3 specification JSON."""
    service = request.args.get("service")
    spec = get_openapi_spec(service=service)
    return jsonify(spec)


@swagger_bp.get("/openapi/<service>.json")
def openapi_service_json(service):
    """Serves scoped OpenAPI 3.0.3 specification JSON for a specific microservice."""
    spec = get_openapi_spec(service=service)
    return jsonify(spec)


@swagger_bp.get("/openapi.yaml")
def openapi_yaml():
    """Serves OpenAPI 3.0.3 specification in YAML format."""
    service = request.args.get("service")
    spec = get_openapi_spec(service=service)
    try:
        import yaml
        yaml_content = yaml.dump(spec, sort_keys=False, allow_unicode=True)
        return Response(yaml_content, mimetype="text/yaml", headers={"Content-Disposition": "inline; filename=openapi.yaml"})
    except ImportError:
        # Fallback to json if PyYAML is not present
        return jsonify(spec)
