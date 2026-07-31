---
description: "Run the form gauntlet: discover, execute, verify (fresh agent), fix loop — for every form in a tool. Loops until 100% pass or retry cap."
argument-hint: "<tool-name> [--project-id <id>] [--max-retries <n>]"
---

# /form-gauntlet — Full Form Test Loop

Invoke the global `form-gauntlet` skill with this project's defaults pre-wired.

## Project Defaults

- **Base URL:** `http://localhost:3000`
- **Test credentials:** `test1@mail.com` / `test12026!!!`
- **Default project ID:** `67` (Vermillion Rise Warehouse)
- **Auth state:** `frontend/tests/.auth/user.json`
- **State output:** `.claude/form-gauntlet/<tool-name>/`

## Usage

```
/form-gauntlet change-events
/form-gauntlet budget --project-id 67
/form-gauntlet prime-contracts --max-retries 5
```

## Available Tools to Test

Any tool under `frontend/src/app/(main)/[projectId]/`:

| Tool | Path |
|------|------|
| `change-events` | /[projectId]/change-events |
| `budget` | /[projectId]/budget |
| `prime-contracts` | /[projectId]/prime-contracts |
| `commitments` | /[projectId]/commitments |
| `direct-costs` | /[projectId]/direct-costs |
| `invoicing` | /[projectId]/invoicing |
| `schedule` | /[projectId]/schedule |
| `home` | /[projectId]/home |

## Pre-flight Checklist

Before running, confirm:
- [ ] Dev server running: `cd frontend && npm run dev`
- [ ] Database accessible (check Supabase connection in `.env`)
- [ ] No pending migrations that would block inserts

## What Runs

1. **Discovery Agent** (Explore) — Scans source code, maps all forms with fields + success criteria
2. **Executor Agent** (general-purpose + agent-browser) — Fills and submits each form
3. **Verifier Agent** (fresh context, general-purpose + agent-browser) — Independently confirms each form worked
4. **Fixer Agent** (debugger) — If verification fails, diagnoses and fixes the root cause
5. **Loop** — Steps 2-4 repeat per form until PASS or retry cap

## Agent Instructions

You are the form gauntlet orchestrator. Follow the `form-gauntlet` skill from `~/.claude/skills/form-gauntlet/SKILL.md`.

Arguments provided: `$ARGUMENTS`

Parse:
- Tool name from first argument
- `--project-id` flag (default: `67`)
- `--max-retries` flag (default: `3`)

Use project defaults above for base URL and credentials.

Begin with Phase 1 (Discovery), then work through each form sequentially.

After all forms complete, print the final report and confirm with: "Form Gauntlet complete. X/Y forms passing."
