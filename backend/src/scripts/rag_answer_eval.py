"""
RAG Answer Evaluation Pipeline (Level 2)

End-to-end evaluation of the RAG AI chat system. For each test question:
1. Generates an embedding and retrieves relevant chunks via search_document_chunks RPC
2. Sends the question + retrieved context to GPT-4o to generate an answer
3. Uses a GPT-4o-mini judge to score the answer on 5 dimensions
4. Outputs a detailed report with per-question scores, category averages, and overall metrics

This builds on the Level 1 retrieval eval (rag_eval.py) by testing full answer quality,
not just whether the right chunks were retrieved.

Usage:
  cd backend && .venv/bin/python src/scripts/rag_answer_eval.py --verbose
  cd backend && .venv/bin/python src/scripts/rag_answer_eval.py --dry-run
  cd backend && .venv/bin/python src/scripts/rag_answer_eval.py --question 5
  cd backend && .venv/bin/python src/scripts/rag_answer_eval.py --output /tmp/my-eval.json
"""

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# Load env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

from openai import OpenAI
from supabase import create_client, ClientOptions

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 20 evaluation questions with scoring criteria
# ---------------------------------------------------------------------------

EVAL_QUESTIONS: List[Dict[str, Any]] = [
    # Meeting-based questions
    {
        "id": 1,
        "question": "What was discussed about drywall procurement timelines?",
        "category": "meeting_detail",
        "good_answer_criteria": "Should reference specific meetings, mention dates or timelines, include speaker names or project context",
    },
    {
        "id": 2,
        "question": "What did the team decide about subcontractor pricing?",
        "category": "meeting_detail",
        "good_answer_criteria": "Should mention specific pricing decisions, vendor names, dollar amounts if available",
    },
    {
        "id": 3,
        "question": "What action items came out of the last OAC meeting?",
        "category": "meeting_detail",
        "good_answer_criteria": "Should list specific action items with assignees and due dates where available",
    },
    {
        "id": 4,
        "question": "What safety concerns were raised in recent meetings?",
        "category": "meeting_detail",
        "good_answer_criteria": "Should identify specific safety issues, not generic safety advice",
    },
    {
        "id": 5,
        "question": "What was discussed about the foundation pour schedule?",
        "category": "meeting_detail",
        "good_answer_criteria": "Should reference specific dates, concrete work details, project context",
    },
    # Insight questions
    {
        "id": 6,
        "question": "What decisions have been made about vendor selection?",
        "category": "insight",
        "good_answer_criteria": "Should list specific decisions with owners and rationale, not generic advice",
    },
    {
        "id": 7,
        "question": "What are the biggest risks across our projects?",
        "category": "insight",
        "good_answer_criteria": "Should identify specific risks by project with severity assessment",
    },
    {
        "id": 8,
        "question": "What opportunities have we identified for cost savings?",
        "category": "insight",
        "good_answer_criteria": "Should mention specific opportunities from actual meetings/data, not generic suggestions",
    },
    # Cross-source questions
    {
        "id": 9,
        "question": "What's the latest on the Vermillion Rise project?",
        "category": "cross_source",
        "good_answer_criteria": "Should synthesize recent activity from meetings, emails, tasks — not just one source",
    },
    {
        "id": 10,
        "question": "What should I focus on this week as the owner?",
        "category": "cross_source",
        "good_answer_criteria": "Should give specific, actionable priorities based on actual project data, not generic PM advice",
    },
    {
        "id": 11,
        "question": "What stresses Brandon out the most based on meeting discussions?",
        "category": "cross_source",
        "good_answer_criteria": "Should reference specific issues Brandon has raised in meetings, with context",
    },
    {
        "id": 12,
        "question": "How are our client relationships across projects?",
        "category": "cross_source",
        "good_answer_criteria": "Should reference specific client interactions from meetings, not generic relationship advice",
    },
    # Financial questions (should use SQL tools)
    {
        "id": 13,
        "question": "What is the total budget for Vermillion Rise Warehouse?",
        "category": "financial",
        "good_answer_criteria": "Should return a specific dollar amount from the budget table, not a vague estimate",
    },
    {
        "id": 14,
        "question": "Show me the change orders for Vermillion Rise",
        "category": "financial",
        "good_answer_criteria": "Should list specific change orders with numbers, amounts, and statuses",
    },
    {
        "id": 15,
        "question": "What commitments do we have on the Vermillion Rise project?",
        "category": "financial",
        "good_answer_criteria": "Should list specific subcontracts/POs with vendor names and amounts",
    },
    # Strategic questions
    {
        "id": 16,
        "question": "Give me the state of the business right now",
        "category": "strategic",
        "good_answer_criteria": "Should cover multiple dimensions: financial health, project status, risks, opportunities",
    },
    {
        "id": 17,
        "question": "What HR problems might I not be aware of?",
        "category": "strategic",
        "good_answer_criteria": "Should surface HR-related discussions from meetings if any exist, or honestly say no data",
    },
    {
        "id": 18,
        "question": "How can we improve our scheduling process?",
        "category": "strategic",
        "good_answer_criteria": "Should reference actual scheduling issues from meetings, not generic advice",
    },
    # Simple questions
    {
        "id": 19,
        "question": "What projects do we have?",
        "category": "simple",
        "good_answer_criteria": "Should list actual project names from the database",
    },
    {
        "id": 20,
        "question": "Tell me about the last 3 meetings",
        "category": "simple",
        "good_answer_criteria": "Should list actual meeting titles, dates, and brief summaries",
    },
]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class JudgeScores:
    specificity: int = 0
    accuracy: int = 0
    completeness: int = 0
    actionability: int = 0
    overall: int = 0
    explanation: str = ""


