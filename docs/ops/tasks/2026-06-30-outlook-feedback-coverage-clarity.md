Status: In Progress

# Outlook Feedback Coverage Clarity

## Objective

Make `/outlook-draft-feedback` distinguish live inbox truth from synced sandbox review coverage so the page no longer implies synced reviewed rows equal Brandon's actual inbox volume.

## Scope

- Add a server-side coverage endpoint for Brandon mailbox review mode
- Show today/yesterday live vs synced vs reviewed counts in the page header
- Clarify empty/list framing so "synced rows shown here" is explicit

## Checklist

- [x] Confirm root cause with live inbox read and synced intake counts
- [ ] Add API route that returns mailbox coverage for today and yesterday
- [ ] Wire mailbox review mode to fetch and render coverage in header copy
- [ ] Clarify synced-row wording on the feedback page
- [ ] Run narrow verification for route/client compile safety
- [ ] Record evidence and residual risk

## Root Cause

The feedback page reuses the shared synced Outlook intake list, but its framing does not distinguish that synced list from the live Microsoft Graph inbox. Users can reasonably interpret the visible reviewed/synced rows as total inbox truth.

## Evidence

- Live Microsoft Graph read for `bclymer@alleatogroup.com` on June 30, 2026 returned 43 inbox messages.
- Synced review coverage for June 30, 2026 only had 2 sandbox-reviewed rows.

## Verification Plan

- API route returns coverage payload for Brandon mailbox
- Focused TypeScript/lint checks on touched files
- Manual readback of live vs synced coverage payload

## Residual Risk

- Live inbox coverage is limited by Graph fetch limits for large date windows; this fix scopes to today/yesterday only.
