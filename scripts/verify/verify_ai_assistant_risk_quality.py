#!/usr/bin/env python3
"""Verify strategist risk answer quality shape using tool trace + response text.

This is a pragmatic quality gate, not a perfect semantic grader.

Checks:
1. Calls frontend /api/ai-assistant/chat with authenticated cookie state.
2. Waits for persisted assistant row in chat_history.
3. Verifies tool_trace includes getProjectsWithRisks.
4. Verifies getProjectsWithRisks output includes ranked projects.
5. Verifies assistant response references at least one returned project name.
6. Verifies assistant response contains quantified risk language.
"""

from __future__ import annotations

import argparse
import json
import os
import re
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
    return "; ".join(
        f"{c['name']}={c['value']}"
        for c in cookies
        if c.get("name") and c.get("value")
    )


def _poll_assistant_row(client, session_id: str, timeout_seconds: int) -> Optional[Dict[str, Any]]:
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
        pass


def _normalize_metadata(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    return {}


def _extract_trace(metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
    trace = metadata.get("tool_trace")
    if not isinstance(trace, list):
        return []
    return [t for t in trace if isinstance(t, dict)]


def _find_risk_trace(trace: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for item in reversed(trace):
        if item.get("tool") == "getProjectsWithRisks":
            return item
    return None


def _is_desc_sorted(values: List[float]) -> bool:
    return all(values[i] >= values[i + 1] for i in range(len(values) - 1))


def _contains_quantified_risk_language(text: str) -> bool:
    lower = text.lower()
    has_number = bool(re.search(r"\d", lower))
    risk_terms = [
        "risk",
        "critical",
        "issue",
        "insight",
        "exposure",
    ]
    return has_number and any(term in lower for term in risk_terms)


def verify(
    frontend_url: str,
    storage_state_path: Path,
    query: str,
    timeout_seconds: int,
    min_projects: int,
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
                details={"frontend_url": frontend_url, "error": str(exc)},
            )

        if response.status_code != 200:
            return VerifyResult(
                passed=False,
                message="Frontend /api/ai-assistant/chat returned non-200",
                details={"status_code": response.status_code, "body": response.text[:500]},
            )

        for _ in response.iter_content(chunk_size=4096):
            pass

        assistant_row = _poll_assistant_row(client, session_id, timeout_seconds)
        if not assistant_row:
            return VerifyResult(
                passed=False,
                message="No assistant row found in chat_history",
                details={"session_id": session_id, "timeout_seconds": timeout_seconds},
            )

        assistant_content = str(assistant_row.get("content") or "")
        metadata = _normalize_metadata(assistant_row.get("metadata"))
        trace = _extract_trace(metadata)
        tool_names = [str(t.get("tool")) for t in trace if t.get("tool")]

        if "getProjectsWithRisks" not in tool_names:
            return VerifyResult(
                passed=False,
                message="Missing getProjectsWithRisks in tool_trace",
                details={"session_id": session_id, "tool_names": tool_names},
            )

        risk_trace = _find_risk_trace(trace)
        if not risk_trace:
            return VerifyResult(
                passed=False,
                message="Unable to find getProjectsWithRisks trace payload",
                details={"session_id": session_id, "tool_names": tool_names},
            )

        output = risk_trace.get("output")
        if not isinstance(output, dict):
            return VerifyResult(
                passed=False,
                message="getProjectsWithRisks trace missing output payload",
                details={"session_id": session_id, "risk_trace": risk_trace},
            )

        projects = output.get("projects")
        if not isinstance(projects, list):
            return VerifyResult(
                passed=False,
                message="getProjectsWithRisks output missing projects list",
                details={"session_id": session_id, "output_keys": list(output.keys())},
            )

        ranked_projects = [p for p in projects if isinstance(p, dict)]
        if len(ranked_projects) < min_projects:
            return VerifyResult(
                passed=False,
                message=f"Insufficient risky projects returned (< {min_projects})",
                details={
                    "session_id": session_id,
                    "returned_projects": len(ranked_projects),
                },
            )

        scores: List[float] = []
        names: List[str] = []
        for p in ranked_projects:
            raw_score = p.get("riskScore")
            if isinstance(raw_score, (int, float)):
                scores.append(float(raw_score))
            name = p.get("name")
            if isinstance(name, str) and name.strip():
                names.append(name.strip())

        if scores and not _is_desc_sorted(scores):
            return VerifyResult(
                passed=False,
                message="Risk projects are not sorted by descending riskScore",
                details={"session_id": session_id, "scores": scores[:10]},
            )

        lower_answer = assistant_content.lower()
        referenced_names = [n for n in names[:5] if n.lower() in lower_answer]
        if not referenced_names:
            return VerifyResult(
                passed=False,
                message="Assistant response did not reference any top risky project names",
                details={
                    "session_id": session_id,
                    "top_projects": names[:5],
                    "assistant_excerpt": assistant_content[:900],
                },
            )

        if not _contains_quantified_risk_language(assistant_content):
            return VerifyResult(
                passed=False,
                message="Assistant response lacks quantified risk language",
                details={
                    "session_id": session_id,
                    "assistant_excerpt": assistant_content[:900],
                },
            )

        return VerifyResult(
            passed=True,
            message="Risk answer quality verification passed",
            details={
                "session_id": session_id,
                "tool_names": tool_names,
                "referenced_projects": referenced_names,
                "top_projects": names[:5],
                "top_scores": scores[:5],
                "assistant_excerpt": assistant_content[:900],
            },
        )
    finally:
        if cleanup:
            _cleanup_session(client, session_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify AI assistant risk-answer quality via tool_trace + content heuristics",
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
        help="Risk-focused query used to evaluate answer quality",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=75,
        help="Max time to wait for assistant row persistence",
    )
    parser.add_argument(
        "--min-projects",
        type=int,
        default=1,
        help="Minimum number of risky projects expected from tool output",
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
        min_projects=args.min_projects,
        cleanup=not args.no_cleanup,
    )
    print(json.dumps(result.__dict__, indent=2))
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
