#!/usr/bin/env python3
"""
RAG End-to-End Evaluation (Level 3)

Tests the full AI system including SQL data retrieval, closing the L2 eval gap
for financial questions. The L2 eval (rag_answer_eval.py) only uses vector
search and scores financial questions at 2.33/5 because it bypasses SQL tools.

This script fixes that by:
  - Financial questions → fetch real data from budget_lines, commitments_unified,
    change_events_summary, and prime_contract_financial_summary (mirrors consultCFO)
  - Non-financial questions → vector search (same as L2)
  - LLM judge scores answers on the same 5 dimensions as L2
  - Reports per-category scores and compares financial delta vs L2 baseline

Requires:
  - Backend running OR just Supabase access (uses direct Supabase queries)
  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in .env

Usage:
  cd backend && .venv/bin/python src/scripts/rag_e2e_eval.py
  cd backend && .venv/bin/python src/scripts/rag_e2e_eval.py --project-id 67
  cd backend && .venv/bin/python src/scripts/rag_e2e_eval.py --verbose
  cd backend && .venv/bin/python src/scripts/rag_e2e_eval.py --question 13
  cd backend && .venv/bin/python src/scripts/rag_e2e_eval.py --output /tmp/rag-e2e.json
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

from openai import OpenAI
from supabase import create_client, ClientOptions

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Default project for financial questions — Vermillion Rise Warehouse
DEFAULT_PROJECT_ID = 67
DEFAULT_PROJECT_NAME = "Vermillion Rise Warehouse"

# ---------------------------------------------------------------------------
# Eval questions — same 20 from rag_answer_eval.py, with retrieval_mode added
# ---------------------------------------------------------------------------

EVAL_QUESTIONS: List[Dict[str, Any]] = [
    # ── Meeting detail (grounded in actual meeting topics) ──────────────────
    {"id": 1,  "question": "What was discussed in the Goodwill Kokomo space plan and finishes review?",
     "category": "meeting_detail", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference the specific Goodwill Kokomo meeting, mention space plan details, finishes, or design decisions. Generic construction advice scores 1."},
    {"id": 2,  "question": "What came up in the Uniqlo and GPC huddle meetings this week?",
     "category": "meeting_detail", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference specific Uniqlo or GPC project details discussed in huddle meetings. Should mention project-specific issues, not generic updates."},
    {"id": 3,  "question": "What was discussed about fire suppression at the Nexcom project?",
     "category": "meeting_detail", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference the Nexcom G2P fire suppression discussion specifically. Should include technical details or decisions about fire suppression systems."},
    {"id": 4,  "question": "What action items came out of the most recent weekly touchbase on the HVAC upgrade?",
     "category": "meeting_detail", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference the specific HVAC upgrade weekly touchbase meeting. Should list concrete action items, assignees, or next steps. Generic HVAC advice scores 1."},
    {"id": 5,  "question": "What billing or accounting issues were discussed in the Questions Accounting Indy meeting?",
     "category": "meeting_detail", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference the specific accounting meeting for Indy. Should mention specific billing questions, accounting issues, or financial processes discussed."},

    # ── Multi-hop synthesis (requires connecting info across sources) ───────
    {"id": 6,  "question": "How is the Goodwill portfolio performing — combine what you know from meetings, budgets, and any documents?",
     "category": "multi_hop", "retrieval_mode": "vector",
     "good_answer_criteria": "Must synthesize across multiple Goodwill meetings (150+ exist). Should reference specific projects (Kokomo, Tremont), status updates, and financial context if available. Single-source answers score 2."},
    {"id": 7,  "question": "What's happening with hiring and onboarding — who are the new people and what systems are being set up?",
     "category": "multi_hop", "retrieval_mode": "vector",
     "good_answer_criteria": "Must connect info from onboarding meetings (TJ onboarding, 3 new hires, system review, LinkedIn recruitment). Should name specific people or processes. Generic HR advice scores 1."},
    {"id": 8,  "question": "Compare the status of the Uniqlo Phillipsburg project versus Vermillion Rise — which needs more attention?",
     "category": "multi_hop", "retrieval_mode": "vector_multi_project",
     "project_names": ["Uniqlo Phillipsburg", "Vermillion Rise"],
     "good_answer_criteria": "Must reference both projects with specific details from meetings/data. Should make a comparative assessment with evidence, not just list them separately."},

    # ── Cross-source synthesis ──────────────────────────────────────────────
    {"id": 9,  "question": "What's the latest on the Vermillion Rise project based on recent meetings and project data?",
     "category": "cross_source", "retrieval_mode": "vector",
     "good_answer_criteria": "Must synthesize from meetings AND project data. Should include recent meeting topics, schedule status, budget context. Single-source answers score 2."},
    {"id": 10, "question": "What should I focus on this week as the owner? Base this on actual recent meetings, not generic advice.",
     "category": "cross_source", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference specific recent meetings and their outcomes to justify priorities. Each priority must trace to a real data point. Generic PM advice scores 1."},
    {"id": 11, "question": "What stresses Brandon out the most based on what he's said in meetings?",
     "category": "cross_source", "retrieval_mode": "vector",
     "good_answer_criteria": "Must quote or paraphrase specific things Brandon has said. Should reference meetings by name or date. Speculation without evidence scores 1."},
    {"id": 12, "question": "Summarize all subcontractor and vendor billing discussions from recent meetings",
     "category": "cross_source", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference the 'Subcontractor & Vendor Billings in Job Planner' meeting and any related discussions. Should include specific billing processes, vendor names, or dollar amounts."},

    # ── Financial (SQL-backed) ──────────────────────────────────────────────
    {"id": 13, "question": "What is the total budget for Vermillion Rise Warehouse and what are the top 5 line items by cost?",
     "category": "financial", "retrieval_mode": "sql_budget",
     "good_answer_criteria": "Must return the exact total dollar amount AND list the top 5 line items with their amounts. Vague estimates or missing line items score 2."},
    {"id": 14, "question": "Show me all change events for Vermillion Rise with their current status",
     "category": "financial", "retrieval_mode": "sql_change_events",
     "good_answer_criteria": "Must list specific change events with titles, numbers, and statuses. Should indicate how many are open vs closed. Missing details score 2."},
    {"id": 15, "question": "What commitments do we have on Vermillion Rise and which vendors are they with?",
     "category": "financial", "retrieval_mode": "sql_commitments",
     "good_answer_criteria": "Must list specific commitment titles, types (subcontract/PO), vendor names, and statuses. Vague summaries score 2."},

    # ── Strategic (tighter criteria to prevent inflated scores) ─────────────
    {"id": 16, "question": "Based on meeting discussions, what are the top 3 risks across our active projects right now?",
     "category": "strategic", "retrieval_mode": "vector",
     "good_answer_criteria": "Each risk must trace to a specific meeting or data point with project name. Generic industry risks (weather, supply chain) without meeting evidence score 1. Must name exactly 3 risks."},
    {"id": 17, "question": "What patterns do you see in our recent meeting topics that suggest where the business is heading?",
     "category": "strategic", "retrieval_mode": "vector",
     "good_answer_criteria": "Must identify patterns from actual meeting titles/topics (Goodwill portfolio expansion, hiring surge, new project types). Speculation without meeting evidence scores 1."},
    {"id": 18, "question": "What do we know about the Union Distillery Building project from meetings?",
     "category": "strategic", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference the specific Union Distillery Building meeting. If little info exists, should honestly say so rather than fabricating details. Hallucination scores 0."},

    # ── Boundary/negative cases ─────────────────────────────────────────────
    {"id": 19, "question": "What projects do we have active right now?",
     "category": "simple", "retrieval_mode": "sql_projects",
     "good_answer_criteria": "Must list actual project names from the database with any available metadata (phase, client). Made-up project names score 0."},
    {"id": 20, "question": "What do our meeting notes say about concrete mix design specifications?",
     "category": "boundary", "retrieval_mode": "vector",
     "good_answer_criteria": "This is likely a topic with minimal data. The system should either find relevant content or honestly state that no specific discussions were found. Fabricating technical details scores 0. Honest 'no data' with suggestions scores 4."},

    # ── Microsoft Graph integration (email, Teams, OneDrive) ────────────────
    {"id": 21, "question": "What recent emails mention budget overruns or cost concerns on any of our projects?",
     "category": "graph_email", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference actual email content from synced Outlook messages. Should mention specific project names, senders, or dollar amounts from emails. Generic budget advice without email evidence scores 1."},
    {"id": 22, "question": "What has been discussed in our Microsoft Teams channels about project deadlines or schedule delays?",
     "category": "graph_teams", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference actual Teams channel messages. Should mention specific channel names, team names, or message authors. Generic schedule advice without Teams evidence scores 1."},
    {"id": 23, "question": "What documents do we have stored in OneDrive related to project specifications or contracts?",
     "category": "graph_onedrive", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference actual OneDrive file names, folder paths, or document content. Should list specific files with metadata. Making up file names scores 0."},
    {"id": 24, "question": "What has Brandon discussed in Teams direct messages about upcoming project bids or proposals?",
     "category": "graph_teams_dm", "retrieval_mode": "vector",
     "good_answer_criteria": "Must reference actual Teams DM content. Should include context about who Brandon was messaging and what was discussed. Fabricated DM content scores 0."},
    {"id": 25, "question": "Combine what you know from emails, Teams messages, and OneDrive documents about the current state of our active projects",
     "category": "graph_multi_source", "retrieval_mode": "vector",
     "good_answer_criteria": "Must synthesize across at least 2 of the 3 Graph sources (email, Teams, OneDrive). Each claim should trace to a specific source type. Single-source answers score 2."},
]

# L2 baseline financial scores — used for comparison
L2_FINANCIAL_BASELINE = {
    "specificity": 1.67,
    "accuracy": 4.67,
    "completeness": 2.33,
    "actionability": 2.0,
    "overall": 2.33,
}


# ---------------------------------------------------------------------------
# Dataclasses
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
    retrieval_mode: str
    good_answer_criteria: str
    context_summary: str
    generated_answer: str
    scores: JudgeScores
    latency_retrieval_ms: float = 0.0
    latency_generation_ms: float = 0.0
    latency_judging_ms: float = 0.0
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Client initialization
# ---------------------------------------------------------------------------

def get_clients():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    openai_key = os.environ["OPENAI_API_KEY"]
    if not url or not key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    options = ClientOptions(postgrest_client_timeout=300)
    return create_client(url, key, options), OpenAI(api_key=openai_key)


# ---------------------------------------------------------------------------
# Retrieval: SQL-based financial data (mirrors consultCFO tools)
# ---------------------------------------------------------------------------

def _fmt_currency(val) -> str:
    try:
        n = float(val or 0)
        return f"${n:,.2f}"
    except (ValueError, TypeError):
        return str(val or "N/A")


def retrieve_budget_data(supabase, project_id: int) -> Tuple[str, str]:
    """Fetch budget_lines for a project. Returns (context_text, summary)."""
    result = (
        supabase.table("budget_lines")
        .select("description, original_amount, quantity, unit_cost, unit_of_measure")
        .eq("project_id", project_id)
        .order("original_amount", desc=True)
        .limit(100)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return "(No budget data found for this project.)", "no data"

    total = sum(float(r.get("original_amount") or 0) for r in rows)
    lines = []
    for r in rows[:20]:  # Top 20 line items by amount
        desc = r.get("description") or "Untitled"
        amt = _fmt_currency(r.get("original_amount"))
        qty = r.get("quantity")
        uom = r.get("unit_of_measure") or ""
        qty_str = f" ({qty} {uom})".strip() if qty else ""
        lines.append(f"  • {desc}: {amt}{qty_str}")

    context = (
        f"Budget Summary for {DEFAULT_PROJECT_NAME} (project_id={project_id}):\n"
        f"  Total original budget: {_fmt_currency(total)}\n"
        f"  Line items ({len(rows)} total, showing top 20 by amount):\n"
        + "\n".join(lines)
    )
    return context, f"total={_fmt_currency(total)}, {len(rows)} line items"


def retrieve_change_events(supabase, project_id: int) -> Tuple[str, str]:
    """Fetch change_events_summary for a project."""
    result = (
        supabase.table("change_events_summary")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return "(No change events found for this project.)", "no data"

    lines = []
    for r in rows:
        title = r.get("title") or r.get("name") or "Untitled"
        status = r.get("status") or "unknown"
        number = r.get("number") or r.get("change_event_number") or ""
        num_str = f" #{number}" if number else ""
        lines.append(f"  • CE{num_str}: {title} [{status}]")

    context = (
        f"Change Events for {DEFAULT_PROJECT_NAME} (project_id={project_id}):\n"
        f"  Total: {len(rows)} change events\n"
        + "\n".join(lines[:20])
    )
    return context, f"{len(rows)} change events"


def retrieve_commitments(supabase, project_id: int) -> Tuple[str, str]:
    """Fetch commitments_unified for a project."""
    result = (
        supabase.table("commitments_unified")
        .select("title, commitment_type, contract_number, status, executed, contract_date")
        .eq("project_id", project_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=False)
        .limit(100)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return "(No commitments found for this project.)", "no data"

    lines = []
    for r in rows[:30]:
        title = r.get("title") or "Untitled"
        ctype = r.get("commitment_type") or "unknown"
        status = r.get("status") or "unknown"
        contract_no = r.get("contract_number") or ""
        cn_str = f" [{contract_no}]" if contract_no else ""
        lines.append(f"  • {title}{cn_str} — {ctype}, {status}")

    context = (
        f"Commitments for {DEFAULT_PROJECT_NAME} (project_id={project_id}):\n"
        f"  Total: {len(rows)} commitments\n"
        + "\n".join(lines)
    )
    return context, f"{len(rows)} commitments"


def retrieve_projects(supabase) -> Tuple[str, str]:
    """Fetch list of active projects."""
    result = (
        supabase.table("projects")
        .select("id, name, phase, health_status, project_number")
        .order("name", desc=False)
        .limit(50)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return "(No projects found.)", "no data"

    lines = []
    for r in rows:
        name = r.get("name") or "Untitled"
        phase = r.get("phase") or ""
        health = r.get("health_status") or ""
        parts = [p for p in [phase, health] if p]
        meta = f" ({', '.join(parts)})" if parts else ""
        lines.append(f"  • {name}{meta}")

    context = f"Projects ({len(rows)} total):\n" + "\n".join(lines)
    return context, f"{len(rows)} projects"


# ---------------------------------------------------------------------------
# Retrieval: vector search (same as L2)
# ---------------------------------------------------------------------------

def embed_query(openai_client: OpenAI, query: str) -> List[float]:
    resp = openai_client.embeddings.create(
        model="text-embedding-3-large",
        dimensions=3072,
        input=query[:8000],
    )
    return resp.data[0].embedding


def vector_search(supabase, embedding: List[float], match_count: int = 10, threshold: float = 0.25) -> List[Dict]:
    try:
        result = supabase.rpc("search_document_chunks", {
            "query_embedding": json.dumps(embedding),
            "filter_source_types": None,
            "filter_project_id": None,
            "match_count": match_count,
            "match_threshold": threshold,
        }).execute()
        return result.data or []
    except Exception as e:
        logger.warning(f"Vector search failed: {e}")
        return []


def keyword_title_search(supabase, question: str, limit: int = 10) -> List[Dict]:
    """Search for chunks by matching keywords against document_metadata titles.

    This catches specific meeting references (e.g., 'Goodwill Kokomo space plan')
    that vector search might miss due to semantic drift.
    """
    # Extract meaningful phrases — skip very short/common words
    stop_words = {"what", "was", "the", "about", "from", "with", "this", "that",
                  "how", "does", "did", "are", "were", "been", "have", "has", "had",
                  "our", "and", "for", "any", "all", "which", "who", "when", "where",
                  "most", "based", "recent", "meetings", "meeting", "discussed",
                  "came", "out", "last", "week", "today", "they", "their", "you",
                  "can", "tell", "know", "said", "says", "think", "will", "would"}

    words = [w for w in question.lower().split() if w not in stop_words and len(w) > 2]
    if len(words) < 2:
        return []

    # Build an ilike query — try to match document titles containing key terms
    # Use the most distinctive 3-4 words
    search_terms = words[:4]

    try:
        # Find documents whose titles contain the search terms
        query = supabase.table("document_metadata").select("id, title")
        for term in search_terms:
            query = query.ilike("title", f"%{term}%")
        result = query.limit(5).execute()

        if not result.data:
            # Fallback: try with fewer terms (just the first 2)
            query = supabase.table("document_metadata").select("id, title")
            for term in search_terms[:2]:
                query = query.ilike("title", f"%{term}%")
            result = query.limit(5).execute()

        if not result.data:
            return []

        # Get chunks for matched documents
        # Fetch a larger pool (30 chunks), then prioritize by source_type and text length
        doc_ids = [d["id"] for d in result.data]
        chunks_result = (
            supabase.table("document_chunks")
            .select("chunk_id, document_id, chunk_index, text, source_type, metadata")
            .in_("document_id", doc_ids)
            .not_.is_("text", "null")
            .limit(30)
            .execute()
        )

        if not chunks_result.data:
            return []

        # Prioritize chunks: summaries/sections first, then by text length
        # Meeting summaries and segment summaries contain the most condensed info
        source_type_priority = {
            "meeting_summary": 0,
            "meeting_segment_summary": 1,
            "meeting_section": 2,
            "meeting_transcript": 3,
        }
        sorted_chunks = sorted(
            chunks_result.data,
            key=lambda c: (
                source_type_priority.get(c.get("source_type", ""), 4),
                -len(c.get("text", "")),  # longer text = more informative
            ),
        )

        # Take the top `limit` chunks after prioritization
        top_chunks = sorted_chunks[:limit]

        # Format as vector search results
        title_map = {d["id"]: d["title"] for d in result.data}
        formatted = []
        for c in top_chunks:
            formatted.append({
                "chunk_id": c["chunk_id"],
                "document_id": c["document_id"],
                "chunk_index": c["chunk_index"],
                "chunk_text": c["text"],
                "source_type": c.get("source_type", "unknown"),
                "similarity": 0.80,  # synthetic score — keyword match is high-confidence
                "doc_title": title_map.get(c["document_id"], "Untitled"),
                "doc_metadata": c.get("metadata"),
            })
        return formatted

    except Exception as e:
        logger.debug(f"Keyword title search failed: {e}")
        return []


def format_vector_context(chunks: List[Dict]) -> str:
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
            f"Title: {doc_title}\n{text}\n"
        )
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Multi-project vector search (balanced retrieval for comparison questions)
# ---------------------------------------------------------------------------

def multi_project_vector_search(
    supabase, openai_client: OpenAI,
    project_names: List[str], question: str,
    match_count: int = 10, threshold: float = 0.25,
) -> List[Dict]:
    """Run separate vector searches per project and merge with balanced representation.

    For comparison questions, a single embedding gravitates toward whichever
    project has stronger semantic matches, starving the other of context.
    This function creates a focused query per project, searches independently,
    and merges results so each project gets at least ``per_project_min`` chunks.
    """
    per_project_min = max(3, match_count // len(project_names))
    per_project_fetch = max(per_project_min + 2, match_count)  # fetch extra, trim later

    seen_chunk_ids: set = set()
    per_project_chunks: Dict[str, List[Dict]] = {name: [] for name in project_names}

    for name in project_names:
        focused_query = f"Latest status and updates on {name} project"
        embedding = embed_query(openai_client, focused_query)
        chunks = vector_search(supabase, embedding, match_count=per_project_fetch, threshold=threshold)

        for chunk in chunks:
            cid = chunk.get("chunk_id")
            if cid and cid not in seen_chunk_ids:
                seen_chunk_ids.add(cid)
                per_project_chunks[name].append(chunk)

    # Build merged list: guarantee at least per_project_min per project,
    # then fill remaining budget with the highest-similarity leftovers.
    merged: List[Dict] = []
    overflow: List[Dict] = []

    for name in project_names:
        project_chunks = sorted(
            per_project_chunks[name],
            key=lambda c: c.get("similarity", 0),
            reverse=True,
        )
        merged.extend(project_chunks[:per_project_min])
        overflow.extend(project_chunks[per_project_min:])

    # Fill up to match_count with remaining high-similarity chunks
    remaining_budget = match_count - len(merged)
    if remaining_budget > 0:
        overflow.sort(key=lambda c: c.get("similarity", 0), reverse=True)
        merged.extend(overflow[:remaining_budget])

    # Also layer in keyword title search for each project
    for name in project_names:
        keyword_chunks = keyword_title_search(supabase, name)
        for kc in keyword_chunks:
            cid = kc.get("chunk_id")
            if cid and cid not in seen_chunk_ids:
                seen_chunk_ids.add(cid)
                merged.append(kc)

    return merged


# ---------------------------------------------------------------------------
# Context assembly
# ---------------------------------------------------------------------------

def retrieve_context(
    supabase, openai_client: OpenAI,
    q: Dict[str, Any], project_id: int
) -> Tuple[str, str]:
    """Retrieve context appropriate for the question's retrieval_mode."""
    mode = q.get("retrieval_mode", "vector")

    if mode == "sql_budget":
        return retrieve_budget_data(supabase, project_id)

    elif mode == "sql_change_events":
        return retrieve_change_events(supabase, project_id)

    elif mode == "sql_commitments":
        return retrieve_commitments(supabase, project_id)

    elif mode == "sql_projects":
        return retrieve_projects(supabase)

    elif mode == "vector_multi_project":
        project_names = q.get("project_names", [])
        if not project_names:
            logger.warning(f"Q{q['id']}: vector_multi_project mode but no project_names, falling back to vector")
        else:
            chunks = multi_project_vector_search(
                supabase, openai_client, project_names, q["question"],
            )
            context = format_vector_context(chunks)
            sources = [c.get("source_type", "?") for c in chunks[:5]]
            return context, f"{len(chunks)} chunks (multi-project: {', '.join(project_names)}) from {set(sources)}"

    # Default: vector + keyword hybrid
    embedding = embed_query(openai_client, q["question"])
    chunks = vector_search(supabase, embedding)

    # Hybrid: also do keyword search on document titles to catch
    # specific meeting references that vector search might miss
    keyword_chunks = keyword_title_search(supabase, q["question"])
    if keyword_chunks:
        # Merge: add keyword results that aren't already in vector results
        existing_ids = {c.get("chunk_id") for c in chunks}
        for kc in keyword_chunks:
            if kc.get("chunk_id") not in existing_ids:
                chunks.append(kc)
                existing_ids.add(kc.get("chunk_id"))

    context = format_vector_context(chunks)
    sources = [c.get("source_type", "?") for c in chunks[:5]]
    return context, f"{len(chunks)} chunks from {set(sources)}"


