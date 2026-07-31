# Standardized Training Page Verification

Date: 2026-07-27
Local base URL: `http://localhost:3025`
Authenticated role: scoped test user created by the canonical browser-auth
bootstrap.

## Automated Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Focused Jest | Pass | 9 suites, 26 tests |
| Focused ESLint | Pass | Zero errors and zero warnings |
| Dynamic route check | Pass | No conflicting route parameters |
| Surface complexity | Pass | Four changed training surfaces passed |
| Diff whitespace | Pass | `git diff --check` returned no findings |

## Browser Checks

| Boundary | Result | Evidence |
| --- | --- | --- |
| Training hub desktop | Pass | `hub-desktop.png` |
| Training hub mobile, 390px | Pass | `hub-mobile.png`; no horizontal overflow; zero external hub links |
| Video lesson desktop | Pass | `video-lesson-desktop.png`; internal resource URL; YouTube playlist player rendered |
| Video lesson mobile, 390px | Pass | `video-lesson-mobile.png`; no horizontal overflow |
| Unsupported document | Pass, fail-loud | `unsupported-document.png`; zero iframes; explicit native-content-required state |

## Production Release Proof

- Commit: `7417830e0520afd7766129eaed350afb80226a7a`
- Deployment: `dpl_FaxUdgQinJKLP3gUCPBdLxbjPsP1`
- Deployment URL:
  `https://project-management-agent-10tf9y5g3-the-alleato-group.vercel.app`
- Canonical alias: `https://projects.alleatogroup.com`
- Vercel state: `READY`
- Runtime error scan: no errors returned for the deployment in the first
  production hour.

| Production boundary | Result | Evidence |
| --- | --- | --- |
| Training hub desktop | Pass | `production-hub-desktop.png`; canonical URL; zero external hub links |
| Training hub mobile, 390px | Pass | `production-hub-mobile.png`; zero horizontal overflow |
| Resource library | Pass | 67 published `Open lesson` actions, all internal |
| Video lesson desktop | Pass | `production-video-lesson-desktop.png`; approved YouTube playlist embedded |
| Video lesson mobile, 390px | Pass | `production-video-lesson-mobile.png`; embed rendered; zero horizontal overflow |
| Unsupported document | Pass, fail-loud | `production-unsupported-document.png`; zero iframes; explicit authoring-required copy; no console errors after clean reload |
| Shared written pages | Pass | PM Handbook, The Method, and AI Prompt Starters render on canonical internal routes with the shared training navigation |

Verified internal lesson URL:
`/training/resources/43a47e3e-ee12-48a2-9ae9-f3c8dfc4a4f1`

Verified embed:
`https://www.youtube-nocookie.com/embed/videoseries?list=PL-MQNpO8Wb7A_xR5lxspavDGgvGdoqeIu`

Verified unsupported-source behavior:
`/training/resources/127ba8f3-80e4-4c5d-a690-54a4de86a054`

## Root Cause, Detection Gap, Prevention

- Cause: the Resource Library stored only third-party URLs, and published cards
  sent employees directly to those sites. A generic iframe cannot repair that
  because providers such as Autodesk set `X-Frame-Options: SAMEORIGIN`.
- Detection gap: the prior component tests asserted external-link behavior and
  never opened a representative document in a browser.
- Prevention: published cards now route internally, the shared template owns
  individual-page hierarchy, approved video providers use one embed policy,
  module links reject destinations outside `/training`, and unsupported sources
  show an explicit native-content-required state instead of a blank iframe or
  automatic redirect.

## Known Content Migration

The production inventory contains 67 published external resources and no exact
URL matches in the existing `support_articles` corpus. This change creates the
standard page contract and makes missing native content visible; it does not
copy third-party articles into Alleato. Those document/course lessons still
need Alleato-authored bodies before their pages can be considered complete
training content.
