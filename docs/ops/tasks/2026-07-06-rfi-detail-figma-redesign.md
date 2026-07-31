# Task: RFI Detail Figma Redesign

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-965 - https://linear.app/megankharrison/issue/AAI-965/redesign-rfi-detail-page-to-match-alleato-group-figma-detail-layout
Related Handoff: N/A

## Objective

Update the RFI detail route so `/876/rfis/fe13bf4e-dbb6-494a-bb50-b8fc821b694e`
reads like the Alleato Group Figma detail page: strong title hierarchy, quiet
two-column layout, response thread as the main secondary content, and a compact
metadata rail that preserves the current workflow/actions.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: RFI detail page.
One purpose: Inspect and act on one RFI.
Primary user job: Understand the question, attached files, response activity,
ownership, and impacts without scanning a noisy metadata grid.
Primary action: Review or update the RFI, then create follow-on work if needed.
Secondary actions: Export, change status, create change event, add responses,
inspect linked/attached source material.
Next action after success: Return to RFI list, continue discussion, or open a
follow-on record.
Correction path: Use edit mode, response tools, or linked workflows on the same
detail route; do not scatter detail context across separate pages.
Keyboard path: Header actions, inline edit affordances, attachments, and
response thread remain reachable through normal tab order.
Information that belongs elsewhere: Dense implementation metadata should not
compete with the subject/question/response narrative.
Blessed pattern: PageShell detail page + open canvas main column + compact
right-side property rail using shared primitives.
Complexity budget: Full detail page, no nested cards in the main content, no
stat-row/dashboard treatment, no duplicate CTAs.
Pass/fail: Current page fails the hierarchy/noise test; target page must pass
before closeout.

## Noise Gate Brief

Primary user: Project manager or coordinator reviewing one RFI.
Primary job: Quickly understand what is being asked, what support files exist,
who owns it, and what response activity has happened.
Primary decision: Is the RFI ready for action, response, escalation, or follow-on
change management?
Tier 1: RFI identity, subject, question, current status, attachments, responses.
Tier 2: Assignment, detail metadata, dates, imported/source references.
Tier 3: Related items and long-tail supporting links.
Hide until requested: None in scope, but low-priority metadata should be
demoted into the side rail rather than competing with the main narrative.
Remove: Generic detail grid dominance, repeated wrappers, and oversized
secondary chrome.
Primary action: Review/update the RFI and create a change event when needed.
Failure-loudly behavior: Missing RFI still renders the explicit empty state;
inline save failures keep existing API error behavior; missing imported/source
documents render as absent items instead of fake placeholders.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Shared detail/layout primitives reused or extended instead of page-local clones.
- [x] Main content hierarchy updated to match the Figma composition using project tokens.
- [x] Metadata rail simplified into quiet grouped sections.
- [x] Existing inline edit/header-action workflow preserved.
- [x] User-facing copy/UI follows project noise gate and design-system rules.

## Integration Checklist

- [x] Existing RFI fetch/update API contracts remain unchanged.
- [x] Detail page still loads by `projectId` and `rfiId` on the canonical route.
- [x] Attachments, formal responses, discussion responses, and related items remain reachable.
- [x] Imported/source document links still work when present.
- [x] Empty/not-found/edit states remain recoverable.

## Regression Guardrails

- [x] Surface complexity audit run on the changed UI files.
- [x] Targeted static/lint check run for changed UI files.
- [x] Browser evidence captured for the actual route or local authenticated equivalent.

## Acceptance Criteria

- [x] Header/title block reflects the Figma hierarchy with RFI identity first and subject as the dominant page narrative.
- [x] Question and attachments read as the primary left-column content.
- [x] Response surfaces remain on the page and are visually subordinate to the question but above low-priority metadata.
- [x] Assignment/details/dates/source references are grouped into a compact right-side rail rather than a broad detail grid.
- [x] No new one-off visual language or token set is introduced.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Figma design context | `mcp__codex_apps__figma._get_design_context fileKey=caRc3K6x3uTTLCUc4W21Cm nodeId=4925:2046` | Pass | Captured structured node output for the exact requested design. |
| Figma screenshot | `mcp__codex_apps__figma._get_screenshot fileKey=caRc3K6x3uTTLCUc4W21Cm nodeId=4925:2046` | Pass | Downloaded visual reference to `/tmp/alleato-rfi-figma/rfi-detail-figma.png`. |
| Existing route/task review | repo reads + `AAI-965` | Pass | Current owner files and tracking created before implementation. |
| Static/lint check | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/rfis/[rfiId]/rfi-detail.tsx' 'src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx' 'src/components/rfis/rfi-responses.tsx' 'src/components/rfis/rfi-formal-responses.tsx'` from `frontend/` | Pass | Clean after replacing the raw grid with `DetailLayout` and swapping the raw heading to shared `Heading`. |
| Whitespace check | `git diff --check -- 'frontend/src/app/(main)/[projectId]/rfis/[rfiId]/rfi-detail.tsx' 'frontend/src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx' 'frontend/src/components/rfis/rfi-responses.tsx' 'frontend/src/components/rfis/rfi-formal-responses.tsx' 'docs/ops/tasks/2026-07-06-rfi-detail-figma-redesign.md'` | Pass | No whitespace errors. |
| Noise gate audit | Manual review against `alleato-product-noise-gate.md` + local screenshot | Pass | The page now leads with subject/question, demotes metadata into the side rail, and avoids page-level wrappers/stat-card noise. The previously used automated doctrine script is not present at the expected local path. |
| Browser/user-flow | `agent-browser open 'http://localhost:3001/876/rfis/fe13bf4e-dbb6-494a-bb50-b8fc821b694e'` | Pass | Authenticated locally via the existing login flow and captured `docs/ops/evidence/2026-07-06-rfi-detail-figma-redesign/rfi-detail-local-after-loaded.png`. |
| End-to-end proof | `docs/ops/evidence/2026-07-06-rfi-detail-figma-redesign/rfi-detail-local-after-loaded.png` | Pass | Local route shows the Figma-style title hierarchy, quieter main column, and grouped inspector rail. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/rfi-detail.tsx` - main RFI detail UI owner.
- `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx` - header/title wiring if needed for the redesign.
- `frontend/src/components/rfis/rfi-responses.tsx` - allow the page to own the top-level responses heading.
- `frontend/src/components/rfis/rfi-formal-responses.tsx` - allow the page to suppress the duplicate nested responses heading.
- `docs/ops/tasks/2026-07-06-rfi-detail-figma-redesign.md` - task definition and evidence.

## Risks / Gaps

- The local browser proof required replacing a stale `next-server` process with a fresh dev server before the new layout appeared; the screenshot evidence is valid, but production/preview verification was not run in this pass.
- The captured route did not show populated response threads or attached files, so the new layout is verified structurally and visually, not against a fully loaded comment-heavy RFI example.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
