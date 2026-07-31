"""
Chunk and embed Microsoft Graph documents into document_chunks.

Called after sync for any document_metadata row with status in
('raw_ingested', 'segmented', 'compiled', 'error', 'ocr_partial')
and source='microsoft_graph' (emails, Teams messages, OneDrive files).
ocr_partial rows are scanned PDFs where Azure OCR hit the page cap — they
have partial text and should be embedded so they're searchable.

Uses text-embedding-3-large at native 3072 dimensions to match the existing
pgvector columns.
"""
from __future__ import annotations

import hashlib
import logging
import os
import posixpath
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from ...ai_transport import (
    alternate_provider_path,
    get_ai_provider_path,
    get_openai_client,
    is_auth_or_credit_error,
    retry_ai_call,
)
from ...pipeline.model_usage import (
    ModelUsageContext,
    assert_background_model_budget_available,
    record_model_usage,
)
from ...pipeline.source_processing import (
    SourceProcessingContext,
    record_source_processing_status,
    status_for_project_assignment,
)
from ...supabase_helpers import (
    get_rag_read_client,
    get_rag_write_client,
    rag_database_writes_enabled,
    rag_supabase_configured,
)

logger = logging.getLogger(__name__)

CHUNK_MAX_CHARS = 3000
CHUNK_OVERLAP_CHARS = 400
MIN_EMBEDDABLE_CHARS_BY_TYPE = {
    "teams_dm_conversation": 200,
    "teams_message": 200,
    "email": 300,
}
EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIMENSIONS = 3072
# After this many consecutive failed embed attempts a document is parked at the
# terminal app status 'embed_failed' so it stops being re-pulled (and re-billed)
# every run. With provider failover in place this cap is only reached when BOTH
# providers are down or a specific document is genuinely unembeddable — either
# way it must surface loudly as a parked failure, never loop silently.
EMBED_MAX_ATTEMPTS = 6
INTENTIONAL_EMBEDDING_EXCLUSION_STATUS = "intentionally_excluded"
GRAPH_REHYDRATED_STORAGE_PREFIX = "graph-rehydrated"
def _is_interview_title(title: Optional[str]) -> bool:
    return "interview" in str(title or "").lower()


def _mark_intentionally_excluded(supabase_client, rag_client, doc: Dict[str, Any], reason: str) -> None:
    metadata_id = str(doc.get("id") or "")
    if not metadata_id:
        return
    supabase_client.from_("document_metadata").update(
        {"status": INTENTIONAL_EMBEDDING_EXCLUSION_STATUS}
    ).eq("id", metadata_id).execute()
    try:
        rag_client.from_("document_chunks").delete().eq("document_id", metadata_id).execute()
        rag_client.from_("rag_document_metadata").upsert(
            {
                "id": metadata_id,
                "app_document_id": metadata_id,
                "title": doc.get("title"),
                "source": doc.get("source"),
                "type": doc.get("type"),
                "category": doc.get("category"),
                "embedding_status": INTENTIONAL_EMBEDDING_EXCLUSION_STATUS,
                "processing_metadata": {
                    "embedding_exclusion": {
                        "code": "interview_title_excluded",
                        "message": reason,
                        "intentional": True,
                    }
                },
            }
        ).execute()
    except Exception as exc:
        logger.warning("[GraphEmbed] Could not persist intentional exclusion for %s: %s", metadata_id, exc)


def _upsert_rag_content_payload(
    rag_client,
    doc: Dict[str, Any],
    *,
    content: str,
    storage_bucket: Optional[str] = None,
    storage_path: Optional[str] = None,
    repair_source: Optional[str] = None,
) -> None:
    metadata_id = str(doc.get("id") or "")
    if not metadata_id or not content:
        return

    processing_metadata = {"app_status": doc.get("status")}
    if repair_source:
        processing_metadata["rehydrated_from"] = repair_source

    rag_client.from_("rag_document_metadata").upsert(
        {
            "id": metadata_id,
            "app_document_id": metadata_id,
            "project_id": doc.get("project_id"),
            "source": doc.get("source"),
            "source_system": doc.get("source_system"),
            "source_item_id": doc.get("source_item_id"),
            "title": doc.get("title"),
            "type": doc.get("type"),
            "category": doc.get("category"),
            "storage_bucket": storage_bucket or doc.get("storage_bucket"),
            "storage_path": storage_path or doc.get("file_path") or doc.get("source_path"),
            "source_web_url": doc.get("source_web_url"),
            "content": content,
            "raw_text": content,
            "content_length": len(content),
            "parsing_status": doc.get("status"),
            "processing_metadata": processing_metadata,
            "last_content_loaded_at": datetime.utcnow().isoformat(),
        }
    ).execute()


def _upsert_rag_embedding_success(
    rag_client,
    doc: Dict[str, Any],
    *,
    content: str,
    chunk_count: int,
    source_type: str,
) -> None:
    metadata_id = str(doc.get("id") or "")
    if not metadata_id:
        return

    payload: Dict[str, Any] = {
        "id": metadata_id,
        "app_document_id": metadata_id,
        "project_id": doc.get("project_id"),
        "source": doc.get("source"),
        "source_system": doc.get("source_system"),
        "source_item_id": doc.get("source_item_id"),
        "title": doc.get("title"),
        "type": doc.get("type"),
        "category": doc.get("category"),
        "storage_bucket": doc.get("storage_bucket"),
        "storage_path": doc.get("file_path") or doc.get("source_path"),
        "source_web_url": doc.get("source_web_url"),
        "content_length": len(content or ""),
        "embedding_status": "embedded",
        "embedding_attempts": 0,
        "embedding_error": None,
        "parsing_status": doc.get("status"),
        "processing_metadata": {
            "app_status": doc.get("status"),
            "chunk_count": chunk_count,
            "source_type": source_type,
            "embedding_path": "microsoft_graph.embed_graph_document",
        },
        "last_content_loaded_at": datetime.utcnow().isoformat(),
    }
    if content:
        payload["content"] = content
        payload["raw_text"] = content

    rag_client.from_("rag_document_metadata").upsert(payload).execute()


def _update_app_document_status(supabase_client, metadata_id: str, status: str, *, enabled: bool = True) -> None:
    if not enabled:
        return
    try:
        supabase_client.from_("document_metadata").update({"status": status}).eq("id", metadata_id).execute()
    except Exception as exc:
        logger.warning("[GraphEmbed] Could not update PM APP status for %s: %s", metadata_id, exc)


def _decode_storage_bytes(payload: Any) -> str:
    if payload is None:
        return ""
    if isinstance(payload, bytes):
        return payload.decode("utf-8", errors="ignore").replace("\x00", "").strip()
    if hasattr(payload, "decode"):
        return payload.decode("utf-8", errors="ignore").replace("\x00", "").strip()
    return str(payload).replace("\x00", "").strip()


