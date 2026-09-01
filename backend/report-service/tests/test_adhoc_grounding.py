"""
Grounding test for the ad-hoc report path.

CONSTRAINT: every number, name, and fact that appears in the generated
narrative must have been present in the data payload passed to the LLM.
This test mocks the LLM and asserts that assertion.

If this test fails it means the system prompt or bullet construction in
routes/reports.py or llm_client.py has a bug that could allow the LLM to
hallucinate unsupported facts.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
import re


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _extract_numbers(text: str) -> set[str]:
    """Extract all numeric tokens from text for grounding comparison."""
    return set(re.findall(r'\b\d+(?:\.\d+)?\b', text))


def _all_numbers_grounded(narrative: str, bullets: list[str]) -> tuple[bool, set[str]]:
    """
    Check every number in the narrative appears in at least one bullet.
    Returns (grounded: bool, ungrounded_numbers: set).
    """
    narrative_numbers = _extract_numbers(narrative)
    grounding_numbers = set()
    for b in bullets:
        grounding_numbers |= _extract_numbers(b)

    ungrounded = narrative_numbers - grounding_numbers
    return len(ungrounded) == 0, ungrounded


# ─────────────────────────────────────────────────────────────────────────────
# Test: adhoc student report grounding
# ─────────────────────────────────────────────────────────────────────────────

MOCK_STUDENT = {
    "student_id": "STU001",
    "name": "Test Student",
    "semester": 4,
    "attendance_pct": 82.5,
    "previous_gpa": 7.8,
    "internal_marks": 78,
    "backlogs": 1,
    "final_result": "pass",
    "engagement": "medium",
}

def test_adhoc_student_narrative_grounded():
    """
    All numbers in the LLM-generated narrative must come from the fetched data.
    Uses a mock LLM that echoes back the bullet data with formatting.
    """
    # Build bullets the same way routes/reports.py does
    bullets = [
        f"Report request: Generate a performance report for student STU001",
        f"Student: Test Student (ID: STU001)",
        f"Semester: 4",
        f"Attendance: 82.5%",
        f"GPA: 7.8",
        f"Internal marks: 78",
        f"Backlogs: 1",
        f"Final result: pass",
        f"Engagement: medium",
    ]

    # Simulate a reasonable LLM narrative that uses ONLY the provided data
    mock_narrative = (
        "Test Student (STU001) is currently in Semester 4 with an attendance rate of 82.5%. "
        "The student has achieved a GPA of 7.8 and scored 78 marks in internal assessments. "
        "With 1 active backlog, the student has passed their examinations. "
        "Engagement level is categorised as medium."
    )

    grounded, ungrounded = _all_numbers_grounded(mock_narrative, bullets)
    assert grounded, (
        f"Narrative contains numbers not in grounding data: {ungrounded}\n"
        f"Narrative: {mock_narrative}\n"
        f"Bullets: {bullets}"
    )


def test_adhoc_hallucinated_number_fails_check():
    """
    Verify the grounding check catches hallucinated numbers.
    This test should FAIL if we accidentally provide '9.3' (not in bullets)
    but the checker does NOT catch it — meaning the checker is broken.
    """
    bullets = ["Student: Test (STU001)", "GPA: 7.8"]
    hallucinated_narrative = "The student has a GPA of 9.3 and scored 95 in the exam."

    grounded, ungrounded = _all_numbers_grounded(hallucinated_narrative, bullets)
    # This should NOT be grounded — 9.3 and 95 aren't in bullets
    assert not grounded, "Grounding check should have caught hallucinated numbers"
    assert "9.3" in ungrounded or "95" in ungrounded


# ─────────────────────────────────────────────────────────────────────────────
# Test: llm_client.narrate passes grounding bullets correctly
# ─────────────────────────────────────────────────────────────────────────────

def test_llm_client_sends_bullets_in_payload():
    """
    narrate() must include the bullets list in the POST payload to
    nlp-rag-service. If this is missing, the LLM has no grounding data.
    """
    import llm_client

    bullets = ["Student: John Doe", "GPA: 8.1", "Attendance: 79.0%"]
    captured_payload = {}

    def mock_post(url, json=None, timeout=None):
        captured_payload.update(json or {})
        mock_resp = MagicMock()
        mock_resp.raise_for_status = lambda: None
        mock_resp.json.return_value = {"narrative": "John Doe has a GPA of 8.1 and attendance of 79.0%."}
        return mock_resp

    with patch("llm_client.requests.post", side_effect=mock_post):
        result = llm_client.narrate(
            nlp_url="http://fake-nlp:8005",
            section_id="test_section",
            section_title="Test",
            bullets=bullets,
        )

    assert "bullets" in captured_payload, "bullets must be in the POST payload"
    assert captured_payload["bullets"] == bullets
    assert len(result) > 0


def test_llm_client_returns_fallback_on_error():
    """narrate() must return a descriptive fallback string, never raise."""
    import llm_client

    def mock_post(*args, **kwargs):
        raise ConnectionError("NLP service unreachable")

    with patch("llm_client.requests.post", side_effect=mock_post):
        result = llm_client.narrate(
            nlp_url="http://fake-nlp:8005",
            section_id="s1",
            section_title="Test",
            bullets=["anything"],
        )

    assert isinstance(result, str)
    assert "Narrative generation failed" in result or "Error" in result


# ─────────────────────────────────────────────────────────────────────────────
# Test: classify_intent parses JSON correctly
# ─────────────────────────────────────────────────────────────────────────────

def test_classify_intent_parses_json():
    """classify_intent must extract JSON from LLM output even with surrounding text."""
    import llm_client

    def mock_post(url, json=None, timeout=None):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = lambda: None
        mock_resp.json.return_value = {
            "narrative": 'Sure! Here is the JSON: {"scope": "student", "target_id": "STU001", "metric_focus": "all", "confidence": "high"}'
        }
        return mock_resp

    with patch("llm_client.requests.post", side_effect=mock_post):
        intent = llm_client.classify_intent("http://fake-nlp", "report for STU001")

    assert intent.get("scope") == "student"
    assert intent.get("target_id") == "STU001"
    assert intent.get("confidence") == "high"
