# Task: Preserve Supabase Client Receiver for Schedule Calendar Reads

Status: In Progress
Owner: Codex SROOT1188G
Task ID: AAI-1188
Linear: [AAI-1188](https://linear.app/megankharrison/issue/AAI-1188/calculate-cpm-float-and-calendar-aware-schedule-impacts)

## Checklist

- [x] Runtime evidence identifies detached `.from` calls as the first failing boundary.
- [x] Calendar API and Gantt service invoke `.from` on their live Supabase client.
- [x] Receiver-preservation regressions cover route reads and Gantt analysis reads.
- [ ] Published deployment and canonical authenticated browser proof are complete.

## Evidence

- Runtime: authenticated canonical requests to `/api/projects/43/scheduling/calendar` and `?view=gantt` returned 500 with `Cannot read properties of undefined (reading 'rest')`.
- Root cause: assigning `supabase.from` to a standalone variable removed its required client receiver.
- Guardrail: receiver-aware mocks now fail if either calendar read detaches the method.