# ---------------------------------------------------------------------------
# Answer generation
# ---------------------------------------------------------------------------

ANSWER_SYSTEM_PROMPT = """You are Alleato AI — the strategic advisor embedded inside Alleato Group, a commercial construction company. You've been part of this team for years. You know the projects, the people, the patterns.

You speak in ONE voice — direct, confident, specific. You're not a panel of executives or a committee. You're one sharp person who understands finance, operations, risk, and business development and weaves them together naturally.

You have been given relevant context from the company's database and knowledge base.
Use ONLY this context to answer the question. If the context contains specific financial data, use those exact numbers — do not estimate or approximate.

Rules:
- Lead with the most important insight, not a preamble
- Name the project, the number, the person, the deadline — vague advice is noise
- Never use role labels like "CFO Assessment:" or "COO Assessment:" — just speak directly
- When something's wrong, say it first. When something looks good, acknowledge it
- End with what to do about it — specific, actionable
- If the context doesn't have enough info, say so honestly rather than fabricating
- Never perform enthusiasm ("Great question!") or hedge everything into meaninglessness"""


def generate_answer(openai_client: OpenAI, question: str, context: str) -> str:
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        temperature=0.3,
        max_tokens=1500,
        messages=[
            {"role": "system", "content": ANSWER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Context from company database:\n\n{context}\n\n"
                    f"---\n\n"
                    f"Question: {question}\n\n"
                    f"Answer based on the context above."
                ),
            },
        ],
    )
    return response.choices[0].message.content or "(empty response)"


