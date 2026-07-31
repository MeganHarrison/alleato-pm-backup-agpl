# Task: Harden Project Schedule Calendar Write Boundary

Status: In Progress
Owner: Codex SROOT1188F
Task ID: AAI-1188
Linear: [AAI-1188](https://linear.app/megankharrison/issue/AAI-1188/calculate-cpm-float-and-calendar-aware-schedule-impacts)
Verification contract: database migration ledger plus authenticated calendar API proof

## Checklist

- [x] Red proof identifies that authenticated roles can mutate calendar tables without the atomic validation RPC.
- [x] Direct calendar-table mutation privileges are removed for API roles while authorized reads remain available.
- [x] The replacement RPC is a secure, explicit authorization boundary and retains atomic validation.
- [x] Migration is applied to Supabase and remote privileges/function definition are read back.
- [ ] Authenticated canonical calendar API save/read proof and independent review are complete.

## Evidence

- Root cause: the initial calendar migration gives `authenticated` a `FOR ALL` policy and table mutation privileges. A project member can therefore bypass weekday/exception validation and atomic replacement by writing tables directly.
- Guardrail target: only `replace_project_schedule_calendar` can mutate calendar rows; it validates payloads and checks project membership from the caller JWT.
- Remote ledger: `20260721221518_harden_schedule_calendar_write_boundary` is applied. Readback reports SELECT-only grants and SELECT-only policies for `authenticated`, plus a JWT-guarded `SECURITY DEFINER` replacement RPC.