@dataclass
class QuestionResult:
    question_id: int
    question: str
    category: str
    good_answer_criteria: str
    num_chunks_retrieved: int
    top_similarity: float
    generated_answer: str
    scores: JudgeScores
    latency_retrieval_ms: float = 0.0
    latency_generation_ms: float = 0.0
    latency_judging_ms: float = 0.0
    error: Optional[str] = None
    chunk_sources: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------


def get_clients():
    """Initialize Supabase and OpenAI clients from environment."""
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    openai_key = os.environ["OPENAI_API_KEY"]

    if not url or not key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)

    options = ClientOptions(postgrest_client_timeout=300)
    return create_client(url, key, options), OpenAI(api_key=openai_key)


# ---------------------------------------------------------------------------
# Step 1: Retrieval
# ---------------------------------------------------------------------------


def embed_query(openai_client: OpenAI, query: str) -> List[float]:
    """Generate embedding for a query string."""
    response = openai_client.embeddings.create(
        model="text-embedding-3-large",
        dimensions=3072,
        input=query[:8000],
    )
    return response.data[0].embedding


def search_chunks(
    supabase, embedding: List[float], match_count: int = 10, threshold: float = 0.25
) -> List[Dict[str, Any]]:
    """Search document_chunks using direct query (avoids PostgREST RPC schema cache issues)."""
    emb_str = json.dumps(embedding)
    try:
        # Try RPC first
        result = supabase.rpc(
            "search_document_chunks",
            {
                "query_embedding": emb_str,
                "filter_source_types": None,
                "filter_project_id": None,
                "match_count": match_count,
                "match_threshold": threshold,
            },
        ).execute()
        return result.data or []
    except Exception:
        # Fallback: direct table query with client-side similarity calc
        # Fetch chunks that might be relevant (can't do vector ops via REST easily)
        # So we use a simpler approach: get recent chunks and do cosine sim in Python
        logger.warning("RPC failed, falling back to direct query")
        import numpy as np

        # Fetch a sample of chunks with embeddings
        result = supabase.table("document_chunks").select(
            "chunk_id, document_id, chunk_index, text, source_type, metadata, embedding, created_at"
        ).not_.is_("embedding", "null").order("created_at", desc=True).limit(500).execute()

        if not result.data:
            return []

        query_vec = np.array(embedding)
        scored = []
        for row in result.data:
            row_emb = row.get("embedding")
            if not row_emb:
                continue
            # Parse embedding string to float array
            if isinstance(row_emb, str):
                row_vec = np.array(json.loads(row_emb))
            elif isinstance(row_emb, list):
                row_vec = np.array(row_emb)
            else:
                continue
            # Cosine similarity
            sim = float(np.dot(query_vec, row_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(row_vec) + 1e-10))
            if sim >= threshold:
                scored.append({
                    "chunk_id": row["chunk_id"],
                    "document_id": row["document_id"],
                    "chunk_index": row["chunk_index"],
                    "chunk_text": row["text"],
                    "source_type": row["source_type"],
                    "similarity": round(sim, 4),
                    "doc_metadata": row.get("metadata"),
                })

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:match_count]


