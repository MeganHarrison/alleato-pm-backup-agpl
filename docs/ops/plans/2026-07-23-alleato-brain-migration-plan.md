# Alleato Brain — Migration Plan (for approval)

Date: 2026-07-23
Status: **Implementation is complete through the additive data/access
foundation, safe Phase 3 retrieval and ingestion contracts, and the Phase 4
Brain UI. Phase 2 remains owner-gated; Phase 5 and Phase 6 require real elapsed
run windows. No owner-gated content relabel, routing activation, project
archival, or cutover has occurred.**
Delivery lane: High-risk (schema change, permissions, AI/RAG, migration)

### Implementation checkpoint — 2026-07-24

Completed and published:

- Phase 0 inventory and classification.
- Phase 1A/1B Business Area tables, permanent project map, operational scope,
  migration ledger, generated types, and restrictive read/write guards.
- Safe Phase 3 prerequisites: archived-project routing guard, typed scope
  persistence, exact app/RAG scope reconciliation, server-side Business Area
  search filtering/authorization, and parallel mapped reads.
- Phase 4 `/brain` and `/brain/[businessAreaId]` UI, including Knowledge,
  Meetings, Tasks, Files, branch-scoped upload, source links, internal-user
  admission, and Finance fail-closed behavior. The release is on
  `origin/main` at `83ea23c6d4ca881795b25956316ab99c286d9452`;
  its task closeout is `20cc518d01aa7ed8e0ab8412e1b225e375b93df7`.

Explicit remaining gates:

- Phase 2 cannot mutate content or access until Linear records the five branch
  owners, exact Finance membership, and task disposition. None are inferred.
- Remaining Phase 3 rule cloning/activation and comparison mode follow the same
  owner gate. The Fireflies typed-scope source fix is published and live drift
  was repaired, but provider-level deployment revision and one clean scheduled
  run remain uncertified because no Render API credential, CLI, or connector is
  available and production health does not expose a Git SHA.
- Phase 5 requires a minimum of two actual weeks of daily comparison evidence.
- Phase 6 requires seven consecutive days with zero new records in the five
  containers plus owner sign-off before any XOR cutover or archival.

This checkpoint supersedes older “in progress” wording below where it describes
Phase 1 or the UI. It does not waive Appendix B or either elapsed-time gate.

Decision log: the original draft put internal files in a new SharePoint
site. On 2026-07-23 the owner chose the **Alleato Brain** direction
instead: a proper section inside the PM app where company knowledge
lives, organized into "branches" (departments). SharePoint is out of
scope for now and can be added later without rework. This document is
written in plain language; technical detail is boxed for the engineer.

Plan-review corrections made 2026-07-23:

- The two-week parallel run deliberately permits migrated rows to carry
  both the old project label and the new branch label. The final
  project-XOR-branch constraint is installed and validated only at
  cutover, after the old label is cleared.
- Meetings, tasks, and linked files are first-class migration records,
  not inventory footnotes. They receive branch scope and explicit
  permissions so archiving the five containers cannot strand them.
- Attribution rules gain a real branch target. Branch rules are cloned
  from the 43 active project rules, verified, and only then are the old
  rules deactivated.
- Product direction is approved, and the additive Phase 1A foundation
  may proceed. Phase 2 content/access migration cannot start until the
  named branch owners, Finance membership, and task disposition gate
  in Appendix B are recorded.

---

## 1. Diagram of the current setup (how it works today)

