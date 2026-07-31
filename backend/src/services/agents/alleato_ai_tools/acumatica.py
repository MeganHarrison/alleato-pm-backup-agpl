"""Acumatica accounting integration. Read-only.

Cookie-based auth: POST /entity/auth/login returns 204 + Set-Cookie.
NEVER use OData $filter — causes HTTP 500. Filter in-memory after fetching.
Safe OData params: $select, $top, $expand.

Credentials: ACCOUNTING_USER / ACCOUNTING_PASSWORD / ACUMATICA_COMPANY
Base URL: ACUMATICA_BASE_URL (defaults to https://alleatogroup.acumatica.com)
"""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from langchain_core.tools import tool

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_BASE_URL = os.environ.get("ACUMATICA_BASE_URL", "https://alleatogroup.acumatica.com")
_API_VERSION = "24.200.001"
_ENDPOINT_NAME = "Default"
_ENTITY_BASE = f"{_BASE_URL}/entity/{_ENDPOINT_NAME}/{_API_VERSION}"
_AUTH_LOGIN = f"{_BASE_URL}/entity/auth/login"
_SESSION_TTL_S = 15 * 60  # 15 min — Acumatica default is ~20 min


def _credentials() -> tuple[str, str, str]:
    user = os.environ.get("ACCOUNTING_USER", "")
    password = os.environ.get("ACCOUNTING_PASSWORD", "")
    company = os.environ.get("ACUMATICA_COMPANY", "Alleato Group").strip('"')
    if not user or not password:
        raise RuntimeError(
            "Acumatica credentials not set. Required: ACCOUNTING_USER, ACCOUNTING_PASSWORD"
        )
    return user, password, company


# ---------------------------------------------------------------------------
# Unwrap utility — strips Acumatica {"value": ...} envelope recursively
# ---------------------------------------------------------------------------

def _unwrap(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, list):
        return [_unwrap(item) for item in raw]
    if isinstance(raw, dict):
        if set(raw.keys()) == {"value"}:
            return raw["value"]
        skip = {"id", "rowNumber", "note", "custom", "files"}
        return {k: _unwrap(v) for k, v in raw.items() if k not in skip}
    return raw


# ---------------------------------------------------------------------------
# Singleton HTTP client with cookie-session management
# ---------------------------------------------------------------------------

class _AcumaticaClient:
    def __init__(self) -> None:
        self._cookies: str | None = None
        self._login_at: float = 0.0
        self._lock = threading.Lock()

    def _is_valid(self) -> bool:
        return self._cookies is not None and (time.time() - self._login_at) < _SESSION_TTL_S

    def _do_login(self) -> None:
        user, password, company = _credentials()
        with httpx.Client(timeout=15) as c:
            res = c.post(
                _AUTH_LOGIN,
                json={"name": user, "password": password, "company": company},
                headers={"Content-Type": "application/json"},
                follow_redirects=False,
            )
        if res.status_code != 204:
            raise RuntimeError(
                f"Acumatica login failed (HTTP {res.status_code}): {res.text[:300]}"
            )
        cookies = "; ".join(f"{name}={value}" for name, value in res.cookies.items())
        if not cookies:
            raise RuntimeError("Acumatica login succeeded but returned no cookies")
        self._cookies = cookies
        self._login_at = time.time()

    def _ensure_session(self) -> str:
        with self._lock:
            if not self._is_valid():
                self._do_login()
            return self._cookies  # type: ignore[return-value]

    def fetch(
        self,
        entity: str,
        top: int = 500,
        select: str | None = None,
        expand: str | None = None,
    ) -> list[dict]:
        """Fetch rows from an Acumatica entity endpoint. No $filter — filter in-memory."""
        params: dict[str, Any] = {"$top": top}
        if select:
            params["$select"] = select
        if expand:
            params["$expand"] = expand

        cookies = self._ensure_session()
        url = f"{_ENTITY_BASE}/{entity}"

        def _get(cookies: str) -> httpx.Response:
            with httpx.Client(timeout=60) as c:
                return c.get(
                    url,
                    params=params,
                    headers={"Cookie": cookies, "Accept": "application/json"},
                )

        res = _get(cookies)
        if res.status_code in (401, 403):
            with self._lock:
                self._cookies = None
            cookies = self._ensure_session()
            res = _get(cookies)

        if not res.is_success:
            raise RuntimeError(
                f"Acumatica {entity} failed (HTTP {res.status_code}): {res.text[:300]}"
            )

        return [_unwrap(r) for r in res.json()]


