"""
LLM answer generator for RAG — supports Ollama, Groq, and OpenAI.
"""

import logging
import os

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are AcademiQ Assistant, an AI helping faculty and administrators
with queries about academic records, accreditation documents, student outcomes,
and institutional information.

Answer questions accurately and concisely based ONLY on the provided context.
If the context does not contain enough information to answer, say so clearly.
Format answers in clear, structured prose. Use bullet points when listing items."""


NARRATE_SYSTEM_PROMPT_SAR = """You are a technical writing assistant specialising in NBA 
(National Board of Accreditation) Self-Assessment Reports for Indian engineering colleges.

Your task is to expand the provided structured bullet points into formal SAR-style prose:
- Write in formal, third-person, process-descriptive academic English.
- The register should match an NBA SAR section: factual, evidence-referencing, passive voice is acceptable.
- Do NOT introduce any fact, number, name, date, or claim not explicitly present in the bullet points.
- Do NOT state that something "will" happen or is planned unless a bullet says so.
- Keep length within the specified word limit.
- Do not add introductory phrases like "Based on the bullets..." or "Here is the narrative:".
- Output only the final prose text, nothing else."""

NARRATE_SYSTEM_PROMPT_JSON = """You are a data extraction assistant. 
Extract structured information from the provided bullets and output ONLY a valid JSON object. 
Do not include any text outside the JSON. Do not add comments."""


def generate_answer(app, query: str, context: str) -> str:
    """
    Generate an answer using the configured LLM backend.
    Backends: ollama | openai | groq (openai-compatible)
    """
    backend = app.config.get("LLM_BACKEND", "groq")
    model   = app.config.get("LLM_MODEL", "llama-3.1-8b-instant")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Context from documents:\n\n{context}\n\n"
                f"---\n\nQuestion: {query}\n\nAnswer:"
            ),
        },
    ]

    if backend == "ollama":
        return _generate_ollama(app.config["OLLAMA_HOST"], model, messages)
    else:
        # openai / groq (both use OpenAI-compatible API)
        return _generate_openai_compatible(
            api_key=app.config["OPENAI_API_KEY"],
            base_url=app.config["OPENAI_BASE_URL"],
            model=model,
            messages=messages,
        )


def _generate_openai_compatible(api_key: str, base_url: str, model: str, messages: list) -> str:
    """Call OpenAI / Groq / any OpenAI-compatible endpoint."""
    if not api_key:
        logger.warning("[generator] OPENAI_API_KEY not set — returning placeholder.")
        return ("⚠️ LLM API key not configured. Set OPENAI_API_KEY in .env "
                "(get a free key at console.groq.com). Context retrieved successfully.")

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key, base_url=base_url)
        resp   = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=1024,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"[generator] OpenAI-compatible call failed: {e}")
        raise


def _generate_ollama(host: str, model: str, messages: list) -> str:
    """Call local Ollama API."""
    import requests
    payload = {"model": model, "messages": messages, "stream": False}
    try:
        resp = requests.post(f"{host}/api/chat", json=payload, timeout=120)
        resp.raise_for_status()
        return resp.json()["message"]["content"].strip()
    except Exception as e:
        logger.error(f"[generator] Ollama call failed: {e}")
        raise


def generate_narrative(
    app,
    section_id: str,
    section_title: str,
    bullets: list[str],
    style: str = "sar_tier_ii",
    max_words: int = 300,
) -> str:
    """
    Generate formal SAR narrative prose from structured bullet points.
    Uses a dedicated system prompt appropriate for NBA accreditation writing.
    NEVER mutates module-level SYSTEM_PROMPT.
    NEVER introduces facts not present in the bullets (grounding contract).
    """
    backend = app.config.get("LLM_BACKEND", "groq")
    model   = app.config.get("LLM_MODEL", "llama-3.1-8b-instant")

    system_prompt = (
        NARRATE_SYSTEM_PROMPT_JSON if style == "json_only"
        else NARRATE_SYSTEM_PROMPT_SAR
    )

    bullet_text = "\n".join(f"- {b}" for b in bullets)
    user_content = (
        f"Section: {section_id} — {section_title}\n\n"
        f"Bullet points (these are ALL the facts you may use):\n{bullet_text}\n\n"
        f"Write formal SAR prose, maximum {max_words} words:"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_content},
    ]

    if backend == "ollama":
        return _generate_ollama(app.config["OLLAMA_HOST"], model, messages)
    else:
        return _generate_openai_compatible(
            api_key=app.config["OPENAI_API_KEY"],
            base_url=app.config["OPENAI_BASE_URL"],
            model=model,
            messages=messages,
        )
