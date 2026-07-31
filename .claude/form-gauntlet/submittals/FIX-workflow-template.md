# Fix Report: Workflow Template Save/Apply (Submittals)

**Date:** 2026-06-13
**Status:** Fixed

---

## Root Cause

`handleSaveTemplate` in `WorkflowBuilder` (submittal-detail-client.tsx) hardcoded
`user_id: null` for every step when mapping `currentSteps` to the template payload.
This meant every saved template stored steps with no assignee. When `handleApplyTemplate`
later ran `tpl.steps.filter((s) => s.user_id)`, it always got an empty array and
silently did nothing.

The secondary cause was a type mismatch: `WorkflowBuilderProps.currentSteps` was typed
with a direct `responder_id?: string | null` field, but the actual data passed in is
`SubmittalDetail["submittal_workflow_steps"]` which stores the assignee inside
`submittal_responses[0].responder_id` (a nested join row), not as a top-level field.

---

## user_id FK Target Confirmed

The `submittal_workflow_templates.steps` column is `Json` (no explicit FK).
Each element in the JSON array follows `WorkflowTemplateStep { step_type, required, user_id? }`.
The `user_id` value is an **auth.users UUID** — the same `responder_id` stored in
`submittal_responses.responder_id`, which maps to the authenticated user's `auth.users.id`.
There is no `user_profiles` or `people` FK here; it is a raw auth user UUID stored in JSON.

The `submittal_workflow_templates.created_by` column (also `string | null`) is also an
auth.users UUID. The API POST already sets `created_by: user.id` correctly (no bug there).

---

## Files Changed

### `frontend/src/features/submittals/submittal-detail-client.tsx`

1. **Added `appToast` import** — `import { appToast as toast } from "@/lib/toast/app-toast"`.

2. **Fixed `WorkflowBuilderProps.currentSteps` type** — replaced the phantom
   `responder_id?: string | null` field with the correct `submittal_responses` array
   matching `SubmittalDetail["submittal_workflow_steps"]`:
   ```ts
   submittal_responses?: Array<{ responder_id: string; response_status: string }>;
   ```

3. **Fixed `handleSaveTemplate`** — extracts `responder_id` from
   `s.submittal_responses?.[0]?.responder_id` and uses it as `user_id` (not null).
   Also added a guard: if ALL resolved steps still have `user_id: null` (steps with no
   response row yet), surfaces a real error toast instead of saving a dead template:
   ```
   "Cannot save template: No workflow steps have an assigned user."
   ```

---

## API Route (No Change Required)

`POST /api/projects/[projectId]/submittals/workflow-templates` (route.ts) was already
correct:
- Auth check via `supabase.auth.getUser()` present.
- `created_by: user.id` already set.
- `stepSchema` accepts `user_id: z.string().uuid().nullable().optional()` — valid UUIDs
  from the fix will pass through; null is still accepted for optional-assignee steps.

`GET` is project-scoped only (no user filter), which is the correct behavior — templates
are shared within a project.

---

## Apply Template (No Change Required)

`handleApplyTemplate` already filters correctly:
```ts
const assignableSteps = tpl.steps.filter((s) => s.user_id);
```
After the fix, steps will carry real UUIDs, so this filter returns the steps and the
`mutation.mutateAsync` loop runs. No change needed in the apply path.

---

## Prevention

- The `WorkflowBuilderProps.currentSteps` type now matches the actual `SubmittalDetail`
  shape, so TypeScript will catch future mismatches between what the component expects
  and what the DB returns.
- The guard toast prevents saving a zero-assignee template silently — it now fails loudly
  with a user-visible error.
- Regression test to add: create workflow steps with assigned users, save template,
  verify template appears in dropdown with non-null `user_id` entries, apply template,
  verify steps appear in stepper.
