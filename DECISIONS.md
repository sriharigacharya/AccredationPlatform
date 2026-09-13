# Architectural & Technical Decisions Log (DECISIONS.md)

This log documents every meaningful architectural and technical decision made across the AcademiQ platform — capturing the context, alternatives considered, the chosen approach, and accepted tradeoffs.

---

## Decision 1: Attendance Status Representation for Event On-Duty Days

### Context
When a faculty member attends an external academic event (workshop, conference, FDP, seminar) or completes a certified course on a working college day, they are physically off-campus and do not swipe the biometric kiosk. The prompt requires that upon administrative review of their uploaded certificate proof, *"attendence for that day must be granted"*.

### Alternatives Considered
1. **New Status Enum (`ON_DUTY` or `OD`)**:
   - *Pros*: Distinct classification in the database indicating off-campus sanctioned presence.
   - *Cons*: Throughout the codebase (`routes/attendance.py`, `general_report_builder.py`, `FacultyAttendancePage.jsx`), attendance metrics, percentages, and summaries calculate attendance using:
     ```python
     present_days = sum(1 for r in records if r.status in ["PRESENT", "LATE"])
     attendance_pct = round((present_days / total_days * 100), 1)
     ```
     Introducing `ON_DUTY` as a distinct status would require retrofitting every attendance calculation, report generator, and dashboard widget to include `ON_DUTY` in the numerator. Any missed check would erroneously count the faculty as absent or non-attending.
2. **Standard Status (`PRESENT`) with Audited Biometric Events (`source="EVENT_ATTENDANCE"`)**:
   - *Pros*: Instantly credits the teacher with 100% daily attendance (480 minutes / 8 hours), maintains zero breakage across all existing percentage calculations, accreditation dossier builders, and monthly summary metrics.
   - *Cons*: Must be clearly traceable in audit events so it's distinguishable from a physical kiosk swipe.

### Decision
Adopt **Alternative 2 (`status = "PRESENT"`)** backed by explicit audit telemetry:
- `FacultyDailyAttendance.status` is set to `"PRESENT"`.
- `FacultyDailyAttendance.work_duration_minutes` is set to `480` (8 standard hours).
- Two `AttendanceEvent` records are inserted (`IN` at 09:00, `OUT` at 17:00) with:
  - `device_id = "EVENT-APPROVAL"`
  - `source = "EVENT_ATTENDANCE"`
  - `admin_note = "Granted via Event Attendance Approval: {course_name} ({organizer})"`
- In `recompute_daily_attendance`, an explicit check intercepts dates with approved `TeacherEventAttendanceRequest` records so background reconciliations or midnight jobs never overwrite the granted `PRESENT` status with `ABSENT`.

---

## Decision 2: Storage and Format of Faculty Profile Certifications

### Context
Upon admin approval of an event attendance request, the course/credential must *"automatically be added to teachers certifications"*.

### Alternatives Considered
1. **Migrate `Faculty.certifications` to a Relational Child Table (`faculty_certifications`)**:
   - *Pros*: Highly structured schema with foreign keys, timestamps, and credential IDs.
   - *Cons*: `Faculty.certifications` is already deeply ingrained across multiple microservices:
     - `models.py`: `certifications = db.Column(db.Text)` (JSON list).
     - `routes/faculty.py`: Serializes and deserializes JSON lists.
     - `report-service`: Parses `certifications` as a JSON array of strings for Criterion 5 tables.
     - `FacultyPage.jsx`: Renders `f.certifications` as an array of string items.
     Migrating to a separate relational table would break backward compatibility across multiple microservices and existing seeded databases.
2. **Retain JSON Array of Strings with Standardized Serialization**:
   - *Pros*: 100% backward compatible with existing UI components, export pipelines, and API contracts.
   - Format: `"{course_name} — {organizer} ({year})"` (or `"{course_name} ({year})"`) matches the existing seed format (e.g. `"NPTEL Online Certification — Machine Learning 2023"`).
   - Duplicate prevention is easily handled by substring / case-insensitive check prior to appending.

