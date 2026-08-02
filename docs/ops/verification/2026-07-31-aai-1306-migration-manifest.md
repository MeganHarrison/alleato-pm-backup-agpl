# AAI-1306 Migration Manifest

Initial production base: `2f2510ccdd9a96f4ec6c212473e1094e60aaee92`

Initial source snapshot: `557d8673302a187599da99d30d1a6c4d63e3fd96`

Active verification task: `019f94ad-f9c7-7230-9a9a-0a59e229869b`

## Copied from the verified source

| Source | Production destination | Classification |
| --- | --- | --- |
| `agents/alleato-assistant/**` (34 tracked files) | Same path | Copied. Canonical Eve 0.27.13 agent, auth, instructions, skills, request-scoped tools, protocol fixtures, evals, and focused tests. |
| `frontend/src/app/api/ai-assistant/eve/proxy/**` | Same path | Copied. Authenticated app-owned proxy, session streaming, cancellation, and route tests. |
| `frontend/src/lib/ai/assistant-turn/**` | Same path | Copied. Durable turn, approval, event, receipt, cancellation, and Supabase repository owner. |
| `frontend/src/components/ai-assistant/**` changed files | Same path | Copied only where the source differs. Existing shared components remain the UI owner; no second chat shell was added. |
| `frontend/src/app/(main)/ai/layout.tsx` | Same path | Copied. Allows the chat page to own its viewport while other AI pages remain scrollable. |
| `frontend/src/components/ask-alleato/**` five runtime files | Same path | Copied. Ask Alleato now uses the authenticated canonical Eve transport and exposes native stop behavior. |
| `frontend/src/lib/ai/eve-runtime/canonical-tool-registry.ts` and its focused test | Same path | Copied. Request-scoped policy metadata and executable catalog remain one source of truth. |
| `frontend/src/features/eve-tool-testing/__tests__/eve-tool-test-registry.test.ts` | Same path | Copied. Guards one registry row per executable Eve tool and validates evidence references. |
| `scripts/verification/eve-live-tool-check.mjs` | Same path | Copied from the active verifier workspace. Adds approve, deny, or no-action handling, terminal-state assertions, and approval evidence screenshots. |
| `scripts/verify/verify_eve_only_runtime.mjs` | Same path | Copied and corrected. The transplant gate checks the canonical assistant now; `--require-legacy-retirement` activates the AAI-1307 deletion gate. Unrelated RAG, Fireflies, and backend pipeline deletion checks were removed. |
| `patches/nf3@0.3.18.patch` | Same path | Copied. The production workspace configuration already referenced this Eve build compatibility patch but the file was absent. |
| `pnpm-lock.yaml` | Same path | Updated with the `agents/alleato-assistant` importer and the existing nf3 patch reference, using a filtered lock update so unrelated packages were not pruned. |

## Already present in production

| Source change | Production classification |
| --- | --- |
| Governed administrator tool catalog, commit `91dbde90b` | Already present byte-for-byte in `frontend/src/app/api/ai-assistant/eve/tools/route.ts` and its route test after line-ending normalization. |
| Canonical production tool factory and registry test | Already present in `frontend/src/lib/ai/eve-runtime/production-tool-registry.ts` and its test. |
| Eve session persistence hook and `useAlleatoEveChat` | Already present byte-for-byte in production main. |
| Tool-testing page, table configuration, and registry evidence fields | Already present byte-for-byte in production main. Only the missing registry parity test was copied. |
| Conversation-memory overload migration `20260731210500_fix_conversation_memory_rpc_overload.sql` | Already present in production base history. |
| Root Eve scripts and `agents/*` workspace declaration | Already present in `package.json` and `pnpm-workspace.yaml`. |

## Active AI Tools Verification deltas

| Working location | Product delta | Classification |
| --- | --- | --- |
| Canonical backup dirty `eve/tools/route.ts` | Same governed administrator catalog as `91dbde90b` | Already present in production. |
| Write-catalog workspace `91dbde90b` | Administrator write/delivery access, approval-only non-read tools, post-approval confirmation/idempotency, execution receipts | Already present in production and covered by the copied route test. |
| Live-verifier workspace dirty script | Approval action selection, terminal expected states, approval screenshots | Copied. |
| Canonical backup dirty `memory-tools.ts` and untracked recall test | Temporary SQL fallback while the duplicate RPC is repaired | Intentionally excluded. The source task explicitly said it would not ship this workaround; the durable migration already exists. A final delta check remains mandatory after that task completes. |

## Intentionally excluded

- `.env.local`, `.vercel`, `node_modules`, `.eve`, `.workflow-data`, logs, screenshots, browser profiles, and temporary evidence. These are generated, secret-bearing, or local-only artifacts.
- Standalone Eve app shell, separate Supabase chat UI, separate-domain navigation changes, and standalone Vercel cutover from the superseded AAI-1304 session. These conflict with the monorepo decision.
- Legacy deletion commit `2b025338` and `20260801001000_drop_legacy_assistant_tables.sql`. AAI-1307 owns deletion after the transplanted runtime is proven.
- Source-only AI feature catalog and marketing pages. They are unrelated to the assistant repair and were not added.
- MKH backup-site metadata. Production retains Alleato branding.
- Any rewrite of Microsoft, Fireflies, OCR, RAG, Project Intelligence, product authentication, or shared product services.

## Initial verification

- Agent auth and tool tests: 42 passed.
- Agent TypeScript: passed.
- Frontend focused assistant tests: 60 passed, then 41 proxy and durable-turn tests passed. One deletion assertion was converted to an explicit AAI-1307 todo.
- Eve transplant guardrail: passed.
- Eve build: code compilation was not reached because Vercel Sandbox rejected the freshly pulled local OIDC context with `No authentication found`; the folder is linked to the existing `the-alleato-group/eve-chat-template` project.
- Whole-frontend TypeScript: process exhausted the repository's existing 4 GB Node heap before reporting a source error. The separate Vercel OOM workstream owns that repository-wide boundary.

## Final delta gate

Before publication, compare the source HEAD, canonical dirty files, the write-catalog workspace, the live-verifier workspace, and the AI Tools Verification task status again. Any new product delta must be copied or explicitly classified here.

Checkpoint at 2026-07-31 20:45 America/Indianapolis:

- Source HEAD remains `557d8673302a187599da99d30d1a6c4d63e3fd96`.
- The only canonical dirty source files remain the governed route equivalent, the explicitly temporary memory fallback, and its untracked test.
- The active task was sent a coordination note requiring an exact final commit/file list before it changes or publishes assistant product files.
- No later shippable AI Tools Verification delta was present at this checkpoint.

## Production dependency gate

- Production frontend project: `the-alleato-group/project-management-agent`.
- Production Alleato alias: `https://projects.alleatogroup.com`.
- Eve runtime project: `the-alleato-group/eve-chat-template`.
- Production bridge secret: configured in both projects, value intentionally omitted.
- Eve production app URL: configured as `https://projects.alleatogroup.com`.
- Eve production deployment: Ready at `https://eve-chat-template-the-alleato-group.vercel.app`.
- Stable health readback: HTTP 200 from `/eve/v1/health`.
- Fail-closed readback: HTTP 403 from a direct unauthenticated `POST /eve/v1/session`.
- Vercel SSO was disabled only for the Eve runtime project because it intercepted trusted server-to-server traffic. Eve application authentication remains mandatory.
- Production frontend binding: `ALLEATO_EVE_URL` and `ALLEATO_EVE_PROXY_SECRET` are present. Values are intentionally omitted.
