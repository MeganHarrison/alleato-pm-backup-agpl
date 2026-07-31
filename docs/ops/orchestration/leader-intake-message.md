# Leader Intake Message (Paste To Each Worker)

Paste this into each active worker session:

```text
Leader intake check. Do not reply in chat.
Update your existing handoff file only.

Add exactly these sections:
1) Session ID
2) Task ID
3) Current status: In Progress | Pending Review | Blocked
4) Files changed (absolute paths)
5) Commands run and outcome (pass/fail counts)
6) Evidence artifacts (screenshot/video/report/log paths)
7) Top 3 findings (frontend-visible issues first)
8) Recommended next action (one line)
9) Handoff file path

If any section is missing, your handoff will be marked Needs Rework.
Do not start new work until disposition is Accepted.
```
