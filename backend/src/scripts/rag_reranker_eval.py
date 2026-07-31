#!/usr/bin/env python3
"""
RAG Reranker A/B Evaluation

Tests whether the LLM reranker (gpt-4o-mini cross-encoder) actually improves
retrieval quality compared to pure cosine-similarity ordering.

Runs all 20 eval questions twice:
  - Without reranker: results ordered by cosine similarity
  - With reranker:    results re-ordered by gpt-4o-mini relevance scores

Compares MRR, Precision@5, and source-type match rate between the two modes.

Usage:
  cd backend && .venv/bin/python src/scripts/rag_reranker_eval.py
  cd backend && .venv/bin/python src/scripts/rag_reranker_eval.py --verbose
  cd backend && .venv/bin/python src/scripts/rag_reranker_eval.py --output /tmp/reranker-eval.json
  cd backend && .venv/bin/python src/scripts/rag_reranker_eval.py --question 5
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

from openai import OpenAI
from supabase import create_client, ClientOptions

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Re-use the same 20 eval questions from rag_eval.py
# ---------------------------------------------------------------------------

EVAL_QUESTIONS: List[Dict[str, Any]] = [
    {"id": 1,  "question": "What was discussed about drywall procurement timelines?",         "expected_source_types": ["meeting_transcript", "meeting_segment_summary"],            "expected_keywords": ["drywall", "procurement", "timeline"],          "category": "meeting_detail"},
    {"id": 2,  "question": "What did the team decide about subcontractor pricing?",           "expected_source_types": ["meeting_transcript", "meeting_segment_summary", "insight"],  "expected_keywords": ["subcontractor", "pricing", "bid"],             "category": "meeting_detail"},
    {"id": 3,  "question": "What action items came out of the last OAC meeting?",             "expected_source_types": ["meeting_transcript", "meeting_segment_summary", "meeting_summary"], "expected_keywords": ["action", "item", "OAC"],                 "category": "meeting_detail"},
    {"id": 4,  "question": "What safety concerns were raised in recent meetings?",            "expected_source_types": ["meeting_transcript", "meeting_segment_summary", "insight"],  "expected_keywords": ["safety", "concern", "hazard", "OSHA"],         "category": "meeting_detail"},
    {"id": 5,  "question": "What was discussed about the foundation pour schedule?",          "expected_source_types": ["meeting_transcript", "meeting_segment_summary"],            "expected_keywords": ["foundation", "pour", "concrete", "schedule"],  "category": "meeting_detail"},
    {"id": 6,  "question": "What decisions have been made about vendor selection?",           "expected_source_types": ["insight", "meeting_transcript"],                            "expected_keywords": ["decision", "vendor", "select"],                "category": "insight"},
    {"id": 7,  "question": "What are the biggest risks across our projects?",                 "expected_source_types": ["insight"],                                                  "expected_keywords": ["risk"],                                        "category": "insight"},
    {"id": 8,  "question": "What opportunities have we identified for cost savings?",         "expected_source_types": ["insight"],                                                  "expected_keywords": ["opportunity", "cost", "saving", "efficiency"], "category": "insight"},
    {"id": 9,  "question": "Any emails about permit delays?",                                 "expected_source_types": ["email", "meeting_transcript"],                              "expected_keywords": ["permit", "delay"],                             "category": "email"},
    {"id": 10, "question": "What has been discussed in Teams about project updates?",         "expected_source_types": ["teams_message", "meeting_transcript"],                     "expected_keywords": ["update", "project", "status"],                 "category": "teams"},
    {"id": 11, "question": "What do the specification documents say about waterproofing?",    "expected_source_types": ["onedrive_document", "meeting_transcript"],                  "expected_keywords": ["specification", "waterproof"],                 "category": "document"},
    {"id": 12, "question": "Find documents related to HVAC installation requirements",        "expected_source_types": ["onedrive_document", "meeting_transcript"],                  "expected_keywords": ["HVAC", "install", "mechanical"],               "category": "document"},
    {"id": 13, "question": "What's the latest on the Vermillion Rise project?",              "expected_source_types": ["meeting_transcript", "meeting_summary", "insight", "email"], "expected_keywords": ["Vermillion"],                                 "category": "cross_source"},
    {"id": 14, "question": "What should I focus on this week as a project manager?",          "expected_source_types": ["meeting_transcript", "insight", "meeting_summary"],         "expected_keywords": ["focus", "priority", "action", "urgent"],       "category": "cross_source"},
    {"id": 15, "question": "What stresses Brandon out the most based on meeting discussions?","expected_source_types": ["meeting_transcript", "meeting_segment_summary"],            "expected_keywords": ["Brandon"],                                     "category": "cross_source"},
    {"id": 16, "question": "How are our client relationships across projects?",               "expected_source_types": ["meeting_transcript", "insight", "meeting_summary"],         "expected_keywords": ["client", "relationship", "owner"],             "category": "cross_source"},
    {"id": 17, "question": "What do you remember about my preferences for reports?",          "expected_source_types": ["ai_memory"],                                                "expected_keywords": ["preference", "report", "format"],              "category": "memory"},
    {"id": 18, "question": "Summarize the most recent project meetings",                      "expected_source_types": ["meeting_summary", "meeting_summary_embed"],                 "expected_keywords": ["meeting", "summary", "discuss"],               "category": "summary"},
    {"id": 19, "question": "What topics have been discussed most frequently in meetings?",    "expected_source_types": ["meeting_transcript", "meeting_segment_summary", "meeting_summary"], "expected_keywords": ["topic", "discuss", "frequent"],          "category": "summary"},
    {"id": 20, "question": "What lessons learned do we have about concrete work?",            "expected_source_types": ["ai_memory", "meeting_transcript", "insight"],               "expected_keywords": ["lesson", "concrete", "learned"],               "category": "knowledge"},
]

# Reranker prompt — matches the production implementation in operational.ts
RERANKER_SYSTEM_PROMPT = """You are a relevance scoring assistant. Given a user query and a list of text passages,
score each passage's relevance to the query on a scale of 0-10.

