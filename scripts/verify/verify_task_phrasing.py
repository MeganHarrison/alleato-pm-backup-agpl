#!/usr/bin/env python3
"""Verify that no task row regresses to third-person narration or null titles.

Flags any `tasks` row matching the failure modes that the 2026-05-28 LLM
rewriter was added to prevent:

- `title IS NULL` or empty (frontend silently falls back to description)
- Title or description that reads like third-person narration —
  "X asked Y", "Provide … to <Name>", "Inform <Name>", "Coordinate with <Name>".
  These are the exact shapes the rewriter is designed to drop or rewrite.
- AI-source tasks (fireflies/teams/email/meeting) without an
  `extraction_prompt_version` — meaning they bypassed the rewriter entirely.

Exits non-zero when any task fails the check so this can run in CI / smoke.

Usage:
  python3 scripts/verify/verify_task_phrasing.py
  python3 scripts/verify/verify_task_phrasing.py --window-hours 168 --limit 2000
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from services.env_loader import load_env  # noqa: E402

AI_SOURCE_SYSTEMS = {
    "fireflies",
    "teams_dm",
    "teams_dm_conversation",
    "teams_message",
    "outlook_email",
    "meeting",
}

NARRATION_PATTERNS = [
    (
        "narration_verb",
        re.compile(
            r"^\s*[A-Z][A-Za-z .'-]{1,80}\s+(asked|told|requested|suggested|mentioned|noted|discussed|raised|clarified)\b",
            re.I,
        ),
    ),
    (
        "provide_to_name",
        re.compile(r"^\s*provide\b.{0,40}\bto\s+[A-Z][A-Za-z .'-]+", re.I),
    ),
    (
        "inform_name",
        re.compile(r"^\s*inform\s+[A-Z][A-Za-z .'-]+", re.I),
    ),
    (
        "coordinate_with",
        re.compile(r"^\s*coordinate\s+(?:with|receipt|scheduling)\b", re.I),
    ),
    (
        "schedule_call_with",
        re.compile(r"^\s*schedule\s+(?:a\s+)?(?:future\s+)?call\s+with\s+[A-Z]", re.I),
    ),
]


def _get_supabase_client():
    from services.supabase_helpers import get_supabase_client

    return get_supabase_client()


def _scan_phrasing(text: str) -> List[str]:
    hits: List[str] = []
    for label, pattern in NARRATION_PATTERNS:
        if pattern.search(text or ""):
            hits.append(label)
    return hits


def _run(window_hours: int, limit: int) -> int:
    load_env()
    client = _get_supabase_client()

    since = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()

    response = (
        client.table("tasks")
        .select("id,title,description,source_system,extraction_prompt_version,created_at,assignee_name")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows: List[Dict[str, Any]] = response.data or []

    null_title: List[Dict[str, Any]] = []
    missing_prompt_version: List[Dict[str, Any]] = []
    narration: List[Dict[str, Any]] = []

    for row in rows:
        title = (row.get("title") or "").strip()
        description = (row.get("description") or "").strip()
        source = (row.get("source_system") or "").strip().lower()
        prompt_version = (row.get("extraction_prompt_version") or "").strip()

        if not title:
            null_title.append(row)

        if source in AI_SOURCE_SYSTEMS and not prompt_version:
            missing_prompt_version.append(row)

        flags = _scan_phrasing(title) + _scan_phrasing(description)
        if flags:
            narration.append({**row, "_phrasing_flags": flags})

    total_failures = len(null_title) + len(missing_prompt_version) + len(narration)
    summary = {
        "window_hours": window_hours,
        "rows_scanned": len(rows),
        "null_title_count": len(null_title),
        "missing_prompt_version_count": len(missing_prompt_version),
        "narration_count": len(narration),
        "total_failures": total_failures,
        "samples": {
            "null_title": null_title[:5],
            "missing_prompt_version": missing_prompt_version[:5],
            "narration": narration[:10],
        },
    }
    print(json.dumps(summary, indent=2, default=str))

    if total_failures > 0:
        print(
            f"\nFAIL: {total_failures} task quality regressions in the last {window_hours}h.",
            file=sys.stderr,
        )
        return 1

    print(f"\nOK: no task quality regressions in the last {window_hours}h.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--window-hours", type=int, default=72)
    parser.add_argument("--limit", type=int, default=2000)
    args = parser.parse_args()
    return _run(args.window_hours, args.limit)


if __name__ == "__main__":
    sys.exit(main())
