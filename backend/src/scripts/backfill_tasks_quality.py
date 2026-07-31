"""
Backfill task quality for Fireflies meetings.

Fixes three problems with existing meeting tasks:
  1. Missing/fake assignee emails (@example.com placeholders)
  2. Missing project_id (inherited from meeting, which may have been null)
  3. Low-value noise tasks (scheduling calls, sending invites, etc.)

Also optionally runs AI-powered description improvement to make tasks
more actionable.

The script marks low-value tasks with status='filtered' (not deleted)
so they can be reviewed and restored if needed.

Usage:
  cd backend
  .venv/bin/python src/scripts/backfill_tasks_quality.py
  .venv/bin/python src/scripts/backfill_tasks_quality.py --dry-run
  .venv/bin/python src/scripts/backfill_tasks_quality.py --days 30
  .venv/bin/python src/scripts/backfill_tasks_quality.py --days 7 --project-id 31
  .venv/bin/python src/scripts/backfill_tasks_quality.py --all  # all time, not just recent
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from backend.src.services.supabase_helpers import get_supabase_client

# ---------------------------------------------------------------------------
# Low-value task patterns — these tasks will be marked status='filtered'
# ---------------------------------------------------------------------------
_LOW_VALUE_RE = re.compile(
    r"""
    schedule\s+(a\s+)?(follow.?up|meeting|call|sync|standup|check.in)|
    send\s+(a\s+)?(meeting|calendar)\s+(invite|request|link|notification)|
    set\s+up\s+(a\s+)?(meeting|call|sync|zoom|teams\s+meeting)|
    find\s+a\s+time\s+(to\s+(meet|talk|connect|discuss))?|
    book\s+(a\s+)?(meeting|call|room|conference)|
    create\s+(a\s+)?calendar\s+(event|invite|block)|
    send\s+meeting\s+(request|invite|link)|
    add\s+(it\s+)?to\s+(the\s+)?(calendar|agenda)|
    block\s+(time|calendar)\s+for
    """,
    re.IGNORECASE | re.VERBOSE,
)


def is_low_value_task(description: str) -> bool:
    return bool(_LOW_VALUE_RE.search(description or ""))


# ---------------------------------------------------------------------------
# Email lookup builder
# ---------------------------------------------------------------------------

def _email_prefix(email: str) -> str:
    return email.split("@")[0].lower()


def _is_real_email(email: str) -> bool:
    """Return True if the email is a real address (not a placeholder)."""
    if not email or "@" not in email:
        return False
    if "example.com" in email:
        return False
    if "test." in email.lower() or "playwright" in email.lower():
        return False
    return True


def build_global_email_lookup(client) -> Dict[str, str]:
    """Build name → email mapping from all Fireflies meeting attendee data.

    Strategy:
    - Collect all real emails from participants_array across all meetings
    - Cross-reference with speakers column (which has display names)
    - Map using Alleato's email convention: {first_initial}{last_name}@alleatogroup.com

    Returns a dict keyed by lowercase name variants:
      "brandon clymer" → "bclymer@alleatogroup.com"
      "brandon"        → "bclymer@alleatogroup.com"
      "clymer"         → "bclymer@alleatogroup.com"
      "bclymer"        → "bclymer@alleatogroup.com"
    """
    resp = (
        client.table("document_metadata")
        .select("participants_array, speakers")
        .eq("source", "fireflies")
        .execute()
    )

    name_to_email: Dict[str, str] = {}
    prefix_to_email: Dict[str, str] = {}

    # First pass: collect all real email prefixes
    for row in resp.data or []:
        participants = row.get("participants_array") or []
        for email in participants:
            if isinstance(email, str) and _is_real_email(email):
                prefix = _email_prefix(email)
                prefix_to_email[prefix] = email
                # Also store the prefix itself as a name key
                name_to_email[prefix] = email

    # Second pass: match speaker display names to emails
    for row in resp.data or []:
        participants = row.get("participants_array") or []
        speakers = row.get("speakers") or []
        if not isinstance(speakers, list):
            continue

        # Build per-meeting prefix→email
        meeting_prefixes: Dict[str, str] = {}
        for email in participants:
            if isinstance(email, str) and _is_real_email(email):
                meeting_prefixes[_email_prefix(email)] = email

        for speaker in speakers:
            if not isinstance(speaker, dict):
                continue
            name = (speaker.get("name") or "").strip()
            if not name or len(name) < 2:
                continue

            parts = name.lower().split()
            if not parts:
                continue

            # Try {first_initial}{last_name} convention
            for prefix_map in (meeting_prefixes, prefix_to_email):
                candidate = parts[0][0] + parts[-1]
                if candidate in prefix_map:
                    email = prefix_map[candidate]
                    # Register all useful name variants
                    full_lower = name.lower()
                    name_to_email[full_lower] = email
                    name_to_email[parts[0]] = email       # first name only
                    name_to_email[parts[-1]] = email       # last name only
                    name_to_email[candidate] = email       # bclymer-style
                    # Also register titlecased variants
                    name_to_email[name.title().lower()] = email
                    break

    logger.info("Built email lookup: %d name entries from %d meetings", len(name_to_email), len(resp.data or []))
    return name_to_email


# ---------------------------------------------------------------------------
# Assignee email resolution
# ---------------------------------------------------------------------------

def resolve_email(
    assignee_name: Optional[str],
    assignee_email: Optional[str],
    email_lookup: Dict[str, str],
) -> Optional[str]:
    """Try to resolve a real email for an assignee.

    - If the current email is real, return it unchanged.
    - If it's a placeholder (example.com) or missing, try the lookup.
    - Returns None if we can't resolve (better than keeping a fake email).
    """
    if assignee_email and _is_real_email(assignee_email):
        return assignee_email  # Already good

    if not assignee_name:
        return None

    name_lower = assignee_name.lower().strip()

    # Direct lookup
    if name_lower in email_lookup:
        return email_lookup[name_lower]

    # Try first word (first name)
    parts = name_lower.split()
    if parts and parts[0] in email_lookup:
        return email_lookup[parts[0]]

    # Try last word (last name)
    if len(parts) > 1 and parts[-1] in email_lookup:
        return email_lookup[parts[-1]]

    # For @example.com, return None (it's fake — don't keep it)
    if assignee_email and "example.com" in assignee_email:
        return None

    return assignee_email  # Return original if unknown


# ---------------------------------------------------------------------------
# AI filtering
# ---------------------------------------------------------------------------

def _ai_filter_batch(
    tasks: List[dict],
    meeting_title: str,
    summary: str,
    openai_client,
) -> List[dict]:
    """Use AI to filter and improve a batch of tasks."""
    if not tasks:
        return tasks

    task_list = "\n".join(
        f"{i + 1}. [{t.get('assignee_name') or 'Unassigned'}] {t['description']}"
        for i, t in enumerate(tasks)
    )

    prompt = f"""You are reviewing action items extracted from a construction/real-estate project management meeting.

