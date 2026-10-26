"""
OpenAPI 3.0.3 Specification Builder for AcademiQ Platform.
Generates full OpenAPI schema for the Unified Gateway and individual microservices.
"""

from typing import Dict, Any, List, Optional
import copy

def get_base_spec() -> Dict[str, Any]:
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "AcademiQ — Academic Intelligence & Accreditation API",
            "version": "1.0.0",
            "description": (
                "### Unified REST API for AcademiQ Academic Intelligence Platform\n\n"
                "Unifies classroom operations, predictive student risk analytics (Random Forest + XGBoost), "
                "AI-powered document intelligence (RAG + Qdrant + BGE-M3), and automated NBA SAR (Criteria 4 & 5) report generation.\n\n"
                "#### 🔐 Authentication & Roles\n"
                "- Include `Authorization: Bearer <token>` in the request header.\n"
                "- **Admin** (`admin@academiq.edu` / `admin123`): Full access to all services and endpoints.\n"
                "- **Teacher** (`meena.iyer@faculty.academiq.edu` / `teacher123`): Academic operations, classes, marks, attendance, RAG, predict, NBA reports.\n"
                "- **Student** (`aarav.stu001@student.academiq.edu` / `student123`): Personal record, timetable, assignments, events.\n"
                "- **Worker** (`worker@academiq.edu` / `worker123`): Document uploads and historical Criterion 4 data entry only.\n\n"
                "#### 🌐 Base URL\n"
                "All routes are exposed through the API Gateway at `/api/v1`."
            ),
            "contact": {
                "name": "AcademiQ Development Team",
                "email": "support@academiq.edu"
            },
            "license": {
                "name": "Academic & Research License"
            }
        },
        "servers": [
            {
                "url": "/api/v1",
                "description": "API Gateway Base URL (/api/v1)"
            },
            {
                "url": "/",
                "description": "Root Service URL (Direct / Health)"
            }
        ],
        "tags": [
            {"name": "Authentication", "description": "User authentication, JWT issuance, profile, and role management"},
            {"name": "Students & Analytics", "description": "Student roster, academic performance metrics, and risk overview"},
            {"name": "Faculty Directory", "description": "Faculty profiles, workload tracking, and appraisal dossiers"},
            {"name": "Departments", "description": "Academic department records and program definitions"},
            {"name": "Classes & CIE Marks", "description": "Assigned course sections, class rosters, attendance sessions, and CIE marks"},
            {"name": "Timetable", "description": "Weekly timetable slots and scheduling grid"},
            {"name": "Biometrics & Faculty Attendance", "description": "Biometric terminal punches, daily roster, monthly stats, and on-duty requests"},
            {"name": "Leave Management", "description": "Faculty leave applications, affected class impact, and substitute allocation"},
            {"name": "Notifications", "description": "User announcements and administrative alerts"},
            {"name": "Admin Review", "description": "Approval queue for administrative validation"},
            {"name": "Assignments & Submissions", "description": "Course assignments, student submissions, and grading"},
            {"name": "Clubs & Events Lifecycle", "description": "Club management, event proposals, approval stages, attendee tracking, and duty attendance"},
            {"name": "Placements & Offers", "description": "Placement tracking, offer letter uploads, verification, and salary statistics"},
            {"name": "Student Achievements", "description": "External hackathon/competition achievement submissions and certificate verification"},
            {"name": "NBA Criterion 4 Historical Data", "description": "Criterion 4 bulk data: admissions (4.1), batch progression (4.2), and academic performance (4.3/4.4)"},
            {"name": "Parent Contact (DPDP Act)", "description": "Privacy-first parent communications, masked numbers, Twilio proxy calls, and audit logging"},
            {"name": "Document Management & OCR", "description": "Document uploads, asynchronous OCR pipeline, and chunking"},
            {"name": "NLP & RAG Intelligence", "description": "Natural language Q&A over accreditation documents and semantic search"},
            {"name": "ML Risk Prediction", "description": "Student risk inference, batch cohort screening, and model retraining"},
            {"name": "NBA SAR Reports", "description": "Criterion tree inspection, NBA SAR generation (PDF & Word DOCX), and adhoc dossiers"},
            {"name": "System & Gateway", "description": "Gateway status, system health, and version information"}
        ],
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "Enter the JWT token obtained from `/auth/login`. Example: `Bearer eyJhbGciOi...`"
                }
            },
            "schemas": {
                "Error": {
                    "type": "object",
                    "properties": {
                        "error": {"type": "string", "example": "Invalid credentials or unauthorized access"},
                        "hint": {"type": "string", "example": "Include Authorization: Bearer <token>"}
                    }
                },
                "LoginRequest": {
                    "type": "object",
                    "required": ["email", "password"],
                    "properties": {
                        "email": {"type": "string", "format": "email", "example": "admin@academiq.edu"},
                        "password": {"type": "string", "format": "password", "example": "admin123"}
                    }
                },
                "LoginResponse": {
                    "type": "object",
                    "properties": {
                        "access_token": {"type": "string", "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."},
                        "token_type": {"type": "string", "example": "Bearer"},
                        "role": {"type": "string", "enum": ["admin", "teacher", "student", "worker"], "example": "admin"},
                        "user_id": {"type": "string", "example": "U001"},
                        "name": {"type": "string", "example": "System Administrator"},
                        "linked_id": {"type": "string", "nullable": True, "example": None},
                        "redirect": {"type": "string", "example": "/dashboard"}
                    }
                },
                "RegisterRequest": {
                    "type": "object",
                    "required": ["email", "password", "name"],
                    "properties": {
                        "email": {"type": "string", "format": "email", "example": "new.faculty@faculty.academiq.edu"},
                        "password": {"type": "string", "example": "secret123"},
                        "name": {"type": "string", "example": "Dr. Ananya Sharma"},
                        "role": {"type": "string", "enum": ["admin", "teacher", "student", "worker"], "default": "student", "example": "teacher"},
                        "linked_id": {"type": "string", "example": "FAC012"}
                    }
                },
                "UserProfile": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer", "example": 1},
                        "user_id": {"type": "string", "example": "U001"},
                        "email": {"type": "string", "example": "admin@academiq.edu"},
                        "role": {"type": "string", "example": "admin"},
                        "name": {"type": "string", "example": "System Administrator"},
                        "linked_id": {"type": "string", "nullable": True, "example": None},
                        "is_active": {"type": "boolean", "example": True}
                    }
                },
                "Student": {
                    "type": "object",
                    "properties": {
                        "student_id": {"type": "string", "example": "STU001"},
                        "name": {"type": "string", "example": "Aarav Sharma"},
                        "usn": {"type": "string", "example": "4NI21CS001"},
                        "semester": {"type": "integer", "example": 6},
                        "section": {"type": "string", "example": "A"},
                        "department": {"type": "string", "example": "CSE"},
                        "cgpa": {"type": "number", "format": "float", "example": 8.45},
                        "attendance_percentage": {"type": "number", "format": "float", "example": 88.5},
                        "risk_level": {"type": "string", "enum": ["low", "medium", "high"], "example": "low"},
                        "risk_score": {"type": "number", "format": "float", "example": 0.12}
                    }
                },
                "PredictStudentRequest": {
                    "type": "object",
                    "required": ["attendance_percentage", "cgpa"],
                    "properties": {
                        "student_id": {"type": "string", "example": "STU001"},
                        "attendance_percentage": {"type": "number", "example": 68.5},
                        "cgpa": {"type": "number", "example": 6.8},
                        "cie1_score": {"type": "number", "example": 14.5},
                        "cie2_score": {"type": "number", "example": 16.0},
                        "quiz_score": {"type": "number", "example": 7.5},
                        "assignment_completion_rate": {"type": "number", "example": 0.75},
                        "backlog_count": {"type": "integer", "example": 1},
                        "semester": {"type": "integer", "example": 6}
                    }
                },
                "PredictStudentResponse": {
                    "type": "object",
                    "properties": {
                        "student_id": {"type": "string", "example": "STU001"},
                        "prediction": {"type": "string", "enum": ["Pass", "Fail"], "example": "Pass"},
                        "risk_score": {"type": "number", "example": 0.3412},
                        "risk_level": {"type": "string", "enum": ["low", "medium", "high"], "example": "medium"},
                        "flags": {"type": "array", "items": {"type": "string"}, "example": ["Attendance below 75%"]},
                        "feature_importance": {
                            "type": "object",
                            "additionalProperties": {"type": "number"},
                            "example": {"attendance_percentage": 0.42, "cie1_score": 0.28, "backlog_count": 0.18}
                        }
                    }
                },
                "RagQueryRequest": {
                    "type": "object",
                    "required": ["query"],
                    "properties": {
                        "query": {"type": "string", "example": "What are the Program Educational Objectives (PEOs) of CSE department?"},
                        "collection": {"type": "string", "default": "academiq_docs", "example": "academiq_docs"},
                        "doc_type_filter": {"type": "string", "example": "SAR"},
                        "top_k": {"type": "integer", "default": 5, "example": 5},
                        "include_sources": {"type": "boolean", "default": True, "example": True}
                    }
                },
                "RagQueryResponse": {
                    "type": "object",
                    "properties": {
                        "answer": {"type": "string", "example": "The PEOs of the Computer Science & Engineering department are..."},
                        "sources": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "doc_id": {"type": "string", "example": "doc-uuid-1234"},
                                    "doc_type": {"type": "string", "example": "SAR"},
                                    "text": {"type": "string", "example": "PEO 1: Graduates shall apply fundamental computer science concepts..."},
                                    "score": {"type": "number", "example": 0.892}
                                }
                            }
                        }
                    }
                },
                "NbaGenerateRequest": {
                    "type": "object",
                    "required": ["sar_format", "department_id", "academic_year"],
                    "properties": {
                        "sar_format": {"type": "string", "example": "ug_tier_ii_gapc_v4"},
                        "department_id": {"type": "string", "example": "CSE"},
                        "academic_year": {"type": "string", "example": "2025-26"},
                        "scope": {"type": "string", "example": "criterion:4"},
                        "format": {"type": "string", "enum": ["pdf", "docx", "both"], "default": "both", "example": "both"},
                        "expand_narratives": {"type": "boolean", "default": False, "example": False}
                    }
                },
                "PunchAttendanceRequest": {
                    "type": "object",
                    "required": ["rfid_or_id"],
                    "properties": {
                        "rfid_or_id": {"type": "string", "example": "FAC001"},
                        "terminal_id": {"type": "string", "default": "GATE-01", "example": "GATE-01"},
                        "timestamp": {"type": "string", "format": "date-time", "example": "2026-10-16T08:55:00Z"},
                        "photo_proof": {"type": "string", "description": "Base64 or image URL", "example": ""}
                    }
                }
            }
        }
    }

