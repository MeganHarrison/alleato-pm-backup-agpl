#!/usr/bin/env python3
"""Verify transcript task integrity (source + project linkage + quality signals).

Checks recent `tasks` rows with `source_system='fireflies'` and validates:
1. Source document is meeting-like (not generic document rows).
2. For docs with `document_metadata.project_id`, both task `project_id` and
   task `project_ids` align to that project.
3. Reports quality signals for meeting tasks (missing assignee/due/generic text).

Usage:
  python3 scripts/verify/verify_fireflies_task_integrity.py
  python3 scripts/verify/verify_fireflies_task_integrity.py --window-hours 72 --limit 1000
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from services.env_loader import load_env


MEETING_TYPES = {"meeting", "transcript", "meeting_transcript"}
GENERIC_PREFIX_RE = re.compile(
    r"^(prepare|review|follow up|check|ensure|discuss|coordinate|look into)\\b",
    re.IGNORECASE,
)


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


def _is_meeting_doc(dm: Dict[str, Any]) -> bool:
    source = str(dm.get("source") or "").strip().lower()
    metadata_type = str(dm.get("type") or "").strip().lower()
    category = str(dm.get("category") or "").strip().lower()
    return source == "fireflies" or metadata_type in MEETING_TYPES or category in MEETING_TYPES


def _summarize_quality(meeting_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(meeting_rows)
    if total == 0:
        return {
            "meeting_task_count": 0,
            "missing_assignee": 0,
            "missing_due_date": 0,
            "generic_prefix_descriptions": 0,
            "missing_assignee_pct": 0.0,
            "missing_due_date_pct": 0.0,
            "generic_prefix_pct": 0.0,
        }

    missing_assignee = sum(
        1
        for row in meeting_rows
        if not (row.get("assignee_name") or row.get("assignee_email"))
    )
    missing_due_date = sum(1 for row in meeting_rows if not row.get("due_date"))
    generic_prefix = sum(
        1
        for row in meeting_rows
        if GENERIC_PREFIX_RE.match(str(row.get("description") or "").strip().lower())
    )

    def pct(value: int) -> float:
        return round((value / total) * 100, 1)

    return {
        "meeting_task_count": total,
        "missing_assignee": missing_assignee,
        "missing_due_date": missing_due_date,
        "generic_prefix_descriptions": generic_prefix,
        "missing_assignee_pct": pct(missing_assignee),
        "missing_due_date_pct": pct(missing_due_date),
        "generic_prefix_pct": pct(generic_prefix),
    }


def verify(window_hours: int, limit: int) -> VerifyResult:
    client = _get_supabase_client()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)

    rows = (
        client.table("tasks")
        .select(
            "id,created_at,description,metadata_id,project_id,project_ids,"
            "assignee_name,assignee_email,due_date,source_system,"
            "document_metadata!tasks_metadata_id_fkey(id,project_id,type,category,source,title)"
        )
        .eq("source_system", "fireflies")
        .gte("created_at", cutoff.isoformat())
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    ).data or []

    if not rows:
        return VerifyResult(
            passed=True,
            message="No recent fireflies tasks found in verification window",
            details={"window_hours": window_hours, "limit": limit, "checked": 0},
        )

    non_meeting_violations: List[Dict[str, Any]] = []
    link_violations: List[Dict[str, Any]] = []
    meeting_rows: List[Dict[str, Any]] = []

    for row in rows:
        dm = row.get("document_metadata") or {}
        if not _is_meeting_doc(dm):
            non_meeting_violations.append(
                {
                    "task_id": row.get("id"),
                    "created_at": row.get("created_at"),
                    "metadata_id": row.get("metadata_id"),
                    "doc_type": dm.get("type"),
                    "doc_category": dm.get("category"),
                    "doc_source": dm.get("source"),
                    "doc_title": dm.get("title"),
                }
            )
            continue

        meeting_rows.append(row)

        doc_project_id = dm.get("project_id")
        if doc_project_id is None:
            continue

        task_project_id = row.get("project_id")
        task_project_ids = row.get("project_ids") or []
        if task_project_id != doc_project_id or doc_project_id not in task_project_ids:
            link_violations.append(
                {
                    "task_id": row.get("id"),
                    "created_at": row.get("created_at"),
                    "metadata_id": row.get("metadata_id"),
                    "task_project_id": task_project_id,
                    "task_project_ids": task_project_ids,
                    "doc_project_id": doc_project_id,
                    "doc_title": dm.get("title"),
                }
            )

    quality = _summarize_quality(meeting_rows)
    max_missing_assignee_pct = float(
        getattr(verify, "max_missing_assignee_pct", 75.0)
    )
    max_generic_prefix_pct = float(getattr(verify, "max_generic_prefix_pct", 20.0))
    quality_violations: List[Dict[str, Any]] = []
    if quality["missing_assignee_pct"] > max_missing_assignee_pct:
        quality_violations.append(
            {
                "metric": "missing_assignee_pct",
                "actual": quality["missing_assignee_pct"],
                "max": max_missing_assignee_pct,
            }
        )
    if quality["generic_prefix_pct"] > max_generic_prefix_pct:
        quality_violations.append(
            {
                "metric": "generic_prefix_pct",
                "actual": quality["generic_prefix_pct"],
                "max": max_generic_prefix_pct,
            }
        )

    passed = (
        len(non_meeting_violations) == 0
        and len(link_violations) == 0
        and len(quality_violations) == 0
    )
    message = "Fireflies task integrity verification passed" if passed else "Fireflies task integrity verification failed"

    return VerifyResult(
        passed=passed,
        message=message,
        details={
            "window_hours": window_hours,
            "checked": len(rows),
            "meeting_rows": len(meeting_rows),
            "non_meeting_violations": len(non_meeting_violations),
            "link_violations": len(link_violations),
            "quality": quality,
            "quality_thresholds": {
                "max_missing_assignee_pct": max_missing_assignee_pct,
                "max_generic_prefix_pct": max_generic_prefix_pct,
            },
            "quality_violations": quality_violations,
            "non_meeting_examples": non_meeting_violations[:10],
            "link_examples": link_violations[:10],
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify transcript task integrity and linkage")
    parser.add_argument("--window-hours", type=int, default=24)
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--max-missing-assignee-pct", type=float, default=75.0)
    parser.add_argument("--max-generic-prefix-pct", type=float, default=20.0)
    args = parser.parse_args()

    load_env()
    verify.max_missing_assignee_pct = args.max_missing_assignee_pct  # type: ignore[attr-defined]
    verify.max_generic_prefix_pct = args.max_generic_prefix_pct  # type: ignore[attr-defined]
    result = verify(window_hours=args.window_hours, limit=args.limit)
    print(
        json.dumps(
            {"passed": result.passed, "message": result.message, "details": result.details},
            indent=2,
        )
    )
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
