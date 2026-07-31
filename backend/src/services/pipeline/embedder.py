"""
Stage 2 – Chunk and embed.

Reads segments from ``meeting_segments``, creates overlapping text chunks
(matching the TS chunker logic), batch-embeds everything via OpenAI, and
stores the results in the ``documents`` table.

Also embeds segment summaries and writes them back to ``meeting_segments``.
"""
from __future__ import annotations

import datetime
import hashlib
import logging
import re
from typing import Any, Dict, List, Optional

from ..supabase_helpers import (
    fetch_optional_row,
    get_rag_read_client,
    get_rag_write_client,
    get_supabase_client,
    update_ingestion_job_state,
)
from ..ingestion.fireflies_pipeline import FirefliesIngestionPipeline
from .models import DocumentChunk, MeetingSegment, TranscriptLine
from . import llm
from .config import CHUNK_TARGET_CHARS, CHUNK_OVERLAP_CHARS

logger = logging.getLogger(__name__)

# Segment index conventions for non-transcript chunks
SEGMENT_IDX_MEETING_SUMMARY = -1
SEGMENT_IDX_SECTION = -2
SEGMENT_IDX_NOTES_TOPIC = -3

# Stateless parser instance for content re-parsing.
_parser = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
LOW_CONTENT_STATUS = "skipped_low_content"
MIN_SEARCHABLE_CHARS = 50
GRAPH_EMBEDDER_OWNED_TYPES = {
    "outlook_conversation",
    "teams_dm_conversation",
    "teams_message",
    "teams_dm",
}


def _hash_content(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _build_summary_embedding_text(title: str, meeting_date: Optional[str], summary: str) -> str:
    parts: List[str] = []
    if title:
        parts.append(f"Meeting: {title}")
    if meeting_date:
        parts.append(f"Date: {meeting_date}")
    if summary:
        parts.append(summary)
    return "\n".join(parts).strip()


def _is_low_content_placeholder(text: Optional[str]) -> bool:
    value = str(text or "").strip()
    return (
        value.startswith("Minimal extract for ")
        and "Parsed content was only" in value
        and "may require OCR or a different source format" in value
    )


def _has_searchable_text(text: Optional[str]) -> bool:
    value = str(text or "").strip()
    return len(value) >= MIN_SEARCHABLE_CHARS and not _is_low_content_placeholder(value)


def _is_interview_title(title: Optional[str]) -> bool:
    return "interview" in str(title or "").lower()


def _split_sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)
    return [p.strip() for p in parts if p.strip()]


def _chunk_segment(
    segment: MeetingSegment,
    all_lines: List[TranscriptLine],
    *,
    doc_type: str = "chunk",
) -> List[DocumentChunk]:
    """Split a segment's transcript lines into overlapping chunks."""
    segment_lines = [
        l for l in all_lines
        if l.index >= segment.start_index and l.index <= segment.end_index
    ]
    if not segment_lines:
        return []

    full_text = "\n".join(f"{l.speaker}: {l.text}" for l in segment_lines)
    sentences = _split_sentences(full_text)
    chunks: List[DocumentChunk] = []
    current: List[str] = []
    current_len = 0
    chunk_index = 0

    for sentence in sentences:
        slen = len(sentence)
        if current_len + slen > CHUNK_TARGET_CHARS and current:
            chunk_text = " ".join(current)
            chunks.append(
                DocumentChunk(
                    content=chunk_text,
                    chunk_index=chunk_index,
                    segment_index=segment.segment_index,
                    doc_type=doc_type,
                    content_hash=_hash_content(chunk_text),
                )
            )
            chunk_index += 1
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
        chunk_text = " ".join(current)
        chunks.append(
            DocumentChunk(
                content=chunk_text,
                chunk_index=chunk_index,
                segment_index=segment.segment_index,
                doc_type=doc_type,
                content_hash=_hash_content(chunk_text),
            )
        )

    return chunks


