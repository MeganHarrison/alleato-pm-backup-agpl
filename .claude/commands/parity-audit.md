---
description: Run Procore parity audit across one or more tools (agent-driven)
argument-hint: <tool-name|all> [priority=HIGH]
---

Invoke the `parity-audit` skill with arguments: $ARGUMENTS

Follow `.claude/skills/parity-audit/SKILL.md` exactly — in particular the status
convention (`pass` / `fail` / `skip+MISSING:` / `skip+BLOCKED:`) and the per-tool
parallel sub-agent dispatch.
