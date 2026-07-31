---
name: PRP Execute
description: "Execute a completed PRP to implement a feature with progressive validation"
argument-hint: "<path/to/prp.md>"
---

Run the PRP execute workflow from `.claude/commands/prp/prp-execute.md`.

Use the provided PRP path as `$ARGUMENTS`.

Required process:

1. Read `.claude/commands/prp/prp-execute.md`.
2. Read the PRP file provided in `$ARGUMENTS`.
3. Read companion files next to the PRP if present:
   - `AUDIT.md`
   - `TASKS.md`
   - `TEST-SCENARIOS.md`
   - `VALIDATION-REPORT.md`
4. Follow the implementation and validation process from the PRP execute command.