```text
                          MICROSOFT 365 + FIREFLIES
   ┌────────────┬────────────┬────────────┬────────────┬──────────────┐
   │  Outlook   │   Teams    │ SharePoint │  OneDrive  │  Fireflies   │
   │  email     │  messages  │ (2 folders │ (disabled) │  meeting     │
   │            │            │  sync now) │            │  transcripts │
   └─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴──────┬───────┘
         └────────────┴─────┬──────┴────────────┴─────────────┘
                            ▼
              AUTOMATIC IMPORT ("the photocopier" —
              runs on timers, every 15 min – 2 hours)
                            │
                            ▼
              "WHERE DOES THIS BELONG?" ENGINE
              (matches keywords, names, folders,
               contacts against the PROJECTS list)
                            │
              ┌─────────────┼─────────────────────┐
              ▼             ▼                     ▼
        REAL PROJECTS   FAKE PROJECTS        NO PROJECT
        (real jobs)     (labels wearing      (unassigned —
                         a project costume)   invisible to most
          Projects      756 Leads             users in AI chat)
          page shows    767 Alleato AI
          these too     60  Finance    ◄── the problem
                        90  Internal Ops
                        89  Marketing
                            │
                            ▼
              AI SEARCH INDEX (searchable copies)
              • every copy is stamped with a project ID
              • the stamp decides who can see it
              • originals stay in Microsoft 365 / Fireflies
                            │
                            ▼
                    ALLEATO AI CHAT
```

**Why this hurts:** the Projects page mixes real jobs with five filing
cabinets, and the routing engine guesses "which project?" for every new
email, meeting, and file — the fake projects are attractive guesses
because auto-created rules point at them.

---

## 2. Diagram of the proposed setup (target)

```text
                          MICROSOFT 365 + FIREFLIES
   (unchanged: Outlook, Teams, SharePoint sync, Fireflies)
                            │
                            ▼
              AUTOMATIC IMPORT (same timers as today)
                            │
                            ▼
              "WHERE DOES THIS BELONG?" ENGINE — upgraded
              Now stamps each copy with one of:
                                  │
              ┌───────────────────┴────────────────────┐
              ▼                                        ▼
        REAL PROJECTS                    ALLEATO BRAIN (new section)
        (real jobs only)                 Branches:
        Projects page shows ONLY these   • Leads
                                         • AI
                                         • Finance (restricted)
                                         • Internal Operations
                                         • Marketing
                                         (+ more branches as needed)
                                         Never appears on Projects page
                                  │
                                  ▼
              AI SEARCH INDEX (same index, kept)
              every copy stamped with a project OR a branch
                                  │
                                  ▼
                    ALLEATO AI CHAT
              (answers still link back to the original
               email / Teams message / transcript / file)
```

**What changes for people:**

- Projects page: only real jobs.
- New "Alleato Brain" section: browse company knowledge by branch;
  upload files straight into a branch; Finance branch locked to
  authorized people.
- AI chat: same box, same answers — now organized by branch.

---

## 3. The fake projects and what each contains

Live inventory run 2026-07-23 (read-only; reproducible with
`node scripts/database/inventory-internal-projects.mjs --all-projects`).

### 3a. Contents of the five internal records

| | 756 Leads | 767 Alleato AI | 60 Finance | 90 Internal Ops | 89 Marketing |
| --- | --- | --- | --- | --- | --- |
| Searchable documents | 46 | 14 | 1,302 | 242 | 511 |
| — of which Teams messages | 0 | 1 | 999 | 7 | 494 |
| — of which emails (+attachments) | 36 | 8 | 103 | 18 | 10 |
| — of which meeting transcripts | 7 | 0 | 174 | 195 | 7 |
| — of which files (SharePoint/upload/other) | 3 | 5 | 26 | 22 | 0 |
| Meetings (app records) | 8 | 0 | 175 | 153 | 7 |
| Tasks | 8 | 0 | 14 | **187** | 0 |
| Files linked to the project | 3 | 1 | 71 | 19 | 1 |
| AI search chunks | 695 | 9 | 5,763 | 5,981 | 203 |
| People listed as members | 2 | 5 | 2 | 2 | 2 |
| Last new item received | 2026-07-22 | 2026-06-26 | **2026-07-23 (today)** | **2026-07-23 (today)** | 2026-07-01 |
| Active routing rules pointing at it | 11 | 2 | 18 | 9 | 4 |

Totals across the five: **2,115 searchable documents, 343 meetings,
209 tasks, 95 linked files, 12,651 AI search chunks.**

Notes that shape the plan:

- **Finance (60) and Internal Ops (90) are still growing daily** —
  routing must be redirected *before* archiving, or the gap list grows.
- The five containers also own **343 meeting records, 209 tasks, and
  95 linked files**. Relabeling only the searchable copies would strand
  those records behind archived projects, so the migration adds branch
  scope to all three record types. Tasks remain workflow items, not
  knowledge; open-task ownership is a required approval gate.
