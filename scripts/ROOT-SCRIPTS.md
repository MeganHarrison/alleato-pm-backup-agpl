# Root Scripts Inventory

Status: Active inventory
Owner: Ops/dev tooling
Last updated: 2026-06-22

Root-level files under `scripts/` are legacy entry points. New scripts should go
under an owner folder (`scripts/verify/`, `scripts/ops/`, `scripts/db/`,
`scripts/ingestion/`, etc.) unless there is a specific reason to keep a root
entry point.

Status meanings:

| Status | Meaning |
| --- | --- |
| `package-owned` | Called by root `package.json`; live until package script changes. |
| `live-guardrail` | Used as a guard/check, even if not currently package-owned. |
| `live-operator` | Manual operational script that may still be useful. |
| `migration-helper` | Database or storage migration helper; inspect before reuse. |
| `backfill-helper` | One-off/backfill helper; do not run without fresh owner review. |
| `import-helper` | Historical import helper; candidate for archive after reference check. |
| `test-helper` | Old ad hoc test/check script; candidate to move under tests/verify. |
| `reference` | Data/config/reference, not executable runtime. |
| `config` | Tool config. |

## Package-Owned Root Scripts

These are directly referenced by root `package.json`.

| File | Status | Package script owner |
| --- | --- | --- |
| `api-smoke-contracts.mjs` | package-owned | `verify:api:contracts` |
| `audit-toast-surface.mjs` | package-owned | `audit:toasts`, `guardrails:toasts:changed` |
| `backfill-brandon-tasks.mjs` | package-owned | `tasks:extract-brandon*` |
| `backfill-fireflies-transcript-chunks-from-storage.mjs` | package-owned | `rag:backfill:fireflies-transcript-chunks` |
| `backfill-recent-meeting-chunks.mjs` | package-owned | `rag:backfill:meeting-chunks` |
| `build-playwright-dashboard.cjs` | package-owned | `dashboard:playwright*` |
| `cache-monitor.ts` | package-owned | `cache:*` |
| `check-changed-route-guardrails.mjs` | package-owned | `verify:*route-guardrails`, `test:route-guardrails` |
| `check-db-types-current.mjs` | package-owned | `db:types:check` |
| `check-estimate-template-contract.mjs` | package-owned | `verify:estimate-template-contract` |
| `check-route-conflicts.sh` | package-owned | `check:routes` |
| `generate-playwright-skill-prompt.cjs` | package-owned | `gen:playwright-prompt` |
| `generate-playwright-skill-prompts-batch.cjs` | package-owned | `gen:playwright-prompt:all` |
| `postdeploy-verify.sh` | package-owned | `verify:postdeploy` |
| `predeploy-quality-gate.sh` | package-owned | `quality:predeploy` |
| `validate-runtime-config.mjs` | package-owned | `validate:runtime-config` |
| `verify-cache-setup.ts` | package-owned | `cache:verify` |

## Guardrails And Quality Checks

| File | Status | Notes |
| --- | --- | --- |
| `api-smoke-test-cron.sh` | live-operator | Legacy cron smoke-test wrapper. |
| `api-smoke-test.sh` | live-operator | Legacy API smoke-test wrapper. |
| `check-design-system.sh` | live-guardrail | Design-system check wrapper. |
| `check-kb-markers.ts` | live-guardrail | Knowledge-base marker check. |
| `check-no-module-level-server-init.mjs` | live-guardrail | Server-init guard; currently modified by prior cleanup work. |
| `check-no-new-any.mjs` | live-guardrail | TypeScript quality guard. |
| `check-no-new-unsafe-patterns.mjs` | live-guardrail | Unsafe-pattern guard. |
| `check-server-prerender-safety.mjs` | live-guardrail | Next.js server prerender safety guard. |
| `check-zod-coverage.mjs` | live-guardrail | Zod coverage check. |
| `fix-md040.mjs` | live-operator | Markdown code-fence cleanup helper. |
| `migrate-to-guardrails.mjs` | live-operator | Guardrail migration helper; currently modified by prior cleanup work. |
| `parity-audit.mjs` | live-guardrail | Parity audit helper. |
| `validate-markdown-location.cjs` | live-guardrail | Markdown location guard. |
| `verify-api-routes.sh` | live-guardrail | API route verification wrapper; currently modified by prior cleanup work. |
| `verify-phase1-fixes.sh` | live-guardrail | Phase-one verification wrapper. |
| `wait-for-http.js` | live-operator | Utility used by scripts needing HTTP readiness. |

