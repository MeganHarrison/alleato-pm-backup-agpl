"""
OCR Worker — fallback text extraction for scanned PDFs.

Queries document_metadata rows with status='no_text', streams source documents
to disk via Microsoft Graph, materializes selectable PDF text with Poppler, uses
Tesseract only for pages or embedded OpenXML images without text, and updates
the record with complete extracted text.

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
import hashlib
import math
import os
import re
import signal
import shutil
import subprocess
import threading
import tempfile
import zipfile
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterator
from typing import Optional

from supabase import Client

from .client import get_graph_client
from ...supabase_helpers import SupabaseRagStore

logger = logging.getLogger(__name__)

_DEFAULT_BATCH = 2
_DEFAULT_FETCH_TIMEOUT_SECONDS = 8
_MAX_OPENXML_BYTES = 250 * 1024 * 1024
_MAX_PDF_BYTES = 500 * 1024 * 1024
_OCR_COMMAND_TIMEOUT_SECONDS = 300
_OCR_RENDER_DPI = 200
_OCR_TILE_PIXELS = 1800
_OCR_TILE_OVERLAP_PIXELS = 80


@dataclass(frozen=True)
class CompleteOcrResult:
    text: str
    page_count: int
    pages_processed: int
    capped: bool


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


def _get_page_cap() -> Optional[int]:
    raw = os.environ.get("DOCUMENT_OCR_PAGE_CAP", "").strip()
    if not raw:
        return None
    try:
        return max(1, min(int(raw), 2000))
    except ValueError:
        raise ValueError(
            "DOCUMENT_OCR_PAGE_CAP must be an integer when an explicit partial-read "
            "policy is intentionally configured"
        )


def _get_batch_size() -> int:
    try:
        return max(
            1,
            min(
                int(
                    os.environ.get(
                        "DOCUMENT_OCR_BATCH_SIZE",
                        str(_DEFAULT_BATCH),
                    )
                ),
                100,
            ),
        )
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
            .select(
                "id,title,source,category,type,project_id,source_item_id,"
                "source_web_url,source_path,source_system,source_metadata"
            )
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
    record: dict,
    text: str,
    capped: bool,
    pages_processed: int,
) -> None:
    """Persist complete OCR text in the RAG database and reset embedding."""
    doc_id = str(record["id"])
    status = "ocr_partial" if capped else "raw_ingested"
    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    rag_store = SupabaseRagStore(supabase)
    rag_store.invalidate_document_content(
        doc_id,
        parsing_status="ocr_processing",
        embedding_status="pending",
        reason="Replacing any prior searchable content with current-revision OCR text",
    )
    update_payload: dict = {
        "status": status,
    }
    supabase.from_("document_metadata").update(update_payload).eq("id", doc_id).execute()
    source_metadata = record.get("source_metadata")
    if not isinstance(source_metadata, dict):
        source_metadata = {}
    rag_store.upsert_rag_document_metadata(
        {
            "id": doc_id,
            "app_document_id": doc_id,
            "project_id": record.get("project_id"),
            "title": record.get("title"),
            "source": record.get("source") or "microsoft_graph",
            "source_system": record.get("source_system"),
            "source_item_id": record.get("source_item_id"),
            "source_web_url": record.get("source_web_url"),
            "type": record.get("type") or "document",
            "category": record.get("category") or "document",
            "content": text,
            "raw_text": text,
            "content_hash": content_hash,
            "parsing_status": status,
            "embedding_status": "pending",
            "source_metadata": {
                **source_metadata,
                "ocr": {
                    "status": status,
                    "pages_processed": pages_processed,
                    "complete": not capped,
                },
            },
        }
    )
    logger.info(
        "[OCRWorker] Updated %s → status=%s pages=%d text_chars=%d",
        doc_id,
        status,
        pages_processed,
        len(text),
    )


def _mark_ocr_failed(supabase: Client, doc_id: str, reason: str) -> None:
    """Invalidate retrieval content and mark a record as a loud OCR failure."""
    SupabaseRagStore(supabase).invalidate_document_content(
        doc_id,
        parsing_status="ocr_failed",
        embedding_status="error",
        reason=f"OCR failed for the current source revision: {reason}",
    )
    supabase.from_("document_metadata").update({
        "status": "ocr_failed",
    }).eq("id", doc_id).execute()
    logger.warning("[OCRWorker] Marked %s as ocr_failed: %s", doc_id, reason)


def _extract_openxml_embedded_image_text(
    document_path: str,
    image_names: list[str],
    *,
    max_pages: Optional[int],
) -> tuple[str, bool, int]:
    """OCR every governed embedded image in a Word OpenXML document."""
    text_parts: list[str] = []
    capped = False
    pages_processed = 0
    with zipfile.ZipFile(document_path) as archive:
        available = set(archive.namelist())
        missing = [name for name in image_names if name not in available]
        if missing:
            raise RuntimeError(
                "DOCX embedded image part(s) disappeared from the current "
                f"source revision: {missing}"
            )
        for name in image_names:
            text = _tesseract_image_bytes(
                archive.read(name),
                suffix=os.path.splitext(name)[1],
            )
            pages_processed += 1
            if text.strip():
                text_parts.append(f"[Embedded image: {name}]\n{text.strip()}")
    return "\n\n".join(text_parts), capped, pages_processed


def _run_ocr_command(command: list[str], *, timeout: int = _OCR_COMMAND_TIMEOUT_SECONDS) -> bytes:
    result = subprocess.run(
        command,
        capture_output=True,
        check=False,
        timeout=timeout,
    )
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(
            f"OCR command failed ({command[0]})"
            + (f": {detail}" if detail else "")
        )
    return result.stdout


def _pdf_page_pixel_size(
    document_path: str,
    page_number: int,
    *,
    dpi: int,
) -> tuple[int, int]:
    """Return the rendered page bounds without materializing the whole page.

    Architectural sheets can exceed 8,000 pixels on one side at useful OCR
    resolution. Rendering the entire sheet in one Poppler process can exceed a
    512 MiB worker even when the source PDF itself is small. Page geometry lets
    the OCR path render bounded tiles while retaining the governed resolution.
    """
    page_info = _run_ocr_command(
        [
            "pdfinfo",
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            "-box",
            document_path,
        ]
    ).decode("utf-8", errors="replace")
    size_match = re.search(
        r"^(?:Page(?:\s+\d+)?\s+)?size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts",
        page_info,
        flags=re.MULTILINE | re.IGNORECASE,
    )
    if not size_match:
        raise RuntimeError(
            f"pdfinfo did not report page geometry for page {page_number}"
        )
    width_points = float(size_match.group(1))
    height_points = float(size_match.group(2))
    rotation_match = re.search(
        r"^(?:Page(?:\s+\d+)?\s+)?rot:\s+(-?\d+)",
        page_info,
        flags=re.MULTILINE | re.IGNORECASE,
    )
    rotation = int(rotation_match.group(1)) % 360 if rotation_match else 0
    if rotation in {90, 270}:
        width_points, height_points = height_points, width_points
    return (
        max(1, math.ceil(width_points * dpi / 72)),
        max(1, math.ceil(height_points * dpi / 72)),
    )


def _ocr_pdf_page_in_tiles(
    document_path: str,
    page_number: int,
    rendered_dir: str,
) -> str:
    """OCR one PDF page at full governed resolution using bounded image tiles."""
    dpi = min(
        _env_int("DOCUMENT_OCR_RENDER_DPI", _OCR_RENDER_DPI, minimum=100),
        300,
    )
    tile_pixels = min(
        _env_int(
            "DOCUMENT_OCR_TILE_PIXELS",
            _OCR_TILE_PIXELS,
            minimum=800,
        ),
        2400,
    )
    overlap = min(_OCR_TILE_OVERLAP_PIXELS, tile_pixels // 10)
    step = tile_pixels - overlap
    width_pixels, height_pixels = _pdf_page_pixel_size(
        document_path,
        page_number,
        dpi=dpi,
    )
    tile_texts: list[str] = []
    tile_row = 0
    for y in range(0, height_pixels, step):
        tile_row += 1
        tile_column = 0
        for x in range(0, width_pixels, step):
            tile_column += 1
            width = min(tile_pixels, width_pixels - x)
            height = min(tile_pixels, height_pixels - y)
            prefix = os.path.join(
                rendered_dir,
                f"page-{page_number}-tile-{tile_row}-{tile_column}",
            )
            _run_ocr_command(
                [
                    "pdftoppm",
                    "-jpeg",
                    "-r",
                    str(dpi),
                    "-f",
                    str(page_number),
                    "-l",
                    str(page_number),
                    "-singlefile",
                    "-x",
                    str(x),
                    "-y",
                    str(y),
                    "-W",
                    str(width),
                    "-H",
                    str(height),
                    document_path,
                    prefix,
                ]
            )
            image_path = f"{prefix}.jpg"
            text = _run_ocr_command(
                ["tesseract", image_path, "stdout", "--dpi", str(dpi)]
            ).decode("utf-8", errors="replace").strip()
            if text:
                tile_texts.append(
                    f"[Tile {tile_row},{tile_column}]\n{text}"
                )
    return "\n\n".join(tile_texts)


def _tesseract_image_bytes(image_bytes: bytes, *, suffix: str) -> str:
    with tempfile.NamedTemporaryFile(suffix=suffix or ".png") as image:
        image.write(image_bytes)
        image.flush()
        output = _run_ocr_command(
            ["tesseract", image.name, "stdout", "--dpi", "200"]
        )
    return output.decode("utf-8", errors="replace").strip()


def _extract_pdf_text_from_path(
    document_path: str,
    *,
    max_pages: Optional[int],
) -> CompleteOcrResult:
    """Read every PDF page, OCRing only pages without extractable text."""
    info = _run_ocr_command(["pdfinfo", document_path]).decode(
        "utf-8",
        errors="replace",
    )
    match = re.search(r"^Pages:\s+(\d+)\s*$", info, flags=re.MULTILINE)
    if not match:
        raise RuntimeError("pdfinfo did not report a page count")
    page_count = int(match.group(1))
    pages_processed = (
        min(page_count, max_pages)
        if max_pages is not None
        else page_count
    )
    if pages_processed < 1:
        raise RuntimeError("PDF contains no readable pages")

    extracted = _run_ocr_command(
        [
            "pdftotext",
            "-layout",
            "-f",
            "1",
            "-l",
            str(pages_processed),
            document_path,
            "-",
        ]
    ).decode("utf-8", errors="replace")
    page_texts = extracted.split("\f")
    if page_texts and not page_texts[-1].strip():
        page_texts.pop()
    page_texts.extend([""] * max(0, pages_processed - len(page_texts)))

    rendered_dir = tempfile.mkdtemp(prefix="alleato-pdf-ocr-")
    lines: list[str] = []
    try:
        for page_number in range(1, pages_processed + 1):
            text = page_texts[page_number - 1].strip()
            if not text:
                text = _ocr_pdf_page_in_tiles(
                    document_path,
                    page_number,
                    rendered_dir,
                )
            if text:
                lines.append(f"[Page {page_number}]\n{text}")
    finally:
        shutil.rmtree(rendered_dir, ignore_errors=True)

    return CompleteOcrResult(
        text="\n\n".join(lines),
        page_count=page_count,
        pages_processed=pages_processed,
        capped=pages_processed < page_count,
    )


def run_ocr_pass(
    supabase: Client,
    *,
    limit: Optional[int] = None,
    page_cap: Optional[int] = None,
) -> dict:
    """
    Process a bounded batch of no-text documents through complete local OCR.

    Returns a summary dict with counts: seen, ocr_full, ocr_partial, failed, skipped.
    """
    missing_tools = [
        tool
        for tool in ("pdfinfo", "pdftotext", "pdftoppm", "tesseract")
        if not shutil.which(tool)
    ]
    if missing_tools:
        raise RuntimeError(
            "Complete local OCR requires missing runtime tool(s): "
            + ", ".join(missing_tools)
        )

    batch = limit or _get_batch_size()
    cap = page_cap or _get_page_cap()
    graph = get_graph_client()

    records = _fetch_no_text_records(supabase, batch)
    if not records:
        logger.info("[OCRWorker] No no_text documents to process.")
        return {"status": "ok", "seen": 0, "ocr_full": 0, "ocr_partial": 0, "failed": 0, "skipped": 0}

    logger.info(
        "[OCRWorker] Processing %d no_text documents (%s)",
        len(records),
        f"explicit page_cap={cap}" if cap is not None else "complete documents",
    )

    counts = {"seen": len(records), "ocr_full": 0, "ocr_partial": 0, "failed": 0, "skipped": 0}

    for record in records:
        doc_id = record["id"]
        title = record.get("title") or doc_id

        download_url = _resolve_download_url(record)
        if not download_url:
            reason = "source download URL could not be resolved"
            logger.warning("[OCRWorker] %s for %s (%s)", reason, doc_id, title)
            _mark_ocr_failed(supabase, doc_id, reason)
            counts["failed"] += 1
            continue

        transport = str(
            (record.get("source_metadata") or {}).get("ocr_transport") or
            "streamed_pdf"
        )
        try:
            if transport == "openxml_embedded_images":
                image_names = list(
                    (record.get("source_metadata") or {}).get(
                        "ocr_embedded_images"
                    )
                    or []
                )
                if not image_names:
                    raise RuntimeError(
                        "openxml_embedded_images transport has no governed image parts"
                    )
                with tempfile.NamedTemporaryFile(suffix=".docx") as source:
                    graph.download_to_path(
                        download_url,
                        source.name,
                        max_bytes=_MAX_OPENXML_BYTES,
                    )
                    text, capped, pages_processed = (
                        _extract_openxml_embedded_image_text(
                            source.name,
                            image_names,
                            max_pages=cap,
                        )
                    )
                ocr_result = type(
                    "EmbeddedImageOcrResult",
                    (),
                    {
                        "text": text,
                        "capped": capped,
                        "pages_processed": pages_processed,
                    },
                )()
            else:
                with tempfile.NamedTemporaryFile(suffix=".pdf") as source:
                    graph.download_to_path(
                        download_url,
                        source.name,
                        max_bytes=_MAX_PDF_BYTES,
                    )
                    ocr_result = _extract_pdf_text_from_path(
                        source.name,
                        max_pages=cap,
                    )
        except Exception as exc:
            logger.warning("[OCRWorker] OCR failed for %s: %s", title, exc)
            _mark_ocr_failed(supabase, doc_id, f"ocr error: {exc}")
            counts["failed"] += 1
            continue

        if len(ocr_result.text.strip()) < 50:
            reason = "complete OCR returned no usable text"
            logger.warning("[OCRWorker] %s for %s", reason, title)
            _mark_ocr_failed(supabase, doc_id, reason)
            counts["failed"] += 1
            continue

        _update_record_after_ocr(
            supabase,
            record,
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
