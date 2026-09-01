"""
Generate an executive, publication-grade HTML document and render it to a PDF via Microsoft Edge.
"""

import os
import subprocess
from pathlib import Path

WORKSPACE = Path(r"c:\Users\sriha\OneDrive\Documents\GitHub\College\AccredationPlatform")
HTML_OUTPUT = WORKSPACE / "AcademiQ_Architecture_and_Features.html"
PDF_OUTPUT = WORKSPACE / "AcademiQ_Platform_Overview_and_Features.pdf"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AcademiQ — AI-Powered Academic Intelligence & Accreditation Platform</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  @page {
    size: A4 portrait;
    margin: 18mm 16mm 20mm 16mm;
    @top-right {
      content: "AcademiQ Platform Architecture & Features Guide";
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-right {
      content: "Page " counter(page);
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-left {
      content: "B.E. CSE Final Year Project • Confidential & Proprietary";
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #94a3b8;
    }
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    line-height: 1.55;
    font-size: 9.8pt;
    margin: 0;
    padding: 0;
  }

  /* Cover Page */
  .cover-page {
    page-break-after: always;
    min-height: 90vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 30px 20px 20px 20px;
    border-bottom: 3px solid #3b82f6;
  }

  .cover-badge {
    display: inline-block;
    background: linear-gradient(135deg, #1e3a8a, #3b82f6);
    color: #ffffff;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 20px;
    margin-bottom: 20px;
  }

  .cover-title {
    font-size: 28pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.15;
    margin: 0 0 10px 0;
    letter-spacing: -0.5px;
  }

  .cover-subtitle {
    font-size: 13pt;
    font-weight: 500;
    color: #475569;
    margin: 0 0 25px 0;
    line-height: 1.4;
  }

  .cover-divider {
    height: 4px;
    width: 80px;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    border-radius: 2px;
    margin-bottom: 30px;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px;
    margin-top: 20px;
  }

  .meta-item {
    font-size: 9pt;
  }

  .meta-label {
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.5px;
  }

  .meta-value {
    color: #0f172a;
    font-weight: 600;
    margin-top: 2px;
  }

  .cover-abstract {
    background: #eff6ff;
    border-left: 4px solid #3b82f6;
    padding: 16px 20px;
    border-radius: 0 8px 8px 0;
    margin-top: 30px;
    font-size: 9.5pt;
    color: #1e3a8a;
    line-height: 1.6;
  }

  /* Section Styling */
  .section {
    margin-top: 28px;
    page-break-inside: avoid;
  }

  .page-break {
    page-break-before: always;
  }

  h1 {
    font-size: 16pt;
    font-weight: 800;
    color: #0f172a;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 24px;
    margin-bottom: 14px;
    letter-spacing: -0.3px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  h1::before {
    content: "";
    display: inline-block;
    width: 6px;
    height: 18px;
    background: #3b82f6;
    border-radius: 3px;
  }

  h2 {
    font-size: 12pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 18px;
    margin-bottom: 8px;
  }

  h3 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #334155;
    margin-top: 14px;
    margin-bottom: 6px;
  }

  p {
    margin: 0 0 10px 0;
    color: #334155;
  }

  ul, ol {
    margin: 0 0 12px 0;
    padding-left: 20px;
    color: #334155;
  }

  li {
    margin-bottom: 4px;
  }

  /* Card Grid */
  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin: 12px 0;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 12px 0;
  }

  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 10px 0;
  }

  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 14px;
    page-break-inside: avoid;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .card-title {
    font-weight: 700;
    font-size: 10pt;
    color: #0f172a;
  }

  .card-port {
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    background: #e0e7ff;
    color: #3730a3;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }

  .card-body {
    font-size: 8.8pt;
    color: #475569;
    line-height: 1.45;
  }

  /* Callout Boxes */
  .callout {
    padding: 12px 16px;
    border-radius: 6px;
    margin: 12px 0;
    font-size: 9pt;
    line-height: 1.5;
    page-break-inside: avoid;
  }

  .callout-info {
    background-color: #eff6ff;
    border-left: 4px solid #3b82f6;
    color: #1e40af;
  }

  .callout-success {
    background-color: #f0fdf4;
    border-left: 4px solid #22c55e;
    color: #15803d;
  }

  .callout-warning {
    background-color: #fffbeb;
    border-left: 4px solid #f59e0b;
    color: #b45309;
  }

  .callout-purple {
    background-color: #faf5ff;
    border-left: 4px solid #a855f7;
    color: #6b21a8;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 8.8pt;
    page-break-inside: avoid;
  }

  th {
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
    text-align: left;
    padding: 7px 10px;
    border: 1px solid #cbd5e1;
    font-size: 8.5pt;
  }

  td {
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
    color: #334155;
    vertical-align: top;
  }

  tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  /* Code / Pre */
  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.2pt;
    background-color: #f1f5f9;
    color: #0f172a;
    padding: 1.5px 4px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  pre {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    background-color: #0f172a;
    color: #e2e8f0;
    padding: 12px;
    border-radius: 6px;
    overflow-x: hidden;
    line-height: 1.4;
    margin: 10px 0;
    page-break-inside: avoid;
  }

  /* Tags & Badges */
  .badge {
    display: inline-block;
    font-size: 7.5pt;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 12px;
    margin-right: 4px;
  }

  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-purple { background: #f3e8ff; color: #6b21a8; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-rose { background: #ffe4e6; color: #9f1239; }

  /* Diagram Box */
  .diagram-container {
    background: #0f172a;
    color: #38bdf8;
    padding: 14px;
    border-radius: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.8pt;
    line-height: 1.35;
    margin: 14px 0;
    page-break-inside: avoid;
  }

  .highlight-metric {
    font-weight: 700;
    color: #0284c7;
  }

  .flow-step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
  }

  .flow-number {
    background: #3b82f6;
    color: white;
    font-weight: 700;
    font-size: 8pt;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover-page">
  <div>
    <span class="cover-badge">Academic Intelligence & Accreditation System</span>
    <h1 class="cover-title">AcademiQ Platform</h1>
    <div class="cover-subtitle">AI-Powered Unified Academic Intelligence, Accreditation Automation (NBA Tier-II GAPC V4.0), and Predictive Student Analytics</div>
    <div class="cover-divider"></div>

    <div class="cover-abstract">
      <strong>Executive Overview:</strong> AcademiQ is a comprehensive, production-ready microservices platform engineered to modernize higher education administration. It unifies outcome-based education (OBE) tracking, automated Self-Assessment Report (SAR) compilation for NBA accreditation, intelligent document OCR and RAG querying, real-time ML-driven student risk intervention, and DPDP Act-compliant privacy-first parent communications.
    </div>

    <div class="cover-meta-grid">
      <div class="meta-item">
        <div class="meta-label">Project Type</div>
        <div class="meta-value">B.E. Computer Science & Engineering (Final Year Project)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Academic Batch</div>
        <div class="meta-value">Z10 Batch · Academic Year 2025–2026</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Accreditation Standard</div>
        <div class="meta-value">NBA UG Tier-II GAPC V4.0 (1000 Marks Framework)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Core Architecture</div>
        <div class="meta-value">8 Polyglot Microservices + 4 Specialized Databases</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">AI / ML Engine</div>
        <div class="meta-value">Llama 3.1 8B (Groq/Ollama) + BGE-M3 + Random Forest & XGBoost</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Privacy & Regulatory</div>
        <div class="meta-value">DPDP Act 2023 Compliant (Masked Identity + Twilio Proxy Bridge)</div>
      </div>
    </div>
  </div>

  <div style="font-size: 8.5pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between;">
    <span>Department of Computer Science & Engineering</span>
    <span>System Architecture & Technical Manual</span>
  </div>
</div>

<!-- PAGE 1: ARCHITECTURE OVERVIEW -->
<div class="section">
  <h1>1. System Architecture & Topology</h1>
  <p>AcademiQ is designed as an event-driven, decoupled microservices ecosystem. A central API Gateway handles authentication, role-based access control (RBAC), context injection, and reverse-proxy routing to 7 backend domain microservices backed by 4 persistent database stores.</p>

  <div class="diagram-container">
[ React 18 Single-Page Application (Port 3000) ]
                       │
                       ▼  (REST over HTTP + JWT Bearer Token)
[ API Gateway Reverse Proxy (Flask, Port 8000) ] ── (Enforces RBAC & Context Headers)
   │
   ├──▶ Auth Service (Port 8001)           ──▶ [ PostgreSQL (Users & Roles) ]
   ├──▶ Academic Data Service (Port 8002)  ──▶ [ PostgreSQL (Students, Faculty, OBE) ]
   ├──▶ Parent Contact Service (Port 8003) ──▶ [ PostgreSQL + Twilio Telephony Proxy ]
   ├──▶ Document Service (Port 8004)       ──▶ [ MongoDB + Celery OCR Queue + Redis ]
   ├──▶ NLP & RAG Service (Port 8005)      ──▶ [ Qdrant Vector DB + Llama 3.1 8B ]
   ├──▶ Prediction Service (Port 8006)     ──▶ [ Scikit-Learn RF / XGBoost Models ]
   └──▶ Report Generation Service (Port 8007) ──▶ [ NBA SAR Tree Engine + python-docx ]
  </div>

  <h2>Infrastructure & Persistent Storage Layer</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Data Store</th>
        <th style="width: 25%;">Technology</th>
        <th>Role & Managed Entities</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Relational DB</strong></td>
        <td><code>PostgreSQL 16 Alpine</code></td>
        <td>Users, roles, student academic records, faculty profiles, department curricula (PEOs, POs, COs), parent contact data, call logs, and report job statuses.</td>
      </tr>
      <tr>
        <td><strong>Document Store</strong></td>
        <td><code>MongoDB 7.0</code></td>
        <td>Document metadata, parsed text chunks, ingestion status, OCR logs, and unstructured institution artifacts.</td>
      </tr>
      <tr>
        <td><strong>Vector Database</strong></td>
        <td><code>Qdrant v1.9.2</code></td>
        <td>Dense 1024-dimensional vector embeddings generated by <code>BAAI/bge-m3</code> for semantic search and RAG retrieval.</td>
      </tr>
      <tr>
        <td><strong>Message Broker & Cache</strong></td>
        <td><code>Redis 7 Alpine</code></td>
        <td>Task queue backend for Celery asynchronous workers (OCR extraction, document embedding, background report rendering).</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- PAGE 2: MICROSERVICES DIRECTORY -->
<div class="section page-break">
  <h1>2. Microservices Directory & Responsibilities</h1>
  <p>Each service in AcademiQ adheres to single-responsibility design principles with dedicated storage boundaries and well-defined API contracts.</p>

  <div class="grid-2">
    <!-- Service 1 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">1. API Gateway</span>
        <span class="card-port">Port 8000</span>
      </div>
      <div class="card-body">
        <strong>Responsibilities:</strong>
        <ul>
          <li>Single entry point for all frontend client traffic.</li>
          <li>Validates JWT signatures, algorithm, and expiration.</li>
          <li>Fail-closed routing table with network-boundary RBAC.</li>
          <li>Injects user context headers (<code>X-User-Id</code>, <code>X-User-Role</code>, <code>X-Linked-Id</code>).</li>
        </ul>
      </div>
    </div>

    <!-- Service 2 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">2. Auth Service</span>
        <span class="card-port">Port 8001</span>
      </div>
      <div class="card-body">
        <strong>Responsibilities:</strong>
        <ul>
          <li>User registration, login, and profile management.</li>
          <li>Bcrypt password hashing and secure token generation.</li>
          <li>Role assignments (<code>admin</code>, <code>teacher</code>, <code>student</code>, <code>worker</code>).</li>
          <li>Account linking to <code>student_id</code> or <code>faculty_id</code>.</li>
        </ul>
      </div>
    </div>

    <!-- Service 3 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">3. Academic Data Service</span>
        <span class="card-port">Port 8002</span>
      </div>
      <div class="card-body">
        <strong>Responsibilities:</strong>
        <ul>
          <li>Manages department curricula, Vision/Mission, PEOs, POs, COs.</li>
          <li>Maintains 360-degree student profiles (8 academic metrics).</li>
          <li>Stores faculty qualifications, research, and FDP records.</li>
          <li>Supplies raw metrics to the prediction and report services.</li>
        </ul>
      </div>
    </div>

    <!-- Service 4 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">4. Parent Contact Service</span>
        <span class="card-port">Port 8003</span>
      </div>
      <div class="card-body">
        <strong>Responsibilities:</strong>
        <ul>
          <li>Maintains parent contact registry and communication preferences.</li>
          <li>DPDP Act 2023 consent validation before communication.</li>
          <li>Phone number masking for faculty UI (<code>******3210</code>).</li>
          <li>Twilio Proxy integration for bi-directional masked calls/SMS.</li>
        </ul>
      </div>
    </div>

    <!-- Service 5 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">5. Document Service & Worker</span>
        <span class="card-port">Port 8004</span>
      </div>
      <div class="card-body">
        <strong>Responsibilities:</strong>
        <ul>
          <li>Multi-format ingestion: PDF, DOCX, PNG, JPG, TXT.</li>
          <li>Dual-engine OCR: PyMuPDF (digital) + PaddleOCR (scans).</li>
          <li>Sliding window chunking (512 tokens with 50 overlap).</li>
          <li>Celery task dispatch for background asynchronous processing.</li>
        </ul>
      </div>
    </div>

    <!-- Service 6 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">6. NLP & RAG Service</span>
        <span class="card-port">Port 8005</span>
      </div>
      <div class="card-body">
        <strong>Responsibilities:</strong>
        <ul>
          <li>Vector embeddings via <code>BAAI/bge-m3</code> (1024-dim dense).</li>
          <li>Qdrant vector collection indexing and similarity retrieval.</li>
          <li>Context-grounded QA via Llama 3.1 8B (Groq / Ollama).</li>
          <li>Hallucination-free formal narrative generation for SAR.</li>
        </ul>
      </div>
    </div>

    <!-- Service 7 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">7. Prediction Service</span>
        <span class="card-port">Port 8006</span>
      </div>
      <div class="card-body">
        <strong>Responsibilities:</strong>
        <ul>
          <li>Real-time academic risk prediction and failure classification.</li>
          <li>Primary Random Forest pipeline + secondary XGBoost model.</li>
          <li>At-risk cohort filtering and early warning threshold scoring.</li>
          <li>Automated continuous model retraining endpoint.</li>
        </ul>
      </div>
    </div>

    <!-- Service 8 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">8. Report Generation Service</span>
        <span class="card-port">Port 8007</span>
      </div>
      <div class="card-body">
        <strong>Responsibilities:</strong>
        <ul>
          <li>NBA SAR tree compiler for UG Tier-II GAPC V4.0 (1000 marks).</li>
          <li>Autonomous formula engine (SFR, FQI, Cadre, API, Placement).</li>
          <li>LLM-driven narrative expansion from grounded factual bullets.</li>
          <li>Export pipeline for publication-ready DOCX and PDF documents.</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- PAGE 3: FEATURE DEEP DIVE - NBA ACCREDITATION -->
<div class="section page-break">
  <h1>3. Feature Deep-Dive: NBA SAR Accreditation Engine</h1>
  <p>AcademiQ features an implementation of the National Board of Accreditation (NBA) Self-Assessment Report (SAR) framework for <strong>UG Tier-II Engineering (GAPC V4.0 — January 2025 Standard)</strong>. The system models the complete 1000-mark evaluation tree across 9 root criteria, Part C declaration, and 3 annexures.</p>

  <h2>The 1000-Mark Evaluation Framework</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 12%;">Criterion</th>
        <th style="width: 48%;">Official NBA Criteria Title</th>
        <th style="width: 15%;">Max Marks</th>
        <th>Data Source & Calculation Method</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Criterion 1</strong></td>
        <td>Outcome-Based Curriculum (Vision, Mission, PEOs, PO/CO Mapping)</td>
        <td><span class="highlight-metric">120 Marks</span></td>
        <td>Department Curricula + Matrix Tables</td>
      </tr>
      <tr>
        <td><strong>Criterion 2</strong></td>
        <td>Teaching-Learning Processes (Pedagogy, Projects, SDGs, Internships)</td>
        <td><span class="highlight-metric">120 Marks</span></td>
        <td>Manual Records + AI Structured Narratives</td>
      </tr>
      <tr>
        <td><strong>Criterion 3</strong></td>
        <td>Assessment & CO/PO Attainment (Continuous Eval, Direct/Indirect)</td>
        <td><span class="highlight-metric">120 Marks</span></td>
        <td>Formula Engine: <code>co_attainment</code>, <code>po_attainment</code></td>
      </tr>
      <tr>
        <td><strong>Criterion 4</strong></td>
        <td>Students' Performance (Enrolment, Success Rate, API, Placement)</td>
        <td><span class="highlight-metric">120 Marks</span></td>
        <td>Formula Engine: <code>enrolment_ratio</code>, <code>api_year1..3</code>, <code>placement_index</code></td>
      </tr>
      <tr>
        <td><strong>Criterion 5</strong></td>
        <td>Faculty Information (SFR, Cadre Ratio, FQI, Retention)</td>
        <td><span class="highlight-metric">100 Marks</span></td>
        <td>Formula Engine: <code>student_faculty_ratio</code>, <code>faculty_qualification_index</code></td>
      </tr>
      <tr>
        <td><strong>Criterion 6</strong></td>
        <td>Faculty Contributions (FDPs, Research Papers, Patents, Grants)</td>
        <td><span class="highlight-metric">120 Marks</span></td>
        <td>Formula Engine: <code>research_funding_score</code>, <code>consultancy_score</code></td>
      </tr>
      <tr>
        <td><strong>Criterion 7</strong></td>
        <td>Facilities & Technical Support (Laboratories, Ambiance, Safety)</td>
        <td><span class="highlight-metric">100 Marks</span></td>
        <td>Infrastructure Registry + Lab Inventory</td>
      </tr>
      <tr>
        <td><strong>Criterion 8</strong></td>
        <td>Continuous Improvement (Academic Audit, Action Taken on Attainment)</td>
        <td><span class="highlight-metric">80 Marks</span></td>
        <td>OBE Actions + Longitudinal Comparative Trends</td>
      </tr>
      <tr>
        <td><strong>Criterion 9</strong></td>
        <td>Student Support & Governance (Mentoring, Budget, Feedback, FPADS)</td>
        <td><span class="highlight-metric">120 Marks</span></td>
        <td>Formula Engine: <code>first_year_sfr</code> + Governance Records</td>
      </tr>
      <tr style="background-color: #eff6ff; font-weight: 700;">
        <td colspan="2">TOTAL NBA TIER-II EVALUATION SCORE</td>
        <td><span class="highlight-metric" style="color: #1e3a8a;">1000 Marks</span></td>
        <td>Exact Leaf Marks Sum Verified via Assertions</td>
      </tr>
    </tbody>
  </table>

  <h2>Core Mathematical Indices Implemented in Formula Engine</h2>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Student-Faculty Ratio (SFR) — 30 Marks</div>
      <div class="card-body">
        <code>SFR = Total Approved Intake / Total Core Faculty (F)</code><br>
        • Tier-II Marks: SFR &le; 15: 30 marks; 15 &lt; SFR &le; 20: Scaled marks; SFR &gt; 25: 0 marks.
      </div>
    </div>
    <div class="card">
      <div class="card-title">Faculty Qualification Index (FQI) — 25 Marks</div>
      <div class="card-body">
        <code>FQI = 2.5 &times; (10X + 6Y + 4Z) / F</code><br>
        • X = Ph.D., Y = M.Tech/M.E., Z = B.Tech/Others. Scaled to maximum 25 marks.
      </div>
    </div>
    <div class="card">
      <div class="card-title">Academic Performance Index (API) — 30 Marks</div>
      <div class="card-body">
        <code>API = Mean CGPA or % Marks &divide; 10 &times; (Appeared / Successful)</code><br>
        • Evaluated independently across 1st Year (10M), 2nd Year (10M), and 3rd Year (10M).
      </div>
    </div>
    <div class="card">
      <div class="card-title">Placement & Higher Studies Index — 30 Marks</div>
      <div class="card-body">
        <code>Placement Index = (Placed + Higher Studies + Entrepreneurs) / Intake</code><br>
        • Score = 30 &times; Placement Index (averaged over three assessment years).
      </div>
    </div>
  </div>
</div>

<!-- PAGE 4: RAG, PREDICTION & PRIVACY -->
<div class="section page-break">
  <h1>4. AI, Machine Learning & Privacy Technologies</h1>

  <h2>A. Intelligent Document OCR & RAG Knowledge Engine</h2>
  <p>AcademiQ transforms unstructured departmental files (lesson plans, minutes, FDP certificates, inspection guidelines) into a searchable vector knowledge base.</p>
  
  <div class="flow-step">
    <div class="flow-number">1</div>
    <div><strong>Multi-Source Text Ingestion:</strong> Ingestion pipeline processes PDFs, DOCX, and images. Digital PDFs are parsed with PyMuPDF; scanned legacy documents automatically trigger PaddleOCR.</div>
  </div>
  <div class="flow-step">
    <div class="flow-number">2</div>
    <div><strong>Token Chunking:</strong> Documents are partitioned into 512-token chunks with 50-token sliding overlap to preserve boundary context.</div>
  </div>
  <div class="flow-step">
    <div class="flow-number">3</div>
    <div><strong>Dense Embeddings:</strong> The state-of-the-art <code>BAAI/bge-m3</code> model embeds chunks into 1024-dimensional vectors stored inside Qdrant.</div>
  </div>
  <div class="flow-step">
    <div class="flow-number">4</div>
    <div><strong>Hallucination-Restricted Generation:</strong> User queries perform cosine-similarity vector retrieval; the top-K chunks are fed to Llama 3.1 8B with a strict system prompt prohibiting ungrounded assertions.</div>
  </div>

  <h2>B. Predictive Student Risk Modeling (Dropout Intervention)</h2>
  <p>The system actively monitors academic risk indicators to allow pro-active faculty intervention before examinations.</p>
  
  <div class="grid-2">
    <div class="card">
      <div class="card-title">8 Predictive Feature Vector</div>
      <div class="card-body">
        1. <code>semester</code> (1 to 8)<br>
        2. <code>attendance_pct</code> (0–100%)<br>
        3. <code>internal_marks</code> (0–100%)<br>
        4. <code>assignment_score_pct</code> (0–100%)<br>
        5. <code>previous_gpa</code> (0.0–10.0)<br>
        6. <code>backlogs</code> (count of active backlogs)<br>
        7. <code>course_performance_pct</code> (0–100%)<br>
        8. <code>engagement_encoded</code> (Low=0, Med=1, High=2)
      </div>
    </div>
    <div class="card">
      <div class="card-title">Dual Model Pipeline & Retraining</div>
      <div class="card-body">
        • <strong>Random Forest:</strong> 200 trees, <code>class_weight="balanced"</code>, standard scaling pipeline.<br>
        • <strong>XGBoost Classifier:</strong> Gradient boosted decision trees for comparative validation.<br>
        • <strong>Risk Classification:</strong> High (&gt;0.7), Medium (0.4–0.7), Low (&lt;0.4).<br>
        • <strong>Rule Flags:</strong> Auto-flags attendance &lt; 75%, internal marks &lt; 50%, backlogs &ge; 1.
      </div>
    </div>
  </div>

  <h2>C. Privacy-Preserving Parent Communication (DPDP Act 2023)</h2>
  <div class="callout callout-purple">
    <strong>DPDP Act Compliance & Masked Telephony:</strong>
    To protect student and guardian privacy under the Digital Personal Data Protection (DPDP) Act:
    <ul>
      <li><strong>Identity Masking:</strong> Teachers only see masked phone numbers (e.g., <code>*****3210</code>) on screen.</li>
      <li><strong>Twilio Proxy Bridge:</strong> Initiating a call routes through a Twilio cloud proxy. Neither the teacher nor the parent sees the other party's real personal phone number.</li>
      <li><strong>Explicit Consent Workflow:</strong> Parent communication preferences (Call / SMS / WhatsApp) and consent flags (<code>consent_to_contact=True</code>) are verified before outbound requests.</li>
    </ul>
  </div>
</div>

<!-- PAGE 5: ROLE-BASED ACCESS & FRONTEND -->
<div class="section page-break">
  <h1>5. Security, Roles & User Interfaces</h1>

  <h2>Role-Based Access Control (RBAC) Matrix</h2>
  <p>Permissions are strictly enforced at the API Gateway network boundary via a fail-closed routing table:</p>

  <table>
    <thead>
      <tr>
        <th>Platform Feature / Route</th>
        <th style="text-align: center;">Admin</th>
        <th style="text-align: center;">Faculty (Teacher)</th>
        <th style="text-align: center;">Student</th>
        <th style="text-align: center;">Data Worker</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Executive Dashboard & Institutional Analytics</td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
      </tr>
      <tr>
        <td>Student Records & Risk Predictive Profiling</td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-amber">Self Only</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
      </tr>
      <tr>
        <td>Parent Contact System & Masked Calling</td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
      </tr>
      <tr>
        <td>Document Upload, OCR & Digitization</td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
        <td style="text-align: center;"><span class="badge badge-green">Upload Only</span></td>
      </tr>
      <tr>
        <td>RAG Intelligent Assistant Chat</td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
      </tr>
      <tr>
        <td>NBA SAR Generation & DOCX/PDF Export</td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-green">Full</span></td>
        <td style="text-align: center;"><span class="badge badge-amber">History Only</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
      </tr>
      <tr>
        <td>ML Model Retraining & User Management</td>
        <td style="text-align: center;"><span class="badge badge-green">Admin Only</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
        <td style="text-align: center;"><span class="badge badge-rose">Denied</span></td>
      </tr>
    </tbody>
  </table>

  <h2>Frontend Pages & User Experience (React 18 + Vite)</h2>
  <div class="grid-3">
    <div class="card">
      <div class="card-title">1. DashboardPage</div>
      <div class="card-body">High-level institutional overview, department KPIs, student distribution, risk alert counters, and quick actions.</div>
    </div>
    <div class="card">
      <div class="card-title">2. StudentsPage</div>
      <div class="card-body">Searchable, filterable student roster with section breakdown, attendance charts, and risk level indicators.</div>
    </div>
    <div class="card">
      <div class="card-title">3. StudentProfilePage</div>
      <div class="card-body">Comprehensive student dossier with radar charts, internal marks history, ML predictions, and parent details.</div>
    </div>
    <div class="card">
      <div class="card-title">4. FacultyPage</div>
      <div class="card-body">Faculty profiles, designation, qualifications, research publications, awards, and FDP certifications.</div>
    </div>
    <div class="card">
      <div class="card-title">5. DocumentsPage</div>
      <div class="card-body">Drag-and-drop document uploader, OCR processing queue, classification tags, and status monitoring.</div>
    </div>
    <div class="card">
      <div class="card-title">6. RAGChatPage</div>
      <div class="card-body">Conversational AI interface with document citations, question suggestions, and context transparency.</div>
    </div>
    <div class="card">
      <div class="card-title">7. ContactPage</div>
      <div class="card-body">Guardian contact interface with masked numbers, consent checks, call triggering, and SMS history.</div>
    </div>
    <div class="card">
      <div class="card-title">8. ReportsPage</div>
      <div class="card-body">NBA SAR report generator (full/criterion/subcriterion scope), AI narrative toggles, and direct PDF/DOCX downloads.</div>
    </div>
    <div class="card">
      <div class="card-title">9. MyRecordPage</div>
      <div class="card-body">Dedicated student portal showing personal CGPA, attendance alerts, course progress, and academic flags.</div>
    </div>
  </div>
</div>

<!-- PAGE 6: SUMMARY & KEY HIGHLIGHTS -->
<div class="section page-break">
  <h1>6. Key Innovations & Project Impact Summary</h1>

  <div class="callout callout-success">
    <strong>Key Project Takeaways:</strong>
    <ul>
      <li><strong>100% Automated NBA SAR Workflow:</strong> Replaces months of manual document collation and spreadsheet formulas with instant, standardized SAR generation compliant with NBA Tier-II GAPC V4.0.</li>
      <li><strong>Early Student Intervention:</strong> Leverages dual ML models to identify struggling students early in the semester, enabling timely faculty mentoring.</li>
      <li><strong>Secure Document Intelligence:</strong> Combines local/cloud LLMs with vector search and dual-engine OCR to unlock institutional memory from siloed PDFs.</li>
      <li><strong>Privacy by Design:</strong> Implements modern DPDP Act compliance through data masking and telephone proxy infrastructure.</li>
      <li><strong>Enterprise Microservice Engineering:</strong> Demonstrates high modularity, automated seeding, fail-closed gateway security, and Docker container orchestration.</li>
    </ul>
  </div>

  <h2>System Deployment & Specifications</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 30%;">Component</th>
        <th>Specification / Recommendation</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Container Orchestration</strong></td>
        <td><code>Docker Compose v2</code> (11 containers across bridge network <code>academiq-net</code>)</td>
      </tr>
      <tr>
        <td><strong>Memory Footprint</strong></td>
        <td>8 GB RAM (Groq cloud LLM) or 16 GB RAM (Ollama local Llama 3.1 8B)</td>
      </tr>
      <tr>
        <td><strong>Storage Footprint</strong></td>
        <td>~5 GB Docker images + 580 MB BGE-M3 model weights</td>
      </tr>
      <tr>
        <td><strong>Quick Start Command</strong></td>
        <td><code>docker-compose up --build</code> (One-click launch with auto-seeded demo data)</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 40px; text-align: center; border-top: 2px solid #e2e8f0; padding-top: 15px; font-size: 9pt; color: #64748b;">
    <strong>AcademiQ Platform</strong> — Developed by B.E. CSE Z10 Batch (2025–2026)<br>
    Final Year Project Demonstration & Architecture Guide
  </div>
</div>

</body>
</html>
"""

# 1. Write HTML file
with open(HTML_OUTPUT, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"[1/2] Wrote HTML to: {HTML_OUTPUT}")

# 2. Render to PDF via Headless Edge
cmd = [
    EDGE_EXE,
    "--headless",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    "--no-pdf-header-footer",
    f"--print-to-pdf={PDF_OUTPUT}",
    str(HTML_OUTPUT)
]

print("[2/2] Running Edge headless PDF conversion...")
result = subprocess.run(cmd, capture_output=True, text=True)

if PDF_OUTPUT.exists() and PDF_OUTPUT.stat().st_size > 0:
    print(f"[SUCCESS] PDF successfully created at: {PDF_OUTPUT} ({PDF_OUTPUT.stat().st_size} bytes)")
else:
    print(f"[ERROR] PDF generation failed. Stderr: {result.stderr}, Stdout: {result.stdout}")
