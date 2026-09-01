"""
Sentence embedder singleton — loads BGE-M3 once and reuses across requests.
"""

import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

_embedder_instance = None


def get_embedder(model_name: str = "BAAI/bge-m3"):
    """
    Return a singleton SentenceTransformer instance.
    BGE-M3 is downloaded (~580 MB) on first call.
    Cached for the lifetime of the process.
    """
    global _embedder_instance
    if _embedder_instance is None:
        logger.info(f"[embedder] Loading model '{model_name}' (first call — may take a minute)…")
        from sentence_transformers import SentenceTransformer
        _embedder_instance = SentenceTransformer(model_name, device="cpu")
        logger.info(f"[embedder] Model loaded.")
    return _embedder_instance
