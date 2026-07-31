#!/usr/bin/env python3
"""
Re-run task extraction for recent Fireflies meetings.

Default behavior:
- Select the most recent 20 meetings with a Fireflies ID
- Exclude meetings where document_metadata.type = 'interview'
- Run extractor for each meeting
- Print linkage verification for tasks -> meeting -> project

Usage:
  cd backend
  PYTHONPATH="src" python scripts/reprocess_recent_fireflies_tasks.py
  PYTHONPATH="src" python scripts/reprocess_recent_fireflies_tasks.py --limit 30
  PYTHONPATH="src" python scripts/reprocess_recent_fireflies_tasks.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


def _bootstrap_paths() -> None:
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(scripts_dir)
    src_path = os.path.join(backend_dir, "src")
    if src_path not in sys.path:
        sys.path.insert(0, src_path)


_bootstrap_paths()

from services.env_loader import load_env, verify_required_vars  # type: ignore  # noqa: E402
from services.pipeline.extractor import run_extractor  # type: ignore  # noqa: E402
from services.supabase_helpers import get_supabase_client  # type: ignore  # noqa: E402


def _parse_dt(value: Optional[str]) -> datetime:
    if not value:
        return datetime.min
    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(raw)
    except Exception:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d")
        except Exception:
            return datetime.min


def _select_recent_meetings(limit: int, include_interviews: bool) -> List[Dict[str, Any]]:
    client = get_supabase_client()
    query = (
        client.table("document_metadata")
        .select("id,title,date,captured_at,type,project_id,fireflies_id")
        .not_.is_("fireflies_id", "null")
        .limit(max(limit * 5, 100))
    )
    if not include_interviews:
        query = query.or_("type.is.null,type.neq.interview")

    result = query.execute()
    rows = result.data or []
    rows.sort(
        key=lambda row: _parse_dt(row.get("date") or row.get("captured_at")),
        reverse=True,
    )
    return rows[:limit]


def _verify_meeting_tasks(metadata_id: str) -> Tuple[int, int, int]:
    """
    Returns:
      (task_count, tasks_missing_meeting_link, tasks_missing_project_link)
    """
    client = get_supabase_client()
    tasks = (
        client.table("tasks")
        .select("id,metadata_id,project_id,project_ids")
        .eq("metadata_id", metadata_id)
        .execute()
    ).data or []

    missing_meeting = 0
    missing_project = 0
    for task in tasks:
        if not task.get("metadata_id"):
            missing_meeting += 1
        project_id = task.get("project_id")
        project_ids = task.get("project_ids") or []
        if project_id is None and len(project_ids) == 0:
            missing_project += 1

    return len(tasks), missing_meeting, missing_project


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reprocess recent Fireflies meetings and verify task linkage."
    )
    parser.add_argument("--limit", type=int, default=20, help="Number of recent meetings to process")
    parser.add_argument("--dry-run", action="store_true", help="List selected meetings without extraction")
    parser.add_argument(
        "--include-interviews",
        action="store_true",
        help="Include meetings with type=interview (default excludes them)",
    )
    args = parser.parse_args()

    load_env()
    verify_required_vars("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")

    meetings = _select_recent_meetings(args.limit, args.include_interviews)
    if not meetings:
        print("No matching meetings found.")
        return 0

    print(f"Selected {len(meetings)} meetings:")
    for idx, meeting in enumerate(meetings, 1):
        print(
            f"{idx:02d}. {meeting.get('id')} | {meeting.get('title') or 'Untitled'} "
            f"| type={meeting.get('type') or 'null'} | project_id={meeting.get('project_id')}"
        )

    if args.dry_run:
        print("\nDry run complete. No extraction performed.")
        return 0

    processed = 0
    failed = 0
    total_tasks = 0
    total_missing_meeting = 0
    total_missing_project = 0

    for idx, meeting in enumerate(meetings, 1):
        metadata_id = meeting["id"]
        title = meeting.get("title") or "Untitled"
        print(f"\n[{idx}/{len(meetings)}] Reprocessing: {title} ({metadata_id})")
        try:
            result = run_extractor(metadata_id)
            tasks_count, missing_meeting, missing_project = _verify_meeting_tasks(metadata_id)
            total_tasks += tasks_count
            total_missing_meeting += missing_meeting
            total_missing_project += missing_project
            processed += 1
            print(
                "  OK",
                f"extracted_tasks={result.get('tasks', 0)}",
                f"stored_tasks={tasks_count}",
                f"missing_meeting_link={missing_meeting}",
                f"missing_project_link={missing_project}",
            )
        except Exception as exc:
            failed += 1
            print(f"  ERROR: {exc}")

    print("\nSummary")
    print(f"- Processed meetings: {processed}")
    print(f"- Failed meetings: {failed}")
    print(f"- Total tasks linked to meetings: {total_tasks}")
    print(f"- Tasks missing meeting link: {total_missing_meeting}")
    print(f"- Tasks missing project link: {total_missing_project}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
