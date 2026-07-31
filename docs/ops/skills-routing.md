# Alleato Skills Routing

Date: 2026-07-06

Purpose: give future Codex and Claude sessions one practical routing map for choosing skills in this repo. This is the operational companion to `docs/ops/reports/2026-07-06-skills-access-audit.md`.

## Precedence

Use skills in this order:

1. `AGENTS.md`, repo docs, current user instructions, and task files.
2. A skill explicitly named by the user, after verifying its exact `name:` and `SKILL.md` path.
3. Repo-local Alleato skills under `.codex/skills`, `.agents/skills`, and `.claude/skills`.
4. User-global skills under `~/.codex/skills`, `~/.agents/skills`, or `~/.claude/skills`.
5. Plugin-provided skills and MCP/app tools.

If a generic user-global skill conflicts with an Alleato-specific skill, the Alleato-specific skill wins.

## Canonical Routes

| Work type | Start with | Then use when needed |
| --- | --- | --- |
| New implementation, bug fix, audit finding, or verification-only task | `.codex/skills/qa-task` | `.claude/skills/verify-feature`, `.codex/skills/agent-browser`, domain-specific skills, and the verification contract |
| Frontend page or component design | `.agents/skills/impeccable` | `.codex/skills/frontend-conversation-feedback` for conversation-derived rules, `.codex/skills/frontend-responsive-design-standards`, `.claude/skills/building-components`, `.agents/skills/alleato-design-doctrine` only as a legacy alias or reference-pack loader |
| Table/list page work | `.claude/skills/alleato-table-page` | `.codex/skills/verify-feature`, `.claude/skills/testing/agent-browser` |
| User-visible feature verification | `.claude/skills/verify-feature` | `.claude/skills/testing/agent-browser`, `.codex/skills/e2e-test`, `.codex/skills/smoke-test` |
| Procore behavior or parity | `.claude/skills/procore-verify` | `.claude/skills/procore-test-matrix`, `.codex/skills/procore-docs-rag`, `.codex/skills/parity-audit` |
| Form dropdown or FK mismatch | `.claude/skills/fk-audit` | Supabase generated types and route/browser proof |
| RAG strategy or implementation | `.codex/skills/alleato-rag-implementation` | `.agents/skills/rag-implementation`, `.codex/skills/rag-strategy-council`, `.codex/skills/rag-stats`, `.codex/skills/procore-docs-rag` |
| Deep agent/backend orchestration | `.agents/skills/deep-agents-core` | `.agents/skills/deep-agents-orchestration`, `.agents/skills/deep-agents-backend-module`, `.agents/skills/deep-agents-memory` |
| AI SDK implementation | `~/.agents/skills/ai-sdk` | `~/.agents/skills/ai-elements`, repo AI/RAG skills if the task touches Alleato retrieval |
| Evaluation or tracing | `.agents/skills/langsmith-evaluator` | `.agents/skills/langsmith-dataset`, `.agents/skills/langsmith-trace` |
| BMAD planning, story, or review | `.codex/skills/bmad-*` matching the named workflow | `_bmad/` agent/workflow files referenced by `AGENTS.md` |
| PRP execution or quality | `.codex/skills/prp-execute` | `.codex/skills/prp-quality` |
| Repeatable docs or SOP capture | `.codex/skills/repeatable-training-docs` | `.agents/skills/web-research` only when live external research is required |

## Design Rule

For Alleato UI work, `impeccable` is the single primary design/noise-control entrypoint. It must load the Alleato doctrine overlay and product noise gate for Alleato product-register work. `alleato-design-doctrine` is no longer a competing front door; it is a compatibility alias plus reference-pack loader. Generic design skills are implementation references only.

For frontend work that is responding to user comments in Codex or Claude, consult the repo-local conversation feedback ledger before implementation or audit work:

```bash
node scripts/ops/frontend-feedback-ledger.mjs lookup --text "<request>" --files <owned-paths>
node scripts/ops/frontend-feedback-ledger.mjs validate
```

## Testing Rule

For "make it work" requests, use user-flow verification first. `agent-browser` is the browser automation primitive, not the testing strategy by itself. `verify-feature` owns the evidence standard; `e2e-test`, `smoke-test`, Procore skills, and BMAD/TEA testing skills add regression depth after the user flow is understood.

## Discovery Guardrail

Before invoking a skill by inferred name:

- verify the exact `name:` field,
- verify the `SKILL.md` path resolves,
- check whether it is a real directory or a symlink,
- prefer repo-local Alleato skills over global duplicates,
- and say plainly when a plausible skill name is not installed.

Run this quick broken-link check when slash/menu discovery looks wrong:

```bash
find .codex/skills .agents/skills .claude/skills ~/.codex/skills ~/.agents/skills ~/.claude/skills \
  -type l ! -exec test -e {} \; -print 2>/dev/null
```