def build_paths() -> Dict[str, Any]:
    sec_bearer = [{"bearerAuth": []}]
    
    return {
        # ── Health & System ──────────────────────────────────────────────────
        "/health": {
            "get": {
                "tags": ["System & Gateway"],
                "summary": "Gateway Health Check",
                "description": "Returns status ok if the API gateway is responsive. [Public]",
                "responses": {
                    "200": {
                        "description": "Gateway is healthy",
                        "content": {"application/json": {"example": {"status": "ok", "service": "api-gateway"}}}
                    }
                }
            }
        },
        "/": {
            "get": {
                "tags": ["System & Gateway"],
                "summary": "Gateway Root & Discovery",
                "description": "Returns gateway version, status, and API documentation endpoints. [Public]",
                "responses": {
                    "200": {
                        "description": "Gateway metadata and links",
                        "content": {"application/json": {"example": {
                            "message": "AcademiQ API Gateway",
                            "version": "1.0",
                            "swagger_ui": "/docs",
                            "openapi_spec": "/openapi.json"
                        }}}
                    }
                }
            }
        },

        # ── Authentication ───────────────────────────────────────────────────
        "/auth/login": {
            "post": {
                "tags": ["Authentication"],
                "summary": "User Login",
                "description": "Authenticates a user with email and password, returning a signed JWT access token and user role. [Public]",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/LoginRequest"},
                            "examples": {
                                "Admin": {"value": {"email": "admin@academiq.edu", "password": "admin123"}},
                                "Teacher": {"value": {"email": "meena.iyer@faculty.academiq.edu", "password": "teacher123"}},
                                "Student": {"value": {"email": "aarav.stu001@student.academiq.edu", "password": "student123"}},
                                "Worker": {"value": {"email": "worker@academiq.edu", "password": "worker123"}}
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Login successful",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/LoginResponse"}}}
                    },
                    "400": {"description": "Missing email or password", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                    "401": {"description": "Invalid credentials", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}}
                }
            }
        },
        "/auth/register": {
            "post": {
                "tags": ["Authentication"],
                "summary": "Register New User Account",
                "description": "Creates a new user profile. Requires admin authorization unless bootstrapping initial admin. [Admin / Bootstrap]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/RegisterRequest"}
                        }
                    }
                },
                "responses": {
                    "201": {"description": "Account created successfully", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/LoginResponse"}}}},
                    "400": {"description": "Validation error", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                    "403": {"description": "Admin access required", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                    "409": {"description": "Email already registered", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}}
                }
            }
        },
        "/auth/me": {
            "get": {
                "tags": ["Authentication"],
                "summary": "Current User Profile",
                "description": "Retrieves the authenticated user's profile and active roles based on the JWT Bearer token. [All Authenticated]",
                "security": sec_bearer,
                "responses": {
                    "200": {"description": "User profile details", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/UserProfile"}}}},
                    "401": {"description": "Unauthenticated or token expired", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}}
                }
            }
        },
        "/auth/users": {
            "get": {
                "tags": ["Authentication"],
                "summary": "List All Platform Users",
                "description": "Returns a directory of all registered accounts across roles. [Admin Only]",
                "security": sec_bearer,
                "responses": {
                    "200": {
                        "description": "List of users",
                        "content": {"application/json": {"schema": {"type": "array", "items": {"$ref": "#/components/schemas/UserProfile"}}}}
                    },
                    "403": {"description": "Admin privileges required", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}}
                }
            }
        },
        "/auth/users/{user_pk}": {
            "put": {
                "tags": ["Authentication"],
                "summary": "Update User Profile / Status",
                "description": "Updates user details such as name, role, linked profile ID, or active status. [Admin Only]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "user_pk", "in": "path", "required": True, "schema": {"type": "integer"}, "description": "User database primary key ID"}
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "role": {"type": "string", "enum": ["admin", "teacher", "student", "worker"]},
                                    "is_active": {"type": "boolean"},
                                    "linked_id": {"type": "string"}
                                }
                            }
                        }
                    }
                },
                "responses": {
                    "200": {"description": "User updated", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/UserProfile"}}}},
                    "404": {"description": "User not found"}
                }
            },
            "delete": {
                "tags": ["Authentication"],
                "summary": "Deactivate / Soft-Delete User",
                "description": "Soft-deactivates the user account, revoking login capabilities. [Admin Only]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "user_pk", "in": "path", "required": True, "schema": {"type": "integer"}}
                ],
                "responses": {
                    "200": {"description": "User deactivated", "content": {"application/json": {"example": {"deleted": True, "user_id": "U005"}}}},
                    "404": {"description": "User not found"}
                }
            }
        },

        # ── Students & Analytics ─────────────────────────────────────────────
        "/students": {
            "get": {
                "tags": ["Students & Analytics"],
                "summary": "List Students with Filters",
                "description": "Returns student roster. Teachers/Admins can filter by semester, section, and search query. Students see only their own record. [Students & Staff]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "semester", "in": "query", "schema": {"type": "integer"}, "description": "Filter by semester (1-8)"},
                    {"name": "section", "in": "query", "schema": {"type": "string"}, "description": "Filter by section (A, B, C...)"},
                    {"name": "department", "in": "query", "schema": {"type": "string"}, "description": "Filter by department code (e.g. CSE)"},
                    {"name": "search", "in": "query", "schema": {"type": "string"}, "description": "Search by name or USN"}
                ],
                "responses": {
                    "200": {
                        "description": "List of student records",
                        "content": {"application/json": {"schema": {"type": "array", "items": {"$ref": "#/components/schemas/Student"}}}}
                    }
                }
            },
            "post": {
                "tags": ["Students & Analytics"],
                "summary": "Create Student Record",
                "description": "Registers a new student profile in the academic database. [Admin Only]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Student"},
                            "example": {
                                "student_id": "STU105",
                                "name": "Rahul Verma",
                                "usn": "4NI22CS105",
                                "semester": 5,
                                "section": "B",
                                "department": "CSE",
                                "cgpa": 7.9,
                                "attendance_percentage": 82.0
                            }
                        }
                    }
                },
                "responses": {
                    "201": {"description": "Student created successfully"}
                }
            }
        },
        "/students/{student_id}": {
            "get": {
                "tags": ["Students & Analytics"],
                "summary": "Get Student Profile & Marks Matrix",
                "description": "Returns comprehensive student profile, enrolled courses, attendance breakdown, and exam scores. [Students & Staff]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "student_id", "in": "path", "required": True, "schema": {"type": "string"}, "example": "STU001"}
                ],
                "responses": {
                    "200": {"description": "Student details", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Student"}}}},
                    "404": {"description": "Student not found"}
                }
            },
            "put": {
                "tags": ["Students & Analytics"],
                "summary": "Update Student Record",
                "description": "Updates student profile information, marks, or attendance data. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "student_id", "in": "path", "required": True, "schema": {"type": "string"}}
                ],
                "responses": {
                    "200": {"description": "Student updated successfully"}
                }
            },
            "delete": {
                "tags": ["Students & Analytics"],
                "summary": "Delete Student Record",
                "description": "Permanently removes a student record from the system. [Admin Only]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "student_id", "in": "path", "required": True, "schema": {"type": "string"}}
                ],
                "responses": {
                    "200": {"description": "Student deleted"}
                }
            }
        },
        "/students/{student_id}/analytics": {
            "get": {
                "tags": ["Students & Analytics"],
                "summary": "Student Academic Analytics & Risk Indicators",
                "description": "Computes rule-based and predictive risk indicators, attendance detention warnings, and course-by-course difficulty flags. [Staff & Student]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "student_id", "in": "path", "required": True, "schema": {"type": "string"}, "example": "STU001"}
                ],
                "responses": {
                    "200": {
                        "description": "Analytics indicators",
                        "content": {"application/json": {"example": {
                            "student_id": "STU001",
                            "risk_level": "low",
                            "detention_risk": False,
                            "backlog_count": 0,
                            "attendance_flags": []
                        }}}
                    }
                }
            }
        },
        "/students/stats/overview": {
            "get": {
                "tags": ["Students & Analytics"],
                "summary": "Overall Academic Performance & Risk Dashboard Stats",
                "description": "Returns high-level institution KPIs, student counts by semester, at-risk percentage, and CGPA distribution. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "responses": {
                    "200": {
                        "description": "Academic KPI overview",
                        "content": {"application/json": {"example": {
                            "total_students": 240,
                            "at_risk_count": 18,
                            "average_cgpa": 7.82,
                            "attendance_rate": 86.4
                        }}}
                    }
                }
            }
        },

        # ── Faculty Directory ────────────────────────────────────────────────
        "/faculty": {
            "get": {
                "tags": ["Faculty Directory"],
                "summary": "List Faculty Members",
                "description": "Returns faculty directory with department, designation, and research profile. [Staff & Student]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "department", "in": "query", "schema": {"type": "string"}, "description": "Filter by department"}
                ],
                "responses": {
                    "200": {"description": "List of faculty records"}
                }
            },
            "post": {
                "tags": ["Faculty Directory"],
                "summary": "Create Faculty Member",
                "description": "Registers a new faculty member. [Admin Only]",
                "security": sec_bearer,
                "responses": {"201": {"description": "Faculty created"}}
            }
        },
        "/faculty/{faculty_id}": {
            "get": {
                "tags": ["Faculty Directory"],
                "summary": "Faculty Profile & Teaching Workload",
                "description": "Retrieves faculty member's profile, assigned courses, research publications, and FDP certifications. [Staff & Student]",
                "security": sec_bearer,
                "parameters": [{"name": "faculty_id", "in": "path", "required": True, "schema": {"type": "string"}, "example": "FAC001"}],
                "responses": {"200": {"description": "Faculty profile"}}
            }
        },
        "/faculty/{faculty_id}/report": {
            "get": {
                "tags": ["Faculty Directory"],
                "summary": "Faculty Appraisal Dossier (Criterion 5)",
                "description": "Generates complete NBA Criterion 5 dossier: teaching load, pass percentages, student feedback, publications, and professional development. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [{"name": "faculty_id", "in": "path", "required": True, "schema": {"type": "string"}, "example": "FAC001"}],
                "responses": {"200": {"description": "Appraisal dossier data"}}
            }
        },

        # ── Classes & CIE Marks ──────────────────────────────────────────────
        "/classes/my-classes": {
            "get": {
                "tags": ["Classes & CIE Marks"],
                "summary": "Faculty Assigned Course Sections",
                "description": "Returns courses and sections assigned to the logged-in faculty member. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "responses": {"200": {"description": "List of assigned classes"}}
            }
        },
        "/classes/{course_code}/{section}/students": {
            "get": {
                "tags": ["Classes & CIE Marks"],
                "summary": "Class Roster with Attendance & Marks",
                "description": "Returns all students enrolled in the class section, with sessions attended and CIE exam marks. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "course_code", "in": "path", "required": True, "schema": {"type": "string"}, "example": "21CS61"},
                    {"name": "section", "in": "path", "required": True, "schema": {"type": "string"}, "example": "A"}
                ],
                "responses": {"200": {"description": "Class roster with performance data"}}
            }
        },
        "/classes/{course_code}/{section}/attendance": {
            "post": {
                "tags": ["Classes & CIE Marks"],
                "summary": "Mark Live Session Attendance",
                "description": "Records attendance for a lecture or lab session. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "course_code", "in": "path", "required": True, "schema": {"type": "string"}},
                    {"name": "section", "in": "path", "required": True, "schema": {"type": "string"}}
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "date": "2026-10-16",
                                "slot_id": 2,
                                "topic": "B-Trees and Indexing Structures",
                                "present_student_ids": ["STU001", "STU002", "STU004"],
                                "absent_student_ids": ["STU003"]
                            }
                        }
                    }
                },
                "responses": {"200": {"description": "Session attendance saved"}}
            }
        },
        "/classes/{course_code}/{section}/marks": {
            "post": {
                "tags": ["Classes & CIE Marks"],
                "summary": "Enter / Update CIE Exam Marks",
                "description": "Enters internal exam marks (CIE-1, CIE-2, Quiz-1, Quiz-2, Assignment, Lab) for students. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "course_code", "in": "path", "required": True, "schema": {"type": "string"}},
                    {"name": "section", "in": "path", "required": True, "schema": {"type": "string"}}
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "exam_type": "cie1",
                                "max_marks": 30,
                                "marks": [
                                    {"student_id": "STU001", "marks_obtained": 26.5},
                                    {"student_id": "STU002", "marks_obtained": 19.0}
                                ]
                            }
                        }
                    }
                },
                "responses": {"200": {"description": "Exam marks saved successfully"}}
            }
        },

        # ── Timetable ────────────────────────────────────────────────────────
        "/timetable": {
            "get": {
                "tags": ["Timetable"],
                "summary": "Weekly Timetable Grid",
                "description": "Retrieves weekly schedule grid filtered by section or faculty member. [Students & Staff]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "section", "in": "query", "schema": {"type": "string"}, "description": "e.g. A"},
                    {"name": "semester", "in": "query", "schema": {"type": "integer"}, "description": "e.g. 6"},
                    {"name": "faculty_id", "in": "query", "schema": {"type": "string"}, "description": "e.g. FAC001"}
                ],
                "responses": {"200": {"description": "Timetable schedule slots"}}
            }
        },
        "/timetable/meta": {
            "get": {
                "tags": ["Timetable"],
                "summary": "Timetable Metadata & Slots Definition",
                "description": "Public metadata defining periods, days of the week, and sections. [Public]",
                "responses": {"200": {"description": "Metadata config"}}
            }
        },

        # ── Biometrics & Faculty Attendance ──────────────────────────────────
        "/attendance/punch": {
            "post": {
                "tags": ["Biometrics & Faculty Attendance"],
                "summary": "Simulate Biometric Kiosk Punch",
                "description": "Records a biometric scan (fingerprint or RFID) for a faculty member. [Public / Terminal Kiosk]",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/PunchAttendanceRequest"}
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Punch verified and logged",
                        "content": {"application/json": {"example": {
                            "status": "success",
                            "faculty_id": "FAC001",
                            "name": "Dr. Meena Iyer",
                            "punch_type": "IN",
                            "timestamp": "2026-10-16T08:55:00Z"
                        }}}
                    }
                }
            }
        },
        "/attendance/today": {
            "get": {
                "tags": ["Biometrics & Faculty Attendance"],
                "summary": "Today's Live Campus Faculty Attendance Roster",
                "description": "Real-time campus roster showing faculty attendance status (Present, Absent, On-Duty, On-Leave). [Public / Dashboard]",
                "responses": {"200": {"description": "Today's roster"}}
            }
        },
        "/attendance/faculty/{faculty_id}": {
            "get": {
                "tags": ["Biometrics & Faculty Attendance"],
                "summary": "Faculty Monthly Attendance History",
                "description": "Returns punch history, hours completed, and attendance metrics for a faculty member. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [{"name": "faculty_id", "in": "path", "required": True, "schema": {"type": "string"}, "example": "FAC001"}],
                "responses": {"200": {"description": "Monthly attendance history"}}
            }
        },
        "/attendance/event-requests": {
            "post": {
                "tags": ["Biometrics & Faculty Attendance"],
                "summary": "Submit Faculty FDP / On-Duty Attendance Request",
                "description": "Faculty submits an on-duty attendance request for attending a conference, workshop, or FDP with certificate proof. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "date_from": "2026-10-20",
                                "date_to": "2026-10-21",
                                "event_title": "International Conference on AI in Higher Ed",
                                "organization": "IEEE Bangalore Section",
                                "certificate_url": "/proofs/cert_ieee_2026.pdf"
                            }
                        }
                    }
                },
                "responses": {"201": {"description": "On-duty request submitted"}}
            },
            "get": {
                "tags": ["Biometrics & Faculty Attendance"],
                "summary": "List On-Duty Attendance Requests",
                "description": "Lists pending and approved on-duty attendance requests. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "responses": {"200": {"description": "List of requests"}}
            }
        },
        "/attendance/event-requests/{id}/approve": {
            "post": {
                "tags": ["Biometrics & Faculty Attendance"],
                "summary": "Approve On-Duty Attendance Request",
                "description": "Admin approval marks attendance as PRESENT and logs the certification for NBA Criterion 5. [Admin Only]",
                "security": sec_bearer,
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Request approved"}}
            }
        },

        # ── Leave Management ─────────────────────────────────────────────────
        "/leave": {
            "get": {
                "tags": ["Leave Management"],
                "summary": "List Leave Applications",
                "description": "Returns faculty leave applications. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "responses": {"200": {"description": "List of leaves"}}
            },
            "post": {
                "tags": ["Leave Management"],
                "summary": "Apply for Faculty Leave",
                "description": "Faculty applies for Casual/Medical/Academic leave with optional substitute teacher assignment. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "date_from": "2026-10-25",
                                "date_to": "2026-10-26",
                                "leave_type": "Casual Leave",
                                "reason": "Family engagement",
                                "substitute_faculty_id": "FAC002"
                            }
                        }
                    }
                },
                "responses": {"201": {"description": "Leave request submitted"}}
            }
        },
        "/leave/affected-classes": {
            "get": {
                "tags": ["Leave Management"],
                "summary": "Preview Affected Classes for Proposed Leave Dates",
                "description": "Returns list of lectures scheduled during proposed leave range that require rescheduling or substitution. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "date_from", "in": "query", "required": True, "schema": {"type": "string"}},
                    {"name": "date_to", "in": "query", "required": True, "schema": {"type": "string"}}
                ],
                "responses": {"200": {"description": "Affected classes preview"}}
            }
        },

        # ── Assignments & Submissions ────────────────────────────────────────
        "/assignments": {
            "get": {
                "tags": ["Assignments & Submissions"],
                "summary": "List Course Assignments",
                "description": "Returns assignments for enrolled courses. [Students & Staff]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "course_code", "in": "query", "schema": {"type": "string"}},
                    {"name": "section", "in": "query", "schema": {"type": "string"}}
                ],
                "responses": {"200": {"description": "Assignments list"}}
            },
            "post": {
                "tags": ["Assignments & Submissions"],
                "summary": "Create Course Assignment",
                "description": "Faculty creates assignment with deadline, instructions, and max marks. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "course_code": "21CS61",
                                "section": "A",
                                "title": "B-Tree Implementation Assignment",
                                "description": "Implement B-Tree insertion and deletion in Python or C++",
                                "deadline": "2026-10-30T23:59:59Z",
                                "max_marks": 25
                            }
                        }
                    }
                },
                "responses": {"201": {"description": "Assignment created"}}
            }
        },
        "/assignments/{id}/submit": {
            "post": {
                "tags": ["Assignments & Submissions"],
                "summary": "Submit Assignment Solution",
                "description": "Student submits assignment work (text or uploaded document). [Student Role]",
                "security": sec_bearer,
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Submission recorded"}}
            }
        },

        # ── Clubs & Events Lifecycle ─────────────────────────────────────────
        "/clubs": {
            "get": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "List Active Clubs & Societies",
                "description": "Returns registered department clubs, student chapters (ACM, IEEE, CSI), and faculty mentors. [All Roles]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Active clubs list"}}
            },
            "post": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "Register New Club / Chapter",
                "description": "Admin creates a new student club or professional chapter. [Admin Only]",
                "security": sec_bearer,
                "responses": {"201": {"description": "Club created"}}
            }
        },
        "/events": {
            "get": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "List Academic & Club Events",
                "description": "Returns list of events across proposal, approved, completed lifecycle stages. [All Roles]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "club_id", "in": "query", "schema": {"type": "integer"}},
                    {"name": "status", "in": "query", "schema": {"type": "string"}, "description": "proposed | mentor_approved | admin_approved | completed"}
                ],
                "responses": {"200": {"description": "List of events"}}
            },
            "post": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "Submit Event Proposal",
                "description": "Club Head or Faculty submits proposal with objectives, proposed dates, venue, and budget. [All Roles]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "club_id": 1,
                                "name": "HackVision 2026",
                                "description": "24-hour national hackathon focused on sustainable AI solutions",
                                "venue": "Campus Auditorium & Labs",
                                "date_start": "2026-11-12T09:00:00Z",
                                "date_end": "2026-11-13T17:00:00Z",
                                "budget": 45000,
                                "expected_attendees": 150
                            }
                        }
                    }
                },
                "responses": {"201": {"description": "Event proposal submitted"}}
            }
        },
        "/events/{id}/mentor-approve": {
            "post": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "Faculty Mentor Approval",
                "description": "Faculty mentor reviews and endorses event proposal. [Faculty Mentor]",
                "security": sec_bearer,
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Proposal mentor-approved"}}
            }
        },
        "/events/{id}/admin-approve": {
            "post": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "Admin Final Approval",
                "description": "Admin grants final sanction for event execution and venue booking. [Admin Only]",
                "security": sec_bearer,
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Event approved by admin"}}
            }
        },
        "/events/{id}/register": {
            "post": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "Student Self-Registration for Event",
                "description": "Enrolls student as attendee or participant. [Student Role]",
                "security": sec_bearer,
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Registration confirmed"}}
            }
        },
        "/events/{id}/complete": {
            "post": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "Submit Post-Event Completion Report",
                "description": "Finalizes event with actual attendee counts, outcome attainment, and highlights. [Staff & Club Head]",
                "security": sec_bearer,
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Event marked completed"}}
            }
        },
        "/events/{id}/award-attendance": {
            "post": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "Award Duty Attendance Credits",
                "description": "Automatically awards attendance credit for regular lectures missed by students attending the sanctioned event. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Duty attendance awarded"}}
            }
        },
        "/events/{id}/summary-sheet": {
            "get": {
                "tags": ["Clubs & Events Lifecycle"],
                "summary": "Generate NBA Event Summary Sheet",
                "description": "Produces formatted summary sheet compliant with NBA Criterion 5 event records. [All Roles]",
                "security": sec_bearer,
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "NBA Event Summary Sheet"}}
            }
        },

        # ── Placements & Offers ──────────────────────────────────────────────
        "/placements": {
            "get": {
                "tags": ["Placements & Offers"],
                "summary": "List Student Placements",
                "description": "Returns verified student job placement offers, package CTC, company, and role. [All Roles]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "academic_year", "in": "query", "schema": {"type": "string"}, "example": "2025-26"},
                    {"name": "company", "in": "query", "schema": {"type": "string"}}
                ],
                "responses": {"200": {"description": "List of placements"}}
            },
            "post": {
                "tags": ["Placements & Offers"],
                "summary": "Record Placement Offer",
                "description": "Student or TPO records placement offer with CTC and uploaded offer letter. [All Roles]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "student_id": "STU001",
                                "company": "Microsoft",
                                "role": "Software Engineer",
                                "ctc_lpa": 16.5,
                                "offer_letter_url": "/uploads/offers/stu001_msft.pdf",
                                "academic_year": "2025-26"
                            }
                        }
                    }
                },
                "responses": {"201": {"description": "Offer recorded, queued for verification"}}
            }
        },
        "/placements/stats": {
            "get": {
                "tags": ["Placements & Offers"],
                "summary": "Placement Statistics for NBA SAR (Criterion 4.5)",
                "description": "Computes aggregate placement metrics: total offers, mean CTC, median CTC, highest CTC, and placement percentage. [All Roles]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Placement statistics"}}
            }
        },

        # ── Student Achievements ─────────────────────────────────────────────
        "/student-achievements": {
            "get": {
                "tags": ["Student Achievements"],
                "summary": "List External Competition Achievements",
                "description": "Returns student achievements in hackathons, research papers, coding contests, and sports. [All Roles]",
                "security": sec_bearer,
                "responses": {"200": {"description": "List of achievements"}}
            },
            "post": {
                "tags": ["Student Achievements"],
                "summary": "Submit Achievement with Proof Certificate",
                "description": "Submits external award details with proof certificate for NBA Criterion 4.6.3 points. [All Roles]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "student_id": "STU001",
                                "event_name": "Smart India Hackathon 2025",
                                "award_category": "First Prize",
                                "organizer": "Ministry of Education, Govt of India",
                                "date": "2025-12-20",
                                "proof_document_url": "/proofs/sih_cert.pdf"
                            }
                        }
                    }
                },
                "responses": {"201": {"description": "Achievement submitted for review"}}
            }
        },

        # ── NBA Criterion 4 Historical Data ──────────────────────────────────
        "/admission-records": {
            "get": {
                "tags": ["NBA Criterion 4 Historical Data"],
                "summary": "Criterion 4.1 Sanctioned Intake vs Admissions",
                "description": "Historical admission records and student intake for the previous 4 academic years. [Staff & Worker]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Criterion 4.1 data"}}
            },
            "post": {
                "tags": ["NBA Criterion 4 Historical Data"],
                "summary": "Import / Add Admission Records",
                "description": "Bulk import or manual addition of admission data. Workers submit as pending; admins commit directly. [Staff & Worker]",
                "security": sec_bearer,
                "responses": {"201": {"description": "Admission records saved"}}
            }
        },
        "/batch-progress": {
            "get": {
                "tags": ["NBA Criterion 4 Historical Data"],
                "summary": "Criterion 4.2 Batch Progression (Without Backlogs)",
                "description": "Tracks batch cohort progression across Year 1, Year 2, Year 3, and Year 4. [Staff & Worker]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Criterion 4.2 batch data"}}
            }
        },
        "/academic-performance": {
            "get": {
                "tags": ["NBA Criterion 4 Historical Data"],
                "summary": "Criterion 4.3 & 4.4 Academic Performance Index",
                "description": "Calculates Academic Performance Index (API) for final year students and graduates without backlogs. [Staff & Worker]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Criterion 4.3/4.4 performance data"}}
            }
        },

        # ── Parent Contact (DPDP Act) ────────────────────────────────────────
        "/parents/{student_id}": {
            "get": {
                "tags": ["Parent Contact (DPDP Act)"],
                "summary": "Get Parent Contact Record",
                "description": "Returns parent contact information. Masked phone number (`*****3210`) for teachers; unmasked for Admins. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [{"name": "student_id", "in": "path", "required": True, "schema": {"type": "string"}, "example": "STU001"}],
                "responses": {"200": {"description": "Parent record details"}}
            }
        },
        "/contact/call": {
            "post": {
                "tags": ["Parent Contact (DPDP Act)"],
                "summary": "Initiate DPDP-Compliant Twilio Proxy Call",
                "description": "Connects faculty and parent via masked proxy phone bridge so neither party sees the other's real phone number. Gated by parent consent. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "student_id": "STU001",
                                "use_proxy": True
                            }
                        }
                    }
                },
                "responses": {
                    "200": {"description": "Call initiated via proxy bridge"},
                    "403": {"description": "Contact blocked: parent consent revoked"}
                }
            }
        },
        "/contact/sms": {
            "post": {
                "tags": ["Parent Contact (DPDP Act)"],
                "summary": "Send Attendance / Academic Alert SMS",
                "description": "Dispatches automated attendance or exam alert to parent. Gated by parent consent. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "student_id": "STU001",
                                "message": "AcademiQ Alert: Aarav's attendance in Data Structures is currently below 75%."
                            }
                        }
                    }
                },
                "responses": {"200": {"description": "SMS queued / sent"}}
            }
        },
        "/contact/log": {
            "get": {
                "tags": ["Parent Contact (DPDP Act)"],
                "summary": "Parent Outreach Audit Log",
                "description": "Audit trail of all communication attempts, timestamps, caller ID, and call duration for statutory compliance. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Audit log records"}}
            }
        },

        # ── Document Management & OCR ────────────────────────────────────────
        "/documents/upload": {
            "post": {
                "tags": ["Document Management & OCR"],
                "summary": "Upload Accreditation Document",
                "description": "Uploads PDF, DOCX, or scanned document images. Asynchronously extracts text (PyMuPDF with PaddleOCR fallback), generates chunks, and embeds vectors into Qdrant. [All Roles]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "type": "object",
                                "required": ["file"],
                                "properties": {
                                    "file": {"type": "string", "format": "binary"},
                                    "doc_type": {"type": "string", "enum": ["SAR", "guideline", "course_file", "FDP", "research", "other"], "default": "SAR"},
                                    "description": {"type": "string", "example": "Criterion 4 SAR Draft 2025-26"}
                                }
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Document queued for processing",
                        "content": {"application/json": {"example": {
                            "job_id": "job-8f7d9a10",
                            "doc_id": "doc-b1c2d3e4",
                            "status": "queued"
                        }}}
                    }
                }
            }
        },
        "/documents/job/{job_id}": {
            "get": {
                "tags": ["Document Management & OCR"],
                "summary": "Poll OCR & Chunking Job Status",
                "description": "Returns status of asynchronous OCR extraction and embedding task. [All Roles]",
                "security": sec_bearer,
                "parameters": [{"name": "job_id", "in": "path", "required": True, "schema": {"type": "string"}}],
                "responses": {
                    "200": {"description": "Job status (queued | processing | completed | failed)"}
                }
            }
        },
        "/documents": {
            "get": {
                "tags": ["Document Management & OCR"],
                "summary": "List Uploaded Documents",
                "description": "Returns directory of uploaded documents with processing status and page count. [All Roles]",
                "security": sec_bearer,
                "responses": {"200": {"description": "List of documents"}}
            }
        },

        # ── NLP & RAG Intelligence ───────────────────────────────────────────
        "/rag/query": {
            "post": {
                "tags": ["NLP & RAG Intelligence"],
                "summary": "Ask Natural Language Question over Documents",
                "description": "Semantic search retrieves top relevant document chunks from Qdrant via BGE-M3 embeddings, and generates answers using Llama 3.1. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/RagQueryRequest"}
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Answer and cited source chunks",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/RagQueryResponse"}}}
                    }
                }
            }
        },
        "/rag/summarize": {
            "post": {
                "tags": ["NLP & RAG Intelligence"],
                "summary": "Summarize Document Text",
                "description": "Uses LLM to summarize accreditation narrative text or committee meeting minutes. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {
                                "text": "Enter long minutes of meeting or course curriculum description here..."
                            }
                        }
                    }
                },
                "responses": {"200": {"description": "Generated summary"}}
            }
        },
        "/rag/stats": {
            "get": {
                "tags": ["NLP & RAG Intelligence"],
                "summary": "Vector Database Collection Statistics",
                "description": "Returns total vector count, embedding dimension, and collection health from Qdrant. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Collection statistics"}}
            }
        },

        # ── ML Risk Prediction ───────────────────────────────────────────────
        "/predict/student": {
            "post": {
                "tags": ["ML Risk Prediction"],
                "summary": "Predict Pass/Fail Academic Risk for Student",
                "description": "Evaluates student risk using Random Forest + XGBoost models. Returns failure probability, risk category (low/medium/high), and TreeExplainer SHAP feature contributions. [Staff & Student]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/PredictStudentRequest"}
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Prediction result with SHAP feature importances",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/PredictStudentResponse"}}}
                    }
                }
            }
        },
        "/predict/atrisk": {
            "get": {
                "tags": ["ML Risk Prediction"],
                "summary": "List Students Identified At Risk",
                "description": "Returns students whose predicted risk score exceeds the threshold (default 0.50), sorted by risk severity. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "threshold", "in": "query", "schema": {"type": "number", "default": 0.5}, "description": "Risk probability threshold"},
                    {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 50}}
                ],
                "responses": {"200": {"description": "List of at-risk students"}}
            }
        },
        "/predict/run-batch": {
            "post": {
                "tags": ["ML Risk Prediction"],
                "summary": "Trigger Full Cohort ML Screening & DB Refresh",
                "description": "Asynchronously runs risk prediction over all active students and persists risk scores and flags back to the database. [Admin Only]",
                "security": sec_bearer,
                "responses": {
                    "202": {"description": "Batch job initiated", "content": {"application/json": {"example": {
                        "message": "Batch prediction run started in background.",
                        "status": "running"
                    }}}}
                }
            }
        },
        "/predict/batch-status": {
            "get": {
                "tags": ["ML Risk Prediction"],
                "summary": "Status of ML Batch Screening",
                "description": "Returns status, student count, and timestamp of the latest cohort risk screening job. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Batch job status"}}
            }
        },
        "/predict/train": {
            "post": {
                "tags": ["ML Risk Prediction"],
                "summary": "Retrain ML Risk Models",
                "description": "Retrains RandomForest and XGBoost classifiers on the current institutional dataset and updates model weights. [Admin Only]",
                "security": sec_bearer,
                "responses": {
                    "200": {"description": "Model retrained successfully", "content": {"application/json": {"example": {
                        "status": "trained",
                        "metadata": {"accuracy": 0.92, "roc_auc": 0.94, "trained_at": "2026-10-16T10:00:00Z"}
                    }}}}
                }
            }
        },
        "/predict/model/info": {
            "get": {
                "tags": ["ML Risk Prediction"],
                "summary": "Active Model Metadata & Metrics",
                "description": "Retrieves active ML model version, hyperparameters, ROC-AUC score, and feature importances. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Model info and evaluation metrics"}}
            }
        },

        # ── NBA SAR Reports ──────────────────────────────────────────────────
        "/criteria": {
            "get": {
                "tags": ["NBA SAR Reports"],
                "summary": "NBA SAR Criterion Tree Hierarchy",
                "description": "Returns hierarchical tree of all 9 NBA SAR criteria, showing which criteria are implemented and computable from live operational data. [Staff & Worker]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "sar_format", "in": "query", "schema": {"type": "string", "default": "ug_tier_ii_gapc_v4"}}
                ],
                "responses": {
                    "200": {"description": "NBA SAR criteria hierarchy"}
                }
            }
        },
        "/reports/nba/generate": {
            "post": {
                "tags": ["NBA SAR Reports"],
                "summary": "Generate NBA SAR Report (PDF & DOCX)",
                "description": "Compiles Criterion 4 and Criterion 5 data into officially formatted NBA Self-Assessment Report tables in PDF and Microsoft Word DOCX formats. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/NbaGenerateRequest"}
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Report generated",
                        "content": {"application/json": {"example": {
                            "job_id": 42,
                            "status": "completed",
                            "files": {
                                "pdf": "/api/v1/reports/42/download?format=pdf",
                                "docx": "/api/v1/reports/42/download?format=docx"
                            }
                        }}}
                    }
                }
            }
        },
        "/reports/{id}/download": {
            "get": {
                "tags": ["NBA SAR Reports"],
                "summary": "Download Generated Report File",
                "description": "Streams generated PDF or Word document file for download. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "parameters": [
                    {"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}},
                    {"name": "format", "in": "query", "schema": {"type": "string", "enum": ["pdf", "docx"], "default": "pdf"}}
                ],
                "responses": {
                    "200": {"description": "File binary stream"}
                }
            }
        },
        "/reports/history": {
            "get": {
                "tags": ["NBA SAR Reports"],
                "summary": "Report Generation History Archive",
                "description": "Returns archive of previously generated NBA SAR and adhoc reports. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "responses": {"200": {"description": "Report history list"}}
            }
        },
        "/reports/student": {
            "post": {
                "tags": ["NBA SAR Reports"],
                "summary": "Generate Student Academic Dossier",
                "description": "Generates a complete individual student transcript dossier with CIE/SEE progression and attendance history. [Staff & Student]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {"student_id": "STU001", "format": "pdf"}
                        }
                    }
                },
                "responses": {"200": {"description": "Dossier generated"}}
            }
        },
        "/reports/faculty": {
            "post": {
                "tags": ["NBA SAR Reports"],
                "summary": "Generate Faculty Appraisal Dossier",
                "description": "Compiles faculty performance appraisal report for NBA Criterion 5. [Staff: Admin & Teacher]",
                "security": sec_bearer,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": {"faculty_id": "FAC001", "academic_year": "2025-26", "format": "pdf"}
                        }
                    }
                },
                "responses": {"200": {"description": "Faculty dossier generated"}}
            }
        }
    }