def _split_text(text: str, max_chars: int = CHUNK_TARGET_CHARS, overlap: int = CHUNK_OVERLAP_CHARS) -> List[str]:
    """Split text into overlapping chunks at sentence boundaries."""
    if len(text) <= max_chars:
        return [text]

    sentences = _split_sentences(text)
    chunks: List[str] = []
    current: List[str] = []
    current_len = 0

    for sentence in sentences:
        slen = len(sentence)
        if current_len + slen > max_chars and current:
            chunks.append(" ".join(current))
            # Keep overlap tail
            overlap_parts: List[str] = []
            overlap_len = 0
            for s in reversed(current):
                if overlap_len + len(s) <= overlap:
                    overlap_parts.insert(0, s)
                    overlap_len += len(s)
                else:
                    break
            current = overlap_parts
            current_len = overlap_len
        current.append(sentence)
        current_len += slen

    if current:
        chunks.append(" ".join(current))
    return chunks


def _create_section_chunks(
    parsed,
    metadata_id: str,
    meeting_title: str,
    meeting_date: Optional[str],
) -> List[DocumentChunk]:
    """Create embedder-ready chunks from rich Fireflies markdown sections.

    Produces chunks for Summary, Short Summary, Action Items, Shorthand Bullet,
    Outline, and individual Notes topics.
    """
    chunks: List[DocumentChunk] = []

    # Map of section names → doc_type for single-chunk sections
    section_doc_types = {
        "Summary": "section_summary",
        "Short Summary": "section_short_summary",
        "Action Items": "section_action_items",
        "Shorthand Bullet": "section_shorthand",
        "Outline": "section_outline",
        "Bullet Gist": "section_bullet_gist",
        "Gist": "section_gist",
    }

    chunk_idx = 0
    rich_sections = getattr(parsed, "rich_sections", {}) or {}
    notes_topics = getattr(parsed, "notes_topics", {}) or {}

    for section_name, doc_type in section_doc_types.items():
        content = rich_sections.get(section_name, "").strip()
        if not content:
            continue

        # Prefix with context for better RAG retrieval
        prefix = f"[{meeting_title}] {section_name}:\n\n"
        text_parts = _split_text(prefix + content)

        for text in text_parts:
            chunks.append(DocumentChunk(
                content=text,
                chunk_index=chunk_idx,
                segment_index=SEGMENT_IDX_SECTION,
                doc_type=doc_type,
                content_hash=_hash_content(text),
            ))
            chunk_idx += 1

    # Notes topics — each sub-heading gets its own chunk(s)
    for topic_name, topic_content in notes_topics.items():
        if not topic_content.strip():
            continue

        prefix = f"[{meeting_title}] Notes — {topic_name}:\n\n"
        text_parts = _split_text(prefix + topic_content)

        for text in text_parts:
            chunks.append(DocumentChunk(
                content=text,
                chunk_index=chunk_idx,
                segment_index=SEGMENT_IDX_NOTES_TOPIC,
                doc_type="notes_topic",
                content_hash=_hash_content(text),
            ))
            chunk_idx += 1

    logger.info("[Embedder] Created %d section chunks from rich sections", len(chunks))
    return chunks


