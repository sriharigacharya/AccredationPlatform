"""
OCR Pipeline Celery Task — Document Service
Pipeline: Load file → OCR/extract text → classify → chunk → send to nlp-rag-service
"""

import os
import re
import logging
from datetime import datetime
from tasks.celery_app import celery_app
from utils.chunker import chunk_text

logger = logging.getLogger(__name__)

NLP_RAG_SERVICE_URL = os.getenv("NLP_RAG_SERVICE_URL", "http://nlp-rag-service:8005")
MONGO_URI           = os.getenv("MONGO_URI", "mongodb://mongodb:27017/academiq_docs")


def get_mongo():
    from pymongo import MongoClient
    client = MongoClient(MONGO_URI)
    return client.get_default_database()


def _update_doc(doc_id: str, update: dict):
    mongo = get_mongo()
    mongo.documents.update_one({"_id": doc_id}, {"$set": update})


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_document(self, doc_id: str, file_path: str, doc_type: str, collection: str):
    """
    Main OCR pipeline task.
    Steps:
    1. Extract text from file (PDF/DOCX/Image)
    2. Classify document type (if 'other')
    3. Chunk text
    4. Forward chunks to nlp-rag-service for embedding
    5. Update MongoDB status
    """
    try:
        _update_doc(doc_id, {"status": "processing"})

        # ── Step 1: Extract text ───────────────────────────────
        ext  = file_path.rsplit(".", 1)[-1].lower()
        text = ""
        pages = 1

        if ext == "pdf":
            text, pages = _extract_pdf(file_path)
        elif ext == "docx":
            text = _extract_docx(file_path)
        elif ext in ("jpg", "jpeg", "png"):
            text = _extract_image_ocr(file_path)
        elif ext == "txt":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        else:
            raise ValueError(f"Unsupported file type: {ext}")

        if not text.strip():
            _update_doc(doc_id, {"status": "failed", "error": "No text could be extracted."})
            return {"status": "failed", "doc_id": doc_id}

        # ── Step 2: Auto-classify if doc_type is 'other' ──────
        if doc_type == "other":
            doc_type = _classify_doc(text)

        # ── Step 3: Chunk ─────────────────────────────────────
        chunks = chunk_text(text, max_tokens=512, overlap=50)

        # ── Step 4: Forward to nlp-rag-service ────────────────
        import requests
        payload = {
            "doc_id":     doc_id,
            "doc_type":   doc_type,
            "collection": collection,
            "chunks":     [{"text": c, "index": i} for i, c in enumerate(chunks)],
            "metadata": {
                "doc_id":   doc_id,
                "doc_type": doc_type,
                "pages":    pages,
            }
        }
        resp = requests.post(
            f"{NLP_RAG_SERVICE_URL}/embed",
            json=payload,
            timeout=300,
        )
        resp.raise_for_status()

        # ── Step 5: Update metadata ───────────────────────────
        _update_doc(doc_id, {
            "status":       "done",
            "pages":        pages,
            "chunks":       len(chunks),
            "doc_type":     doc_type,
            "processed_at": datetime.utcnow().isoformat(),
        })

        logger.info(f"[OCR] doc={doc_id} pages={pages} chunks={len(chunks)} type={doc_type}")
        return {"status": "done", "doc_id": doc_id, "chunks": len(chunks)}

    except Exception as exc:
        logger.error(f"[OCR] Failed doc={doc_id}: {exc}")
        _update_doc(doc_id, {"status": "failed", "error": str(exc)})
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


# ── Text extraction helpers ───────────────────────────────────────────────────

def _extract_pdf(file_path: str) -> tuple[str, int]:
    """
    Try PyMuPDF (fitz) first for digital PDFs (fast).
    Falls back to PaddleOCR for scanned images.
    """
    try:
        import fitz  # PyMuPDF
        doc   = fitz.open(file_path)
        pages = len(doc)
        text  = "\n\n".join(page.get_text() for page in doc)
        doc.close()

        if len(text.strip()) > 100:
            return text, pages

        # PDF appears to be scanned — try OCR
        logger.info(f"[OCR] PyMuPDF got little text from {file_path}, trying PaddleOCR…")
        return _ocr_pdf_with_paddle(file_path, pages), pages
    except Exception as e:
        logger.warning(f"[OCR] PyMuPDF failed: {e}")
        return _ocr_pdf_with_paddle(file_path, 1), 1


def _ocr_pdf_with_paddle(file_path: str, pages: int) -> str:
    """
    Convert PDF pages to images then run PaddleOCR.
    NOTE: PaddleOCR Docker image is ~3GB. If demo doesn't need scanned OCR,
    comment this out and the digital PDF path (PyMuPDF) is sufficient.
    """
    try:
        from paddleocr import PaddleOCR
        import fitz
        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        doc = fitz.open(file_path)
        all_text = []
        for page in doc:
            pix  = page.get_pixmap(dpi=200)
            img  = pix.tobytes("png")
            result = ocr.ocr(img, cls=True)
            if result and result[0]:
                page_text = "\n".join(line[1][0] for line in result[0] if line)
                all_text.append(page_text)
        doc.close()
        return "\n\n".join(all_text)
    except ImportError:
        logger.warning("[OCR] PaddleOCR not available — returning empty string for scanned PDF.")
        return ""


def _extract_docx(file_path: str) -> str:
    try:
        from docx import Document
        doc = Document(file_path)
        return "\n".join(para.text for para in doc.paragraphs)
    except Exception as e:
        raise RuntimeError(f"DOCX extraction failed: {e}")


def _extract_image_ocr(file_path: str) -> str:
    try:
        from paddleocr import PaddleOCR
        ocr    = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        result = ocr.ocr(file_path, cls=True)
        if result and result[0]:
            return "\n".join(line[1][0] for line in result[0] if line)
        return ""
    except ImportError:
        # Fallback: pytesseract
        try:
            import pytesseract
            from PIL import Image
            return pytesseract.image_to_string(Image.open(file_path))
        except Exception:
            logger.warning("[OCR] No OCR engine available for image.")
            return ""


def _classify_doc(text: str) -> str:
    """Simple keyword-based document classifier."""
    text_lower = text.lower()
    if any(w in text_lower for w in ["self assessment report", "sar", "nba", "naac"]):
        return "SAR"
    if any(w in text_lower for w in ["faculty development programme", "fdp", "workshop"]):
        return "FDP"
    if any(w in text_lower for w in ["placement", "campus recruitment", "placed students"]):
        return "placement"
    if any(w in text_lower for w in ["research project", "principal investigator", "grant"]):
        return "research"
    if any(w in text_lower for w in ["minutes of meeting", "mom", "committee meeting"]):
        return "meeting_minutes"
    if any(w in text_lower for w in ["course file", "lesson plan", "syllabus"]):
        return "course_file"
    if any(w in text_lower for w in ["certificate", "certified that", "awarded"]):
        return "certificate"
    return "other"
