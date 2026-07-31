# Independent Privacy Review: Cross-Site Training Analytics

Reviewer: `privacy_review`
Decision: APPROVED
Reviewed: 2026-07-31

The privacy and authorization design passes review. Assertions are opaque, encrypted, purpose-scoped, audience-bound, lesson-bound, and expire after 30 minutes. The ingestion route accepts only the canonical Mintlify origin, rejects uncataloged lessons and cross-lesson use, and sends no application cookies or raw PII to the documentation site.

The reviewer cleared the initial cross-lesson and broad-origin concerns after the assertion was bound to `sourceId`, uncataloged pages stopped receiving assertions, and CORS was narrowed to `https://docs.alleatogroup.com`. Mintlify global-script execution was confirmed against the current platform contract and local browser proof.

Residual low-severity integrity risk: the same bearer can be replayed for the same learner and same lesson during its 30-minute validity window, which could inflate watched seconds for that pair. It cannot cross users, lessons, origins, or audiences. Per-event idempotency is the recommended future hardening if stricter anti-replay integrity is required.

Focused review check: 4 privacy/route suites and 15 tests passed. The implementation closeout also preserved and passed the existing UUID/slug route guardrail test, bringing the task total to 5 suites and 16 tests.
