"""
NBA SAR Criterion Tree — UG Tier-II GAPC V4.0 (January 2025)
Format identifier: "ug_tier_ii_gapc_v4"

IMPORTANT — Do not merge with ug_tier_i_gapc_v4:
  Node IDs (e.g. 6.1.2.2, 4.1, 5.1) exist in BOTH trees but have
  different mark caps and formula parameters. Keep trees in separate
  modules; the registry enforces isolation at load time.

Each SARNode carries:
  id          — dot-notation NBA node ID
  title       — official NBA section title (verbatim where possible)
  marks       — maximum marks for this node (leaf nodes only; parent marks
                are the sum of children — not stored separately)
  node_type   — "narrative" | "table" | "formula_table" | "static" | "criterion_header"
  data_source — "manual" | "academic-data-service" | "computed" | "static"
  formula_fn  — name of function in formulas.py (formula_table nodes only)
  level       — 1=criterion, 2=sub-criterion, 3=sub-sub-criterion
  parent_id   — dot-notation ID of parent node (None for top-level criteria)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class SARNode:
    id:          str
    title:       str
    marks:       int               # 0 for criterion_header nodes (sum of children)
    node_type:   str               # narrative | table | formula_table | static | criterion_header
    data_source: str               # manual | academic-data-service | computed | static
    formula_fn:  Optional[str] = None
    level:       int               = 1
    parent_id:   Optional[str]     = None


def _n(id, title, marks, node_type, data_source, formula_fn=None, level=1, parent_id=None):
    return SARNode(id=id, title=title, marks=marks,
                   node_type=node_type, data_source=data_source,
                   formula_fn=formula_fn, level=level, parent_id=parent_id)


# ─────────────────────────────────────────────────────────────────────────────
# Full tree definition — 1000 marks total across Criteria 1–9
# ─────────────────────────────────────────────────────────────────────────────

_raw: list[SARNode] = [

    # ── Criterion 1: Outcome-Based Curriculum (120 marks) ─────────────────
    _n("1",     "Outcome-Based Curriculum",                           0,  "criterion_header", "computed"),
    _n("1.1.1", "Vision/Mission of Institute & Department",           5,  "narrative",        "manual",                     level=3, parent_id="1.1"),
    _n("1.1.2", "Program Educational Objectives (PEOs)",             5,  "narrative",        "manual",                     level=3, parent_id="1.1"),
    _n("1.1.3", "Process of Defining Vision, Mission and PEOs",      15, "narrative",        "manual",                     level=3, parent_id="1.1"),
    _n("1.1.4", "Dissemination of Vision, Mission and PEOs",         5,  "narrative",        "manual",                     level=3, parent_id="1.1"),
    _n("1.1.5", "Mapping of PEOs with Mission of the Institute",     10, "table",            "manual",                     level=3, parent_id="1.1"),
    _n("1.2.1", "Program Curriculum Structure",                       5,  "table",            "manual",                     level=2, parent_id="1"),
    _n("1.2.2", "Components of Program Curriculum",                   5,  "table",            "manual",                     level=2, parent_id="1"),
    _n("1.2.3", "Compliance / Gap Analysis for POs and PSOs",        10, "narrative",        "manual",                     level=2, parent_id="1"),
    _n("1.2.4", "Delivery of Content Beyond the Syllabus",           10, "table",            "manual",                     level=2, parent_id="1"),
    _n("1.3.1", "Program Outcomes (POs) and PSOs",                   5,  "static",           "manual",                     level=2, parent_id="1"),
    _n("1.3.2", "Mapping of Courses with POs and PSOs",              10, "table",            "academic-data-service",      level=2, parent_id="1"),
    _n("1.4.1", "Course Outcomes — Semester-wise Sample",            15, "table",            "academic-data-service",      level=2, parent_id="1"),
    _n("1.4.2", "Course Articulation Matrix",                        10, "table",            "academic-data-service",      level=2, parent_id="1"),
    _n("1.5",   "Program Articulation Matrix",                       10, "table",            "academic-data-service",      level=2, parent_id="1"),

    # ── Criterion 2: Outcome-Based Teaching Learning (120 marks) ──────────
    _n("2",     "Outcome-Based Teaching Learning Processes",          0,  "criterion_header", "computed"),
    _n("2.1",   "Quality of Teaching and Learning Processes",        20, "narrative",        "manual",                     level=2, parent_id="2"),
    _n("2.2",   "Quality of Student Capstone Project",               25, "narrative",        "manual",                     level=2, parent_id="2"),
    _n("2.3",   "Internship / Industrial Training",                  10, "narrative",        "manual",                     level=2, parent_id="2"),
    _n("2.4",   "Seminar and Mini/Micro Projects",                   10, "narrative",        "manual",                     level=2, parent_id="2"),
    _n("2.5",   "Case Studies and Real-Life Examples",               10, "narrative",        "manual",                     level=2, parent_id="2"),
    _n("2.6",   "SWAYAM / NPTEL / MOOC / Self-Learning Modules",     10, "narrative",        "manual",                     level=2, parent_id="2"),
    _n("2.7",   "Complex Engineering Problems and SDGs",             20, "narrative",        "manual",                     level=2, parent_id="2"),
    _n("2.8",   "Industry-Institute Partnerships",                   15, "narrative",        "manual",                     level=2, parent_id="2"),

    # ── Criterion 3: Outcome-Based Assessment (120 marks) ─────────────────
    _n("3",     "Outcome-Based Assessment",                           0,  "criterion_header", "computed"),
    _n("3.1",   "Continuous Assessment Evaluation",                  10, "narrative",        "manual",                     level=2, parent_id="3"),
    _n("3.2",   "Semester End Examination (SEE) Paper Evaluation",   10, "narrative",        "manual",                     level=2, parent_id="3"),
    _n("3.3",   "Laboratory / Workshop Evaluation",                  10, "narrative",        "manual",                     level=2, parent_id="3"),
    _n("3.4",   "Industrial Training / Internship Evaluation",       10, "narrative",        "manual",                     level=2, parent_id="3"),
    _n("3.5",   "Evaluation of Projects",                            20, "narrative",        "manual",                     level=2, parent_id="3"),
    _n("3.6",   "Evidence of Addressing Sustainable Development Goals (SDGs)", 10, "narrative", "manual",                  level=2, parent_id="3"),
    _n("3.7.1", "CO Attainment — Assessment Tools and Process",       5, "narrative",        "manual",                     level=3, parent_id="3.7"),
    _n("3.7.2", "CO Attainment — Recorded Attainment Levels",        20, "formula_table",    "academic-data-service",      level=3, parent_id="3.7", formula_fn="co_attainment"),
    _n("3.8",   "PO and PSO Attainment (Direct + Indirect)",         25, "formula_table",    "academic-data-service",      level=2, parent_id="3",   formula_fn="po_attainment"),

    # ── Criterion 4: Students' Performance (120 marks) ────────────────────
    _n("4",     "Students' Performance",                              0,  "criterion_header", "computed"),
    _n("4.1",   "Enrolment Ratio",                                   20, "formula_table",    "academic-data-service",      level=2, parent_id="4",   formula_fn="enrolment_ratio"),
    _n("4.2",   "Success Rate in Stipulated Period",                 15, "formula_table",    "academic-data-service",      level=2, parent_id="4",   formula_fn="success_rate"),
    _n("4.3",   "Academic Performance — First Year (API)",           10, "formula_table",    "academic-data-service",      level=2, parent_id="4",   formula_fn="api_year1"),
    _n("4.4",   "Academic Performance — Second Year (API)",          10, "formula_table",    "academic-data-service",      level=2, parent_id="4",   formula_fn="api_year2"),
    _n("4.5",   "Academic Performance — Third Year (API)",           10, "formula_table",    "academic-data-service",      level=2, parent_id="4",   formula_fn="api_year3"),
    _n("4.6",   "Placement / Higher Studies / Entrepreneurship",     30, "formula_table",    "academic-data-service",      level=2, parent_id="4",   formula_fn="placement_index"),
    _n("4.7.1", "Professional Societies and Technical Events",        5, "table",            "manual",                     level=3, parent_id="4.7"),
    _n("4.7.2", "Student Participation in Professional Activities",  10, "table",            "manual",                     level=3, parent_id="4.7"),
    _n("4.7.3", "Publication of Journals / Magazines / Newsletters",  5, "table",            "manual",                     level=3, parent_id="4.7"),
    _n("4.7.4", "Student Publications",                               5, "table",            "manual",                     level=3, parent_id="4.7"),

    # ── Criterion 5: Faculty Information (100 marks) ──────────────────────
    _n("5",     "Faculty Information and Contributions",              0,  "criterion_header", "computed"),
    _n("5.1",   "Student-Faculty Ratio (SFR)",                       30, "formula_table",    "academic-data-service",      level=2, parent_id="5",   formula_fn="student_faculty_ratio"),
    _n("5.2",   "Faculty Qualification Index (FQI)",                 25, "formula_table",    "academic-data-service",      level=2, parent_id="5",   formula_fn="faculty_qualification_index"),
    _n("5.3",   "Faculty Cadre Proportion",                          25, "formula_table",    "academic-data-service",      level=2, parent_id="5",   formula_fn="faculty_cadre_proportion"),
    _n("5.4",   "Visiting / Adjunct Faculty / Professor of Practice", 10, "narrative",       "manual",                     level=2, parent_id="5"),
    _n("5.5",   "Faculty Retention",                                 10, "formula_table",    "academic-data-service",      level=2, parent_id="5",   formula_fn="faculty_retention"),

    # ── Criterion 6: Faculty Contribution (120 marks) ────────────────────
    _n("6",       "Faculty Contributions",                            0,  "criterion_header", "computed"),
    _n("6.1",     "Academic Contributions (Faculty Development)",     0,  "criterion_header", "computed",  level=2, parent_id="6"),
    _n("6.1.2",   "STTP/FDP Programmes",                             0,  "criterion_header", "computed",  level=2, parent_id="6.1"),
    _n("6.1.1",   "Memberships in Professional Societies",            5,  "table",            "manual",                     level=3, parent_id="6.1"),
    _n("6.1.2.1", "Faculty as Resource Persons (STTP/FDP)",          5,  "table",            "manual",                     level=3, parent_id="6.1.2"),
    # NOTE: 6.1.2.2 cap is 10 in Tier-II (differs from Tier-I's 5 — do NOT share)
    _n("6.1.2.2", "Faculty Participation in STTP/FDP Programmes",   10,  "formula_table",    "manual",                     level=3, parent_id="6.1.2", formula_fn="fdp_participation_score"),
    _n("6.1.3",   "Faculty Certification of MOOCs",                  10, "table",            "manual",                     level=3, parent_id="6.1"),
    _n("6.1.4",   "FDP/STTP Organised by Department",               10,  "formula_table",    "manual",                     level=3, parent_id="6.1", formula_fn="fdp_organised_score"),
    _n("6.1.5",   "Faculty Support in Student Innovative Projects",  10,  "table",            "manual",                     level=3, parent_id="6.1"),
    _n("6.1.6",   "Faculty Internship / Industry Collaboration",     10,  "table",            "manual",                     level=3, parent_id="6.1"),
    _n("6.2",     "Research and Development Contributions",           0,  "criterion_header", "computed",  level=2, parent_id="6"),
    _n("6.2.1",   "Academic Research — Papers, Books",               10,  "table",            "manual",                     level=3, parent_id="6.2"),
    _n("6.2.2",   "Development Activities — Patents, Prototypes",    10,  "narrative",        "manual",                     level=3, parent_id="6.2"),
    # NOTE: 6.2.3/6.2.4 banding breakpoints are Tier-II specific (>15L→15, etc.)
    _n("6.2.3",   "Sponsored Research Projects",                     15,  "formula_table",    "manual",                     level=3, parent_id="6.2", formula_fn="research_funding_score"),
    _n("6.2.4",   "Consultancy Work",                                15,  "formula_table",    "manual",                     level=3, parent_id="6.2", formula_fn="consultancy_score"),
    _n("6.2.5",   "Institution Seed Money / Internal Research Grant", 10, "formula_table",    "manual",                     level=3, parent_id="6.2", formula_fn="seed_money_score"),

    # ── Criterion 7: Facilities and Technical Support (100 marks) ─────────
    _n("7",     "Facilities and Technical Support",                   0,  "criterion_header", "computed"),
    _n("7.1",   "Laboratories and Technical Support Manpower",       50,  "table",            "manual",                     level=2, parent_id="7"),
    _n("7.2",   "Additional Facilities",                             20,  "table",            "manual",                     level=2, parent_id="7"),
    _n("7.3",   "Maintenance and Ambiance",                          10,  "narrative",        "manual",                     level=2, parent_id="7"),
    _n("7.4",   "Safety Measures in Laboratories",                   10,  "table",            "manual",                     level=2, parent_id="7"),
    _n("7.5",   "Project / Research Lab / Centre of Excellence",     10,  "table",            "manual",                     level=2, parent_id="7"),

    # ── Criterion 8: Continuous Improvement (80 marks) ────────────────────
    _n("8",     "Continuous Improvement",                             0,  "criterion_header", "computed"),
    _n("8.1.1", "Actions from CO Attainment Evaluation",             20,  "narrative",        "manual",                     level=3, parent_id="8.1"),
    _n("8.1.2", "Actions from PO/PSO Attainment Evaluation",        20,  "narrative",        "manual",                     level=3, parent_id="8.1"),
    _n("8.2",   "Academic Audit and Actions Taken",                  15,  "narrative",        "manual",                     level=2, parent_id="8"),
    _n("8.3",   "Improvement in Faculty Qualification / Contribution", 10, "table",           "academic-data-service",      level=2, parent_id="8"),
    _n("8.4",   "Improvement in Academic Performance",               15,  "table",            "computed",                   level=2, parent_id="8"),

    # ── Criterion 9: Student Support System and Governance (120 marks) ────
    _n("9",     "Student Support System and Governance",              0,  "criterion_header", "computed"),
    _n("9.1",   "First Year Student-Faculty Ratio (FYSFR)",          5,  "formula_table",    "academic-data-service",      level=2, parent_id="9",   formula_fn="first_year_sfr"),
    _n("9.2",   "Mentoring System",                                   5,  "narrative",        "manual",                     level=2, parent_id="9"),
    _n("9.3.1", "Feedback on Teaching and Learning Process",         10,  "narrative",        "manual",                     level=3, parent_id="9.3"),
    _n("9.3.2", "Feedback on Academic Facilities",                   10,  "narrative",        "manual",                     level=3, parent_id="9.3"),
    _n("9.4",   "Training and Placement Support",                    10,  "narrative",        "manual",                     level=2, parent_id="9"),
    _n("9.5",   "Start-up and Entrepreneurship Activities",           5,  "narrative",        "manual",                     level=2, parent_id="9"),
    _n("9.6.1", "Governing Body / Administrative Setup / Policies",  10,  "narrative",        "manual",                     level=3, parent_id="9.6"),
    _n("9.6.2", "Transparency in Processes",                          5,  "narrative",        "manual",                     level=3, parent_id="9.6"),
    _n("9.7",   "Budget Allocation and Utilization — Institute Level", 12, "table",           "manual",                     level=2, parent_id="9"),
    _n("9.8",   "Budget Allocation and Utilization — Program Level",   8, "table",            "manual",                     level=2, parent_id="9"),
    _n("9.9",   "Quality of Learning Resources",                      5,  "narrative",        "manual",                     level=2, parent_id="9"),
    _n("9.10",  "E-Governance",                                       5,  "narrative",        "manual",                     level=2, parent_id="9"),
    _n("9.11",  "SDG Initiatives and Implementation",                10,  "narrative",        "manual",                     level=2, parent_id="9"),
    _n("9.12",  "Innovative Educational Initiatives",                 5,  "narrative",        "manual",                     level=2, parent_id="9"),
    _n("9.13",  "Faculty Performance Appraisal System (FPADS)",      10,  "narrative",        "manual",                     level=2, parent_id="9"),
    _n("9.14",  "Outreach Activities",                                5,  "narrative",        "manual",                     level=2, parent_id="9"),

    # ── Part C — Declaration ──────────────────────────────────────────────
    _n("part_c",    "Part C: Declaration",                            0,  "static",           "static"),

    # ── Annexures ─────────────────────────────────────────────────────────
    _n("ann_i",   "Annexure I: Knowledge and Attitude Profile (WK1–WK9)", 0, "static",        "static"),
    _n("ann_ii",  "Annexure II: Program Outcomes (PO1–PO11) and PSOs",    0, "static",        "manual"),
    _n("ann_iii", "Annexure III: Allied Departments / Cluster Reference",  0, "static",        "static"),
]

# ── Exported structures ───────────────────────────────────────────────────────

NODES: dict[str, SARNode] = {node.id: node for node in _raw}

ROOT_ORDER: list[str] = [
    "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "part_c", "ann_i", "ann_ii", "ann_iii",
]

# ── Sanity check on import ────────────────────────────────────────────────────
_leaf_marks = sum(
    n.marks for n in _raw if n.node_type != "criterion_header" and n.marks > 0
)
assert _leaf_marks == 1000, (
    f"ug_tier_ii_gapc_v4 leaf marks sum to {_leaf_marks}, expected 1000. "
    "Check for missing or duplicate node definitions."
)
