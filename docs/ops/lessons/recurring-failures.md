# Recurring Failures Registry

Use this file to prevent repeat incidents. If an issue repeats, add or update an entry before closure.

| Failure Pattern | Root Cause | Detection Gap | Guardrail | Status |
|---|---|---|---|---|
| Route parameter mismatch (`[id]` vs specific names) | Generic dynamic segment names cause route conflicts and wrong param binding | Route conventions were not checked during implementation | Enforce named params (`[projectId]`, `[contractId]`, etc.) and run `npm run check:routes` for route changes | Active |
| Stale Supabase types | DB assumptions made from memory, not generated types | No mandatory pre-change type generation step followed | Run `npm run db:types`, then verify `frontend/src/types/database.types.ts` before DB work | Active |
| Claimed verification without execution | Completion reported from code reading instead of runtime evidence | No hard evidence requirement at closeout | Require command output and artifacts (tests/logs/screenshots) in log or handoff | Active |
| Next.js stale route cache (`.next`) | Debugging code before clearing stale cache on route changes | Routing protocol skipped | Clear `.next`, restart dev server, verify ready log before routing debug | Active |

## Entry Quality Bar

Each entry must include:

- Proven root cause
- How detection failed
- Guardrail that can be enforced
- Clear status
