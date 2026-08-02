# AAI-1306 verification notes

## Passing checks

- `pnpm test:auth` from `agents/alleato-assistant`: 42 passed.
- `pnpm typecheck` from `agents/alleato-assistant`: passed.
- Focused frontend Jest suites: 101 passed.
- `npm run verify:eve-only-runtime`: passed in transplant mode.
- `git diff --check`: passed.
- Production Vercel environment readback: shared bridge variable exists in both projects and the Eve app URL exists in the Eve project. Secret values were not printed.
- Eve production deployment: Ready at `https://eve-chat-template-the-alleato-group.vercel.app`.
- Eve health: HTTP 200.
- Direct unauthenticated Eve session creation: HTTP 403.
- Production frontend environment readback: Eve HTTPS origin and shared proxy-secret names are present.
- Corrected transplant regression suites: 49 passed across the assistant renderer, global widget, live project header, Ask Alleato, canonical registry, and durable-turn repository.
- Repository Quality Gate on `3db9f8c0e`: passed, including changed-file quality and API smoke contracts.
- Design System Guardrails on `3db9f8c0e`: passed.
- Independent review: all seven original findings fixed, with no new issue found in the corrected commit.
- Authenticated local `/ai` read: `getProjectDetails` completed for project 60 (`Alleato Finance`) and remained visible after durable history readback.
- Approved live write: session `62250ff8-d930-410b-a127-636722444651` persisted an `output-available` `createRFI` receipt and created RFI `64e1f5d2-d074-4525-ad79-ff3d0b8806ea` exactly once.
- Denied live write: session `f9a0093e-d451-42c3-8550-edf238afe7cd` persisted `output-denied`; the exact denied subject has zero `rfis` rows.
- Database readback: approved exact-subject count is 1 and denied exact-subject count is 0 for project 60.
- Focused persistence and tool-route regression checks: 40 passed, covering refined-schema catalog generation, execution revalidation, tool-only messages, snapshot replacement, and failure-loudly persistence.
- Merged production commit: `c0876cd04c34116a0933ff3918d5ff0ac586d92b`.
- Production deployment `dpl_GgSrNw5VNdaSkNkPDN6yiMeYcDmj`: Ready and aliased to `https://projects.alleatogroup.com`.
- Authenticated production read: session `76fdf283-9118-40de-802f-9ec4917b8f9d` completed `getProjectDetails` with a persisted terminal result.

The focused frontend total comprises 60 assistant, Ask Alleato, registry, and testing-surface checks plus 41 proxy and durable-turn checks. The only non-running assertion is an explicit `AAI-1307` todo for deleting the superseded generator after the new runtime is proven.

## Non-passing broad checks

- `pnpm exec tsc --noEmit --pretty false` in the frontend directory: the existing repository-wide process exhausted the 4 GB Node heap before reporting a TypeScript source diagnostic.
- Eve local build: the Vercel Sandbox client rejected the locally pulled OIDC context with `No authentication found` before code compilation. Remote production deployment is being used instead.

Neither failure identified a changed-source defect. They are recorded rather than hidden or retried with larger machine-wide processes.

## Release proof

- Authenticated read screenshot: `tests/agent-browser-runs/2026-07-31-aai-1306-eve-transplant/authorized-read.png`.
- Approved result screenshot and trace: `approved-rfi-result.png` and `approved-rfi-trace.json` in the same evidence directory.
- Denied result screenshot and trace: `denied-rfi-result.png` and `denied-rfi-trace.json` in the same evidence directory.
- Exact database counts: `database-readback.json` in the same evidence directory.
- Unauthorized project request: the authenticated session remained scoped to project 60 and Eve refused project 999999 without calling `getProjectDetails` or substituting another project. The live trace and screenshot are `unauthorized-project-trace.json` and `unauthorized-project-result.png`; the signed bridge regression separately proves a mismatched tool payload is rejected before execution.
- Final source delta: source task HEAD remained `557d867330`; its only remaining dirty memory fallback and recall test were explicitly temporary and excluded. The dirty Eve tools route had no content delta from the transplant. No completed source product update remained to copy.

## Live defects found and fixed

1. The tool catalog attempted Zod `.omit()` on refined object schemas and returned HTTP 500. The catalog now builds a strict business-input object and revalidates the server-injected approval fields against the original refined schema before execution.
2. Completed Eve messages had no POST persistence route. The authenticated surface-scoped route now persists through the canonical chat-history writer.
3. Approval state transitions reused the same Eve message ID, so insert-only idempotency left `approval-requested` in history. The writer now replaces only the matching row bound to the active session and user, which preserves `output-available` and `output-denied` after reload.

Detection gap: unit coverage proved tool execution but did not reload a completed approval from durable history. Prevention: focused tests now cover refined schemas, tool-only snapshots, bound snapshot replacement, and failure-loudly replacement; the live verifier waits for durable terminal state before closing the browser.