Meeting: {meeting_title}
Summary: {summary[:400] if summary else 'Not available'}

Action items:
{task_list}

For each action item, return a JSON object with:
- "keep": true if this is a real actionable task, false if it should be filtered out
- "description": improved version of the task description (only if keep=true)

FILTER OUT (keep=false):
- Scheduling a meeting, call, or sync (e.g. "schedule a follow-up", "find a time to meet")
- Sending calendar invites or meeting requests
- Generic "follow up" with no specific deliverable
- Purely administrative/logistical minutiae (ordering office supplies, etc.)
- Duplicate tasks that say the same thing as another item

KEEP (keep=true):
- Tasks with a real deliverable or artifact (document, drawing, design, report)
- Technical or construction tasks
- Coordination with a specific outcome (e.g., "coordinate with GC to get material samples")
- Decisions to make or information to gather
- Anything involving money, contracts, or deadlines

For kept items, improve the description only if it's vague — make it more specific and actionable. Don't change the meaning.

Return ONLY a JSON array with one object per item in the same order, like:
[{{"keep": true, "description": "..."}}, {{"keep": false, "description": ""}}]"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=2000,
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)

        results = json.loads(raw)
        if isinstance(results, dict):
            # Wrapped format: {"items": [...]}
            results = next(iter(results.values())) if results else []

        if not isinstance(results, list):
            return tasks

        filtered: List[dict] = []
        for i, result in enumerate(results):
            if i >= len(tasks):
                break
            if not isinstance(result, dict) or not result.get("keep", True):
                continue
            task = tasks[i].copy()
            improved = (result.get("description") or "").strip()
            if improved and improved != task["description"]:
                task["_improved_description"] = improved
            filtered.append(task)

        return filtered

    except Exception as exc:
        logger.warning("AI filtering failed: %s", exc)
        return tasks


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

