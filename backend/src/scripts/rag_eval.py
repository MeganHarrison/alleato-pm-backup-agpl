"""
RAG Evaluation Pipeline

Tests the semantic search system against a golden set of question-answer pairs
to measure retrieval quality. Run after any RAG changes to verify improvement.

Usage:
  cd backend && .venv/bin/python src/scripts/rag_eval.py
  cd backend && .venv/bin/python src/scripts/rag_eval.py --verbose
  cd backend && .venv/bin/python src/scripts/rag_eval.py --threshold 0.5

Metrics:
  - Precision@5: Of the top 5 results, how many are relevant?
  - Recall: Did we find at least one relevant result?
  - MRR (Mean Reciprocal Rank): How high is the first relevant result?
  - Average similarity score of top results
"""
import argparse
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

from openai import OpenAI
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Golden evaluation set — 20 questions with expected source types and keywords
# ---------------------------------------------------------------------------

EVAL_QUESTIONS: List[Dict[str, Any]] = [
    # --- Meeting transcript questions (should find meeting_transcript chunks) ---
    {
        "id": 1,
        "question": "What was discussed about drywall procurement timelines?",
        "expected_source_types": ["meeting_transcript", "meeting_segment_summary"],
        "expected_keywords": ["drywall", "procurement", "timeline"],
        "category": "meeting_detail",
    },
    {
        "id": 2,
        "question": "What did the team decide about subcontractor pricing?",
        "expected_source_types": ["meeting_transcript", "meeting_segment_summary", "insight"],
        "expected_keywords": ["subcontractor", "pricing", "bid"],
        "category": "meeting_detail",
    },
    {
        "id": 3,
        "question": "What action items came out of the last OAC meeting?",
        "expected_source_types": ["meeting_transcript", "meeting_segment_summary", "meeting_summary"],
        "expected_keywords": ["action", "item", "OAC"],
        "category": "meeting_detail",
    },
    {
        "id": 4,
        "question": "What safety concerns were raised in recent meetings?",
        "expected_source_types": ["meeting_transcript", "meeting_segment_summary", "insight"],
        "expected_keywords": ["safety", "concern", "hazard", "OSHA"],
        "category": "meeting_detail",
    },
    {
        "id": 5,
        "question": "What was discussed about the foundation pour schedule?",
        "expected_source_types": ["meeting_transcript", "meeting_segment_summary"],
        "expected_keywords": ["foundation", "pour", "concrete", "schedule"],
        "category": "meeting_detail",
    },
    # --- Insight/decision questions (should find insight chunks) ---
    {
        "id": 6,
        "question": "What decisions have been made about vendor selection?",
        "expected_source_types": ["insight", "meeting_transcript"],
        "expected_keywords": ["decision", "vendor", "select"],
        "category": "insight",
    },
    {
        "id": 7,
        "question": "What are the biggest risks across our projects?",
        "expected_source_types": ["insight"],
        "expected_keywords": ["risk"],
        "category": "insight",
    },
    {
        "id": 8,
        "question": "What opportunities have we identified for cost savings?",
        "expected_source_types": ["insight"],
        "expected_keywords": ["opportunity", "cost", "saving", "efficiency"],
        "category": "insight",
    },
    # --- Email/Teams questions (should find email/teams chunks) ---
    {
        "id": 9,
        "question": "Any emails about permit delays?",
        "expected_source_types": ["email", "meeting_transcript"],
        "expected_keywords": ["permit", "delay"],
        "category": "email",
    },
    {
        "id": 10,
        "question": "What has been discussed in Teams about project updates?",
        "expected_source_types": ["teams_message", "meeting_transcript"],
        "expected_keywords": ["update", "project", "status"],
        "category": "teams",
    },
    # --- OneDrive document questions ---
    {
        "id": 11,
        "question": "What do the specification documents say about waterproofing?",
        "expected_source_types": ["onedrive_document", "meeting_transcript"],
        "expected_keywords": ["specification", "waterproof"],
        "category": "document",
    },
    {
        "id": 12,
        "question": "Find documents related to HVAC installation requirements",
        "expected_source_types": ["onedrive_document", "meeting_transcript"],
        "expected_keywords": ["HVAC", "install", "mechanical"],
        "category": "document",
    },
    # --- Cross-source broad questions ---
    {
        "id": 13,
        "question": "What's the latest on the Vermillion Rise project?",
        "expected_source_types": ["meeting_transcript", "meeting_summary", "insight", "email"],
        "expected_keywords": ["Vermillion"],
        "category": "cross_source",
    },
    {
        "id": 14,
        "question": "What should I focus on this week as a project manager?",
        "expected_source_types": ["meeting_transcript", "insight", "meeting_summary"],
        "expected_keywords": ["focus", "priority", "action", "urgent"],
        "category": "cross_source",
    },
    {
        "id": 15,
        "question": "What stresses Brandon out the most based on meeting discussions?",
        "expected_source_types": ["meeting_transcript", "meeting_segment_summary"],
        "expected_keywords": ["Brandon"],
        "category": "cross_source",
    },
    {
        "id": 16,
        "question": "How are our client relationships across projects?",
        "expected_source_types": ["meeting_transcript", "insight", "meeting_summary"],
        "expected_keywords": ["client", "relationship", "owner"],
        "category": "cross_source",
    },
    # --- AI memory questions ---
    {
        "id": 17,
        "question": "What do you remember about my preferences for reports?",
        "expected_source_types": ["ai_memory"],
        "expected_keywords": ["preference", "report", "format"],
        "category": "memory",
    },
    # --- Meeting summary questions ---
    {
        "id": 18,
        "question": "Summarize the most recent project meetings",
        "expected_source_types": ["meeting_summary", "meeting_summary_embed"],
        "expected_keywords": ["meeting", "summary", "discuss"],
        "category": "summary",
    },
    {
        "id": 19,
        "question": "What topics have been discussed most frequently in meetings?",
        "expected_source_types": ["meeting_transcript", "meeting_segment_summary", "meeting_summary"],
        "expected_keywords": ["topic", "discuss", "frequent"],
        "category": "summary",
    },
    # --- Company knowledge ---
    {
        "id": 20,
        "question": "What lessons learned do we have about concrete work?",
        "expected_source_types": ["ai_memory", "meeting_transcript", "insight"],
        "expected_keywords": ["lesson", "concrete", "learned"],
        "category": "knowledge",
    },
]


