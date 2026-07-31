"""Conversation-aware project attribution guardrails for Outlook ingestion."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Optional


AUTHORITATIVE_CONFIDENCE = 0.9
PROPAGATED_ASSIGNMENT_METHODS = {
    "existing_document",
    "document_metadata_reconcile",
}
PROPAGATED_ASSIGNMENT_PREFIXES = (
    "conversation_consensus:",
    "conversation_repair:",
)
CONSENSUS_SELECT_COLUMNS = (
    "id,project_id,assignment_method,assignment_confidence,mailbox_user_id,"
    "conversation_id,internet_message_id,graph_message_id,deleted_at"
)


class OutlookProjectAttributionConflict(RuntimeError):
    """Raised when one Outlook identity has conflicting authoritative projects."""


@dataclass(frozen=True)
class ProjectAttributionConsensus:
    project_id: int
    confidence: float
    source_method: str
    evidence_row_ids: tuple[int, ...]


def _is_authoritative_assignment(row: dict[str, Any]) -> bool:
    if row.get("project_id") is None:
        return False
    method = str(row.get("assignment_method") or "").strip()
    confidence = float(row.get("assignment_confidence") or 0.0)
    if confidence < AUTHORITATIVE_CONFIDENCE:
        return False
    if method in PROPAGATED_ASSIGNMENT_METHODS:
        return False
    return not method.startswith(PROPAGATED_ASSIGNMENT_PREFIXES)


def resolve_authoritative_project_consensus(
    rows: Iterable[dict[str, Any]],
) -> Optional[ProjectAttributionConsensus]:
    """Return one independently supported project or fail on a true conflict.

    Existing-document and prior consensus assignments are deliberately excluded:
    they repeat an earlier decision and must not outvote an explicit attribution
    rule, manual review, or another independent high-confidence signal.
    """
    authoritative = [dict(row) for row in rows if _is_authoritative_assignment(row)]
    project_ids = sorted({int(row["project_id"]) for row in authoritative})
    if len(project_ids) > 1:
        evidence = sorted(
            f"row={row.get('id')} project={row.get('project_id')} method={row.get('assignment_method')}"
            for row in authoritative
        )
        raise OutlookProjectAttributionConflict(
            "Outlook conversation has conflicting authoritative assignments to "
            f"projects {', '.join(str(project_id) for project_id in project_ids)}; "
            f"evidence: {'; '.join(evidence)}"
        )
    if not project_ids:
        return None

    project_id = project_ids[0]
    supporting_rows = [row for row in authoritative if int(row["project_id"]) == project_id]
    best = max(
        supporting_rows,
        key=lambda row: (float(row.get("assignment_confidence") or 0.0), -int(row.get("id") or 0)),
    )
    return ProjectAttributionConsensus(
        project_id=project_id,
        confidence=float(best.get("assignment_confidence") or 0.0),
        source_method=str(best.get("assignment_method") or "authoritative_assignment"),
        evidence_row_ids=tuple(sorted(int(row["id"]) for row in supporting_rows if row.get("id") is not None)),
    )


def _fetch_identity_rows(client, *, column: str, value: str) -> list[dict[str, Any]]:
    if not value:
        return []
    response = (
        client.from_("outlook_email_intake")
        .select(CONSENSUS_SELECT_COLUMNS)
        .eq(column, value)
        .is_("deleted_at", "null")
        .limit(500)
        .execute()
    )
    return [dict(row) for row in (response.data or [])]


def find_outlook_project_consensus(
    client,
    *,
    mailbox_user_id: str,
    conversation_id: Optional[str],
    internet_message_id: Optional[str],
) -> Optional[ProjectAttributionConsensus]:
    """Resolve prior evidence across the mailbox thread and exact message copies."""
    rows: dict[int, dict[str, Any]] = {}
    if mailbox_user_id and conversation_id:
        for row in _fetch_identity_rows(client, column="conversation_id", value=conversation_id):
            if str(row.get("mailbox_user_id") or "").lower() == mailbox_user_id.lower():
                rows[int(row["id"])] = row
    if internet_message_id:
        for row in _fetch_identity_rows(
            client,
            column="internet_message_id",
            value=internet_message_id,
        ):
            rows[int(row["id"])] = row
    return resolve_authoritative_project_consensus(rows.values())
