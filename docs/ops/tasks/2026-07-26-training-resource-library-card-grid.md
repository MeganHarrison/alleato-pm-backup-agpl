# Task: Training Resource Library — Compact Card Grid

Status: Complete
Owner: claude-code-S236-resource-grid
Created: 2026-07-26
Task ID: LOCAL-2026-07-26-TRAINING-RESOURCE-GRID
Linear Issue: N/A (user-directed Fast styling change, follow-on to the completed Training Module — Alleato-PM project, ALL-15..ALL-25)
Related Handoff: N/A (single-session scoped change)

## Objective

Restyle the `/training` resource library from a stacked list with inline
video embeds into a compact card grid — matching the reference look the
user shared (a screenshot of the prior static Alleato Training Platform
`Resource-Library.html`): bordered tiles with title, Free/type/depth/status
tags, and a provider + "Open" link. No thumbnails, no inline video player.

## Follow-up: pixel-level fidelity pass (same PR)

The user pointed at the actual reference source
(`training-source/Resource-Library.html`, its inline `<style>` block) rather
than a screenshot. Read the exact CSS and closed 4 remaining gaps:

1. **4px orange left-border accent** on every card (`.item{border-left:4px
   solid var(--orange)}`) — was a plain neutral `border-border` box. Now
   `border-l-4 border-l-primary bg-card shadow-xs` (drops the full outline,
   keeps only the left accent + a card surface, matching the source's
   `background:#fff;box-shadow:...` look). Triggers a `no-design-violations`
   "card trap" warning (bg-card + a class containing "border" + rounded) —
   verified as a false positive: the rule can't distinguish a directional
   accent border from a full outline "nested card". Left as an accepted,
   non-blocking warning rather than contorting the markup to dodge a
   heuristic.
2. **"Needs review" badge recolored to red** (`.review{background:#ffe0e0;
   color:#a11}`) — was auto-resolving to the generic "warning" (amber)
   variant. Now explicitly passes `variant="error"`.
3. **A real "New" badge**, computed the same way the source does it
   (`daysSince(dateAdded) <= 14`, and only when the resource is NOT already
   in the review queue — `!isReview && isNew`). This needed `created_at`
   threaded through a stack that didn't carry it before: `training_resource`
   (already had the column) → `lib/training/data-access.ts` (added to
   `RESOURCE_COLUMNS` + the row mapping) → `lib/training/types.ts` (added
   `createdAt` to the domain `TrainingResource`) → `features/training/types.ts`
   + `adapter.ts` (presentation type + mapping). Made `createdAt` **optional**
   on the domain type, not required — `frontend/src/app/(main)/training/review/__tests__/page.test.tsx`
   (actively owned by concurrent session S235 at the time) constructs an
   untyped resource fixture without it; a required field would have broken
   that file's typecheck, which this session must not edit. Verified: full
   `tsc --noEmit` shows zero new errors anywhere, including that file.

### Evidence (follow-up)

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Unit tests | `npx jest src/features/training src/lib/training "src/app/(main)/training"` | Pass | 65/65 across 12 suites. |
| Typecheck | `npx tsc --noEmit \| grep training` | Pass | Zero new errors, including the S235-owned review test file. |
| Lint | `npx eslint <every touched file>` | Pass | One accepted, non-blocking "card trap" warning (false positive, documented above). |

## Scope

- `frontend/src/features/training/ResourceCard.tsx` — drop the inline
  iframe embed entirely; default (no-`actions`) mode renders as a single
  bordered anchor tile with a tag row instead of a plain-text metadata line.
- `frontend/src/features/training/TrainingLibraryView.tsx` — lay the
  per-topic resource list out as a responsive grid instead of a stacked
  list.
- No changes to `frontend/src/app/(main)/training/review/**` (actively
  owned by concurrent session S235) — the dense reviewer-row mode
  (`actions` prop present) is preserved byte-for-byte in behavior, only the
  dead embed branch is removed from it too (it already always passed
  `showEmbed={false}`, so this is a no-op for that page).
- No changes to `frontend/src/features/training/embed-policy.ts` or
  `adapter.ts` — left in place as still-valid general embed-trust logic,
  simply no longer read by `ResourceCard`.

## Source of Truth

- Canonical UI owner: `frontend/src/features/training/ResourceCard.tsx` /
  `TrainingLibraryView.tsx` (pure presentation components, props/fixtures
  only, built under ALL-19).
- Existing shared primitives reused: `StatusBadge`, `Badge` (ui primitive).
- Deprecated path: the inline `<iframe>` embed rendering — removed per
  explicit user direction ("we don't need thumbnails or the entire video
  shown").

Delivery lane: Fast

Verification contract: Optional

## Acceptance Criteria

- [x] `/training` resource cards render as a compact bordered tile grid,
      not a stacked list.
- [x] No thumbnail or inline video player renders on any card.
- [x] Every tile shows Free / type / (Deep dive, when applicable) /
      (status, when non-published) tags and a provider + "Open" line.
- [x] The training/review dense list (actions present) keeps its existing
      row layout and behavior unchanged.

## Integration and Verification

- [x] Focused Jest suite for the touched components passes (25/25,
      `src/features/training`).
- [x] Focused ESLint on the two changed component files passes clean (one
      `no-design-violations` warning on a brand-colored hover border was
      fixed, not suppressed).
- [x] Focused `tsc --noEmit` shows no new training-related errors.
- [ ] Authenticated live/browser readback of the deployed page — **blocked**:
      this sandbox's `frontend/.env.local` has `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` all
      blanked (`""`), so the local dev server's instrumentation guardrail
      refuses to boot (`GuardrailError: Missing required environment
      variable(s)`) regardless of port. This is the same environment
      limitation hit during the ALL-25 (T11) QA pass. Visual proof is
      deferred to the user checking the live production page after deploy,
      per the precedent set when the user supplied the ALL-25 screenshot
      directly.

## Failure-Loudly Contract

- Cause surfaced as: `GuardrailError: Missing required environment
  variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY` at `frontend/src/instrumentation.ts:146`.
- Detection path: `bash scripts/dev/start-frontend-clean.sh` (any port) —
  fails during `/instrumentation` compile before serving any route.
- Recovery path: populate real Supabase credentials in this sandbox's
  `frontend/.env.local`, or verify against the Vercel production
  deployment (which carries real secrets) instead of localhost.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A — this is a presentation-only restyle, not a bug fix.
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Unit tests | `npx jest src/features/training` | Pass | 25/25, including 7 rewritten `ResourceCard` tests (TDD: red before the rewrite, green after). |
| Lint | `npx eslint src/features/training/ResourceCard.tsx src/features/training/TrainingLibraryView.tsx` | Pass | Fixed a real `no-design-violations` warning (brand-colored hover border) rather than suppressing it. |
| Typecheck | `npx tsc --noEmit -p tsconfig.json \| grep training` | Pass | No new training-related errors. |
| Live visual proof | — | Blocked | Local Supabase env vars are blanked in this sandbox; see Integration and Verification above. |

## Remaining Risk

- Visual proof of the deployed result has not been captured by this
  session — the user should confirm the live `/training` page after
  deploy (or this session's report should be treated as pending visual
  confirmation).

## Final Status

- [x] All required checklist items are complete except the one explicitly
      blocked item, which is documented above with cause and next action.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A (no bug involved).
- [x] No other work is deferred.
