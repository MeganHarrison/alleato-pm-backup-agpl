"""
OCR Worker — fallback text extraction for scanned PDFs.

Queries document_metadata rows with status='no_text', downloads the raw PDF
bytes via Microsoft Graph, runs Azure Document Intelligence OCR, and updates
the record with extracted text.

Status after processing:
  - 'raw_ingested'  → full text extracted (all pages within the cap were processed
                       and the doc fits within the page cap)
  - 'ocr_partial'   → OCR ran but the document exceeded the page cap; text is
                       partial and the record is flagged so staff know it may be
                       incomplete for RAG search.

Both statuses make the record eligible for the embedding pipeline on the next
sync run — ocr_partial files ARE embedded, but the Files table shows them
distinctly so operators can spot PDFs that weren't fully read.
"""
import logging
import os
import signal
import threading
from contextlib import contextmanager
from typing import Any, Iterator
from typing import Optional

from supabase import Client

from .client import get_graph_client
from ..azure.document_intelligence import extract_text_from_bytes, is_configured as azure_is_configured

logger = logging.getLogger(__name__)

_DEFAULT_BATCH = 20
_DEFAULT_PAGE_CAP = 20
_DEFAULT_FETCH_TIMEOUT_SECONDS = 8


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        return default
    return max(minimum, value)


@contextmanager
def _ocr_fetch_timeout() -> Iterator[None]:
    timeout_seconds = _env_int(
        "GRAPH_OCR_FETCH_TIMEOUT_SECONDS",
        _DEFAULT_FETCH_TIMEOUT_SECONDS,
    )
    alarm_enabled = (
        threading.current_thread() is threading.main_thread()
        and hasattr(signal, "SIGALRM")
        and hasattr(signal, "alarm")
    )
    previous_handler = None

    def _raise_timeout(_signum: int, _frame: Any) -> None:
        raise TimeoutError(f"OCR no_text fetch exceeded {timeout_seconds}s")

    if alarm_enabled:
        previous_handler = signal.getsignal(signal.SIGALRM)
        signal.signal(signal.SIGALRM, _raise_timeout)
        signal.alarm(timeout_seconds)
    try:
        yield
    finally:
        if alarm_enabled:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, previous_handler)


def _get_page_cap() -> int:
    try:
        return max(1, min(int(os.environ.get("AZURE_OCR_PAGE_CAP", str(_DEFAULT_PAGE_CAP))), 100))
    except ValueError:
        return _DEFAULT_PAGE_CAP


def _get_batch_size() -> int:
    try:
        return max(1, min(int(os.environ.get("AZURE_OCR_BATCH_SIZE", str(_DEFAULT_BATCH))), 100))
    except ValueError:
        return _DEFAULT_BATCH


def _fetch_no_text_records(supabase: Client, limit: int) -> list[dict]:
    """Fetch document_metadata rows with status='no_text'.

    Covers both OneDrive-synced files (source_system != 'drawing_upload') and
    directly-uploaded drawing PDFs (source_system = 'drawing_upload' with a
    public Supabase Storage URL in source_web_url).
    """
    with _ocr_fetch_timeout():
        result = (
            supabase.from_("document_metadata")
            .select("id, title, source_web_url, source_path, source_system, type")
            .eq("status", "no_text")
            .not_.is_("source_web_url", "null")
            .limit(limit)
            .execute()
        )
    return result.data or []


def _is_supabase_storage_url(url: str) -> bool:
    """Return True if the URL points to a public Supabase Storage object."""
    return "supabase.co/storage/v1/object/public/" in url


def _resolve_download_url(record: dict) -> Optional[str]:
    """
    Get a download URL for a document_metadata record.

    For directly-uploaded files stored in Supabase Storage the source_web_url
    is already a public download URL — return it directly.

    For OneDrive/SharePoint files the source_web_url is a browser URL; resolve
    via the Graph /shares endpoint to get a fresh download URL.
    """
    web_url = record.get("source_web_url") or ""
    if not web_url:
        return None

    # Supabase Storage public URLs are directly downloadable.
    if _is_supabase_storage_url(web_url):
        return web_url

    try:
        import base64
        graph = get_graph_client()
        token = base64.urlsafe_b64encode(web_url.encode()).rstrip(b"=").decode()
        share_token = f"u!{token}"
        data = graph.get(f"/shares/{share_token}/driveItem")
        return data.get("@microsoft.graph.downloadUrl") or data.get("downloadUrl")
    except Exception as exc:
        logger.warning("[OCRWorker] Could not resolve download URL for %s: %s", record.get("id"), exc)
        return None


