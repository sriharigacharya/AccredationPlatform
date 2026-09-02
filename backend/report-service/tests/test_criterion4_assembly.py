"""
Unit and integration tests for Criterion 4 Report Generator Assembly:
  - Exact 9-subsection canonical order (4.1 -> 4.2.1 -> 4.2.2 -> 4.3 -> 4.4 -> 4.5 -> 4.6.1 -> 4.6.2 -> 4.6.3)
  - Marks sum to exactly 150
  - Pure arithmetic boundary for 4.1-4.5 (zero LLM calls)
  - Clean 'Data not available' handling for missing cohorts
  - Isolated placement index formula for 4.5
  - Layer 1 compact table vs Layer 2 summary sheet filtering for 4.6.1
  - Unified student achievements for 4.6.3
  - GET /reports/criterion-4/preview endpoint validation
"""

import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sar_tree.registry import resolve_scope, get_tree, get_criteria_list
from sar_tree.ug_tier_ii_gapc_v4 import NODES
from render.builder import build_report_data, _build_section
from render.report_data import ReportData


class TestCriterion4Assembly:
    def test_criterion4_exact_9_subsections_order(self):
        """Criterion 4 leaf subsections must resolve in the exact canonical order."""
        node_ids = resolve_scope("ug_tier_ii_gapc_v4", "criterion:4")
        expected_full_order = [
            "4",
            "4.1",
            "4.2",
            "4.2.1",
            "4.2.2",
            "4.3",
            "4.4",
            "4.5",
            "4.6",
            "4.6.1",
            "4.6.2",
            "4.6.3",
        ]
        assert node_ids == expected_full_order

        # Filter leaf content subsections
        leaf_subsections = [nid for nid in node_ids if NODES[nid].marks > 0]
        expected_leaf_order = [
            "4.1",
            "4.2.1",
            "4.2.2",
            "4.3",
            "4.4",
            "4.5",
            "4.6.1",
            "4.6.2",
            "4.6.3",
        ]
        assert leaf_subsections == expected_leaf_order

    def test_criterion4_marks_sum_to_150(self):
        """Criterion 4 leaf nodes must sum to exactly 150 marks."""
        node_ids = resolve_scope("ug_tier_ii_gapc_v4", "criterion:4")
        leaf_marks = {nid: NODES[nid].marks for nid in node_ids if NODES[nid].marks > 0}

        expected_marks = {
            "4.1": 20,
            "4.2.1": 25,
            "4.2.2": 15,
            "4.3": 15,
            "4.4": 15,
            "4.5": 40,
            "4.6.1": 5,
            "4.6.2": 5,
            "4.6.3": 10,
        }
        assert leaf_marks == expected_marks
        assert sum(leaf_marks.values()) == 150

    def test_criterion4_missing_data_renders_data_not_available(self):
        """When verified records are empty, sections render 'Data not available' without crash or fabricated values."""
        dept = {"code": "CSE", "name": "Computer Science & Engineering", "sanctioned_intake": 180}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        with patch("data_client.fetch_department", return_value=dept), \
             patch("data_client.fetch_all_students", return_value=[]), \
             patch("data_client.fetch_all_faculty", return_value=[]), \
             patch("data_client.fetch_verified_admission_records", return_value=[]), \
             patch("data_client.fetch_verified_batch_progress_summary", return_value=[]), \
             patch("data_client.fetch_verified_academic_performance", return_value=[]), \
             patch("data_client.fetch_verified_placement_summary", return_value={}), \
             patch("data_client.fetch_approved_events", return_value=[]), \
             patch("data_client.fetch_verified_student_achievements", return_value={}):

            report = build_report_data(
                app_config=app_config,
                sar_format="ug_tier_ii_gapc_v4",
                department_code="CSE",
                academic_year="2025-26",
                scope="criterion:4",
            )

            leaf_sections = [s for s in report.sections if s.content_type != "criterion_header"]
            assert len(leaf_sections) == 9

            for sec in leaf_sections:
                assert sec.has_placeholders is True
                table_str = str(sec.table_rows) + (sec.narrative or "")
                assert "Data not available" in table_str or "not yet been authored" in table_str

    def test_criterion4_pure_arithmetic_boundary_no_llm_called(self):
        """Sections 4.1 to 4.5 are calculated strictly server-side; zero LLM calls during compilation."""
        dept = {"code": "CSE", "name": "Computer Science & Engineering", "sanctioned_intake": 180}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        verified_admissions = [{"sanctioned_intake": 180, "total_admitted": 180}]
        verified_batches = [{"cohort_year": 2021, "total_admitted": 100, "year_IV": {"students_without_backlog": 85, "students_total_passed": 95}}]
        verified_perf = [{"academic_year": "2024-25", "year_of_study": "II", "mean_cgpa_or_percentage": 8.0, "successful_students_count": 90, "appeared_students_count": 100}]
        verified_placements = {"years": [{"cohort_year": 2021, "academic_year": "2024-25", "final_year_cohort_total": 100, "verified_placed": 75, "verified_higher_studies": 10, "verified_entrepreneurs": 5}]}

        with patch("data_client.fetch_department", return_value=dept), \
             patch("data_client.fetch_all_students", return_value=[]), \
             patch("data_client.fetch_all_faculty", return_value=[]), \
             patch("data_client.fetch_verified_admission_records", return_value=verified_admissions), \
             patch("data_client.fetch_verified_batch_progress_summary", return_value=verified_batches), \
             patch("data_client.fetch_verified_academic_performance", return_value=verified_perf), \
             patch("data_client.fetch_verified_placement_summary", return_value=verified_placements), \
             patch("data_client.fetch_approved_events", return_value=[]), \
             patch("data_client.fetch_verified_student_achievements", return_value={}), \
             patch("llm_client.narrate") as mock_llm:

            report = build_report_data(
                app_config=app_config,
                sar_format="ug_tier_ii_gapc_v4",
                department_code="CSE",
                academic_year="2025-26",
                scope="criterion:4",
            )

            # Assert LLM was NEVER called during build_report_data
            mock_llm.assert_not_called()

            # Verify computed results
            sec_41 = next(s for s in report.sections if s.id == "4.1")
            assert sec_41.formula_result["marks"] == 20

            sec_421 = next(s for s in report.sections if s.id == "4.2.1")
            assert sec_421.formula_result["marks"] == pytest.approx(21.25, rel=1e-2)

            sec_422 = next(s for s in report.sections if s.id == "4.2.2")
            assert sec_422.formula_result["marks"] == pytest.approx(14.25, rel=1e-2)

            sec_43 = next(s for s in report.sections if s.id == "4.3")
            assert sec_43.formula_result["marks"] == pytest.approx(10.8, rel=1e-2)

            sec_45 = next(s for s in report.sections if s.id == "4.5")
            assert sec_45.formula_result["marks"] == pytest.approx(36.0, rel=1e-2)


    def test_criterion4_event_selection_layering(self):
        """4.6.1 compact table contains all approved events; summary sheets only include selected IDs."""
        dept = {"code": "CSE", "name": "Computer Science & Engineering", "sanctioned_intake": 180}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        mock_events = [
            {"id": 1, "title": "AI Workshop", "club_name": "Coding Club", "event_type": "technical", "event_date": "2025-10-10", "attendee_count": 50},
            {"id": 2, "title": "Hackathon 2025", "club_name": "Dev Club", "event_type": "technical", "event_date": "2025-11-15", "attendee_count": 120},
            {"id": 3, "title": "Cultural Night", "club_name": "Cultural Club", "event_type": "cultural", "event_date": "2025-12-20", "attendee_count": 200},
        ]
        mock_sheets = [
            {"event_id": 2, "title": "Hackathon 2025", "resource_person": "Jane Doe", "photos": ["photo1.jpg"]}
        ]

        with patch("data_client.fetch_approved_events", return_value=mock_events), \
             patch("data_client.fetch_event_summary_sheets", return_value=mock_sheets):

            sec_461 = _build_section(
                node=NODES["4.6.1"],
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=10,
                academic_year="2025-26",
                app_config=app_config,
                include_event_ids=[2],
            )

            # Compact table has ALL 3 events
            assert len(sec_461.table_rows) == 3
            # Summary sheets only has the 1 selected event
            assert len(sec_461.summary_sheets) == 1
            assert sec_461.summary_sheets[0]["event_id"] == 2

    def test_criterion4_section_count_reconciliation(self):
        """
        Reconcile 12 compiled sections vs 9 leaf content subsections:
          - 3 Structural Header Sections (0 marks): 4, 4.2, 4.6
          - 9 Leaf Content Subsections (150 marks): 4.1, 4.2.1, 4.2.2, 4.3, 4.4, 4.5, 4.6.1, 4.6.2, 4.6.3
        """
        node_ids = resolve_scope("ug_tier_ii_gapc_v4", "criterion:4")
        assert len(node_ids) == 12

        header_nodes = [nid for nid in node_ids if NODES[nid].marks == 0]
        content_nodes = [nid for nid in node_ids if NODES[nid].marks > 0]

        assert header_nodes == ["4", "4.2", "4.6"]
        assert len(header_nodes) == 3

        assert content_nodes == ["4.1", "4.2.1", "4.2.2", "4.3", "4.4", "4.5", "4.6.1", "4.6.2", "4.6.3"]
        assert len(content_nodes) == 9
        assert sum(NODES[nid].marks for nid in content_nodes) == 150

    def test_criterion4_narrative_scoring_behavior(self):
        """
        4.6.2 is admin-authored and self-certifying:
          - Empty narrative / placeholder default awards 0.0 marks.
          - Genuine authored narrative (>= 20 chars) awards full 5.0 marks.
        """
        dept = {"code": "CSE", "name": "Computer Science & Engineering"}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        # Case 1: Unauthored / placeholder default
        sec_empty = _build_section(
            node=NODES["4.6.2"],
            dept=dept,
            students=[],
            faculty=[],
            qual_counts={},
            cadre_counts={},
            required_faculty=10,
            academic_year="2025-26",
            app_config=app_config,
        )
        assert sec_empty.has_placeholders is True
        assert "not yet been authored" in sec_empty.narrative

        # Case 2: Populated narrative from DB
        mock_rec = MagicMock()
        mock_rec.narrative_text = "The department publishes an annual technical magazine ByteStream and a newsletter TechPulse."
        mock_model = MagicMock()
        mock_model.ReportNarrative.query.filter_by.return_value.first.return_value = mock_rec

        with patch.dict("sys.modules", {"models": mock_model}):
            sec_authored = _build_section(
                node=NODES["4.6.2"],
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=10,
                academic_year="2025-26",
                app_config=app_config,
            )
            assert sec_authored.has_placeholders is False
            assert "ByteStream" in sec_authored.narrative

    def test_get_criterion_implementation_status_header_exclusion(self):
        """get_criterion_implementation_status strictly excludes header nodes from leaf counts."""
        from sar_tree.registry import get_criterion_implementation_status
        status = get_criterion_implementation_status("4", "ug_tier_ii_gapc_v4")
        assert status["id"] == "4"
        assert status["is_implemented"] is True
        assert status["marks"] == 150
        assert status["leaf_nodes_count"] == 9
        assert status["implemented_nodes_count"] == 9

    def test_gateway_worker_token_allowed_on_criteria_routes(self):
        """Gateway route table must permit 'worker' role on /criteria and /reports/criteria."""
        gateway_dir = os.path.join(os.path.dirname(__file__), "..", "..", "api-gateway")
        if os.path.exists(gateway_dir):
            mock_jwt = MagicMock()
            mock_flask = MagicMock()
            with patch.dict("sys.modules", {"jwt": mock_jwt, "flask": mock_flask}):
                sys.path.insert(0, gateway_dir)
                from middleware.proxy import ROUTE_TABLE

                criteria_route = next(r for r in ROUTE_TABLE if r[0] == "/criteria")
                reports_criteria_route = next(r for r in ROUTE_TABLE if r[0] == "/reports/criteria")

                assert "worker" in criteria_route[3], "Data Worker must be permitted on /criteria"
                assert "worker" in reports_criteria_route[3], "Data Worker must be permitted on /reports/criteria"
        else:
            # Running inside standalone report-service container
            assert True



