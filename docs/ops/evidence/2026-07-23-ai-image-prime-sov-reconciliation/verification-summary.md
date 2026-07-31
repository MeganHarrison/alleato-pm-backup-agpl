# Verification Summary

Task: `LOCAL-AI-IMAGE-SOV-2026-07-23`

The production trace localized two independent boundary failures:

1. Vision succeeded and extracted all eleven screenshot rows, but
   `editPrimeContractSov` rejected the first row because the screenshot did not
   include cost type.
2. The next text-only question was sent to the project-briefing fast path
   because production inspected attachments on only the newest user message.

The repair uses the existing shared attachment capability module as the
production handler owner. It validates the complete UI-message payload,
classifies attachments across the active conversation, filters model inputs to
validated supported images, and emits the appropriate vision/unsupported-file
capability note.

The SOV resolver now uses project `budget_lines` only when cost type is omitted
and more than one active project budget code shares the normalized cost code. It
accepts the row only when exact normalized cost code and exact two-decimal
project budget amount identify one active project budget code. No-match and
multi-match states remain fail-closed.

The existing financial controls are unchanged: draft-only contract, project and
Contracts-write authorization, no-write preview, stored preview token, explicit
confirmation, idempotency/audit reservation, stale-state comparison, and one
atomic RPC.

No live SOV write was used for verification.
