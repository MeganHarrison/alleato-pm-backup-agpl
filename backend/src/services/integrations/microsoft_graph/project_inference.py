"""Shared project inference for Microsoft Graph ingestions."""

import logging
import os
from typing import Optional, Sequence, Tuple

from src.services.ingestion.project_assignment import AssignmentTarget, ProjectAssigner

logger = logging.getLogger(__name__)

_cached_assigner: Optional[ProjectAssigner] = None


def _get_assigner(supabase_client) -> ProjectAssigner:
    global _cached_assigner
    if _cached_assigner is None:
        _cached_assigner = ProjectAssigner(supabase_client)
    return _cached_assigner


def infer_project_id(
    supabase_client,
    *,
    title: str,
    content: str,
    participants: Sequence[str],
    existing_project_id: Optional[int] = None,
) -> Tuple[Optional[int], str, float]:
    """
    Infer project for a Graph record.

    Returns (project_id, method, confidence). If confidence is too low, project_id is None.
    """
    min_confidence = float(os.environ.get("GRAPH_PROJECT_ASSIGN_MIN_CONFIDENCE", "0.70"))
    try:
        assigner = _get_assigner(supabase_client)
        project_id, method, confidence = assigner.assign_project(
            meeting_title=title or "",
            participants=list(participants or []),
            content=(content or "")[:3000],
            existing_project_id=existing_project_id,
        )
    except Exception as exc:
        logger.warning("[GraphProjectInference] assignment failed: %s", exc)
        return None, "assignment_error", 0.0

    if project_id and confidence >= min_confidence:
        return int(project_id), method, confidence
    return None, method, confidence


def infer_assignment_target(
    supabase_client,
    *,
    title: str,
    content: str,
    participants: Sequence[str],
    existing_project_id: Optional[int] = None,
) -> AssignmentTarget:
    """
    Infer one project-or-Business-Area destination for a Graph record.

    This is the migration-safe API for new callers. The compatibility
    ``infer_project_id`` function remains project-only until each caller is
    updated to persist ``business_area_id`` explicitly.
    """
    min_confidence = float(os.environ.get("GRAPH_PROJECT_ASSIGN_MIN_CONFIDENCE", "0.70"))
    try:
        assigner = _get_assigner(supabase_client)
        target = assigner.assign_scope(
            meeting_title=title or "",
            participants=list(participants or []),
            content=(content or "")[:3000],
            existing_project_id=existing_project_id,
        )
    except Exception as exc:
        logger.warning("[GraphProjectInference] typed assignment failed: %s", exc)
        return AssignmentTarget(
            project_id=None,
            business_area_id=None,
            method="assignment_error",
            confidence=0.0,
        )

    if (
        target.project_id is not None or target.business_area_id is not None
    ) and target.confidence >= min_confidence:
        return target

    return AssignmentTarget(
        project_id=None,
        business_area_id=None,
        method=target.method,
        confidence=target.confidence,
    )
