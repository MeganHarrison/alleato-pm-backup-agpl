#!/usr/bin/env python3
"""Backfill project_id on communications with obvious project text signals."""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.services.env_loader import load_env
from src.services.supabase_helpers import get_supabase_client


SOURCE_FILTERS = {
    "microsoft_graph": {"teams_message", "email", "document"},
    "fireflies": None,
}
BACKFILL_TAG = "project_backfill:comm_text_v1"
SAFE_METHODS = {
    "project_number",
    "title_name",
    "content_name",
    "project_number+content_name",
    "content_name+content_client",
    "project_number+content_client",
    "project_number_compact+content_name",
    "project_number_compact+content_client",
}


@dataclass(frozen=True)
class ProjectTerm:
    project_id: int
    name: str
    project_number: str
    client: str
    aliases: tuple[str, ...]


@dataclass(frozen=True)
class Assignment:
    document_id: str
    project_id: int
    project_name: str
    score: int
    second_score: int
    method: str
    evidence_terms: tuple[str, ...]


def normalize(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def compact(value: str) -> str:
    return re.sub(r"[^0-9a-z]", "", value.lower())


def contains_token(text: str, term: str) -> bool:
    if not term:
        return False
    return re.search(rf"(^|[^0-9a-z]){re.escape(term.lower())}([^0-9a-z]|$)", text) is not None


def append_tag(existing: Optional[str], tag: str) -> str:
    tags = [item.strip() for item in (existing or "").split(",") if item.strip()]
    if tag not in tags:
        tags.append(tag)
    return ",".join(tags)


def chunked(items: list[Any], size: int) -> Iterable[list[Any]]:
    for idx in range(0, len(items), size):
        yield items[idx : idx + size]


def load_projects(client) -> list[ProjectTerm]:
    rows = (
        client.table("projects")
        .select("id,name,project_number,aliases,archived")
        .eq("archived", False)
        .execute()
        .data
        or []
    )
    projects: list[ProjectTerm] = []
    for row in rows:
        project_id = row.get("id")
        if not project_id:
            continue
        projects.append(
            ProjectTerm(
                project_id=int(project_id),
                name=str(row.get("name") or ""),
                project_number=str(row.get("project_number") or ""),
                client=str(row.get("client") or ""),
                aliases=tuple(str(alias).strip() for alias in (row.get("aliases") or []) if str(alias).strip()),
            )
        )
    return projects


def load_unassigned_documents(client, limit: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page_size = min(1000, max(100, limit))
    start = 0
    while len(rows) < limit:
        end = min(start + page_size - 1, start + (limit - len(rows)) - 1)
        response = (
            client.table("document_metadata")
            .select("id,title,source,category,type,content,summary,overview,participants,tags,project,project_id")
            .is_("project_id", "null")
            .in_("source", list(SOURCE_FILTERS.keys()))
            .range(start, end)
            .execute()
        )
        batch = response.data or []
        if not batch:
            break
        for row in batch:
            source = row.get("source")
            category = row.get("category")
            allowed_categories = SOURCE_FILTERS.get(source)
            if allowed_categories is None or category in allowed_categories:
                rows.append(row)
        if len(batch) < page_size:
            break
        start += page_size
    return rows[:limit]


def score_project(doc: dict[str, Any], project: ProjectTerm) -> tuple[int, str, tuple[str, ...]]:
    title = normalize(doc.get("title"))
    body = normalize(
        " ".join(
            str(doc.get(field) or "")
            for field in ("content", "summary", "overview", "tags", "project", "participants")
        )
    )
    all_text = f"{title} {body}"
    all_compact = compact(all_text)
    score = 0
    evidence: list[str] = []
    methods: list[str] = []

    number = normalize(project.project_number)
    if number:
        if contains_token(all_text, number):
            score += 30
            evidence.append(project.project_number)
            methods.append("project_number")
        elif len(compact(number)) >= 4 and compact(number) in all_compact:
            score += 24
            evidence.append(project.project_number)
            methods.append("project_number_compact")

    name = normalize(project.name)
    if len(name) >= 5:
        if name in title:
            score += 18
            evidence.append(project.name)
            methods.append("title_name")
        elif name in body:
            score += 12
            evidence.append(project.name)
            methods.append("content_name")

    client = normalize(project.client)
    if len(client) >= 5:
        if client in title:
            score += 10
            evidence.append(project.client)
            methods.append("title_client")
        elif client in body:
            score += 6
            evidence.append(project.client)
            methods.append("content_client")

    for alias in project.aliases:
        alias_norm = normalize(alias)
        if len(alias_norm) < 3:
            continue
        if contains_token(all_text, alias_norm):
            score += 12 if len(alias_norm) <= 5 else 14
            evidence.append(alias)
            methods.append("alias")

    method = "+".join(dict.fromkeys(methods)) or "none"
    return score, method, tuple(dict.fromkeys(evidence))


def choose_assignment(
    doc: dict[str, Any],
    projects: list[ProjectTerm],
    min_score: int,
    min_margin: int,
    allow_compact_only: bool,
) -> Optional[Assignment]:
    scored: list[tuple[int, str, tuple[str, ...], ProjectTerm]] = []
    for project in projects:
        score, method, evidence = score_project(doc, project)
        if score >= min_score:
            scored.append((score, method, evidence, project))

    if not scored:
        return None

    scored.sort(key=lambda item: (-item[0], item[3].project_id))
    best_score, method, evidence, project = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0
    if second_score and best_score < second_score + min_margin:
        return None
    if not allow_compact_only and method not in SAFE_METHODS:
        return None

    return Assignment(
        document_id=str(doc["id"]),
        project_id=project.project_id,
        project_name=project.name,
        score=best_score,
        second_score=second_score,
        method=method,
        evidence_terms=evidence,
    )


def apply_assignments(client, docs_by_id: dict[str, dict[str, Any]], assignments: list[Assignment]) -> None:
    for batch in chunked(assignments, 100):
        for assignment in batch:
            doc = docs_by_id[assignment.document_id]
            client.table("document_metadata").update(
                {
                    "project_id": assignment.project_id,
                    "project": assignment.project_name,
                    "tags": append_tag(doc.get("tags"), BACKFILL_TAG),
                }
            ).eq("id", assignment.document_id).execute()

            client.table("document_attribution_candidates").insert(
                {
                    "source_document_id": assignment.document_id,
                    "candidate_project_id": assignment.project_id,
                    "candidate_project_name": assignment.project_name,
                    "confidence": min(0.99, assignment.score / 40),
                    "attribution_method": assignment.method,
                    "evidence_terms": list(assignment.evidence_terms),
                    "reasoning": (
                        "Auto-assigned by communications project backfill using explicit "
                        "project number, project name, client, or alias text in title/content."
                    ),
                    "status": "auto_assigned",
                }
            ).execute()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply updates. Defaults to dry-run.")
    parser.add_argument("--limit", type=int, default=50000, help="Maximum unassigned rows to scan.")
    parser.add_argument("--min-score", type=int, default=12)
    parser.add_argument("--min-margin", type=int, default=4)
    parser.add_argument(
        "--allow-compact-only",
        action="store_true",
        help="Allow project-number matches with only compact numeric evidence. Defaults off to avoid false positives.",
    )
    parser.add_argument("--sample", type=int, default=25)
    args = parser.parse_args()

    load_env()
    client = get_supabase_client()
    projects = load_projects(client)
    docs = load_unassigned_documents(client, args.limit)
    docs_by_id = {str(doc["id"]): doc for doc in docs}

    assignments: list[Assignment] = []
    for doc in docs:
        assignment = choose_assignment(
            doc,
            projects,
            args.min_score,
            args.min_margin,
            args.allow_compact_only,
        )
        if assignment:
            assignments.append(assignment)

    by_source = Counter((docs_by_id[a.document_id].get("source"), docs_by_id[a.document_id].get("category")) for a in assignments)
    by_method = Counter(a.method for a in assignments)
    by_project = Counter((a.project_id, a.project_name) for a in assignments)

    print(f"mode={'apply' if args.apply else 'dry-run'}")
    print(f"projects_loaded={len(projects)}")
    print(f"unassigned_scanned={len(docs)}")
    print(f"assignable={len(assignments)}")
    print("assignable_by_source_category=" + repr(dict(by_source.most_common())))
    print("assignable_by_method=" + repr(dict(by_method.most_common(15))))
    print("top_projects=" + repr(dict(by_project.most_common(15))))
    print("sample_assignments:")
    for assignment in assignments[: args.sample]:
        doc = docs_by_id[assignment.document_id]
        print(
            f"- {assignment.document_id} | {doc.get('source')}/{doc.get('category')} | "
            f"score={assignment.score} second={assignment.second_score} | "
            f"project={assignment.project_id} {assignment.project_name!r} | "
            f"method={assignment.method} | evidence={list(assignment.evidence_terms)!r} | "
            f"title={str(doc.get('title') or '')[:120]!r}"
        )

    if args.apply and assignments:
        apply_assignments(client, docs_by_id, assignments)
        print(f"updated={len(assignments)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
