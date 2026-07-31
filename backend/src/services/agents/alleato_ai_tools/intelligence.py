"""Synthesized project & portfolio intelligence tools.

These read the **deep-read synthesis** — `intelligence_packets` (the rolling
per-target executive state written by the canonical Project Intelligence runner)
and `insight_cards` — instead of re-deriving status
from raw rows.

This is the authoritative narrative source for "what's going on", "what are the
risks / issues", "status", and "brief me" questions. The synthesis already
weighed meetings, emails, Teams, RFIs, submittals, budget, and change activity
into a strategic read. Prefer these tools over `project_risk_snapshot` /
`recent_activity` / `portfolio_overview`, which are raw-data fallbacks used only
when no fresh packet exists or the user asks for a specific number.

Tables live in the PM APP database (`lgveqfnpkxvzbnnwuled`):
- `intelligence_targets`  — one row per project/initiative/process. `project_id`
  maps a `client_project` target to `projects.id`.
- `intelligence_packets`  — synthesized state per target. `packet_type='current'`
  is the live rolling brief; `target_id` -> `intelligence_targets.id`.
- `insight_cards`         — discrete evidence-backed findings; `primary_target_id`
  -> `intelligence_targets.id`.
"""

# ruff: noqa: E501

from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from .pm import _clean, _resolve_project, _rows

_PORTFOLIO_BRIEF_TARGET_NAME = "Daily Executive Brief"


def _tool_error(exc: BaseException, tool_name: str) -> str:
    """Loud, self-contained error string.

    Kept local (rather than importing a shared DB-health formatter) so this tool
    module has no cross-module dependency and deploys independently. A DB outage
    still surfaces clearly instead of the model silently claiming "no data".
    """
    return (
        f"{tool_name} could not read the synthesized intelligence: {type(exc).__name__}: {exc}. "
        "Do NOT report this as 'no risks/no data' — say the intelligence lookup failed and, if useful, "
        "fall back to project_risk_snapshot / recent_activity while noting the gap."
    )


def _project_target_id(project_id: int) -> str | None:
    rows = _rows(
        """
        SELECT id
        FROM intelligence_targets
        WHERE project_id = :project_id
        ORDER BY (status = 'active') DESC, updated_at DESC NULLS LAST
        LIMIT 1
        """,
        {"project_id": project_id},
    )
    return str(rows[0]["id"]) if rows else None


def _latest_packet(target_id: str) -> dict[str, Any] | None:
    rows = _rows(
        """
        SELECT executive_summary, current_status, strategic_read, why_it_matters,
               recommended_next_moves, freshness_status,
               generated_at::date::text AS generated_at,
               covered_start_at::date::text AS covered_start,
               covered_end_at::date::text AS covered_end,
               review_queue_count, stale_item_count
        FROM intelligence_packets
        WHERE target_id = :target_id
          AND packet_type = 'current'
        ORDER BY generated_at DESC NULLS LAST
        LIMIT 1
        """,
        {"target_id": target_id},
    )
    return rows[0] if rows else None


