# Alleato PM Mobile App — Plan

> Status: PROPOSAL — needs stakeholder sign-off on the decisions at the bottom.
> Author: Claude session for Brandon Clymer, 2026-07-19.
> Scope: iPhone + Android app for the Alleato project management platform
> (`projects.alleatogroup.com`).

---

## Executive summary

Build **one cross-platform app with React Native + Expo**, living in this
monorepo as a `mobile/` workspace, that reuses the platform's existing
backend end-to-end: Supabase Auth for login, the existing Next.js API
routes (765 endpoints, already partially Bearer-token capable) for data,
and Supabase Storage for photos/files. No new backend is required.

The app is a **field companion, not a port of the web app**. The web app
has 349 routes; the mobile MVP needs roughly a dozen screens covering what
people actually do on a phone at a job site: daily logs with photos,
directory (tap-to-call), tasks/my-work, project status, approvals, and
push notifications. Desktop-shaped work (budget setup, estimating,
contract authoring, admin) stays on the web.

Rough timeline to a usable beta on real phones (TestFlight + Play internal
track): **6–8 weeks** of focused work. Public App Store / Play Store
release: ~2–4 weeks after beta feedback.

---

## 0. Where we are — steps already taken vs. what's next

### ✅ Steps already taken (as of 2026-07-19)

1. **Codebase audit for mobile readiness** — confirmed the platform is
   Next.js 15 + Supabase with 349 web routes and 765 API endpoints, and
   that there is no existing mobile/PWA work to build on or conflict with.
2. **Found the reuse path** — the API layer already accepts
   `Authorization: Bearer <token>` auth (`frontend/src/lib/supabase/server.ts:66`),
   which is what lets a native app call the existing backend instead of
   needing a new one. This is the single most important technical finding.
3. **Approach selected and justified** — React Native + Expo, compared
   against PWA, Capacitor, and dual-native (§1).
4. **Architecture defined** — same Supabase login, same API routes, same
   storage; shared types package; monorepo `mobile/` workspace (§2).
5. **MVP scope defined** — field-first screen list, phased roadmap,
   explicit not-on-mobile list (§3, §5).
6. **Store costs & requirements verified against current sources**
   (2026-07): Apple Developer $99/yr; Google Play $25 one-time, and a
   verified **organization** Play account is exempt from the 12-tester /
   14-day closed-testing requirement that personal accounts face; Expo
   EAS free tier = 15 iOS + 15 Android builds/month (Starter $19/mo,
   Production $199/mo when we outgrow it).
7. **This plan committed** to branch `claude/pm-mobile-app-plan-an8hxx`.

### ⏭ The full step list from here (in order)

| # | Step | Who | Blocked on |
|---|------|-----|-----------|
| 1 | Approve this plan (§8 decisions) | Alleato leadership | — |
| 2 | **Sign up: Apple Developer Program** ($99/yr, as organization — needs D-U-N-S; 1–2 wk lead time → start first) | Brandon/Megan | Decision 1 |
| 3 | **Sign up: Google Play Console** ($25 one-time, as organization) | Brandon/Megan | Decision 1 |
| 4 | **Sign up: Expo account** (free tier to start) | Brandon/Megan or agent | Decision 1 |
| 5 | Scaffold `mobile/` Expo app: navigation shell, theme from DESIGN.md tokens, sign-in screen | Agent | Step 4 |
| 6 | Wire login to Supabase Auth (same accounts as web) + session persistence in SecureStore | Agent | Step 5 |
| 7 | Bearer-token audit + smoke tests on the ~30 MVP endpoints (workstream A) | Agent | Step 6 |
| 8 | Build MVP screens: project list/home → daily log + camera → directory → my-work → approvals | Agent | Step 7 |
| 9 | Push notifications: device-token table + fan-out + deep links (workstream C) | Agent | Step 8 |
| 10 | Internal beta: EAS Build → TestFlight + Play internal track, 3–5 field users | Team | Steps 2, 3, 8 |
| 11 | Fix loop from beta feedback; store listings (screenshots, privacy forms, demo account for review) | Agent + team | Step 10 |
| 12 | Public release to App Store + Play Store | Team | Step 11 |
| 13 | Phase 2: RFIs, submittals, drawings viewer, Site Scribe | Agent | Step 12 |

