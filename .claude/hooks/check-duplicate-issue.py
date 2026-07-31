#!/usr/bin/env python3
"""
PreToolUse hook: blocks Claude from acting on GitHub issues labeled 'duplicate'.

Fires on every Bash tool call. If the command references a gh issue command
with an issue number, fetches the current labels from GitHub and exits 2
(blocking) if the issue is labeled 'duplicate'.
"""

import json
import os
import re
import subprocess
import sys


def main() -> None:
    tool_input = os.environ.get("TOOL_INPUT", "")
    if not tool_input:
        sys.exit(0)

    try:
        data = json.loads(tool_input)
        command = data.get("command", "")
    except (json.JSONDecodeError, AttributeError):
        sys.exit(0)

    # Only intercept gh issue commands
    if "gh" not in command or "issue" not in command:
        sys.exit(0)

    # Match patterns like: gh issue view 123, gh issue edit #45, gh issue close 7
    match = re.search(r"gh\s+issue\s+\w+\s+#?(\d+)", command)
    if not match:
        sys.exit(0)

    issue_number = match.group(1)

    try:
        result = subprocess.run(
            ["gh", "issue", "view", issue_number, "--json", "labels,state,title"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        # gh CLI not available or timed out — allow through
        sys.exit(0)

    if result.returncode != 0:
        sys.exit(0)

    try:
        issue_data = json.loads(result.stdout)
    except json.JSONDecodeError:
        sys.exit(0)

    labels = [label["name"].lower() for label in issue_data.get("labels", [])]
    title = issue_data.get("title", f"#{issue_number}")

    if "duplicate" in labels:
        print(
            f"\n\u26d4  BLOCKED — Issue #{issue_number} is labeled 'duplicate'.\n"
            f"   Title: {title}\n"
            f"\n"
            f"   This issue was identified as a duplicate of an existing issue.\n"
            f"   Do NOT implement work for this issue.\n"
            f"   Find the original issue and work there instead, or ask the user\n"
            f"   which issue to proceed with.\n",
            file=sys.stderr,
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
