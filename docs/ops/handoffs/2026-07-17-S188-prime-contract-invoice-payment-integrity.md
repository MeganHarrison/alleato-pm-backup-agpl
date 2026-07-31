# Handoff: 2026-07-17 — Prime contract invoice and payment integrity

1. Session: S188
2. Task ID: Local task — Linear connector unavailable in this session
3. Linear URL: unavailable; no Linear MCP or CLI is exposed in this session
4. Status: In Progress — independent review/task-comment screenshot attachment pending
5. Scope: Add Acumatica invoice links and resolve the verified paid-invoice/zero-payment divergence on the canonical prime-contract detail route.
6. Files owned: `frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractInvoicesTab.tsx`, `frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractPaymentsTab.tsx`, related canonical page/API/test files discovered during localization, this task/handoff, evidence, and session board.
7. Evidence: Supabase readback moved payment refs `000285`, `000331`, and `000332` to `PC-STATUS-001`; invalid credit-memo record `000456` was removed. `backend/tests/test_acumatica_payment_applications_sync.py` passes (7 tests). Authenticated screenshots: `docs/ops/evidence/2026-07-17-prime-contract-invoices-settings.png` (five Acumatica links + unified settings) and `docs/ops/evidence/2026-07-17-prime-contract-payments-received-loaded.png` (three payment rows, `$483,791.95`).
8. Risks: No independent reviewer/subagent or task-comment attachment tool is available in this session, so mandatory closeout remains open despite passing functional and visual evidence.
9. Next action: Obtain independent review and attach the canonical screenshots to the task comment, then run the PASS verification contract and review-queue acceptance.
