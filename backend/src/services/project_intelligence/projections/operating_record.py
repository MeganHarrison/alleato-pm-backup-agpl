"""Canonical final-writer boundary for Project Intelligence operating records."""

from __future__ import annotations

from typing import Any, Dict, Optional

from src.services.ops.db_pressure_guard import enforce_pm_app_final_projection_guard


def _single_row(result: Any) -> Optional[Dict[str, Any]]:
    data = getattr(result, "data", None)
    if isinstance(data, list):
        return data[0] if data else None
    return data if isinstance(data, dict) else None


def write_project_operating_snapshot(supabase: Any, *, payload: Dict[str, Any]) -> Dict[str, Any]:
    enforce_pm_app_final_projection_guard(
        "project_operating_snapshot_projection",
        row_counts={"project_operating_snapshots": 1},
    )
    return _single_row(supabase.table("project_operating_snapshots").insert(payload).execute()) or payload


def apply_controlled_current_state_projection(
    supabase: Any,
    *,
    project_id: int,
    projection: Dict[str, Any],
    writer: str,
    provenance: Dict[str, Any],
) -> Dict[str, Any]:
    enforce_pm_app_final_projection_guard(
        "project_current_state_projection",
        row_counts={"project_current_state": 1},
    )
    result = _single_row(supabase.rpc(
        "apply_project_current_state_projection",
        {
            "p_project_id": int(project_id),
            "p_projection": projection,
            "p_writer": writer,
            "p_provenance": provenance,
        },
    ).execute())
    if not result or result.get("outcome") not in {"applied", "skipped"}:
        raise RuntimeError(
            "apply_project_current_state_projection rejected the compiler projection "
            f"for project_id={project_id}: {result!r}"
        )
    return result