def _top_insight_cards(target_id: str, limit: int = 6) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT title, current_status, card_type, severity
        FROM insight_cards
        WHERE primary_target_id = :target_id
          AND COALESCE(attribution_status, '') !~* 'dismissed|rejected|archived'
        ORDER BY severity DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT :limit
        """,
        {"target_id": target_id, "limit": limit},
    )


def _moves_lines(moves: Any) -> list[str]:
    if not moves:
        return []
    if isinstance(moves, str):
        moves = [moves]
    out = []
    for move in moves:
        cleaned = _clean(move, limit=240)
        if cleaned:
            out.append(f"- {cleaned}")
    return out


def _render_packet(title: str, packet: dict[str, Any], cards: list[dict[str, Any]]) -> str:
    lines = [f"# {title}", ""]
    freshness = _clean(packet.get("freshness_status")) or "unknown"
    window = ""
    if packet.get("covered_start") or packet.get("covered_end"):
        window = f" | covers {packet.get('covered_start') or '?'} → {packet.get('covered_end') or '?'}"
    lines.append(
        f"_Synthesized deep-read packet · generated {packet.get('generated_at') or 'n/a'} · freshness: {freshness}{window}_"
    )
    lines.append("")

    current_status = _clean(packet.get("current_status"), limit=600)
    if current_status:
        lines += ["## Current status / top risk", current_status, ""]

    exec_summary = str(packet.get("executive_summary") or "").strip()
    if exec_summary:
        lines += ["## Executive summary", exec_summary, ""]

    strategic = str(packet.get("strategic_read") or "").strip()
    if strategic:
        lines += ["## Strategic read", strategic, ""]

    why = str(packet.get("why_it_matters") or "").strip()
    if why:
        lines += ["## Why it matters", why, ""]

    move_lines = _moves_lines(packet.get("recommended_next_moves"))
    if move_lines:
        lines += ["## Recommended next moves", *move_lines, ""]

    if cards:
        lines.append("## Open insight cards")
        for card in cards:
            sev = card.get("severity")
            sev_label = f"[sev {int(sev)}] " if isinstance(sev, (int, float)) else ""
            status = _clean(card.get("current_status"), limit=200)
            title_txt = _clean(card.get("title"), limit=140)
            lines.append(f"- {sev_label}{title_txt}" + (f" — {status}" if status else ""))
        lines.append("")

    review_q = packet.get("review_queue_count")
    stale = packet.get("stale_item_count")
    flags = []
    if review_q:
        flags.append(f"{review_q} item(s) in the review queue")
    if stale:
        flags.append(f"{stale} stale item(s)")
    if flags:
        lines.append("_Attention: " + "; ".join(flags) + "._")
        lines.append("")

    lines.append(
        "Source: deep-read synthesis (`intelligence_packets` + `insight_cards`). "
        "This is the authoritative narrative — use raw tools only for specific numbers or freshness checks."
    )
    return "\n".join(lines)


@tool
def project_intelligence_brief(project_id: int | None = None, project_name: str | None = None) -> str:
    """Authoritative synthesized brief for ONE project — status, risks, issues, strategic read.

    PREFER THIS over project_risk_snapshot / recent_activity / project_briefing_snapshot for
    "what's going on", "what are the risks/issues", "status", or "brief me" questions. It returns
    the deep-read synthesis (executive summary, current status/top risk, strategic read, why it
    matters, recommended next moves, and open insight cards) that already weighed meetings, emails,
    Teams, RFIs, submittals, budget, and change activity.

    Provide either project_id or project_name. If no fresh packet exists this says so — only then
    fall back to the raw-data tools.
    """
    try:
        project = _resolve_project(project_id, project_name)
        resolved_id = int(project["id"])
        target_id = _project_target_id(resolved_id)
        if not target_id:
            return (
                f"No intelligence target exists yet for {project.get('name') or resolved_id!r} — "
                "the deep-read synthesis has not run for this project. Fall back to project_risk_snapshot "
                "or recent_activity, and note the synthesis gap."
            )
        packet = _latest_packet(target_id)
        if not packet:
            return (
                f"No synthesized packet found for {project.get('name') or resolved_id!r} yet. "
                "Fall back to project_risk_snapshot / recent_activity, and note the synthesis gap."
            )
        cards = _top_insight_cards(target_id)
    except Exception as exc:  # noqa: BLE001
        return _tool_error(exc, "project_intelligence_brief")

    title = project.get("name") or f"Project {project.get('id')}"
    return _render_packet(f"{title} — intelligence brief", packet, cards)


@tool
def portfolio_intelligence_brief(max_projects: int = 25) -> str:
    """Authoritative synthesized PORTFOLIO brief — the daily executive brief plus a per-project risk roll-up.

    PREFER THIS over portfolio_overview / recent_activity for portfolio-wide "what are the risks/issues
    across current projects", "what's going on", "brief me on everything" questions. It returns the
    synthesized daily executive brief and each active project's current status / top risk from its
    deep-read packet — not raw change-event or RFI counts.

    Only fall back to portfolio_overview when this reports no fresh packets.
    """
    try:
        target_rows = _rows(
            """
            SELECT id
            FROM intelligence_targets
            WHERE name ILIKE :name
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1
            """,
            {"name": _PORTFOLIO_BRIEF_TARGET_NAME},
        )
        brief_packet = _latest_packet(str(target_rows[0]["id"])) if target_rows else None

        rollup = _rows(
            """
            SELECT t.name,
                   p.current_status,
                   p.freshness_status,
                   p.generated_at::date::text AS generated_at
            FROM intelligence_targets t
            JOIN LATERAL (
                SELECT current_status, freshness_status, generated_at
                FROM intelligence_packets
                WHERE target_id = t.id
                  AND packet_type = 'current'
                ORDER BY generated_at DESC NULLS LAST
                LIMIT 1
            ) p ON true
            WHERE t.target_type = 'client_project'
              AND t.status = 'active'
              AND p.current_status IS NOT NULL
            ORDER BY p.generated_at DESC NULLS LAST
            LIMIT :limit
            """,
            {"limit": max_projects},
        )
    except Exception as exc:  # noqa: BLE001
        return _tool_error(exc, "portfolio_intelligence_brief")

    if not brief_packet and not rollup:
        return (
            "No synthesized intelligence packets are available yet. Fall back to portfolio_overview / "
            "recent_activity, and note that the deep-read synthesis produced nothing for this window."
        )

    lines: list[str] = ["# Portfolio intelligence brief", ""]
    if brief_packet:
        lines.append(_render_packet("Daily executive brief", brief_packet, []))
        lines.append("")

    if rollup:
        lines.append("## Per-project current status (from each project's deep-read packet)")
        for row in rollup:
            fresh = _clean(row.get("freshness_status")) or "?"
            status = _clean(row.get("current_status"), limit=240)
            lines.append(
                f"- **{_clean(row.get('name'), limit=80)}** ({fresh}, {row.get('generated_at') or 'n/a'}): {status}"
            )
        lines.append("")
        lines.append(
            f"Source: deep-read synthesis (`intelligence_packets`), {len(rollup)} project(s) with a current packet. "
            "Use portfolio_overview / project_risk_snapshot only for specific counts."
        )

    return "\n".join(lines)
