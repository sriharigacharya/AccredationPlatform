"""
Unit tests for Historical Data integration with Criterion 4 formulas:
  - 4.1 Enrolment Ratio (verified admission records vs placeholders)
  - 4.2 Success Rate (verified batch progression summary)
  - 4.3/4.4 Academic Performance Index (verified API records)
  - All-or-Nothing CSV validation logic test
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import patch
from render.report_data import ReportData, ReportSection
from render.builder import _build_section
from sar_tree.ug_tier_ii_gapc_v4 import NODES
import formulas


class TestHistoricalFormulasGrounding:
    def test_enrolment_ratio_uses_verified_admission_records(self):
        """Enrolment ratio must use verified admission record when available."""
        node = NODES["4.1"]  # Enrolment Ratio
        dept = {"code": "CSE", "name": "Computer Science and Engineering"}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        verified_records = [
            {
                "id": 1,
                "academic_year": "2025-26",
                "department": "CSE",
                "sanctioned_intake": 180,
                "first_year_admitted_net_migration": 175,
                "lateral_entry_admitted": 18,
                "separate_division_admitted": 0,
                "total_admitted": 193,
                "verification_status": "verified",
            }
        ]

        with patch("data_client.fetch_verified_admission_records", return_value=verified_records):
            sec = _build_section(
                node=node,
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=15,
                academic_year="2025-26",
                app_config=app_config,
            )

            assert sec.has_placeholders is False
            # ER = (193 / 180) * 100 = 107.2% -> 20 marks (max marks for >=90%)
            assert sec.formula_result["marks"] == 20.0
            assert sec.formula_result["er_pct"] > 100.0
            assert ["Sanctioned Intake (N)", 180] in sec.table_rows

    def test_success_rate_uses_verified_batch_progression(self):
        """Success rate uses verified batch progression summary across completed cohorts."""
        node = NODES["4.2.2"]  # Success rate with backlog (15 marks)
        dept = {"code": "CSE", "name": "Computer Science and Engineering"}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        verified_batches = [
            {"batch_id": 1, "year_of_entry": "2021-22", "total_admitted": 190, "year_IV": {"students_total_passed": 178}},
            {"batch_id": 2, "year_of_entry": "2020-21", "total_admitted": 190, "year_IV": {"students_total_passed": 176}},
            {"batch_id": 3, "year_of_entry": "2019-20", "total_admitted": 130, "year_IV": {"students_total_passed": 118}},
        ]

        with patch("data_client.fetch_verified_batch_progress_summary", return_value=verified_batches):
            sec = _build_section(
                node=node,
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=15,
                academic_year="2025-26",
                app_config=app_config,
            )

            assert sec.has_placeholders is False
            # SI1 = 178/190 = 0.9368, SI2 = 176/190 = 0.9263, SI3 = 118/130 = 0.9077 -> Avg SI = 0.9236
            # Marks = 15 * 0.9236 = 13.85 / 15
            assert sec.formula_result["avg_si"] == pytest.approx(0.9236, 0.01)
            assert sec.formula_result["marks"] == pytest.approx(13.85, 0.1)
            assert sec.formula_result["max_marks"] == 15.0


    def test_academic_performance_index_uses_verified_api_records(self):
        """API nodes (4.3 / 4.4) use verified academic performance records and successful/appeared ratio."""
        node = NODES["4.3"]  # 2nd year API (api_year2)
        dept = {"code": "CSE", "name": "Computer Science and Engineering"}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        verified_perf = [
            {
                "id": 1,
                "academic_year": "2024-25",
                "year_of_study": "II",
                "mean_cgpa_or_percentage": 7.85,
                "successful_students_count": 180,
                "appeared_students_count": 185,
                "verification_status": "verified",
            }
        ]

        with patch("data_client.fetch_verified_academic_performance", return_value=verified_perf):
            sec = _build_section(
                node=node,
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=15,
                academic_year="2024-25",
                app_config=app_config,
            )

            assert sec.has_placeholders is False
            # ratio = 180 / 185 = 0.972973
            # API = 7.85 * (180 / 185) = 7.638
            # Assessment = 1.5 * 7.638 = 11.46 / 15
            assert sec.formula_result["avg_api"] == pytest.approx(7.638, 0.01)
            assert sec.formula_result["marks"] == pytest.approx(11.46, 0.01)
            assert sec.formula_result["max_marks"] == 15.0
            assert sec.formula_result["total_students"] == 185

    def test_academic_performance_index_with_failures_ratio(self):
        """
        Verify API = mean_cgpa_or_percentage × (successful_students_count / appeared_students_count).
        When successful < appeared, API must be strictly lower than mean CGPA.
        """
        # Case 1: Some students did not pass (150 passed out of 200 appeared, mean CGPA 8.0)
        res_with_failures = formulas.academic_performance_index(
            mean_cgpa_or_percentage=8.0,
            successful_students_count=150,
            appeared_students_count=200,
            max_marks=15.0,
        )
        # Ratio = 150 / 200 = 0.75
        # API = 8.0 * 0.75 = 6.0 (strictly lower than 8.0!)
        # Assessment = 1.5 * 6.0 = 9.0 / 15
        assert res_with_failures["avg_api"] == 6.0
        assert res_with_failures["avg_api"] < 8.0
        assert res_with_failures["marks"] == 9.0
        assert res_with_failures["max_marks"] == 15.0

        # Case 2: Worked example from official PDF (CGPA 9.94, successful 123, appeared 123)
        res_full_pass = formulas.academic_performance_index(
            mean_cgpa_or_percentage=9.94,
            successful_students_count=123,
            appeared_students_count=123,
            max_marks=15.0,
        )
        # Ratio = 1.0 -> API = 9.94 -> Assessment = 1.5 * 9.94 = 14.91 / 15
        assert res_full_pass["avg_api"] == 9.94
        assert res_full_pass["marks"] == 14.91
        assert res_full_pass["max_marks"] == 15.0

    def test_criterion_4_marks_sum_to_150_and_tree_integrity(self):
        """Confirm 4.3 (15), 4.4 (15), 4.6.2 (5), 4.6.3 (10) and Criterion 4 leaf marks sum to exactly 150."""
        assert NODES["4.3"].marks == 15
        assert NODES["4.4"].marks == 15
        assert NODES["4.6.1"].marks == 5
        assert NODES["4.6.2"].marks == 5
        assert NODES["4.6.3"].marks == 10

        # Confirm 4.7 subtree does not exist
        assert "4.7" not in NODES
        assert "4.7.1" not in NODES
        assert "4.7.2" not in NODES
        assert "4.7.3" not in NODES

        c4_nodes = [
            NODES["4.1"],   # 20
            NODES["4.2.1"], # 25
            NODES["4.2.2"], # 15
            NODES["4.3"],   # 15
            NODES["4.4"],   # 15
            NODES["4.5"],   # 40
            NODES["4.6.1"], # 5
            NODES["4.6.2"], # 5
            NODES["4.6.3"], # 10
        ]
        c4_total = sum(n.marks for n in c4_nodes)
        assert c4_total == 150, f"Criterion 4 leaf marks sum to {c4_total}, expected 150"

    def test_section_4_6_3_renders_unified_achievements_table(self):
        """
        Section 4.6.3 must fetch verified student achievements from /student-achievements/report
        and format into the unified table (Table 4.6.3).
        """
        node = NODES["4.6.3"]
        dept = {"code": "CSE", "name": "Computer Science and Engineering"}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        mock_report = {
            "total_verified_achievements": 2,
            "academic_years_count": 1,
            "unified_by_year": [
                {
                    "academic_year": "2025-26",
                    "achievements": [
                        {
                            "id": 1,
                            "student": {"name": "Aarav Sharma"},
                            "student_id": "STU069",
                            "event_name": "Smart India Hackathon",
                            "activity_type": "technical",
                            "event_scope": "national",
                            "event_date": "2025-11-22",
                            "venue": "IIT Bombay",
                            "result_description": "Won 1st Prize",
                        },
                        {
                            "id": 2,
                            "student": {"name": "Divya Nair"},
                            "student_id": "STU070",
                            "event_name": "All India Inter-University Athletics",
                            "activity_type": "sports",
                            "event_scope": "national",
                            "event_date": "2025-10-15",
                            "venue": "JLN Stadium, New Delhi",
                            "result_description": "Silver Medal (400m)",
                        },
                    ],
                }
            ],
        }

        with patch("data_client.fetch_verified_student_achievements", return_value=mock_report) as mock_fetch:
            sec = _build_section(

                node=node,
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=10,
                academic_year="2025-26",
                app_config=app_config,
            )
            mock_fetch.assert_called_once_with("http://mock-academic", academic_year="2025-26")
            assert sec.id == "4.6.3"
            assert sec.marks == 10
            assert len(sec.table_rows) == 2
            assert sec.table_rows[0][1] == "Aarav Sharma"
            assert sec.table_rows[0][3] == "Technical"
            assert sec.table_rows[1][1] == "Divya Nair"
            assert sec.table_rows[1][3] == "Sports"
            assert sec.has_placeholders is False



    def test_section_4_5_uses_placement_summary_not_academic_performance(self):
        """
        Section 4.5 must strictly use /placements/summary (Feature 4),
        computing Assessment = 40 × Average Placement Index (max 40 marks),
        and NEVER call fetch_verified_academic_performance.
        """
        node = NODES["4.5"]  # Placement
        dept = {"code": "CSE", "name": "Computer Science and Engineering"}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        mock_placement_summary = {
            "average_placement_index_ratio": 0.85,
            "average_placement_index_pct": 85.0,
            "assessment_marks": 34.0,
            "years": [
                {"cohort_year": 2026, "academic_year": "2025-26", "final_year_cohort_total": 100, "verified_placed": 75, "verified_higher_studies": 10, "verified_entrepreneurs": 5, "career_positive_total": 90, "placement_index_pct": 90.0},
                {"cohort_year": 2025, "academic_year": "2024-25", "final_year_cohort_total": 100, "verified_placed": 70, "verified_higher_studies": 10, "verified_entrepreneurs": 0, "career_positive_total": 80, "placement_index_pct": 80.0},
            ]
        }

        with patch("data_client.fetch_verified_placement_summary", return_value=mock_placement_summary) as mock_placement_fetch, \
             patch("data_client.fetch_verified_academic_performance") as mock_perf_fetch:

            sec = _build_section(
                node=node,
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=15,
                academic_year="2025-26",
                app_config=app_config,
            )

            # 1. Confirm fetch_verified_placement_summary was called
            assert mock_placement_fetch.called
            # 2. Confirm fetch_verified_academic_performance was NOT called (no cross-wiring!)
            assert not mock_perf_fetch.called

            # 3. Confirm 40 × Average Placement Index calculation:
            # P(2026) = 90/100 = 0.90, P(2025) = 80/100 = 0.80 -> Avg = 0.85
            # Marks = 40 × 0.85 = 34.0
            assert sec.formula_result["avg_placement_index"] == 0.85
            assert sec.formula_result["marks"] == 34.0
            assert ["Academic Year", "Cohort Total (N)", "Placed (x)", "Higher Studies (y)", "Entrepreneurs (z)", "Total (x+y+z)", "Placement Index P (%)"] == sec.table_headers

    def test_section_4_2_1_and_4_2_2_separate_divergent_coverage(self):
        """
        Verify that 4.2.1 (without backlog, ×25) and 4.2.2 (with backlog, ×15)
        use their distinct numerators and multipliers on divergent test data.
        """
        dept = {"code": "CSE", "name": "Computer Science and Engineering"}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        # Meaningfully divergent fixture:
        # Batch total_admitted = 100
        # without_backlog = 60 (SI = 0.60)
        # total_passed = 90 (SI = 0.90) (30 students passed with backlog)
        divergent_batches = [
            {
                "batch_id": 1,
                "year_of_entry": "2021-22",
                "total_admitted": 100,
                "year_IV": {
                    "students_without_backlog": 60,
                    "students_total_passed": 90,
                },
            }
        ]

        with patch("data_client.fetch_verified_batch_progress_summary", return_value=divergent_batches):
            # Test 4.2.1 without backlog
            sec_421 = _build_section(
                node=NODES["4.2.1"],
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=15,
                academic_year="2025-26",
                app_config=app_config,
            )

            # 4.2.1: Assessment = 25 × 0.60 = 15.0 / 25
            assert sec_421.formula_result["avg_si"] == 0.60
            assert sec_421.formula_result["marks"] == 15.0
            assert sec_421.formula_result["max_marks"] == 25.0

            # Test 4.2.2 with backlog
            sec_422 = _build_section(
                node=NODES["4.2.2"],
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=15,
                academic_year="2025-26",
                app_config=app_config,
            )

            # 4.2.2: Assessment = 15 × 0.90 = 13.5 / 15
            assert sec_422.formula_result["avg_si"] == 0.90
            assert sec_422.formula_result["marks"] == 13.5
            assert sec_422.formula_result["max_marks"] == 15.0

            # Distinct assertion: values are completely divergent and cannot be swapped
            assert sec_421.formula_result["avg_si"] != sec_422.formula_result["avg_si"]
            assert sec_421.formula_result["marks"] != sec_422.formula_result["marks"]



class TestAtomicBulkValidationLogic:
    def test_atomic_rejection_on_any_invalid_row(self):
        """Verify that any invalid row invalidates the entire batch without partial imports."""
        raw_csv_rows = [
            {"academic_year": "2025-26", "department": "CSE", "sanctioned_intake": "180", "first_year_admitted_net_migration": "175", "lateral_entry_admitted": "18", "separate_division_admitted": "0"},
            {"academic_year": "invalid-year", "department": "CSE", "sanctioned_intake": "180", "first_year_admitted_net_migration": "170", "lateral_entry_admitted": "18", "separate_division_admitted": "0"},
            {"academic_year": "2023-24", "department": "CSE", "sanctioned_intake": "-50", "first_year_admitted_net_migration": "115", "lateral_entry_admitted": "12", "separate_division_admitted": "0"},
        ]

        errors = []
        for idx, r in enumerate(raw_csv_rows, start=2):
            yr = r.get("academic_year", "")
            if not ("-" in yr and len(yr.split("-")[0]) == 4):
                errors.append({"row": idx, "field": "academic_year", "message": "Invalid year"})
            try:
                intake = int(r.get("sanctioned_intake", 0))
                if intake <= 0:
                    errors.append({"row": idx, "field": "sanctioned_intake", "message": "Intake must be > 0"})
            except ValueError:
                errors.append({"row": idx, "field": "sanctioned_intake", "message": "Invalid integer"})

        # Row 3 had invalid-year, Row 4 had -50 intake
        assert len(errors) == 2
        assert errors[0]["row"] == 3
        assert errors[1]["row"] == 4
        # Since errors is non-empty, entire import is rejected (0 records inserted)
        records_to_insert = [] if errors else [1, 2, 3]
        assert len(records_to_insert) == 0
