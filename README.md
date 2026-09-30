# AcademiQ

**AI-Powered Unified Academic Intelligence & Accreditation Platform**

> Final Year Project — B.E. Computer Science & Engineering · Z10 Batch · 2025–26

AcademiQ is a full-stack microservices platform that unifies daily classroom operations, predictive student risk analytics, AI-powered document intelligence, and NBA accreditation report generation into a single cohesive system — eliminating fragmented spreadsheets and last-minute audit panic.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Quick Start — Docker Compose](#quick-start--docker-compose)
5. [Default Logins](#default-logins)
6. [Development Setup (Per-Service)](#development-setup-per-service)
7. [Environment Variables](#environment-variables)
8. [Features](#features)
9. [API Reference](#api-reference)
10. [Project Structure](#project-structure)
11. [LLM Configuration](#llm-configuration)
12. [Twilio Setup](#twilio-setup-optional)
13. [Roles & Permissions](#roles--permissions)

---

## What It Does

| Capability | Description |
|---|---|
| 🎓 **Student Analytics** | Full academic records — attendance, CIE/SEE marks, SGPA/CGPA, backlog tracking |
| 🤖 **ML Risk Prediction** | Random Forest + XGBoost identifies at-risk students before semester deadlines |
| 📄 **Document Intelligence** | Upload PDFs/DOCX → OCR → chunk → embed → ask questions in natural language |
| 📊 **NBA SAR Generation** | Generates Criterion 4 & 5 tables (4.1–4.6) in PDF and DOCX from live data |
| 📞 **Parent Contact** | DPDP Act 2023 compliant — masked numbers, Twilio proxy calls, consent gating |
| 🗓️ **Timetable & Biometrics** | Weekly timetable management + simulated biometric kiosk for faculty attendance |
| 🎪 **Event Lifecycle** | Full proposal → approval → completion workflow for clubs and events |
| 🏆 **Placements & Achievements** | Student placement tracking and competition achievement verification |

---

## Architecture

```
Browser (React SPA — port 3000)
          │
          ▼  JWT Bearer Token
  ┌───────────────────┐
  │   API Gateway     │  port 8000  — JWT validation + reverse proxy
  └──────┬────────────┘
         │  X-User-Id · X-User-Role · X-Linked-Id headers injected
         ├──▶ auth-service           (8001)  PostgreSQL
         ├──▶ academic-data-service  (8002)  PostgreSQL
         ├──▶ parent-contact-service (8003)  PostgreSQL + Twilio
         ├──▶ document-service       (8004)  MongoDB + Celery worker
         ├──▶ nlp-rag-service        (8005)  Qdrant + Groq/Ollama
         ├──▶ prediction-service     (8006)  scikit-learn + XGBoost
         └──▶ report-service         (8007)  python-docx + ReportLab

Infrastructure: PostgreSQL 16 · MongoDB 7 · Redis 7 · Qdrant 1.9
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite · React Router v6 · Recharts · Lucide React |
| API Gateway | Flask + PyJWT · reverse proxy middleware |
| Auth | Flask + SQLAlchemy + bcrypt + JWT |
| Academic Data | Flask + SQLAlchemy + PostgreSQL |
| Document Processing | Flask + PyMuPDF + PaddleOCR + Celery |
| NLP / RAG | sentence-transformers (BGE-M3) + Qdrant + Llama 3.1 8B |
| ML Prediction | scikit-learn (RandomForest) + XGBoost |
| Report Export | python-docx + ReportLab |
| Task Queue | Celery + Redis |
| Databases | PostgreSQL · MongoDB · Qdrant (vector) |
| Telephony | Twilio Voice + SMS Proxy |
| Infrastructure | Docker + Docker Compose v2 |

---

## Quick Start — Docker Compose

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 4.20
- Docker Compose v2 (bundled with Docker Desktop)
- **8 GB RAM minimum** — 16 GB recommended (NLP service loads the BGE-M3 model)
- 20 GB free disk space

### 1 — Clone the repo

```bash
git clone https://github.com/sriharigacharya/AccredationPlatform.git
cd AccredationPlatform
```

### 2 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

| Variable | What to change |
|---|---|
| `JWT_SECRET` | Any long random string |
| `LLM_BACKEND` | `groq` (recommended) or `ollama` |
| `OPENAI_API_KEY` | Free Groq key from [console.groq.com](https://console.groq.com) |
| `TWILIO_ENABLED` | Leave `false` for demo — uses mock mode |

### 3 — Start everything

```bash
docker-compose up --build
```

> **First build takes 10–20 minutes.** Docker downloads all images and the NLP service pulls the BGE-M3 embedding model (~500 MB) from HuggingFace. Subsequent starts are fast.

### 4 — Open the platform

| Service | URL |
|---|---|
| **React App** | http://localhost:3000 |
| **API Gateway** | http://localhost:8000 |
| **Qdrant Dashboard** | http://localhost:6333/dashboard |

The database is **auto-seeded on first boot** with a complete demo dataset (see [Default Logins](#default-logins) below).

---

## Default Logins

> All demo accounts use simple passwords. Change them in production.

| Role | Email | Password | Access |
|---|---|---|---|
| **Admin** | `admin@academiq.edu` | `admin123` | Full platform access |
| **Teacher** | `meena.iyer@faculty.academiq.edu` | `teacher123` | Dr. Meena Iyer (Data Structures & ML) |
| **Teacher** | `ravi.shankar@faculty.academiq.edu` | `teacher123` | Prof. Ravi Shankar (Networks & OS) |
| **Student** | `aarav.stu001@student.academiq.edu` | `student123` | Sample student (STU001) |
| **Worker** | `worker@academiq.edu` | `worker123` | Historical data import only |

### Demo Dataset (auto-seeded)

- **1 department** — CSE (Computer Science & Engineering)
- **2 faculty** profiles with full academic records
- **100 students** across 3 sections:
  - Section A — 35 students, Semester 3
  - Section B — 33 students, Semester 5
  - Section C — 32 students, Semester 7
- **100 parent records** (one per student)

---

## Development Setup (Per-Service)

Use this when you want to run individual services locally without Docker.

### Backend services

Each microservice is a standalone Flask app. They all follow the same pattern:

```bash
cd backend/<service-name>
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

| Service | Directory | Port | External deps |
|---|---|---|---|
| auth-service | `backend/auth-service` | 8001 | PostgreSQL |
| academic-data-service | `backend/academic-data-service` | 8002 | PostgreSQL |
| parent-contact-service | `backend/parent-contact-service` | 8003 | PostgreSQL |
| document-service | `backend/document-service` | 8004 | MongoDB + Redis |
| nlp-rag-service | `backend/nlp-rag-service` | 8005 | Qdrant + Redis |
| prediction-service | `backend/prediction-service` | 8006 | PostgreSQL |
| report-service | `backend/report-service` | 8007 | PostgreSQL |
| api-gateway | `backend/api-gateway` | 8000 | All above running |

> Set `DATABASE_URL`, `MONGO_URI`, `REDIS_URL`, and `QDRANT_HOST` in your shell or a local `.env` before running each service.

### Celery worker (document processing)

```bash
cd backend/document-service
celery -A tasks.celery_app worker --loglevel=info --queues=ocr_queue
```

### React frontend

```bash
cd frontend/app
npm install
npm run dev           # starts at http://localhost:5173
```

> The dev server proxies API calls to `http://localhost:8000` — make sure the API gateway is running first.

### Landing page

Just open the file directly in a browser — no build step needed:

```
frontend/landing/index.html
```

---

## Environment Variables

Full reference for `.env` (copy from `.env.example`):

```env
# ── Auth ─────────────────────────────────────────────────────────
JWT_SECRET=changeme_use_a_long_random_string
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# ── PostgreSQL ───────────────────────────────────────────────────
POSTGRES_USER=academiq
POSTGRES_PASSWORD=academiq_pass
POSTGRES_DB=academiq
POSTGRES_HOST=postgres          # use 'localhost' for local dev
POSTGRES_PORT=5432

# ── MongoDB ──────────────────────────────────────────────────────
MONGO_URI=mongodb://mongodb:27017/academiq_docs

# ── Redis ────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── Qdrant ───────────────────────────────────────────────────────
QDRANT_HOST=qdrant              # use 'localhost' for local dev
QDRANT_PORT=6333
QDRANT_COLLECTION=academiq_docs

# ── LLM backend ──────────────────────────────────────────────────
LLM_BACKEND=groq                # groq | ollama
LLM_MODEL=llama-3.1-8b-instant
OPENAI_API_KEY=gsk_...          # Groq key from console.groq.com
OPENAI_BASE_URL=https://api.groq.com/openai/v1

# ── Twilio (parent contact) ───────────────────────────────────────
TWILIO_ENABLED=false            # true = real calls; false = mock/log only
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+1234567890
TWILIO_PROXY_SERVICE_SID=KSxxxxxx   # for proxy/masked calls
```

---

## Features

<details>
<summary><strong>Authentication & RBAC</strong></summary>

- JWT-based login with role-specific dashboard redirect
- Four roles: **Admin**, **Teacher**, **Student**, **Worker**
- API Gateway validates tokens and injects `X-User-Role`, `X-Linked-Id` headers into every downstream request
- Admin can create, update, and deactivate user accounts

</details>

<details>
<summary><strong>Student Records & Academic Data</strong></summary>

- Filterable student roster by semester, section, department
- Per-student profile: CGPA/SGPA, attendance %, CIE 1/CIE 2/Quiz/SEE marks per course
- Rule-based risk flags: attendance < 75%, backlogs > 0, CIE < 50
- Students can only access their own record (enforced by `X-Linked-Id`)

</details>

<details>
<summary><strong>Classes, Attendance & CIE</strong></summary>

- Faculty conducts live lecture attendance sessions per class
- Edit past attendance sessions with a mandatory audit comment
- Marks entry: CIE 1, CIE 2, Quiz 1, Quiz 2, Extra Lab, SEE
- At-risk alert detector per course and section

</details>

<details>
<summary><strong>Faculty Timetable & Biometric Attendance</strong></summary>

- Weekly timetable grid viewable by Faculty, Section, or Room
- Simulated biometric kiosk (`/mock-device`) for demo RFID punching
- Faculty campus roster: PRESENT / LATE / HALF_DAY / ABSENT / ON_LEAVE
- **Event attendance workflow**: faculty uploads FDP/conference certificate → admin reviews and grants PRESENT status + appends credential to faculty profile automatically

</details>

<details>
<summary><strong>Leave Management</strong></summary>

- Faculty submits leave with affected class preview before confirmation
- Optional substitute faculty assignment
- Enrolled students receive automatic cancellation notifications

</details>

<details>
<summary><strong>Event Lifecycle (NBA Criteria 4 & 5)</strong></summary>

- Full proposal → faculty mentor approval → admin approval → student registration → post-event report
- Photo gallery upload
- Duty attendance engine: awards class attendance credits for timetable-overlapping event slots
- Generates NBA-compliant Event Summary Sheets

</details>

<details>
<summary><strong>Assignments & Submissions</strong></summary>

- Faculty creates assignments with deadlines and file attachments
- Students submit (file or text)
- Faculty grades submissions and awards marks

</details>

<details>
<summary><strong>Placements & Achievements</strong></summary>

- Students submit placement offers (company, CTC, role, offer letter upload)
- Admin verifies placements; aggregate stats (mean CTC, placement ratio) computed automatically
- External hackathon/competition achievements go through faculty verification queue
- Verified achievements populate NBA Criterion 4.6.3 tables

</details>

<details>
<summary><strong>Parent Contact — DPDP Act 2023 Compliant</strong></summary>

- Faculty see masked phone numbers (`*****3210`); only Admin sees real numbers
- Voice calls via **Twilio Proxy** — neither party sees the other's number
- Consent gate: all outreach blocked if `consent_to_contact = false`
- Full contact audit log (caller, timestamp, call SID)

</details>

<details>
<summary><strong>Document Repository & OCR Pipeline</strong></summary>

- Upload PDF, DOCX, or scanned images
- PyMuPDF extracts text from digital PDFs → PaddleOCR fallback for scanned images
- Async Celery processing: 512-token sliding window chunks with 50-token overlap
- BGE-M3 embeddings stored in Qdrant vector database

</details>

<details>
<summary><strong>NLP / RAG Chatbot</strong></summary>

- Natural language Q&A over uploaded accreditation documents
- BGE-M3 semantic search retrieves top-K relevant chunks from Qdrant
- Llama 3.1 8B (via Groq or local Ollama) generates grounded answers
- Returns citations with document type and similarity score
- Access restricted to Admin and Teacher roles

</details>

<details>
<summary><strong>ML Risk Prediction</strong></summary>

- Random Forest + XGBoost ensemble trained on 8 features:
  attendance %, CGPA, CIE 1, CIE 2, quiz scores, assignment completion, backlogs, semester
- Real-time prediction per student with risk probability (0–1) and level (low/medium/high)
- Batch at-risk screening with configurable threshold
- Admin can trigger model retraining from the dashboard

</details>

<details>
<summary><strong>NBA SAR Report Generation</strong></summary>

- Generates Criterion 4 tables (4.1–4.6) directly from live operational data
- Export as **PDF** and **Microsoft Word DOCX**
- Report history and download archive
- Fully isolated from the RAG pipeline — deterministic, structured output

</details>

<details>
<summary><strong>Historical Data Import (Criterion 4)</strong></summary>

- Bulk CSV import for admission records (4.1), batch progression (4.2), academic performance (4.3/4.4)
- Worker role imports save as `pending`; Admin imports save as `verified`
- Atomic rollback on any validation failure

</details>

---

## API Reference

All requests go through `http://localhost:8000/api/v1`. Include `Authorization: Bearer <token>` on all authenticated routes.

### Authentication

```
POST /auth/login          → { access_token, role, user_id, name }
POST /auth/register       → { access_token, role, user_id }
GET  /auth/me             → current user profile
GET  /auth/users          → list users (Admin)
POST /auth/users          → create user (Admin)
PUT  /auth/users/:id      → update role / deactivate (Admin)
```

### Students

```
GET    /students/                → list (filter: ?semester=&section=&search=)
POST   /students/                → create student
GET    /students/:id             → profile + course marks matrix
PUT    /students/:id             → update academic data
DELETE /students/:id             → delete (Admin only)
GET    /students/:id/analytics   → rule-based risk flags
GET    /students/stats/overview  → dashboard KPIs
```

### Faculty

```
GET    /faculty/              → directory listing
POST   /faculty/              → create (Admin)
GET    /faculty/:id           → faculty profile
PUT    /faculty/:id           → update (Admin)
DELETE /faculty/:id           → delete (Admin)
GET    /faculty/:id/report    → performance dossier
```

### Classes & CIE Marks

```
GET  /classes/my-classes                            → teacher's assigned courses
GET  /classes/:code/:sec/students                   → class roster
POST /classes/:code/:sec/attendance                 → mark live session
GET  /classes/:code/:sec/attendance/sessions        → session history
PUT  /classes/:code/:sec/attendance/sessions/:id    → edit past session (with reason)
POST /classes/:code/:sec/marks                      → enter exam marks
GET  /classes/:code/:sec/risk-alerts                → at-risk alerts
```

### Biometric & Faculty Attendance

```
GET  /timetable                               → weekly grid (?faculty_id= | ?section=)
POST /attendance/punch                        → biometric kiosk punch
GET  /attendance/today                        → live campus roster
GET  /attendance/faculty/:id                  → monthly history
POST /attendance/manual                       → admin override
POST /attendance/event-requests               → submit FDP/conference request + certificate
GET  /attendance/event-requests               → list requests
POST /attendance/event-requests/:id/approve   → grant PRESENT + add certification
POST /attendance/event-requests/:id/reject    → reject with reason
```

### Documents & RAG

```
POST /documents/upload         → upload file → { job_id, doc_id, status: "queued" }
GET  /documents/job/:job_id    → poll OCR job status
GET  /documents/               → list all documents
DELETE /documents/:id          → delete + purge vectors from Qdrant
POST /rag/query                → { query, top_k? } → { answer, sources }
POST /rag/summarize            → { text } → { summary }
GET  /rag/stats                → vector DB collection stats
```

### ML Prediction

```
POST /predict/student    → { student record } → { score, level, feature_importance }
GET  /predict/atrisk     → ?threshold=0.5 → at-risk student list
POST /predict/batch      → batch cohort screening
POST /predict/train      → retrain model (Admin)
```

### Parent Contact

```
GET  /parents/:student_id     → parent record (masked for Teacher, unmasked for Admin)
POST /parents/                → create / update parent record
POST /contact/call            → initiate Twilio proxy call
POST /contact/sms             → send SMS alert
GET  /contact/log             → contact audit log
```

### Reports

```
GET  /criteria                      → available SAR criterion tree
POST /reports/nba/generate          → generate NBA SAR (Criterion 4/5)
GET  /reports/:id/download          → download as PDF or DOCX
GET  /reports/history               → past report jobs
POST /reports/adhoc                 → ad-hoc AI report (RAG-grounded)
POST /reports/student               → individual student academic dossier
POST /reports/faculty               → faculty appraisal dossier
```

### Events & Clubs

```
GET  /events/                         → list events
POST /events/                         → submit proposal (Club Head / Teacher / Admin)
POST /events/:id/mentor-approve       → faculty mentor approval
POST /events/:id/admin-approve        → admin approval
POST /events/:id/register             → student self-registration
POST /events/:id/complete             → post-event completion report
POST /events/:id/award-attendance     → award duty attendance credits
GET  /events/:id/summary-sheet        → NBA Event Summary Sheet

GET  /clubs/                          → list clubs
POST /clubs/                          → create club (Admin)
POST /student-roles/                  → assign club role to student (Admin)
```

---

## Project Structure

```
AccredationPlatform/
├── backend/
│   ├── api-gateway/             Flask — JWT validation + reverse proxy
│   ├── auth-service/            Flask — login, registration, user CRUD
│   ├── academic-data-service/   Flask — students, faculty, attendance,
│   │                                    timetable, events, clubs,
│   │                                    assignments, placements, achievements
│   ├── parent-contact-service/  Flask — parent records, Twilio calls/SMS
│   ├── document-service/        Flask + Celery — file upload, OCR pipeline
│   ├── nlp-rag-service/         Flask — BGE-M3 embeddings, Qdrant, LLM
│   ├── prediction-service/      Flask — RandomForest + XGBoost risk model
│   └── report-service/          Flask — NBA SAR generation, PDF/DOCX export
│
├── frontend/
│   ├── app/                     React 18 + Vite — operational SPA (18 pages)
│   │   └── src/
│   │       ├── pages/           Dashboard, Students, Faculty, Classes,
│   │       │                    Timetable, Events, Assignments, Documents,
│   │       │                    RAGChat, Reports, Contact, Settings, ...
│   │       ├── components/      Sidebar, modals, shared UI
│   │       ├── api/             Centralised API client (client.js)
│   │       └── context/         AuthContext
│   └── landing/                 Static HTML marketing landing page
│
├── docker-compose.yml           Full-stack orchestration
├── .env.example                 Environment variable template
└── README.md
```

---

## LLM Configuration

### Option A — Groq (Recommended for demos & laptops)

Free tier, fast cloud inference, no local GPU required.

1. Get a free API key at [console.groq.com](https://console.groq.com)
2. Set in `.env`:

```env
LLM_BACKEND=groq
LLM_MODEL=llama-3.1-8b-instant
OPENAI_API_KEY=gsk_your_key_here
OPENAI_BASE_URL=https://api.groq.com/openai/v1
```

### Option B — Local Ollama (air-gapped / on-premise)

Requires ~10 GB RAM.

1. Uncomment the `ollama` service block in `docker-compose.yml`
2. Set in `.env`:

```env
LLM_BACKEND=ollama
OLLAMA_HOST=http://ollama:11434
```

3. Pull the model after first start:

```bash
docker exec -it ollama ollama pull llama3.1:8b
```

---

## Twilio Setup (Optional)

Required only for real parent voice calls and SMS. The platform runs fully in **mock mode** without a Twilio account.

1. Create a free account at [twilio.com](https://twilio.com)
2. Provision a phone number in the Twilio console
3. Set in `.env`:

```env
TWILIO_ENABLED=true
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

4. For **proxy / masked calls** (neither party sees the other's real number):
   - Create a Proxy Service in the Twilio console
   - Set `TWILIO_PROXY_SERVICE_SID=KSxxxxxxxx`

> **Privacy note:** The platform complies with the DPDP Act 2023 via phone number masking and proxy call bridging. In a production deployment, phone numbers should also be encrypted at rest.

---

## Roles & Permissions

| Feature | Admin | Teacher | Student | Worker |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ (own) | — |
| Student roster & profiles | ✅ | ✅ | ✅ (own) | — |
| Faculty directory | ✅ | ✅ | — | — |
| Attendance marking | ✅ | ✅ | — | — |
| Biometric admin override | ✅ | — | — | — |
| RAG chatbot | ✅ | ✅ | — | — |
| Document upload | ✅ | ✅ | — | ✅ |
| ML risk prediction | ✅ | ✅ | ✅ (own) | — |
| Parent contact | ✅ (unmasked) | ✅ (masked) | — | — |
| NBA SAR generation | ✅ | ✅ | — | — |
| Historical data import | ✅ | — | — | ✅ |
| User management | ✅ | — | — | — |
| Model retraining | ✅ | — | — | — |

---

*Department of Computer Science & Engineering — B.E. CSE Z10 Batch 2025–26 — Final Year Project*
