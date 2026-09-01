"""Text chunking utility for document-service."""

import re
from typing import List


def chunk_text(text: str, max_tokens: int = 512, overlap: int = 50) -> List[str]:
    """
    Split text into overlapping chunks suitable for embedding.
    
    Strategy:
    1. Split by double newline (paragraph boundaries) first.
    2. If a paragraph is too large, split by sentence.
    3. Pack sentences into chunks ≤ max_tokens words with overlap.
    
    Args:
        text:       Input text to chunk.
        max_tokens: Maximum number of words per chunk (rough token estimate).
        overlap:    Number of words to overlap between consecutive chunks.
    
    Returns:
        List of text chunks.
    """
    # Normalize whitespace
    text = re.sub(r"\n{3,}", "\n\n", text.strip())

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    # Sentence splitter (simple regex)
    def split_sentences(para: str) -> List[str]:
        return [s.strip() for s in re.split(r"(?<=[.!?])\s+", para) if s.strip()]

    # Collect sentence-level units
    sentences: List[str] = []
    for para in paragraphs:
        words = para.split()
        if len(words) <= max_tokens:
            sentences.append(para)
        else:
            sentences.extend(split_sentences(para))

    # Pack into chunks
    chunks:   List[str] = []
    current:  List[str] = []
    cur_words: int      = 0

    for sent in sentences:
        sent_words = len(sent.split())

        if cur_words + sent_words > max_tokens and current:
            chunks.append(" ".join(current))

            # Keep overlap: retain last N words
            overlap_text = " ".join(" ".join(current).split()[-overlap:])
            current  = [overlap_text] if overlap_text else []
            cur_words = len(overlap_text.split())

        current.append(sent)
        cur_words += sent_words

    if current:
        chunks.append(" ".join(current))

    # Filter out very short chunks
    return [c for c in chunks if len(c.split()) >= 10]
