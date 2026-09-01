# AcademiQ — AI-Powered Unified Academic Intelligence & Accreditation Platform

**B.E. CSE · Z10 Batch · 2025–26 · Final Year Project**

## Architecture

```
AccredationPlatform/
├── backend/                    ← all Flask microservices
│   ├── api-gateway/
│   ├── auth-service/
│   ├── academic-data-service/
│   ├── parent-contact-service/
│   ├── document-service/
│   ├── nlp-rag-service/
│   └── prediction-service/
├── frontend/
│   ├── app/                    ← React operational platform (Vite)
│   └── landing/                ← Static HTML landing page (AcademiQ)
├── docker-compose.yml
├── .env
└── README.md
```

**Request flow:**
```
React Frontend (port 3000)
        │
API Gateway (Flask, port 8000) — JWT auth + route proxy
        │
        ├── auth-service           (port 8001)
        ├── academic-data-service  (port 8002)
        ├── parent-contact-service (port 8003)
        ├── document-service       (port 8004) ← Celery worker
        ├── nlp-rag-service        (port 8005) ← Celery worker
        └── prediction-service     (port 8006)

Infrastructure: PostgreSQL · MongoDB · Redis · Qdrant
```

---

## Quick Start (Docker Compose)

### Prerequisites
- Docker Desktop ≥ 4.20
- Docker Compose v2 (included in Docker Desktop)
- 8–16 GB RAM (16 GB recommended for NLP service)
- 20 GB free disk (NLP model download ~580 MB, images ~5 GB total)

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
- **JWT_SECRET** — change to any long random string
- **LLM_BACKEND** — `groq` (recommended for laptops) or `ollama` (local)
- **OPENAI_API_KEY** — get a free key at [console.groq.com](https://console.groq.com) (free tier, Llama 3.1 8B)
- **TWILIO_ENABLED** — keep `false` for demo (mock mode); set `true` for real calls

### 2. Start Everything

```bash
docker-compose up --build
```

> ⚠️ First build takes 10–20 minutes (downloads Docker images + BGE-M3 model ~580 MB).
> Subsequent starts are fast.

### 3. Access the Platform

| Service | URL |
|---------|-----|
| React Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8000 |
| Qdrant Dashboard | http://localhost:6333/dashboard |

### 4. Default Login

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@academiq.edu | admin123 |
| Teacher (FAC001) | meena.iyer@faculty.academiq.edu | teacher123 |
| Teacher (FAC002) | ravi.shankar@faculty.academiq.edu | teacher123 |
| Student (STU001) | aarav.stu001@student.academiq.edu | student123 |
| Worker | worker@academiq.edu | worker123 |

Demo data is auto-seeded on first boot:
- **1 department**: CSE — Computer Science & Engineering
- **2 faculty**: Dr. Meena Iyer (Data Structures & ML), Prof. Ravi Shankar (Networks & OS)
- **100 students** across 3 sections:
  - Section A (35 students, Semester 3)
  - Section B (33 students, Semester 5)
  - Section C (32 students, Semester 7)
- **100 parent records** (one per student)

---

## Features

### 1. Accreditation Document Intelligence
- Upload NBA SARs, guidelines, course files, FDP/research/placement reports, certificates
- OCR pipeline: PyMuPDF (digital PDFs) → PaddleOCR fallback (scanned images)
- Auto-classification by document type
- 512-token sliding window chunking with 50-token overlap
- BGE-M3 embeddings → Qdrant vector DB
- Natural language Q&A using RAG + Llama 3.1 8B (via Groq or Ollama)

### 2. Student Analytics & Prediction
- Full student records with 8 academic features
- Random Forest + XGBoost risk prediction (pre-trained, auto-retrains)
- At-risk student identification with configurable threshold
- Rule-based risk flags (attendance, backlogs, marks)

### 3. Faculty Records & Reporting
- Publications, FDP participation, certifications, research projects, awards
- Department-level aggregated dashboard

### 4. Parent Contact System
- Parent records with consent flag and preferred contact method
- Masked phone numbers (faculty sees `*****3210`)
- Twilio proxy calls (neither party sees the other's real number)
- Mock mode for demo (no Twilio account needed)

### 5. Role-Based Access
- **Admin**: Full access, user management, model retraining
- **Faculty**: Students, faculty, documents, contact, RAG chat
- **Student**: Dashboard, RAG chat

---

## Running Individual Services (Development)

```bash
# Install Python deps (per service)
cd backend/auth-service
pip install -r requirements.txt
python app.py

# React frontend
cd frontend/app
npm install
npm run dev

# Open landing page
start frontend/landing/index.html
```

---

## API Reference

### Authentication
```
POST /api/v1/auth/login       → { access_token, role, user_id, name }
POST /api/v1/auth/register    → { access_token, role, user_id }
GET  /api/v1/auth/me          → user profile
```

### Students
```
GET    /api/v1/students/              → list all
POST   /api/v1/students/              → create
GET    /api/v1/students/:id           → profile
PUT    /api/v1/students/:id           → update
GET    /api/v1/students/:id/analytics → risk flags
GET    /api/v1/students/stats/overview → dashboard stats
```

### Faculty
```
GET  /api/v1/faculty/           → list
POST /api/v1/faculty/           → create
GET  /api/v1/faculty/:id        → profile
GET  /api/v1/faculty/:id/report → report card
```

### Documents
```
POST /api/v1/documents/upload      → { job_id, doc_id, status: "queued" }
GET  /api/v1/documents/job/:job_id → { status, pages, chunks }
GET  /api/v1/documents/            → list all
DELETE /api/v1/documents/:id       → delete
```

### RAG
```
POST /api/v1/rag/query     → { query, collection?, top_k? } → { answer, sources }
POST /api/v1/rag/summarize → { text, max_length? }          → { summary }
GET  /api/v1/rag/stats     → vector DB stats
```

### Predictions
```
POST /api/v1/predict/student  → student record → { prediction, risk_score, risk_level }
GET  /api/v1/predict/atrisk   → ?threshold=0.5 → at-risk list
POST /api/v1/predict/train    → retrain model
```

### Parent Contact
```
GET  /api/v1/parents/:student_id       → parent record (number masked for faculty)
POST /api/v1/parents/                  → create/update
POST /api/v1/contact/call              → { student_id, use_proxy? }
POST /api/v1/contact/sms               → { student_id, message }
GET  /api/v1/contact/log               → contact history
```

---

## LLM Configuration

### Option A: Groq (Recommended for demo — free, fast)
```env
LLM_BACKEND=groq
LLM_MODEL=llama-3.1-8b-instant
OPENAI_API_KEY=gsk_your_groq_key_here
OPENAI_BASE_URL=https://api.groq.com/openai/v1
```
Get a free key at https://console.groq.com

### Option B: Local Ollama (needs ~10 GB RAM)
```env
LLM_BACKEND=ollama
OLLAMA_HOST=http://ollama:11434
```
Uncomment the `ollama` service in `docker-compose.yml`, then:
```bash
docker-compose up -d ollama
docker exec -it ollama ollama pull llama3.1:8b
```

---

## Twilio Setup (Parent Contact)

1. Create a Twilio account at https://twilio.com (free trial gives ~$15 credit)
2. Get Account SID, Auth Token, and a phone number
3. Set in `.env`:
   ```env
   TWILIO_ENABLED=true
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_FROM_NUMBER=+1234567890
   ```
4. For proxy calls: Create a Proxy Service in Twilio console and set `TWILIO_PROXY_SERVICE_SID`

> **Privacy Note (discuss with your guide):**
> - Phone numbers stored in plaintext — production would encrypt at rest
> - Access to parent contacts should have audit logging
> - DPDP Act 2023 compliance requires explicit consent workflow and right to withdraw
> - The proxy call feature hides both parties' real numbers from each other

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Recharts + Lucide |
| API Gateway | Flask + PyJWT + requests |
| Auth | Flask + SQLAlchemy + bcrypt + JWT |
| Academic Data | Flask + SQLAlchemy + PostgreSQL |
| Parent Contact | Flask + Twilio + PostgreSQL |
| Document Processing | Flask + PyMuPDF + PaddleOCR + Celery |
| NLP/RAG | Flask + sentence-transformers (BGE-M3) + Qdrant + OpenAI/Ollama |
| Prediction | Flask + scikit-learn (RandomForest) + XGBoost |
| Task Queue | Celery + Redis |
| Databases | PostgreSQL · MongoDB · Qdrant (vector) |
| Container | Docker + Docker Compose |

---

## Team
Department of Computer Science & Engineering
B.E. CSE — Z10 Batch — 2025–26

*Built as a Final Year Mini-Project*
"# AccredationPlatform" 