### Decision
Adopt **Alternative 2 (Standardized JSON string array in `Faculty.certifications`)**.
When approved:
1. `Faculty.certifications` is parsed from JSON.
2. The credential title is synthesized as `f"{course_name} — {organizer} ({event_date.strftime('%Y')})"` if an organizer exists, or `f"{course_name} ({event_date.strftime('%Y')})"`.
3. If not already present in the list, it is appended and saved back as a JSON string.
4. The relational entity `TeacherEventAttendanceRequest` retains the rich metadata, start/end times, original filename, and stored certificate URL for deep inspection and audit trails.

---

## Decision 3: Certificate Proof Storage and File Handling

### Context
Teachers must upload certificate proof (date, time, and course). The admin must be able to view/review the certificate uploaded by the teacher.

### Alternatives Considered
1. **Store in Database as BLOBs**:
   - *Pros*: Centralized inside the database; atomic backups.
   - *Cons*: Bloats SQLite and PostgreSQL database files; degrades query performance and increases memory usage when listing records.
2. **Store in External Object Storage (AWS S3 / MinIO)**:
   - *Pros*: Scalable, decoupled storage.
   - *Cons*: Requires external cloud credentials or running a MinIO container, which adds complexity and friction for local and offline test runs.
3. **Dedicated Local Directory with Secure Hash-Prefixed Filenames**:
   - *Pros*: Zero external dependencies, fast streaming via Flask's `send_from_directory`, and identical to the architecture already used for `event_uploads` and `achievement_uploads`.

### Decision
Adopt **Alternative 3 (`backend/academic-data-service/attendance_proofs/`)**:
- Files are saved with unique, secure filenames:
  `f"cert_{faculty_id}_{event_date}_{uuid.hex[:8]}{ext}"`
- Only verified extensions are permitted: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`.
- Files are served via `GET /attendance/proofs/<filename>` with proper MIME detection, enabling in-browser inline rendering without forced downloads.

---

## Decision 4: Document Viewer Strategy in the Frontend

### Context
Admins must inspect the certificate proof (which can be a multi-page PDF or a scanned image/photo).

### Alternatives Considered
1. **Third-Party PDF Library (`react-pdf` / `pdfjs-dist`)**:
   - *Pros*: Highly customizable canvas rendering.
   - *Cons*: Adds ~1.2 MB to the frontend production bundle; introduces worker script configuration overhead in Vite; can fail in restricted iframe sandboxes.
2. **Native Browser `<iframe />` for PDFs and Responsive Zoomable `<img />` for Images**:
   - *Pros*: Zero additional bundle weight, leverages native browser hardware acceleration for PDF zooming, searching, and pagination, completely responsive.
   - *Cons*: Minor visual differences between browser PDF engines (Chrome PDF Viewer vs Firefox PDF Viewer).

### Decision
Adopt **Alternative 2 (Native `<iframe />` + Image Viewer in `CertificateViewerModal.jsx`)**:
- Clean split-screen interface:
  - Left panel: Event metadata, teacher details, duration, approval workflow, and admin remarks input.
  - Right panel: High-resolution preview (PDF iframe with native zoom/scroll or responsive image container).
- Provides an "Open in New Tab" escape hatch for maximum user flexibility.

---

## Decision 5: API Gateway Proxying Strategy for Certificate Proofs

### Context
The React frontend connects to `http://localhost:8000/api/v1`, which proxies requests to downstream microservices based on `ROUTE_TABLE` in `backend/api-gateway/middleware/proxy.py`.

### Decision
- Keep `/attendance` routed to `ACADEMIC_DATA_SERVICE_URL` with `_STAFF` (`{"admin", "teacher"}`) access.
- Add `/attendance-proofs` alias to ensure direct URLs can be accessed with valid staff JWT credentials.
- Ensure multipart form data (`request.get_data()`) is proxied directly without intermediate buffering or transformation.

---

## Decision 6: Role Security & Isolation

### Context
Teachers should only see and request attendance for their own profiles; admins must oversee the whole department.

### Decision
Enforce defense-in-depth at the service level:
- In `POST /attendance/event-requests`:
  - If `X-User-Role != "admin"`, verify `faculty_id == linked_id` (or `user_id`). Rejects cross-faculty impersonation with `403 Forbidden`.
- In `GET /attendance/event-requests`:
  - Teachers are automatically scoped to their own `faculty_id`.
  - Admins can query all requests or filter by specific faculty.
- In `POST /attendance/event-requests/<id>/approve` and `reject`:
  - Strictly requires `X-User-Role == "admin"`.

