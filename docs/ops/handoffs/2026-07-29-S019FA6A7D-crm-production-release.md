# CRM v4 Production Release Handoff

Status: In Progress
Session: S019FA6A7D
Owner: Brandon / Codex
Task: `docs/ops/tasks/2026-07-29-crm-production-release.md`

## Outcome

The local CRM review build has been converted to a production-backed workflow. Production routes now read and write PM APP Supabase through authenticated CRM APIs. Company identity remains in the Company Directory, follow-ups use the existing Tasks system, documents remain linked to their existing records, and won deals create projects through the existing Projects workflow.

## Phase Completion

| Phase | Delivered state |
| --- | --- |
| Foundation | CRM permission module, schema, RLS, audit trails, pipelines, stages, health, and task links applied to PM APP Supabase. |
| Relationships | Company enrollment, ownership, health, manual activity, follow-ups, archive, restore, and company-detail integration. |
| Deals | Deal create/edit, guarded transitions, concurrency versions, won/lost rules, archive/restore, and project-link controls. |
| Operations | Relationship queue, pipeline, deals, activity, matching, settings, daily cron, and failure-loud UI. |
| Communication | Deterministic domain/company matching over eligible ingested Outlook, Teams, and Fireflies metadata with human accept/reject. |
| Conversion | Idempotent project creation and scheduled Acumatica identifier reconciliation without fabricated success. |
| Documentation | Markdown workflow source and rendered Word operator guide. |

## Key Boundaries

- No production CRM page imports `useLocalCrmStore`.
- No mailbox write-back or autonomous messaging is enabled.
- CRM matching excludes private, restricted, and leadership-only source records.
- CRM follow-ups are existing `tasks` records labeled with CRM source metadata.
- A conversion is not marked synchronized until the linked project has an Acumatica identifier.
- No sample relationship data was seeded into production.

## Verification

- PM APP schema and migration ledger read back successfully.
- Live pgTAP contract: 20 passing assertions.
- Focused CRM Jest: 15 passing tests.
- Focused ESLint: passed.
- Auth setup: passed for Brandon.
- Authenticated CRM workspace API: HTTP 200.
- Desktop and mobile screenshot paths are recorded in the task file.
- Independent review and final main/live readback remain completion gates.

## Known Repository Debt

The full bounded TypeScript check reports unrelated diagnostics in existing admin, AI, directory, durable-chat, and communication-tool surfaces. A CRM-path-filtered pass produced no remaining CRM-owned diagnostics after the document-junction and permission-map fixes.

## Publication

Published to `origin/main` in exact-path commits `144dcb9` and `c5acd21`. Vercel deployment `dpl_DDTovtNi8qPuxY3Leqo9YkQpSxs1` reached Ready on the production alias. Authenticated readback confirmed HTTP 200 from `/api/crm/workspace`, the existing Tasks page, the responsive pipeline board, and the corrected empty CRM state.
