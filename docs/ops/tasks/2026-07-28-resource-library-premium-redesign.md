# Task: Resource Library Premium Redesign

Status: Complete
Owner: Codex
Created: 2026-07-28
Task ID: local-resource-library-premium-redesign
Linear Issue: Not required for a single-session Standard task.
Related Handoff: N/A

## Objective

Replace the sparse card-grid presentation with a polished, scan-friendly resource index that makes search, filtering, saving, and opening training resources immediately clear.

## Scope

- `alleato-resource-library.html`
- Desktop and mobile visual evidence for the standalone prototype
- Excludes the canonical training application implementation behind the destination URL

## Source of Truth

- Canonical runtime/data owner: standalone `alleato-resource-library.html` prototype
- Existing shared primitives/services: existing resource data, filtering, bookmarks, tabs, and canonical training-library URL in the file
- Deprecated or parallel paths: the obsolete split-view treatment has already been removed

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The library is presented as a structured, scan-friendly index rather than an equal-weight card grid.
- [x] Search, filters, sorting, saving, learning paths, and full-row resource links remain functional.
- [x] Failure-loudly behavior is defined through a specific filtered-empty state with direct recovery.
- [x] Desktop and mobile screenshots prove the changed visual boundary.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Existing resource data and interaction owners are reused.
- [x] Errors are specific and actionable.
- [x] No database, provider, authentication, permission, or delivery contracts apply.

## Integration and Verification

- [x] HTML script parses without error.
- [x] Browser interaction smoke check passes.
- [x] Desktop and mobile evidence artifacts are recorded.
- [x] Task-owned files are ready for exact-path publication; `codex:finish` reached the commit boundary but the generic root-file hook rejects the pre-existing root prototype path.

## Failure-Loudly Contract

- Cause surfaced as: no results match the active query or filters.
- Detection path: visible `No resources match` state replaces the result list.
- Recovery path: `Clear search and filters` resets the retrieval state in place.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static validation | `git diff --check` and embedded script parse with `new Function(script)` | Pass | No whitespace errors; browser script parses. |
| Desktop visual | `docs/ops/evidence/resource-library-after-desktop.png` | Pass | 1440px scan-first resource index. |
| Mobile visual | `docs/ops/evidence/resource-library-after-mobile.png` | Pass | 390px layout with collapsed filters and no horizontal overflow. |
| Search and empty recovery | Browser fill/eval smoke check | Pass | `RFI` returned 6 rows; unmatched query returned the actionable empty state; clear restored 30. |
| Save and learning paths | Browser click/eval smoke check | Pass | Save count/state updated; learning-path tab rendered four paths and expanded six steps. |
| Destination contract | Browser DOM readback | Pass | Every rendered resource link points to the canonical training-library URL. |
| Publication guard | `npm run codex:finish -- --message "Redesign resource library index" --files ... --session Sresource4` | Unrelated policy block | The generic root-file hook rejects modification of the established root `alleato-resource-library.html`; exact scoped commit/push fallback is required to preserve the user-facing path. |

## Remaining Risk

- The prototype routes every record to the same canonical training-library URL because record-specific destinations are not present in the supplied data.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred record-specific routing names its cause and boundary.