@dataclass
class EvalResult:
    question_id: int
    question: str
    category: str
    num_results: int
    top_similarity: float
    avg_similarity: float
    source_type_match: bool  # Did we get results from expected source types?
    keyword_match: bool  # Did results contain expected keywords?
    reciprocal_rank: float  # 1/rank of first relevant result (0 if none)
    source_types_found: List[str] = field(default_factory=list)
    top_result_preview: str = ""
    latency_ms: float = 0.0


def get_clients():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    openai_key = os.environ["OPENAI_API_KEY"]
    return create_client(url, key), OpenAI(api_key=openai_key)


def embed_query(openai_client: OpenAI, query: str) -> List[float]:
    response = openai_client.embeddings.create(
        model="text-embedding-3-large",
        dimensions=3072,
        input=query[:8000],
    )
    return response.data[0].embedding


def search_chunks(supabase, embedding: List[float], match_count: int = 10, threshold: float = 0.25):
    result = supabase.rpc("search_document_chunks", {
        "query_embedding": json.dumps(embedding),
        "filter_source_types": None,
        "filter_project_id": None,
        "match_count": match_count,
        "match_threshold": threshold,
    }).execute()
    return result.data or []


def evaluate_question(
    supabase, openai_client: OpenAI, q: Dict[str, Any], threshold: float, verbose: bool
) -> EvalResult:
    start = time.time()
    embedding = embed_query(openai_client, q["question"])
    results = search_chunks(supabase, embedding, match_count=10, threshold=threshold)
    latency_ms = (time.time() - start) * 1000

    # Extract source types found
    source_types_found = [r.get("source_type", "unknown") for r in results]

    # Similarity scores
    similarities = [r.get("similarity", 0) for r in results]
    top_sim = similarities[0] if similarities else 0.0
    avg_sim = sum(similarities) / len(similarities) if similarities else 0.0

    # Source type match: did we get at least one result from an expected source type?
    expected = set(q["expected_source_types"])
    found = set(source_types_found)
    source_type_match = bool(expected & found)

    # Keyword match: do any of the top results contain expected keywords?
    expected_keywords = [kw.lower() for kw in q["expected_keywords"]]
    keyword_match = False
    reciprocal_rank = 0.0
    for rank, r in enumerate(results, 1):
        text = (r.get("chunk_text") or "").lower()
        title = (r.get("doc_title") or "").lower()
        combined = text + " " + title
        if any(kw in combined for kw in expected_keywords):
            keyword_match = True
            if reciprocal_rank == 0.0:
                reciprocal_rank = 1.0 / rank
            break

    top_preview = ""
    if results:
        text = results[0].get("chunk_text", "")
        top_preview = text[:150] + "..." if len(text) > 150 else text

    result = EvalResult(
        question_id=q["id"],
        question=q["question"],
        category=q["category"],
        num_results=len(results),
        top_similarity=round(top_sim, 4),
        avg_similarity=round(avg_sim, 4),
        source_type_match=source_type_match,
        keyword_match=keyword_match,
        reciprocal_rank=round(reciprocal_rank, 4),
        source_types_found=source_types_found[:5],
        top_result_preview=top_preview,
        latency_ms=round(latency_ms, 1),
    )

    if verbose:
        status = "PASS" if (source_type_match and keyword_match) else "FAIL"
        logger.info(
            f"  Q{q['id']:02d} [{status}] sim={top_sim:.3f} mrr={reciprocal_rank:.2f} "
            f"sources={source_types_found[:3]} | {q['question'][:60]}"
        )

    return result


