# Task: Training Module — resource normalization tooling + pure UI components (T5/T6 content slice)

Status: Pending Publication — Source Assets Deferred
Owner: Session S221
Created: 2026-07-26
Task ID: ALL-19..21 (Linear project "Training Module — Alleato-PM"; covers the T5/T6 UI-and-content slice of that range — nav/route wiring (T7) is explicitly excluded, see Scope)
Linear Issue: ALL-19 (T5, https://linear.app/alleato-group/issue/ALL-19), ALL-20 (T6, https://linear.app/alleato-group/issue/ALL-20)
Related Handoff: `docs/ops/handoffs/2026-07-26-S221-training-module-ui-content.md`

## Objective

Produce pure, reusable presentation components for the Training module
(`ResourceFilters`, `ResourceCard`, `TrainingLibraryView`, `GuideViewer`) driven
by props/fixtures only, plus the tooling to normalize the standalone Alleato
Training Platform's resource library into `resources.json` — while being
honest about which source assets could not be recovered in this environment.

## Scope

- Owned: `scripts/training/source/**`, `frontend/src/content/training-guides/**`,
  `frontend/src/features/training/**`, this task file, and its handoff.
- Explicit exclusion: `specs/training-module-spec.md`, `supabase/**`,
  `frontend/src/types/database.types.ts`, `frontend/src/lib/training/**`,
  `frontend/src/app/(main)/training/**`, `frontend/src/lib/navigation-config.ts`,
  `backend/**`, `render.yaml`, `docs/ops/orchestration/**` — all owned by other
  concurrent sessions (S220 owns T1-T4 per the session registry; T7 nav/route
  wiring belongs to whoever picks up the excluded route/nav files next).
- Explicit exclusion: no database access, no route wiring — components accept
  props and fixtures only, per the task brief.

## Source of Truth

- Canonical runtime/data owner: none yet — the data-access layer
  (`frontend/src/lib/training/**`) and route wiring (`frontend/src/app/(main)/training/**`)
  are owned by a different session and will consume these components later.
- Existing shared primitives/services used: `@/components/ds` (`ExpandingSearch`,
  `EmptyState`, `StatusBadge`, `InfoAlert`), `@/components/layout`
  (`SectionRuleHeading`), `@/components/ui/select`.
- Deprecated or parallel paths: N/A — this is new surface area, not a
  replacement of an existing training feature. (Note: `frontend/src/features/training-docs/**`
  is an unrelated, already-shipped "repeatable training docs" system — different
  domain, not touched by this task.)

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Every named source asset (spec, resources.js, Resource-Library.html, three
      handbooks, the Teams-referenced local HTML export) was searched for across
      this repo, the full local filesystem, every GitHub repo in the org, Linear
      attachments/comments, and Microsoft 365 (SharePoint/Outlook/Teams) — and
      the exact missing paths are reported rather than fabricated.
- [x] `normalize-resources.mjs` + `resources.schema.json` exist and are proven
      correct against a clearly-synthetic fixture (not real business data),
      including URL-uniqueness and count validation.
- [x] `ResourceFilters`, `ResourceCard`, `TrainingLibraryView`, `GuideViewer`
      exist under `frontend/src/features/training/`, accept props/fixtures only,
      and pass the Alleato noise gate (no nested cards, no decorative wrappers,
      no duplicate CTAs, no stat tiles/helper panels).
- [x] Videos embed inline when `embed.canEmbed` is true, with a visible link
      fallback always present. Only canonical HTTPS YouTube, Vimeo, and Loom
      player URLs are eligible for iframe rendering.
- [x] Focused tests cover filtering, search, guide rendering, embeds, and the
      link fallback.
- [ ] Real `resources.json` and the three guide `.mdx` files — blocked, see
      Failure-Loudly Contract. Not fabricated.

## Implementation Checklist

- [x] Files/modules listed before edits (see Scope).
- [x] `ResourceCard`/`GuideViewer` reuse shared `@/components/ds` primitives
      instead of hand-rolled badges/empty states.
- [x] Presentation models derive their domain fields from the canonical
      `@/lib/training/types` owner rather than defining a second enum/type set.
- [x] `normalizeResourceEntry` throws a specific, actionable error (naming the
      missing field and the entry) instead of silently dropping malformed
      entries.
- [x] Source normalization and the frontend both reject untrusted iframe
      sources; the two checks are deliberate defense-in-depth at ingestion and
      rendering boundaries.
- [x] No database, provider, auth, or route-wiring code added — pure
      components + a standalone Node normalization script only.

## Integration and Verification

- [x] Targeted checks: `node --test scripts/training/source/__tests__/normalize-resources.test.mjs`
      (8 passed, 1 skipped with an explicit reason) and four exact Jest test
      paths from `frontend/` (14 passed, 4 suites).
- [x] Typecheck/lint of the new files — delegated to a sub-agent. Typecheck:
      zero errors in the new files. Lint: found two real violations
      (`design-system/no-external-link-icon` in `ResourceCard.tsx`,
      `design-system/no-raw-search-input` in `ResourceFilters.tsx`); both fixed
      (`ArrowRight` instead of `ExternalLink`; `ExpandableSearch` from
      `@/components/tables/unified/table-toolbar` instead of `ExpandingSearch`).
      Re-ran `npx eslint src/features/training --max-warnings=0` -> exit 0.
- [x] Evidence artifacts recorded below.
- [ ] Task-owned files published to `origin/main` — not done in this session;
      per the isolated-workspace protocol this session commits to its own
      branch and reports the commit SHA for the leader/user to integrate.

## Failure-Loudly Contract

- Cause surfaced as: the six named source assets (spec, `data/resources.js`,
  `Resource-Library.html`, PM Handbook, Superintendent Handbook, Alleato-PM
  Software guide) and the Teams-referenced `C:\Users\Brandon\Downloads\Alleato_Training_Library.html`
  do not exist anywhere reachable from this environment.
- Detection path: exhaustive search — `find / -xdev` across the whole
  filesystem, `gh repo list The-Alleato-Group`, Linear project/issue
  attachments and comments, and Microsoft 365 SharePoint/Outlook/Teams search
  (multiple query variants each) — all came back empty for these specific
  assets. Full detail in `scripts/training/source/README.md` and
  `frontend/src/content/training-guides/README.md`.
- Recovery path: Brandon needs to supply `data/resources.js` (or an equivalent
  export) and the three handbook documents directly — most likely from his
  local machine or wherever the standalone Alleato Training Platform is
  actually hosted. Once supplied, `node scripts/training/source/normalize-resources.mjs --input <path>`
  produces `resources.json`, and the guides become `.mdx` files under
  `frontend/src/content/training-guides/`.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A — this is a missing-input blocker, not a bug.
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Resource normalization unit tests | `node --test scripts/training/source/__tests__/normalize-resources.test.mjs` | 8 passed, 1 skipped | Covers required fields, enums, free-only resources, URL uniqueness, count validation, canonical embed derivation, and rejection of untrusted embeds. Skip is the real-`resources.json` check; reason states the source is missing. |
| Component tests | `npx jest src/features/training/__tests__/resource-filters.test.tsx src/features/training/__tests__/resource-card.test.tsx src/features/training/__tests__/training-library-view.test.tsx src/features/training/__tests__/guide-viewer.test.tsx --runInBand` (from `frontend/`) | 14 passed, 4 suites | Covers filtering, search, trusted embeds, malicious iframe rejection, link fallback, guide rendering, review-queue banner, and empty state. |
| CLI smoke test | `node scripts/training/source/normalize-resources.mjs --input scripts/training/source/__fixtures__/resources.source.fixture.mjs --output <scratch path>` | Wrote 5 resources; counts `{total:5, published:3, review:2, archived:0}` | Proves the CLI path end-to-end against the fixture; output NOT written to the real `resources.json` path since it isn't real data. |
| Type ownership/typecheck/lint | Canonical type import inspection; focused full-typecheck diagnostics; `npx eslint src/features/training --max-warnings=0` | Pass | Presentation models derive from `@/lib/training/types`; zero typecheck diagnostics in the new files. Lint found + fixed 2 real violations (ExternalLink icon ban, ExpandingSearch-in-list-context ban); re-run is clean. |

## Remaining Risk

- The real resource library and guide content are still missing. Until
  Brandon or another owner supplies them, T3 (seed migration) and the "convert
  the three written guides to MDX" deliverable stay blocked — components are
  ready to consume that content the moment it exists.
- Next action: ask Brandon directly for `data/resources.js` (or the standalone
  platform's export) and the three handbook source files.

## Final Status

- [x] All buildable, in-scope checklist items are complete. Real source content
      remains explicitly deferred rather than fabricated (see above).
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred work (real resources.json + 3 guide MDX files) has cause,
      detection gap, prevention step, owner, and next action recorded above.