- **Internal Ops (90) holds 187 of the 209 tasks** and 153 meetings.
  None are deleted. Open tasks move to the Internal Operations branch
  unless an owner explicitly reassigns them to a real job during the
  parallel run; completed/canceled tasks retain their status and audit
  history.
- **Alleato AI (767) is nearly empty** (14 documents) and doubles as a
  test-fixture project for internal scripts; those scripts are
  repointed during Phase 4.
- Most "documents" on 60/89 are Teams messages — originals stay in
  Microsoft 365; only their labels change.

### 3b. Routing rules that feed the five projects (43 active)

57 rules point at the five projects; 43 active, e.g.:

- → Finance (60): "Payroll holiday reminder", "Credit Card
  Reconciliation", "timesheet export", "BILL.com connection" (18 rules)
- → Internal Ops (90): "Sprinkler Division Morning Huddle",
  "Employees declining Health Insurance" (9 rules)
- → Leads (756): "Intro Asset Alliance group", "Chad Hobson",
  "Liverpool Building Pricing" (11 rules)
- → Marketing (89): "Planning the upcoming video shoot" (4 rules)
- → Alleato AI (767): name rules only (2 rules)

The generic auto-created rules ("Finance" keyword, "Marketing" keyword,
bare project-name phrases) were already switched off by a previous
cleanup — **deactivation is the established, reversible way to retire a
rule**, and Phase 4 reuses it: rules are repointed to branches or
deactivated, never deleted.

### 3c. Classification review of ALL projects (the "don't assume" check)

113 projects reviewed:

- **Fake (the five known):** 756, 767, 60, 89, 90 — confirmed knowledge
  containers.
- **Marked "Internal" but appear to be REAL jobs — DO NOT TOUCH:**
  98 *Seminole Collective* (60 docs, Hospitality), 58 *Paradise Isle
  Geotech* (22 docs), 766 *Forza Dayton* (6 docs, New Build). These look
  like real work merely typed "Internal" — flagged for owner
  confirmation; a tiny separate cleanup, outside this migration.
- **Visible test junk (out of scope, optional cleanup):** 1142 "Test
  July 2026" and 889 "Test-Zaryll-04-09-2026" are un-archived and show
  on the Projects page; archiving them is a one-click optional extra.
- **Everything else (~100 projects):** real jobs — untouched.

### 3d. The unassigned pool (context, not scope)

~30,000 searchable items currently have **no project at all**
(24,855 Teams messages, 3,545 emails/attachments, 486 transcripts,
732 files) and are effectively admin-only in AI chat today. The branch
machinery gives a natural future home for the internal ones — an
optional follow-up, not part of this migration.

---

## 4. The Alleato Brain design

**What it is:** a new top-level section in the app — "Alleato Brain" —
the single home for company knowledge. It contains **branches**
(departments). It is not a project, does not reuse the projects table,
and never appears on the Projects page or in project dropdowns.

**Branches at launch:** Leads · AI · Finance (restricted) · Internal
Operations · Marketing. New branches are a simple admin action
("create other brain branches as needed" is a design goal, not a
migration).

**What each branch contains:**

- All the searchable copies that are stamped with that branch:
  documents, emails, Teams messages, meeting transcripts.
- Branch-scoped meeting records, tasks, and linked files formerly
  attached to the five container projects. They retain their IDs,
  status, owners, dates, lineage, and source links.