def run_embedder(metadata_id: str) -> Dict[str, Any]:
    """
    Chunk and embed a document's segments.

    Returns:
        dict with metadataId, chunkCount, segmentCount
    """
    client = get_supabase_client()
    rag_client = get_rag_write_client()

    # 1. Fetch metadata
    resp = (
        client.table("document_metadata")
        .select(
            "id,title,type,category,source,source_system,project_id,business_area_id,date,captured_at,"
            "created_at,summary,overview,status,fireflies_id,participants,"
            "participants_array,source_metadata,file_name,file_path,"
            "storage_bucket,source_web_url,url,document_type,access_level"
        )
        .eq("id", metadata_id)
        .single()
        .execute()
    )
    metadata = resp.data
    if not metadata:
        raise ValueError(f"document_metadata not found: {metadata_id}")
    source_metadata = metadata.get("source_metadata") if isinstance(metadata, dict) else {}
    if not isinstance(source_metadata, dict):
        source_metadata = {}
    graph_owned_kind = source_metadata.get("document_kind")
    graph_owned_type = metadata.get("type") or metadata.get("document_type")
    if metadata.get("source") == "microsoft_graph" and (
        graph_owned_kind in GRAPH_EMBEDDER_OWNED_TYPES
        or graph_owned_type in GRAPH_EMBEDDER_OWNED_TYPES
    ):
        update_ingestion_job_state(
            metadata_id,
            stage="done",
            error_message=None,
            client=client,
        )
        return {
            "metadataId": metadata_id,
            "chunkCount": 0,
            "segmentCount": 0,
            "skipped": True,
            "skipReason": "owned_by_graph_embedder",
        }

    rag_metadata = fetch_optional_row(
        get_rag_read_client(),
        "rag_document_metadata",
        "content,raw_text,summary,overview",
        "id",
        metadata_id,
    )
    content = rag_metadata.get("content") or rag_metadata.get("raw_text")
    rag_content = rag_metadata.get("content")
    rag_raw_text = rag_metadata.get("raw_text")
    rag_summary = rag_metadata.get("summary")
    rag_overview = rag_metadata.get("overview")
    meeting_summary = rag_metadata.get("summary") or rag_metadata.get("overview") or metadata.get("summary") or metadata.get("overview") or ""
    title = metadata.get("title") or "Untitled"
    project_id = metadata.get("project_id")
    business_area_id = metadata.get("business_area_id")
    if business_area_id is not None:
        source_metadata = {
            **source_metadata,
            "business_area_id": business_area_id,
        }
        metadata["source_metadata"] = source_metadata
    started_at = metadata.get("started_at") or metadata.get("captured_at")
    participants = metadata.get("participants_array") or []

    logger.info("[Embedder] Processing: %s (%s)", title, metadata_id)

    if _is_interview_title(title):
        reason = (
            'INTENTIONALLY_EXCLUDED: Document title contains "Interview", '
            "so it is intentionally excluded from embedding/vectorization."
        )
        rag_client.table("document_chunks").delete().eq("document_id", metadata_id).execute()
        client.table("document_metadata").update(
            {"status": "intentionally_excluded"}
        ).eq("id", metadata_id).execute()
        rag_client.table("rag_document_metadata").upsert(
            {
                "id": metadata_id,
                "app_document_id": metadata_id,
                "title": title,
                "source": metadata.get("source"),
                "type": metadata.get("type"),
                "category": metadata.get("category"),
                "embedding_status": "intentionally_excluded",
                "processing_metadata": {
                    "embedding_exclusion": {
                        "code": "interview_title_excluded",
                        "message": reason,
                        "intentional": True,
                    }
                },
            }
        ).execute()
        update_ingestion_job_state(
            metadata_id,
            stage="done",
            error_message=None,
            client=client,
        )
        return {
            "metadataId": metadata_id,
            "chunkCount": 0,
            "segmentCount": 0,
            "skipped": True,
            "skipReason": "interview_title_excluded",
        }

    # 2. Fetch segments
    seg_resp = (
        client.table("meeting_segments")
        .select("*")
        .eq("metadata_id", metadata_id)
        .order("segment_index")
        .execute()
    )
    segment_rows = seg_resp.data or []
    if not segment_rows:
        logger.warning(
            "[Embedder] No parser segments found for %s; continuing only if direct text or vision chunks exist",
            metadata_id,
        )

    # 3. Convert rows to MeetingSegment objects
    segments: List[MeetingSegment] = [
        MeetingSegment(
            segment_index=row["segment_index"],
            title=row["title"],
            start_index=row["start_index"],
            end_index=row["end_index"],
            summary=row.get("summary") or "",
            decisions=row.get("decisions") or [],
            risks=row.get("risks") or [],
            tasks=row.get("tasks") or [],
        )
        for row in segment_rows
    ]

    # 4. Parse content to get indexed transcript lines for chunking
    transcript_lines: List[TranscriptLine] = []
    parsed = None  # Hoisted so section chunking can reuse it
    content_is_generic_document = False
    if content:
        try:
            parsed = _parser.parse_markdown(content)
            transcript_lines = [
                TranscriptLine(
                    index=i,
                    timestamp=seg.timestamp or "",
                    speaker=seg.speaker or "Unknown",
                    text=seg.text,
                )
                for i, seg in enumerate(parsed.transcript_segments)
            ]
        except Exception as exc:
            logger.warning("[Embedder] Failed to parse content: %s", exc)
        if not transcript_lines:
            content_is_generic_document = True
            transcript_lines = [
                TranscriptLine(
                    index=i,
                    timestamp="",
                    speaker="Document",
                    text=line,
                )
                for i, line in enumerate(content.splitlines())
                if line.strip()
            ]

    # 5. Create all chunks
    all_chunks: List[DocumentChunk] = []
    for seg in segments:
        all_chunks.extend(
            _chunk_segment(
                seg,
                transcript_lines,
                doc_type="document_chunk" if content_is_generic_document else "chunk",
            )
        )

    # Add meeting-level summary chunk
    if _has_searchable_text(meeting_summary):
        all_chunks.append(
            DocumentChunk(
                content=meeting_summary,
                chunk_index=0,
                segment_index=-1,
                doc_type="meeting_summary",
                content_hash=_hash_content(meeting_summary),
            )
        )

    # Add segment summary chunks
    for seg in segments:
        if _has_searchable_text(seg.summary):
            all_chunks.append(
                DocumentChunk(
                    content=seg.summary,
                    chunk_index=0,
                    segment_index=seg.segment_index,
                    doc_type="segment_summary",
                    content_hash=_hash_content(seg.summary),
                )
            )

    # Add section-aware chunks from rich Fireflies sections
    if parsed is not None:
        try:
            section_chunks = _create_section_chunks(
                parsed, metadata_id, title, started_at
            )
            all_chunks.extend(section_chunks)
        except Exception as exc:
            logger.warning("[Embedder] Failed to create section chunks: %s", exc)

    logger.info("[Embedder] Created %d chunks (transcript + sections)", len(all_chunks))

    # 5b. Add vision page summaries (for PDF documents analyzed by vision_analyzer)
    # These are clean GPT-4o prose summaries of each page — far more useful for
    # semantic search than raw OCR text.
    try:
        vision_resp = (
            client.table("document_page_intelligence")
            .select("page_number, sheet_number, sheet_title, discipline, ai_summary, implied_submittals, notes_and_requirements")
            .eq("document_metadata_id", metadata_id)
            .order("page_number")
            .execute()
        )
        vision_pages = vision_resp.data or []
        for page in vision_pages:
            summary = page.get("ai_summary") or ""
            if not summary.strip():
                continue
            # Enrich with structured fields so embedding captures the metadata too
            extras = []
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
            enriched = "\n".join(extras + [summary]) if extras else summary
            all_chunks.append(
                DocumentChunk(
                    content=enriched,
                    chunk_index=page.get("page_number", 0),
                    segment_index=-3,  # sentinel: vision page
                    doc_type="vision_page_summary",
                    content_hash=_hash_content(enriched),
                )
            )
        if vision_pages:
            logger.info("[Embedder] Added %d vision page chunks", len(vision_pages))
    except Exception as exc:
        logger.warning("[Embedder] Failed to load vision pages (non-fatal): %s", exc)

    if not all_chunks:
        logger.warning(
            "[Embedder] No searchable text or vision chunks for %s; marking %s",
            metadata_id,
            LOW_CONTENT_STATUS,
        )
        rag_client.table("document_chunks").delete().eq("document_id", metadata_id).execute()
        client.table("document_metadata").update(
            {"status": LOW_CONTENT_STATUS}
        ).eq("id", metadata_id).execute()
        rag_client.table("rag_document_metadata").upsert(
            {
                "id": metadata_id,
                "app_document_id": metadata_id,
                "title": title,
                "source": metadata.get("source"),
                "source_system": metadata.get("source_system"),
                "type": metadata.get("type"),
                "category": metadata.get("category"),
                "document_type": metadata.get("document_type"),
                "project_id": project_id,
                "storage_bucket": metadata.get("storage_bucket"),
                "storage_path": metadata.get("file_path"),
                "source_web_url": metadata.get("source_web_url"),
                "url": metadata.get("url"),
                "content": metadata.get("content"),
                "raw_text": metadata.get("raw_text"),
                "summary": metadata.get("summary"),
                "overview": metadata.get("overview"),
                "parsing_status": LOW_CONTENT_STATUS,
                "embedding_status": LOW_CONTENT_STATUS,
                "embedding_error": (
                    f"{LOW_CONTENT_STATUS}: no searchable text or vision page summaries"
                ),
                "source_metadata": metadata.get("source_metadata"),
            },
            on_conflict="id",
        ).execute()
        update_ingestion_job_state(
            metadata_id,
            stage="done",
            error_message=(
                f"{LOW_CONTENT_STATUS}: no searchable text or vision page summaries"
            ),
            client=client,
        )
        return {
            "metadataId": metadata_id,
            "chunkCount": 0,
            "segmentCount": len(segments),
            "skipped": True,
            "skipReason": LOW_CONTENT_STATUS,
        }

    # 6. Mark job as chunked before expensive embedding calls
    update_ingestion_job_state(
        metadata_id,
        stage="chunked",
        client=client,
    )

    # 7. Batch embed all chunks
    chunk_texts = [c.content for c in all_chunks]
    chunk_embeddings = llm.batch_embed(chunk_texts)
    for i, chunk in enumerate(all_chunks):
        chunk.embedding = chunk_embeddings[i] if i < len(chunk_embeddings) else None

    # 8. Embed segment summaries
    seg_summaries = [s.summary or s.title for s in segments]
    seg_embeddings = llm.batch_embed(seg_summaries)
    for i, seg in enumerate(segments):
        if i < len(seg_embeddings):
            seg.summary_embedding = seg_embeddings[i]

    summary_embedding = None
    summary_embedding_text = _build_summary_embedding_text(title, started_at, meeting_summary)
    if summary_embedding_text:
        summary_embeddings = llm.batch_embed([summary_embedding_text])
        if summary_embeddings:
            summary_embedding = summary_embeddings[0]

    # 9. Build segment ID map for chunk → segment FK
    segment_id_map: Dict[int, str] = {
        row["segment_index"]: row["id"] for row in segment_rows
    }

    # 10. (Segment summary_embedding column was dropped in migration 20260320100000.
    #      Segment summary embeddings are now stored as document_chunks rows with
    #      source_type='meeting_segment_summary' — written in step 11 below.)

    # 11. Store chunks in document_chunks table (unified RAG table).
    # Re-indexing a stable local source must replace the prior chunk set, not
    # leave old chunks searchable after the source file changes.
    rag_client.table("document_chunks").delete().eq("document_id", metadata_id).execute()
    chunk_access_level = (
        "leadership" if _is_leadership_restricted_doc(metadata) else None
    )
    for chunk in all_chunks:
        seg_id = segment_id_map.get(chunk.segment_index) if chunk.segment_index >= 0 else None
        _upsert_chunk(
            rag_client,
            chunk=chunk,
            metadata_id=metadata_id,
            segment_id=seg_id,
            started_at=started_at,
            participants=participants,
            project_id=project_id,
            title=title,
            existing_chunk_id=None,
            access_level=chunk_access_level,
            business_area_id=business_area_id,
        )

    # 12. Update metadata status
    client.table("document_metadata").update({"status": "embedded"}).eq("id", metadata_id).execute()
    rag_metadata_update = {
        "id": metadata_id,
        "app_document_id": metadata_id,
        "title": title,
        "source": metadata.get("source"),
        "source_system": metadata.get("source_system"),
        "type": metadata.get("type"),
        "category": metadata.get("category"),
        "document_type": metadata.get("document_type"),
        "project_id": project_id,
        "storage_bucket": metadata.get("storage_bucket"),
        "storage_path": metadata.get("file_path"),
        "source_web_url": metadata.get("source_web_url"),
        "url": metadata.get("url"),
        "content": rag_content if rag_content is not None else metadata.get("content"),
        "raw_text": rag_raw_text if rag_raw_text is not None else metadata.get("raw_text"),
        "summary": rag_summary if rag_summary is not None else metadata.get("summary"),
        "overview": rag_overview if rag_overview is not None else metadata.get("overview"),
        "parsing_status": metadata.get("status"),
        "embedding_status": "embedded",
        "source_metadata": metadata.get("source_metadata"),
    }
    if summary_embedding is not None:
        rag_metadata_update["summary_embedding"] = summary_embedding

    rag_client.table("rag_document_metadata").upsert(
        rag_metadata_update,
        on_conflict="id",
    ).execute()

    # 13. Advance job stage
    update_ingestion_job_state(
        metadata_id,
        stage="embedded",
        client=client,
    )

    return {
        "metadataId": metadata_id,
        "chunkCount": len(all_chunks),
        "segmentCount": len(segments),
    }


