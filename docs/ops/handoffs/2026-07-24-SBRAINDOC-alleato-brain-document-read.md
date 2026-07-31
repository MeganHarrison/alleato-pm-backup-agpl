# Handoff: Alleato Brain document reads

Date: 2026-07-24
Session: SBRAINDOC
Task: ALL-11-DOCUMENT-READ
Delivery lane: High-risk
Status: Complete

## Acceptance contract

- Restrictive active-internal-employee policy on Business Area documents
- Finance restrictions enforced for reads and writes
- Unscoped legacy document behavior unchanged
- Exact migration ledger and live rolled-back principal-transition proof
- Independent high-risk approval

## Work completed

- Added the active-internal restrictive policy and upgraded the Finance guard
  from `SELECT` to `ALL`.
- Added a guarded compile/apply verifier and exact live policy contract.
- Added a rolled-back fixture that transitions the same authenticated identity
  from active internal employee to external contact.

## Evidence

- Exact migration compiled in a linked live transaction and rolled back.
- Guarded exact application: PASS.
- Remote migration ledger version `20260724100000`: PASS.
- Live policy contract: one authenticated restrictive `ALL` policy with both
  `USING` and `WITH CHECK` bound to the internal-employee helper.
- Rolled-back principal transition: internal open-branch CRUD passed; Finance
  nonmember and inactive-member access were denied; active-member and
  app-admin Finance CRUD passed independently; the externalized identity was
  denied Business Area CRUD; unscoped legacy CRUD remained available.

Independent high-risk review: APPROVED with no blocking findings.

## Known unrelated debt

The repository-wide migration clean check reports historical remote versions
that are absent from this checkout. The exact task migration ledger check
passes and is the closeout owner for this slice.
