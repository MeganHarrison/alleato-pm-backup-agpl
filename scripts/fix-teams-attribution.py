#!/usr/bin/env python3
"""Correct known Teams DM title-level project attribution misses."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, Optional

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.services.env_loader import load_env
from src.services.supabase_helpers import get_supabase_client


def _project_matches(project: Dict[str, Any], *terms: str) -> bool:
    haystack = " ".join(
        str(value or "")
        for value in [
            project.get("name"),
            project.get("client"),
            project.get("project_number"),
            " ".join(project.get("aliases") or []),
        ]
    ).lower()
    return all(term.lower() in haystack for term in terms)


def _find_project(projects: list[Dict[str, Any]], *terms: str) -> Optional[Dict[str, Any]]:
    matches = [project for project in projects if _project_matches(project, *terms)]
    if len(matches) == 1:
        return matches[0]
    return None


def _append_tag(existing: Optional[str], tag: str) -> str:
    tags = [item.strip() for item in (existing or "").split(",") if item.strip()]
    if tag not in tags:
        tags.append(tag)
    return ",".join(tags)


def main() -> int:
    parser = argparse.ArgumentParser(description="Fix known Teams Ulta Fresno attribution")
    parser.add_argument("--apply", action="store_true", help="Apply changes. Defaults to dry run.")
    args = parser.parse_args()

    load_env()
    client = get_supabase_client()

    projects = (
        client.table("projects")
        .select("id, name, aliases, client, project_number")
        .ilike("name", "%ulta%")
        .execute()
        .data
        or []
    )
    fresno = _find_project(projects, "ulta", "fresno")
    dallas = _find_project(projects, "ulta", "dallas")
    if not fresno or not dallas:
        print("Could not uniquely verify Ulta Fresno and Ulta Dallas projects.")
        print({"projects": projects})
        return 1

    rows = (
        client.table("document_metadata")
        .select("id, title, project_id, project, tags")
        .eq("type", "teams_dm_conversation")
        .ilike("title", "%Ulta Fresno%")
        .eq("project_id", int(dallas["id"]))
        .execute()
        .data
        or []
    )

    print(
        f"Verified Fresno project {fresno['id']} / {fresno.get('name')}; "
        f"Dallas project {dallas['id']} / {dallas.get('name')}; rows={len(rows)}; "
        f"mode={'apply' if args.apply else 'dry-run'}"
    )
    if not args.apply:
        for row in rows:
            print(f"DRY RUN {row['id']}: {row.get('project')} -> {fresno.get('name')}")
        return 0

    for row in rows:
        client.table("document_metadata").update(
            {
                "project_id": int(fresno["id"]),
                "project": fresno.get("name"),
                "tags": _append_tag(row.get("tags"), "teams_attribution_corrected:ulta_fresno"),
            }
        ).eq("id", row["id"]).execute()
        client.table("document_attribution_candidates").insert(
            {
                "source_document_id": row["id"],
                "candidate_project_id": int(fresno["id"]),
                "candidate_project_name": fresno.get("name"),
                "confidence": 0.95,
                "attribution_method": "title_override",
                "evidence_terms": ["Ulta Fresno"],
                "reasoning": (
                    "Backfill corrected a stale Teams DM assignment where the title "
                    "matched Ulta Fresno but project_id pointed to Ulta Dallas."
                ),
                "status": "auto_assigned",
            }
        ).execute()
        print(f"UPDATED {row['id']}: {row.get('project')} -> {fresno.get('name')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
