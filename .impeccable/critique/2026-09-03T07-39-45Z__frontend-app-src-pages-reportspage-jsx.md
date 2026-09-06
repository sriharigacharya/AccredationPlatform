---
target: frontend/app/src/pages/ReportsPage.jsx
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-03T07-39-45Z
slug: frontend-app-src-pages-reportspage-jsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Basic spinner toast on generation; no multi-step Celery/LLM generation progress bar |
| 2 | Match System / Real World | 3 | Good NBA GAPC terminology; technical flags like `expand_narratives` leak dev jargon |
| 3 | User Control and Freedom | 2 | No cancel/abort for running asynchronous generation tasks; no undo for report deletion |
| 4 | Consistency and Standards | 3 | Follows sidebar shell; heavy reliance on ad-hoc inline styles and disparate modal paradigms |
| 5 | Error Prevention | 2 | Users can trigger full SAR without knowing 8 of 9 criteria are unimplemented; no pre-flight checks |
| 6 | Recognition Rather Than Recall | 2 | Co-curricular events list lacks category tags, search, or filters; marks breakdown buried |
| 7 | Flexibility and Efficiency | 2 | No keyboard accelerators, batch event filters, or one-click export presets |
| 8 | Aesthetic and Minimalist Design | 2 | Sci-fi dark glassmorphism clashes with daylight academic environment; dense tables lack visual hierarchy |
| 9 | Error Recovery | 2 | Generic toast errors (`Generation failed`) without actionable diagnosis or links to fix data |
| 10 | Help and Documentation | 1 | No inline guidance on NBA GAPC V4.0 rubric rules, marks allocations, or calculation formulas |
| **Total** | | **21/40** | **Acceptable** |

#### Design Specificity Verdict

**LLM assessment**: The interface is technically competent and deeply integrated with NBA Tier-II GAPC backend services, but visually it presents as an off-the-shelf dark SaaS / developer dashboard rather than a high-trust, authoritative academic governance platform. Higher education faculty and accreditation auditors frequently review SARs in well-lit campus environments or on overhead projection; the dark neon-accented glassmorphism (`rgba(255,255,255,0.04)`, purple/blue gradients) creates needless visual fatigue and low typographic scannability. Furthermore, the report generation workflow currently behaves like a raw database form rather than an institutional "Accreditation Command Center" with pre-flight readiness indicators, criterion completion matrices, and transparent data provenance.

**Deterministic scan**: `detect.mjs` found 0 lint issues on `ReportsPage.jsx` directly, but detected `overused-font` (Inter / Space Grotesk) and `flat-type-hierarchy` (size ratios below 1.25) across the connected report templates and landing pages. In `index.css`, low-contrast text tokens (`--text-muted: #4a5568` on `--bg-900: #080c14` at ~2.8:1) violate WCAG AA accessibility standards.

#### Overall Impression
The core engineering is robust—dynamic criteria fetching, event linking, and live Criterion 4 table previews are genuinely impressive. However, the UX suffers from high cognitive load, lack of pre-generation data verification, and an aesthetic disconnect between crypto-style dark glassmorphism and the rigorous demands of institutional accreditation.

#### What's Working
1. **Live Criterion 4 Preview**: Fetching and reviewing real-time assembled tables before committing to full PDF/DOCX generation prevents blind exports.
2. **Dynamic Criteria Synchronization**: Polling the backend registry ensures the frontend stays synchronized with active SAR schema implementations.
3. **Structured Status Feedback**: `StatusBadge` provides clean visual distinction between completed, processing, and failed report artifacts.

#### Priority Issues
- **[P1] Overwhelming Scope Selection & Unclear Criteria Readiness**: The scope dropdown mixes ready criteria with unimplemented ones in a plain HTML select. Users cannot see which data elements are missing before attempting generation.
  - *Why it matters*: Faculty spend time attempting to generate full reports only to receive sparse or partially empty documents.
  - *Fix*: Replace the plain dropdown with an interactive Criterion Readiness Matrix showing marks, completion status, and data sufficiency badges.
  - *Suggested command*: `/impeccable layout`
