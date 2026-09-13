# Faculty Timetable, Attendance & Leave-Notification System
### Implementation brief (feed this whole file + the `/data` folder to Antigravity)

---

## 0. What's in this package

```
antigravity_package/
├── BRIEF_FOR_ANTIGRAVITY.md          <- this file (read first)
├── mock_attendance_device.html       <- clickable throwaway prototype of the kiosk UI (see note below)
└── data/
    ├── faculty_timetable.json        <- 42 faculty, each with weekly schedule + workload
    ├── class_sessions_flat.json      <- same data flattened to 1 row per scheduled period (679 rows)
    ├── class_sessions_flat.csv       <- same as above, CSV
    └── subject_code_legend_TO_REVIEW.csv  <- 109 raw subject codes needing a human to confirm full names
```

> **About `mock_attendance_device.html`**: this is a quick, self-contained click-through prototype
> (vanilla HTML/JS) built to demonstrate the UX described in §5 — faculty search, PUNCH IN/OUT, live
> status table. It persists data using this chat platform's own key-value storage API
> (`window.storage`), which **only exists in this preview environment** and is not a real database —
> Antigravity should treat it purely as a UX reference, not a component to port as-is. The real build
> should implement the actual `POST /api/attendance/punch` endpoint and a proper backend-connected
> kiosk page per §5 below.

Source: `Individual_Time_Table_2024_25_EVEN_sem___8_3.docx` (even-semester 2024-25 timetable), parsed
programmatically. Every faculty block in the original document contained a header table (name /
subject / semester / section / room), a Mon–Sat time grid, and a workload-summary table; these were
reconstructed for all 42 faculty found in the document.

**Known data-quality caveats — read before building the ingestion step:**
1. One block (Sem-2 "SFH" sessions, sections D & F) has no named faculty in the source document —
   these rows are output with `"faculty_name": "UNASSIGNED"`. Get the real name from the department
   before go-live, or the ingestion script will need to skip/flag them.
2. The grid cells are freeform text (e.g. `"USP D2 (+GL)CSLAB2"`, `"DBMS lab D1 (UKP) CSlab 8"`). Each
   flattened session row includes a **best-effort parse** (`subject_code`, `section`, `room_hint`,
   `co_faculty_initials`, `is_lab`) AND the original `raw_text`. The parse is not 100% reliable —
   treat `raw_text` as ground truth and the parsed fields as helpful hints. Antigravity should surface
   `raw_text` in an admin review screen so a human can correct any row once, after which it's clean
   forever.
3. `subject_code_legend_TO_REVIEW.csv` lists every distinct code string found in the grid with a
   best-guess full subject name. **A human must fill in `confirmed_subject_name` before this is used
   to drive student-facing screens.** Don't let Antigravity invent subject names on its own.
4. Time slots in the source are fixed college periods: `9:00-10:00, 10:00-11:00, [break], 11:30-12:30,
   12:30-1:30, [break], 1:30/2:30-3:30, 3:30-4:30`. Treat these as a fixed lookup table, not free text.
5. Co-faculty initials (e.g. `(+GL)`, `(+UKP)`) refer to lab-assist / second faculty on that session —
   worth a `Faculty.initials` column so these can eventually be resolved to a real faculty_id.

---

## 1. Goal

Build a system with three connected features:

1. **Faculty Timetable** — every faculty member's individual weekly schedule is loaded into the system
   and queryable (by faculty, by section/semester, by room, by day).
2. **Faculty Attendance** — attendance is captured by faculty punching in/out on a **mock swipe device**
   (a separate small web app that simulates a biometric/RFID reader), and the resulting IN/OUT events
   update a live attendance record for each faculty member.
3. **Leave / Absence Notification** — when a faculty member is on leave (or marks themselves absent) for
   a given date/time window, the system automatically figures out, from the timetable, which
   sections have a class with that faculty in that window, and notifies the students in those
   sections that the class won't happen (or will be rescheduled/covered).

---

## 2. Data model

### 2.1 Core entities