Return ONLY a JSON array of numbers (scores), one per passage, in the same order.
Example response for 5 passages: [8, 3, 9, 1, 7]

Do not include any other text, explanation, or formatting."""


@dataclass
class QuestionComparison:
    question_id: int
    question: str
    category: str
    # Without reranker
    no_rerank_mrr: float
    no_rerank_source_match: bool
    no_rerank_keyword_match: bool
    no_rerank_sources: List[str] = field(default_factory=list)
    # With reranker
    rerank_mrr: float = 0.0
    rerank_source_match: bool = False
    rerank_keyword_match: bool = False
    rerank_sources: List[str] = field(default_factory=list)
    # Latency
    vector_latency_ms: float = 0.0
    rerank_latency_ms: float = 0.0
    error: Optional[str] = None


def get_clients():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    openai_key = os.environ["OPENAI_API_KEY"]
    if not url or not key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    options = ClientOptions(postgrest_client_timeout=300)
    return create_client(url, key, options), OpenAI(api_key=openai_key)


def embed_query(openai_client: OpenAI, query: str) -> List[float]:
    resp = openai_client.embeddings.create(
        model="text-embedding-3-large",
        dimensions=3072,
        input=query[:8000],
    )
    return resp.data[0].embedding


def fetch_candidates(supabase, embedding: List[float], match_count: int = 20, threshold: float = 0.25) -> List[Dict]:
    """Fetch more candidates than needed so reranker has material to work with."""
    result = supabase.rpc("search_document_chunks", {
        "query_embedding": json.dumps(embedding),
        "filter_source_types": None,
        "filter_project_id": None,
        "match_count": match_count,
        "match_threshold": threshold,
    }).execute()
    return result.data or []


def rerank_with_llm(
    openai_client: OpenAI, query: str, candidates: List[Dict], top_k: int = 10
) -> List[Dict]:
    """Re-order candidates by LLM relevance score. Mirrors operational.ts rerankWithLLM."""
    if len(candidates) <= 3:
        return candidates[:top_k]

    # Build numbered list of excerpts — same truncation as TypeScript implementation
    passages = [
        f"[{i}] ({c.get('source_type', '?')}) {(c.get('chunk_text') or '')[:300]}"
        for i, c in enumerate(candidates[:20])
    ]
    passages_text = "\n\n".join(passages)

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=200,
            messages=[
                {"role": "system", "content": RERANKER_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Query: {query}\n\n"
                        f"Passages:\n{passages_text}\n\n"
                        "Return a JSON array of relevance scores (0-10), one per passage."
                    ),
                },
            ],
        )
        raw = (response.choices[0].message.content or "").strip()
        # Parse scores — handle both plain array and possible fences
        if raw.startswith("["):
            scores: List[float] = json.loads(raw)
        else:
            import re
            match = re.search(r"\[[\d,.\s]+\]", raw)
            scores = json.loads(match.group(0)) if match else []

        if not scores or len(scores) < len(candidates[:20]):
            return candidates[:top_k]

        # Sort candidates by score descending, return top_k
        scored = list(zip(candidates[:20], scores))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [c for c, _ in scored[:top_k]]

    except Exception as exc:
        logger.warning(f"Reranker failed for query '{query[:40]}': {exc} — falling back to original order")
        return candidates[:top_k]


def _eval_metrics(results: List[Dict], expected_source_types: List[str], expected_keywords: List[str]):
    """Compute source_match, keyword_match, MRR from a result list."""
    source_types_found = [r.get("source_type", "unknown") for r in results]
    expected_s = set(expected_source_types)
    source_match = bool(expected_s & set(source_types_found))

    expected_kws = [kw.lower() for kw in expected_keywords]
    keyword_match = False
    reciprocal_rank = 0.0
    for rank, r in enumerate(results, 1):
        text = (r.get("chunk_text") or "").lower()
        title = (r.get("doc_title") or "").lower()
        combined = text + " " + title
        if any(kw in combined for kw in expected_kws):
            keyword_match = True
            if reciprocal_rank == 0.0:
                reciprocal_rank = 1.0 / rank
            break

    return source_match, keyword_match, round(reciprocal_rank, 4), source_types_found[:5]


def evaluate_question(
    supabase, openai_client: OpenAI, q: Dict[str, Any], verbose: bool
) -> QuestionComparison:
    comp = QuestionComparison(
        question_id=q["id"],
        question=q["question"],
        category=q["category"],
        no_rerank_mrr=0.0,
        no_rerank_source_match=False,
        no_rerank_keyword_match=False,
    )

    try:
        # Step 1: embed + fetch candidates (shared)
        t0 = time.time()
        embedding = embed_query(openai_client, q["question"])
        candidates = fetch_candidates(supabase, embedding, match_count=20)
        comp.vector_latency_ms = round((time.time() - t0) * 1000, 1)

        # Step 2: WITHOUT reranker — top 10 by cosine similarity
        no_rerank_results = candidates[:10]
        sm, km, mrr, sources = _eval_metrics(
            no_rerank_results, q["expected_source_types"], q["expected_keywords"]
        )
        comp.no_rerank_source_match = sm
        comp.no_rerank_keyword_match = km
        comp.no_rerank_mrr = mrr
        comp.no_rerank_sources = sources

        # Step 3: WITH reranker — re-order candidates using LLM
        t1 = time.time()
        reranked = rerank_with_llm(openai_client, q["question"], candidates, top_k=10)
        comp.rerank_latency_ms = round((time.time() - t1) * 1000, 1)

        sm2, km2, mrr2, sources2 = _eval_metrics(
            reranked, q["expected_source_types"], q["expected_keywords"]
        )
        comp.rerank_source_match = sm2
        comp.rerank_keyword_match = km2
        comp.rerank_mrr = mrr2
        comp.rerank_sources = sources2

        if verbose:
            no_pass = sm and km
            re_pass = sm2 and km2
            change = ("→" if no_pass == re_pass else
                      ("+PASS" if re_pass and not no_pass else "-FAIL"))
            logger.info(
                f"  Q{q['id']:02d} [{change:6s}]  "
                f"no-rerank MRR={mrr:.2f}  rerank MRR={mrr2:.2f}  "
                f"rerank_ms={comp.rerank_latency_ms:.0f}  "
                f"| {q['question'][:55]}"
            )

    except Exception as exc:
        comp.error = str(exc)
        logger.error(f"  Q{q['id']:02d} ERROR: {exc}")

    return comp


def print_summary(comparisons: List[QuestionComparison]) -> None:
    total = len(comparisons)
    ok = [c for c in comparisons if not c.error]

    def pct(n, d): return f"{n/d*100:.0f}%" if d else "0%"

    no_pass  = sum(1 for c in ok if c.no_rerank_source_match and c.no_rerank_keyword_match)
    re_pass  = sum(1 for c in ok if c.rerank_source_match and c.rerank_keyword_match)
    no_mrr   = sum(c.no_rerank_mrr for c in ok) / len(ok) if ok else 0
    re_mrr   = sum(c.rerank_mrr for c in ok) / len(ok) if ok else 0
    avg_rerank_ms = sum(c.rerank_latency_ms for c in ok) / len(ok) if ok else 0

    # Count changes
    newly_pass  = [c for c in ok if not (c.no_rerank_source_match and c.no_rerank_keyword_match)
                   and (c.rerank_source_match and c.rerank_keyword_match)]
    newly_fail  = [c for c in ok if (c.no_rerank_source_match and c.no_rerank_keyword_match)
                   and not (c.rerank_source_match and c.rerank_keyword_match)]

    logger.info("")
    logger.info("=" * 65)
    logger.info("RERANKER A/B RESULTS")
    logger.info("=" * 65)
    logger.info(f"  {'Metric':24s}  {'Without Reranker':18s}  {'With Reranker':16s}  {'Delta':8s}")
    logger.info(f"  {'-'*24}  {'-'*18}  {'-'*16}  {'-'*8}")
    logger.info(f"  {'Pass rate':24s}  {pct(no_pass, total):18s}  {pct(re_pass, total):16s}  "
                f"{re_pass - no_pass:+d} questions")
    logger.info(f"  {'MRR':24s}  {no_mrr:.3f}              {re_mrr:.3f}           "
                f"  {re_mrr - no_mrr:+.3f}")
    logger.info(f"  {'Avg reranker latency':24s}  {'—':18s}  {avg_rerank_ms:.0f}ms")
    logger.info("")

    if newly_pass:
        logger.info(f"  + Reranker HELPED ({len(newly_pass)} questions now pass):")
        for c in newly_pass:
            logger.info(f"      Q{c.question_id:02d} MRR {c.no_rerank_mrr:.2f}→{c.rerank_mrr:.2f}  {c.question[:60]}")

    if newly_fail:
        logger.info(f"  - Reranker HURT ({len(newly_fail)} questions now fail):")
        for c in newly_fail:
            logger.info(f"      Q{c.question_id:02d} MRR {c.no_rerank_mrr:.2f}→{c.rerank_mrr:.2f}  {c.question[:60]}")

    if not newly_pass and not newly_fail:
        logger.info("  → No pass/fail changes — reranker reorders but doesn't change which questions pass.")

    # Per-category MRR delta
    logger.info("")
    logger.info("Per-category MRR impact:")
    categories = sorted(set(c.category for c in ok))
    for cat in categories:
        cat_comps = [c for c in ok if c.category == cat]
        no_cat_mrr = sum(c.no_rerank_mrr for c in cat_comps) / len(cat_comps)
        re_cat_mrr = sum(c.rerank_mrr for c in cat_comps) / len(cat_comps)
        delta = re_cat_mrr - no_cat_mrr
        sign = "+" if delta >= 0 else ""
        logger.info(f"  {cat:22s} {no_cat_mrr:.3f} → {re_cat_mrr:.3f}  ({sign}{delta:.3f})")

    logger.info("=" * 65)


def main() -> int:
    parser = argparse.ArgumentParser(description="Reranker A/B evaluation")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--question", type=int, default=None, help="Run only this question ID")
    parser.add_argument("--output", type=str, default=None)
    parser.add_argument("--threshold", type=float, default=0.25)
    args = parser.parse_args()

    supabase, openai_client = get_clients()

    questions = EVAL_QUESTIONS
    if args.question:
        questions = [q for q in questions if q["id"] == args.question]
        if not questions:
            logger.error(f"Question {args.question} not found")
            return 2

    logger.info("=" * 65)
    logger.info("RAG RERANKER A/B EVALUATION")
    logger.info(f"  Questions: {len(questions)}")
    logger.info(f"  Each question: vector-only (top 10) vs. LLM-reranked (top 20→10)")
    logger.info("=" * 65)

    comparisons: List[QuestionComparison] = []
    for q in questions:
        comp = evaluate_question(supabase, openai_client, q, args.verbose)
        comparisons.append(comp)

    print_summary(comparisons)

    if args.output:
        output_data = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "eval_type": "reranker_ab",
            "num_questions": len(comparisons),
            "summary": {
                "no_rerank_pass_rate": sum(
                    1 for c in comparisons if c.no_rerank_source_match and c.no_rerank_keyword_match
                ) / len(comparisons) if comparisons else 0,
                "rerank_pass_rate": sum(
                    1 for c in comparisons if c.rerank_source_match and c.rerank_keyword_match
                ) / len(comparisons) if comparisons else 0,
                "no_rerank_mrr": sum(c.no_rerank_mrr for c in comparisons) / len(comparisons) if comparisons else 0,
                "rerank_mrr": sum(c.rerank_mrr for c in comparisons) / len(comparisons) if comparisons else 0,
                "avg_rerank_latency_ms": sum(c.rerank_latency_ms for c in comparisons) / len(comparisons) if comparisons else 0,
            },
            "questions": [asdict(c) for c in comparisons],
        }
        with open(args.output, "w") as f:
            json.dump(output_data, f, indent=2)
        logger.info(f"\nResults saved to {args.output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