# ---------------------------------------------------------------------------
# Step 2: Answer generation
# ---------------------------------------------------------------------------

ANSWER_SYSTEM_PROMPT = """You are Alleato AI — the strategic advisor embedded inside Alleato Group, a commercial construction company. You've been part of this team for years. You know the projects, the people, the patterns.

You speak in ONE voice — direct, confident, specific. You're not a panel of executives or a committee. You're one sharp person who understands finance, operations, risk, and business development and weaves them together naturally.

You have been provided with relevant context retrieved from the company's knowledge base.
Use ONLY this context to answer the question. If the context doesn't contain enough information
to answer well, say so honestly rather than making things up.

Rules:
- Lead with the most important insight, not a preamble
- Name the project, the number, the person, the deadline — vague advice is noise
- Never use role labels like "CFO Assessment:" or "COO Assessment:" — just speak directly
- When something's wrong, say it first. When something looks good, acknowledge it
- End with what to do about it — specific, actionable
- Never perform enthusiasm ("Great question!") or hedge everything into meaninglessness"""


def format_context(chunks: List[Dict[str, Any]]) -> str:
    """Format retrieved chunks into a context string for the LLM."""
    if not chunks:
        return "(No relevant documents found in the knowledge base.)"

    parts = []
    for i, chunk in enumerate(chunks, 1):
        source_type = chunk.get("source_type", "unknown")
        doc_title = chunk.get("doc_title", "Untitled")
        similarity = chunk.get("similarity", 0)
        text = chunk.get("chunk_text", "")

        parts.append(
            f"--- Source {i} [{source_type}] (relevance: {similarity:.2f}) ---\n"
            f"Title: {doc_title}\n"
            f"{text}\n"
        )

    return "\n".join(parts)


def generate_answer(
    openai_client: OpenAI, question: str, chunks: List[Dict[str, Any]]
) -> str:
    """Generate an answer using GPT-4o given the question and retrieved context."""
    context = format_context(chunks)

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        temperature=0.3,
        max_tokens=1500,
        messages=[
            {"role": "system", "content": ANSWER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Context from knowledge base:\n\n{context}\n\n"
                    f"---\n\n"
                    f"Question: {question}\n\n"
                    f"Please answer based on the context above."
                ),
            },
        ],
    )
    return response.choices[0].message.content or "(empty response)"


# ---------------------------------------------------------------------------
# Step 3: LLM Judge
# ---------------------------------------------------------------------------