def main():
    parser = argparse.ArgumentParser(description="RAG Evaluation Pipeline")
    parser.add_argument("--threshold", type=float, default=0.25, help="Similarity threshold")
    parser.add_argument("--verbose", action="store_true", help="Show per-question results")
    parser.add_argument("--output", type=str, default=None, help="Save results to JSON file")
    args = parser.parse_args()

    supabase, openai_client = get_clients()

    logger.info("=" * 60)
    logger.info("RAG EVALUATION PIPELINE")
    logger.info(f"  Questions: {len(EVAL_QUESTIONS)}")
    logger.info(f"  Threshold: {args.threshold}")
    logger.info("=" * 60)

    results: List[EvalResult] = []
    for q in EVAL_QUESTIONS:
        try:
            r = evaluate_question(supabase, openai_client, q, args.threshold, args.verbose)
            results.append(r)
        except Exception as e:
            logger.error(f"  Q{q['id']:02d} ERROR: {e}")
            results.append(EvalResult(
                question_id=q["id"], question=q["question"], category=q["category"],
                num_results=0, top_similarity=0, avg_similarity=0,
                source_type_match=False, keyword_match=False, reciprocal_rank=0,
            ))

    # Compute aggregate metrics
    total = len(results)
    source_matches = sum(1 for r in results if r.source_type_match)
    keyword_matches = sum(1 for r in results if r.keyword_match)
    both_match = sum(1 for r in results if r.source_type_match and r.keyword_match)
    avg_mrr = sum(r.reciprocal_rank for r in results) / total if total else 0
    avg_top_sim = sum(r.top_similarity for r in results) / total if total else 0
    avg_latency = sum(r.latency_ms for r in results) / total if total else 0
    has_results = sum(1 for r in results if r.num_results > 0)

    logger.info("")
    logger.info("=" * 60)
    logger.info("RESULTS")
    logger.info("=" * 60)
    logger.info(f"  Questions evaluated:     {total}")
    logger.info(f"  Returned results:        {has_results}/{total} ({has_results/total*100:.0f}%)")
    logger.info(f"  Source type match:       {source_matches}/{total} ({source_matches/total*100:.0f}%)")
    logger.info(f"  Keyword match:           {keyword_matches}/{total} ({keyword_matches/total*100:.0f}%)")
    logger.info(f"  Both match (pass rate):  {both_match}/{total} ({both_match/total*100:.0f}%)")
    logger.info(f"  Mean Reciprocal Rank:    {avg_mrr:.3f}")
    logger.info(f"  Avg top similarity:      {avg_top_sim:.3f}")
    logger.info(f"  Avg latency:             {avg_latency:.0f}ms")
    logger.info("")

    # Per-category breakdown
    categories = sorted(set(r.category for r in results))
    logger.info("Per-category breakdown:")
    for cat in categories:
        cat_results = [r for r in results if r.category == cat]
        cat_pass = sum(1 for r in cat_results if r.source_type_match and r.keyword_match)
        cat_mrr = sum(r.reciprocal_rank for r in cat_results) / len(cat_results)
        logger.info(f"  {cat:20s}: {cat_pass}/{len(cat_results)} pass, MRR={cat_mrr:.3f}")

    # Failed questions
    failures = [r for r in results if not (r.source_type_match and r.keyword_match)]
    if failures:
        logger.info("")
        logger.info("FAILED QUESTIONS:")
        for r in failures:
            logger.info(f"  Q{r.question_id:02d}: {r.question[:70]}")
            logger.info(f"       → {r.num_results} results, top_sim={r.top_similarity:.3f}, sources={r.source_types_found[:3]}")

    # Save results if requested
    if args.output:
        output_data = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "threshold": args.threshold,
            "summary": {
                "total": total,
                "pass_rate": both_match / total if total else 0,
                "source_match_rate": source_matches / total if total else 0,
                "keyword_match_rate": keyword_matches / total if total else 0,
                "mrr": avg_mrr,
                "avg_top_similarity": avg_top_sim,
                "avg_latency_ms": avg_latency,
            },
            "per_question": [
                {
                    "id": r.question_id,
                    "question": r.question,
                    "category": r.category,
                    "passed": r.source_type_match and r.keyword_match,
                    "num_results": r.num_results,
                    "top_similarity": r.top_similarity,
                    "mrr": r.reciprocal_rank,
                    "source_types_found": r.source_types_found,
                    "latency_ms": r.latency_ms,
                }
                for r in results
            ],
        }
        with open(args.output, "w") as f:
            json.dump(output_data, f, indent=2)
        logger.info(f"\nResults saved to {args.output}")

    logger.info("=" * 60)

    # Exit with failure code if pass rate < 50%
    if both_match / total < 0.5:
        logger.warning("FAIL: Pass rate below 50%")
        sys.exit(1)


if __name__ == "__main__":
    main()
