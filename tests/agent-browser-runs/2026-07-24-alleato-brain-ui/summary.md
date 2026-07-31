# Alleato Brain UI verification

Active internal staff can now open `/brain`, choose one of the five canonical
Business Areas, and browse Knowledge, Meetings, Tasks, and Files without
entering a fake project. Authenticated external contacts are redirected before
any branch query.

The implementation reuses `PageShell`, `EmbeddedUnifiedTablePage`, the signed-in
Supabase client, and the existing knowledge upload dialog. Knowledge and Files
read branch-scoped `document_metadata`; Meetings and Tasks read the permanent
Business Area project map during the parallel-run period so records remain
visible before owner-gated Phase 2 stamps are approved.

Finance remains fail closed. The route first verifies an active internal
employee, then checks the canonical membership helper before loading a
restricted branch, and every data query still runs through the signed-in client
and database RLS. Browser evidence proves both an external redirect and the
internal nonmember Finance denial. Migration `20260724100000` independently
proves Business Area document CRUD authorization at the database boundary.

The release evidence includes 50 focused tests, changed-file quality and route
checks, live interaction proof, five responsive viewports, exact source opening,
branch-aware upload copy, URL-backed server pagination/sorting, external and
Finance denial screenshots, and an independent high-risk review.

## Noise gate

PASS. The surface uses an open branch list and the canonical table. It removes
count cards, decorative section wrappers, generated-summary detail noise,
helper panels, duplicate primary actions, and duplicate page-shell ownership
from the denied state. Remaining risk is confined to pre-existing shared-shell
accessibility findings. The regression guardrail is the changed-file quality
gate, route-owned shell test, surface-complexity audit, and five-width browser
proof.
