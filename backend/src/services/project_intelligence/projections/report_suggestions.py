"""Canonical writer for review-gated daily and weekly report suggestions."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional

from src.services.ops.db_pressure_guard import enforce_pm_app_final_projection_guard


def _single_row(result: Any) -> Optional[Dict[str, Any]]:
    data = getattr(result, "data", None)
    if isinstance(data, list):
        return data[0] if data else None
    return data if isinstance(data, dict) else None


def upsert_project_report_suggestions(
    supabase: Any,
    *,
    project_id: int,
    daily_delta: Dict[str, Any],
    snapshot: Dict[str, Any],
    timeline_event: Dict[str, Any],
    business_date: date,
    compiler_version: str,
    updated_at: str,
    sanitize_payload: Callable[[Any], Dict[str, Any]],
) -> List[Dict[str, Any]]:
    week_start = business_date - timedelta(days=business_date.weekday())
    suggestions = [
        {
            "report_type": "project_daily_report",
            "business_date": business_date.isoformat(),
            "week_start_date": None,
            "title": f"Daily report draft for {business_date.isoformat()}",
            "suggestion_payload": sanitize_payload(daily_delta.get("daily_report_draft") or {}),
        },
        {
            "report_type": "weekly_progress_report",
            "business_date": None,
            "week_start_date": week_start.isoformat(),
            "title": f"Weekly progress report updates for week of {week_start.isoformat()}",
            "suggestion_payload": sanitize_payload(daily_delta.get("progress_report_updates") or {}),
        },
    ]
    enforce_pm_app_final_projection_guard(
        "project_report_suggestion_projection",
        row_counts={"project_report_suggestions": len(suggestions)},
    )
    written: List[Dict[str, Any]] = []
    for suggestion in suggestions:
        existing = _single_row(
            supabase.table("project_report_suggestions")
            .select("id")
            .eq("project_id", int(project_id))
            .eq("report_type", suggestion["report_type"])
            .eq("source_delta_id", daily_delta.get("id"))
            .limit(1)
            .execute()
        )
        payload = {
            "project_id": int(project_id),
            "report_type": suggestion["report_type"],
            "business_date": suggestion["business_date"],
            "week_start_date": suggestion["week_start_date"],
            "source_delta_id": daily_delta.get("id"),
            "source_snapshot_id": snapshot.get("id"),
            "title": suggestion["title"],
            "suggestion_payload": suggestion["suggestion_payload"],
            "source_timeline_event_ids": [timeline_event.get("id")] if timeline_event.get("id") else [],
            "status": "suggested",
            "confidence": daily_delta.get("confidence") or "unknown",
            "metadata": {"compiler_version": compiler_version},
            "updated_at": updated_at,
        }
        if existing:
            written.append(_single_row(
                supabase.table("project_report_suggestions").update(payload).eq("id", existing["id"]).execute()
            ) or {**existing, **payload})
        else:
            written.append(_single_row(supabase.table("project_report_suggestions").insert(payload).execute()) or payload)
    return written
