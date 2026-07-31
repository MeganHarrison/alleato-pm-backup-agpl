# Negative-Path Evidence

Targeted regressions prove:

- A screenshot row with no exact cost-code and project-budget-amount match
  returns a specific blocked response and does not call the atomic RPC.
- A screenshot row that still identifies multiple active project budget codes
  after exact amount comparison returns a specific blocked response and does
  not call the atomic RPC.
- Unsupported, spoofed, remote, oversized, excessive-count, or
  provider-specific image inputs are rejected or filtered by the shared
  attachment boundary.
- A confirmed SOV call without the stored preview token blocks.
- A changed contract/SOV snapshot blocks the atomic write.
- Missing project access, Contracts-write permission, draft status, or private
  contract sharing blocks before mutation.
- A failed audit reservation prevents the write.

No negative-path test confirmed or changed a live contract.
