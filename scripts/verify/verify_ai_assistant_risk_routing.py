#!/usr/bin/env python3
"""Verify strategist risk routing via chat_history tool trace.

This script validates that asking the AI assistant a portfolio-risk question
routes through the intended risk radar tool path and records trace evidence.

Checks:
1. Calls frontend /api/ai-assistant/chat with authenticated cookie state.
2. Waits for assistant response persistence in chat_history.
3. Asserts tool_trace includes getProjectsWithRisks.
4. Optionally asserts getPortfolioOverview was not used for the risk query.

Usage:
  python3 scripts/verify/verify_ai_assistant_risk_routing.py \
    --frontend-url http://127.0.0.1:3000
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from services.env_loader import load_env


@dataclass
class VerifyResult:
    passed: bool
    message: str
    details: Dict[str, Any]


def _get_supabase_client():
    try:
        from services.supabase_helpers import get_supabase_client
    except Exception as exc:
        raise RuntimeError(
            "Supabase Python dependency is missing. Install backend deps first: "
            "`cd backend && pip install -r requirements.txt`"
        ) from exc
    return get_supabase_client()


def _load_cookie_header(storage_state_path: Path) -> str:
    if not storage_state_path.exists():
        raise FileNotFoundError(
            f"Storage state file not found: {storage_state_path}. "
            "Refresh auth with: cd frontend && npx playwright test tests/auth.setup.ts"
        )
    raw = json.loads(storage_state_path.read_text(encoding="utf-8"))
    cookies = raw.get("cookies") or []
    if not cookies:
        raise RuntimeError(f"No cookies found in storage state: {storage_state_path}")
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies if c.get("name") and c.get("value"))


def _extract_tool_names(tool_trace: Any) -> List[str]:
    if not isinstance(tool_trace, list):
        return []
    names: List[str] = []
    for item in tool_trace:
        if not isinstance(item, dict):
            continue
        tool_name = item.get("tool")
        if isinstance(tool_name, str) and tool_name:
            names.append(tool_name)
    return names


def _poll_assistant_row(
    client,
    session_id: str,
    timeout_seconds: int,
) -> Optional[Dict[str, Any]]:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        row_resp = (
            client.table("chat_history")
            .select("id, role, content, metadata, created_at")
            .eq("session_id", session_id)
            .eq("role", "assistant")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = row_resp.data or []
        if rows:
            return rows[0]
        time.sleep(1)
    return None


def _cleanup_session(client, session_id: str) -> None:
    try:
        client.table("chat_history").delete().eq("session_id", session_id).execute()
    except Exception:
        # Cleanup should never mask verification outcomes.
        pass


def verify(
    frontend_url: str,
    storage_state_path: Path,
    query: str,
    timeout_seconds: int,
    strict_no_portfolio_overview: bool,
    cleanup: bool,
) -> VerifyResult:
    cookie_header = _load_cookie_header(storage_state_path)
    client = _get_supabase_client()
    session_id = str(uuid4())

    try:
        payload = {
            "id": session_id,
            "messages": [
                {
                    "id": str(uuid4()),
                    "role": "user",
                    "parts": [{"type": "text", "text": query}],
                }
            ],
        }

        try:
            response = requests.post(
                f"{frontend_url.rstrip('/')}/api/ai-assistant/chat",
                headers={
                    "Content-Type": "application/json",
                    "Cookie": cookie_header,
                },
                json=payload,
                timeout=120,
                stream=True,
            )
        except requests.RequestException as exc:
            return VerifyResult(
                passed=False,
                message="Failed to reach frontend /api/ai-assistant/chat",
                details={
                    "frontend_url": frontend_url,
                    "error": str(exc),
                },
            )
        if response.status_code != 200:
            return VerifyResult(
                passed=False,
                message="Frontend /api/ai-assistant/chat returned non-200",
                details={
                    "status_code": response.status_code,
                    "body": response.text[:500],
                },
            )

        # Drain stream to completion so onFinish persistence happens.
        for _ in response.iter_content(chunk_size=4096):
            pass

        assistant_row = _poll_assistant_row(
            client=client, session_id=session_id, timeout_seconds=timeout_seconds
        )
        if not assistant_row:
            return VerifyResult(
                passed=False,
                message="No assistant row found in chat_history for session",
                details={"session_id": session_id, "timeout_seconds": timeout_seconds},
            )

        metadata = assistant_row.get("metadata")
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except json.JSONDecodeError:
                metadata = {}
        if not isinstance(metadata, dict):
            metadata = {}

        tool_trace = metadata.get("tool_trace")
        tool_names = _extract_tool_names(tool_trace)

        if "getProjectsWithRisks" not in tool_names:
            return VerifyResult(
                passed=False,
                message="Risk routing failed: getProjectsWithRisks not found in tool_trace",
                details={
                    "session_id": session_id,
                    "tool_names": tool_names,
                    "assistant_excerpt": str(assistant_row.get("content", ""))[:800],
                },
            )

        if strict_no_portfolio_overview and "getPortfolioOverview" in tool_names:
            return VerifyResult(
                passed=False,
                message="Strict check failed: getPortfolioOverview appeared in risk-routing tool_trace",
                details={"session_id": session_id, "tool_names": tool_names},
            )

        return VerifyResult(
            passed=True,
            message="Risk routing verification passed",
            details={
                "session_id": session_id,
                "tools_called": tool_names,
                "assistant_excerpt": str(assistant_row.get("content", ""))[:800],
            },
        )
    finally:
        if cleanup:
            _cleanup_session(client, session_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify AI assistant risk routing via tool_trace",
    )
    parser.add_argument(
        "--frontend-url",
        default=os.getenv("FRONTEND_URL", "http://127.0.0.1:3000"),
    )
    parser.add_argument(
        "--storage-state",
        default=str(REPO_ROOT / "frontend/tests/.auth/user.json"),
        help="Path to Playwright storage state JSON containing auth cookies",
    )
    parser.add_argument(
        "--query",
        default="What projects have risks?",
        help="Risk-focused query used to trigger routing",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=75,
        help="Max time to wait for assistant row persistence",
    )
    parser.add_argument(
        "--strict-no-portfolio-overview",
        action="store_true",
        help="Fail if getPortfolioOverview appears in tool_trace",
    )
    parser.add_argument(
        "--no-cleanup",
        action="store_true",
        help="Keep generated chat_history rows for inspection",
    )
    return parser.parse_args()


def main() -> int:
    load_env()
    args = parse_args()
    result = verify(
        frontend_url=args.frontend_url,
        storage_state_path=Path(args.storage_state),
        query=args.query,
        timeout_seconds=args.timeout_seconds,
        strict_no_portfolio_overview=args.strict_no_portfolio_overview,
        cleanup=not args.no_cleanup,
    )
    print(json.dumps(result.__dict__, indent=2))
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
