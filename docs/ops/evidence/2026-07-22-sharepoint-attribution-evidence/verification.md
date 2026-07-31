# AAI-1263 verification

## Confirmed SharePoint identity evidence

| Project | Job | Location | Evidence |
| --- | --- | --- | --- |
| Port Collective | 25-107 | Savannah, Georgia | [`05 - Proposal/2025.07.22 Precon & Design Estimate Port Collective R2.pdf`](https://alleato.sharepoint.com/sites/AlleatoGroup/Shared%20Documents/Alleato%20Group/Alleato%20Group-Shared/2025%20Jobs/25-%20107%20Port%20Collective%20(Savannah,%20GA)/05%20-%20Proposal/2025.07.22%20Precon%20%26%20Design%20Estimate%20Port%20Collective%20R2.pdf) |
| Union Collective | 26-119 | Union, Kentucky | [`04 - Estimate/Estimate Union Collective (Design).pdf`](https://alleato.sharepoint.com/sites/AlleatoGroup/Shared%20Documents/Alleato%20Group/Alleato%20Group-Shared/2026%20Jobs/26-119%20-%20Union%20Collective%20(Union,%20KY)/04%20-%20Estimate/Estimate%20Union%20Collective%20(Design).pdf); [`05 - Proposal/Union Collective Proposal.pdf`](https://alleato.sharepoint.com/sites/AlleatoGroup/Shared%20Documents/Alleato%20Group/Alleato%20Group-Shared/2026%20Jobs/26-119%20-%20Union%20Collective%20(Union,%20KY)/05%20-%20Proposal/Union%20Collective%20Proposal/Union%20Collective%20Proposal.pdf) |
| Space Coast Town Center | No registered project found | West Melbourne, Florida in the full transcript | Neither the Port nor Union proposal/estimate identity supports assigning this source to those projects. |

## Focused contract

Command:

```bash
node --test \
  project-intelligence/core/__tests__/project-attribution-evidence.test.mjs \
  project-intelligence/core/__tests__/daily-brief-v3.test.mjs \
  project-intelligence/ingestion/__tests__/daily-source-corpus.test.mjs \
  project-intelligence/core/__tests__/executive-synthesis-module.test.mjs
```

Result: PASS, 29 focused SharePoint and synthesis-attribution tests; PASS, 96
tests in the independent full Node
Project Intelligence gate. The dedicated SharePoint contract covers real Port and
Union path variants, profile creation, unavailable evidence, correct
assignments, evidence-backed reassignment, poisoned metadata links,
missing-profile fail-closed behavior, body-only conflicts, unregistered entity
labels, and the Space Coast/Port regression. The learning registry audit also
passes all 24 fingerprints. Independent adversarial review: APPROVED with no
findings after reproducing and closing loose body-token and email-header/token
false positives.

## Controlled live source-only run

Command:

```bash
node project-intelligence/core/compile-daily-executive-brief.mjs \
  --date 2026-07-21 --sources-only --no-write \
  --evidence-dir docs/ops/evidence/2026-07-22-sharepoint-attribution-evidence/source-only-final
```

Result: PASS.

- 625 eligible rows enumerated across two pages; 625 fetched and unique.
- 224 full sources materialized; 1,831,339 source characters accounted for;
  zero critical materialization failures.
- A bounded Microsoft Graph sync materialized 18 authoritative files with
  SharePoint URLs: 9 Port proposals, 5 Union estimates, and 4 Union proposals;
  zero sync failures.
- Post-sync SharePoint evidence receipt: complete; 131 candidate metadata rows
  checked; 25 proposal/estimate rows accepted into 6 project profiles.
- Before the source correction, source `S12`, `FW: Space Coast OTP Review`,
  entered with `projectId=34` / Port Collective and left the gate with
  `projectId=null`, `attributionLabel=Space Coast Town Center`, and
  `attributionStatus=unresolved_conflict`.
- Its conflict receipt now carries the actual Port job `25-107`, Savannah,
  Georgia proposal paths and SharePoint URLs as the evidence disproving the
  Port assignment.
- The model-facing chunk contract uses `Space Coast Town Center`; it cannot use
  Port Collective for that source after the gate.
- The exact bad source row `01KY0HFE665Z1STG28FRGFR22Y` was then corrected in
  both the application and RAG databases from Port (`34`) to `project_id=null`.
  Transactional readback confirmed one row in each store.
- A post-correction source-only run still preserved
  `projectName=Space Coast Town Center`,
  `attributionLabel=Space Coast Town Center`, and
  `attributionStatus=unregistered_entity`; no stale project assignment is
  required for the label to survive.
- That run also exposed four pre-existing Goodwill Commons SharePoint rows whose
  stored `project_id` disagrees with folder job `26-102`; the gate used the
  folder-resolved identity and recorded the linkage conflicts instead of
  allowing them to poison another profile.
- Forty-nine sources assigned to projects without an indexed proposal/estimate
  profile and without an exact title confirmation were marked
  `unverified_no_sharepoint_profile` and de-attributed before model input. This
  is deliberate fail-closed behavior: incomplete SharePoint coverage reduces
  specificity instead of creating confident but unsupported project claims.

## Rejected synthesis and added publication guard

The first full controlled regeneration exited zero but was rejected during
manual readback. Packet `4c99f541-1790-4556-8392-b28066386baa` had correct
source metadata for S11/S12, yet the model produced a combined
`Space Coast Town Center / Port Collective` report heading and a structured
Port entry citing Space Coast evidence. The packet was immediately marked
`stale` and is not accepted as evidence of completion.

This exposed a second detection gap: correct input attribution did not constrain
model output. The compiler now de-attributes a SharePoint-backed assignment when
the full source never names that identity, supplies a complete
`sourceProjectIndex` to both synthesis stages, and rejects merged headings or
cross-project citations. Direct replay of the rejected report and JSON now
fails both deterministic validators. A new source-only run has zero Port
sources and only S11/S12 under Space Coast Town Center.

The first exact-heading rerun then failed closed on two legitimate unassigned
citations: the portfolio estimating meeting explicitly discussed Union
Collective, and an email titled `Play Makers` explicitly supported Playmakers.
The final contract records `mentionedProjectLabels` from exact full-text names
or exact contiguous compact title tokens. Unassigned sources can use that narrow
exception; differently labeled sources cannot. A false-positive regression for
`Play Makership` proves substring matches are rejected. Loose token
co-occurrence, email addresses, and related-looking threads do not qualify;
the Dallas fire-alarm messages remain unassigned and the model must use the
separately labeled Ulta Dallas source for project-scoped claims. These fields
and the SharePoint evidence links now persist in
`packet_json.sourceSet.sources`.

A subsequent strict controlled run failed before persistence because the
detailed-report draft placed unassigned sources `S137` and `S149` under
Playmakers and Ulta Dallas. The attribution gate correctly blocked it. That run
exposed a retry-conversation defect: repair instructions named the invalid
citations but did not include the failed draft the model was expected to edit.
Detailed and structured retries now append the failed candidate as the prior
assistant turn before the exact repair instruction, then re-run the same strict
validators. Independent review approved this change; the guard was not relaxed.

## Accepted controlled regeneration

The final unchanged controlled command exited zero and published packet
`e7e55360-bfa2-455c-b012-2c7f3cb817e1` for business date `2026-07-21`.

- Packet state: `current`, `fresh`, run contract `completed`.
- Scheduler run `c4150e6d-5100-444e-9ba3-439a3e19fff9`: `succeeded`, attempt
  26, no blocker or failure.
- Persisted `briefMarkdown` exactly matches the generated artifact: 27,961
  characters, SHA-256
  `e07f6dc25df17f72ebfcd7e3070713e065b7f537b87036eeef44b1009ac701a1`.
- Detailed, structured, and attribution validators all pass.
- Port Collective appears in zero source labels, mentions, project blocks,
  claims, headings, or generated artifacts.
- `S12` persists as `Space Coast Town Center` / `unregistered_entity`;
  `S149` and `S165` remain unassigned with no project mention and are not cited
  in the detailed report.
- Corpus receipt: 625 eligible/fetched/unique rows, 224 sources materialized,
  1,831,339 source characters equal model-input characters, zero truncation or
  critical failures, and all four lanes accounted for.
- SharePoint receipt: complete; 131 rows enumerated, 25 proposal/estimate rows
  accepted, 6 profiles, 62 corrections, and zero unresolved conflicts.
- Consumer readback: 16 review candidates, 14 generated tasks, 7/7 project
  current-state records, and 7/7 progress reports with zero rejection or
  missing project IDs.
- Release readback: `origin/main`
  `c35cf4997469e35fe46d74e72adfa7cd68bef400`; Render deployment
  `dep-d9ggptf7f7vs73f5nkgg` is live on canonical cron
  `crn-d827chojs32c73doj780` at the same commit.

The raw source corpus is intentionally not committed because it contains full
business communications. The governed runtime evidence directory and packet
retain source receipts without placing source prose in Git.

## Provider/type gate note

The required Supabase type-generation command was attempted before database
query implementation and returned `LegacyPlatformAuthRequiredError` because
`SUPABASE_ACCESS_TOKEN` is not available to the CLI. The existing generated
`database.types.ts` was inspected and confirms the queried
`document_metadata` columns. This task does not alter schema.