JUDGE_SYSTEM_PROMPT = """You are an expert evaluator for a RAG (Retrieval-Augmented Generation) system
used by a construction project management company. Your job is to score the quality of AI-generated
answers on 5 dimensions.

Score each dimension from 1 (worst) to 5 (best):

1. **Specificity (1-5)**: Does the answer reference specific data (names, dates, numbers, projects)
   vs giving generic advice?
   - 1 = Entirely generic, no specific details
   - 3 = Some specific details mixed with generic filler
   - 5 = Rich with specific names, dates, numbers, project references

2. **Accuracy (1-5)**: Is the answer grounded in the retrieved context, not hallucinated?
   - 1 = Mostly hallucinated or contradicts the context
   - 3 = Partially grounded but includes unsupported claims
   - 5 = Fully grounded in provided context, clearly distinguishes known from unknown

3. **Completeness (1-5)**: Does the answer address all aspects of the question?
   - 1 = Misses the question entirely or addresses a different topic
   - 3 = Addresses the main point but misses important aspects
   - 5 = Thoroughly addresses all aspects of the question

4. **Actionability (1-5)**: Does the answer give the user something they can act on?
   - 1 = No actionable information
   - 3 = Some useful information but user needs to dig further
   - 5 = Clear, actionable information the user can immediately use

5. **Overall (1-5)**: Overall quality as a strategic business advisor response
   - 1 = Would damage trust in the AI system
   - 3 = Acceptable but not impressive
   - 5 = Excellent — feels like having a knowledgeable assistant

You MUST respond with valid JSON only, no markdown fences. Use this exact structure:
{
  "specificity": <1-5>,
  "accuracy": <1-5>,
  "completeness": <1-5>,
  "actionability": <1-5>,
  "overall": <1-5>,
  "explanation": "<2-3 sentence explanation of the scores>"
}"""


def judge_answer(
    openai_client: OpenAI,
    question: str,
    answer: str,
    criteria: str,
) -> JudgeScores:
    """Use GPT-4o-mini to judge the quality of a generated answer."""
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.0,
        max_tokens=500,
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Question asked: {question}\n\n"
                    f"Good answer criteria: {criteria}\n\n"
                    f"AI-generated answer:\n{answer}\n\n"
                    f"Score this answer on all 5 dimensions. Return JSON only."
                ),
            },
        ],
    )

    raw = response.choices[0].message.content or "{}"

    # Strip markdown code fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        # Remove first and last lines (fences)
        lines = [l for l in lines if not l.strip().startswith("```")]
        raw = "\n".join(lines)

    try:
        data = json.loads(raw)
        return JudgeScores(
            specificity=int(data.get("specificity", 0)),
            accuracy=int(data.get("accuracy", 0)),
            completeness=int(data.get("completeness", 0)),
            actionability=int(data.get("actionability", 0)),
            overall=int(data.get("overall", 0)),
            explanation=data.get("explanation", ""),
        )
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"Failed to parse judge response: {e}\nRaw: {raw[:300]}")
        return JudgeScores(explanation=f"Parse error: {e}")


# ---------------------------------------------------------------------------
# Evaluation pipeline
# ---------------------------------------------------------------------------


