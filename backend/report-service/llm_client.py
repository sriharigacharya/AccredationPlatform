"""
LLM client for report-service — calls nlp-rag-service over HTTP.
Never imports torch / sentence-transformers directly.

Two operations:
  1. narrate()   — expand structured bullet points into SAR-style prose.
     Uses POST /rag/narrate (a new endpoint added to nlp-rag-service in
     this PR — see backend/nlp-rag-service/routes/rag.py).
  2. classify_intent() — parse a free-text adhoc query into structured intent.
     Tries the NLP service first; falls back to local regex parsing if the
     service is unavailable or returns an error.

GROUNDING CONTRACT:
  The caller is responsible for passing ONLY real data into narrate().
  The system prompt in nlp-rag-service's /rag/narrate handler instructs the
  LLM not to state any number, name, or fact not present in the bullets.
  This is tested in tests/test_adhoc_grounding.py.
"""

from __future__ import annotations
import json
import logging
import re

import requests

logger  = logging.getLogger(__name__)
TIMEOUT = 60  # narrative generation can be slow on large sections


# ─────────────────────────────────────────────────────────────────────────────
# Regex-based local intent parser (used as fallback when NLP service is down)
# ─────────────────────────────────────────────────────────────────────────────

# Patterns for student IDs: STU001, S001, STUDENT-001, etc.
_STUDENT_ID_RE = re.compile(
    r"\b(STU\d+|S\d{3,}|STUDENT[-_]?\d+)\b",
    re.IGNORECASE,
)
# Patterns for faculty IDs: FAC001, F001, FACULTY-001, etc.
_FACULTY_ID_RE = re.compile(
    r"\b(FAC\d+|F\d{3,}|FACULTY[-_]?\d+)\b",
    re.IGNORECASE,
)

_STUDENT_KEYWORDS = re.compile(
    r"\b(student|pupil|learner|stu\d+|mark|gpa|attendance|backlog|result|grade)\b",
    re.IGNORECASE,
)
_FACULTY_KEYWORDS = re.compile(
    r"\b(faculty|professor|lecturer|staff|teacher|fac\d+|publication|research)\b",
    re.IGNORECASE,
)
_METRIC_MAP = {
    "marks":      re.compile(r"\b(mark|score|internal|grade|exam)\b", re.IGNORECASE),
    "attendance": re.compile(r"\b(attend|present|absent)\b",           re.IGNORECASE),
    "risk":       re.compile(r"\b(risk|at.risk|backlog|fail|danger)\b", re.IGNORECASE),
}


def _local_classify_intent(query: str) -> dict:
    """
    Rule-based intent extraction — runs entirely in-process with no external calls.
    Used when the NLP service is unavailable.
    """
    student_match = _STUDENT_ID_RE.search(query)
    faculty_match = _FACULTY_ID_RE.search(query)

    if student_match:
        target_id = student_match.group(0).upper()
        scope = "student"
    elif faculty_match:
        target_id = faculty_match.group(0).upper()
        scope = "faculty"
    elif _STUDENT_KEYWORDS.search(query):
        scope     = "student"
        target_id = None
    elif _FACULTY_KEYWORDS.search(query):
        scope     = "faculty"
        target_id = None
    else:
        scope     = "class"
        target_id = None

    metric_focus = "all"
    for metric, pattern in _METRIC_MAP.items():
        if pattern.search(query):
            metric_focus = metric
            break

    return {
        "scope":        scope,
        "target_id":    target_id,
        "metric_focus": metric_focus,
        "confidence":   "medium" if target_id else "low",
        "source":       "local_regex",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def narrate(
    nlp_url: str,
    section_id: str,
    section_title: str,
    bullets: list[str],
    style: str = "sar_tier_ii",
    max_words: int = 300,
) -> str:
    """
    Expand structured bullet points into SAR-style narrative prose.
    Returns the generated text string, or a plain-text summary on error.
    """
    payload = {
        "section_id":    section_id,
        "section_title": section_title,
        "bullets":       bullets,
        "style":         style,
        "max_words":     max_words,
    }
    try:
        resp = requests.post(
            f"{nlp_url.rstrip('/')}/rag/narrate",
            json=payload,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json().get("narrative", "")
    except Exception as e:
        logger.warning(f"[llm_client] narrate failed for {section_id}: {e} — using bullet fallback")
        # Return the bullets as readable plain text rather than an error string
        return _bullets_to_plain_text(section_title, bullets)


def classify_intent(
    nlp_url: str,
    query: str,
) -> dict:
    """
    Classify a free-text adhoc report request into structured intent.
    Returns {scope, target_id, metric_focus, confidence}.
    Falls back to local regex parsing if the NLP service is unavailable.
    """
    classification_bullets = [
        f"User query: {query}",
        "Task: Extract the report scope from this query.",
        "Output JSON with keys: scope (student|section|class|faculty), "
        "target_id (the specific ID mentioned or null), "
        "metric_focus (marks|attendance|risk|all), "
        "confidence (high|medium|low).",
        "If target cannot be resolved to a real record, set confidence=low.",
    ]
    payload = {
        "section_id":    "adhoc_classify",
        "section_title": "Intent Classification",
        "bullets":       classification_bullets,
        "style":         "json_only",
        "max_words":     100,
    }
    try:
        resp = requests.post(
            f"{nlp_url.rstrip('/')}/rag/narrate",
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        text = resp.json().get("narrative", "")
        # Extract JSON from the response
        start = text.find("{")
        end   = text.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(text[start:end])
            # Validate the response has usable content
            if parsed.get("scope") and parsed.get("scope") != "error":
                return parsed
        logger.warning("[llm_client] classify_intent: LLM response unparseable, falling back to regex")
    except json.JSONDecodeError as e:
        logger.warning(f"[llm_client] classify_intent JSON parse error: {e} — falling back to regex")
    except Exception as e:
        logger.warning(f"[llm_client] classify_intent NLP call failed: {e} — falling back to regex")

    # Always fall back to local regex rather than returning {error: ...}
    result = _local_classify_intent(query)
    logger.info(f"[llm_client] classify_intent local result: {result}")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _bullets_to_plain_text(title: str, bullets: list[str]) -> str:
    """Convert bullet list to readable prose fallback when LLM is unavailable."""
    lines = [f"{title}\n"]
    for b in bullets:
        if b.startswith("Report request:"):
            continue  # skip the meta-bullet
        lines.append(f"• {b}")
    return "\n".join(lines)
