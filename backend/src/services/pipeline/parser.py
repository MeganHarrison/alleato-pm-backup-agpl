"""
Stage 1 – Parse and segment.

Fetches raw content from document_metadata, parses it with the Fireflies
markdown parser, then calls the LLM to:
  1. Generate a meeting summary
  2. Semantically segment the transcript

Stores segments in ``meeting_segments`` and advances the job stage to
``segmented``.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from ..supabase_helpers import (
    fetch_optional_row,
    get_rag_read_client,
    get_rag_write_client,
    get_supabase_client,
    update_ingestion_job_state,
)
from ..ingestion.fireflies_pipeline import FirefliesIngestionPipeline
from .models import MeetingSegment, TranscriptLine
from . import llm

logger = logging.getLogger(__name__)

# Stateless – parse_markdown needs no store/embedder.
_parser = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
SUMMARY_SAMPLE_WINDOW = 120
SEGMENT_WINDOW_LINES = 280
SEGMENT_WINDOW_OVERLAP = 40


def _format_transcript_for_llm(lines: List[TranscriptLine]) -> str:
    """Format as [index] [timestamp] Speaker: text (matches TS formatTranscriptForLLM)."""
    parts: List[str] = []
    for line in lines:
        ts = f"[{line.timestamp}] " if line.timestamp else ""
        parts.append(f"[{line.index}] {ts}{line.speaker}: {line.text}")
    return "\n".join(parts)


def _build_summary_excerpt(lines: List[TranscriptLine]) -> str:
    """Build a representative excerpt from head/middle/tail of transcript."""
    if not lines:
        return ""

    if len(lines) <= SUMMARY_SAMPLE_WINDOW * 3:
        sample = lines
    else:
        head = lines[:SUMMARY_SAMPLE_WINDOW]
        mid_start = max(0, (len(lines) // 2) - (SUMMARY_SAMPLE_WINDOW // 2))
        middle = lines[mid_start : mid_start + SUMMARY_SAMPLE_WINDOW]
        tail = lines[-SUMMARY_SAMPLE_WINDOW:]
        combined = head + middle + tail
        seen: set[int] = set()
        sample: List[TranscriptLine] = []
        for line in combined:
            if line.index in seen:
                continue
            seen.add(line.index)
            sample.append(line)

    return "\n".join(
        f"[{line.timestamp}] {line.speaker}: {line.text}" for line in sample
    )


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _segment_transcript_in_windows(
    transcript_lines: List[TranscriptLine], title: str
) -> List[Dict[str, Any]]:
    if not transcript_lines:
        return []

    total_lines = len(transcript_lines)
    segment_dicts: List[Dict[str, Any]] = []
    start = 0

    while start < total_lines:
        end = min(total_lines, start + SEGMENT_WINDOW_LINES)
        window_lines = transcript_lines[start:end]
        if not window_lines:
            break

        first_idx = window_lines[0].index
        last_idx = window_lines[-1].index
        formatted = _format_transcript_for_llm(window_lines)
        window_title = f"{title} (lines {first_idx}-{last_idx})"

        try:
            window_segments = llm.segment_transcript(
                formatted, window_title, max_chars=None
            )
        except Exception as exc:
            logger.warning(
                "[Parser] Segment LLM failed for %s lines %s-%s; using fallback segment: %s",
                title,
                first_idx,
                last_idx,
                exc,
            )
            window_segments = [
                {
                    "title": f"Meeting Notes {first_idx}-{last_idx}",
                    "start_index": first_idx,
                    "end_index": last_idx,
                    "summary": " ".join(line.text for line in window_lines)[:1200],
                    "decisions": [],
                    "risks": [],
                    "tasks": [],
                }
            ]
        for seg in window_segments:
            seg_start = _coerce_int(seg.get("start_index"), first_idx)
            seg_end = _coerce_int(seg.get("end_index"), last_idx)
            seg_start = max(first_idx, min(last_idx, seg_start))
            seg_end = max(seg_start, min(last_idx, seg_end))

            segment_dicts.append(
                {
                    "title": seg.get("title", f"Segment {seg_start}-{seg_end}"),
                    "start_index": seg_start,
                    "end_index": seg_end,
                    "summary": seg.get("summary", ""),
                    "decisions": seg.get("decisions") or [],
                    "risks": seg.get("risks") or [],
                    "tasks": seg.get("tasks") or [],
                }
            )

        if end >= total_lines:
            break
        start = max(0, end - SEGMENT_WINDOW_OVERLAP)

    deduped: List[Dict[str, Any]] = []
    seen_keys: set[tuple[Any, ...]] = set()
    for seg in sorted(
        segment_dicts,
        key=lambda s: (
            _coerce_int(s.get("start_index"), 0),
            _coerce_int(s.get("end_index"), 0),
        ),
    ):
        key = (
            _coerce_int(seg.get("start_index"), 0),
            _coerce_int(seg.get("end_index"), 0),
            str(seg.get("title", "")),
            str(seg.get("summary", "")),
        )
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(seg)

    return deduped


def run_parser(metadata_id: str) -> Dict[str, Any]:
    """
    Parse a document_metadata row and segment its transcript.

    Returns:
        dict with metadataId, segmentCount, meetingSummaryLength
    """
    client = get_supabase_client()

    # 1. Fetch metadata
    resp = (
        client.table("document_metadata")
        .select("id,title,type,category,source,source_system,project_id,date,captured_at,created_at,summary,overview,status,fireflies_id,participants,participants_array,source_metadata")
        .eq("id", metadata_id)
        .single()
        .execute()
    )
    metadata = resp.data
    if not metadata:
        raise ValueError(f"document_metadata not found: {metadata_id}")

    rag_metadata = fetch_optional_row(
        get_rag_read_client(),
        "rag_document_metadata",
        "content,raw_text",
        "id",
        metadata_id,
    )
    content = rag_metadata.get("content") or rag_metadata.get("raw_text") or metadata.get("content") or metadata.get("raw_text")
    if not content:
        raise ValueError(f"No RAG content found for document: {metadata_id}")

    title = metadata.get("title") or "Untitled Meeting"
    logger.info("[Parser] Processing: %s (%s)", title, metadata_id)

    # 2. Parse markdown using the existing Fireflies parser
    parsed = _parser.parse_markdown(content)

    # 3. Convert transcript segments to indexed TranscriptLine objects
    transcript_lines: List[TranscriptLine] = [
        TranscriptLine(
            index=i,
            timestamp=seg.timestamp or "",
            speaker=seg.speaker or "Unknown",
            text=seg.text,
        )
        for i, seg in enumerate(parsed.transcript_segments)
    ]
    if not transcript_lines:
        fallback_text = (parsed.summary or parsed.overview or content).strip()
        if fallback_text:
            transcript_lines = [
                TranscriptLine(
                    index=0,
                    timestamp="",
                    speaker="Meeting Notes",
                    text=fallback_text[:12000],
                )
            ]
            logger.warning(
                "[Parser] No transcript lines found for %s; using meeting notes fallback segment",
                metadata_id,
            )

    # 4. Generate meeting summary (pass existing Fireflies summary as context)
    excerpt = _build_summary_excerpt(transcript_lines)
    meeting_summary = llm.generate_meeting_summary(
        transcript_excerpt=excerpt,
        title=title,
        existing_summary=parsed.summary or parsed.overview,
    )
    logger.info("[Parser] Generated summary: %d chars", len(meeting_summary))

    # 5. Segment the transcript via LLM
    segment_dicts = _segment_transcript_in_windows(transcript_lines, title)
    if not segment_dicts and transcript_lines:
        segment_dicts = [
            {
                "title": "Meeting Notes",
                "start_index": transcript_lines[0].index,
                "end_index": transcript_lines[-1].index,
                "summary": meeting_summary,
                "decisions": [],
                "risks": [],
                "tasks": [],
            }
        ]
        logger.warning(
            "[Parser] LLM returned no segments for %s; created fallback meeting-notes segment",
            metadata_id,
        )
    logger.info("[Parser] Created %d segments", len(segment_dicts))

    # 6. Convert to MeetingSegment objects
    segments: List[MeetingSegment] = [
        MeetingSegment(
            segment_index=i,
            title=s.get("title", f"Segment {i}"),
            start_index=s.get("start_index", 0),
            end_index=s.get("end_index", 0),
            summary=s.get("summary", ""),
            decisions=s.get("decisions") or [],
            risks=s.get("risks") or [],
            tasks=s.get("tasks") or [],
        )
        for i, s in enumerate(segment_dicts)
    ]

    # 7. Upsert segments to meeting_segments
    for seg in segments:
        client.table("meeting_segments").upsert(
            {
                "metadata_id": metadata_id,
                "segment_index": seg.segment_index,
                "title": seg.title,
                "start_index": seg.start_index,
                "end_index": seg.end_index,
                "summary": seg.summary,
                "decisions": seg.decisions,
                "risks": seg.risks,
                "tasks": seg.tasks,
            },
            on_conflict="metadata_id,segment_index",
        ).execute()

    # 8. Update document_metadata with generated summary
    client.table("document_metadata").update(
        {"overview": meeting_summary, "status": "segmented"}
    ).eq("id", metadata_id).execute()
    get_rag_write_client().table("rag_document_metadata").update(
        {"overview": meeting_summary, "parsing_status": "segmented"}
    ).eq("id", metadata_id).execute()

    # 9. Advance job stage to 'segmented'
    update_ingestion_job_state(
        metadata_id,
        stage="segmented",
        client=client,
    )

    return {
        "metadataId": metadata_id,
        "segmentCount": len(segments),
        "meetingSummaryLength": len(meeting_summary),
    }