def _fallback_storage_path(doc: Dict[str, Any]) -> str:
    source_system = str(doc.get("source_system") or "graph").strip().lower() or "graph"
    item_id = str(doc.get("source_item_id") or doc.get("id") or "unknown")
    return posixpath.join(GRAPH_REHYDRATED_STORAGE_PREFIX, source_system, f"{item_id}.txt")


def _rehydrate_graph_document_content(
    supabase_client,
    rag_client,
    doc: Dict[str, Any],
) -> str:
    storage_bucket = str(doc.get("storage_bucket") or "documents")
    file_path = str(doc.get("file_path") or "").strip()
    if file_path:
        try:
            payload = supabase_client.storage.from_(storage_bucket).download(file_path)
            content = _decode_storage_bytes(payload)
            if content:
                _upsert_rag_content_payload(
                    rag_client,
                    doc,
                    content=content,
                    storage_bucket=storage_bucket,
                    storage_path=file_path,
                    repair_source="storage_text",
                )
                return content
        except Exception as exc:
            logger.warning("[GraphEmbed] Storage rehydrate failed for %s: %s", doc.get("id"), exc)

    source_system = str(doc.get("source_system") or "").lower()
    source_drive_id = doc.get("source_drive_id")
    source_item_id = doc.get("source_item_id")
    if source_system not in {"onedrive", "sharepoint"} or not source_drive_id or not source_item_id:
        return ""

    try:
        from .client import get_graph_client
        from .onedrive import _extract_text

        graph = get_graph_client()
        if not graph.is_configured():
            return ""

        item = graph.get(f"/drives/{source_drive_id}/items/{source_item_id}")
        download_url = item.get("@microsoft.graph.downloadUrl", "")
        if not download_url:
            return ""

        raw_bytes = graph.download_bytes(download_url)
        name = str(doc.get("title") or item.get("name") or source_item_id)
        ext = os.path.splitext(name)[1].lower()
        content = _extract_text(raw_bytes, ext).replace("\x00", "").strip()
        if not content:
            return ""

        if not file_path:
            file_path = _fallback_storage_path(doc)
            try:
                supabase_client.storage.from_(storage_bucket).upload(
                    file_path,
                    content.encode("utf-8"),
                    {"content-type": "text/plain", "upsert": "true"},
                )
            except Exception:
                try:
                    supabase_client.storage.from_(storage_bucket).update(
                        file_path,
                        content.encode("utf-8"),
                        {"content-type": "text/plain", "upsert": "true"},
                    )
                except Exception as exc:
                    logger.warning(
                        "[GraphEmbed] Could not persist rehydrated storage text for %s: %s",
                        doc.get("id"),
                        exc,
                    )
            try:
                supabase_client.from_("document_metadata").update(
                    {
                        "storage_bucket": storage_bucket,
                        "file_path": file_path,
                    }
                ).eq("id", doc.get("id")).execute()
            except Exception as exc:
                logger.warning(
                    "[GraphEmbed] Could not backfill storage path for %s: %s",
                    doc.get("id"),
                    exc,
                )

        _upsert_rag_content_payload(
            rag_client,
            doc,
            content=content,
            storage_bucket=storage_bucket,
            storage_path=file_path,
            repair_source="graph_source",
        )
        return content
    except Exception as exc:
        logger.warning("[GraphEmbed] Graph rehydrate failed for %s: %s", doc.get("id"), exc)
        return ""


def _mark_graph_content_missing_error(supabase_client, rag_client, doc: Dict[str, Any]) -> None:
    metadata_id = str(doc.get("id") or "")
    if not metadata_id:
        return
    message = (
        "GRAPH_CONTENT_MISSING: document_metadata exists, but no RAG content, storage text, "
        "or Graph-downloadable payload was available to embed."
    )
    supabase_client.from_("document_metadata").update({"status": "error"}).eq("id", metadata_id).execute()
    rag_client.from_("rag_document_metadata").upsert(
        {
            "id": metadata_id,
            "app_document_id": metadata_id,
            "title": doc.get("title"),
            "source": doc.get("source"),
            "source_system": doc.get("source_system"),
            "source_item_id": doc.get("source_item_id"),
            "type": doc.get("type"),
            "category": doc.get("category"),
            "embedding_status": "error",
            "parsing_status": "error",
            "processing_metadata": {
                "embedding_error": {
                    "code": "graph_content_missing",
                    "message": message,
                    "intentional": False,
                }
            },
        }
    ).execute()




def _split_text(text: str) -> List[str]:
    """Split text into overlapping chunks at sentence boundaries."""
    if len(text) <= CHUNK_MAX_CHARS:
        return [text] if text.strip() else []

    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)
    chunks: List[str] = []
    current: List[str] = []
    current_len = 0

    for sentence in sentences:
        slen = len(sentence)
        if current_len + slen > CHUNK_MAX_CHARS and current:
            chunks.append(" ".join(current))
            # Keep overlap tail
            overlap: List[str] = []
            overlap_len = 0
            for s in reversed(current):
                if overlap_len + len(s) <= CHUNK_OVERLAP_CHARS:
                    overlap.insert(0, s)
                    overlap_len += len(s)
                else:
                    break
            current = overlap
            current_len = overlap_len
        current.append(sentence)
        current_len += slen

    if current:
        chunks.append(" ".join(current))
    return chunks


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _source_type_for_document(doc: Dict[str, Any]) -> str:
    category = doc.get("category")
    if category in ("training_guide", "training_resource"):
        return str(category)
    source_system = doc.get("source_system") or ""
    if category == "teams_message":
        doc_type = doc.get("type")
        if doc_type in ("teams_dm_conversation", "teams_dm"):
            return "teams_dm"
        if doc_type == "teams_message":
            return "teams_channel"
        return "teams_message"
    if category == "email":
        return "email"
    if category == "document":
        if source_system == "sharepoint":
            return "sharepoint_document"
        return "onedrive_document"
    if category == "email_attachment":
        return "email_attachment"
    return "microsoft_graph"