- Files uploaded directly into the branch (stored in the app's file
  storage — the mechanism already used by today's knowledge uploads).
- Clear labels on every item: branch, date, document type, source
  (where the original lives), and a source link.

**Permissions:**

- Everyone sees Leads / AI / Internal Ops / Marketing branches.
- Finance is restricted to a named Finance-authorized group.
- Branch permissions are enforced in the AI too: asking the assistant
  about finance only works for authorized people.

**Ownership:** each branch gets a named owner who approves membership
and watches over content quality. (Names needed — Appendix B.)

**What stays in Microsoft 365:** emails and Teams messages (originals),
as today. Meeting transcripts stay in Fireflies. The Brain holds the
searchable copies and links — exactly how the AI already works.

> Technical note for the engineer: this builds on existing foundations —
> `document_metadata` (with its `category`, `access_level`, source-*
> link columns), the `/knowledge` pages and `/api/knowledge` upload
> route, and the existing SharePoint/Outlook/Teams/Fireflies sync jobs.
> The Brain is the Business Area dimension made visible; the import
> machinery is untouched. (Original SharePoint-site variant is preserved
> in git history of this document if ever revisited.)

---

## 5. Required PM application changes

Plain language first:

1. **Add the branch label.** A new internal list (the five branches),
   plus a "membership" list per branch for permissions. Hidden from
   anything project-shaped.
2. **Every record gets a home:** a real project *or* a branch (or
   neither). New records never get both. Migrated records temporarily
   carry both labels during the measured parallel run; cutover clears
   the old project label and then validates the final XOR constraint.
3. **Permissions follow the label.** Project members see project items;
   branch members see their branch; Finance items only the Finance
   group. (Today almost everything is readable by everyone due to a
   legacy "team" flag — the Finance restriction is a genuine security
   *improvement*, and testing ensures nothing else tightens by
   accident.)
4. **The router learns branches.** New emails/meetings/files for
   internal topics get stamped with a branch instead of a fake project.
   The 43 rules pointing at fake projects are repointed or switched off
   (reversible).
5. **The AI searches both kinds of homes** and keeps linking to
   originals.
6. **Build the Brain section UI** on top of the existing knowledge
   pages: branch browsing, search, upload-into-branch, source links.
7. **Fix a real bug found during this investigation:** the routing
   engine currently ignores the archived flag, so even archived
   projects keep receiving auto-filed items. Fixed as part of this work
   — otherwise archiving the fake projects would not stop the flow.

<details>
<summary>Technical box — for the engineer (click to expand)</summary>

Schema (foundation migration plus a cutover guardrail migration):

- New table `business_areas` (`id`, `key` slug, `name`, `description`,
  `is_restricted`, `owner_person_id`, timestamps), seeded: leads, ai,
  finance, internal-operations, marketing.
- New table `business_area_memberships` (`business_area_id`,
  `person_id`, `role`).
- Permanent `business_area_project_map` and per-run migration ledger
  record the old project, new branch, record type/ID, run ID, result,
  and rollback state.
- `document_metadata`, `meetings`, `tasks`, and `files`: add nullable
  `business_area_id` FK plus partial indexes. `meetings.project_id`
  becomes nullable because a Brain meeting is not a construction-job
  meeting.
- During the parallel run, migrated rows may carry both `project_id`
  and `business_area_id`. New ingestion enforces XOR in application
  code immediately. At cutover, a second migration clears the mapped
  legacy `project_id` values and adds/validates database XOR checks.
- RAG DB `document_chunks.metadata` gains `business_area_id` during
  metadata refresh — no re-embedding. It may retain the legacy project
  field during comparison mode; cutover renames that audit value to
  `legacy_project_id` so production retrieval cannot treat it as scope.
- `project_attribution_rules`: add nullable `business_area_id`, make
  `project_id` nullable, and enforce exactly one target for active
  rules. Create branch-target clones of the 43 active rules; do not
  mutate or delete the source rules.

RLS / permissions:

- `current_is_business_area_member()` helper mirroring
  `current_is_project_member()`; add branch-member policies to
  `document_metadata`, `meetings`, `tasks`, and `files`.
- Non-restricted branches retain existing team visibility. Finance
  rows become `access_level='restricted'` where supported and require
  Finance membership in every API, RLS policy, and AI retrieval path.
  The service role is not accepted as end-user authorization.

Retrieval / tools (`frontend/src/lib/ai/`):

- `guardrails.ts`: compute `allowedBusinessAreaIds` alongside
  `allowedProjectIds`.
- `rag-search-tools.ts`, `shared-search-helpers.ts`: keep chunks whose
  `business_area_id` is in scope (this is the proper replacement for
  the "NULL project = admin-only" trap).
- `search_document_chunks` RPC: optional `filter_business_area_id` on
  `metadata->>'business_area_id'`.

Ingestion / routing (`backend/src/services/`):

- `project_assignment.py`: exclude archived projects (the bug); add the
  branch branch — internal content resolves to `business_area_id`.
- `project_attribution_rules`: loader returns a typed target
  (`project_id` or `business_area_id`). Clone the 43 active rules to
  branch targets; compare decisions; deactivate old rules only after
  the branch rules pass.
- `outlook.py` `not_project` taxonomy: set `business_area_id`
  (e.g., payroll mail → Finance branch).
- `communication_project_backfill.py`: same branch logic for the
  NULL-sweeper.
- SharePoint/OneDrive folder→project matching untouched (two existing
  sync folders keep working; internal ones get branch mapping).

UI (`frontend/src/`):

- New `(main)/brain` route group + nav entry: branch list page, branch
  detail page with quiet tabs for Knowledge, Meetings, Tasks, and
  Files; search + upload live in the relevant canonical table/toolbars.
  Restricted-branch handling fails closed with an actionable access
  message. Built on the existing `features/knowledge`, meetings, tasks,
  and files owners; follows the alleato-table-page / detail-page
  patterns and the noise gate (no stat cards, no decorative wrappers).
- `/knowledge/company` keeps working during transition; decide at
  cutover whether it redirects into the Brain.
- Projects list: no change needed once fake projects are archived.

</details>

---

## 6. Step-by-step migration plan

**Phase 0 — Inventory & classification (DONE 2026-07-23)**
Read-only inventory complete; five containers confirmed; three
"Internal"-typed real jobs identified and excluded. ✔

**Phase 1 — Branch records & schema (COMPLETE 2026-07-24; no user-visible change)**

1. **Phase 1A — foundation (complete):** add `business_areas`,
   memberships, permanent fake-project → branch mapping
   (756→Leads, 767→AI, 60→Finance, 90→Internal Operations,
   89→Marketing), `document_metadata.business_area_id`, and additive
   branch-member RLS. Existing rows remain unchanged.
1. **Phase 1B — operational scope (complete):** add branch scope to meetings,
   tasks, files, and attribution rules; add the per-run migration
   ledger. Do not add final XOR checks yet.

**Phase 2 — Relabel existing content (nothing moves, nothing deletes)**

1. Stamp the 2,115 documents + 12,651 search chunks with their branch
   label. **Old project stamps stay in place during testing.**
1. Stamp 343 meetings, 209 tasks, and 95 linked files with their branch
   label while retaining the old project label for comparison.
1. Finance-branch records get restricted access across every migrated
   record type.
1. Checkpoint: counts before/after match per branch and record type
   (Section 7); every mutation is present in the run ledger.

**Phase 3 — Rewire routing, permissions, and search (safe prerequisites
complete; activation owner-gated)**

1. Clone the 43 rules to branch targets; fix the archived-project bug;
   compare routing decisions before deactivating the source rules.
1. Update AI search scope + RLS; repoint the internal test scripts that
   default to project 767/89/60.
1. Deploy in comparison mode; old and new labels now coexist.

**Phase 4 — Brain section UI (COMPLETE 2026-07-24)**

1. Ship the Brain section (branch list; Knowledge, Meetings, Tasks,
   Files tabs; upload; restricted Finance). People can now browse by
   branch without using a fake project.

**Phase 5 — Parallel run (minimum 2 weeks)**

1. Old projects still visible; Brain fully active. Daily automated
   comparisons (counts, routing decisions, sample AI answers). Fix
   discrepancies. Branch owners triage open tasks during this phase.

**Phase 6 — Cutover and archive**

1. Verify zero new records into the five projects for 7 consecutive
    days and obtain owner sign-off for every branch.
1. In one auditable cutover: clear mapped legacy `project_id` values,
    rename retained chunk audit metadata to `legacy_project_id`, add
    and validate XOR checks, and verify all counts and permissions.
1. Archive the five projects (vanish from Projects page; nothing
    deleted). Optionally archive the two visible test projects.
1. Keep the permanent fake project → branch mapping and run ledger in
    the database and this document.

---

## 7. Testing checklist

Data integrity

- [ ] Document, chunk, meeting, task, and file counts before == after,
      per fake project/branch and grand total; zero unexplained
      differences.
- [ ] Every relabeled item keeps: original date, source link, and its
      old project stamp (until final cutover).
- [ ] Zero items left with neither project nor branch that had one
      before.
- [ ] During comparison mode, only mapped migration rows may carry both
      scopes; new records with both scopes fail loudly.
- [ ] After cutover, database XOR checks validate and no production
      retrieval path treats `legacy_project_id` as authorization scope.

AI search quality

- [ ] ~25 fixed real questions produce equivalent answers before vs
      after (recorded side by side).
- [ ] A new item in each branch appears in AI answers within one sync
      cycle.
- [ ] Every AI answer still links to its original source.

Permissions

- [ ] Finance branch invisible to non-authorized users (UI **and** AI),
      including documents, meetings, tasks, and files; verified with
      both kinds of accounts.
- [ ] Non-admins otherwise see exactly what they saw before.
- [ ] Project-scoped searches don't leak company knowledge and vice
      versa.

Routing

- [ ] New emails/meetings/Teams items land on the correct branch
      (sampled daily during parallel run).
- [ ] Every active attribution rule has exactly one typed target;
      project-rule and branch-rule decisions match before deactivation.
- [ ] The five fake projects receive **zero** new items for 7
      consecutive days before archiving.
- [ ] Archived projects receive nothing (regression test for the bug).

Brain UI

- [ ] Branches never appear on the Projects page, project dropdowns, or
      project pickers anywhere.
- [ ] Upload-into-branch works and the file is searchable + linked.
- [ ] All 343 meetings, 209 tasks, and 95 linked files remain reachable
      from their branch after the old projects are archived.
- [ ] Creating a new branch is an admin action with no code change.

Parallel run (2 weeks minimum)

- [ ] Daily automated count comparison old vs new — no growing gaps.
- [ ] Weekly sign-off; discrepancies fixed same week.

---

## 8. Rollback plan

Nothing is deleted until the end, and even then we archive.

| If this goes wrong | What we do |
| --- | --- |
| Relabeling errors | The run ledger identifies every touched row; clear only that run's branch stamps and replay. Old project stamps remain during comparison mode. |
| New routing mis-files items | Reactivate the original project-target rules (they were cloned and deactivated, not mutated/deleted) and switch the typed-target feature flag back. |
| AI search worse | Revert the search-scope change (single deploy); old behavior intact because project stamps were never removed during testing. |
| Finance too tight/loose | Edit the branch membership list (one table) — no deploy needed. |
| Brain UI problems | Hide the nav entry (one config); all data and AI behavior unaffected. |
| Total failure late in the run | Use the run ledger and permanent project→branch map to restore project scope, un-archive the five projects, and reactivate the source rules. |

Every migration step logs the records it touched (a run ledger), so any
step can be replayed or reversed precisely.

---

## 9. Estimated level of effort

| Phase | Effort |
| --- | --- |
| 0. Inventory + classification | done |
| 1. Branch schema + records | 2–3 days |
| 2. Relabeling existing content | 3–4 days |
| 3. Routing, permissions, AI search changes | 4–6 days |
| 4. Brain section UI | 4–5 days |
| 5. Parallel run (2 weeks calendar) | 2–3 days monitoring/fixes |
| 6. Cutover, archive, records | 0.5–1 day |
| **Total** | **≈ 15–22 working days over ~4–5 calendar weeks** |

Biggest uncertainties: tuning the 43 repointed routing rules (Phase 3)
and sample-answer tuning in Phase 5. Optional SharePoint file home
later: +1–2 days, no rework of this plan.

---

## 10. Plain-English explanation for Megan and management

**What's wrong.** Our project-management app treats everything as a
"project." To give the AI a place to file company information, we
created five fake projects — Leads, AI, Finance, Internal Ops, and
Marketing. They work, but they clutter the Projects page, and the
software that auto-files new emails and meetings can put company
information in the wrong "project."

**What we're doing.** We're building a proper home inside the app
called **Alleato Brain** — a section for company knowledge, organized
into branches (one per department, more can be added anytime). Finance
gets its own locked branch. Behind the scenes, the AI already keeps a
searchable copy of every email, Teams message, transcript, and file;
we're simply replacing the fake-project label on those copies with a
proper branch label. The meetings, tasks, and linked files currently
attached to those five containers receive the same branch scope, so
nothing becomes unreachable when Projects becomes jobs-only.

**What people will notice.** A clean Projects page. A new Brain section
where company knowledge is easy to browse by department. The AI answers
questions exactly as before — and still links back to the original
email, message, transcript, or file.

**What we are not doing.** We're not deleting anything — the five old
placeholder projects stay available while we prove the new system, then
they're archived (hidden, recoverable), never deleted. We're not
rebuilding the AI or changing how information flows in; the imports,
the search index, and the assistant all keep working.

**How we know it worked.** Old and new run side by side for at least
two weeks. We compare counts daily, re-ask a fixed set of questions to
confirm answers stay correct, verify new items land in the right
branch, and confirm Finance stays restricted. Only when all of that
passes do we hide the old placeholders.

**Risk if we do nothing.** More company information keeps piling into
fake projects, the Projects page gets noisier, and a known bug keeps
auto-filing new items into even *archived* projects — the mess grows
on its own.

---

## Appendix A — Key findings from the code investigation (evidence)

- The routing engine (`project_assignment.py`) assigns projects by
  name/keyword/contact matching and **ignores the archived flag** —
  archiving alone does not stop new assignments. The fake projects are
  fed by 43 active rules (payroll, timesheets, sprinkler huddles,
  vendor setup, etc.).
- AI search permissions are enforced in the application layer by
  project membership lists. Items with **no** project are invisible to
  non-admins in AI chat — which is why blanking project IDs is not an
  option, and why the branch label is the right fix.
- In practice every searchable document today carries a legacy "team"
  visibility flag (confirmed 2026-07-23: 42,429 of 42,429 rows), so RLS
  lets everyone read almost everything. The Finance restriction is new,
  real protection — tested explicitly so nothing else tightens by
  accident.
- Deleting the five projects is not safe: foreign keys would block it,
  and related tables would cascade-delete meetings and AI records.
  Archiving is the correct end state.
- The app already has the foundations the Brain builds on: knowledge
  upload/list APIs, `/knowledge` pages, and scheduled syncs for
  Outlook, Teams, Fireflies, and two SharePoint folders.
- `meetings.project_id` is currently required while `tasks.project_id`
  and `files.project_id` are nullable. All three need explicit branch
  scope; otherwise archiving hides operational records even if their
  searchable copies were migrated.
- `project_attribution_rules.project_id` is currently required. Branch
  routing therefore needs a schema target, loader contract, and
  exactly-one-target guardrail before any rules can be repointed.
- Hardcoded couplings to repoint in Phase 3: test/smoke scripts
  defaulting to project 767/89/60, and display-label mappings in the
  executive brief.

## Appendix B — Open questions for the owner

The following are approval gates, not implementation guesses. The
additive Phase 1A foundation may proceed, but Phase 2 content/access
migration cannot start until items 1–3 are recorded in Linear.

1. Names of the five branch owners (one per department)?
2. Who exactly is in the Finance-authorized group? Membership must be
   verified with an authorized and unauthorized test account before
   Phase 2 changes Finance access.
3. Confirm the three "Internal"-typed projects that look like real jobs
   (98 Seminole Collective, 58 Paradise Isle Geotech, 766 Forza Dayton)
   are indeed real — we'll leave them untouched either way.
4. Confirm the default task disposition: all 209 tasks receive branch
   scope; open tasks remain open in the corresponding branch unless an
   owner reassigns them to a real job during the parallel run.
5. Optional: archive the two visible test projects (1142 "Test July
   2026", 889 "Test-Zaryll-04-09-2026") as part of this cleanup?
6. Navigation: should "Alleato Brain" get a top-level sidebar entry, or
   live under the existing Knowledge menu? (Recommendation: top-level —
   it's a primary destination.)
7. Later option (not blocking): add a SharePoint "Alleato Knowledge"
   file home for official document copies? The Brain works with or
   without it.
