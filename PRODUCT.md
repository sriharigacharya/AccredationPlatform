# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary Users**: Faculty and Department Teachers in higher education institutions. Their daily job is managing course sections, logging student attendance, grading continuous assessments, monitoring student academic progress, intervening with at-risk students, and conducting privacy-compliant parent communications.
- **Secondary Users**:
  - **Institutional Leadership & Accreditation / IQAC Coordinators**: Auditing departmental academic metrics, monitoring outcome attainment, and generating flexible or custom accreditation exports.
  - **Students**: Monitoring personal attendance, internal marks, assignment schedules, and querying course materials via AI document search.
  - **System Administrators**: Managing user credentials, role permissions, system configuration, and retraining prediction models.
  - **Parents**: Receiving consent-based, privacy-masked voice and SMS notifications regarding attendance deficits or academic interventions without exposing personal contact details.

## Product Purpose

AcademiQ is an academic intelligence and unified management platform that bridges daily classroom operations with predictive student risk analytics and flexible accreditation reporting. It exists to replace fragmented spreadsheets and manual audit panic with an integrated operational environment where teaching, student mentoring, early intervention, and compliance data generation happen seamlessly. Success means faculty spend less time wrestling data, at-risk students are caught and supported before failing, and institutional accreditation reporting is flexible and automated.

## Positioning

Unlike traditional, siloed Learning Management Systems (LMS) or rigid, single-standard accreditation forms, AcademiQ connects daily classroom pedagogy directly to:
1. Machine-learning-driven student risk prediction (Random Forest and XGBoost) for proactive early intervention.
2. An intelligent document retrieval and RAG pipeline (BGE-M3 embeddings + Qdrant vector database + Llama 3.1 8B) for institutional and course document Q&A.
3. DPDP Act 2023 compliant privacy-first parent communications using masked numbers and proxy call bridging.
4. Flexible and custom accreditation data exports adaptable across institutional frameworks.

## Operating Context

- **Active Frontend Surfaces**:
  - **Operational Web App (`frontend/app`)**: Authenticated, task-dense single-page application built with React 18, Vite, React Router, Recharts, and Lucide React.
  - **Marketing Landing Page (`frontend/landing`)**: Public-facing institutional presentation detailing platform capabilities, architecture, and value propositions.
- **Backend Architecture**: Polyglot microservices ecosystem orchestrated via Docker Compose:
  - API Gateway (JWT authentication and reverse proxy routing)
  - Auth Service, Academic Data Service, Parent Contact Service, Document Service (PyMuPDF/PaddleOCR + Celery), NLP/RAG Service (BGE-M3 + Qdrant), Prediction Service (scikit-learn + XGBoost), and Report Service.
- **Institutional Rituals**: Semester transitions, periodic internal assessments (CIE), mandatory attendance milestones, parent-teacher reviews, and periodic accreditation committee reviews.

## Capabilities and Constraints

- **Confirmed Capabilities**:
  - Academic records management: students, faculty, courses, attendance, and continuous assessment marks.
  - Predictive analytics: ML risk classification with configurable score thresholds and rule-based risk triggers.
  - Document intelligence: multi-format file upload, OCR extraction, sliding-window chunking, vector embedding, and conversational RAG.
  - Parent contact bridge: two-way masked voice calls and SMS alerts via Twilio proxy integration (with mock fallback).
  - Accreditation exports: flexible, customizable report generation for departmental and institutional audits.
  - Role-Based Access Control (Admin, Faculty, Student, Worker).
- **Constraints**:
  - Privacy and regulatory: strict adherence to India's DPDP Act 2023 guidelines (no plaintext phone exposure to end users; proxy bridging).
  - Hybrid AI infrastructure: support for both cloud-based LLM inference (Groq) and self-hosted on-premise inference (Ollama).
  - Dual-surface development: both operational web application and public marketing landing page are active development targets.

## Brand Commitments

- **Name**: AcademiQ
- **Identity & Context**: Developed for B.E. Computer Science & Engineering Final Year Project (Z10 Batch, Academic Year 2025–2026).
- **Voice & Tone**: Academically rigorous, modern, authoritative, empathetic toward student growth, and uncompromised on privacy.

## Evidence on Hand

- Complete source repository with 8 backend microservices (`backend/`).
- 15 operational page views in React frontend (`frontend/app/src/pages/`): Dashboard, Students, StudentProfile, Faculty, TeacherClasses, Assignments, Events, Documents, RAGChat, Reports, HistoricalData, Contact, MyRecord, Settings, Login.
- Public landing page assets (`frontend/landing/index.html`, styles, and scripts).
- Comprehensive architectural documentation (`AcademiQ_Architecture_and_Features.html` and `README.md`).
- Built-in demonstration dataset (100 student records, 100 parent contacts, 2 faculty profiles, CSE department).

## Product Principles

1. **Faculty Workflow First**: Daily classroom tasks (marking attendance, entering scores, flagging struggles) must feel swift, frictionless, and cognitive-load-light. Compliance data must be an effortless byproduct, not an administrative burden.
2. **Proactive Intervention Over Post-Mortem Analysis**: Surface early risk signals before semester deadlines so faculty can act when help still makes a difference.
3. **Privacy by Default**: Protect student and guardian contact information at all costs; never expose private phone numbers or sensitive telemetry without consent and encryption.
4. **Information Density with Absolute Clarity**: Present academic matrices, tabular data, and statistical distributions with crisp visual hierarchy, avoiding visual noise while preserving depth.
5. **Adaptable Compliance**: Provide flexible data structures and export pipelines that accommodate evolving institutional criteria rather than locking into a rigid, fragile schema.

## Accessibility & Inclusion

- High contrast text and numerical data for dense tabular views and dashboard statistics.
- Full keyboard operability for repetitive data entry (attendance roll-calls, score updates).
- Clear visual indicators for status flags and risk tiers that do not rely solely on color hue (using labels, icons, and badges together).
