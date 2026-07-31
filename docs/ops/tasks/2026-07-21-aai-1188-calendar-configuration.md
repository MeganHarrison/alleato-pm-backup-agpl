# Task: Configure Project Schedule Calendars Atomically

Status: In Progress
Owner: Codex SROOT1188C
Task ID: AAI-1188
Linear: [AAI-1188](https://linear.app/megankharrison/issue/AAI-1188/calculate-cpm-float-and-calendar-aware-schedule-impacts)
Verification contract: Not applicable

This is an in-progress implementation increment. The parent AAI-1188 acceptance contract remains required and cannot pass until authenticated canonical-route screenshots are attached to Linear.

## Objective

Authorized project users can configure working weekdays and dated working/non-working exceptions without partial calendar state.

## Checklist

- [x] Red test proves malformed calendars are rejected before the database write.
- [x] Atomic RPC replaces weekday settings and exceptions together.
- [x] Calendar API exposes authorized GET/PUT behavior.
- [x] Canonical schedule page exposes a focused settings control.
- [x] Tests and browser proof are captured.

## Evidence

- Migration `20260721193048_replace_project_schedule_calendar.sql` was applied to the linked Supabase project. Readback confirms `SECURITY INVOKER`, project-membership guard, authenticated and service-role execution, and no anonymous execution.
- Focused Jest coverage: 9 tests across calendar calculation, calendar API, calendar-settings UI, and CPM impact preview pass.
- Focused ESLint has no errors or warnings after migrating dynamic exception dates to the shared date-field primitive.
- Full frontend TypeScript remains blocked by 277 unrelated baseline errors; no calendar-configuration file appears in the emitted errors.
- Live browser save initially failed with `500 Cannot read properties of undefined (reading 'rest')`: the API detached `supabase.rpc` from its client. The route now invokes `rpc` on the client object and a focused test locks that receiver contract.
- Authenticated browser proof on deployed commit `d01f3a0`: `PUT /api/projects/43/scheduling/calendar` with the unchanged default calendar returned `200` and `source: "project"`. Desktop and 390px mobile settings screenshots are attached to AAI-1188 as Linear attachments `950ecc09-797e-438d-be49-61d903673c9e` and `c41537af-cb89-447c-a044-1a294d72abd4`.
- `npm run db:migrations:verify-applied -- supabase/migrations/20260721193048_replace_project_schedule_calendar.sql` cannot use the CLI ledger in this isolated workspace because `DATABASE_URL` and `SUPABASE_ACCESS_TOKEN` are unavailable. Supabase MCP application/readback is the authoritative migration evidence.

## Failure-Loudly Contract

- Cause: detached Supabase RPC method lost its SDK receiver; detection gap: mocks did not assert the method receiver; prevention: the route test now fails unless `rpc` is called with its Supabase client receiver.
