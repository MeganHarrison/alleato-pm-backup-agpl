"""Governed projection contract for the project-home synopsis.

The home page reads ``project_current_state``.  This adapter deliberately accepts
only a completed Product Intelligence Packet and carries its provenance through
the existing controlled projection boundary.
"""
from __future__ import annotations

from typing import Any, Dict, Optional


def packet_is_completed(packet: Dict[str, Any]) -> bool:
    """Return True only for a usable, packet-backed daily deep read."""
    packet_json = packet.get("packet_json") or {}
    return bool(
        packet.get("packet_type") == "current"
        and packet.get("freshness_status") in {"fresh", "partial"}
        and packet.get("current_status") not in {"rejected", "failed", "stale"}
        and packet_json.get("kind") == "daily_deep_read"
    )


def build_synopsis_projection(
    packet: Dict[str, Any],
    *,
    project_id: int,
    existing: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Build a controlled projection payload, preserving human edits.

    Human-edited rows keep their synopsis text; lineage and freshness still move
    forward so the UI can accurately explain what the preserved value is based on.
    """
    if not packet_is_completed(packet):
        return None
    summary = (packet.get("packet_json") or {}).get("summary") or {}
    confidence = packet.get("confidence_summary") or {}
    existing = existing or {}
    payload: Dict[str, Any] = {
        "project_id": project_id,
        "health_status": "watch" if summary.get("risks") or summary.get("issues") else "unknown",
        "source_confidence": {
            "confidence": confidence.get("overall"),
            "source_coverage": (packet.get("packet_json") or {}).get("sourceSet", {}).get("sources", []),
            "freshness_status": packet.get("freshness_status"),
        },
    }
    if not existing.get("synopsis_human_edited"):
        payload["current_summary"] = summary.get("currentExecutiveRead") or packet.get("executive_summary")
    return payload