def run(
    days: Optional[int] = 14,
    dry_run: bool = False,
    all_time: bool = False,
    project_id: Optional[int] = None,
    skip_ai: bool = False,
) -> None:
    client = get_supabase_client()

    openai_client = None
    if not skip_ai:
        try:
            from openai import OpenAI  # type: ignore
            api_key = os.environ.get("OPENAI_API_KEY")
            if api_key:
                openai_client = OpenAI(api_key=api_key)
                logger.info("AI filtering enabled (gpt-4.1-mini)")
            else:
                logger.warning("OPENAI_API_KEY not set — skipping AI filtering")
        except ImportError:
            logger.warning("openai package not installed — skipping AI filtering")

    # Build global email lookup
    email_lookup = build_global_email_lookup(client)

    # Fetch meetings
    query = (
        client.table("document_metadata")
        .select("id, title, date, project_id, summary, participants_array")
        .eq("source", "fireflies")
        .order("date", desc=True)
    )
    if not all_time and days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        query = query.gte("date", cutoff)
    if project_id:
        query = query.eq("project_id", project_id)

    meetings = query.execute().data or []
    logger.info("Found %d meetings to process", len(meetings))

    total_meetings = len(meetings)
    total_tasks = 0
    total_email_fixed = 0
    total_project_fixed = 0
    total_filtered = 0
    total_improved = 0

    for i, meeting in enumerate(meetings, 1):
        mid = meeting["id"]
        title = meeting.get("title") or mid
        effective_project_id = meeting.get("project_id") or project_id

        # Get tasks for this meeting
        tasks_resp = (
            client.table("tasks")
            .select("id, description, assignee_name, assignee_email, project_id, status")
            .eq("metadata_id", mid)
            .eq("source_system", "fireflies")
            .neq("status", "cancelled")  # Skip already-cancelled (filtered) tasks
            .execute()
        )
        tasks = tasks_resp.data or []
        if not tasks:
            continue

        total_tasks += len(tasks)
        logger.info("[%d/%d] %s — %d tasks", i, total_meetings, title, len(tasks))

        # Enrich email lookup with this meeting's participants
        for email in (meeting.get("participants_array") or []):
            if isinstance(email, str) and _is_real_email(email):
                prefix = _email_prefix(email)
                email_lookup.setdefault(prefix, email)

        # ---- 1. Fix assignee emails ----
        email_updates: List[Tuple[str, Optional[str]]] = []
        for task in tasks:
            resolved = resolve_email(
                task.get("assignee_name"),
                task.get("assignee_email"),
                email_lookup,
            )
            current = task.get("assignee_email")
            if resolved != current:
                email_updates.append((task["id"], resolved))

        if email_updates:
            if not dry_run:
                for task_id, new_email in email_updates:
                    client.table("tasks").update({"assignee_email": new_email}).eq("id", task_id).execute()
            total_email_fixed += len(email_updates)
            logger.info("  Fixed %d email(s)", len(email_updates))

        # ---- 2. Fix project_id ----
        if effective_project_id:
            tasks_missing_project = [t for t in tasks if not t.get("project_id")]
            if tasks_missing_project:
                if not dry_run:
                    client.table("tasks").update(
                        {"project_id": effective_project_id, "project_ids": [effective_project_id]}
                    ).eq("metadata_id", mid).is_("project_id", "null").execute()
                total_project_fixed += len(tasks_missing_project)
                logger.info("  Fixed project_id=%d for %d task(s)", effective_project_id, len(tasks_missing_project))

        # ---- 3. AI filtering ----
        if openai_client:
            kept = _ai_filter_batch(
                tasks,
                meeting_title=title,
                summary=meeting.get("summary") or "",
                openai_client=openai_client,
            )
            kept_ids = {t["id"] for t in kept}
            filtered_ids = [t["id"] for t in tasks if t["id"] not in kept_ids]

            if filtered_ids:
                if not dry_run:
                    client.table("tasks").update({"status": "cancelled"}).in_("id", filtered_ids).execute()
                total_filtered += len(filtered_ids)
                if dry_run:
                    for tid in filtered_ids:
                        orig = next(t for t in tasks if t["id"] == tid)
                        logger.info("  [DRY RUN] Would filter: %s", orig["description"][:80])
                else:
                    logger.info("  Filtered %d low-value task(s)", len(filtered_ids))

            # Apply improved descriptions
            for task in kept:
                improved = task.get("_improved_description")
                if improved:
                    if not dry_run:
                        try:
                            client.table("tasks").update({"description": improved}).eq("id", task["id"]).execute()
                            total_improved += 1
                        except Exception:
                            pass  # Skip if description conflicts with existing unique constraint
                    else:
                        total_improved += 1

        # Gentle rate limiting to avoid hammering the API
        if i % 10 == 0:
            time.sleep(0.5)

    logger.info(
        "Done. meetings=%d  tasks_reviewed=%d  emails_fixed=%d  "
        "projects_fixed=%d  filtered=%d  descriptions_improved=%d%s",
        total_meetings,
        total_tasks,
        total_email_fixed,
        total_project_fixed,
        total_filtered,
        total_improved,
        "  [DRY RUN — no changes written]" if dry_run else "",
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill task quality: fix emails, project IDs, and filter noise"
    )
    parser.add_argument("--days", type=int, default=14, help="Process meetings from the last N days (default: 14)")
    parser.add_argument("--all", dest="all_time", action="store_true", help="Process all meetings, not just recent")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    parser.add_argument("--project-id", type=int, default=None, help="Restrict to a specific project")
    parser.add_argument("--skip-ai", action="store_true", help="Skip AI filtering (only fix emails/project IDs)")
    args = parser.parse_args()

    run(
        days=args.days,
        dry_run=args.dry_run,
        all_time=args.all_time,
        project_id=args.project_id,
        skip_ai=args.skip_ai,
    )


if __name__ == "__main__":
    main()