def _vision_page_chunks(supabase_client, metadata_id: str) -> List[Dict[str, Any]]:
    try:
        resp = (
            supabase_client.table("document_page_intelligence")
            .select(
                "page_number, sheet_number, sheet_title, discipline, ai_summary,"
                "implied_submittals, notes_and_requirements"
            )
            .eq("document_metadata_id", metadata_id)
            .order("page_number")
            .execute()
        )
    except Exception as exc:
        logger.warning("[GraphEmbed] Could not load vision page intelligence for %s: %s", metadata_id, exc)
        return []

    chunks: List[Dict[str, Any]] = []
    for page in resp.data or []:
        summary = str(page.get("ai_summary") or "").strip()
        if not summary:
            continue
        extras: List[str] = []
        if page.get("sheet_number"):
            extras.append(f"Sheet: {page['sheet_number']}")
        if page.get("sheet_title"):
            extras.append(f"Title: {page['sheet_title']}")
        if page.get("discipline"):
            extras.append(f"Discipline: {page['discipline']}")
        if page.get("implied_submittals"):
            extras.append("Implied submittals: " + ", ".join(page["implied_submittals"]))
        if page.get("notes_and_requirements"):
            extras.append("Key notes: " + "; ".join(page["notes_and_requirements"][:5]))
        chunks.append({
            "page_number": page.get("page_number") or len(chunks) + 1,
            "text": "\n".join(extras + [summary]) if extras else summary,
        })
    return chunks


def _source_processing_context(doc: Dict[str, Any]) -> SourceProcessingContext:
    metadata_id = str(doc.get("id") or "")
    source_system = str(doc.get("source_system") or doc.get("category") or "microsoft_graph")
    source_item_id = str(doc.get("source_item_id") or metadata_id)
    return SourceProcessingContext(
        source_system=source_system,
        source_item_id=source_item_id,
        content_hash=str(doc.get("content_hash") or ""),
        source_document_id=metadata_id,
        project_id=doc.get("project_id"),
        source_title=doc.get("title"),
        source_url=doc.get("source_web_url") or doc.get("source_path"),
        occurred_at=doc.get("date"),
        metadata={
            "category": doc.get("category"),
            "source": doc.get("source"),
            "type": doc.get("type"),
            "embedding_path": "microsoft_graph.embed_graph_document",
        },
    )


def _min_embeddable_chars(doc: Dict[str, Any]) -> int:
    doc_type = str(doc.get("type") or "")
    category = str(doc.get("category") or "")
    return MIN_EMBEDDABLE_CHARS_BY_TYPE.get(
        doc_type,
        MIN_EMBEDDABLE_CHARS_BY_TYPE.get(category, 1),
    )


def _substantive_text_length(text: str) -> int:
    without_markers = re.sub(r"\[[^\]]+\]", " ", text)
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9'-]*", without_markers.lower())
    filler = {
        "ok",
        "okay",
        "thanks",
        "thank",
        "thx",
        "yes",
        "no",
        "sent",
        "done",
        "got",
        "good",
    }
    return sum(len(token) for token in tokens if len(token) > 2 and token not in filler)


def _batch_embed(texts: List[str]) -> List[List[float]]:
    """Embed a batch of texts via OpenAI."""
    if not texts:
        return []

    truncated = [t[:8000] for t in texts]
    usage_context = ModelUsageContext(
        stage="indexed_for_rag",
        operation="graph_embedding_batch",
        budget_bucket="embedding",
    )
    assert_background_model_budget_available(
        stage=usage_context.stage,
        operation=usage_context.operation,
        model=EMBEDDING_MODEL,
        budget_bucket=usage_context.budget_bucket,
        usage_context=usage_context,
    )

    def _create(force_path: Optional[str] = None):
        return retry_ai_call(
            lambda: get_openai_client(force_path=force_path).embeddings.create(
                model=EMBEDDING_MODEL,
                input=truncated,
                dimensions=EMBEDDING_DIMENSIONS,
            ),
            provider_name="OpenAI" if force_path == "openai" else "AI provider",
            operation="graph embedding batch",
        )

    primary_path = get_ai_provider_path()
    actual_provider_path = primary_path
    try:
        response = _create()
    except Exception as exc:
        # Provider-level auth/credit wall (e.g. AI Gateway spend cap hit mid-run,
        # returning a selective 401). Retrying the same provider fails identically,
        # so fail over to the other provider if it is configured. This is what
        # keeps the pipeline alive through a gateway cap-out without a deploy or
        # env change — the historical root cause of silent embedding outages.
        alt_path = alternate_provider_path(primary_path)
        if alt_path is not None and is_auth_or_credit_error(exc):
            logger.warning(
                "[GraphEmbed] Primary provider '%s' hit an auth/credit wall (%s); "
                "failing over to '%s' for this batch.",
                primary_path,
                exc,
                alt_path,
            )
            actual_provider_path = alt_path
            response = _create(force_path=alt_path)
        else:
            raise
    embeddings = [item.embedding for item in response.data]
    record_model_usage(
        usage_context,
        model=EMBEDDING_MODEL,
        provider=actual_provider_path,
        response=response,
        input_items=len(texts),
        output_items=len(embeddings),
    )
    if len(embeddings) != len(texts):
        raise RuntimeError(f"expected {len(texts)} embeddings, got {len(embeddings)}")
    if any(len(e) != EMBEDDING_DIMENSIONS for e in embeddings):
        raise RuntimeError(f"one or more embeddings did not have {EMBEDDING_DIMENSIONS} dimensions")
    logger.info("[GraphEmbed] Embedded %d chunks via OpenAI with %s (dim=%d)", len(texts), EMBEDDING_MODEL, EMBEDDING_DIMENSIONS)
    return embeddings


