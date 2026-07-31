# AAI-1258 Handoff: ASRS Workspace Intake

Status: In Progress
Linear: [AAI-1258](https://linear.app/megankharrison/issue/AAI-1258/make-asrs-intake-the-canonical-workspace-entry)
Owner session: SROOT-ASRS-STATUS

## Scope

Bring the existing ASRS intake and its submitted-result path into the authenticated ASRS workspace without changing estimator or RAG behavior.

## Owned paths

- `frontend/src/app/(main)/asrs/page.tsx`
- `frontend/src/app/(main)/asrs/intake/**`
- `frontend/src/app/(public)/fm-global/form/fm-global-client.tsx`
- `frontend/src/app/(public)/fm-global/form/submitted/[submissionId]/page.tsx`
- `frontend/src/lib/fmds/asrs-workspace.ts`
- this handoff and `docs/ops/tasks/2026-07-22-asrs-workspace-intake.md`

## Evidence

- Writer lease: `SROOT-ASRS-STATUS`, AAI-1258, acquired 2026-07-22.
- Existing canonical form and result owners inspected before implementation.
- Chat routing is intentionally untouched because `rag-chat-page.tsx` has an unrelated dirty edit outside this task's lease.
- Implemented: shared form result base-path prop, reusable submitted-result presentation, `/asrs/intake`, `/asrs/intake/submitted/[submissionId]`, Assessment workspace tab, and `/asrs` Start assessment action.

## Risks and next step

- Preserve the existing public form route while allowing ASRS use to return to an ASRS-scoped submitted-result route.
- Next: capture the authenticated ASRS intake route at desktop/mobile, submit a safe test record if authorized, and run focused checks.