```
Faculty
  id                PK
  full_name         text        -- from data/faculty_timetable.json -> faculty_name
  initials          text null   -- e.g. "GL", "UKP" — used to resolve co_faculty_initials later
  email             text
  phone             text null
  department        text null
  is_course_coordinator boolean default false  -- some names include "(Course Coordinator)"

Subject
  id                PK
  code              text unique   -- e.g. "DS", "DBMS", "USP" (from legend CSV, confirmed_subject_name column)
  name              text          -- confirmed full name
  department        text null

Section
  id                PK
  semester          text          -- "2","4","6","PG" etc. (source uses these literal values)
  section_label     text          -- "A","B","C","D","E","F","D1","D2" etc. (some rows are lab sub-batches)

TimetableSlot                      -- one row per scheduled period, built from class_sessions_flat.json
  id                PK
  faculty_id        FK -> Faculty
  subject_id        FK -> Subject (nullable until legend is confirmed)
  section_id        FK -> Section
  day_of_week       enum(Mon,Tue,Wed,Thu,Fri,Sat)
  period_index      int            -- 1..6 (maps to the fixed period table, see 2.2)
  start_time        time
  end_time          time
  room              text null
  is_lab            boolean
  co_faculty_id     FK -> Faculty nullable
  raw_text          text           -- original cell text, kept forever for audit/debug
  academic_term     text           -- e.g. "2024-25-EVEN" (so multiple timetables can coexist over years)

Room               -- optional, if you want room-clash checks later
  id PK, room_no text unique, capacity int null

Enrollment          -- NOT included in this package — you'll need a real student roster feed
  student_id FK -> Student
  section_id FK -> Section
  academic_term text

Student             -- NOT included in this package
  id PK, full_name text, email text, phone text null, usn text unique
```

### 2.2 Fixed period lookup (do not treat as free text)

| period_index | start | end   | notes  |
|---|---|---|---|
| 1 | 09:00 | 10:00 | |
| 2 | 10:00 | 11:00 | |
| — | 11:00 | 11:30 | BREAK, never scheduled |
| 3 | 11:30 | 12:30 | |
| 4 | 12:30 | 13:30 | |
| — | 13:30 | 14:30 | BREAK (labelled "1:30–2:30" in source), never scheduled |
| 5 | 14:30 | 15:30 | |
| 6 | 15:30 | 16:30 | |

### 2.3 Attendance

```
AttendanceEvent
  id            PK
  faculty_id    FK -> Faculty
  event_type    enum(IN, OUT)
  event_time    timestamp
  device_id     text            -- "MOCK-DEVICE-01" for now, real device ids later
  source        enum(MOCK_DEVICE, MANUAL_ADMIN)
  created_at    timestamp

FacultyDailyAttendance          -- derived/computed, one row per faculty per date
  faculty_id    FK
  date          date
  first_in      timestamp null
  last_out      timestamp null
  status        enum(PRESENT, LATE, ABSENT, ON_LEAVE, HALF_DAY, NOT_YET_MARKED)
  computed_at   timestamp
  PRIMARY KEY (faculty_id, date)
```

**Status computation rule (default, make configurable per institution):**
- No `IN` event by a configurable cutoff (e.g. faculty's first scheduled period start + 15 min) and no
  approved leave → `ABSENT`.
- `IN` event after their first scheduled period's start time → `LATE`.
- `IN` present, `OUT` before their last scheduled period ends, no leave covering the gap → `HALF_DAY`.
- Otherwise → `PRESENT`.
- If an approved `LeaveNotice` covers the whole day → `ON_LEAVE` (overrides everything above).

### 2.4 Leave / Notification

```
LeaveNotice
  id            PK
  faculty_id    FK -> Faculty
  date          date
  start_time    time null       -- null = full day
  end_time      time null       -- null = full day
  reason        text null
  status        enum(SUBMITTED, NOTIFIED, CANCELLED)
  created_by    FK -> Faculty | Admin
  created_at    timestamp

Notification
  id                PK
  student_id        FK -> Student
  leave_notice_id   FK -> LeaveNotice
  timetable_slot_id FK -> TimetableSlot
  message           text
  channel           enum(IN_APP, EMAIL, SMS, PUSH)
  sent_at           timestamp null
  read_at           timestamp null
```

---

## 3. Ingestion step (do this first)

Write a one-time (re-runnable/idempotent) import script:

1. Read `data/faculty_timetable.json`. For each faculty object:
   - Upsert `Faculty` by `faculty_name` (trim `"(Course Coordinator)"` suffix into
     `is_course_coordinator=true`, store clean name).
   - For each entry in `assigned_subjects`, upsert `Section` (semester + section_label) and note the
     `room_no` as a default room for that subject/section pairing.
2. Read `data/class_sessions_flat.json` (679 rows). For each row:
   - Resolve `faculty_name` → `Faculty.id`.
   - Map `day` + `time_label` → `period_index`/`start_time`/`end_time` using the fixed table in §2.2
     (skip/ignore any row that has no clean match rather than guessing).
   - Look up `subject_code` in the **reviewed** `subject_code_legend.csv` → `Subject.id`. If the code
     isn't confirmed yet, still create the `TimetableSlot` row but leave `subject_id` null and keep
     `raw_text` — surface these in an admin "needs review" queue rather than blocking the import.
   - Resolve `section` (e.g. "A", "D2") + the semester already known from `faculty_timetable.json`'s
     `assigned_subjects` for that faculty/subject → `Section.id`.
   - Insert `TimetableSlot` with `academic_term = "2024-25-EVEN"`.
3. Log every row that couldn't be fully resolved (missing faculty, unmapped subject code, unmapped
   section) to an `ingestion_warnings` table/file instead of silently dropping it.
