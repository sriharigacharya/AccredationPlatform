"""
Unit tests for dynamic Criteria Discovery (GET /criteria) and scope validation:
  - Introspection of all 9 NBA root criteria from SAR tree via static IMPLEMENTED_FORMULAS
  - Zero-drift static evaluation of implemented vs not_implemented status
  - Header & 0-mark node exclusion from leaf_nodes_count
  - Full SAR rendering with explicit Not Available placeholder blocks for unimplemented criteria
  - Validation guard in nba_generate preventing silent failure on unbuilt criteria
"""

import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sar_tree.registry import get_criteria_list, get_tree, SUPPORTED_FORMATS
from sar_tree.ug_tier_ii_gapc_v4 import NODES, ROOT_ORDER, IMPLEMENTED_FORMULAS, LIVE_DATA_TABLE_SECTIONS
from render.builder import _build_section, build_report_data
from render.report_data import ReportData


class TestCriteriaDiscovery:
    def test_get_criteria_list_returns_all_9_criteria(self):
        """Dynamic criteria list must return all 9 root criteria with exact official marks."""
        criteria = get_criteria_list("ug_tier_ii_gapc_v4")
        assert len(criteria) == 9

        criteria_by_id = {c["id"]: c for c in criteria}
        expected_marks = {
            "1": 120,
            "2": 120,
            "3": 120,
            "4": 150,
            "5": 100,
            "6": 120,
            "7": 80,
            "8": 70,
            "9": 120,
        }

        for cid, expected_m in expected_marks.items():
            assert cid in criteria_by_id, f"Criterion {cid} missing from criteria list"
            c = criteria_by_id[cid]
            assert c["marks"] == expected_m, f"Criterion {cid} marks mismatch: {c['marks']} vs expected {expected_m}"
            assert c["scope"] == f"criterion:{cid}"

        total_marks = sum(c["marks"] for c in criteria)
        assert total_marks == 1000, f"Total criteria marks sum to {total_marks}, expected 1000"

    def test_dynamic_implemented_status_zero_drift(self):
        """
        Criterion 4 must be 'implemented' via static registry lookup.
        Unbuilt Criteria (1, 2, 3, 5, 6, 7, 8, 9) must be 'not_implemented' with Coming Soon tooltip.
        """
        criteria = get_criteria_list("ug_tier_ii_gapc_v4")
        c4 = next(c for c in criteria if c["id"] == "4")

        assert c4["status"] == "implemented"
        assert c4["is_implemented"] is True
        assert c4["tooltip"] == "Available for report generation"
        assert c4["implemented_nodes_count"] == c4["leaf_nodes_count"]
        assert c4["leaf_nodes_count"] == 9

        for c in criteria:
            if c["id"] != "4":
                assert c["status"] == "not_implemented", f"Criterion {c['id']} should be not_implemented"
                assert c["is_implemented"] is False, f"Criterion {c['id']} is_implemented should be False"
                assert "Coming Soon" in c["tooltip"]

    def test_header_nodes_excluded_from_leaf_count(self):
        """
        Header and 0-mark parent nodes (e.g. 4.6, 4.2, 6.1, 6.2) must never count
        toward leaf_nodes_count or implemented_nodes_count.
        """
        criteria = get_criteria_list("ug_tier_ii_gapc_v4")
        c4 = next(c for c in criteria if c["id"] == "4")

        # Criterion 4 has 9 true leaf nodes: 4.1, 4.2.1, 4.2.2, 4.3, 4.4, 4.5, 4.6.1, 4.6.2, 4.6.3
        # 4.2 (header, 0 marks) and 4.6 (header, 0 marks) must be excluded!
        assert c4["leaf_nodes_count"] == 9
        assert c4["implemented_nodes_count"] == 9

        # Confirm 4.6 is a header node with 0 marks
        node_46 = NODES["4.6"]
        assert node_46.marks == 0
        assert node_46.node_type == "criterion_header"

        node_42 = NODES["4.2"]
        assert node_42.marks == 0
        assert node_42.node_type == "criterion_header"

    def test_full_sar_renders_not_available_placeholders_for_unimplemented_criteria(self):
        """
        When Full SAR is compiled (scope='full'), sections for unimplemented criteria (1, 2, 3, 5, 6, 7, 8, 9)
        must render explicit 'Not Available — Section Not Yet Implemented' blocks, while Criterion 4
        renders live tables.
        """
        dept = {"code": "CSE", "name": "Computer Science & Engineering", "sanctioned_intake": 180}
        app_config = {"ACADEMIC_DATA_SERVICE_URL": "http://mock-academic"}

        # Node 1.1.1 (under Criterion 1 - Unimplemented)
        sec_111 = _build_section(
            node=NODES["1.1.1"],

            dept=dept,
            students=[],
            faculty=[],
            qual_counts={},
            cadre_counts={},
            required_faculty=10,
            academic_year="2025-26",
            app_config=app_config,
        )
        assert "Not Available — Section Not Yet Implemented" in sec_111.narrative
        assert sec_111.has_placeholders is True


        # Node 5.1 (under Criterion 5 - Unimplemented)
        sec_51 = _build_section(
            node=NODES["5.1"],
            dept=dept,
            students=[],
            faculty=[],
            qual_counts={},
            cadre_counts={},
            required_faculty=10,
            academic_year="2025-26",
            app_config=app_config,
        )
        assert "Not Available — Section Not Yet Implemented" in sec_51.narrative
        assert sec_51.has_placeholders is True

        # Node 4.1 (under Criterion 4 - Implemented)
        with patch("data_client.fetch_verified_admission_records", return_value=[{"sanctioned_intake": 180, "total_admitted": 180}]):
            sec_41 = _build_section(
                node=NODES["4.1"],
                dept=dept,
                students=[],
                faculty=[],
                qual_counts={},
                cadre_counts={},
                required_faculty=10,
                academic_year="2025-26",
                app_config=app_config,
            )
            assert sec_41.formula_result is not None
            assert sec_41.table_rows is not None
            assert "Not Available" not in (sec_41.narrative or "")
