#!/usr/bin/env python3
"""
RAG Source Coverage Diagnostic

Queries document_chunks to show what source types are indexed,
how many chunks exist per type, and which expected types are missing or thin.

This explains why L1 eval questions for 'email' and 'teams' categories fail:
the source types simply aren't present in meaningful quantity.

Usage:
  cd backend && .venv/bin/python src/scripts/rag_source_coverage.py
  cd backend && .venv/bin/python src/scripts/rag_source_coverage.py --verbose
  cd backend && .venv/bin/python src/scripts/rag_source_coverage.py --min-chunks 100
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Tuple

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

from supabase import create_client, ClientOptions

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Source types we expect to exist for a well-populated corpus.
# Sorted by category with minimum-chunk thresholds.
EXPECTED_SOURCE_TYPES: List[Dict[str, Any]] = [
    # High volume — should have hundreds of chunks
    {"type": "meeting_segment_summary", "min_chunks": 200, "category": "meetings"},
    {"type": "meeting_transcript",       "min_chunks": 100, "category": "meetings"},
    {"type": "meeting_summary",          "min_chunks": 50,  "category": "meetings"},
    {"type": "meeting_summary_embed",    "min_chunks": 50,  "category": "meetings"},
    {"type": "meeting_section",          "min_chunks": 50,  "category": "meetings"},
    # Documents
    {"type": "onedrive_document",        "min_chunks": 20,  "category": "documents"},
    # Insights
    {"type": "insight",                  "min_chunks": 30,  "category": "insights"},
    # Communication channels — known gaps
    {"type": "email",                    "min_chunks": 10,  "category": "comms"},
    {"type": "teams_message",            "min_chunks": 10,  "category": "comms"},
    # Memory
    {"type": "ai_memory",               "min_chunks": 1,   "category": "memory"},
    # Knowledge base
    {"type": "knowledge_entry",          "min_chunks": 1,   "category": "knowledge"},
]


def get_client():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    options = ClientOptions(postgrest_client_timeout=60)
    return create_client(url, key, options)


def get_source_type_counts(supabase) -> Dict[str, int]:
    """Query document_chunks and count rows per source_type."""
    counts: Dict[str, int] = {}
    page_size = 1000
    offset = 0

    while True:
        result = (
            supabase.table("document_chunks")
            .select("source_type")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        for row in rows:
            st = row.get("source_type") or "unknown"
            counts[st] = counts.get(st, 0) + 1
        if len(rows) < page_size:
            break
        offset += page_size

    return counts


def get_embedding_coverage(supabase) -> Dict[str, Tuple[int, int]]:
    """For each source type, count total rows vs rows with embeddings."""
    # Total rows per source type
    total_result = (
        supabase.table("document_chunks")
        .select("source_type")
        .execute()
    )
    total_by_type: Dict[str, int] = {}
    for row in (total_result.data or []):
        st = row.get("source_type") or "unknown"
        total_by_type[st] = total_by_type.get(st, 0) + 1

    # Rows with non-null embeddings
    embed_result = (
        supabase.table("document_chunks")
        .select("source_type")
        .not_.is_("embedding", "null")
        .execute()
    )
    embed_by_type: Dict[str, int] = {}
    for row in (embed_result.data or []):
        st = row.get("source_type") or "unknown"
        embed_by_type[st] = embed_by_type.get(st, 0) + 1

    # Merge
    all_types = set(list(total_by_type.keys()) + list(embed_by_type.keys()))
    return {t: (total_by_type.get(t, 0), embed_by_type.get(t, 0)) for t in all_types}


def get_recent_sample(supabase, source_type: str, limit: int = 3) -> List[str]:
    """Get a few recent chunk text previews for a source type."""
    result = (
        supabase.table("document_chunks")
        .select("chunk_text, created_at")
        .eq("source_type", source_type)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [(row.get("chunk_text") or "")[:120] for row in (result.data or [])]


def main() -> int:
    parser = argparse.ArgumentParser(description="RAG source coverage diagnostic")
    parser.add_argument("--verbose", action="store_true", help="Show chunk text samples")
    parser.add_argument("--min-chunks", type=int, default=50,
                        help="Flag types with fewer than this many chunks (default: 50)")
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    supabase = get_client()

    logger.info("=" * 60)
    logger.info("RAG SOURCE COVERAGE DIAGNOSTIC")
    logger.info("=" * 60)
    logger.info("Counting document_chunks by source_type...")

    t0 = time.time()
    counts = get_source_type_counts(supabase)
    elapsed = time.time() - t0

    total_chunks = sum(counts.values())
    logger.info(f"Scanned {total_chunks:,} chunks in {elapsed:.1f}s\n")

    # All source types found in DB, sorted by count desc
    all_types = sorted(counts.items(), key=lambda x: x[1], reverse=True)

    logger.info(f"{'Source Type':30s}  {'Count':>8}  {'%':>6}  Status")
    logger.info("-" * 65)

    expected_types_set = {e["type"] for e in EXPECTED_SOURCE_TYPES}
    expected_minimums = {e["type"]: e["min_chunks"] for e in EXPECTED_SOURCE_TYPES}

    missing_types = []
    thin_types = []

    for source_type, count in all_types:
        pct = count / total_chunks * 100 if total_chunks else 0
        min_req = expected_minimums.get(source_type, None)

        if min_req is not None and count < min_req:
            status = f"⚠  THIN (min {min_req})"
            thin_types.append((source_type, count, min_req))
        elif source_type not in expected_types_set and count > 0:
            status = "  (unexpected type)"
        else:
            status = "  ✓"

        logger.info(f"  {source_type:28s}  {count:>8,}  {pct:>5.1f}%  {status}")

    # Check for completely missing expected types
    for spec in EXPECTED_SOURCE_TYPES:
        if spec["type"] not in counts:
            missing_types.append(spec)

    if missing_types:
        logger.info("")
        logger.info("MISSING source types (0 chunks):")
        for spec in missing_types:
            logger.info(f"  ✗ {spec['type']:30s}  [{spec['category']}]  "
                        f"min expected: {spec['min_chunks']}")

    if thin_types:
        logger.info("")
        logger.info("THIN source types (below minimum threshold):")
        for source_type, count, min_req in thin_types:
            logger.info(f"  ⚠  {source_type:28s}  {count}/{min_req} chunks")

    # Explain eval failures based on coverage
    logger.info("")
    logger.info("=" * 60)
    logger.info("EVAL FAILURE ANALYSIS")
    logger.info("=" * 60)

    eval_categories = {
        "email":    ["email"],
        "teams":    ["teams_message"],
        "memory":   ["ai_memory"],
        "knowledge":["knowledge_entry"],
        "document": ["onedrive_document"],
    }

    for cat, types_needed in eval_categories.items():
        for t in types_needed:
            count = counts.get(t, 0)
            if count == 0:
                logger.info(f"  {cat:12s} → {t:28s}  MISSING — eval questions for this category will ALWAYS FAIL")
            elif count < 10:
                logger.info(f"  {cat:12s} → {t:28s}  SPARSE ({count} chunks) — retrieval will be unreliable")
            elif count < 50:
                logger.info(f"  {cat:12s} → {t:28s}  THIN ({count} chunks) — retrieval may miss relevant chunks")
            else:
                logger.info(f"  {cat:12s} → {t:28s}  OK ({count} chunks)")

    # Verbose: show samples for thin/missing types
    if args.verbose:
        logger.info("")
        logger.info("CHUNK SAMPLES (most recent per type):")
        for spec in EXPECTED_SOURCE_TYPES:
            count = counts.get(spec["type"], 0)
            if count == 0:
                logger.info(f"\n  {spec['type']}: (no chunks)")
                continue
            samples = get_recent_sample(supabase, spec["type"])
            logger.info(f"\n  {spec['type']} ({count} total):")
            for s in samples:
                logger.info(f"    → {s}")

    logger.info("")
    logger.info("RECOMMENDATIONS:")
    if "email" not in counts or counts.get("email", 0) < 10:
        logger.info("  • Email chunks missing — check email ingestion pipeline")
        logger.info("    Fix: ingest emails and chunk them with source_type='email'")
    if "teams_message" not in counts or counts.get("teams_message", 0) < 10:
        logger.info("  • Teams chunks missing — check Teams message ingestion")
        logger.info("    Fix: ingest Teams messages with source_type='teams_message'")
    if "ai_memory" not in counts or counts.get("ai_memory", 0) < 1:
        logger.info("  • No AI memory chunks — memory injection won't work via vector search")
        logger.info("    Fix: write user preferences/lessons to document_chunks with source_type='ai_memory'")
    logger.info("")

    if args.output:
        output = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total_chunks": total_chunks,
            "source_types": [
                {"source_type": st, "count": c, "pct": round(c/total_chunks*100, 2) if total_chunks else 0}
                for st, c in all_types
            ],
            "missing_types": [s["type"] for s in missing_types],
            "thin_types": [{"type": t, "count": c, "min": m} for t, c, m in thin_types],
        }
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        logger.info(f"Results saved to {args.output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
