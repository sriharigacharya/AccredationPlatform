# AcademiQ Platform — Feature Inventory & Test Matrix

**Document Purpose:** Living audit artifact tracking every page, feature, endpoint, RBAC permission, and verification status across the AcademiQ platform.
**Baseline Date:** 2026-09-14
**Status Taxonomy:** `passing` | `partially working` | `failing` | `blocked` | `untested`

---

## 1. Auth & Session Management

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| AUTH-01 | `/login` | Email/password credential verification & role-based JWT issuance | Public (all) | `POST /api/v1/auth/login` | passing |
| AUTH-02 | `/login` | Role-based initial route redirect based on server token payload | Authenticated | `POST /api/v1/auth/login` | passing |
| AUTH-03 | Layout / Topbar | Token verification, session hydration (`/auth/me`), and auto-logout on 401 | Authenticated | `GET /api/v1/auth/me` | passing |
| AUTH-04 | User Context | Gateway header injection (`X-User-Id`, `X-User-Role`, `X-Linked-Id`, `X-User-Name`) | All via Gateway | Gateway proxy middleware | passing |
| AUTH-05 | `/settings` | User creation, role reassignment, and account deactivation (Admin only) | Admin | `GET/POST/PUT/DELETE /api/v1/auth/users` | passing |

---

## 2. Role Dashboards

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| DASH-01 | `/dashboard` (Admin) | Institutional overview cards (total students, faculty, pass rate, avg GPA, at-risk count) | Admin | `GET /api/v1/students/stats/overview`, `GET /api/v1/faculty/stats/overview` | passing |
| DASH-02 | `/dashboard` (Teacher) | Assigned class performance summary, today's timetable sessions, pending verifications | Teacher, Admin | `GET /api/v1/classes/my-classes`, `GET /api/v1/timetable/today` | passing |
| DASH-03 | `/my-record` (Student) | Student self-service overview: CGPA/SGPA, course marks, attendance percentage, risk flags | Student | `GET /api/v1/students/:id`, `GET /api/v1/students/:id/analytics` | passing |

---

## 3. Student Master Records & Academics

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| STU-01 | `/students` | Filterable roster of students (by semester, section, department, search query) | Admin, Teacher | `GET /api/v1/students/` | passing |
| STU-02 | `/students` | Single student creation with default curriculum course initialization | Admin, Teacher | `POST /api/v1/students/` | passing |
| STU-03 | `/students/:id` | Student detailed profile: academic metrics, course-wise CIE/SEE breakdown, SGPA | Admin, Teacher | `GET /api/v1/students/:id` | passing |
| STU-04 | `/students/:id` | Student record update (academic metrics, contact info, courses_data matrix) | Admin, Teacher | `PUT /api/v1/students/:id` | passing |
| STU-05 | `/students/:id` | Delete student record (restricted strictly to Administrator) | Admin | `DELETE /api/v1/students/:id` | passing |
| STU-06 | `/students/:id` | Rule-based academic risk evaluation (attendance <75%, backlogs, CIE <50) | Admin, Teacher, Student (own) | `GET /api/v1/students/:id/analytics` | passing |
| STU-07 | `/my-record` | Student read-only isolation: student can only query own linked record | Student | `GET /api/v1/students/:linked_id` | passing |

---

## 4. Faculty Directory & Profile Lifecycle

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| FAC-01 | `/faculty` | Faculty directory listing with department, designation, and teaching allocations | Admin, Teacher | `GET /api/v1/faculty/` | passing |
| FAC-02 | `/faculty` | Create new faculty profile | Admin | `POST /api/v1/faculty/` | passing |
| FAC-03 | `/faculty` | Edit faculty details, courses taught, certifications, and research stats | Admin | `PUT /api/v1/faculty/:id` | passing |
| FAC-04 | `/faculty` | Delete faculty record | Admin | `DELETE /api/v1/faculty/:id` | passing |
| FAC-05 | `/faculty` | Faculty self-service profile update request submission | Teacher | `POST /api/v1/faculty/:id/profile-request` | passing |
| FAC-06 | `/faculty` / Admin | Review, approve, or reject faculty profile update requests with comments | Admin | `POST /api/v1/faculty/profile-requests/:id/action` | passing |
| FAC-07 | `/faculty` | Allocate curriculum courses to faculty coordinator | Admin | `PUT /api/v1/faculty/:id/courses` | passing |

---