def evaluate_question(
    supabase,
    openai_client: OpenAI,
    q: Dict[str, Any],
    verbose: bool,
) -> QuestionResult:
    """Run the full eval pipeline for a single question."""

    # Step 1: Retrieve
    t0 = time.time()
    embedding = embed_query(openai_client, q["question"])
    chunks = search_chunks(supabase, embedding, match_count=10, threshold=0.25)
    latency_retrieval = (time.time() - t0) * 1000

    similarities = [c.get("similarity", 0) for c in chunks]
    top_sim = similarities[0] if similarities else 0.0
    chunk_sources = [c.get("source_type", "unknown") for c in chunks[:5]]

    # Step 2: Generate answer
    t1 = time.time()
    answer = generate_answer(openai_client, q["question"], chunks)
    latency_generation = (time.time() - t1) * 1000

    # Step 3: Judge
    t2 = time.time()
    scores = judge_answer(openai_client, q["question"], answer, q["good_answer_criteria"])
    latency_judging = (time.time() - t2) * 1000

    result = QuestionResult(
        question_id=q["id"],
        question=q["question"],
        category=q["category"],
        good_answer_criteria=q["good_answer_criteria"],
        num_chunks_retrieved=len(chunks),
        top_similarity=round(top_sim, 4),
        generated_answer=answer,
        scores=scores,
        latency_retrieval_ms=round(latency_retrieval, 1),
        latency_generation_ms=round(latency_generation, 1),
        latency_judging_ms=round(latency_judging, 1),
        chunk_sources=chunk_sources,
    )

    if verbose:
        total_score = scores.overall
        label = "GOOD" if total_score >= 4 else ("OK" if total_score >= 3 else "POOR")
        logger.info(
            f"  Q{q['id']:02d} [{label}] overall={total_score}/5 "
            f"spec={scores.specificity} acc={scores.accuracy} "
            f"comp={scores.completeness} act={scores.actionability} "
            f"| {q['question'][:55]}"
        )

    return result


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def print_report(results: List[QuestionResult]):
    """Print a formatted summary report to the console."""
    total = len(results)
    if total == 0:
        logger.info("No results to report.")
        return

    # Aggregate scores
    dims = ["specificity", "accuracy", "completeness", "actionability", "overall"]
    dim_totals = {d: 0 for d in dims}
    for r in results:
        for d in dims:
            dim_totals[d] += getattr(r.scores, d)

    logger.info("")
    logger.info("=" * 70)
    logger.info("RAG ANSWER EVALUATION RESULTS (Level 2)")
    logger.info("=" * 70)
    logger.info(f"  Questions evaluated: {total}")
    logger.info("")
    logger.info("  Overall dimension averages (out of 5.0):")
    for d in dims:
        avg = dim_totals[d] / total
        bar = "#" * int(avg * 4)  # simple bar chart
        logger.info(f"    {d:15s}: {avg:.2f}  {bar}")

    # Per-category breakdown
    categories = sorted(set(r.category for r in results))
    logger.info("")
    logger.info("  Per-category averages:")
    logger.info(f"    {'Category':20s} {'Spec':>5s} {'Acc':>5s} {'Comp':>5s} {'Act':>5s} {'Ovrl':>5s}  n")
    logger.info(f"    {'-'*20} {'-'*5} {'-'*5} {'-'*5} {'-'*5} {'-'*5}  -")
    for cat in categories:
        cat_results = [r for r in results if r.category == cat]
        n = len(cat_results)
        avgs = {}
        for d in dims:
            avgs[d] = sum(getattr(r.scores, d) for r in cat_results) / n
        logger.info(
            f"    {cat:20s} {avgs['specificity']:5.1f} {avgs['accuracy']:5.1f} "
            f"{avgs['completeness']:5.1f} {avgs['actionability']:5.1f} {avgs['overall']:5.1f}  {n}"
        )

    # Worst performers
    sorted_by_overall = sorted(results, key=lambda r: r.scores.overall)
    logger.info("")
    logger.info("  Lowest-scoring questions:")
    for r in sorted_by_overall[:5]:
        logger.info(
            f"    Q{r.question_id:02d} (overall={r.scores.overall}/5): {r.question[:60]}"
        )
        logger.info(f"         Judge: {r.scores.explanation[:100]}")

    # Best performers
    sorted_desc = sorted(results, key=lambda r: r.scores.overall, reverse=True)
    logger.info("")
    logger.info("  Highest-scoring questions:")
    for r in sorted_desc[:5]:
        logger.info(
            f"    Q{r.question_id:02d} (overall={r.scores.overall}/5): {r.question[:60]}"
        )

    # Latency
    avg_retrieval = sum(r.latency_retrieval_ms for r in results) / total
    avg_generation = sum(r.latency_generation_ms for r in results) / total
    avg_judging = sum(r.latency_judging_ms for r in results) / total
    logger.info("")
    logger.info("  Avg latency:")
    logger.info(f"    Retrieval:  {avg_retrieval:,.0f}ms")
    logger.info(f"    Generation: {avg_generation:,.0f}ms")
    logger.info(f"    Judging:    {avg_judging:,.0f}ms")
    logger.info(f"    Total:      {avg_retrieval + avg_generation + avg_judging:,.0f}ms per question")

    logger.info("=" * 70)