_client = _AcumaticaClient()


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def _fmt_money(v: Any) -> str:
    try:
        return f"${float(v):,.2f}"
    except (TypeError, ValueError):
        return str(v or "—")


def _fmt_date(v: Any) -> str:
    return str(v)[:10] if v else "—"


def _now_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _num(v: Any) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


# ---------------------------------------------------------------------------
# AP / AR Aging
# ---------------------------------------------------------------------------

def _aging_buckets(rows: list[dict], balance_field: str = "Balance", date_field: str = "DueDate") -> dict[str, dict]:
    now = datetime.now(timezone.utc)
    buckets: dict[str, dict] = {
        "Current": {"total": 0.0, "count": 0},
        "1-30":    {"total": 0.0, "count": 0},
        "31-60":   {"total": 0.0, "count": 0},
        "61-90":   {"total": 0.0, "count": 0},
        "90+":     {"total": 0.0, "count": 0},
    }
    for row in rows:
        balance = _num(row.get(balance_field))
        if balance <= 0:
            continue
        due_raw = row.get(date_field)
        try:
            due = datetime.fromisoformat(str(due_raw).replace("Z", "+00:00")) if due_raw else now
        except ValueError:
            due = now
        days = (now - due).days
        key = "Current" if days <= 0 else "1-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"
        buckets[key]["total"] += balance
        buckets[key]["count"] += 1
    return buckets


@tool
def acumatica_ap_aging() -> str:
    """AP aging report — outstanding bills grouped by days past due.

    Returns aging buckets: Current, 1-30, 31-60, 61-90, 90+ with totals.
    """
    try:
        bills = _client.fetch("Bill", top=500, select="ReferenceNbr,DueDate,Balance,Vendor,Status")
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching AP aging from Acumatica: {exc}"

    buckets = _aging_buckets(bills)
    grand = sum(v["total"] for v in buckets.values())
    lines = [f"**AP Aging** as of {_now_date()} — Total outstanding: {_fmt_money(grand)}\n"]
    for label, data in buckets.items():
        lines.append(f"- {label}: {_fmt_money(data['total'])} ({data['count']} bills)")
    return "\n".join(lines)


@tool
def acumatica_ar_aging() -> str:
    """AR aging report — outstanding invoices grouped by days past due.

    Returns aging buckets: Current, 1-30, 31-60, 61-90, 90+ with totals.
    """
    try:
        invoices = _client.fetch("Invoice", top=500, select="ReferenceNbr,DueDate,Balance,Customer,Status")
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching AR aging from Acumatica: {exc}"

    buckets = _aging_buckets(invoices)
    grand = sum(v["total"] for v in buckets.values())
    lines = [f"**AR Aging** as of {_now_date()} — Total outstanding: {_fmt_money(grand)}\n"]
    for label, data in buckets.items():
        lines.append(f"- {label}: {_fmt_money(data['total'])} ({data['count']} invoices)")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Cash Position
# ---------------------------------------------------------------------------

@tool
def acumatica_cash_position(window_days: int = 90) -> str:
    """Cash position — AR payments received vs AP checks issued over a rolling window.

    Args:
        window_days: Look-back window in days (default 90).

    Returns:
        Total inflows, outflows, and net cash flow.
    """
    try:
        payments = _client.fetch("Payment", top=500, select="ReferenceNbr,ApplicationDate,PaymentAmount,Status")
        checks   = _client.fetch("Check",   top=500, select="ReferenceNbr,ApplicationDate,PaymentAmount,Status")
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching cash position from Acumatica: {exc}"

    cutoff = datetime.now(timezone.utc).timestamp() - window_days * 86400

    def _in_window(row: dict) -> bool:
        raw = row.get("ApplicationDate")
        if not raw:
            return False
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp() >= cutoff
        except ValueError:
            return False

    inflows  = sum(_num(p.get("PaymentAmount")) for p in payments if _in_window(p))
    outflows = sum(_num(c.get("PaymentAmount")) for c in checks   if _in_window(c))

    return (
        f"**Cash Position** (last {window_days} days, as of {_now_date()})\n"
        f"- AR payments received: {_fmt_money(inflows)}\n"
        f"- AP checks issued:     {_fmt_money(outflows)}\n"
        f"- Net cash flow:        {_fmt_money(inflows - outflows)}"
    )