## 5. Classes, Continuous Internal Evaluation (CIE) & Lecture Attendance

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| CLS-01 | `/classes` | Teacher assigned classes list with student count and at-risk student tallies | Teacher, Admin | `GET /api/v1/classes/my-classes` | passing |
| CLS-02 | `/classes` | Class student roster listing for a given course and section | Teacher, Admin | `GET /api/v1/classes/:code/:sec/students` | passing |
| CLS-03 | `/classes` | Conduct live daily lecture attendance session (present/absent markings) | Teacher, Admin | `POST /api/v1/classes/:code/:sec/attendance` | passing |
| CLS-04 | `/classes` | View attendance session history for a course and section | Teacher, Admin | `GET /api/v1/classes/:code/:sec/attendance/sessions` | passing |
| CLS-05 | `/classes` | Edit past lecture attendance record with mandatory reason audit comment | Teacher, Admin | `PUT /api/v1/classes/:code/:sec/attendance/sessions/:id` | passing |
| CLS-06 | `/classes` | Exam marks entry (CIE 1, CIE 2, Quiz 1, Quiz 2, EL, SEE) per student | Teacher, Admin | `POST /api/v1/classes/:code/:sec/marks` | passing |
| CLS-07 | `/classes` | Course at-risk alert detector (attendance <75%, low test scores, backlogs) | Teacher, Admin | `GET /api/v1/classes/:code/:sec/risk-alerts` | passing |

---

## 6. Faculty Timetable & Biometric Attendance

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| TIME-01 | `/timetable` | View weekly timetable grid by Faculty, Section, or Room | Admin, Teacher, Student | `GET /api/v1/timetable/meta`, `GET /api/v1/timetable` | passing |
| TIME-02 | `/timetable` | Ingest timetable schedule from JSON master | Admin | `POST /api/v1/timetable/ingest` | passing |
| TIME-03 | `/mock-device` | Physical biometric device emulation: RFID card punch / manual punch | Public | `POST /api/v1/attendance/punch` | passing |
| TIME-04 | `/faculty-attendance`| Live campus roster: who is on campus, who is late, who is on leave | Admin, Teacher | `GET /api/v1/attendance/today` | passing |
| TIME-05 | `/faculty-attendance`| Faculty monthly attendance history & status breakdown | Admin, Teacher | `GET /api/v1/attendance/faculty/:id` | passing |
| TIME-06 | `/faculty-attendance`| Admin manual attendance override / correction | Admin | `POST /api/v1/attendance/manual` | passing |
| TIME-07 | `/faculty-attendance`| Demo biometric state reset | Public / Staff | `POST /api/v1/attendance/reset-demo` | passing |
| TIME-08 | `/faculty-attendance`| Faculty duty-leave / event attendance request with certificate upload | Teacher | `POST /api/v1/attendance/event-requests` | passing |
| TIME-09 | `/faculty-attendance`| Admin verify/reject faculty event attendance request with duty certificate preview | Admin | `POST /api/v1/attendance/event-requests/:id/approve` | passing |

---

## 7. Faculty Leave Management & Substitute Allocation

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| LEAV-01 | Leave Modal | Preview affected timetable classes before submitting leave notice | Teacher, Admin | `POST /api/v1/leave/preview-affected` | passing |
| LEAV-02 | Leave Modal | Submit planned or emergency leave notice with optional substitute faculty | Teacher, Admin | `POST /api/v1/leave` | passing |
| LEAV-03 | Leave Modal | Automated notification dispatch to enrolled students when class is cancelled | System / Teacher | `GET /api/v1/notifications/schedule` | passing |
| LEAV-04 | Leave Modal | Cancel submitted leave notice (restores regular timetable slots) | Teacher, Admin | `DELETE /api/v1/leave/:id` | passing |
| LEAV-05 | Leave Modal | List active leave notices for a date range | Admin, Teacher | `GET /api/v1/leave` | passing |

---

## 8. Schedule Notifications & Student Alerts

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| NOTIF-01 | App Header / Popover | Fetch student schedule cancellation & duty attendance notifications | Student | `GET /api/v1/notifications/student/:id` | passing |
| NOTIF-02 | App Header / Popover | Unread notifications badge count | Student | `GET /api/v1/notifications/schedule/unread-count` | passing |
| NOTIF-03 | App Header / Popover | Mark single notification as read | Student | `PATCH /api/v1/notifications/schedule/:id/read` | passing |
| NOTIF-04 | App Header / Popover | Mark all student notifications as read | Student | `POST /api/v1/notifications/schedule/mark-all-read` | passing |