def save_results(results: List[QuestionResult], output_path: str):
    """Save full results to a JSON file."""
    total = len(results)
    dims = ["specificity", "accuracy", "completeness", "actionability", "overall"]

    # Build category averages
    categories = sorted(set(r.category for r in results))
    cat_avgs = {}
    for cat in categories:
        cat_results = [r for r in results if r.category == cat]
        n = len(cat_results)
        cat_avgs[cat] = {
            "count": n,
            **{d: round(sum(getattr(r.scores, d) for r in cat_results) / n, 2) for d in dims},
        }

    output = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "eval_type": "level_2_answer_quality",
        "num_questions": total,
        "summary": {
            d: round(sum(getattr(r.scores, d) for r in results) / total, 2) if total else 0
            for d in dims
        },
        "category_averages": cat_avgs,
        "questions": [
            {
                "id": r.question_id,
                "question": r.question,
                "category": r.category,
                "good_answer_criteria": r.good_answer_criteria,
                "num_chunks_retrieved": r.num_chunks_retrieved,
                "top_similarity": r.top_similarity,
                "chunk_sources": r.chunk_sources,
                "generated_answer": r.generated_answer,
                "scores": {
                    "specificity": r.scores.specificity,
                    "accuracy": r.scores.accuracy,
                    "completeness": r.scores.completeness,
                    "actionability": r.scores.actionability,
                    "overall": r.scores.overall,
                    "explanation": r.scores.explanation,
                },
                "latency_ms": {
                    "retrieval": r.latency_retrieval_ms,
                    "generation": r.latency_generation_ms,
                    "judging": r.latency_judging_ms,
                },
                "error": r.error,
            }
            for r in results
        ],
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    logger.info(f"\nFull results saved to {output_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="RAG Answer Evaluation Pipeline (Level 2)"
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Show per-question progress and scores"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show questions without running evaluation",
    )
    parser.add_argument(
        "--question",
        type=int,
        default=None,
        metavar="N",
        help="Run only question N (1-20)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="/tmp/rag-answer-eval.json",
        help="Path to save JSON results (default: /tmp/rag-answer-eval.json)",
    )
    args = parser.parse_args()

    # Dry run: just list questions
    if args.dry_run:
        logger.info("=" * 70)
        logger.info("RAG ANSWER EVAL — DRY RUN (showing questions only)")
        logger.info("=" * 70)
        for q in EVAL_QUESTIONS:
            logger.info(f"  Q{q['id']:02d} [{q['category']}] {q['question']}")
            logger.info(f"       Criteria: {q['good_answer_criteria']}")
        logger.info(f"\nTotal: {len(EVAL_QUESTIONS)} questions")
        logger.info("Run without --dry-run to execute the evaluation.")
        return

    # Filter to single question if requested
    questions = EVAL_QUESTIONS
    if args.question is not None:
        questions = [q for q in EVAL_QUESTIONS if q["id"] == args.question]
        if not questions:
            logger.error(f"Question {args.question} not found. Valid IDs: 1-{len(EVAL_QUESTIONS)}")
            sys.exit(1)

    # Initialize clients
    supabase, openai_client = get_clients()

    logger.info("=" * 70)
    logger.info("RAG ANSWER EVALUATION PIPELINE (Level 2)")
    logger.info(f"  Questions: {len(questions)}")
    logger.info(f"  Models: gpt-4o (answer), gpt-4o-mini (judge)")
    logger.info(f"  Output: {args.output}")
    logger.info("=" * 70)

    results: List[QuestionResult] = []
    for i, q in enumerate(questions, 1):
        logger.info(f"\n[{i}/{len(questions)}] Q{q['id']:02d}: {q['question'][:65]}")
        try:
            r = evaluate_question(supabase, openai_client, q, args.verbose)
            results.append(r)
        except Exception as e:
            logger.error(f"  Q{q['id']:02d} ERROR: {e}")
            results.append(
                QuestionResult(
                    question_id=q["id"],
                    question=q["question"],
                    category=q["category"],
                    good_answer_criteria=q["good_answer_criteria"],
                    num_chunks_retrieved=0,
                    top_similarity=0,
                    generated_answer="",
                    scores=JudgeScores(),
                    error=str(e),
                )
            )

    # Report
    print_report(results)
    save_results(results, args.output)


if __name__ == "__main__":
    main()