4. This import is meant to be run again whenever a new semester's timetable docx/JSON is produced —
   design it so re-running with the same `academic_term` value updates rather than duplicates.

---

## 4. Feature 1 — Faculty Timetable

**Functional requirements**
- Faculty can log in and see **their own** weekly timetable (grid: days × periods), pulled from
  `TimetableSlot` for the current `academic_term`.
- Students can see the timetable for **their section** (semester + section), so they know which
  faculty/subject/room to expect each period.
- Admin can see the **master timetable**: filter by faculty, by section, by room, by day — and detect
  clashes (same room + same day + overlapping period assigned to two different sections).
- Each slot shows: subject name (once legend confirmed), faculty name, room, lab/theory flag, and
  co-faculty if present.

**Suggested API**
```
GET  /api/faculty/{facultyId}/timetable?term=2024-25-EVEN
GET  /api/sections/{sectionId}/timetable?term=2024-25-EVEN
GET  /api/timetable/slots?day=Mon&room=CSLAB2&term=2024-25-EVEN     (admin filters)
GET  /api/timetable/current-class?facultyId=...                    (what's happening right now / next)
```

---

## 5. Feature 2 — Faculty Attendance via Mock Punch Device

Build this as **its own small, separate web app/route** (not part of the student-facing site), simulating
a physical swipe/biometric terminal that would normally sit at the campus gate.

