# Antigravity Prompt Package — Import Real Student Data into AcademiQ

**Task type:** One-time historical data import (Data Worker/Admin path, per AcademiQ's
established decision that historical academic data is uploaded, not auto-derived).
**Do NOT** treat this as a new feature; it's a data-loading job against the existing
`academic-data-service` (port 8002) schema.

---

## 0. Discovery — do this before writing any code

1. Open `academic-data-service/models.py` and find the actual `Student` model /
   `courses_data` JSON column definition, and the `departments` table.
2. Confirm the real `department_id` value used for Computer Science in this
   installation. This package assumes `"CSE"` — **verify, don't assume**. If it's
   different (e.g. `"CS"` or a numeric FK), fix the value in `Students.csv` /
   `students_payload.json` before importing.
3. Check whether `students.courses_data` is currently a flat list of course dicts
   or has a different nested shape (e.g. keyed by semester). The payload builder
   in `load_student_data.py` currently emits a flat list per student
   (`record["courses_data"] = [...]`) — adjust `build_payloads()` if the real
   schema nests differently.
4. Check whether an `attendance_data` field / separate `class_attendance_entries`
   table already exists (per the project's memory: `Event Lifecycle module` and
   general architecture mention attendance separately). If attendance already
   lives in its own table, write `attendance_payload.json` there instead of
   nesting it under the student record.
5. Confirm whether the existing ingestion endpoint (if any) does idempotent
   **upsert** keyed on `student_id` (and on `(student_id, course_code, semester,
   section)` for course/attendance rows) — re-uploads of this same file later
   must update, not duplicate.

Do not skip this step. The files below were built purely from the spec PDF and the
raw spreadsheet — they have not been checked against your actual running schema.

---

## 1. What's in this package

| File | What it is |
|---|---|
| `AcademiQ_Import_Ready.xlsx` | Human-reviewable workbook (README + Students + Course_Assessments + Attendance + Data_Quality_Log sheets). For you/the professor to eyeball, not for the pipeline to parse. |
| `Students.csv` | 270 unique students, one row each. |
| `Course_Assessments.csv` | 297 rows — one per (student, course, semester, section) that the student actually appears in. |
| `Attendance.csv` | 77 rows — one per (student, course, semester, section) with attendance data. |
| `Data_Quality_Log.csv` | 59 flagged rows (absent / not-eligible test entries), for audit. |
| `academiq_import_schema.json` | The field contract — types, enums, bounds, required/optional, and exactly which fields are missing from source data. **Treat this as the source of truth for validation**, not the PDF, since it also encodes the source-data gaps the PDF doesn't know about. |
| `load_student_data.py` | Stdlib-only validator + payload builder. Run it, don't rewrite it from scratch — extend it if the discovery step above turns up schema differences. |
| `payloads/students_payload.json`, `payloads/course_assessments_payload.json`, `payloads/attendance_payload.json` | Pre-built output of running `load_student_data.py` once already — ready to POST as-is if discovery step 2–5 confirms no schema mismatch. |

Regenerate everything from source instead of hand-editing CSVs if the original
`Student_Master_Data.xlsx` changes — the transform is deterministic and reproducible
(see §5).

---

## 2. Critical: this data is incomplete — surface this, don't silently patch it

The source spreadsheet is a merge of **one attendance report + five IA/CIE mark
sheets** for a Computer Science cohort. It contains **no**:

- Semester End Exam (SEE) scores, grades, or grade points — every course row has
  `course_status = "in_progress"` and `grade = null` because there is nothing to
  grade yet.
- `credits` per course (needed for any SGPA/CGPA computation).
- Student contact info (`email`, `phone`), `gender`, `admission_quota`,
  `mentor_faculty_id`, `academic_term`, `enrollment_status`.
- Any parent/guardian contact data, placement records, student achievements, or
  ML risk-score inputs (`current_sgpa`, `cumulative_cgpa`, `backlogs`,
  `progression_tier`, `risk_score`, `engagement`).

**Do not fabricate values for these fields to make the import "complete."** They are
left as `null` / `TO_FILL` throughout. If a downstream feature (e.g. the SGPA
computation in `Student.compute_sgpa()`, or the ML retention-risk model) requires
them and breaks on `null`, that's the correct behavior — it means those features
genuinely aren't ready for this cohort until the missing source files exist. Flag it
back to the user rather than inventing plausible-looking numbers.

