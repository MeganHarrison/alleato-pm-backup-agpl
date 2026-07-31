# Alleato PM App — Master Completion Plan

**Repo:** `The-Alleato-Group/project-management` (private) · **Frontend:** `frontend/` (Next.js App Router, pnpm) · **PM App Supabase project:** `lgveqfnpkxvzbnnwuled`
**Goal:** finish the incomplete surface of the app — the messaging platform first — plus the six tracked workstreams and the ~20 page-level gaps found in a full completeness audit of all 353 pages.

---

## Execution ground rules (read first — repo conventions)

1. **One PR per work item.** Keep each `P#`/`T#` below to its own branch + PR. Do not batch unrelated changes.
2. **Never hand-edit generated files.** `frontend/src/app/(admin)/site-map/route-inventory.generated.json`, `frontend/src/lib/app-surface/app-surface.generated.json`, and `backend/src/services/agents/app_expert/runtime/generated/app-sitemap.generated.json` are produced by scripts. After adding/removing/renaming any route, re-run the generators: `pnpm --dir frontend run build:route-inventory` and the map scripts (`npm run map:project && npm run map:system`), and commit the regenerated output. There is a CI "map gate" that fails on stale maps.
3. **Migrations:** every DB change is a committed migration in `supabase/migrations/`. Verify the live schema against project `lgveqfnpkxvzbnnwuled` before writing one (schema drift has already caused a bad merge — see issue #124). Migrations must be additive + transactional.
4. **Quality gates:** run `pnpm --dir frontend run quality:changed` (eslint-debt, no-new-any, unsafe-patterns, changed-route guardrails) and `pnpm --dir frontend run typecheck` before opening a PR. New API routes must use `withApiGuardrails` + `requirePermission` (see existing routes for the pattern).
5. **Orphan-route gate (PR #200, pending merge):** any NEW top-level static page must be linked in `frontend/src/lib/navigation-config.ts` or it will fail the gate. If intentionally unlinked, run `node frontend/scripts/build/check-orphan-routes.mjs --write-baseline`.
6. **Avoid collision:** branches `feat/manager-coaching-tool` (PR #183) and `codex/ai-assistant-commitment-approval-workflow` are actively being worked by another author. Do NOT touch those areas except via the "Coordinate" section.
7. **RLS:** any table exposed to the client needs row-level security. Verify/author policies for every new or newly-exposed table.

---

## P0 — MESSAGING PLATFORM (Team Chat) — top priority

**Tracked as issue #23 ("Finish and roll out Team Chat"). This is workstream #1 of the original six.**

**Current state (verified):** `frontend/src/app/(main)/team-chat/page.tsx` → `frontend/src/components/chat/*` (chat-layout, chat-main, chat-sidebar, composer, message-list, message-group, chat-right-panel, thread panel). Channels, DMs, and message send/persist are wired to real APIs (`/api/team-chat/channels`, `/direct-messages`, `/users`) backed by live tables `team_chat_channels` (5 rows) and `team_chat_messages` (11 rows). **It is ~80% built.** The gaps below are what stop it being a usable platform.

### P0.1 — Make it reachable (navigation)
- Add a **Team Chat** entry to `frontend/src/lib/navigation-config.ts` (company-wide nav, `requiresProject: false`, `path: "team-chat"`, an appropriate lucide icon). Confirm it renders in the sidebar/header for all authenticated users.
- Regenerate route maps (ground rule #2). Remove `team-chat` from the orphan baseline if present.
- **Accept:** signed-in user can navigate to Team Chat from the main nav; page loads channels.

### P0.2 — Realtime messaging (the core gap)
- `chat-layout.tsx` / `chat-main.tsx` currently fetch messages on load and only refetch on local send (`handleMessageSent` re-fetches previews). **There is no Supabase realtime subscription**, so a message from another user does not appear until refresh. Add a realtime subscription on `team_chat_messages` filtered by `channel_id` (Supabase `.channel().on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat_messages', filter: 'channel_id=eq.<id>' })`), updating the active channel's message list live. Unsubscribe on channel change/unmount.
- Ensure Supabase Realtime is enabled for `team_chat_messages` (publication `supabase_realtime`) — add to a migration if not.
- **Accept:** two browsers in the same channel see each other's messages within ~1s, no refresh. Verify with an e2e or a two-session manual test documented in the PR.

### P0.3 — Persist thread replies
- `handleAddThreadReply` in `chat-layout.tsx` stores replies in React state only (`crypto.randomUUID()`, never saved) — threads vanish on refresh. Create a `team_chat_thread_replies` table (`id uuid`, `parent_message_id uuid → team_chat_messages`, `channel_id text`, `user_id uuid`, `user_name text`, `content text`, `created_at timestamptz`) + RLS + realtime, and `/api/team-chat/messages/[messageId]/replies` GET/POST. Wire the right panel to it (load + subscribe + post).
- **Accept:** a thread reply survives refresh and appears live to others.

### P0.4 — Unread / last-seen state
- The `unread` count on `TeamChannel` is not backed by per-user read state. Add a `team_chat_last_read` table (`user_id`, `channel_id`, `last_read_at`) + endpoint to mark-read on channel open, and compute `unread` = messages after `last_read_at`.
- **Accept:** unread badges reflect reality per user and clear on open.

### P0.5 — Security + hardening pass
- Verify RLS on `team_chat_channels`, `team_chat_messages`, and the new tables: who can read/post (all authenticated employees? channel members?). Confirm the `/api/team-chat/*` routes use `withApiGuardrails` and validate input (channel existence, membership).
- **Accept:** a user cannot read/post to a channel they shouldn't; no unguarded route.

### P0.6 (optional, fast-follow) — presence & typing
- Supabase Realtime Presence for "online" dots and a typing indicator on the composer. Nice-to-have; ship after P0.1–P0.5.

---

## P1 — Broken pages (live bugs — small, high-confidence fixes)

*(From the completeness audit. Each is a tight PR.)*

- **T1.1 `(tables)/daily-reports` broken row-click + naming.** Row click navigates to `/daily-recaps/{id}`, a route that does not exist (404). Also the folder is `daily-reports` but the page renders "Daily Recaps" off the `daily_recaps` table. Fix: either add the `/daily-recaps/[id]` detail route or repoint the row-click to an existing detail; align the folder/title naming. **Accept:** clicking a row lands on a real page; name matches content.
- **T1.2 `(tables)/meeting-segments` broken row-click.** Row click → `/meeting-segments/{id}` which does not exist. Fix: add the detail route or remove the row-click. **Accept:** no dead navigation.
- **T1.3 `/directory/groups` hardcoded + no-op actions.** Renders a hardcoded project list (contains "Goodwill Bart") with `TODO: load dynamically`; "Add Group" / "Manage Members" buttons are no-ops. Fix: load groups/projects from the real API (mirror `/directory/companies`), implement member add/remove handlers against the distribution-group tables. **Accept:** real data, working member management.
- **T1.4 `(tables)/drawings` silently scoped to one project.** Hardcodes `DEFAULT_TABLE_PROJECT_ID = "31"` — shows project 31's drawings as if global, and it's orphaned (not in nav). Fix: either wire it to a real cross-project drawings query, or delete it (it duplicates the project-scoped `[projectId]/drawings`). Recommend delete unless a global drawings view is wanted. **Accept:** no hardcoded project id; decision documented.

---

## P2 — Security & data integrity (original workstreams #2 and #3)

- **T2.1 Auth-gate coverage — issue #140.** ~469 mutation handlers written as `withApiGuardrails` consts are skipped by the auth gate. Audit and bring them under enforcement. **Accept:** every mutation route is auth+permission gated; add a guardrail test/lint so new ones can't skip it.
- **T2.2 Service-role read paths — issue #127.** Audit remaining service-role reads for missing project-membership checks. **Accept:** no service-role read returns cross-tenant data without a membership gate; documented inventory.
- **T2.3 Commit DB-applied migration files — issue #124.** Several tables applied directly to the DB (schedule Phase 4A–C, `durable_ai_turns`, `business_areas`, CRM set) have no committed migration → schema drift (already caused a bad merge in PR #183/#178). Reconstruct migrations from live schema (`lgveqfnpkxvzbnnwuled`) and commit. **Accept:** `supabase/migrations/` reproduces the live schema; drift check clean.
- **T2.4 db-console Management API token — issue #197.** `SUPABASE_MANAGEMENT_API_TOKEN` lacks access to `lgveqfnpkxvzbnnwuled` / `fqcvmfqldlewvbsuxdvz`, so `/db-console` 403s. Fix: issue a token from an account with access, set the env var. (Config/ops task; the code fix for surfacing the error already landed via #196.) **Accept:** `/db-console` lists tables.

---

## P3 — Real feature gaps (substantive builds from the audit)

- **T3.1 `[projectId]/reporting` — full stub.** Renders one card: "360 Reporting … Coming soon." Build the project reporting/analytics dashboard (define the reports with the owner; wire real queries). **Accept:** real reporting views, no placeholder.
- **T3.2 `[projectId]/commitment-pcos/[pcoId]` — WIP.** Edit button is `disabled` ("coming soon"); the Line Items tab is always empty. Add the edit form and wire the line-items API/table. **Accept:** edit works; line items load and edit.
- **T3.3 `[projectId]/prime-contracts/[contractId]/invoices/[invoiceId]` — WIP.** "Change History" tab is a coming-soon empty state. Implement invoice change-history tracking + the tab. **Accept:** change history renders real events.
- **T3.4 `/docs/ai-overview/models-and-cost` — WIP.** Spend section shows "Connecting to Langfuse" with `PlaceholderStat` "—" cells. Wire the Langfuse cost API; populate today/7d/30d spend. **Accept:** real spend figures.

---

## P4 — Mock surfaces: wire up or delete (decision + execution)

- **T4.1 Standalone invoice tool `(dashboard)/invoice/{list,add,edit,preview}` — all MOCK.** These render raw theme-template components (`ComponentsAppsInvoice*`) with no real data. Decision needed: (a) this duplicates the real project invoicing (`[projectId]/invoices`, `/invoicing`) → **delete** the 4 pages + components; or (b) it's meant to be a standalone quick-invoice tool → wire to real invoice data + backend. **Recommend delete** unless there's a business reason. **Accept:** no mock invoice pages, or fully wired.
- **T4.2 `/demo` — MOCK, delete candidate.** Hardcoded `workspaces`, SVG placeholders, `href="#"`, no-op buttons. Not in the site-map inventory. **Delete** unless it's an active sales demo. **Accept:** removed or wired.
- **T4.3 `/knowledge/app/prototype/{prime-contract,owner-invoice-prefill}` — throwaway prototypes.** Comments say "PROTOTYPE … throwaway" / "Nothing is saved." Remove, or promote to a real help feature. **Accept:** removed or promoted.
- **T4.4 `/roadmap` and `/updates` — static content (low priority).** `/roadmap` renders hardcoded arrays; `/updates` a hand-authored changelog. Likely intentional. Optional: back with DB/GitHub issues. **Accept:** decision recorded; no action required unless desired.

---

## P5 — Experiments & rollout decisions (product calls, then execute)

- **T5.1 `/ai-avatar` (Tavus experiment) & `/ai-workflow` ("Durable AI canary").** Decide: graduate into `/ai`, gate behind owner-only, or remove. **Accept:** each is either a real linked feature or deleted.
- **T5.2 `/training/own-your-growth` — MOCK/WIP.** Static `data.ts` content; "Save to Dashboard" writes localStorage only; "coming soon". It overlaps the *working* `/training/growth`. Reconcile: fold into `/training/growth` with real persistence, or remove. **Accept:** one growth surface, real persistence.
- **T5.3 `/recruiting/intake-test` — UAT preview.** Recruiter-only, disabled by default flag. Decide whether to ship the real candidate intake or keep gated. (Note: recruiting intake is also under active work — coordinate.) **Accept:** flag decision recorded.

---

## P6 — Minor polish (one disabled action each)

- **T6.1 `[projectId]/punch-list`** — implement PDF export (menu item disabled "(coming soon)"; CSV already works).
- **T6.2 `[projectId]/commitments/[commitmentId]`** — implement "Import" (currently `toast.info("Import coming soon")`); fix retainage invoice create returning 405.
- **T6.3 `[projectId]/budget`** — wire "Send to ERP" (currently "not connected yet" toast) + export/import.

---

## P7 — Large modules (original workstreams #4 and #5 — scope as phased sub-plans, not single PRs)

- **T7.1 ASRS / FM Global 8-34 Sprinkler Estimator — issues #74, #85, #86, #88, #89, #90, #91, #92.** A full estimating module: FM Global code → rule cards → sprinkler-head count → takeoff/estimating. Sequence: #86 spec → #88 spec intake/recovery → #89 exact-one rule-card matching (fail-closed) → #90 horizontal-IRAS review package → #91 activate deterministic head count → #92 cross-surface safety/release. Needs owner domain input. **Deliver as its own milestone with per-issue PRs.**
- **T7.2 Training-video generation — issues #51, #185, #187, #188, #189, #193.** Repeatable walkthrough-video generation (Remotion authoring + recorder hardening + non-dev in-app generation + optional TTS). Sequence: #185 durable recording target → #187 fix the create-prime-contract flow data/assets → #193 recorder readback bug → #188 in-app "Generate walkthrough video" → #189 TTS track → #51 spec/rollup. **Own milestone.**

---

## Coordinate — do NOT overwrite (original workstream #6)

These are on active branches owned by another author. Pair / review, don't fork:
- **Manager Coaching Session — PR #183 / `feat/manager-coaching-tool`.** Foundation merged (migration applied, API, launch screen). Remaining: 5-step session workspace + 2 dashboards. Offer to complete the workspace/dashboards *on that branch*.
- **AI Commitment Approval Workflow — `codex/ai-assistant-commitment-approval-workflow`** (no PR yet). Read the branch and continue it there.

---

## Housekeeping (outstanding from the route/de-bulk work)

- **H1 — Merge & wire PR #200 (orphan-route gate).** Add the CI step to `.github/workflows/quality-gate.yml` (bot couldn't — needs `workflows: write`):
  ```yaml
      - name: Check for orphaned top-level routes
        run: node frontend/scripts/build/check-orphan-routes.mjs
  ```
  (both `changed-quality` and `predeploy-gate` jobs) or append `&& node scripts/build/check-orphan-routes.mjs` to `quality:build-routes` in `frontend/package.json`.
- **H2 — Retire the legacy `/pcos` slice.** Confirmed dead (reads `potential_change_orders`: 1 row, frozen since 2026-04-01; children empty; canonical flow is `commitment_pcos` + `prime_contract_pcos`). Delete: `frontend/src/app/(main)/[projectId]/pcos/**` (page/new/[pcoId]/edit + loading/error), `frontend/src/hooks/use-pcos.ts`, `frontend/src/components/domain/pcos/*` (5 files), `frontend/src/app/api/projects/[projectId]/pcos/**` (8 route.ts). Remove the 2 stale `/pcos` entries from `frontend/src/lib/sitemap-utils.ts`. Regenerate maps (ground rule #2). Nothing canonical imports the slice (verified). Drop the `potential_change_orders` table only as a later follow-up. **Accept:** app builds; maps regenerated; no dead pcos references.
- **H3 — Other confirmed de-bulk (small).** Delete `drawings/viewer-v2/[drawingId]` (deprecated 0-ref redirect); resolve `/documents` vs `/project-documents` vs `/files` overlap (pick one canonical, redirect others); AI-surface consolidation (`/ai-dashboard` unlinked twin of `/ai/company-brain`; finish migrating `/ai-assistant` children then delete the shell). Reconcile with `docs/architecture/SCHEMA-CLEANUP-REVIEW-2026-07-27.md`.

---

## The original six → where they live in this plan

| # | Original workstream | In this plan |
|---|---|---|
| 1 | **Team Chat / messaging** (#23) | **P0** (expanded) |
| 2 | Auth-gate hardening (#140, #127) | P2 (T2.1, T2.2) |
| 3 | Migration hygiene + db-console token (#124, #197) | P2 (T2.3, T2.4) |
| 4 | ASRS / FM Global Estimator (#74, #85–92) | P7 (T7.1) |
| 5 | Training-video generation (#51, #185–189, #193) | P7 (T7.2) |
| 6 | Manager Coaching (#183) + AI Commitment Approval | Coordinate section |

## Suggested execution order
**P0 (messaging) → P1 (broken bugs) → P2 (security/data) → H1/H2 (finish route work) → P3 (feature gaps) → P4 (wire-or-delete) → P5/P6 (decisions + polish) → P7 (big modules, own milestones).**

*Coverage note: the page audit swept all 353 routes for incompleteness signals + read every flagged page, but did not line-by-line open all leaf pages — treat as ~95% coverage. Re-run the audit after P1–P6 to catch any mock-data page that lacked placeholder wording.*