**Mock device site — functional spec**
- Route: e.g. `/mock-device` (kiosk-style, full screen, no student-facing navigation).
- UI: a simple screen with:
  - A faculty picker (searchable dropdown or numeric staff-ID entry, since there's no real hardware).
  - Two big buttons: **PUNCH IN** and **PUNCH OUT**.
  - On tap, show a 2–3 second confirmation ("✅ IN recorded for Dr. C Vidyaraj at 09:04 AM") then reset
    to the picker for the next person, exactly like a real kiosk.
  - A tiny device-id label in the corner ("MOCK-DEVICE-01") so the payload includes which device
    the event notionally came from — this makes the API design realistic for when a real device is
    swapped in later.
- No login needed on the kiosk itself (a real biometric reader doesn't require the person to type a
  password); optionally protect the `/mock-device` route with a single shared PIN so students can't
  spoof punches for others in this dev/demo version.

**API contract (mock device → backend), designed to also work with a real device later**
```
POST /api/attendance/punch
{
  "faculty_id": "F-0021",
  "event_type": "IN" | "OUT",
  "device_id": "MOCK-DEVICE-01",
  "timestamp": "2025-02-14T09:04:12+05:30"   // device sends its own clock; server also stamps received_at
}
→ 201 { "attendance_event_id": "...", "computed_status_today": "PRESENT" }
```
- Backend stores the raw `AttendanceEvent`, then recomputes that faculty's `FacultyDailyAttendance` row
  for that date using the rule in §2.3.
- Make the endpoint idempotent-safe: reject/flag a duplicate `IN` with no intervening `OUT` (can't
  punch IN twice in a row) instead of silently creating a broken state.
- Emit a domain event (`faculty.attendance.updated`) after each punch — Feature 3 doesn't need this, but
  a live "who's on campus right now" admin dashboard can subscribe to it.

**Faculty-facing screens**
- "My Attendance" page: today's IN/OUT time, running monthly attendance %, calendar view of
  PRESENT/LATE/ABSENT/ON_LEAVE days.
- Admin "Attendance Dashboard": live table of all faculty currently on campus (`first_in` today, no
  `last_out` yet), plus daily/monthly reports per faculty/department.

---

## 6. Feature 3 — Leave Notification to Affected Students

**Functional requirements**
1. A faculty member (or admin on their behalf) can submit a `LeaveNotice` for a date, and optionally a
   specific time window (else it's treated as full-day).
2. On submission, the system:
   - Queries `TimetableSlot` for that faculty, filtered to the `day_of_week` matching the leave `date`,
     and to periods overlapping `[start_time, end_time]` (or all periods if full-day).
   - For each matching slot, resolves the `Section` and looks up all `Student`s enrolled in that
     section for the current term (`Enrollment` table — see caveat: you'll need a real roster feed for
     this; it's not in the data package).
   - Creates a `Notification` per affected student per slot, e.g.:
     > "Heads up: Dr. C Vidyaraj is on leave on Wed 14 Feb. Your Distributed Systems class
     > (11:30–12:30, Room 409) will not be held. Watch this space for reschedule/substitute info."
   - Sends via whichever channels are enabled (in-app is mandatory; email/SMS optional/configurable).
   - Marks `LeaveNotice.status = NOTIFIED`.
3. If a substitute faculty is later assigned for that slot, allow a follow-up notification
   ("Class will now be covered by Prof. X in the same room") rather than leaving students only with the
   cancellation message.
4. Faculty should also be able to **cancel** a leave notice before its date if plans change — this
   should trigger a correction notification if students were already notified.
5. Show every student a simple "Any changes to my classes today?" banner driven by unread
   `Notification`s for slots happening today.

**Suggested API**
```
POST   /api/leave                      { faculty_id, date, start_time?, end_time?, reason }
GET    /api/leave/{id}/affected-slots  -- preview before confirming, shows which sections/students will be notified
POST   /api/leave/{id}/notify          -- confirm + send (or auto-triggered on POST /api/leave)
DELETE /api/leave/{id}                 -- cancel + send correction notice if already notified
GET    /api/students/{id}/notifications?today=true
```

**Edge cases to handle explicitly**
- Faculty teaches the *same* section twice in a day (lab + theory) — leave for only part of the day
  must notify only the overlapping slot(s), not both.
- Two faculty share a slot (`co_faculty_id`) — if only one is on leave, decide (configurable) whether
  the class still runs with the other faculty, and word the notification accordingly rather than
  cancelling outright.
- Leave submitted with very little lead time (e.g. same morning) — notification should be flagged
  "urgent" / pushed via a more immediate channel if available.
- The "UNASSIGNED" SFH slots from the data caveats (§0) have no faculty — leave/attendance features
  are meaningless for them until a real faculty is assigned; exclude `faculty_id IS NULL` rows from
  leave-eligible slots.

---

## 7. Roles & access

| Role | Timetable | Attendance | Leave |
|---|---|---|---|
| Student | view own section's timetable | — | receive notifications only |
| Faculty | view own timetable | punch via mock device; view own attendance history | submit/cancel own leave |
| Admin | view/edit master timetable, resolve legend/import warnings | dashboard of all faculty, manual correction of attendance events | approve/override leave, assign substitutes |

---

## 8. Suggested build order for Antigravity

1. Stand up DB schema (§2), run the ingestion script (§3) against `data/`, and get a clean read-only
   timetable API + faculty/student timetable views working end-to-end (Feature 1) first — everything
   else depends on this data being in the DB correctly.
2. Build the mock punch-device kiosk app + `POST /api/attendance/punch` + daily-status computation +
   faculty/admin attendance views (Feature 2).
3. Build `LeaveNotice` creation, the affected-slot lookup query, and notification generation/delivery
   (Feature 3) — this is the one that depends on a real `Student`/`Enrollment` table existing, so stub
   that with a handful of fake students per section if a real roster isn't available yet, clearly
   marked as test data.
4. Build the admin "needs review" queue for unresolved subject codes / faculty names from the
   ingestion warnings log (§3.3), so the data keeps improving without re-touching the raw docx.