def _doc_type_to_source_type(doc_type: str) -> str:
    """Map pipeline doc_type to document_chunks.source_type."""
    mapping = {
        "chunk": "meeting_transcript",
        "document_chunk": "document",
        "meeting_summary": "meeting_summary",
        "segment_summary": "meeting_segment_summary",
        "notes_topic": "meeting_notes",
        "vision_page_summary": "vision_page_summary",
    }
    if doc_type in mapping:
        return mapping[doc_type]
    if doc_type.startswith("section_"):
        return "meeting_section"
    return "meeting_transcript"


def _is_leadership_restricted_doc(metadata: Dict[str, Any]) -> bool:
    """Leadership-restricted docs (Annual Reviews) — see migration
    20260723230000_leadership_restricted_meetings.sql. Their chunks are stamped
    with access_level so the retrieval layer can gate them (the RAG DB is
    reached via service role, so chunk metadata is the only access signal)."""
    if str(metadata.get("access_level") or "").strip().lower() == "leadership":
        return True
    return str(metadata.get("category") or "").strip().lower() == "annual review"


def _upsert_chunk(
    client,
    chunk: DocumentChunk,
    metadata_id: str,
    segment_id: Optional[str],
    started_at: Optional[str],
    participants: List[str],
    project_id: Optional[int],
    title: str,
    existing_chunk_id: Optional[str],
    access_level: Optional[str] = None,
    business_area_id: Optional[int] = None,
) -> None:
    source_type = _doc_type_to_source_type(chunk.doc_type)
    seg_idx = str(chunk.segment_index) if chunk.segment_index is not None else "0"
    chunk_idx = str(chunk.chunk_index) if chunk.chunk_index is not None else "0"

    chunk_id = (
        existing_chunk_id
        or f"{metadata_id}__ff_{chunk.doc_type}_{seg_idx}_{chunk_idx}"
    )

    chunk_data: Dict[str, Any] = {
        "chunk_id": chunk_id,
        "document_id": metadata_id,
        "chunk_index": chunk.chunk_index,
        "text": chunk.content,
        "embedding": chunk.embedding,
        "source_type": source_type,
        "content_hash": chunk.content_hash,
        "metadata": {
            "doc_type": chunk.doc_type,
            "chunk_index": chunk.chunk_index,
            "segment_index": chunk.segment_index,
            "segment_id": segment_id,
            "content_hash": chunk.content_hash,
            "participants": participants,
            "project_id": project_id,
            "business_area_id": business_area_id,
            "title": title,
            "file_date": started_at,
            **({"access_level": access_level} if access_level else {}),
        },
    }

    try:
        client.table("document_chunks").upsert(
            chunk_data, on_conflict="chunk_id"
        ).execute()
    except Exception as exc:
        logger.error("[Embedder] Failed to upsert chunk %s: %s", chunk_id, exc)