def _update_record_after_ocr(
    supabase: Client,
    doc_id: str,
    text: str,
    capped: bool,
    pages_processed: int,
) -> None:
    """Update document_metadata with OCR results."""
    status = "ocr_partial" if capped else "raw_ingested"
    update_payload: dict = {
        "status": status,
        "content": text[:100000],  # hard cap to avoid oversized rows
    }
    supabase.from_("document_metadata").update(update_payload).eq("id", doc_id).execute()
    logger.info(
        "[OCRWorker] Updated %s → status=%s pages=%d text_chars=%d",
        doc_id,
        status,
        pages_processed,
        len(text),
    )


def _mark_ocr_failed(supabase: Client, doc_id: str, reason: str) -> None:
    """Mark a record as ocr_failed so it's skipped on the next pass."""
    supabase.from_("document_metadata").update({
        "status": "ocr_failed",
    }).eq("id", doc_id).execute()
    logger.warning("[OCRWorker] Marked %s as ocr_failed: %s", doc_id, reason)


def run_ocr_pass(
    supabase: Client,
    *,
    limit: Optional[int] = None,
    page_cap: Optional[int] = None,
) -> dict:
    """
    Process a batch of no_text documents through Azure Document Intelligence OCR.

    Returns a summary dict with counts: seen, ocr_full, ocr_partial, failed, skipped.
    """
    if not azure_is_configured():
        logger.info("[OCRWorker] Azure Document Intelligence not configured — skipping OCR pass.")
        return {"status": "skipped", "reason": "azure_not_configured"}

    batch = limit or _get_batch_size()
    cap = page_cap or _get_page_cap()
    graph = get_graph_client()

    records = _fetch_no_text_records(supabase, batch)
    if not records:
        logger.info("[OCRWorker] No no_text documents to process.")
        return {"status": "ok", "seen": 0, "ocr_full": 0, "ocr_partial": 0, "failed": 0, "skipped": 0}

    logger.info("[OCRWorker] Processing %d no_text documents (page_cap=%d)", len(records), cap)

    counts = {"seen": len(records), "ocr_full": 0, "ocr_partial": 0, "failed": 0, "skipped": 0}

    for record in records:
        doc_id = record["id"]
        title = record.get("title") or doc_id

        download_url = _resolve_download_url(record)
        if not download_url:
            logger.warning("[OCRWorker] No download URL for %s (%s) — skipping", doc_id, title)
            counts["skipped"] += 1
            continue

        try:
            if _is_supabase_storage_url(download_url):
                import requests as _requests
                resp = _requests.get(download_url, timeout=30)
                resp.raise_for_status()
                pdf_bytes = resp.content
            else:
                pdf_bytes = graph.download_bytes(download_url)
        except Exception as exc:
            logger.warning("[OCRWorker] Failed to download %s: %s", title, exc)
            _mark_ocr_failed(supabase, doc_id, f"download failed: {exc}")
            counts["failed"] += 1
            continue

        if len(pdf_bytes) == 0:
            logger.warning("[OCRWorker] Empty file for %s — skipping", title)
            counts["skipped"] += 1
            continue

        try:
            ocr_result = extract_text_from_bytes(pdf_bytes, max_pages=cap)
        except Exception as exc:
            logger.warning("[OCRWorker] OCR failed for %s: %s", title, exc)
            _mark_ocr_failed(supabase, doc_id, f"ocr error: {exc}")
            counts["failed"] += 1
            continue

        if len(ocr_result.text.strip()) < 50:
            # OCR ran but found no readable text (blank pages, image-only with no text).
            # Leave as no_text — don't embed, don't mark raw_ingested.
            logger.info("[OCRWorker] OCR returned no usable text for %s — leaving as no_text", title)
            counts["skipped"] += 1
            continue

        _update_record_after_ocr(
            supabase,
            doc_id,
            ocr_result.text,
            capped=ocr_result.capped,
            pages_processed=ocr_result.pages_processed,
        )

        if ocr_result.capped:
            logger.warning(
                "[OCRWorker] Page cap hit for '%s' (id=%s) — processed %d pages, "
                "document may have more. Status set to ocr_partial.",
                title,
                doc_id,
                ocr_result.pages_processed,
            )
            counts["ocr_partial"] += 1
        else:
            counts["ocr_full"] += 1

    logger.info("[OCRWorker] Pass complete: %s", counts)
    return {"status": "ok", **counts}