---

## 9. Assignments & Submissions

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| ASGN-01 | `/assignments` | List assignments (faculty sees created; student sees assigned courses) | Admin, Teacher, Student | `GET /api/v1/assignments/` | passing |
| ASGN-02 | `/assignments` | Create assignment with deadline, target section/course, and file attachment | Teacher, Admin | `POST /api/v1/assignments/` | passing |
| ASGN-03 | `/assignments` | Student submission of assignment (file upload or text solution) | Student | `POST /api/v1/assignments/:id/submit` | passing |
| ASGN-04 | `/assignments` | View submission roster for an assignment with submission timestamps | Teacher, Admin | `GET /api/v1/assignments/:id/submissions` | passing |
| ASGN-05 | `/assignments` | Grade assignment submission and award marks | Teacher, Admin | `PUT /api/v1/assignments/submissions/:id/grade` | passing |
| ASGN-06 | `/assignments` | Delete assignment | Teacher, Admin | `DELETE /api/v1/assignments/:id` | passing |

---

## 10. Clubs & Student Role Allocation

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| CLUB-01 | `/events` (Clubs tab) | List department and institutional clubs with mentors and active members | All Authenticated | `GET /api/v1/clubs/` | passing |
| CLUB-02 | `/events` (Clubs tab) | Create new student club | Admin | `POST /api/v1/clubs/` | passing |
| CLUB-03 | `/events` (Clubs tab) | Assign club roles to students (`head`, `treasurer`, `council`, `member`) | Admin | `POST /api/v1/student-roles/` | passing |
| CLUB-04 | `/events` (Clubs tab) | Remove or update student club role | Admin | `DELETE/POST /api/v1/student-roles/` | passing |
| CLUB-05 | `/events` (Clubs tab) | Query student club leadership role for event submission authorization | Student, Teacher | `GET /api/v1/student-roles/` | passing |

---

## 11. Event Lifecycle Management (NBA Criterion 4 & Criterion 5)

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| EVT-01 | `/events` | Event proposal submission with budget, objectives, venue, and banner | Club Head, Teacher, Admin | `POST /api/v1/events/` | passing |
| EVT-02 | `/events` | Faculty mentor approval/rejection queue for club events | Teacher, Admin | `POST /api/v1/events/:id/mentor-approve` | passing |
| EVT-03 | `/events` | Admin institutional approval/rejection queue | Admin | `POST /api/v1/events/:id/admin-approve` | passing |
| EVT-04 | `/events` | Student self-registration and deregistration for upcoming approved events | Student | `POST /api/v1/events/:id/register`, `unregister` | passing |
| EVT-05 | `/events` | Post-event completion report submission with actual attendance & expenditures | Club Head, Teacher, Admin | `POST /api/v1/events/:id/complete` | passing |
| EVT-06 | `/events` | High-resolution event photos upload and gallery view | Club Head, Teacher, Admin | `POST/GET /api/v1/events/:id/photos` | passing |
| EVT-07 | `/events` | Attendance award engine: credit attendee class attendance for overlapped timetable slots | Teacher, Admin | `POST /api/v1/events/:id/award-attendance` | passing |
| EVT-08 | `/events` | Audit log of awarded duty attendance credits per student | Teacher, Admin | `GET /api/v1/events/:id/awards` | passing |
| EVT-09 | `/events` | Event Summary Sheet generation (NBA Criterion 4.6.2 / Criterion 5.3 compliance) | Admin, Teacher | `GET /api/v1/events/:id/summary-sheet` | passing |

---

## 12. Student Placements & Higher Education

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| PLC-01 | `/my-record` | Student placement submission (company, CTC, role, offer letter upload) | Student | `POST /api/v1/profile/placement` | passing |
| PLC-02 | `/students/:id` | Admin/Faculty view of student placement details & offer letter download | Admin, Teacher | `GET /api/v1/placements/` | passing |
| PLC-03 | Placement Review | Admin verify/unverify placement offer with audit status | Admin | `PATCH /api/v1/placements/:id/verify` | passing |
| PLC-04 | Placement Analytics | Aggregate placement statistics (mean CTC, median CTC, placement ratio) | Admin, Teacher | `GET /api/v1/placements/summary` | passing |

---