Steps 5–9 are agent-executable in this repo. Steps 2–4 are the only
things that require a human to sign up for something (payment + legal
identity); everything else can proceed without new external services.

---

## 0.5 The two guarantees Brandon asked for

### "When someone logs in they see what they would see on the web"

This is guaranteed by construction, not by duplicated effort, because the
app has **no data of its own**:

- **Same accounts** — the app logs into the *same* Supabase Auth as
  `projects.alleatogroup.com`. There is no separate mobile signup; the
  same email/password works in both places, and disabling a user disables
  them everywhere.
- **Same permissions** — identity resolves to the same `people` /
  `user_profiles` records, so RLS policies and project membership apply
  identically. A user sees exactly the projects, budgets-level
  visibility, and approvals they'd see on the web — no more, no less.
- **Same data, live** — every read/write goes through the same API
  routes the web app uses. Create a daily log on the phone, it's on the
  web instantly; approve an invoice on the web, it leaves the phone's
  approvals inbox. There is no sync step because there is only one
  database.

The verification gate for this is written into the MVP definition of
done: for each screen, log in as the same test user on web and mobile
side-by-side and confirm the data matches (screenshots of both).

### "Accessible on any phone and the formatting works"

- **Coverage**: one codebase compiles to native iOS (iPhone, iOS 16+)
  and Android (Android 8+), which covers effectively every phone in use
  in the field. Screens are built with responsive native layouts, so
  small phones, large phones, and tablets all format correctly — this is
  the default behavior of native layout, verified per-screen on a small
  iPhone, a large Android, and a tablet before beta.
- **Today, before the app exists**: the web app already works in any
  phone browser. An early, cheap win (can run in parallel with Phase 0)
  is a **mobile-responsive audit of the ~12 web pages field staff use
  most**, so the phone-browser experience is decent while the native app
  is built. This also derisks the app: whatever formatting breaks on
  phone-width web tells us what needs rethinking on native.

---

## 1. Approach options considered

| Option | What it is | Verdict |
|--------|-----------|---------|
| **React Native + Expo** (recommended) | One TypeScript codebase compiled to real native iOS + Android apps | ✅ Native feel, push notifications, camera/offline access, single codebase, React/TS skills and Zod schemas carry over directly |
| PWA (installable web app) | Make the existing Next.js app installable from the browser | Cheapest, but iOS PWAs are second-class: weak push support, no reliable camera/offline, no App Store presence. Worth doing the *responsive audit* regardless, but not the answer to "an app on the iPhone and Android" |
| Capacitor wrap | Wrap the existing web app in a native shell | The app is heavily server-rendered; a thin shell pointing at the remote site risks App Store rejection (minimum-functionality rule) and delivers a webview experience. Poor fit |
| Two native apps (Swift + Kotlin) | Separate iOS and Android codebases | Best-in-class UX but ~2× the build and maintenance cost, and no skill overlap with the existing React/TypeScript team. Not justified |

**Why Expo specifically** (vs. bare React Native): EAS Build compiles iOS
apps in the cloud (no Mac required), EAS Submit pushes to both stores, OTA
updates ship JS fixes without store review, and `expo-secure-store`,
`expo-camera`, `expo-notifications`, and `expo-image-picker` cover every
native capability the MVP needs without writing native code.

---

## 2. Architecture — reuse everything

```
┌─────────────────────────────┐
│  mobile/ (Expo React Native)│
│  - supabase-js (native)     │
│  - TanStack Query           │
│  - shared Zod schemas/types │
└──────┬──────────────┬───────┘
       │              │
       ▼              ▼
 Supabase Auth   Existing Next.js API routes
 (JWT in         (Bearer <access_token>)
 SecureStore)    projects.alleatogroup.com/api/*
       │              │
       └──────┬───────┘
              ▼
     Supabase PM APP DB (RLS)  +  Supabase Storage (photos)
```

Key points:

- **Auth**: `supabase-js` works natively in React Native with
  `expo-secure-store` as the session store. Same users, same RLS, same
  `people`/`user_profiles` identity as the web app. Add biometric unlock
  (Face ID / fingerprint) via `expo-local-authentication` later.
