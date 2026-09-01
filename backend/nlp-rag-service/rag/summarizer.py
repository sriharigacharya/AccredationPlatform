"""
Document summarizer using the LLM backend (or HuggingFace BART/T5 as fallback).
"""

import logging

logger = logging.getLogger(__name__)


def summarize_text(app, text: str, max_length: int = 200) -> str:
    """
    Summarize text using the configured LLM (primary) or BART/T5 (fallback).
    For the demo, uses the LLM via the generator module (same backend).
    """
    from rag.generator import generate_answer

    # Use LLM with a summarization-specific prompt
    class _FakeApp:
        config = {**app.config}

    summary_query = f"Please summarize the following document in {max_length} words or fewer:"
    context = text[:4000]  # Limit to avoid token overflow

    # Temporarily override system prompt style for summarization
    from rag import generator as gen_module
    original_prompt = gen_module.SYSTEM_PROMPT
    gen_module.SYSTEM_PROMPT = (
        "You are a document summarizer. Produce a concise, accurate summary "
        "of the provided text. Focus on key findings, metrics, and important information."
    )

    try:
        result = generate_answer(app, summary_query, context)
    finally:
        gen_module.SYSTEM_PROMPT = original_prompt

    return result