# ---------------------------------------------------------------------------
# Vendor Spend
# ---------------------------------------------------------------------------

@tool
def acumatica_vendor_spend(vendor_id: str | None = None) -> str:
    """Vendor spend summary — total invoiced vs outstanding by vendor.

    Args:
        vendor_id: Optional vendor ID to restrict results. Omit for top 20.

    Returns:
        Ranked vendors with total invoiced, paid, outstanding, and bill count.
    """
    try:
        bills = _client.fetch("Bill", top=500)
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching vendor spend from Acumatica: {exc}"

    by_vendor: dict[str, dict] = {}
    for b in bills:
        vid = str(b.get("Vendor") or "UNKNOWN")
        if vendor_id and vid != vendor_id:
            continue
        entry = by_vendor.setdefault(vid, {"invoiced": 0.0, "outstanding": 0.0, "count": 0})
        entry["invoiced"]    += _num(b.get("Amount"))
        entry["outstanding"] += _num(b.get("Balance"))
        entry["count"]       += 1

    rows = sorted(by_vendor.items(), key=lambda x: x[1]["invoiced"], reverse=True)
    if not vendor_id:
        rows = rows[:20]

    if not rows:
        return "No vendor spend data found in Acumatica."

    lines = [f"**Vendor Spend** as of {_now_date()}\n"]
    for vid, data in rows:
        paid = data["invoiced"] - data["outstanding"]
        lines.append(
            f"- **{vid}**: invoiced {_fmt_money(data['invoiced'])} | "
            f"paid {_fmt_money(paid)} | outstanding {_fmt_money(data['outstanding'])} "
            f"({data['count']} bills)"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Recent Bills / Invoices
# ---------------------------------------------------------------------------

@tool
def acumatica_recent_bills(limit: int = 20) -> str:
    """Most recent AP bills.

    Args:
        limit: Max bills to return (default 20).

    Returns:
        Bills with vendor, reference, amount, balance, due date, status.
    """
    try:
        bills = _client.fetch("Bill", top=limit, select="ReferenceNbr,Date,DueDate,Amount,Balance,Vendor,Status")
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching recent bills from Acumatica: {exc}"

    if not bills:
        return "No bills found."

    lines = [f"**Recent Bills** (top {limit})\n"]
    for b in bills:
        lines.append(
            f"- {b.get('ReferenceNbr')} | {b.get('Vendor')} | "
            f"amount {_fmt_money(b.get('Amount'))} | balance {_fmt_money(b.get('Balance'))} | "
            f"due {_fmt_date(b.get('DueDate'))} | {b.get('Status')}"
        )
    return "\n".join(lines)


@tool
def acumatica_recent_invoices(limit: int = 20) -> str:
    """Most recent AR invoices.

    Args:
        limit: Max invoices to return (default 20).

    Returns:
        Invoices with customer, reference, amount, balance, due date, status.
    """
    try:
        invoices = _client.fetch("Invoice", top=limit, select="ReferenceNbr,Date,DueDate,Amount,Balance,Customer,Status")
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching recent invoices from Acumatica: {exc}"

    if not invoices:
        return "No invoices found."

    lines = [f"**Recent Invoices** (top {limit})\n"]
    for inv in invoices:
        lines.append(
            f"- {inv.get('ReferenceNbr')} | {inv.get('Customer')} | "
            f"amount {_fmt_money(inv.get('Amount'))} | balance {_fmt_money(inv.get('Balance'))} | "
            f"due {_fmt_date(inv.get('DueDate'))} | {inv.get('Status')}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Project Budget
# ---------------------------------------------------------------------------

@tool
def acumatica_project_budget(project_code: str) -> str:
    """Project budget from Acumatica — original, revised, actuals, committed, variance.

    Args:
        project_code: Acumatica project ID (e.g. "25108").

    Returns:
        Full budget summary with cost breakdown and ERP income/expense/net.
    """
    try:
        projects     = _client.fetch("Project", top=200, select="ProjectID,Description,Status,Customer,Income,Expenses")
        budget_lines = _client.fetch(
            "ProjectBudget", top=500,
            select="ProjectID,Type,OriginalBudgetedAmount,RevisedBudgetedAmount,ActualAmount,RevisedCommittedAmount,CostAtCompletion,VarianceAmount",
        )
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching project budget from Acumatica: {exc}"

    project = next((p for p in projects if str(p.get("ProjectID") or "") == project_code), None)
    if not project:
        return f"Project '{project_code}' not found in Acumatica."

    expense = [b for b in budget_lines if str(b.get("ProjectID") or "") == project_code and b.get("Type") == "Expense"]

    def _sum_field(field: str) -> float:
        return sum(_num(b.get(field)) for b in expense)

    income_erp   = _num(project.get("Income"))
    expenses_erp = _num(project.get("Expenses"))

    return (
        f"**Acumatica Budget: {project.get('Description')} ({project_code})**\n"
        f"Status: {project.get('Status')} | Customer: {project.get('Customer')}\n\n"
        f"- Original budget:    {_fmt_money(_sum_field('OriginalBudgetedAmount'))}\n"
        f"- Revised budget:     {_fmt_money(_sum_field('RevisedBudgetedAmount'))}\n"
        f"- Actual costs:       {_fmt_money(_sum_field('ActualAmount'))}\n"
        f"- Committed:          {_fmt_money(_sum_field('RevisedCommittedAmount'))}\n"
        f"- Cost at completion: {_fmt_money(_sum_field('CostAtCompletion'))}\n"
        f"- Variance:           {_fmt_money(_sum_field('VarianceAmount'))}\n\n"
        f"- ERP income:         {_fmt_money(income_erp)}\n"
        f"- ERP expenses:       {_fmt_money(expenses_erp)}\n"
        f"- Net position:       {_fmt_money(income_erp - expenses_erp)}"
    )



# ---------------------------------------------------------------------------
# Project List
# ---------------------------------------------------------------------------

@tool
def acumatica_project_list() -> str:
    """All active Acumatica projects with income, expenses, and net position.

    Returns:
        Projects sorted by expenses descending.
    """
    try:
        projects = _client.fetch("Project", top=200, select="ProjectID,Description,Status,Customer,Income,Expenses")
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching project list from Acumatica: {exc}"

    active = [
        p for p in projects
        if p.get("ProjectID") != "X" and p.get("Status") not in ("In Planning", None)
    ]
    active.sort(key=lambda p: _num(p.get("Expenses")), reverse=True)

    if not active:
        return "No active projects found in Acumatica."

    lines = [f"**Acumatica Projects** ({len(active)} active) as of {_now_date()}\n"]
    for p in active:
        inc = _num(p.get("Income"))
        exp = _num(p.get("Expenses"))
        lines.append(
            f"- **{p.get('ProjectID')}** {p.get('Description')} | "
            f"income {_fmt_money(inc)} | expenses {_fmt_money(exp)} | net {_fmt_money(inc - exp)}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Purchase Orders
# ---------------------------------------------------------------------------

@tool
def acumatica_purchase_orders(limit: int = 50) -> str:
    """Purchase orders from Acumatica.

    Args:
        limit: Max POs to return (default 50).

    Returns:
        POs with vendor, order number, amount, date, and status.
    """
    try:
        pos = _client.fetch("PurchaseOrder", top=limit, select="OrderNbr,Date,VendorID,OrderTotal,Status")
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching purchase orders from Acumatica: {exc}"

    if not pos:
        return "No purchase orders found."

    lines = [f"**Purchase Orders** (top {limit})\n"]
    for po in pos:
        lines.append(
            f"- {po.get('OrderNbr')} | {po.get('VendorID')} | "
            f"{_fmt_money(po.get('OrderTotal'))} | {_fmt_date(po.get('Date'))} | {po.get('Status')}"
        )
    return "\n".join(lines)
