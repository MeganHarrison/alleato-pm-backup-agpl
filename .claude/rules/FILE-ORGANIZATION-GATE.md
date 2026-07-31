# File Organization Gate

**Trigger:** Before creating ANY file in this repository.

## Root Directory — Allowed Files ONLY

The project root may ONLY contain these markdown files:
- `README.md`
- `CLAUDE.md`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `WORKING_CONTEXT.md`
- `DESIGN.md` (design system — real file at root, single source of truth)
- `CHANGELOG.md`
- `LICENSE` / `LICENSE.md`

**Everything else goes in the correct subdirectory:**

| File Type | Required Location |
|-----------|------------------|
| Documentation (.md) | `docs/` (with appropriate subdirectory) |
| Scripts (.js, .ts, .py, .sh) | `scripts/` (with subdirectories) |
| Claude rules | `.claude/rules/` |
| SQL migrations | `supabase/migrations/` |
| Frontend code | `frontend/src/` |
| PRPs | `docs/PRPs/<domain>/` |
| Reports/audits | `docs/reports/` |
| Roadmap docs | `docs/roadmap/` |
| Design docs | `docs/design/` |

## Enforced By

A **Husky pre-commit hook** blocks commits that add `.md`, `.js`, `.ts`, `.py`, `.sh`, or `.html` files to the project root (unless they're on the allowed list above).

## NEVER

- Create implementation notes, task lists, or scratch files at the project root
- Create `.js`, `.ts`, `.py`, or `.sh` files at the project root
- Create temporary HTML files at the project root
- Save verification output at the project root (use `verify-output/` which is gitignored)

## ALWAYS

- Check `docs/` for an appropriate subdirectory before creating documentation
- Use `scripts/` for any executable scripts
- Keep the root clean — it should only have config files and the standard markdown files listed above