# Mapping of services to tags and path prefixes for scoped documentation
SERVICE_MAP = {
    "auth": {
        "title": "AcademiQ — Auth Service API",
        "description": "Dedicated API specification for AcademiQ Authentication & User Management Service (Port 8001).",
        "tags": ["Authentication"],
        "prefixes": ["/auth"]
    },
    "academic": {
        "title": "AcademiQ — Academic Data Service API",
        "description": "Dedicated API specification for Academic Data Service (Port 8002): Students, Faculty, Classes, Timetable, Attendance, Events, Placements, Historical Criterion 4.",
        "tags": [
            "Students & Analytics", "Faculty Directory", "Departments", "Classes & CIE Marks",
            "Timetable", "Biometrics & Faculty Attendance", "Leave Management", "Assignments & Submissions",
            "Clubs & Events Lifecycle", "Placements & Offers", "Student Achievements", "NBA Criterion 4 Historical Data"
        ],
        "prefixes": [
            "/students", "/faculty", "/departments", "/classes", "/timetable", "/attendance",
            "/leave", "/notifications", "/admin-review", "/assignments", "/clubs", "/events",
            "/student-roles", "/placements", "/offer-letters", "/student-achievements",
            "/admission-records", "/batch-progress", "/academic-performance", "/academic-batches"
        ]
    },
    "prediction": {
        "title": "AcademiQ — Prediction Service API",
        "description": "Dedicated API specification for ML Risk Prediction Service (Port 8006): Pass/Fail classification, SHAP explanations, and batch screening.",
        "tags": ["ML Risk Prediction"],
        "prefixes": ["/predict"]
    },
    "rag": {
        "title": "AcademiQ — NLP & RAG Service API",
        "description": "Dedicated API specification for NLP & RAG Service (Port 8005): Document Q&A, BGE-M3 embeddings, Qdrant vector retrieval, and summarization.",
        "tags": ["NLP & RAG Intelligence"],
        "prefixes": ["/rag", "/embed", "/collections"]
    },
    "reports": {
        "title": "AcademiQ — Report Generation Service API",
        "description": "Dedicated API specification for Report Generation Service (Port 8007): NBA SAR Criteria 4 & 5 tables, PDF and Word DOCX rendering, and appraisal dossiers.",
        "tags": ["NBA SAR Reports"],
        "prefixes": ["/criteria", "/reports"]
    },
    "documents": {
        "title": "AcademiQ — Document Processing Service API",
        "description": "Dedicated API specification for Document Service (Port 8004): File uploads, asynchronous OCR extraction, and chunking jobs.",
        "tags": ["Document Management & OCR"],
        "prefixes": ["/documents"]
    },
    "contact": {
        "title": "AcademiQ — Parent Contact Service API",
        "description": "Dedicated API specification for Parent Contact Service (Port 8003): DPDP Act 2023 compliant parent outreach, Twilio proxy calling, SMS, and audit trails.",
        "tags": ["Parent Contact (DPDP Act)"],
        "prefixes": ["/parents", "/contact"]
    }
}

def get_openapi_spec(service: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns the complete unified OpenAPI spec, or a scoped spec for an individual service.
    """
    spec = get_base_spec()
    all_paths = build_paths()

    if not service or service.lower() in ("all", "unified", "gateway"):
        spec["paths"] = all_paths
        return spec

    svc_key = service.lower()
    if svc_key not in SERVICE_MAP:
        spec["paths"] = all_paths
        return spec

    cfg = SERVICE_MAP[svc_key]
    spec["info"]["title"] = cfg["title"]
    spec["info"]["description"] = cfg["description"]
    
    # Filter tags
    allowed_tags = set(cfg["tags"])
    spec["tags"] = [t for t in spec["tags"] if t["name"] in allowed_tags]

    # Filter paths
    filtered_paths = {}
    prefixes = tuple(cfg["prefixes"])
    for path, path_obj in all_paths.items():
        if path.startswith(prefixes):
            filtered_paths[path] = path_obj

    spec["paths"] = filtered_paths
    return spec
