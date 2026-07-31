#!/usr/bin/env python3
"""
verify-feature-gate.py — Hook for verify-feature skill enforcement.

THREE gates, all fail-closed (exit 2 with instructions):

GATE 1 — agent-browser blocked unless success-criteria.md exists.
  Phase 2 of the skill requires documenting expected behavior BEFORE
  testing. Without this, divergences get mislabeled as "critical bugs"
  when they're actually correct system behavior (the non-committed-cost
  false positive on 2026-04-06 was caused by this).

GATE 2 — Writing/editing report.md in verify-output/ blocked unless
  videos/ contains at least one .webm recording.
  The skill requires per-flow video evidence in Phase 4. Reports without
  video evidence cannot be reviewed by the user, and the pattern of
  "wrote a report, no evidence to back it up" repeated across two
  consecutive verification runs.

GATE 3 — Writing/editing report.md blocked unless every screenshot in
  the session has been opened with the Read tool.
  Phase 4e says to read result screenshots before claiming a flow
  succeeded. On 2026-04-06 a PCCO conversion screenshot was a giant 404
  page, and I claimed the flow succeeded based only on the URL — never
  looked at the image. The user caught the 404 by re-watching the video.
  Same failure mode as GATE 1 and GATE 2: the artifact existed but the
  cognitive review step was skipped.

  Implementation: a PostToolUse hook records every Read tool call on a
  screenshot path to .viewed-screenshots.txt inside the session dir.
  GATE 3 then checks that every .png in screenshots/ is listed.

The script handles all three gates by routing on tool input keys:
- {"command": ...}     — Bash, GATE 1
- {"file_path": ...}   — Write/Edit (GATE 2 + GATE 3) or Read (record view)
"""
import sys
import json
import os


def find_active_session() -> str | None:
    """Return the most recently modified verify-output/<feature>/ dir, or None."""
    candidate_roots = [
        "verify-output",
        "/Users/meganharrison/Documents/alleato-pm/verify-output",
    ]
    session_dirs: list[str] = []
    for root in candidate_roots:
        if os.path.isdir(root):
            for entry in os.listdir(root):
                full = os.path.join(root, entry)
                if os.path.isdir(full):
                    session_dirs.append(full)
    if not session_dirs:
        return None
    return max(session_dirs, key=os.path.getmtime)


def gate_1_browser_requires_criteria(command: str) -> int:
    """Block agent-browser commands until success-criteria.md exists."""
    if "agent-browser" not in command:
        return 0

    session = find_active_session()
    if not session:
        return 0  # No active session, allow

    criteria_file = os.path.join(session, "success-criteria.md")
    if os.path.exists(criteria_file):
        return 0

    feature = os.path.basename(session.rstrip("/"))
    msg = f"""BLOCKED by verify-feature-gate hook (GATE 1: criteria).

You are running agent-browser inside an active verify-feature session
({feature}), but {criteria_file} does not exist.

Phase 2 of the verify-feature skill REQUIRES you to write down the
expected behavior of every flow and field BEFORE opening the browser.
This is what stops you from labeling correct system behavior as a
"critical bug" because it didn't match your assumption.

To proceed:

1. Write {criteria_file} containing, for each flow and sub-feature:
   - Action: what the user does
   - Expected outcome: specific observable result
   - For each form field: input vs derived/calculated, source of truth,
     whether the field is editable, what the saved DB value should be
   - DB check: SQL that verifies every field
   - Quality bar: what distinguishes pass from fail

2. If you don't know the intended behavior, spawn a research agent to
   document it from the codebase, Procore manifests, or PRPs FIRST.
   Do not guess.

3. Only after the file exists, retry the agent-browser command.

Skipping this step on 2026-04-06 produced false-positive bug reports
about non-committed cost (it's a derived field, not user input) — the
exact failure mode this gate prevents.
"""
    print(msg, file=sys.stderr)
    return 2


def gate_2_report_requires_videos(file_path: str) -> int:
    """Block writing/editing report.md until videos/ contains at least one .webm."""
    if not file_path:
        return 0

    # Only intercept files inside verify-output/<feature>/ named report.md
    abs_path = os.path.abspath(file_path)
    if "verify-output" not in abs_path or not abs_path.endswith("report.md"):
        return 0

    # The session dir is the parent of report.md
    session = os.path.dirname(abs_path)
    videos_dir = os.path.join(session, "videos")

    has_videos = (
        os.path.isdir(videos_dir)
        and any(f.endswith(".webm") for f in os.listdir(videos_dir))
    )
    if has_videos:
        return 0

    feature = os.path.basename(session.rstrip("/"))
    msg = f"""BLOCKED by verify-feature-gate hook (GATE 2: video evidence).

You are about to write {abs_path}, but {videos_dir} contains no .webm
recordings.

Phase 4 of the verify-feature skill REQUIRES per-flow video evidence:

  agent-browser --session <S> record start <session>/videos/<flow>.webm
  ... do the flow at speed using `fill` (not `type`) ...
  agent-browser --session <S> record stop

Reports without video evidence cannot be reviewed by the user, and the
pattern of "wrote a report, no evidence to back it up" repeated across
two consecutive verification runs on this feature ({feature}).

To proceed:

1. Reopen the browser session if needed
2. For each user flow you tested, record a clean run end-to-end:
   - record start videos/<flow-slug>.webm
   - perform the flow with realistic data (use fill, not type)
   - record stop
3. Confirm at least one .webm exists in {videos_dir}
4. Then retry the report write

If a flow can ONLY be exercised via direct API/SQL (e.g., the form is
broken and you had to bypass it), record at least a 5-second video of
the result page proving the outcome — even a static screenshot of the
final state is better than no evidence.
"""
    print(msg, file=sys.stderr)
    return 2