One field needs a decision, not just a null: **`cie_raw_equiv_100`**. The institution's
real CIE formula for these courses is "sum of best 2 of 3 tests" (or "2 tests + 1
assignment" for `CS3C03`), which lands directly in `cie_reduced` (out of 50). The
AcademiQ spec's `cie_raw` field, however, is defined as `cie1+cie2+quiz1+quiz2+el`
summed to 100 — a formula this institution doesn't actually use (no quiz component
exists here). `cie_raw_equiv_100` is a synthetic `cie_reduced * 2` placeholder so the
schema slot isn't empty. **Ask the user whether to write this synthetic value to the
DB at all, or leave `cie_raw` null until real quiz/credit data arrives** — don't
decide this silently, since it affects any report that reads `cie_raw` directly.

---

## 3. Import order & idempotency

Import in this order (foreign-key dependency order):

1. **Students** — one upsert per row, keyed on `student_id`. Every downstream table
   references this.
2. **Course_Assessments** — upsert keyed on `(student_id, course_code, semester,
   section)`. Confirm the composite key resolves correctly in the actual DB schema
   (Note: `CS3C03` appears twice with different sections — Sec A and Sec B are
   genuinely different course offerings, not duplicates. The transform already
   verified zero students appear in both, so this is safe.)
3. **Attendance** — same composite key pattern, separate table (or nested field —
   see discovery step 4).

Re-running the pipeline against a refreshed export of the same source file must
**update existing rows**, not create duplicates. `load_student_data.py`'s validator
already checks for duplicate keys within a single run; it does not check against
what's already in the DB — that upsert logic belongs in the API layer per the
project's existing architecture, not in this script.

---

## 4. Regression tests to write before merging

Consistent with this project's "independently testable components" principle:

1. **Round-trip test**: import `payloads/students_payload.json` into a test DB,
   read it back, assert `len(students) == 270` and spot-check 3 known USNs
   (`4NI14CS034`, `4NI18CS009`, `4NI19CS...` — pick any) for exact field values
   against the CSVs.
2. **Null-safety test**: confirm existing report-generation code (SAR Criterion 4
   report builder, SGPA computation) does not crash — but is allowed to produce
   partial/`N/A` output — when `credits`, `see_raw`, or `grade` are `null` for a
   course. This is the expected state for this cohort right now.
3. **SAR/general isolation check**: per the existing hard architectural constraint,
   confirm this import does **not** touch any General AI Report Builder code paths
   — it's Criterion 4 student-performance data only, loaded through the same
   Data Worker/Admin historical-upload path already established for CIE data,
   nothing new.
4. **Idempotency test**: run the import twice with identical payloads; assert row
   counts don't change on the second run.

---

## 5. Regenerating from source (if the spreadsheet is updated)

The three CSVs were produced by `transform.py` (included alongside this package if
you need to re-run it — otherwise reconstruct it from the logic described here,
since the actual script parses the specific 2-row merged-header layout of this
one workbook and isn't meant to be a general-purpose tool):

- Reads the `Master Student Data` sheet's row-1 merged block titles
  (`"<Course Name> (<CODE>) - Sem <N> Sec <X> - <Attendance|IA Marks>"`) and row-2
  sub-headers to identify each of the 6 report blocks.
- For each student row, skips any block that's entirely `'NA'` (student wasn't in
  that report).
- Maps `'A'` → `0.0` + `ABSENT` flag; `'NE'` → `null` + `NOT_ELIGIBLE` flag.
- Verified the institution's `CIE` column against test scores (best-2-of-3, or
  2 tests + assignment) — confirm this holds if new courses with different IA
  schemes get added; the formula is **not** universal across all possible courses.

Then re-run:
```bash
python3 load_student_data.py --data-dir . --out-dir ./payloads
```
It exits non-zero and writes nothing if validation fails — check the console output
before assuming the payloads are current.

---

## 6. What to ask the user for next (don't guess)

To make this cohort's data NBA-report-ready (Criteria 4.1–4.5), request:

1. A **SEE mark sheet** per course (same USN-keyed format) to complete grading.
2. A **curriculum credits master** (course_code → credits) — needed for any SGPA.
3. A **student demographics/admissions export** (email, phone, gender, quota) from
   the SIS, not the IA report system.
4. A **proctor/mentor allotment sheet** for `mentor_faculty_id`.
5. Confirmation of the correct `department_id` value (see discovery step 2).

Everything else (placement records, parent contacts, achievements) is out of scope
for this import — it wasn't in the source file and needs its own separate upload
flow entirely.
