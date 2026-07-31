# Task: Drawings QR Deep Link and Cloud Link Fix

Status: In Progress
Owner: Codex
Created: 2026-07-04
Linear Issue: Not created yet; continuing from Brandon feedback `#574` and `#575`.
Related Evidence: `docs/ops/evidence/2026-07-04-drawings-qr-markup/`

## Objective

Fix the two failing frontend drawing behaviors from Brandon's drawings feedback:

- A direct drawing viewer link must survive login and open the exact drawing after authentication.
- A selected cloud markup must expose link/actions and the Link action must not crash the viewer.

## Done Checklist

- [x] Lightweight frontend verification run with `agent-browser`.
- [x] Failure evidence captured for exact viewer deep-link login.
- [x] Failure evidence captured for selected cloud Link action.
- [x] Root cause identified for deep-link login hang.
- [x] Root cause identified for cloud Link action crash.
- [x] Deep-link login fixed for `/876/drawings/viewer/<drawingId>`.
- [x] Cloud Link action fixed or safely disabled with a specific user-facing state.
- [x] Targeted regression coverage added for the touched owner paths.
- [x] Targeted checks pass.
- [x] Browser verification proves both requested drawing behaviors.

## Evidence

| Check | Artifact | Result |
| --- | --- | --- |
| Generic `/876/drawings` callback | `docs/ops/evidence/2026-07-04-drawings-qr-markup/login-callback-result.png` | Pass |
| Authenticated viewer load | `docs/ops/evidence/2026-07-04-drawings-qr-markup/viewer-direct-authenticated.png` | Pass |
| Exact viewer callback after login | `docs/ops/evidence/2026-07-04-drawings-qr-markup/viewer-deeplink-login-after-wait.png` | Fail |
| Cloud selected context toolbar | `docs/ops/evidence/2026-07-04-drawings-qr-markup/cloud-created.png` | Partial pass |
| Cloud contextual Link action | `docs/ops/evidence/2026-07-04-drawings-qr-markup/cloud-link-action.png` | Fail |
| Exact viewer callback after fix | `docs/ops/evidence/2026-07-04-drawings-qr-markup/viewer-deeplink-fixed.png` | Pass |
| Cloud contextual Link action after fix | `docs/ops/evidence/2026-07-04-drawings-qr-markup/cloud-link-action-fixed.png` | Pass |

## Failure Notes

- Deep-link login remains on `/auth/login?callbackUrl=/876/drawings/viewer/...` with disabled fields and `Signing in...` after waiting.
- Cloud contextual Link action routes the viewer into the drawing error boundary with `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`

## Closeout Notes

- Deep-link login root cause: login had no timeout/fail-loud fallback around post-login redirect resolution, so a stalled redirect API request left the form disabled.
- Cloud Link root cause: React-owned overlay DOM nodes were handed directly to OpenSeadragon, which moves/removes overlay nodes outside React's normal parent-child ownership. Dismissing the selected-shape overlay while opening the Link modal triggered a DOM removal conflict.
- Prevention: targeted unit coverage now documents first-request redirect failure behavior; the viewer overlay owner now uses a portal-owned container for OpenSeadragon overlays.