def gate_3_report_requires_screenshot_review(file_path: str) -> int:
    """Block writing/editing report.md until every screenshot has been Read'd."""
    if not file_path:
        return 0

    abs_path = os.path.abspath(file_path)
    if "verify-output" not in abs_path or not abs_path.endswith("report.md"):
        return 0

    session = os.path.dirname(abs_path)
    screenshots_dir = os.path.join(session, "screenshots")

    if not os.path.isdir(screenshots_dir):
        return 0  # No screenshots to review

    # Find all PNG screenshots
    all_screenshots = sorted(
        f for f in os.listdir(screenshots_dir) if f.lower().endswith(".png")
    )
    if not all_screenshots:
        return 0  # No screenshots — nothing to review

    # Load the viewed-screenshots log
    viewed_log = os.path.join(session, ".viewed-screenshots.txt")
    viewed: set[str] = set()
    if os.path.exists(viewed_log):
        with open(viewed_log, "r") as f:
            viewed = {line.strip() for line in f if line.strip()}

    # Find unreviewed screenshots
    unreviewed = [s for s in all_screenshots if s not in viewed]
    if not unreviewed:
        return 0

    feature = os.path.basename(session.rstrip("/"))
    listing = "\n".join(
        f"  Read: {os.path.join(screenshots_dir, s)}" for s in unreviewed[:20]
    )
    extra = f"\n  ... and {len(unreviewed) - 20} more" if len(unreviewed) > 20 else ""

    msg = f"""BLOCKED by verify-feature-gate hook (GATE 3: screenshot review).

You are about to write {abs_path}, but {len(unreviewed)} screenshot(s) in
{screenshots_dir} have NOT been opened with the Read tool yet.

Phase 4e of the verify-feature skill REQUIRES reading every result
screenshot before claiming a flow succeeded. On 2026-04-06 a PCCO
conversion screenshot was a giant 404 page, and the verification report
claimed the flow succeeded — based only on the URL string and the API
response code. The user caught the 404 by re-watching the video.

A screenshot exists, but the screenshot wasn't reviewed = same failure
class as a missing screenshot. The Read tool actually loads the image
into your conversation context so you can see it. Saving it to disk
without reading it does not count.

Unreviewed screenshots ({len(unreviewed)}):

{listing}{extra}

To proceed:

1. Use the Read tool on each unreviewed screenshot listed above
2. For each one, look at what's actually in the image — does it match
   what you claim happened in that flow? Is it the right page? Are there
   error messages, 404s, validation failures that contradict your story?
3. If anything contradicts your draft report, go fix the report (or the
   underlying code) before continuing
4. Then retry the report write

If you have screenshots from exploration that aren't relevant to any
finding, delete them from {screenshots_dir} — only keep evidence you
actually need to defend.
"""
    print(msg, file=sys.stderr)
    return 2


def record_screenshot_view(file_path: str) -> int:
    """PostToolUse: when Read is called on a screenshot in verify-output, log it."""
    if not file_path:
        return 0

    abs_path = os.path.abspath(file_path)
    if "verify-output" not in abs_path or not abs_path.lower().endswith(".png"):
        return 0
    if "screenshots" not in abs_path:
        return 0

    # screenshots/ is one level under the session dir
    screenshots_dir = os.path.dirname(abs_path)
    session = os.path.dirname(screenshots_dir)
    if os.path.basename(screenshots_dir) != "screenshots":
        return 0

    viewed_log = os.path.join(session, ".viewed-screenshots.txt")
    filename = os.path.basename(abs_path)

    # Read existing entries to avoid duplicates
    existing: set[str] = set()
    if os.path.exists(viewed_log):
        with open(viewed_log, "r") as f:
            existing = {line.strip() for line in f if line.strip()}

    if filename not in existing:
        with open(viewed_log, "a") as f:
            f.write(filename + "\n")

    return 0


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    # Hook event type — passed via env var by Claude Code
    hook_event = os.environ.get("CLAUDE_HOOK_EVENT", "")
    tool_name = data.get("tool_name", "") or os.environ.get("CLAUDE_TOOL_NAME", "")

    # Bash tool: check command for agent-browser (GATE 1)
    if "command" in data:
        return gate_1_browser_requires_criteria(data.get("command", ""))

    # Read/Write/Edit tool: file_path key
    if "file_path" in data:
        file_path = data.get("file_path", "")

        # PostToolUse on Read: record the view (regardless of tool name detection)
        # We detect this by checking if the file is being written or read.
        # PreToolUse fires BEFORE the tool runs; PostToolUse fires AFTER.
        # For Read tool, we want to record on PostToolUse so the file was
        # actually loaded. The hook event env var tells us which.
        if hook_event == "PostToolUse":
            return record_screenshot_view(file_path)

        # PreToolUse on Write/Edit: enforce GATE 2 then GATE 3
        # (only enforce on report.md; other writes pass through)
        gate_2_result = gate_2_report_requires_videos(file_path)
        if gate_2_result != 0:
            return gate_2_result
        return gate_3_report_requires_screenshot_review(file_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
