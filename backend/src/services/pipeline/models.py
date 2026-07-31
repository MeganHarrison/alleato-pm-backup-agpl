"""Shared dataclasses for the RAG ingestion pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class TranscriptLine:
    index: int
    timestamp: str
    speaker: str
    text: str


@dataclass
class ParsedMeeting:
    title: str
    started_at: Optional[str]
    participants: List[str]
    transcript_lines: List[TranscriptLine]
    fireflies_summary: str  # raw summary from Fireflies header


@dataclass
class MeetingSegment:
    segment_index: int
    title: str
    start_index: int
    end_index: int
    summary: str
    decisions: List[str]
    risks: List[str]
    tasks: List[str]
    summary_embedding: Optional[List[float]] = None


@dataclass
class DocumentChunk:
    content: str
    chunk_index: int
    segment_index: int
    doc_type: str  # "chunk" | "segment_summary" | "meeting_summary"
    content_hash: str
    embedding: Optional[List[float]] = None


@dataclass
class StructuredItem:
    description: str
    embedding: Optional[List[float]] = None
    # Deep-extraction provenance (populated by the full-transcript pass; legacy
    # shallow pass leaves these None). evidence_quote → insight_card evidence
    # excerpt; confidence → the candidate-promotion / task-creation gate;
    # status_hint ∈ {"new","update","resolved"} drives supersede/resolve.
    evidence_quote: Optional[str] = None
    confidence: Optional[float] = None
    status_hint: Optional[str] = None


@dataclass
class DecisionItem(StructuredItem):
    rationale: Optional[str] = None
    owner: Optional[str] = None


@dataclass
class RiskItem(StructuredItem):
    category: Optional[str] = None
    likelihood: Optional[str] = None
    impact: Optional[str] = None
    owner: Optional[str] = None
    # Calibrated 1 (minor) – 5 (critical) severity emitted by the deep
    # communication-intelligence pass. None on the legacy/shallow paths.
    severity: Optional[int] = None


@dataclass
class TaskItem(StructuredItem):
    assignee: Optional[str] = None
    assignee_email: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    # Deterministic daily deep-read governance annotations.  These are kept on
    # the candidate so packet and task projections share one classification.
    task_classification: Optional[str] = None
    task_governance: Optional[dict] = None
    provenance: Optional[dict] = None


@dataclass
class OpportunityItem(StructuredItem):
    type: Optional[str] = None
    owner: Optional[str] = None


@dataclass
class InsightItem(StructuredItem):
    """A general project insight surfaced by the deep read that is not a
    decision/risk/opportunity (e.g. a notable status fact or open question).
    Routed to an insight_card as ``project_update`` / ``open_question``."""
    category: Optional[str] = None  # e.g. "status" | "open_question" | "context"
    owner: Optional[str] = None


@dataclass
class FlagItem(StructuredItem):
    """A forward-looking PREDICTION surfaced by the deep communication pass —
    something that may happen but has not yet (a potential change event or an
    emerging risk). ``description`` carries the prediction text. Routed to an
    insight_card of signal_type ``flag``."""
    flag_type: Optional[str] = None  # "potential_change_event" | "emerging_risk"
    severity: Optional[int] = None   # 1 (minor) – 5 (critical)
    owner: Optional[str] = None


@dataclass
class StructuredData:
    decisions: List[DecisionItem] = field(default_factory=list)
    risks: List[RiskItem] = field(default_factory=list)
    tasks: List[TaskItem] = field(default_factory=list)
    opportunities: List[OpportunityItem] = field(default_factory=list)
    insights: List[InsightItem] = field(default_factory=list)
    # Forward-looking predictions (potential change events / emerging risks).
    # Populated only by the deep communication-intelligence pass; empty otherwise.
    flags: List[FlagItem] = field(default_factory=list)
    # Optional one-paragraph "what changed since last meeting" narrative the deep
    # pass can emit for the project intelligence page. None on the shallow path.
    what_changed: Optional[str] = None
    # True when the LLM extraction call itself FAILED (returned _extraction_failed)
    # rather than legitimately finding nothing. Lets callers distinguish a silent
    # model failure from a genuinely empty communication. None/False = call succeeded.
    extraction_failed: bool = False
    # The underlying provider error(s) when extraction_failed is True (model id,
    # auth, rate limit, schema rejection). None when the call succeeded.
    extraction_error: Optional[str] = None
