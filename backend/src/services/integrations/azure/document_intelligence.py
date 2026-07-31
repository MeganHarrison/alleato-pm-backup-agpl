"""
Azure Document Intelligence client for OCR extraction from scanned PDFs.

Uses the prebuilt-read model which is the most cost-effective option
for raw text extraction (no layout/table/entity analysis needed).

Pricing: ~$0.0015 per page (standard tier, prebuilt-read).
"""
import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

_MAX_PAGES_DEFAULT = 20


@dataclass
class OcrResult:
    text: str
    page_count: int
    pages_processed: int
    capped: bool  # True if pages_processed < page_count (hit the per-file limit)


def _get_client():
    """Return an Azure Document Intelligence client, or raise if not configured."""
    try:
        from azure.ai.documentintelligence import DocumentIntelligenceClient
        from azure.core.credentials import AzureKeyCredential
    except ImportError as exc:
        raise RuntimeError(
            "azure-ai-documentintelligence is not installed. "
            "Add it to requirements.txt and rebuild the Docker image."
        ) from exc

    endpoint = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "")
    api_key = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY", "")
    if not endpoint or not api_key:
        raise RuntimeError(
            "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY "
            "must be set to use OCR extraction."
        )
    return DocumentIntelligenceClient(endpoint, AzureKeyCredential(api_key))


def is_configured() -> bool:
    """Return True if Azure Document Intelligence env vars are set."""
    return bool(
        os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        and os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
    )


def extract_text_from_bytes(
    pdf_bytes: bytes,
    *,
    max_pages: Optional[int] = None,
) -> OcrResult:
    """
    Run OCR on raw PDF bytes using Azure Document Intelligence prebuilt-read.

    Fetches up to max_pages pages. If the document has more pages than the cap,
    OcrResult.capped is True so callers can flag the record accordingly.

    Raises RuntimeError if not configured or the SDK is missing.
    """
    from azure.ai.documentintelligence.models import AnalyzeDocumentRequest

    page_cap = max_pages if max_pages is not None else _MAX_PAGES_DEFAULT
    client = _get_client()

    # Build a page range string like "1-20" to cap server-side processing cost.
    pages_param = f"1-{page_cap}"

    logger.debug("[AzureOCR] Submitting %d bytes for OCR (page cap: %s)", len(pdf_bytes), pages_param)

    poller = client.begin_analyze_document(
        "prebuilt-read",
        AnalyzeDocumentRequest(bytes_source=pdf_bytes),
        pages=pages_param,
    )
    result = poller.result()

    actual_page_count = len(result.pages) if result.pages else 0

    # Concatenate content from each page.
    lines: list[str] = []
    pages_processed = 0
    for page in (result.pages or []):
        pages_processed += 1
        for line in (page.lines or []):
            content = (line.content or "").strip()
            if content:
                lines.append(content)

    text = "\n".join(lines)

    # We asked for pages 1–cap. If the doc has more pages than cap, we only
    # got a partial view. Azure returns only the requested range, so we use
    # the actual_page_count returned vs the cap to determine if we hit the limit.
    # When capped, Azure's result.pages length == cap; when not, it's the full doc.
    capped = pages_processed >= page_cap

    logger.info(
        "[AzureOCR] Complete — pages_processed=%d capped=%s text_chars=%d",
        pages_processed,
        capped,
        len(text),
    )
    return OcrResult(
        text=text,
        page_count=actual_page_count,
        pages_processed=pages_processed,
        capped=capped,
    )
