"""
utils/extractor.py
Extracts text from PDFs (PyPDF2) or returns raw bytes for images (handled by Gemini).
"""
import io
import logging

logger = logging.getLogger(__name__)


def extract_text(file_bytes: bytes, ext: str) -> tuple[str, bytes | None]:
    """
    Returns (extracted_text, image_bytes_or_None).
    For PDFs  → parse text; image_bytes = None
    For images → extracted_text = ""; image_bytes = raw bytes (Gemini does OCR)
    """
    if ext == "pdf":
        return _extract_pdf(file_bytes), None
    else:
        logger.info("Image file detected — delegating OCR+analysis to Gemini")
        return "", file_bytes


def _extract_pdf(file_bytes: bytes) -> str:
    try:
        import PyPDF2
    except ImportError:
        raise RuntimeError("PyPDF2 is not installed. Run: pip install PyPDF2")

    text_parts = []
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        logger.info(f"PDF has {len(reader.pages)} page(s)")
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_parts.append(f"--- Page {i + 1} ---\n{page_text.strip()}")
                logger.info(f"  Page {i+1}: {len(page_text)} chars extracted")
            else:
                logger.warning(f"  Page {i+1}: no text found (possibly scanned)")
    except Exception as e:
        raise RuntimeError(f"Failed to parse PDF: {e}")

    combined = "\n\n".join(text_parts)
    if not combined.strip():
        raise RuntimeError(
            "No readable text found in this PDF. "
            "It may be a scanned document — please upload the image version instead."
        )
    return combined