# ---------------------------------------------------------------------------
# LLM Judge (same as rag_answer_eval.py)
# ---------------------------------------------------------------------------

JUDGE_SYSTEM_PROMPT = """You are an expert evaluator for a RAG system used by a construction project management company.
Score the AI-generated answer on 5 dimensions from 1 (worst) to 5 (best):

1. **Specificity**: Does it reference specific data (names, dates, numbers)?
   1=entirely generic, 5=rich with specific details
2. **Accuracy**: Is it grounded in the provided context, not hallucinated?
   1=mostly hallucinated, 5=fully grounded
3. **Completeness**: Does it address all aspects of the question?
   1=misses the question, 5=thoroughly addresses all aspects
4. **Actionability**: Does it give the user something they can act on?
   1=no actionable info, 5=clear actionable information
5. **Overall**: Overall quality as a strategic business advisor response
   1=damages trust, 5=excellent — feels like a knowledgeable assistant

Return ONLY valid JSON, no markdown:
{"specificity":<1-5>,"accuracy":<1-5>,"completeness":<1-5>,"actionability":<1-5>,"overall":<1-5>,"explanation":"<2-3 sentences>"}"""


def judge_answer(openai_client: OpenAI, question: str, answer: str, criteria: str) -> JudgeScores:
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.0,
        max_tokens=500,
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Question: {question}\n\n"
                    f"Good answer criteria: {criteria}\n\n"
                    f"AI answer:\n{answer}\n\n"
                    f"Score this on all 5 dimensions. Return JSON only."
                ),
            },
        ],
    )
    raw = (response.choices[0].message.content or "{}").strip()
    if raw.startswith("```"):
        raw = "\n".join(l for l in raw.split("\n") if not l.strip().startswith("```"))
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
    except Exception:
        return JudgeScores(explanation=f"parse error: {raw[:100]}")