## 13. Student Achievements (External Competitions & Hackathons)

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| ACH-01 | `/my-record` | Student self-submission of external hackathons, technical, or sports prize | Student | `POST /api/v1/student-achievements` | passing |
| ACH-02 | `/my-record` | Multi-student team attribution for external competition entries | Student, Admin | `POST /api/v1/student-achievements` | passing |
| ACH-03 | `/admin-review` | Faculty/Admin verification queue: approve external achievement with certificate | Teacher, Admin | `PATCH /api/v1/student-achievements/:id/verify` | passing |
| ACH-04 | `/admin-review` | Faculty/Admin rejection with feedback remarks (unverified achievements) | Teacher, Admin | `PATCH /api/v1/student-achievements/:id/reject` | passing |
| ACH-05 | Criterion 4 | NBA Criterion 4 (Section 4.6.3) achievements table generation by academic year | Admin, Teacher | `GET /api/v1/student-achievements/nba-report` | passing |

---

## 14. Historical Criterion 4 Data (Admissions, Batches, Academic Performance)

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| HIST-01 | `/historical-data` | Criterion 4.1 Admission Records template download and CSV bulk import | Worker, Admin | `POST /api/v1/admission-records/bulk-import` | passing |
| HIST-02 | `/historical-data` | Criterion 4.2 Academic Batches & Progression bulk import (sanctioned/admitted) | Worker, Admin | `POST /api/v1/academic-batches/bulk-import` | passing |
| HIST-03 | `/historical-data` | Criterion 4.3/4.4 Academic Performance Index bulk import (API/SI metrics) | Worker, Admin | `POST /api/v1/academic-performance/bulk-import` | passing |
| HIST-04 | `/historical-data` | Role workflow: Worker imports save as `pending`; Admin imports save as `verified` | Worker, Admin | API route handler logic | passing |
| HIST-05 | `/historical-data` | Admin verify/reject queue for historical worker submissions | Admin | `POST /api/v1/admission-records/:id/verify` | passing |
| HIST-06 | `/historical-data` | Atomic all-or-nothing rollback on CSV syntax or schema validation failure | Worker, Admin | API bulk import validator | passing |

---

## 15. Real Student Data Import (Historical 270-Cohort Pipeline)

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| IMP-01 | CLI / Scripts | Parse raw `Student_Master_Data.xlsx` into normalized CSVs via `transform.py` | Data Worker, Admin | Offline python script | passing |
| IMP-02 | CLI / Scripts | Validate 270 students, 297 course assessments, 77 attendance rows against schema | Data Worker, Admin | `load_student_data.py` | passing |
| IMP-03 | CLI / Backend | Idempotent bulk ingestion of validated student records into `academic-data-service` | Data Worker, Admin | Ingestion loader / route | passing |
| IMP-04 | DB Model | Null-safety in SGPA/SAR calculations when SEE/credits are in progress | System / All | `Student.compute_sgpa()` | passing |

---

## 16. Parent Contact & Outreach (DPDP Compliant)

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| CONT-01 | `/contact` | View parent contact details with DPDP masking for faculty (unmasked for Admin) | Teacher, Admin | `GET /api/v1/parents/:student_id` | passing |
| CONT-02 | `/contact` | Create or update parent record and contact preferences | Teacher, Admin | `POST /api/v1/parents/` | passing |
| CONT-03 | `/contact` | Initiate voice call to parent (Twilio proxy masking / mock mode) | Teacher, Admin | `POST /api/v1/contact/call` | passing |
| CONT-04 | `/contact` | Send urgent SMS notification regarding attendance shortage or academic alert | Teacher, Admin | `POST /api/v1/contact/sms` | passing |
| CONT-05 | `/contact` | Consent verification guard: blocked outreach if `consent_to_contact` is false | System / Staff | `POST /api/v1/contact/call` | passing |
| CONT-06 | `/contact` | Contact activity audit log tracking caller, timestamp, status, and call SID | Admin, Teacher | `GET /api/v1/contact/log` | passing |

---

## 17. Document Repository & OCR Ingestion

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| DOC-01 | `/documents` | List uploaded accreditation documents, SAR files, and course dossiers | All Authenticated | `GET /api/v1/documents/` | passing |
| DOC-02 | `/documents` | Upload PDF/DOCX/image with document type categorization (`SAR`, `FDP`, `placement`)| Admin, Teacher, Worker | `POST /api/v1/documents/upload` | passing |
| DOC-03 | `/documents` | Asynchronous Celery OCR job status polling (`queued`, `processing`, `done`) | Admin, Teacher, Worker | `GET /api/v1/documents/job/:job_id` | passing |
| DOC-04 | `/documents` | View single document metadata & processing chunk count | Admin, Teacher, Worker | `GET /api/v1/documents/:id` | passing |
| DOC-05 | `/documents` | Delete uploaded document and purge vector embeddings | Admin, Worker | `DELETE /api/v1/documents/:id` | passing |