- **Data**: the mobile app calls the **existing API routes** with an
  `Authorization: Bearer <supabase_access_token>` header.
  `frontend/src/lib/supabase/server.ts:66` already reads Bearer tokens
  (built for Playwright) — workstream A below audits and hardens this path
  across the endpoints the app uses. This is far cheaper and safer than
  duplicating business logic against Supabase directly, and keeps all
  existing validation/guardrails in force.
- **Direct Supabase access** from the app only for Realtime subscriptions
  and Storage uploads — everything with business logic goes through the
  API routes.
- **Shared code**: extract the Zod schemas and API types the app needs
  into a `packages/shared` workspace consumed by both `frontend/` and
  `mobile/`. Do this lazily — only move what mobile actually imports.
- **Monorepo**: `mobile/` lives in this repo, same PR/preview discipline.
  EAS Build runs from CI; OTA channel per environment (preview/production).

---

## 3. Product scope — field-first, not a web port

Primary users on the phone: **superintendents / site leads and PMs in the
field**. Primary jobs: record what happened today, reach people, check
status, approve things, get notified.

### Phase 1 — MVP (the beta)

| Screen | Backed by (existing surface) |
|--------|------------------------------|
| Sign in (email/password, session persistence) | Supabase Auth |
| Project list + project home summary | `/` and `/[projectId]/home` APIs |
| **Daily log**: create/edit with weather, manpower, notes, **camera photos** | `/[projectId]/daily-log` APIs + Supabase Storage |
| Site lead checklist | `/[projectId]/daily-log/site-lead-checklist` |
| Directory: people/companies, **tap-to-call / tap-to-email** | `/[projectId]/directory` APIs |
| My Work / tasks: view, complete, comment | my-work + tasks APIs |
| **Push notifications**: task assigned, approval needed, RFI response, daily-log reminder | new notification fan-out (workstream C) |
| Approvals inbox: approve/reject invoices & change orders pending on me | existing approval endpoints |

Offline posture for MVP: **online-required, with one exception** — a
daily-log draft (including photos) queues locally and syncs when
connectivity returns, since job sites are exactly where connectivity dies.
Full offline-first sync is explicitly out of scope until Phase 3.

### Phase 2 — field depth

- RFIs: view, respond, create with photo attachments
- Submittals: view, approve/return
- Drawings: view (pinch-zoom PDF viewer), markup later
- Punch-list style photo capture into Documents
- Site Scribe (realtime AI daily-log capture) — the existing
  `/daily-log/site-scribe` flow is a natural mobile-native feature

### Phase 3 — platform depth

- AI assistant chat (reuse the existing `/ai` orchestrator over the API)
- Meetings: summaries, action items on the go
- Offline-first sync for logs/tasks/directory
- Biometric unlock, widgets, share-sheet ("share photo to project")

### Explicitly NOT mobile

Budget setup/forecasting grids, estimates authoring, prime contract / SOV
editing, admin configuration, reporting builders. These are
desktop-density surfaces; linking out to the web app is fine.

---

## 4. Key technical workstreams

**A. Bearer-token auth audit (prerequisite, ~2–4 days).** The Bearer path
in `frontend/src/lib/supabase/server.ts` exists but was built for tests.
Audit every endpoint the MVP touches: confirm it resolves the user from
the Bearer token (not only cookies), rate-limit it, and add a smoke test
per endpoint in `scripts/api-smoke-contracts.mjs`. Guardrail: a shared
`getApiRouteUser` path means this is mostly verification, not rework.

**B. Photo/file upload (~3 days).** Camera + library picker
(`expo-image-picker`), client-side compression, upload to Supabase
Storage using the same buckets/paths the web Documents/daily-log flows
use, attach via existing APIs. Must survive app-backgrounding mid-upload.

**C. Push notifications (~1 week).** `expo-notifications` handles device
tokens + delivery via APNs/FCM. New backend piece: a `device_push_tokens`
table + a small fan-out that fires on the events above (the platform
already computes these events; this is a delivery channel, not new
intelligence). Deep links route a tap to the right screen.