# ---------------------------------------------------------------------------
# Per-question evaluation
# ---------------------------------------------------------------------------

def evaluate_question(
    supabase, openai_client: OpenAI, q: Dict[str, Any],
    project_id: int, verbose: bool
) -> QuestionResult:
    result = QuestionResult(
        question_id=q["id"],
        question=q["question"],
        category=q["category"],
        retrieval_mode=q.get("retrieval_mode", "vector"),
        good_answer_criteria=q.get("good_answer_criteria", ""),
        context_summary="",
        generated_answer="",
        scores=JudgeScores(),
    )

    try:
        # Step 1: Retrieval
        t0 = time.time()
        context, context_summary = retrieve_context(supabase, openai_client, q, project_id)
        result.latency_retrieval_ms = round((time.time() - t0) * 1000, 1)
        result.context_summary = context_summary

        # Step 2: Generation
        t1 = time.time()
        answer = generate_answer(openai_client, q["question"], context)
        result.latency_generation_ms = round((time.time() - t1) * 1000, 1)
        result.generated_answer = answer

        # Step 3: Judge
        t2 = time.time()
        scores = judge_answer(openai_client, q["question"], answer, q.get("good_answer_criteria", ""))
        result.latency_judging_ms = round((time.time() - t2) * 1000, 1)
        result.scores = scores

        if verbose:
            logger.info(
                f"  Q{q['id']:02d} [{q['category']:14s}] [{q.get('retrieval_mode','?'):18s}]  "
                f"overall={scores.overall}/5  spec={scores.specificity}  "
                f"acc={scores.accuracy}  complete={scores.completeness}  "
                f"act={scores.actionability}  | {q['question'][:50]}"
            )
        else:
            logger.info(
                f"  Q{q['id']:02d} [{q['category']:12s}] overall={scores.overall}/5  "
                f"({q.get('retrieval_mode','?')})  {q['question'][:55]}"
            )

    except Exception as exc:
        result.error = str(exc)
        logger.error(f"  Q{q['id']:02d} ERROR: {exc}")

    return result


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def compute_category_avg(results: List[QuestionResult], category: str) -> Dict[str, float]:
    cat_results = [r for r in results if r.category == category and not r.error]
    if not cat_results:
        return {}
    dims = ["specificity", "accuracy", "completeness", "actionability", "overall"]
    return {
        d: round(sum(getattr(r.scores, d) for r in cat_results) / len(cat_results), 2)
        for d in dims
    }