---

## 18. NLP RAG Chatbot & Semantic Corpus Q&A

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| RAG-01 | `/chat` | Conversational document Q&A grounded on institutional accreditation corpus | Teacher, Admin | `POST /api/v1/rag/query` | passing |
| RAG-02 | `/chat` | Multi-source attribution returning citations, document type, and similarity score | Teacher, Admin | `POST /api/v1/rag/query` | passing |
| RAG-03 | `/chat` | Document text summarization endpoint | Teacher, Admin | `POST /api/v1/rag/summarize` | passing |
| RAG-04 | Security | RBAC isolation: Student and Worker roles strictly denied access to RAG endpoints | Student, Worker (403) | Gateway + RAG route guard | passing |

---

## 19. ML Retention & Pass/Fail Prediction

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| PRED-01 | `/students/:id` | Real-time student pass/fail prediction and risk probability score | Admin, Teacher, Student (own) | `POST /api/v1/predict/student` | passing |
| PRED-02 | Prediction Engine | Feature importance attribution (identifies whether attendance, GPA, or CIE drives risk)| Admin, Teacher | `POST /api/v1/predict/student` | passing |
| PRED-03 | Batch Analytics | Cohort-wide batch risk screening for early academic intervention | Admin, Teacher | `POST /api/v1/predict/batch` | passing |
| PRED-04 | Model Ops | Re-train Random Forest prediction model on refreshed historical data | Admin | `POST /api/v1/predict/train` | passing |

---

## 20. NBA SAR Report Generation (Criterion 4 & Criterion 5)

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| REP-01 | `/reports` | Dynamic criteria discovery from modular SAR tree (`ug_tier_ii_gapc_v4`) | Teacher, Admin, Worker | `GET /api/v1/criteria` | passing |
| REP-02 | `/reports` | Generate official NBA SAR Criterion 4 report (Tables 4.1 to 4.6) | Teacher, Admin | `POST /api/v1/reports/nba/generate` | passing |
| REP-03 | `/reports` | Export report to PDF and Microsoft Word DOCX formats | Teacher, Admin | `GET /api/v1/reports/:id/download` | passing |
| REP-04 | `/reports` | Historical report jobs listing and download history | Teacher, Admin | `GET /api/v1/reports/history` | passing |
| REP-05 | Isolation Guard | SAR generation isolation: shares zero models, prompt templates, or schemas with Adhoc AI | System / All | Architectural constraint | passing |

---

## 21. General AI Report Builder & Dossier Generator

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| GEN-01 | `/reports` | Ad-hoc free-text institutional report grounded in RAG document embeddings | Teacher, Admin | `POST /api/v1/reports/adhoc` | passing |
| GEN-02 | `/reports` | Individual Student Academic Dossier report generation | Teacher, Admin | `POST /api/v1/reports/student` | passing |
| GEN-03 | `/reports` | Faculty Appraisal & Teaching Performance Dossier generation | Teacher, Admin | `POST /api/v1/reports/faculty` | passing |
| GEN-04 | `/reports` | Event Detailed Summary Sheet compilation with photo attachments | Teacher, Admin | `GET /api/v1/reports/clubs-activities/summary-sheets` | passing |

---

## 22. Admin Review Queue & Institutional Settings

| Feature ID | Page/Module | Description | Roles That Can Access It | Backend Endpoint(s) Called | Current Status |
|---|---|---|---|---|---|
| REV-01 | `/settings` | Centralized pending verification queue across all modules | Admin | `GET /api/v1/admin-review/` | passing |
| REV-02 | `/settings` | Approve / reject pending faculty profile updates, attendance changes, warnings | Admin | `POST /api/v1/admin-review/:type/:id/action` | passing |
| REV-03 | `/settings` | Timetable subject code legend review and ambiguity resolution | Admin | `GET/PUT /api/v1/admin-review/legend` | passing |
| REV-04 | `/settings` | Ingestion warnings viewer for timetable room conflicts and unmapped faculty | Admin | `GET/PUT /api/v1/admin-review/warnings` | passing |

---