## Database, Migration, And Provider Helpers

| File | Status | Notes |
| --- | --- | --- |
| `db-push.sh` | migration-helper | Legacy DB push wrapper. |
| `set-admin.mjs` | live-operator | Admin setup helper. |

## AI, RAG, Source, And Communication Helpers

| File | Status | Notes |
| --- | --- | --- |
| `audit-council-data-coverage.ts` | live-operator | AI council coverage audit. |
| `audit-pattern-c-attachments.mjs` | live-operator | Attachment migration audit. |
| `cache-example.ts` | reference | Cache usage example. |
| `cache-monitor.ts` | package-owned | Cache monitor CLI. |
| `claude-cache-helper.ts` | live-operator | Claude cache helper. |
| `crawl-procore-docs.py` | live-operator | Procore docs crawl helper. |
| `crawl-procore-support-docs.mjs` | live-operator | Procore support crawl helper. |
| `fix-teams-attribution.py` | backfill-helper | Teams attribution repair. |
| `generate-daily-brief.mts` | live-operator | Daily brief generation helper. |
| `procore-docs-query.js` | live-operator | Procore docs query helper. |
| `run-ap-sync.mjs` | live-operator | AP sync runner. |
| `run-enrichment.mjs` | live-operator | Enrichment runner. |
| `send-teams-proactive.mjs` | live-operator | Teams proactive message helper. |

## Financial, Acumatica, Job, And Historical Import Helpers

| File | Status | Notes |
| --- | --- | --- |
| `design-review-financial.ts` | live-operator | Financial design review helper. |
| `inspect-acumatica-invoice.mjs` | live-operator | Acumatica invoice inspection helper. |
| `inspect-acumatica-vendor.mjs` | live-operator | Acumatica vendor inspection helper. |
| `noblesville-company-lookup.txt` | reference | Historical company lookup data. |
| `project-acumatica-change-orders.py` | live-operator | Acumatica change order project helper. |
| `project-acumatica-commitments.py` | live-operator | Acumatica commitments project helper. |
| `sync-acumatica-invoices.mjs` | live-operator | Acumatica invoice sync helper. |
| `sync-acumatica-payments.mjs` | live-operator | Acumatica payment sync helper. |
| `sync-acumatica-vendors.mjs` | live-operator | Acumatica vendor sync helper. |

## Config, Setup, And Miscellaneous

| File | Status | Notes |
| --- | --- | --- |
| `.mcp.json` | config | Script-local MCP config. |
| `README.md` | config | Scripts source-of-truth document. |
| `ROOT-SCRIPTS.md` | config | This inventory. |
| `design-token-codemod.js` | live-operator | Design token codemod. |
| `guardrail-route-debt-baseline.txt` | reference | Route guardrail baseline. |
| `init.sh` | live-operator | Repository initialization helper. |
| `package.json` | config | Script-local package manifest. |

## Deletion Policy

Do not add more root-level scripts by default. For new tooling:

1. Put it in the owning folder.
2. Add or update a package script if it is meant to be a supported command.
3. Update this inventory only if a root-level entry point is unavoidable.

Candidates for future archive/delete passes are `backfill-helper`,
`import-helper`, and `test-helper` entries that are not referenced by package
scripts, docs, current task ledgers, or active provider recovery runbooks.

Deleted unsafe/stale migration helpers:

- `apply-budget-migration.mjs`
- `apply-migration-pg.js`
- `apply-migration.js`
- `apply-permissions-fix.js`
- `apply-permissions-fix.mjs`
- `apply-storage-rls-migration.sh`
- `create-drawing-tables.js`
- `fix-mcp-and-create-tables.js`

## Deleted Root Helpers

One-off root helpers (backfills, imports, ad-hoc tests) were **deleted** on
2026-06-23 — git history is the archive. Recover any of them with
`git log --all --diff-filter=D -- scripts/archive/2026-06-22-root-helpers/`.
A pre-commit guard now blocks re-introducing `archive/` folders or
`.bak/.old/.orig` files under `scripts/` and `backend/`.