def print_report(results: List[QuestionResult]) -> None:
    ok = [r for r in results if not r.error]
    dims = ["specificity", "accuracy", "completeness", "actionability", "overall"]

    # Overall summary
    overall_avgs = {
        d: round(sum(getattr(r.scores, d) for r in ok) / len(ok), 2) if ok else 0
        for d in dims
    }

    logger.info("")
    logger.info("=" * 70)
    logger.info("RAG END-TO-END EVAL (L3) — RESULTS")
    logger.info("=" * 70)
    logger.info(f"  Questions: {len(results)} ({len(ok)} scored, {len(results)-len(ok)} errors)")
    logger.info("")
    logger.info(f"  {'Dimension':16s}  {'L3 Score':>9}  (L2 Baseline for reference)")

    # Get L2 overall baseline from the answer eval — approximate from category averages
    l2_approx = {"specificity": 3.7, "accuracy": 4.65, "completeness": 3.95, "actionability": 3.25, "overall": 4.0}
    for d in dims:
        l3 = overall_avgs[d]
        l2 = l2_approx.get(d, 0)
        delta = l3 - l2
        sign = "+" if delta >= 0 else ""
        logger.info(f"  {d:16s}  {l3:>9.2f}  (L2: {l2:.2f}, {sign}{delta:.2f})")

    # Per-category breakdown
    categories = sorted(set(r.category for r in ok))
    logger.info("")
    logger.info(f"  {'Category':16s}  {'Overall':>7}  {'Spec':>5}  {'Acc':>5}  {'Complete':>8}  {'Action':>6}  Mode")
    logger.info(f"  {'-'*16}  {'-'*7}  {'-'*5}  {'-'*5}  {'-'*8}  {'-'*6}  {'-'*16}")
    for cat in categories:
        avgs = compute_category_avg(results, cat)
        if not avgs:
            continue
        mode_sample = next((r.retrieval_mode for r in ok if r.category == cat), "?")
        logger.info(
            f"  {cat:16s}  {avgs['overall']:>7.2f}  {avgs['specificity']:>5.2f}  "
            f"{avgs['accuracy']:>5.2f}  {avgs['completeness']:>8.2f}  "
            f"{avgs['actionability']:>6.2f}  {mode_sample}"
        )

    # Financial improvement vs L2
    fin_avgs = compute_category_avg(results, "financial")
    if fin_avgs:
        logger.info("")
        logger.info("Financial questions (L3 SQL vs L2 vector-only):")
        for d in dims:
            l3_fin = fin_avgs.get(d, 0)
            l2_fin = L2_FINANCIAL_BASELINE.get(d, 0)
            delta = l3_fin - l2_fin
            sign = "+" if delta >= 0 else ""
            direction = "↑" if delta > 0.1 else ("↓" if delta < -0.1 else "→")
            logger.info(f"  {d:16s}  L3: {l3_fin:.2f}  L2: {l2_fin:.2f}  {sign}{delta:.2f} {direction}")

    logger.info("=" * 70)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="RAG End-to-End Evaluation (L3)")
    parser.add_argument("--project-id", type=int, default=DEFAULT_PROJECT_ID,
                        help=f"Project ID for financial questions (default: {DEFAULT_PROJECT_ID})")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--question", type=int, default=None, help="Run only this question ID")
    parser.add_argument("--output", type=str, default=None)
    parser.add_argument("--dry-run", action="store_true",
                        help="Test retrieval only, skip generation and judging")
    args = parser.parse_args()

    supabase, openai_client = get_clients()

    questions = EVAL_QUESTIONS
    if args.question:
        questions = [q for q in questions if q["id"] == args.question]
        if not questions:
            logger.error(f"Question {args.question} not found")
            return 2

    logger.info("=" * 70)
    logger.info("RAG END-TO-END EVALUATION (L3)")
    logger.info(f"  Questions: {len(questions)}")
    logger.info(f"  Project for SQL questions: {args.project_id} ({DEFAULT_PROJECT_NAME})")
    logger.info(f"  SQL-mode questions: {sum(1 for q in questions if q.get('retrieval_mode','vector') != 'vector')}")
    logger.info(f"  Vector-mode questions: {sum(1 for q in questions if q.get('retrieval_mode','vector') == 'vector')}")
    logger.info("=" * 70)

    if args.dry_run:
        logger.info("[dry-run] Testing retrieval only...")
        for q in questions:
            t0 = time.time()
            try:
                ctx, summary = retrieve_context(supabase, openai_client, q, args.project_id)
                ms = (time.time() - t0) * 1000
                logger.info(f"  Q{q['id']:02d} [{q['category']:14s}] [{q.get('retrieval_mode'):18s}]  "
                             f"{ms:.0f}ms  {summary[:60]}")
            except Exception as e:
                logger.error(f"  Q{q['id']:02d} ERROR: {e}")
        return 0

    results: List[QuestionResult] = []
    for q in questions:
        r = evaluate_question(supabase, openai_client, q, args.project_id, args.verbose)
        results.append(r)

    print_report(results)

    if args.output:
        ok = [r for r in results if not r.error]
        dims = ["specificity", "accuracy", "completeness", "actionability", "overall"]
        categories = sorted(set(r.category for r in ok))
        output_data = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "eval_type": "level_3_e2e",
            "project_id": args.project_id,
            "num_questions": len(results),
            "summary": {
                d: round(sum(getattr(r.scores, d) for r in ok) / len(ok), 2) if ok else 0
                for d in dims
            },
            "category_averages": {
                cat: compute_category_avg(results, cat)
                for cat in categories
            },
            "l2_baseline_comparison": {
                "financial": {
                    d: {
                        "l3": compute_category_avg(results, "financial").get(d, 0),
                        "l2": L2_FINANCIAL_BASELINE.get(d, 0),
                    }
                    for d in dims
                }
            },
            "questions": [
                {
                    "id": r.question_id,
                    "question": r.question,
                    "category": r.category,
                    "retrieval_mode": r.retrieval_mode,
                    "context_summary": r.context_summary,
                    "generated_answer": r.generated_answer,
                    "scores": asdict(r.scores),
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
        with open(args.output, "w") as f:
            json.dump(output_data, f, indent=2)
        logger.info(f"\nResults saved to {args.output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
