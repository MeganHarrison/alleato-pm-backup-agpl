"""High-level Alleato PM advisor tools.

These tools port the old assistant's project-level wrappers into the Deep
Agents runtime. They intentionally return compact markdown, not raw JSON, so
the model gets a useful briefing without having to compose a dozen SQL calls
for normal project questions.
"""

# ruff: noqa: E501

from __future__ import annotations

from typing import Any

from langchain_core.tools import tool
from sqlalchemy import text

from ._retry import with_db_retry
from .db import _engine
from .db_health import format_db_tool_error

_CLOSED_STATUSES = {
    "approved",
    "closed",
    "complete",
    "completed",
    "void",
    "voided",
    "rejected",
    "cancelled",
    "canceled",
}
_APPROVED_STATUSES = {"approved", "executed", "complete", "completed"}
_PENDING_STATUSES = {
    "pending",
    "open",
    "draft",
    "submitted",
    "in review",
    "under review",
    "revise and resubmit",
}


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _money(value: Any) -> str:
    return f"${_num(value):,.0f}"


def _pct(value: Any) -> str:
    try:
        return f"{float(value):.0f}%"
    except (TypeError, ValueError):
        return "n/a"


def _status(value: Any) -> str:
    return str(value or "").strip().lower()


def _is_open(value: Any) -> bool:
    status = _status(value)
    return not status or status not in _CLOSED_STATUSES


def _is_approved(value: Any) -> bool:
    return _status(value) in _APPROVED_STATUSES


def _is_pending(value: Any) -> bool:
    status = _status(value)
    return bool(status) and (
        status in _PENDING_STATUSES
        or any(marker in status for marker in ("pending", "review", "submitted", "open"))
    )


def _clean(value: Any, limit: int = 120) -> str:
    if value is None:
        return ""
    text_value = str(value).replace("\n", " ").replace("|", "\\|").strip()
    return text_value if len(text_value) <= limit else text_value[: limit - 1] + "..."