- **[P1] Low-Contrast Dark Theme Disconnect**: The deep dark-slate background with subtle glass borders creates severe contrast issues in daylight academic offices and projector environments.
  - *Why it matters*: Auditors and faculty reviewing dense academic tables experience eye strain; text contrast fails WCAG AA (2.8:1 on muted elements).
  - *Fix*: Establish an intentional typographic scale with high-contrast surfaces, and provide an institutional daylight/light mode for documentation review.
  - *Suggested command*: `/impeccable quieter`
- **[P2] Monolithic Asynchronous Feedback**: Long-running Celery worker jobs (PDF compilation, BGE-M3 vector lookups, LLM narrative synthesis) show only a generic spinning toast without step progress.
  - *Why it matters*: Users assume the browser or backend froze during 30–60s generation tasks and refresh the page, triggering duplicate jobs.
  - *Fix*: Introduce a staged progress modal showing discrete pipeline milestones (e.g., "1. Aggregating Student Data → 2. Synthesizing Criterion 4 Tables → 3. Rendering PDF").
  - *Suggested command*: `/impeccable polish`
- **[P2] Event Selection Fatigue in Criterion 4**: Events are presented as a flat list of checkboxes with thumbnail previews, lacking search, category tabs (Workshops, Hackathons, Guest Lectures), or date filtering.
  - *Why it matters*: In an active department with 50+ annual events, manually auditing checkboxes is tedious and error-prone.
  - *Fix*: Add filter pills (by event category and semester) and a quick search bar to the event selection drawer.
  - *Suggested command*: `/impeccable distill`
- **[P2] Non-Actionable Error Messages**: Toasts show raw backend strings (`Generation failed`) without linking to missing dependencies.
  - *Why it matters*: Faculty cannot diagnose why a report failed (e.g. unseeded academic year, missing department ID).
  - *Fix*: Implement contextual inline error callouts with direct links to the relevant data entry page (e.g., "Missing Student Records for 2025-26 → Open Students Page").
  - *Suggested command*: `/impeccable clarify`

#### Persona Red Flags
- **Dr. Meena Iyer (Faculty Coordinator / Power User)**:
  - Scrolling through an unsorted, unsearchable list of 40 events to select Criterion 4 entries waste minutes per report.
  - No keyboard shortcut to quickly preview or submit.
  - No saved report presets ("Standard Annual NBA SAR", "Criterion 4 Quick Brief").
- **Prof. Sharma (First-Time IQAC Auditor / Jordan Archetype)**:
  - The difference between "Full SAR" and "Individual Criteria" is not visually explained.
  - Technical parameters like `expand_narratives: false` and `sar_format: ug_tier_ii_gapc_v4` sound like raw database columns rather than human decisions.
  - No safety confirmation explaining what data will be included before report generation initiates.
- **Sam (Accessibility-Dependent User)**:
  - Form select elements and checkboxes rely on browser defaults with low-contrast focus rings.
  - Text muted color (`#4a5568`) on `#080c14` fails WCAG AA contrast (2.8:1).
  - Status spinners do not announce completion state via ARIA live regions.

#### Minor Observations
- Numerous inline styles (`style={{ display: 'flex', gap: 8 }}`) make spacing inconsistent across form sections.
- Radio buttons for format selection ("pdf", "docx", "both") lack visual selection cards.
- The history table hides report IDs behind truncated tooltips rather than providing a clean copy button.

#### Questions to Consider
- What if report generation opened with an "Executive Pre-Flight Audit" showing exact readiness scores for each criterion before rendering?
- Could AcademiQ offer a purpose-built "Auditor View" with a crisp, high-contrast light mode optimized for projection and formal PDF review?
- What if Criterion 4 event selection automatically grouped activities by NBA sub-categories (Technical Events, Publications, Outreach) with one-click bulk inclusion?
