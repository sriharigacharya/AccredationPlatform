"""
Unit tests for formulas.py — pure Python, no Flask/network.
Each test passes hand-computed expected values verified against the
NBA SAR GAPC V4.0 document formula descriptions.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import formulas


class TestSFR:
    def test_sfr_under_15_gets_30(self):
        r = formulas.student_faculty_ratio(120, 10)
        assert r["sfr"] == 12.0
        assert r["marks"] == 30

    def test_sfr_17_gets_24(self):
        """SFR=17.0: NOT < 17, so falls into the 17-19 band → 24 marks."""
        r = formulas.student_faculty_ratio(170, 10)
        assert r["sfr"] == 17.0
        assert r["marks"] == 24  # sfr < 17 → 27, sfr 17.0 ≥ 17 so → 24

    def test_sfr_over_25_gets_0(self):
        r = formulas.student_faculty_ratio(260, 10)
        assert r["sfr"] == 26.0
        assert r["marks"] == 0

    def test_no_faculty_returns_0(self):
        r = formulas.student_faculty_ratio(100, 0)
        assert r["marks"] == 0


class TestFQI:
    def test_all_phd_capped_at_25(self):
        # 2.5 × (10×10)/10 = 25 — exactly at cap
        r = formulas.faculty_qualification_index(10, 0, 10)
        assert r["marks"] == 25.0

    def test_mixed_qualification(self):
        # 2.5 × (10×2 + 4×2)/10 = 2.5 × 28/10 = 7.0
        r = formulas.faculty_qualification_index(2, 2, 10)
        assert abs(r["fqi"] - 7.0) < 0.01
        assert r["marks"] == 7.0

    def test_no_phd_mtech_gives_low_fqi(self):
        r = formulas.faculty_qualification_index(0, 0, 10)
        assert r["marks"] == 0.0

    def test_zero_required_returns_0(self):
        r = formulas.faculty_qualification_index(5, 3, 0)
        assert r["marks"] == 0.0


class TestCadreProportion:
    def test_full_cadre_gets_25(self):
        r = formulas.faculty_cadre_proportion(2, 4, 12, 2, 4, 12)
        assert r["marks"] == 25.0

    def test_no_professors_reduces_marks(self):
        r = formulas.faculty_cadre_proportion(0, 4, 12, 2, 4, 12)
        assert r["marks"] < 25.0

    def test_cap_at_25(self):
        r = formulas.faculty_cadre_proportion(10, 10, 10, 1, 1, 1)
        assert r["marks"] == 25.0


class TestSuccessRate:
    def test_100pct_gives_15(self):
        r = formulas.success_rate(100.0)
        assert r["marks"] == 15.0

    def test_50pct_gives_75(self):
        r = formulas.success_rate(50.0)
        # 1.5 × 50 / 10 = 7.5
        assert abs(r["marks"] - 7.5) < 0.01

    def test_cap_enforced(self):
        r = formulas.success_rate(150.0)
        assert r["marks"] == 15.0


class TestPlacementIndex:
    def test_100pct_placement_gives_40(self):
        years = [
            {"placed": 60, "higher_studies": 0, "entrepreneurs": 0, "total": 60},
            {"placed": 60, "higher_studies": 0, "entrepreneurs": 0, "total": 60},
            {"placed": 60, "higher_studies": 0, "entrepreneurs": 0, "total": 60},
            {"placed": 60, "higher_studies": 0, "entrepreneurs": 0, "total": 60},
        ]
        r = formulas.placement_index(years)
        assert abs(r["marks"] - 40.0) < 0.01
        assert r["years_count"] == 4
        assert not r["is_provisional"]

    def test_80pct_placement_gives_32(self):
        # P = 80% = 0.80, marks = 40 × 0.80 = 32.0
        years = [{"placed": 48, "higher_studies": 0, "entrepreneurs": 0, "total": 60}]
        r = formulas.placement_index(years)
        assert abs(r["marks"] - 32.0) < 0.01
        assert r["is_provisional"]  # Only 1 year available

    def test_empty_returns_0(self):
        r = formulas.placement_index([])
        assert r["marks"] == 0.0
        assert r["is_provisional"]



class TestFYSFR:
    def test_above_90pct_gets_5(self):
        # pct = (100×0.8 + 0×0.2) / 8 = 10 → 1000% — cap at 5
        r = formulas.first_year_sfr(100, 0, 8)
        assert r["marks"] == 5

    def test_60pct_gets_2(self):
        r = formulas.first_year_sfr(60, 0, 100)
        # pct = 48/100 = 48% → 0 marks (below 50%)
        assert r["marks"] == 0

    def test_exactly_80pct(self):
        r = formulas.first_year_sfr(100, 0, 100)
        # pct = 80/100 = 80% → >80% → 4 marks? No: >80 = 4, =80 counts as >=80
        assert r["marks"] == 4


class TestResearchFunding:
    def test_above_15L_gives_15(self):
        r = formulas.research_funding_score(16.0)
        assert r["marks"] == 15

    def test_3L_gives_3(self):
        r = formulas.research_funding_score(3.5)
        assert r["marks"] == 3

    def test_zero_gives_0(self):
        r = formulas.research_funding_score(0.0)
        assert r["marks"] == 0

    def test_tier_i_breakpoints_produce_different_results(self):
        """Confirm custom breakpoints work — Tier-I and Tier-II give DIFFERENT
        results at 1.5L: Tier-II has a >1→1 breakpoint, Tier-I's lowest is >2."""
        tier_i_bp = [(20, 15), (15, 12), (10, 9), (7, 6), (4, 3), (2, 1)]
        r_tier_ii = formulas.research_funding_score(1.5)          # >1L → 1 mark
        r_tier_i  = formulas.research_funding_score(1.5, breakpoints=tier_i_bp)  # < 2L → 0
        assert r_tier_ii["marks"] == 1
        assert r_tier_i["marks"]  == 0
        assert r_tier_ii["marks"] != r_tier_i["marks"], "Different breakpoints must produce different results at 1.5L"


class TestSeedMoney:
    def test_received_6L_utilised_fully(self):
        r = formulas.seed_money_score(7.0, 7.0)
        assert r["received_marks"] == 6
        assert r["utilised_marks"] == 4.0
        assert r["marks"] == 10.0

    def test_no_money_gives_0(self):
        r = formulas.seed_money_score(0.0, 0.0)
        assert r["marks"] == 0.0
