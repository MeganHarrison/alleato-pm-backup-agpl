# Task: Financial Table FK Inventory

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: Blocked - Linear issue creation tool unavailable in this session; only comment/list tools were exposed.
Related Handoff: None

## Objective

Create a repo-truth markdown inventory of financial database tables, what each table controls, and the foreign-key fields that define its data ownership and rollup relationships.

## Non-Negotiable Done Rule

This task is not done until the financial table document is written from schema and code evidence, reviewed for the commitment SOV budget-code integrity gap, and evidence is recorded below.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before writing the architecture document.
- [x] Identify financial tables from schema, existing financial docs, and actual code references.
- [x] Document each table's role and FK fields.
- [x] Call out text-backed financial references and integrity risks separately.
- [x] Add evidence and remaining gaps.

## Verification Checklist

- [x] Schema extraction reviewed from `supabase/migrations/schema_dump.sql`.
- [x] Existing financial docs reviewed.
- [x] Code references sampled for key write/read paths.
- [x] Final markdown reviewed for completeness and useful ordering.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| Task template lookup | Partial | `docs/ops/tasks/TASK-TEMPLATE.md` does not exist in this checkout; followed active task structure instead. |
| Linear issue creation | Blocked | `tool_search` exposed Linear comment/list tools but no issue creation tool. |
| Existing financial map | Pass | Reviewed `docs/architecture/FINANCIAL-TOOLS-DATA-MAP.md`; it was older and tool-focused, not table/FK-complete. |
| Schema/FK extraction | Pass | Used `frontend/src/types/database.types.ts` as current generated type/FK baseline and `supabase/migrations/schema_dump.sql` for historical constraint context. |
| Generated DB inventory | Pass | Used `frontend/src/components/dev-tools/db-inventory.generated.json` for table purpose/dormancy notes; noted generated timestamp in final document. |
| Deliverable | Pass | Created `docs/architecture/FINANCIAL-TABLE-FK-INVENTORY.md`. |

## Final Status

- [x] Document created.
- [x] Evidence recorded.
- [x] Remaining risks and next steps called out.