def _rows(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    @with_db_retry
    def _run() -> list[dict[str, Any]]:
        eng = _engine()
        with eng.connect() as conn:
            conn.execute(text("SET LOCAL statement_timeout = 30000"))
            result = conn.execute(text(sql), params or {})
            return [dict(row._mapping) for row in result.fetchall()]

    return _run()


def _resolve_project(project_id: int | None, project_name: str | None) -> dict[str, Any]:
    if project_id is not None:
        rows = _rows(
            """
            SELECT id, name, phase, state, health_score, health_status,
                   completion_percentage, "est completion" AS est_completion,
                   summary, summary_updated_at
            FROM projects
            WHERE id = :project_id
            LIMIT 1
            """,
            {"project_id": project_id},
        )
    elif project_name:
        rows = _rows(
            """
            SELECT id, name, phase, state, health_score, health_status,
                   completion_percentage, "est completion" AS est_completion,
                   summary, summary_updated_at
            FROM projects
            WHERE archived IS DISTINCT FROM true
              AND (
                name ILIKE :q
                OR "job number" ILIKE :q
                OR address ILIKE :q
                OR project_number ILIKE :q
              )
            ORDER BY
              CASE WHEN lower(name) = lower(:exact) THEN 0 ELSE 1 END,
              name
            LIMIT 1
            """,
            {"q": f"%{project_name}%", "exact": project_name},
        )
    else:
        raise ValueError("Provide project_id or project_name.")

    if not rows:
        label = project_id if project_id is not None else project_name
        raise ValueError(f"No project found for {label!r}.")
    return rows[0]


def _budget_totals(project_id: int) -> dict[str, float]:
    rows = _rows(
        """
        SELECT
          COALESCE(SUM(original_amount), 0) AS original_budget,
          COALESCE(SUM(revised_budget), 0) AS revised_budget,
          COALESCE(SUM(approved_co_total), 0) AS approved_budget_changes,
          COALESCE(SUM(budget_mod_total), 0) AS budget_modifications
        FROM v_budget_lines
        WHERE project_id = :project_id
        """,
        {"project_id": project_id},
    )
    return {key: _num(value) for key, value in (rows[0] if rows else {}).items()}


def _contract_totals(project_id: int) -> dict[str, float]:
    rows = _rows(
        """
        SELECT
          COALESCE(SUM(original_contract_amount), 0) AS original_contract,
          COALESCE(SUM(revised_contract_amount), 0) AS revised_contract,
          COALESCE(SUM(approved_change_orders), 0) AS approved_change_orders,
          COALESCE(SUM(pending_change_orders), 0) AS pending_change_orders,
          COALESCE(SUM(invoiced_amount), 0) AS invoiced,
          COALESCE(SUM(payments_received), 0) AS payments_received,
          COALESCE(SUM(remaining_balance), 0) AS remaining_balance
        FROM prime_contract_financial_summary
        WHERE project_id = :project_id
        """,
        {"project_id": project_id},
    )
    return {key: _num(value) for key, value in (rows[0] if rows else {}).items()}


def _project_counts(project_id: int) -> dict[str, Any]:
    rows = _rows(
        """
        SELECT
          (SELECT COUNT(*) FROM rfis WHERE project_id = :project_id AND COALESCE(status, '') !~* 'closed|approved|void|rejected|cancel') AS open_rfis,
          (SELECT COUNT(*) FROM rfis WHERE project_id = :project_id AND due_date < CURRENT_DATE AND COALESCE(status, '') !~* 'closed|approved|void|rejected|cancel') AS overdue_rfis,
          (SELECT COUNT(*) FROM submittals WHERE project_id = :project_id AND deleted_at IS NULL AND COALESCE(status, '') !~* 'closed|approved|void|rejected|cancel') AS open_submittals,
          (SELECT COUNT(*) FROM submittals WHERE project_id = :project_id AND deleted_at IS NULL AND COALESCE(final_due_date, required_approval_date) < CURRENT_DATE AND COALESCE(status, '') !~* 'closed|approved|void|rejected|cancel') AS overdue_submittals,
          (SELECT COUNT(*) FROM schedule_tasks WHERE project_id = :project_id AND finish_date < CURRENT_DATE AND COALESCE(status, '') !~* 'complete|completed|closed') AS overdue_schedule_tasks,
          (SELECT COUNT(*) FROM commitments_unified WHERE project_id = :project_id AND deleted_at IS NULL) AS commitments,
          (SELECT COUNT(*) FROM change_events WHERE project_id = :project_id AND deleted_at IS NULL) AS change_events
        """,
        {"project_id": project_id},
    )
    return rows[0] if rows else {}


def _recent_docs(project_id: int, limit: int = 5) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT title, date, type, category, summary, overview
        FROM document_metadata
        WHERE project_id = :project_id
          AND deleted_at IS NULL
          AND date >= NOW() - INTERVAL '90 days'
        ORDER BY date DESC NULLS LAST
        LIMIT :limit
        """,
        {"project_id": project_id, "limit": limit},
    )


def _latest_open_items(project_id: int) -> dict[str, list[dict[str, Any]]]:
    return {
        "RFIs": _rows(
            """
            SELECT number::text AS number, subject AS title, status, due_date::text AS due_date, ball_in_court
            FROM rfis
            WHERE project_id = :project_id
              AND COALESCE(status, '') !~* 'closed|approved|void|rejected|cancel'
            ORDER BY due_date ASC NULLS LAST, updated_at DESC NULLS LAST
            LIMIT 5
            """,
            {"project_id": project_id},
        ),
        "Submittals": _rows(
            """
            SELECT submittal_number AS number, title, status,
                   COALESCE(final_due_date, required_approval_date)::text AS due_date,
                   ball_in_court
            FROM submittals
            WHERE project_id = :project_id
              AND deleted_at IS NULL
              AND COALESCE(status, '') !~* 'closed|approved|void|rejected|cancel'
            ORDER BY COALESCE(final_due_date, required_approval_date) ASC NULLS LAST, updated_at DESC NULLS LAST
            LIMIT 5
            """,
            {"project_id": project_id},
        ),
        "Schedule": _rows(
            """
            SELECT NULL AS number, name AS title, status, finish_date::text AS due_date, assignee AS ball_in_court
            FROM schedule_tasks
            WHERE project_id = :project_id
              AND finish_date < CURRENT_DATE
              AND COALESCE(status, '') !~* 'complete|completed|closed'
            ORDER BY finish_date ASC NULLS LAST
            LIMIT 5
            """,
            {"project_id": project_id},
        ),
    }


def _header(project: dict[str, Any]) -> str:
    project_name = project.get("name") or f"Project {project.get('id')}"
    parts = [
        f"# {project_name}",
        "",
        (
            f"Phase: {_clean(project.get('phase')) or 'n/a'} | "
            f"Health: {_clean(project.get('health_status')) or 'n/a'} "
            f"({_clean(project.get('health_score')) or 'n/a'}) | "
            f"Complete: {_pct(project.get('completion_percentage'))} | "
            f"Est. completion: {_clean(project.get('est_completion')) or 'n/a'}"
        ),
    ]
    if project.get("summary"):
        parts += ["", f"Summary: {_clean(project.get('summary'), 280)}"]
    return "\n".join(parts)


def _open_item_lines(items: dict[str, list[dict[str, Any]]]) -> list[str]:
    lines: list[str] = []
    for label, rows in items.items():
        if not rows:
            continue
        lines.append(f"## Open {label}")
        for row in rows:
            num = f"{row.get('number')} - " if row.get("number") else ""
            due = f"; due {row.get('due_date')}" if row.get("due_date") else ""
            bic = f"; BIC {row.get('ball_in_court')}" if row.get("ball_in_court") else ""
            lines.append(f"- {num}{_clean(row.get('title'))} ({_clean(row.get('status'))}{due}{bic})")
        lines.append("")
    return lines


@tool
def project_budget_summary(project_id: int | None = None, project_name: str | None = None) -> str:
    """Get a true project budget summary from budget lines and prime contract financials.

    Use this first for questions like total budget, budget status, contract value,
    approved changes, pending owner changes, invoices, or payment status for one project.
    Provide either project_id or project_name.
    """

    try:
        project = _resolve_project(project_id, project_name)
        resolved_id = int(project["id"])
        budget = _budget_totals(resolved_id)
        contract = _contract_totals(resolved_id)
    except Exception as exc:  # noqa: BLE001
        return format_db_tool_error(exc)

    original = budget.get("original_budget", 0)
    revised = budget.get("revised_budget", 0)
    delta = revised - original
    growth = (delta / original * 100) if original else 0

    return "\n".join(
        [
            _header(project),
            "",
            "## Budget",
            f"- Original budget: {_money(original)}",
            f"- Revised budget: {_money(revised)}",
            f"- Budget delta: {_money(delta)} ({growth:.1f}%)",
            f"- Approved budget changes: {_money(budget.get('approved_budget_changes'))}",
            f"- Budget modifications: {_money(budget.get('budget_modifications'))}",
            "",
            "## Prime Contract",
            f"- Original contract: {_money(contract.get('original_contract'))}",
            f"- Revised contract: {_money(contract.get('revised_contract'))}",
            f"- Approved owner change orders: {_money(contract.get('approved_change_orders'))}",
            f"- Pending owner change orders: {_money(contract.get('pending_change_orders'))}",
            f"- Invoiced: {_money(contract.get('invoiced'))}",
            f"- Payments received: {_money(contract.get('payments_received'))}",
            f"- Remaining balance: {_money(contract.get('remaining_balance'))}",
            "",
            "Source: PM database (`projects`, `v_budget_lines`, `prime_contract_financial_summary`).",
        ]
    )


@tool
def project_briefing_snapshot(project_id: int | None = None, project_name: str | None = None) -> str:
    """Canonical broad project update for PM, CEO, or owner briefings.

    Use this first for broad questions like latest project status, what should I
    worry about, owner update, project health, or what changed recently. Provide
    either project_id or project_name.
    """

    try:
        project = _resolve_project(project_id, project_name)
        resolved_id = int(project["id"])
        budget = _budget_totals(resolved_id)
        contract = _contract_totals(resolved_id)
        counts = _project_counts(resolved_id)
        docs = _recent_docs(resolved_id)
        items = _latest_open_items(resolved_id)
    except Exception as exc:  # noqa: BLE001
        return format_db_tool_error(exc)

    lines = [
        _header(project),
        "",
        "## Hard Facts",
        f"- Revised budget: {_money(budget.get('revised_budget'))} ({_money(budget.get('original_budget'))} original)",
        f"- Revised prime contract: {_money(contract.get('revised_contract'))}",
        f"- Pending owner change orders: {_money(contract.get('pending_change_orders'))}",
        f"- Invoiced / paid: {_money(contract.get('invoiced'))} / {_money(contract.get('payments_received'))}",
        f"- Open RFIs: {counts.get('open_rfis', 0)} ({counts.get('overdue_rfis', 0)} overdue)",
        f"- Open submittals: {counts.get('open_submittals', 0)} ({counts.get('overdue_submittals', 0)} overdue)",
        f"- Overdue schedule tasks: {counts.get('overdue_schedule_tasks', 0)}",
        f"- Commitments: {counts.get('commitments', 0)} | Change events: {counts.get('change_events', 0)}",
        "",
    ]

    if docs:
        lines.append("## Recent Movement")
        for doc in docs:
            title = _clean(doc.get("title")) or "Untitled document"
            when = _clean(doc.get("date"))[:10] if doc.get("date") else "unknown date"
            summary = _clean(doc.get("summary") or doc.get("overview"), 180)
            lines.append(f"- {when}: {title}" + (f" - {summary}" if summary else ""))
        lines.append("")

    lines.extend(_open_item_lines(items))
    risk_count = _num(counts.get("overdue_rfis")) + _num(counts.get("overdue_submittals")) + _num(
        counts.get("overdue_schedule_tasks")
    )
    lines += [
        "## Operator Read",
        (
            "- Immediate risk is concentrated in overdue workflow items."
            if risk_count
            else "- No overdue RFIs, submittals, or schedule tasks were detected in the structured tables."
        ),
        "- Validate this against recent meeting/email context before sending an owner-facing update.",
        "",
        "Source: PM database (`projects`, `v_budget_lines`, `prime_contract_financial_summary`, `rfis`, `submittals`, `schedule_tasks`, `commitments_unified`, `change_events`, `document_metadata`).",
    ]
    return "\n".join(lines)


@tool
def project_risk_snapshot(project_id: int | None = None, project_name: str | None = None) -> str:
    """Surface structured project risks from RFIs, submittals, schedule, changes, and health.

    Use this for questions like risks, blockers, overdue items, what could bite
    us, or what the PM should chase today. Provide either project_id or project_name.
    """

    try:
        project = _resolve_project(project_id, project_name)
        resolved_id = int(project["id"])
        counts = _project_counts(resolved_id)
        items = _latest_open_items(resolved_id)
        change_rows = _rows(
            """
            SELECT number::text AS number, title, status, updated_at::date::text AS updated_at
            FROM change_events
            WHERE project_id = :project_id
              AND deleted_at IS NULL
              AND COALESCE(status, '') !~* 'closed|approved|void|rejected|cancel'
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 8
            """,
            {"project_id": resolved_id},
        )
    except Exception as exc:  # noqa: BLE001
        return format_db_tool_error(exc)

    lines = [
        _header(project),
        "",
        "## Risk Counts",
        f"- Overdue RFIs: {counts.get('overdue_rfis', 0)} of {counts.get('open_rfis', 0)} open",
        f"- Overdue submittals: {counts.get('overdue_submittals', 0)} of {counts.get('open_submittals', 0)} open",
        f"- Overdue schedule tasks: {counts.get('overdue_schedule_tasks', 0)}",
        f"- Active change events: {counts.get('change_events', 0)}",
        "",
    ]
    lines.extend(_open_item_lines(items))
    if change_rows:
        lines.append("## Recent Open Change Events")
        for row in change_rows:
            num = f"{row.get('number')} - " if row.get("number") else ""
            lines.append(
                f"- {num}{_clean(row.get('title'))} ({_clean(row.get('status'))}; updated {row.get('updated_at') or 'n/a'})"
            )
        lines.append("")

    lines += [
        "## Recommended Chase List",
        "- Chase overdue RFIs/submittals first because they are direct schedule and owner-update blockers.",
        "- Compare open change events against pending owner change orders before reporting exposure.",
        "- Pull recent meetings/emails if the user needs why, who owns it, or sentiment.",
        "",
        "Source: PM database (`projects`, `rfis`, `submittals`, `schedule_tasks`, `change_events`).",
    ]
    return "\n".join(lines)


@tool
def portfolio_overview(phase: str = "Current", max_projects: int = 25) -> str:
    """Get a strategic portfolio overview across active projects.

    Use this first when the user asks about the project portfolio, active jobs,
    overall risk, or which projects need attention. Defaults to phase Current.
    """

    normalized_phase = (phase or "Current").strip()
    max_projects = max(1, min(int(max_projects or 25), 50))
    where = "archived IS DISTINCT FROM true"
    params: dict[str, Any] = {"limit": max_projects}
    if normalized_phase.lower() != "all":
        where += " AND phase = :phase"
        params["phase"] = normalized_phase

    try:
        projects = _rows(
            f"""
            SELECT id, name, phase, health_score, health_status, completion_percentage,
                   "est completion" AS est_completion, summary
            FROM projects
            WHERE {where}
            ORDER BY
              CASE WHEN health_status ILIKE 'critical' THEN 0
                   WHEN health_status ILIKE 'risk%' THEN 1
                   ELSE 2 END,
              name
            LIMIT :limit
            """,
            params,
        )
        project_ids = [int(row["id"]) for row in projects]
        if not project_ids:
            return f"No projects found for phase `{normalized_phase}`."

        financials = _rows(
            """
            SELECT project_id,
              COALESCE(SUM(revised_contract_amount), 0) AS revised_contract,
              COALESCE(SUM(pending_change_orders), 0) AS pending_change_orders,
              COALESCE(SUM(invoiced_amount), 0) AS invoiced
            FROM prime_contract_financial_summary
            WHERE project_id = ANY(:project_ids)
            GROUP BY project_id
            """,
            {"project_ids": project_ids},
        )
        issues = _rows(
            """
            SELECT project_id, total_issues, total_cost
            FROM project_issue_summary
            WHERE project_id = ANY(:project_ids)
            """,
            {"project_ids": project_ids},
        )
        meetings = _rows(
            """
            SELECT project_id, COUNT(*) AS recent_meetings, MAX(date)::date::text AS latest_meeting
            FROM document_metadata
            WHERE project_id = ANY(:project_ids)
              AND deleted_at IS NULL
              AND date >= NOW() - INTERVAL '45 days'
              AND (type = 'meeting' OR category = 'meeting')
            GROUP BY project_id
            """,
            {"project_ids": project_ids},
        )
    except Exception as exc:  # noqa: BLE001
        return format_db_tool_error(exc)

    financial_by_project = {int(row["project_id"]): row for row in financials}
    issue_by_project = {int(row["project_id"]): row for row in issues}
    meeting_by_project = {int(row["project_id"]): row for row in meetings}

    total_contract = sum(_num(row.get("revised_contract")) for row in financials)
    total_pending = sum(_num(row.get("pending_change_orders")) for row in financials)
    total_issues = sum(_num(row.get("total_issues")) for row in issues)

    lines = [
        f"# Portfolio Overview ({normalized_phase})",
        "",
        f"- Projects shown: {len(projects)}",
        f"- Revised contract value: {_money(total_contract)}",
        f"- Pending owner change orders: {_money(total_pending)}",
        f"- Structured issues: {total_issues:.0f}",
        "",
        "| Project | Health | Complete | Revised Contract | Pending COs | Issues | Recent Meetings |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for project in projects:
        pid = int(project["id"])
        fin = financial_by_project.get(pid, {})
        issue = issue_by_project.get(pid, {})
        meeting = meeting_by_project.get(pid, {})
        lines.append(
            "| "
            + " | ".join(
                [
                    _clean(project.get("name"), 60),
                    _clean(project.get("health_status") or "n/a", 30),
                    _pct(project.get("completion_percentage")),
                    _money(fin.get("revised_contract")),
                    _money(fin.get("pending_change_orders")),
                    str(int(_num(issue.get("total_issues")))),
                    str(int(_num(meeting.get("recent_meetings")))),
                ]
            )
            + " |"
        )

    lines += [
        "",
        "Source: PM database (`projects`, `prime_contract_financial_summary`, `project_issue_summary`, `document_metadata`).",
    ]
    return "\n".join(lines)