**D. Mobile design system (~1 week, then amortized).** Translate the
DESIGN.md tokens (colors, type scale, spacing, semantic tokens) into a
React Native theme. Same signal-to-noise doctrine applies — the noise
gate rules carry over verbatim. NativeWind (Tailwind for RN) keeps
styling idioms close to the web codebase.

**E. CI + release pipeline (~2–3 days).** EAS Build on PR (preview
profile), EAS Submit to TestFlight / Play internal track on merge,
`expo-updates` OTA channel for JS-only fixes. Typecheck/lint fold into
the existing `npm run quality` root script.

---

## 5. Roadmap & rough effort

| Phase | Contents | Duration |
|-------|----------|----------|
| **0 — Foundations** | Expo app scaffold in `mobile/`, auth + session, theme, navigation shell, workstream A (Bearer audit), store accounts + app IDs | 1–2 weeks |
| **1 — MVP build** | The 8 MVP surfaces above + push + photo upload | 4–6 weeks |
| **Beta** | TestFlight + Play internal track with Alleato field staff; fix loop | 2–3 weeks (overlaps) |
| **2 — Field depth** | RFIs, submittals, drawings viewer, Site Scribe | 4–6 weeks |
| **3 — Platform depth** | AI chat, offline-first, meetings | ongoing |

Assumes roughly one dedicated engineer-equivalent (human + agent). The
work parallelizes well by screen once Phase 0 lands.

---

## 6. Distribution & compliance checklist — accounts to sign up for

These are the only new external services required. Costs verified
2026-07 against expo.dev/pricing and Play Console docs.

| Account | Cost | Notes |
|---------|------|-------|
| **Apple Developer Program** | $99/yr | Enroll as *Alleato Group* organization (needs D-U-N-S number; enrollment can take 1–2 weeks → start immediately). Required for TestFlight and the App Store. |
| **Google Play Console** | $25 one-time | Enroll as an **organization** (D-U-N-S + business verification). Verified org accounts are exempt from the 12-tester / 14-day closed-testing gate that personal accounts must pass before production release. |
| **Expo (EAS)** | Free to start | Free tier: 15 iOS + 15 Android cloud builds/month — plenty for Phase 0–1. Upgrade to Starter ($19/mo) or Production ($199/mo) only when build volume or OTA-update audience outgrows it. |

Nothing else is new: Supabase, Vercel, and the database are the existing
production services, unchanged.
- **Privacy** — App Store + Play data-safety forms; publish a privacy
  policy URL; account-deletion path is required by Apple (a support
  email + web flow satisfies it).
- **Review posture** — business/enterprise B2B app with login is
  routine; provide a demo account in review notes. First iOS review:
  allow ~1–3 days.
- Both stores require the app to be useful stand-alone — another reason
  the MVP is real native screens, not a webview.

---

## 7. Risks

| Risk | Mitigation |
|------|-----------|
| Bearer-token path under-tested across 765 endpoints | Workstream A audits only the ~30 endpoints the MVP uses; smoke tests per endpoint |
| `projects.id` is INTEGER and FK quirks (see FORM-FK-VALIDATION-GATE) bite mobile forms too | Mobile reuses the API routes' write paths — the resolution logic stays server-side |
| Scope creep toward porting the whole web app | The "Explicitly NOT mobile" list above is the contract; new screens need the same noise-gate justification as web UI |
| Job-site connectivity | Daily-log offline queue in MVP; TanStack Query cache gives free stale-while-offline reads |
| App review surprises | Demo account + review notes; no webview-only screens |

---

## 8. Decisions needed before Phase 0

1. **Approve the recommendation**: Expo React Native, monorepo `mobile/`
   workspace, API-route reuse via Bearer tokens.
2. **MVP screen list** (§3 Phase 1) — confirm or re-rank; especially
   whether approvals make the MVP or slip to Phase 2.
3. **Who are the beta users?** Need 3–5 field staff with iPhones and
   Androids committed to using it for daily logs.
4. **Store accounts**: green-light Apple Developer enrollment ($99/yr,
   needs org D-U-N-S) and Play Console ($25) now — enrollment lead time
   is the longest pole in Phase 0.
5. **App name/branding** for the stores (e.g. "Alleato PM").