def _record_embed_failure(
    supabase_client,
    metadata_id: str,
    exc: Exception,
    *,
    has_app_document: bool,
    source_context: Any,
) -> None:
    """Persist a real embedding failure with a bounded retry counter.

    This is the antidote to the poison-pill loop: instead of leaving the doc at
    NULL embedding_status (re-pulled forever), we record the error, increment an
    attempt counter, and after EMBED_MAX_ATTEMPTS park the doc at the terminal
    app status 'embed_failed' so it stops being re-pulled/re-billed and shows up
    loudly as a parked failure in health + the /rag dashboard.
    """
    error_text = str(exc)[:1000]
    rag_write = get_rag_write_client()

    attempts = 1
    try:
        rows = (
            get_rag_read_client()
            .from_("rag_document_metadata")
            .select("embedding_attempts")
            .eq("id", metadata_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        attempts = int((rows[0] if rows else {}).get("embedding_attempts") or 0) + 1
    except Exception as read_exc:  # noqa: BLE001 - best-effort counter
        logger.warning("[GraphEmbed] Could not read embedding_attempts for %s: %s", metadata_id, read_exc)

    try:
        rag_write.from_("rag_document_metadata").update(
            {
                "embedding_status": "error",
                "embedding_error": error_text,
                "embedding_attempts": attempts,
                "embedding_last_attempt_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", metadata_id).execute()
    except Exception as write_exc:  # noqa: BLE001
        logger.warning("[GraphEmbed] Could not persist embed failure for %s: %s", metadata_id, write_exc)

    parked = attempts >= EMBED_MAX_ATTEMPTS
    if parked:
        # Terminal app status removes the doc from the candidate query so it
        # stops re-failing/re-billing every run. It remains chunk-less, so health
        # still counts it as unembedded backlog and alerts on it.
        _update_app_document_status(supabase_client, metadata_id, "embed_failed", enabled=has_app_document)
        logger.error(
            "[GraphEmbed] %s parked as embed_failed after %d attempts: %s",
            metadata_id,
            attempts,
            error_text,
        )

    try:
        record_source_processing_status(
            source_context,
            status="failed_permanent" if parked else "failed_retryable",
            error_code=exc.__class__.__name__,
            error_message=error_text,
            metadata={"embedding_attempts": attempts, "parked": parked},
        )
    except Exception as rec_exc:  # noqa: BLE001
        logger.warning("[GraphEmbed] Could not record source processing status for %s: %s", metadata_id, rec_exc)


def embed_graph_document(supabase_client, metadata_id: str) -> int:
    """
    Chunk and embed a single document_metadata row into document_chunks.
    Updates document_metadata.status to 'embedded' on success.
    Returns the number of chunks written.
    """
    rag_client = get_rag_write_client()

    def _clear_ingestion_error(stage: str) -> None:
        try:
            rag_client.from_("fireflies_ingestion_jobs").update(
                {"stage": stage, "error_message": None}
            ).eq("metadata_id", metadata_id).execute()
        except Exception as exc:
            logger.warning("[GraphEmbed] Could not clear ingestion error for %s: %s", metadata_id, exc)

    # Fetch document
    has_app_document = True
    try:
        resp = (
            supabase_client.from_("document_metadata")
            .select(
                "id, title, category, source, date, participants, tags, project_id, type, "
                "document_type, status, source_system, source_item_id, source_drive_id, "
                "source_site_id, source_path, source_web_url, file_path, storage_bucket, content_hash"
            )
            .eq("id", metadata_id)
            .single()
            .execute()
        )
        doc = resp.data
    except Exception as e:
        logger.info(
            "[GraphEmbed] App document_metadata missing for %s; falling back to RAG metadata: %s",
            metadata_id,
            e,
        )
        try:
            rag_meta = (
                get_rag_read_client()
                .from_("rag_document_metadata")
                .select(
                    "id,title,category,source,project_id,type,source_system,source_item_id,"
                    "source_web_url,storage_bucket,storage_path,content_hash"
                )
                .eq("id", metadata_id)
                .single()
                .execute()
                .data
                or {}
            )
        except Exception as rag_exc:
            logger.error(
                "[GraphEmbed] Failed to fetch RAG metadata %s: %s",
                metadata_id,
                rag_exc,
            )
            return 0

        doc = {
            **rag_meta,
            "file_path": rag_meta.get("storage_path"),
            "source_path": rag_meta.get("storage_path"),
            "status": "repair",
        }
        has_app_document = False

    if not doc:
        logger.warning("[GraphEmbed] Document %s not found", metadata_id)
        return 0

    title = doc.get("title") or "Untitled"
    source_context = _source_processing_context(doc)
    record_source_processing_status(
        source_context,
        status=status_for_project_assignment(doc.get("project_id")),
        metadata={"document_status": doc.get("status")},
    )
    if _is_interview_title(title):
        reason = (
            'INTENTIONALLY_EXCLUDED: Document title contains "Interview", '
            "so it is intentionally excluded from embedding/vectorization."
        )
        _mark_intentionally_excluded(supabase_client, rag_client, doc, reason)
        _clear_ingestion_error("done")
        record_source_processing_status(
            source_context,
            status=INTENTIONAL_EMBEDDING_EXCLUSION_STATUS,
            error_code="interview_title_excluded",
            error_message=reason,
        )
        logger.info("[GraphEmbed] %s intentionally excluded from embedding: interview title", metadata_id)
        return 0

    try:
        rag_doc = (
            get_rag_read_client()
            .from_("rag_document_metadata")
            .select("content,raw_text")
            .eq("id", metadata_id)
            .single()
            .execute()
            .data
            or {}
        )
    except Exception as exc:
        logger.warning("[GraphEmbed] Failed to hydrate RAG metadata for %s: %s", metadata_id, exc)
        rag_doc = {}
    content = (rag_doc.get("content") or rag_doc.get("raw_text") or "").strip()
    if not content:
        content = _rehydrate_graph_document_content(supabase_client, rag_client, doc)

    vision_chunks = _vision_page_chunks(supabase_client, metadata_id)

    if not content and not vision_chunks:
        if str(doc.get("source_system") or "").lower() in {"onedrive", "sharepoint"}:
            logger.error("[GraphEmbed] Document %s missing Graph content after rehydrate attempt", metadata_id)
            _mark_graph_content_missing_error(supabase_client, rag_client, doc)
            record_source_processing_status(
                source_context,
                status="failed_permanent",
                error_code="graph_content_missing",
                error_message="Graph document has no RAG content, storage text, or downloadable payload.",
            )
            return 0
        logger.warning("[GraphEmbed] Document %s has no content — marking skipped_low_content", metadata_id)
        rag_client.from_("document_chunks").delete().eq("document_id", metadata_id).execute()
        _update_app_document_status(supabase_client, metadata_id, "skipped_low_content", enabled=has_app_document)
        get_rag_write_client().from_("rag_document_metadata").update(
            {"embedding_status": "skipped"}
        ).eq("id", metadata_id).execute()
        _clear_ingestion_error("embedded")
        record_source_processing_status(
            source_context,
            status=INTENTIONAL_EMBEDDING_EXCLUSION_STATUS,
            error_code="skipped_low_content",
            error_message="Graph source item had no embeddable text content.",
        )
        return 0

    substantive_chars = _substantive_text_length(content) if content else 0
    min_chars = _min_embeddable_chars(doc)
    if content and substantive_chars < min_chars and not vision_chunks:
        logger.info(
            "[GraphEmbed] Document %s skipped_low_content (%d < %d chars)",
            metadata_id,
            substantive_chars,
            min_chars,
        )
        rag_client.from_("document_chunks").delete().eq("document_id", metadata_id).execute()
        _update_app_document_status(
            supabase_client,
            metadata_id,
            "skipped_low_content",
            enabled=has_app_document,
        )
        get_rag_write_client().from_("rag_document_metadata").update(
            {"embedding_status": "skipped"}
        ).eq("id", metadata_id).execute()
        _clear_ingestion_error("embedded")
        record_source_processing_status(
            source_context,
            status=INTENTIONAL_EMBEDDING_EXCLUSION_STATUS,
            error_code="skipped_low_content",
            error_message=f"Substantive text length {substantive_chars} below minimum {min_chars}.",
        )
        return 0

    # Prepend title for better retrieval context. Some drawing PDFs have no
    # OCR text but do have vision page intelligence; those are valid
    # vision-only vector records.
    chunks: List[str] = []
    if content and substantive_chars >= min_chars:
        full_text = f"[{title}]\n\n{content}"
        chunks = _split_text(full_text)
    if not chunks and not vision_chunks:
        _update_app_document_status(supabase_client, metadata_id, "embedded", enabled=has_app_document)
        get_rag_write_client().from_("rag_document_metadata").update(
            {"embedding_status": "embedded"}
        ).eq("id", metadata_id).execute()
        _clear_ingestion_error("embedded")
        record_source_processing_status(
            source_context,
            status="failed_permanent",
            error_code="no_chunks",
            error_message="Text was present but produced no chunks.",
        )
        return 0

    chunk_texts = [*chunks, *[chunk["text"] for chunk in vision_chunks]]

    # Embed all chunks. Do not write unembedded chunks or mark the document
    # complete if the provider path is broken.
    #
    # POISON-PILL GUARD: previously this call sat outside any try/except, so a
    # provider auth/credit failure propagated up leaving rag_document_metadata
    # at NULL forever — the candidate query then re-pulled the same docs every
    # run (infinite re-fail + re-bill, invisible). Now a failure persists the
    # real error + a bounded attempt counter, and after EMBED_MAX_ATTEMPTS the
    # doc is parked at terminal app status 'embed_failed' so it surfaces loudly
    # in health instead of looping silently.
    try:
        embeddings = _batch_embed(chunk_texts)
    except Exception as embed_exc:
        _record_embed_failure(
            supabase_client,
            metadata_id,
            embed_exc,
            has_app_document=has_app_document,
            source_context=source_context,
        )
        raise

    # Build chunk rows
    base_metadata: Dict[str, Any] = {
        "title": title,
        "metadata_id": metadata_id,
        "source_web_url": doc.get("source_web_url"),
        "url": doc.get("source_web_url"),
        "category": doc.get("category"),
        "source": doc.get("source"),
        "type": doc.get("type"),
        "document_type": doc.get("document_type"),
        "date": doc.get("date"),
        "project_id": doc.get("project_id"),
        "participants": doc.get("participants"),
        "tags": doc.get("tags"),
    }
    source_type = _source_type_for_document(doc)

    rows = []
    for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_id = f"{metadata_id}__chunk_{i}"
        row: Dict[str, Any] = {
            "document_id": metadata_id,
            "chunk_index": i,
            "chunk_id": chunk_id,
            "text": chunk_text,
            "metadata": {**base_metadata, "chunk_index": i, "total_chunks": len(chunks)},
            "content_hash": _content_hash(chunk_text),
            "source_type": source_type,
        }
        if embedding:
            row["embedding"] = embedding
        rows.append(row)

    vision_offset = len(chunks)
    for i, chunk in enumerate(vision_chunks):
        chunk_index = vision_offset + i
        chunk_text = chunk["text"]
        embedding = embeddings[chunk_index] if chunk_index < len(embeddings) else None
        chunk_id = f"{metadata_id}__vision_page_{chunk.get('page_number') or i + 1}"
        row = {
            "document_id": metadata_id,
            "chunk_index": chunk_index,
            "chunk_id": chunk_id,
            "text": chunk_text,
            "metadata": {
                **base_metadata,
                "chunk_index": chunk_index,
                "total_chunks": len(chunk_texts),
                "chunk_type": "vision_page",
                "page_number": chunk.get("page_number"),
            },
            "content_hash": _content_hash(chunk_text),
            "source_type": "vision_page_summary",
        }
        if embedding:
            row["embedding"] = embedding
        rows.append(row)

    # Delete old chunks for this document (re-embed case), then insert fresh
    try:
        rag_client.from_("document_chunks").delete().eq("document_id", metadata_id).execute()
        # Upsert in batches of 50 to avoid payload limits
        batch_size = 50
        for start in range(0, len(rows), batch_size):
            rag_client.from_("document_chunks").upsert(rows[start:start + batch_size]).execute()
    except Exception as e:
        logger.error("[GraphEmbed] Failed to write chunks for %s: %s", metadata_id, e)
        supabase_client.from_("document_metadata").update(
            {"status": "error"}
        ).eq("id", metadata_id).execute()
        record_source_processing_status(
            source_context,
            status="failed_retryable",
            error_code=e.__class__.__name__,
            error_message=str(e),
        )
        return 0

    # Mark embedded in PM APP
    _update_app_document_status(supabase_client, metadata_id, "embedded", enabled=has_app_document)

    # Mark embedded in RAG DB so the supplement scan doesn't re-process this doc.
    # Upsert, rather than update-only, so vision-only PDF recovery cannot leave
    # searchable chunks without citation/status metadata.
    try:
        _upsert_rag_embedding_success(
            get_rag_write_client(),
            doc,
            content=content,
            chunk_count=len(rows),
            source_type=source_type,
        )
    except Exception as e:
        logger.warning("[GraphEmbed] Could not update RAG embedding_status for %s: %s", metadata_id, e)

    _clear_ingestion_error("embedded")
    record_source_processing_status(
        source_context,
        status="indexed_for_rag",
        metadata={"chunk_count": len(rows), "source_type": source_type},
    )
    record_source_processing_status(source_context, status="complete")
    logger.info("[GraphEmbed] %s → %d chunks embedded", metadata_id, len(rows))
    return len(rows)


def embed_pending_graph_documents(supabase_client, limit: int = 100) -> Dict[str, Any]:
    """
    Find all document_metadata rows with source='microsoft_graph' that still need
    embedding. Picks up raw/segmented rows, content-bearing error rows that can
    be retried, and rows that were accidentally routed through the Fireflies
    segmenter instead of the graph embed path. Also repairs recent communication
    rows that were marked embedded/complete before chunks were written, because
    those rows otherwise look successful while remaining invisible to retrieval.

    Returns summary dict.
    """
    started_at = datetime.now(timezone.utc)
    docs: List[Dict[str, Any]] = []
    try:
        try:
            docs = _fetch_graph_embedding_candidates(limit)
        except Exception as exc:
            logger.warning(
                "[GraphEmbed] SQL candidate query failed; falling back to Supabase scan: %s",
                exc,
            )
            docs = None
        if docs is None:
            docs = _fetch_graph_embedding_candidates_via_supabase(supabase_client, limit)
    except Exception as e:
        logger.error("[GraphEmbed] Failed to query pending docs: %s", e)
        _record_graph_embed_run(
            supabase_client,
            started_at=started_at,
            status="failed",
            items_failed=1,
            error_message=str(e),
            metadata={"limit": limit, "stage": "query_pending"},
        )
        return {"embedded": 0, "errors": 1}

    if not docs:
        # Guardrail: the candidate query returning 0 should mean nothing is
        # actually pending. If document_metadata still has rows matching the
        # status filter, the candidate query has drifted from reality (e.g. a
        # column filter that no longer applies post-schema-change). Surface
        # that as a warning so it can't fail silently again — this is exactly
        # how the 2026-05-14 incident hid for five days.
        unfetchable_pending = _count_pending_status_rows(supabase_client)
        status_value = "warning" if unfetchable_pending > 0 else "succeeded"
        if unfetchable_pending > 0:
            logger.warning(
                "[GraphEmbed] No candidates returned but %d microsoft_graph rows still match the "
                "raw_ingested/segmented/compiled/error status filter — candidate query may be stale",
                unfetchable_pending,
            )
        else:
            logger.info("[GraphEmbed] No pending microsoft_graph documents to embed")
        _record_graph_embed_run(
            supabase_client,
            started_at=started_at,
            status=status_value,
            metadata={
                "limit": limit,
                "pending": 0,
                "unfetchable_pending": unfetchable_pending,
            },
            error_message=(
                f"{unfetchable_pending} rows match status filter but candidate query returned 0"
                if unfetchable_pending > 0
                else None
            ),
        )
        result: Dict[str, Any] = {"embedded": 0, "errors": 0}
        if unfetchable_pending > 0:
            result["unfetchable_pending"] = unfetchable_pending
        return result

    enabled_docs = [doc for doc in docs if _graph_embedding_candidate_enabled(doc)]
    skipped_disabled = len(docs) - len(enabled_docs)
    if skipped_disabled:
        logger.info(
            "[GraphEmbed] Skipping %d disabled legacy Graph candidates (OneDrive sync disabled)",
            skipped_disabled,
        )
    docs = enabled_docs
    if not docs:
        _record_graph_embed_run(
            supabase_client,
            started_at=started_at,
            status="succeeded",
            metadata={"limit": limit, "pending": 0, "skipped_disabled": skipped_disabled},
        )
        return {"embedded": 0, "errors": 0, "skipped_disabled": skipped_disabled}

    logger.info("[GraphEmbed] Processing %d pending microsoft_graph documents", len(docs))
    total_chunks = 0
    errors = 0
    skipped = 0
    by_category: Dict[str, int] = {}

    for doc in docs:
        doc_id = doc["id"]
        category = doc.get("category", "unknown")
        try:
            n = embed_graph_document(supabase_client, doc_id)
            if n <= 0:
                terminal_status = _rag_embedding_status(doc_id)
                if terminal_status in {"embedded", "skipped", "intentionally_excluded"}:
                    logger.info(
                        "[GraphEmbed] %s produced zero chunks and is terminal status=%s; counting as skipped",
                        doc_id,
                        terminal_status,
                    )
                    skipped += 1
                    continue
                logger.error("[GraphEmbed] %s produced zero chunks; treating as failed embedding", doc_id)
                errors += 1
                continue
            total_chunks += n
            by_category[category] = by_category.get(category, 0) + 1
        except Exception as e:
            logger.error("[GraphEmbed] Error embedding %s: %s", doc_id, e)
            errors += 1
        # Throttle DB writes — without this, 1000 docs fire hundreds of queries
        # per second and saturate the Supabase connection pool.
        time.sleep(0.1)

    logger.info(
        "[GraphEmbed] Done — %d docs embedded (%d skipped, %d total chunks, %d errors). By category: %s",
        len(docs) - errors - skipped, skipped, total_chunks, errors, by_category,
    )
    result = {
        "embedded": len(docs) - errors - skipped,
        "skipped": skipped,
        "skipped_disabled": skipped_disabled,
        "total_chunks": total_chunks,
        "errors": errors,
        "by_category": by_category,
    }
    _record_graph_embed_run(
        supabase_client,
        started_at=started_at,
        status="failed" if errors == len(docs) else "warning" if errors else "succeeded",
        items_seen=len(docs),
        items_synced=result["embedded"],
        items_created=total_chunks,
        items_failed=errors,
        error_message=f"{errors} graph documents failed embedding" if errors else None,
        metadata={"limit": limit, **result},
    )
    return result


def enqueue_pending_graph_documents(
    supabase_client,
    limit: int = 100,
) -> Dict[str, Any]:
    """Queue pending Graph documents through the sole durable workflow owner.

    Scheduled Graph sync uses this path. ``embed_pending_graph_documents``
    remains an explicit single-stage repair utility, but it is not the
    production ordering/retry owner.
    """
    try:
        try:
            docs = _fetch_graph_embedding_candidates(limit)
        except Exception as exc:
            logger.warning(
                "[GraphWorkflow] SQL candidate query failed; falling back to Supabase scan: %s",
                exc,
            )
            docs = None
        if docs is None:
            docs = _fetch_graph_embedding_candidates_via_supabase(
                supabase_client,
                limit,
            )
    except Exception as exc:
        raise RuntimeError(
            f"Graph workflow candidate discovery failed: {exc}"
        ) from exc

    docs = [
        doc
        for doc in (docs or [])
        if _graph_embedding_candidate_enabled(doc)
    ]
    if not docs:
        return {"queued": 0, "errors": 0, "run_ids": []}

    from ...pipeline.workflow_client import enqueue_document_workflow

    rag_client = get_rag_write_client()
    queued = 0
    errors = 0
    runs: List[Dict[str, str]] = []
    error_details: List[Dict[str, str]] = []

    for doc in docs:
        document_id = str(doc.get("id") or "").strip()
        if not document_id:
            errors += 1
            error_details.append(
                {"document_id": "", "error": "candidate is missing id"}
            )
            continue
        source_type = str(
            doc.get("source_system")
            or doc.get("category")
            or "microsoft_graph"
        ).strip()
        try:
            result = enqueue_document_workflow(
                document_id,
                source_type=source_type,
            )
            run_id = str(result["runId"])
            supabase_client.from_("document_metadata").update(
                {"status": "workflow_queued"}
            ).eq("id", document_id).execute()
            rag_client.from_("rag_document_metadata").update(
                {"embedding_status": "workflow_queued"}
            ).eq("id", document_id).execute()
            record_source_processing_status(
                _source_processing_context(doc),
                status="workflow_queued",
                metadata={"run_id": run_id},
            )
            queued += 1
            runs.append({"document_id": document_id, "run_id": run_id})
        except Exception as exc:
            errors += 1
            error_details.append(
                {"document_id": document_id, "error": str(exc)}
            )
            logger.error(
                "[GraphWorkflow] Failed to queue %s: %s",
                document_id,
                exc,
            )

    return {
        "queued": queued,
        "errors": errors,
        "run_ids": runs,
        "error_details": error_details,
    }


def _graph_embedding_candidate_enabled(doc: Dict[str, Any]) -> bool:
    source_system = str(doc.get("source_system") or "").strip().lower()
    document_id = str(doc.get("id") or "").strip().lower()
    if source_system == "onedrive" or document_id.startswith("onedrive_"):
        return os.getenv("GRAPH_SYNC_ONEDRIVE", "false").lower() == "true"
    return True


def _rag_embedding_status(document_id: str) -> str:
    try:
        rows = (
            get_rag_read_client()
            .from_("rag_document_metadata")
            .select("embedding_status")
            .eq("id", document_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        return str((rows[0] if rows else {}).get("embedding_status") or "").strip().lower()
    except Exception as exc:  # noqa: BLE001 - caller only needs best-effort classification
        logger.warning("[GraphEmbed] Could not read RAG embedding_status for %s: %s", document_id, exc)
        return ""


def _count_pending_status_rows(supabase_client) -> int:
    """Count microsoft_graph rows still flagged as needing embedding.

    Used as a divergence detector: if the candidate fetch returns 0 but this
    count is > 0, the candidate query is filtering out rows that should be
    embedded. Matches the same date window the candidate query uses (365
    days) so old, intentionally-excluded rows don't generate false alarms.

    Returns 0 on any error so the guardrail never breaks the run.
    """
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=365)).date().isoformat()
        resp = (
            supabase_client.from_("document_metadata")
            .select("id", count="exact", head=True)
            .eq("source", "microsoft_graph")
            .in_("status", ["raw_ingested", "segmented", "compiled", "error", "ocr_partial"])
            .gte("date", cutoff)
            .execute()
        )
        return int(getattr(resp, "count", None) or 0)
    except Exception as exc:
        logger.warning("[GraphEmbed] Pending-status count failed: %s", exc)
        return 0


def _fetch_graph_embedding_candidates(limit: int) -> Optional[List[Dict[str, Any]]]:
    """Fetch Graph docs that need embedding using SQL anti-joins when DB access is available."""
    if rag_supabase_configured():
        # In split-RAG mode the anti-join spans app DB document_metadata and RAG DB
        # document_chunks/rag_document_metadata. The local SQL fast path only has one
        # connection and cannot query both databases, so using it causes false
        # relation errors or stale candidate sets. Force the Supabase fallback,
        # which merges app-DB status scans with RAG-DB candidate scans explicitly.
        return None

    database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not database_url:
        return None

    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except Exception as exc:
        logger.warning("[GraphEmbed] psycopg2 unavailable; falling back to Supabase scan: %s", exc)
        return None

    candidate_limit = max(limit * 4, limit)
    if rag_database_writes_enabled():
        # Post-RAG-split: document_metadata.content is always NULL because
        # SupabaseRagStore.upsert_document_metadata strips content/raw_text and
        # writes them to rag_document_metadata instead. Filtering by content
        # length here would always return zero rows. Trust status alone — the
        # embed step (embed_graph_document) hydrates content from
        # rag_document_metadata and marks empty docs as 'embedded' so they
        # aren't retried.
        query = """
        with pending as (
          select
            id,
            category,
            status,
            created_at,
            coalesce(captured_at, date, created_at::timestamptz) as source_at,
            captured_at,
            date
          from public.document_metadata
          where source = 'microsoft_graph'
            and status in ('raw_ingested', 'segmented', 'compiled', 'error', 'ocr_partial')
            and coalesce(captured_at, date, created_at::timestamptz) >= now() - interval '365 days'
          order by captured_at desc nulls last,
            date desc nulls last,
            created_at desc nulls last
          limit %s
        ),
        completed_without_embeddings as (
          select
            dm.id,
            dm.category,
            dm.status,
            dm.created_at,
            coalesce(dm.captured_at, dm.date, dm.created_at::timestamptz) as source_at,
            dm.captured_at,
            dm.date
          from public.document_metadata dm
          where dm.source = 'microsoft_graph'
            and dm.status in ('embedded', 'complete')
            and dm.category in ('email', 'teams_message', 'document')
            and coalesce(dm.captured_at, dm.date, dm.created_at::timestamptz) >= now() - interval '365 days'
            and not exists (
              select 1
              from public.document_chunks dc
              where dc.document_id = dm.id
                and dc.embedding is not null
            )
          order by dm.captured_at desc nulls last,
            dm.date desc nulls last,
            dm.created_at desc nulls last
          limit %s
        )
        select id, category, status, created_at
        from (
          select * from pending
          union all
          select * from completed_without_embeddings
        ) candidates
        order by source_at desc nulls last, created_at desc nulls last
        limit %s
        """
        query_params = (candidate_limit, candidate_limit, limit)
    else:
        query = """
        with pending as (
          select
            id,
            category,
            status,
            created_at,
            coalesce(captured_at, date, created_at::timestamptz) as source_at,
            captured_at,
            date
          from public.document_metadata
          where source = 'microsoft_graph'
            and status in ('raw_ingested', 'segmented', 'compiled', 'error', 'ocr_partial')
            and length(coalesce(content, '')) > 0
            and coalesce(captured_at, date, created_at::timestamptz) >= now() - interval '365 days'
          order by captured_at desc nulls last,
            date desc nulls last,
            created_at desc nulls last
          limit %s
        ),
        completed_without_embeddings as (
          select
            dm.id,
            dm.category,
            dm.status,
            dm.created_at,
            coalesce(dm.captured_at, dm.date, dm.created_at::timestamptz) as source_at,
            dm.captured_at,
            dm.date
          from public.document_metadata dm
          where dm.source = 'microsoft_graph'
            and dm.status in ('embedded', 'complete')
            and dm.category in ('email', 'teams_message', 'document')
            and coalesce(dm.captured_at, dm.date, dm.created_at::timestamptz) >= now() - interval '365 days'
            and not exists (
              select 1
              from public.document_chunks dc
              where dc.document_id = dm.id
                and dc.embedding is not null
            )
          order by dm.captured_at desc nulls last,
            dm.date desc nulls last,
            dm.created_at desc nulls last
          limit %s
        )
        select id, category, status, created_at
        from (
          select * from pending
          union all
          select * from completed_without_embeddings
        ) candidates
        order by source_at desc nulls last, created_at desc nulls last
        limit %s
    """
        query_params = (candidate_limit, candidate_limit, limit)
    conn = None
    try:
        conn = psycopg2.connect(database_url, sslmode="require")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("set local statement_timeout = '15s'")
            cur.execute(query, query_params)
            docs = [dict(row) for row in cur.fetchall()]
    finally:
        if conn is not None:
            conn.close()

    # Post-RAG-split supplement: PM APP status is already 'embedded'/'complete'
    # for emails/attachments processed by the pre-split path, so the SQL query
    # above won't find them. Always supplement with unembedded RAG DB rows.
    # This must run even when SQL found results (e.g. teams_message) because the
    # "not docs" guard was insufficient — any non-email result kept emails hidden.
    if rag_database_writes_enabled():
        try:
            from datetime import timedelta
            cutoff = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
            rag_resp = (
                get_rag_read_client()
                .from_("rag_document_metadata")
                .select("id, type, source_system, created_at")
                .is_("embedding_status", "null")
                .in_("type", ["email", "email_attachment", "teams_dm_conversation", "teams_dm"])
                .gte("created_at", cutoff)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            rag_docs = rag_resp.data or []
            if rag_docs:
                existing_ids = {d["id"] for d in docs}
                rag_candidates = [
                    {
                        "id": d["id"],
                        "category": d["type"],
                        "source_system": d.get("source_system"),
                        "status": "repair",
                        "created_at": d["created_at"],
                    }
                    for d in rag_docs
                    if _graph_embedding_candidate_enabled(d)
                    if d["id"] not in existing_ids
                ]
                docs = (rag_candidates + docs)[:limit]
                logger.info(
                    "[GraphEmbed] RAG supplement: %d email/attachment/teams_dm candidates added",
                    len(rag_candidates),
                )
        except Exception as exc:
            logger.warning("[GraphEmbed] RAG supplement scan failed: %s", exc)

    return docs if docs else None


def _fetch_graph_embedding_candidates_via_supabase(
    supabase_client,
    limit: int,
) -> List[Dict[str, Any]]:
    """Fallback candidate scan when the backend only has Supabase API access."""
    rag_candidates: List[Dict[str, Any]] = []
    # Post-RAG-split fast path: query rag_document_metadata directly for rows
    # with embedding_status IS NULL. PM APP's status is already 'embedded'/'complete'
    # for these docs, so the per-row repair scan below would need to page through
    # thousands of rows. This is O(1) instead of O(N).
    if rag_database_writes_enabled():
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
            # Re-pull NULL (never attempted) AND error rows still under the retry
            # cap. Without the error branch, the poison-pill fix would orphan any
            # doc it parks at embedding_status='error' (PM APP status is usually
            # 'embedded'/'complete' post-split, so this RAG scan is the only path
            # that finds them) — they would silently never retry. Bounded by
            # embedding_attempts so genuinely-broken docs still park at the cap.
            retry_filter = (
                "embedding_status.is.null,"
                f"and(embedding_status.eq.error,embedding_attempts.lt.{EMBED_MAX_ATTEMPTS})"
            )
            rag_resp = (
                get_rag_read_client()
                .from_("rag_document_metadata")
                .select("id, type, source_system, created_at")
                .or_(retry_filter)
                .in_("type", ["email", "document", "email_attachment", "teams_dm_conversation", "teams_dm"])
                .gte("created_at", cutoff)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            rag_docs = rag_resp.data or []
            if rag_docs:
                logger.info("[GraphEmbed] RAG direct scan found %d unembedded docs", len(rag_docs))
                rag_candidates = [
                    {
                        "id": d["id"],
                        "category": d["type"],
                        "source_system": d.get("source_system"),
                        "status": "repair",
                        "created_at": d["created_at"],
                        "date": d["created_at"][:10],
                    }
                    for d in rag_docs
                    if _graph_embedding_candidate_enabled(d)
                ]
        except Exception as exc:
            logger.warning("[GraphEmbed] RAG direct scan failed, continuing to repair scan: %s", exc)

    try:
        cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
        # Post-RAG-split: document_metadata.content is always NULL because content
        # now lives in rag_document_metadata. Don't filter by content here — trust
        # status. embed_graph_document hydrates content from the RAG DB.
        pending_resp = (
            supabase_client.from_("document_metadata")
            .select("id, category, status, source_system, created_at, date")
            .eq("source", "microsoft_graph")
            .in_("status", ["raw_ingested", "segmented", "compiled", "error", "ocr_partial"])
            .gte("created_at", cutoff_iso)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        by_id: Dict[str, Dict[str, Any]] = {}
        for doc in (pending_resp.data or []):
            by_id[doc["id"]] = doc

        repair_scan_limit = max(limit * 3, 100)
        page_size = 500
        scanned = 0
        while len(by_id) < limit and scanned < repair_scan_limit:
            repair_resp = (
                supabase_client.from_("document_metadata")
            .select("id, category, status, source_system, created_at, date")
                .eq("source", "microsoft_graph")
                .in_("status", ["embedded", "complete"])
                .in_("category", ["email", "teams_message", "document"])
                .gte("created_at", cutoff_iso)
                .order("created_at", desc=True)
                .range(scanned, scanned + page_size - 1)
                .execute()
            )
            repair_rows = repair_resp.data or []
            if not repair_rows:
                break
            for doc in repair_rows:
                if doc["id"] in by_id:
                    continue
                if not _has_embedded_graph_chunks(supabase_client, doc["id"]):
                    by_id[doc["id"]] = doc
                    if len(by_id) >= limit:
                        break
            scanned += len(repair_rows)

        docs = sorted(
            by_id.values(),
            key=lambda row: str(row.get("date") or row.get("created_at") or ""),
            reverse=True,
        )
        if rag_candidates:
            existing_ids = {str(row.get("id")) for row in docs}
            for candidate in rag_candidates:
                candidate_id = str(candidate.get("id"))
                if candidate_id not in existing_ids:
                    docs.append(candidate)
                    existing_ids.add(candidate_id)

        docs = sorted(
            docs,
            key=lambda row: str(row.get("date") or row.get("created_at") or ""),
            reverse=True,
        )[:limit]
        return docs
    except Exception:
        raise


def _has_embedded_graph_chunks(supabase_client, metadata_id: str) -> bool:
    """Return whether a Graph document already has searchable embedded chunks."""
    try:
        resp = (
            get_rag_write_client().from_("document_chunks")
            .select("chunk_id")
            .eq("document_id", metadata_id)
            .not_.is_("embedding", "null")
            .limit(1)
            .execute()
        )
        return bool(resp.data)
    except Exception as exc:
        logger.warning("[GraphEmbed] Could not inspect chunks for %s: %s", metadata_id, exc)
        return False


def _record_graph_embed_run(
    supabase_client,
    *,
    started_at: datetime,
    status: str,
    items_seen: int = 0,
    items_synced: int = 0,
    items_created: int = 0,
    items_failed: int = 0,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    try:
        from src.services.health.source_sync_health import record_sync_run

        record_sync_run(
            supabase_client,
            source="microsoft_graph",
            resource_id="graph_embed",
            resource_name="Microsoft Graph embedding",
            stage="vectorization",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            items_seen=items_seen,
            items_synced=items_synced,
            items_created=items_created,
            items_failed=items_failed,
            error_message=error_message,
            metadata=metadata or {},
        )
    except Exception as exc:
        logger.warning("[GraphEmbed] Could not record source_sync_runs row: %s", exc)
