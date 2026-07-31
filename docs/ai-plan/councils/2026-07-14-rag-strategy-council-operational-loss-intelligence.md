# RAG Strategy Council: Operational Loss Intelligence

Date: 2026-07-14
Status: Proposed plan with corrected Deep Read baseline; source-level historical analysis not yet run
Council question: How should Alleato use meetings, email, Teams messages, and operating data to identify the recurring breakdowns that cost the most time, money, productivity, and client trust, then select AI or automation systems that measurably prevent them?

## Executive Decision

Build an **Operational Loss Intelligence** program on top of Alleato's existing
communications ingestion, evidence, Daily Deep Read, candidate-review, and
packet-first intelligence architecture.

Do not start by building another chatbot, changing embeddings, or asking Brandon
to describe all of the problems from memory. Start with a 180-day retrospective
that reconstructs concrete **failure episodes** from the source record. Each
episode must connect:

1. what was expected,
2. what actually happened,
3. the first observable breakdown,
4. the downstream consequence,
5. evidence from the original sources,
6. an impact estimate,
7. confidence in the causal explanation, and
8. whether the breakdown was preventable.

Cluster those episodes into recurring patterns only after extraction. Rank the
patterns by annualized burden, recurrence, confidence, strategic importance,
and preventability. Then build the smallest prevention system for the top one or
two patterns and measure whether the relevant failure rate falls.

The likely high-value domains to test first are decision/approval latency,
handoff and ownership failure, scope/change leakage, rework caused by missing or
conflicting information, procurement or schedule dependency misses, billing and
collection delay, and client expectation drift. These are **hypotheses, not
findings**. The historical source analysis must determine the actual order.

## What Success Looks Like

At the end of the first retrospective, leadership should be able to answer:

- What are the five recurring breakdowns creating the largest verified burden?
- How many distinct episodes support each pattern?
- Which projects, phases, workflows, and handoff boundaries are most exposed?
- What is the confirmed cost, estimated cost, and relationship risk of each?
- What is the earliest signal that the breakdown is beginning?
- Which intervention would prevent it, shorten it, or reduce its consequence?
- How will we know within 30 to 60 days that the intervention is working?

The primary deliverable is a ranked **Operational Loss Portfolio**, not a list
of interesting quotes or generic AI ideas.

## Evidence Packet

| Evidence | Source | What it proves | Gap |
|---|---|---|---|
| Communications pipeline | `docs/architecture/COMMUNICATIONS-DATA-PIPELINE.md` | Outlook, Teams, files, and meeting transcripts already converge into AI-searchable chunks and compiled intelligence. | Source coverage, freshness, and project attribution must be measured for the selected historical window. |
| Daily source synthesis | `scripts/intelligence/daily-executive-brief.mjs` | The repo already produces source-grounded, project-aware summaries with short citation IDs and structured project records. | The current brief focuses on today's decisions and risks, not longitudinal recurrence or quantified loss. |
| Review-gated candidates | `scripts/intelligence/daily-deep-read-consumers.mjs` and `docs/ops/tasks/2026-07-07-daily-deep-read-consumer-layer.md` | Signals can be staged as evidence-preserving candidates before promotion into tasks or insight cards. | Candidate types do not yet represent a complete failure episode or cross-project pattern. |
| Packet-first intelligence | `frontend/src/lib/ai/intelligence/packet-service.ts` and `frontend/src/lib/ai/intelligence/advisor-synthesis.ts` | Durable synthesized intelligence already has an owner distinct from raw vector retrieval. | No company-level operational-loss packet currently exists. |
| Recurring-failure registry | `docs/ops/learning/recurring-failures.yaml` | The repo already records symptom, root cause, detection gap, prevention, and guardrail for engineering incidents. | It covers software/process incidents, not company operating breakdowns mined from communications. |
| Existing pattern fallback | `docs/ops/tasks/2026-06-27-executive-brief-emerging-pattern-fallback.md` | Keyword-only pattern grouping is known to miss materially related events. | Longitudinal pattern discovery needs episode-level semantic and causal features, not keyword buckets. |
| Content-source boundary | `docs/architecture/content-source-and-operating-record-design.md` | Existing architecture is moving toward one canonical source interface and deep operating-record projection. | New analysis must reuse that boundary rather than create a parallel source reader. |
| July 13 source-lineage trace | RAG `outlook_email_intake` read-back for the seven source IDs behind the Uniqlo/Superior rack-sprinkler candidates | One Superior email thread was split between project 178 and project 31 across mailbox copies, causing the Deep Read to create a false Uniqlo technical task from Superior evidence. | Repaired July 14; prevention guard and portfolio verifier added under AAI-1066. |

## Recent Deep Read Intelligence Baseline

The recent Daily Deep Read is now the explicit first evidence layer for this
program. It should reduce the amount of raw-source discovery work, but it cannot
replace source validation or consequence measurement.

### Baseline inspected

- Sixteen consumer evidence windows from June 23 through July 13.
- 402 raw review candidates across those windows.
- 355 candidate signals after removing exact same-day/project narrative
  duplication caused by older packets rendering one narrative as risk, task,
  update, or process issue.
- The July 13 v3 packet, `0a93bcf9-8773-48cb-9bd0-e2f01601cd42`, which produced
  17 source-linked candidates, 15 tasks, 2 decisions, and current-state records
  for 12 projects.
- A live RAG source read-back of the seven email records behind the highest-priority
  rack-sprinkler candidates.
- The corrected July 13 packet, `163e5716-9eae-45c3-b30a-ff23f01d5f1f`, which
  regenerated the Deep Read and downstream project intelligence after the source
  attribution repair.

These counts describe the available Deep Read evidence, not the number of
failure episodes. One event can match several themes, and older packet parsing
can split a single project narrative into several candidate rows.

### Preliminary Operational Loss Portfolio

| Provisional priority | Pattern hypothesis | Deep Read evidence | Consequence already visible | Confidence now | Required validation |
|---:|---|---|---|---|---|
| 1 | Design or scope information reaches pricing, procurement, or field execution before it is stable and accepted. | June 23: St. Pete was asked to price preliminary architecture with incomplete finish/detail information. July 9: McLane required mounting clarification but reached an accepted rear-upright solution with no stated schedule impact, making it a comparison case rather than a proven loss. July 13: Superior work was already on site while Exotec said it could not fit the racks and referenced prior McLane issues. The apparent Uniqlo technical example was removed after source validation proved it came from the Superior thread. | Redesign, fitment failure, delayed approval, uncertain budget, work-at-risk, and potential field rework. | High that the Superior incident is real; low-medium that a recurring loss pattern is proven; low on total burden. | Reconstruct distinct episodes across Superior, McLane, St. Pete, and comparable projects; compare the successful McLane resolution with Superior's release/mobilization path and confirm what control differed. |
| 2 | Decisions, approvals, permits, and supporting packages age without one complete decision-ready path. | June 23: Goodwill Washington pricing/approval remained pending with outage exposure; Goodwill Brookville permit timing depended on architect responses. July 9: Exol permit, schedule, submittal, and joint-check controls were simultaneously incomplete; Uniqlo had a $35,100 change awaiting formal approval. July 13: GPC required approval before work and partial-test planning; Vermillion depended on a variance package and flow-test data. | Schedule blockage, work-at-risk, repeated follow-up, approval delay, commercial exposure, and leadership attention. | High that approval dependency is broad; low on whether one root cause explains it. | Measure decision age, missing fields, number of follow-ups, blocked days, and whether a complete decision packet would have shortened each case. |
| 3 | Handoffs and readiness checks fail to establish the owner, prerequisite, or acceptance condition before the next party mobilizes or depends on the work. | June 23: Ulta AC-1 startup slipped because an electrical transition was incomplete; ACCO demobilized and had to return for work described as under one hour. Source read-back confirms two consistently attributed Ulta mailbox copies stating the raceway was incomplete, there was no good explanation, and the electrician would return for less than an hour of installation. Goodwill Allisonville still needed field/design decisions around removed joists. | Remobilization, crew interruption, avoidable delay, chase work, and leadership escalation. | High that the Ulta episode is real; medium that the theme recurs; low on burden. | Identify the expected handoff contract, responsible role, readiness evidence, remobilization/idle cost, and earliest detectable missing prerequisite. |
| 4 | Materials, procurement, and capacity are not converted into a forward-looking constraint plan early enough. | June 24: an aisle was blocked by missing risers, mains, rods, and support material; subcontractor manpower was below commitment and rental duration was exposed. July 13: source read-back of the correctly attributed GPC Fireflies huddle confirms written schedules were needed, K16 heads were backordered, 900 U-bolts were scarce, and GPC was already delayed. Goodwill roof joists carried a three-to-four-week lead time. | Crew downtime, schedule slip, extended rental, expedite cost, and resequencing. | High that the GPC episode is real; medium-high that the theme recurs; medium-low on preventable fraction. | Compare required-on-site dates to requested, committed, and actual dates; separate supplier uncertainty from late internal detection or ownership. |
| 5 | Client-facing completion, budget, and expectation updates become urgent only after the information gap is visible to leadership or the client. | July 13: Ulta's last two weekly reports did not show when Alleato would be complete and off site, prompting a same-day timeline request before client escalation. Uniqlo wanted budget information earlier than the stated deadline and requested detailed backup while scope allocation remained open. | Client surprise, repeated status requests, escalation risk, compressed response work, and reduced confidence. | Medium; strong examples but recurrence and relationship cost are not yet measured. | Trace repeated client requests, escalation language, promised-versus-actual update dates, and whether the missing information was knowable earlier. |
| 6 | Commercial administration and authorization gaps leave money, cash flow, or vendor continuity exposed. | June 23: Union's estimate still lacked an asphalt value; a Goodwill shear-wall exclusion needed contract-value recovery; final billing was still outstanding elsewhere. July 9: Exol joint-check paperwork/attachment was incomplete and Uniqlo's $35,100 change awaited a decision. July 13: a $1,459 payment was more than 30 days old with credit-hold and rental-removal risk. | Unbilled or unpriced scope, delayed cash, supplier credit risk, margin leakage, and manual reconciliation. | Medium on recurrence; higher on the existence of direct dollar exposure. | Reconcile each item to change, commitment, AP, invoice, and payment records; distinguish normal processing from preventable leakage. |

### Interpretation

The Deep Read is already doing more than summarization: it has identified
cross-project language suggesting that the Exotec/rack-sprinkler issue may be a
repeat failure and has surfaced explicit consequences such as remobilization,
crew-delay risk, credit-hold risk, and a priced change awaiting approval.

### Source-lineage correction discovered and repaired during validation

The first source trace materially changed the preliminary interpretation:

- The Deep Read emitted one rack-sprinkler task for Superior Beverage Exotec and
  a second technical task for Uniqlo Phillipsburg.
- The seven source IDs behind those tasks all resolve to the same July 13 email
  thread with the subject `Superior Sprinklers`.
- Three mailbox records were assigned to Superior (`project_id=178`) and four
  were assigned to Uniqlo (`project_id=31`).
- The Superior assignments used a high-confidence keyword rule or an existing-
  document propagation. The first incorrect Uniqlo assignment used
  `project_company_domain` at 0.74 confidence; later copies inherited Uniqlo via
  `existing_document` at 1.0 confidence.
- The content consistently concerns Superior field fitment. Therefore the
  Uniqlo technical task is not an independent failure episode and must not count
  toward recurrence.
- The separate McLane trace contains five consistently attributed project 879
  messages and ends with Exotec and Alleato agreeing on the rear-upright mounting
  solution. No schedule impact was stated. McLane should be retained as a
  counterexample showing a related technical question closed before a documented
  field consequence, not automatically counted as another failure.

**Confirmed first bad boundary:** source project attribution in the split RAG
intake, before Deep Read synthesis.

**Detection gap:** the candidate compiler can see a source set that appears
single-project and label it `source_set_single_project` without checking sibling
copies of the same cross-mailbox conversation for conflicting project IDs.

**Prevention requirement:** compute a mailbox-independent conversation
fingerprint, require one canonical project attribution per conversation, and
route conflicts to attribution review. Deep Read candidates derived from a
conflicted conversation must remain `needs_review` with an explicit attribution
warning; they must not produce project tasks or count as cross-project pattern
evidence.

**Repair and regeneration completed July 14:** the four incorrect source rows,
four retrieval documents, and 110 chunks now resolve to project 178. The false
candidate `73f8800e-032a-4057-811a-53d3b7b46e9d` and task
`cd967636-0208-49a4-b3e4-4f6a64dccbdb` were deleted. The corrected packet
`163e5716-9eae-45c3-b30a-ff23f01d5f1f` now places the Exotec design action only
under Superior and retains only real budget, CAD, FM-document, and scope actions
under Uniqlo.

**Portfolio-wide integrity result:** a 180-day verifier scanned 4,920 Outlook
rows and 3,175 exact-message or mailbox-conversation identities. Sixteen other
historical identities still contain multiple project IDs. They are not counted
as recurrence evidence and are not safe for bulk automatic repair because some
include manual-review assignments. They form a source-adjudication queue that
must be cleared or explicitly excluded during baseline calibration.

### Additional source validation

Two other high-signal candidates survived source validation:

- **Ulta handoff/remobilization:** both source email copies are consistently
  attributed to project 761 at 0.97 confidence. The thread states the raceway
  was not completed, no good explanation was provided, and the electrician
  would return for less than an hour of installation. The Deep Read's episode
  framing is supported; remobilization cost and total schedule impact are still
  unknown.
- **GPC material/readiness constraint:** the cited source is a Fireflies
  `Sprinkler Division Morning Huddle` assigned to project 90. Its summary
  confirms missing written schedules, material-tracking ownership needs, K16
  head backorder, approximately 900 scarce U-bolts, and an existing GPC delay.
  The occurrence is supported; the preventable fraction and cost are still
  unknown.

This mixed result demonstrates the required operating model: Deep Read is a
high-value discovery index, but every proposed pattern must survive source,
attribution, duplication, and consequence checks before ranking.

However, the evidence still stops one layer short of the user's question. It
does not yet prove:

- how many distinct episodes each pattern represents;
- which causal boundary failed first;
- the total hours, days, margin, cash, or relationship burden;
- what proportion was preventable; or
- which proposed intervention would have changed the outcome.

The next analysis must therefore start from these Deep Read candidates and walk
back to their original source IDs plus structured operating records. It should
not restart with an unbounded scan of every raw chunk.

## The Unit Of Analysis: A Failure Episode

The analysis must not count messages, mentions, sentiment, or retrieved chunks as
business problems. The atomic record is a **failure episode**: a bounded chain of
events with an observed breakdown and consequence.

Each episode should contain:

| Field | Meaning |
|---|---|
| Episode identity | Stable ID, project, workflow, start date, and resolution date |
| Expected state | The decision, handoff, deliverable, approval, payment, or dependency that should have occurred |
| Observed breakdown | The first point at which expected and observed behavior diverged |
| Trigger | Event or missing event that started the problem |
| Contributing conditions | Missing owner, unclear scope, unavailable information, conflicting systems, late escalation, capacity, or other evidenced factors |
| Consequences | Delay, rework, cost, margin exposure, cash-flow delay, client frustration, team interruption, or opportunity loss |
| Quantification | Confirmed dollars/hours/days plus estimated ranges and the estimation method |
| People and roles | Roles involved in the workflow; never a model-generated employee performance score |
| Source chain | Meeting, email, Teams, document, task, financial, schedule, or change-event IDs with timestamps |
| Earliest detectable signal | The first machine-observable warning that could have triggered prevention |
| Resolution | What ended or mitigated the episode |
| Preventability | Preventable, reducible, unavoidable, or unknown, with rationale |
| Confidence | Separate confidence for occurrence, consequence, and causal explanation |

One late approval discussed in 15 messages is one episode, not 15 occurrences.
Three late approvals on separate projects can become a recurring pattern.

## Impact Model

Use ranges and evidence grades instead of false precision.

### Direct burden

- Confirmed cost or write-off.
- Margin erosion or unbilled work.
- Cash-flow delay and days-sales-outstanding effect.
- Rework hours multiplied by an agreed loaded labor rate.
- Expedite fees, penalties, duplicate purchases, or avoidable subcontract cost.

### Time and productivity burden

- Person-hours spent chasing, clarifying, redoing, searching, reconciling, or
  manually moving information.
- Calendar delay caused by the episode.
- Number of workflow interruptions and people pulled into recovery.
- Opportunity cost only when the counterfactual can be stated credibly.

### Relationship burden

- Explicit client frustration, escalation, complaint, surprise, or trust repair.
- Repeated requests for the same answer or status.
- Missed expectation without proactive communication.
- Account or referral risk, recorded as an exposure band unless revenue impact
  is directly evidenced.

### Evidence grades

- **A — confirmed:** linked financial, schedule, task, or explicit source record.
- **B — strongly supported:** corroborated by at least two independent source
  events or by one explicit consequence statement.
- **C — plausible estimate:** reasonable inference with documented assumptions.
- **D — weak signal:** useful for discovery but excluded from financial ranking.

### Pattern priority score

Rank patterns using a transparent scorecard, not a model's unexplained opinion:

| Dimension | Weight | Question |
|---|---:|---|
| Annualized burden | 30% | What confirmed or bounded financial/time/relationship burden recurs? |
| Frequency and spread | 20% | How often, across how many projects and workflow phases? |
| Evidence confidence | 15% | How well are occurrence, consequence, and cause supported? |
| Preventability | 20% | Can an earlier signal, workflow rule, or automated action materially change the outcome? |
| Strategic leverage | 15% | Does solving it improve multiple projects, roles, or downstream workflows? |

The portfolio must show the raw dimensions alongside the composite score so
leadership can challenge assumptions.

## Discovery Taxonomy

Use a seed taxonomy to make extraction consistent, but allow new clusters to
emerge from the evidence.

### Seed breakdown types

- Decision or approval latency.
- Ambiguous ownership or missing handoff.
- Scope ambiguity, change leakage, or work proceeding without authorization.
- Missing, late, inconsistent, or inaccessible information.
- Rework or duplicate effort.
- Procurement, lead-time, or dependency miss.
- Schedule coordination or sequencing failure.
- Billing, documentation, collection, or revenue-recognition delay.
- Client expectation or communication mismatch.
- Quality issue, field error, or preventable punch/revisit.
- System fragmentation or manual reconciliation.
- Capacity overload, meeting overload, or interruption cost.

### Consequence types

- Direct cost.
- Margin exposure.
- Cash-flow delay.
- Schedule delay.
- Rework hours.
- Leadership attention consumed.
- Team productivity loss.
- Client frustration or escalation.
- Trust or relationship risk.
- Lost opportunity or delayed decision.

The taxonomy labels the evidence; it must not force every event into a known
bucket.

## Analysis Method

### 0. Promote Deep Read into the discovery index

Load the recent current packet, candidate previews, project-current-state
records, tasks, decisions, and source IDs as the initial discovery index. For
older Deep Reads, collapse duplicate risk/task/update rows that repeat the same
project narrative. Retain packet ID, business date, compiler version, project,
signal type, source IDs, and review status.

Use this index to seed outcome-backward and signal-forward retrieval. When a
Deep Read candidate already describes a potential consequence, retrieve its
exact meeting, email, or Teams evidence first, then join the relevant financial,
schedule, task, change, or billing record. Raw corpus search is the fallback for
coverage gaps and for discovering patterns the Deep Read did not surface.

### 1. Establish the study window and outcome ledger

Default to the most recent 180 days, with the last 90 days weighted more heavily
for current operations. Define the projects, mailboxes, Teams scopes, meeting
sources, and structured systems included. Create an outcome ledger for known
change orders, write-offs, schedule movements, invoice delays, client
escalations, and major rework events. This provides anchors for retrospective
search and a way to validate whether communications-only discovery finds known
problems.

### 2. Prove source coverage before drawing conclusions

For every source and week, report:

- documents expected, ingested, embedded, and project-assigned;
- unassigned or low-confidence records;
- missing participants, mailboxes, channels, or meetings;
- time gaps and stale sync periods;
- source-specific retrieval test results.

If a project has weak coverage, label it under-observed. Absence of evidence
must never be treated as evidence of smooth execution.

### 3. Generate candidate episodes

Use two complementary passes:

1. **Outcome-backward:** start from known schedule, financial, quality, and
   client consequences; retrieve the preceding source chain and reconstruct the
   episode.
2. **Signal-forward:** scan source windows for explicit delay, rework,
   escalation, unresolved decisions, repeated follow-up, scope conflict,
   surprise, apology, expedite, invoice, or client-frustration signals; then
   verify whether each led to a consequence.

This avoids the two common blind spots: only finding problems already known to
leadership, or treating emotionally intense conversation as costly without
evidence.

### 4. Stitch evidence into timelines

Join source events using project, participants, companies, subject/thread,
contract/change identifiers, dates, and semantic similarity. Produce a short
timeline for every candidate episode. The model proposes the chain; deterministic
rules verify IDs, dates, project attribution, and source availability.

### 5. Review candidate episodes, not raw documents

Use a lightweight review queue with four actions:

- Confirm episode.
- Correct fields or merge with another episode.
- Reject as normal work, duplicate, or unsupported.
- Mark consequence/cause unknown while retaining the observed event.

The reviewer should see a concise timeline and expandable source evidence. A
10- to 15-minute weekly review of high-impact candidates is more realistic and
more useful than asking Brandon to explain the entire operation from scratch.

### 6. Cluster recurring patterns

Cluster only confirmed or strongly supported episodes. Use semantic similarity,
shared workflow stage, common earliest signal, consequence type, and causal
features. Require:

- at least three distinct episodes, or two episodes with material confirmed
  burden;
- recurrence across separate dates and preferably separate projects;
- a human-readable pattern statement;
- representative and contradictory examples;
- an explanation of why the episodes belong together;
- explicit separation between symptom, contributing condition, and root cause.

### 7. Quantify and rank the portfolio

For each pattern, calculate observed burden for the study window, annualized
range, number of episodes, projects affected, median time to resolution,
preventable fraction, evidence distribution, and confidence. Keep confirmed and
estimated values separate.

### 8. Design interventions from the earliest detectable signal

For each top pattern, ask in order:

1. Can the workflow be removed or simplified?
2. Can ownership or the required next action be made explicit?
3. Can a deterministic rule prevent invalid state?
4. Can automation collect, route, reconcile, or escalate the information?
5. Does AI add value through interpretation, extraction, drafting, or prediction?

This keeps AI in the parts that require judgment and uses ordinary automation
where rules are more reliable.

### 9. Run a controlled prevention pilot

Choose one or two high-burden patterns with a measurable early signal. Establish
a four-week baseline, deploy the intervention to a bounded project/workflow
group, and compare episode rate, response time, burden, and false-alert rate for
30 to 60 days.

### 10. Promote proven patterns into a continuous learning loop

Once validated, each pattern should have a durable record containing its
fingerprint, evidence, owner workflow, detection rule, intervention, measurement,
and current maturity: recorded, diagnosable, detectable, or prevented. This is
the operational analogue of the existing recurring-failure registry.

## The Operational Loss Portfolio

The synthesis output should contain one row per recurring pattern:

| Field | Required output |
|---|---|
| Pattern | Plain-language breakdown statement |
| Evidence | Episode count, project count, source links, and evidence-grade mix |
| First breakdown boundary | Where expected first diverged from observed |
| Consequence | Time, money, schedule, productivity, and relationship burden |
| Annualized burden | Confirmed amount and estimated range shown separately |
| Earliest signal | What could have been detected before the consequence grew |
| Preventable fraction | Portion realistically avoidable or reducible |
| Proposed system | Process, rule, automation, AI, or blend |
| Measurement | Baseline, target, leading metric, and lagging metric |
| Confidence | Occurrence, consequence, causal, and intervention confidence |
| Owner | Workflow owner, not merely the software implementer |

Each top pattern also receives a one-page **Pattern Brief** with a representative
timeline, two or three source-backed examples, counterexamples, the recommended
intervention, and the smallest viable pilot.

## Intervention Design Library

These are solution patterns to match after ranking, not features to build in
advance.

| Observed pattern | Deterministic automation | AI contribution | Example measurement |
|---|---|---|---|
| Decisions stall without a clear owner or deadline | Decision ledger, required owner/date, aging timer, escalation route | Extract decisions and dependencies from meetings/email; draft concise decision packet | Median decision age; schedule days blocked by decisions |
| Commitments disappear after meetings | Create assigned follow-up with due date and source link; verify closure | Extract commitment, owner, due date, and acceptance criteria; detect conflicting commitments | Unowned commitment rate; overdue rate; repeated follow-up count |
| Work proceeds before scope/price authorization | Workflow gate against starting unapproved change work; alert on cost activity without approval | Detect language indicating directive, implied approval, disputed scope, or urgency | Unapproved-work exposure; change-order cycle time; recovered margin |
| Teams repeatedly searches for missing project information | Canonical record and required-field checks; synchronize authoritative systems | Answer with cited source and freshness; identify contradictions or missing facts | Search/reconciliation hours; duplicate requests; stale-record incidents |
| Client frustration appears after expectation drift | Scheduled status commitments and escalation rules | Detect unresolved expectation gaps and draft proactive, evidence-based update | Surprise/escalation rate; response time; repeated status requests |
| Billing or cash is delayed by missing documentation | Completeness gate, aging queue, automatic routing and reminders | Classify blockers, extract missing requirements, draft follow-up | Days to bill; blocked invoice value; days sales outstanding |
| Rework follows ambiguous handoffs | Required handoff contract and acceptance acknowledgment | Summarize scope, constraints, decisions, and unresolved assumptions; flag ambiguity | Rework hours; handoff rejection/correction rate |
| Meetings consume time without changing state | Agenda from unresolved decisions; action capture; automatic status reconciliation | Produce pre-read, detect duplicate discussions, and summarize only changed state | Meeting hours; decisions per meeting; repeat-topic frequency |

## 30/60/90-Day Execution Plan

### Days 0-14: Baseline and calibration

- Define the 180-day window and source inventory.
- Run source coverage and project-attribution audit.
- Create the known-outcome ledger from financial, schedule, task, change, and
  client-escalation records.
- Specify the episode schema, evidence grades, and impact assumptions.
- Hand-label 30 to 50 episodes across several projects to create the calibration
  set, including normal/healthy workflow examples.
- Deliver a source coverage report and the first reviewed episode ledger.

**Exit gate:** at least 90% coverage for in-scope sources or explicit
under-observed labels; reviewers agree on episode boundaries and consequence
labels at an acceptable rate.

### Days 15-30: Historical discovery

- Run outcome-backward and signal-forward candidate generation.
- Review the highest-impact and highest-uncertainty candidates.
- Merge duplicates and stitch cross-source timelines.
- Cluster confirmed episodes and generate contradictory examples.
- Produce the first ranked Operational Loss Portfolio.

**Exit gate:** top patterns have traceable episode support, quantified burden
ranges, and no uncited causal claims.

### Days 31-60: Select and build prevention pilots

- Hold one evidence review with Brandon and Megan using the ranked portfolio,
  asking for corrections and forced prioritization rather than open-ended
  recollection.
- Select one or two patterns with high burden, strong evidence, and a measurable
  earliest signal.
- Write the workflow contract and baseline metrics.
- Implement deterministic controls first, then the minimum AI extraction or
  synthesis needed.
- Keep every action review-gated until precision and operational trust are
  demonstrated.

**Exit gate:** intervention has an explicit owner, baseline, target, rollback,
false-positive threshold, and user-visible failure state.

### Days 61-90: Measure and promote

- Compare pilot outcomes against the baseline and an unaffected comparison
  group where possible.
- Measure episode rate, prevented burden, cycle time, adoption, false alerts,
  and override reasons.
- Improve or retire weak interventions.
- Promote successful patterns into continuous monitoring and the durable
  learning registry.
- Re-rank the portfolio using new evidence and select the next intervention.

**Exit gate:** at least one intervention shows a measurable reduction in failure
rate, duration, or burden without unacceptable alert or workflow cost.

## Verification Gates

| Gate | Command or evidence | Required result | Owner layer |
|---|---|---|---|
| Source lifecycle | `npm run rag:verify:source-lifecycle` | In-scope source windows are present, embedded, attributable, and fresh | ingestion |
| Meeting coverage | `npm run rag:verify:meetings` | No unexplained transcript/vector gaps in the study window | ingestion/retrieval |
| Source-specific lookup | `npm run rag:verify:source-specific` | Exact-source questions return the correct source class and citations | routing/retrieval |
| Episode extraction set | Human-labeled calibration dataset | Precision, recall, field accuracy, and episode-boundary agreement reported by class | extraction |
| Evidence integrity | Deterministic ID/date/project verifier | Every episode source exists; no invented citation, project, date, or amount | evidence |
| Conversation attribution consistency | Proposed `rag:verify:conversation-attribution-consistency` verifier plus RAG DB read-back | Same logical conversation cannot carry multiple non-null project IDs unless the conflict is explicitly review-gated | attribution |
| Causal discipline | Reviewer audit sample | Cause is marked unknown when evidence only proves correlation | synthesis |
| Impact reconciliation | Structured financial/schedule read-back | Confirmed values match source systems; estimates retain assumptions and ranges | measurement |
| Pattern stability | Time-split evaluation | Major clusters recur on a holdout period rather than fitting one incident batch | pattern discovery |
| Intervention outcome | Pre/post or comparison-group report | Target metric improves and false-positive/workflow cost stays within threshold | product/operations |

## Role Positions

### Repo Architect

Position: Extend the current source, candidate-review, packet, and recurring-
failure architecture. Add one company-level operational-loss domain, not a
parallel ingestion or generic analytics stack.

Evidence: `COMMUNICATIONS-DATA-PIPELINE.md`, the Daily Deep Read consumer,
packet-first intelligence modules, and the recurring-failure registry already
own the essential lifecycle stages.

Risk in the other strategies: A new standalone transcript analyzer would fork
source retrieval, attribution, review, evidence, and promotion logic.

Minimum viable next step: Define the episode contract and run a read-only
historical pilot from the canonical source boundary.

Guardrail required: One canonical source reader and one evidence-preserving
promotion path.

Confidence: High.

### RAG Architect

Position: Use retrieval to assemble source evidence, but perform recurrence
analysis over structured episodes. Raw chunks are evidence, not the analytical
unit.

Evidence: Existing source-specific retrieval supports meetings, email, Teams,
and documents, while the current keyword-based emerging-pattern logic has
already demonstrated recall limitations.

Risk in the other strategies: Clustering chunks will overcount long threads,
confuse discussion volume with cost, and fragment one event into many patterns.

Minimum viable next step: Create a hand-labeled set of 30 to 50 episodes and
test outcome-backward plus signal-forward extraction.

Guardrail required: Stable episode deduplication, source timelines, evidence
grades, and time-split evaluation.

Confidence: High.

### AI SDK And Provider Specialist

Position: This plan does not require a new model or provider decision yet. Use
the existing structured-output/provider path for bounded extraction and
synthesis, with deterministic validation around it.

Evidence: The Daily Executive Brief already performs cited structured synthesis
and writes inspectable artifacts.

Risk in the other strategies: Selecting a model before defining the episode
contract and labeled evaluation set makes output quality subjective and hides
provider failures.

Minimum viable next step: Define JSON schemas and evaluation cases before any
model comparison.

Guardrail required: Schema validation, empty-output failure, provider/finish-
reason telemetry, retry limits, and no silent fallback to uncited prose.

Confidence: Medium-high; exact provider behavior must be verified during
implementation.

### Failure-Mode Reviewer

Position: The biggest danger is producing a persuasive but untrustworthy list
that blames people, reflects only well-ingested sources, or assigns invented
dollar values to correlated events.

Evidence: Current architecture still has known source-attribution and coverage
limitations, and existing pattern logic can omit material mixed-domain events.

Risk in the other strategies: Leadership may act on communication volume,
sentiment, or a model-generated causal story instead of an evidenced breakdown.

Minimum viable next step: Make coverage, confidence, counterexamples, and
estimate assumptions visible in every portfolio view.

Guardrail required: No person-level performance scoring; no financial claim
without evidence grade and method; no causal label without supporting timeline;
no "no issue" conclusion for under-observed scopes.

Confidence: High.

### Product Advisor

Position: The product should help leadership decide what system to change and
whether that change worked. It should not become another dashboard of AI
summaries.

Evidence: The user's stated outcome is profitability, efficiency, and protecting
relationships; the existing review-gated candidate pattern supports human
correction before operational promotion.

Risk in the other strategies: Surfacing hundreds of weak signals creates more
review work and erodes trust.

Minimum viable next step: Deliver a ranked portfolio of no more than five top
patterns, each with evidence, burden, earliest signal, and a pilot recommendation.

Guardrail required: Quiet interface, source expansion on demand, review by
exception, one primary decision per pattern, and measurable intervention status.

Confidence: High.

## Disagreements And Resolution

| Disagreement | Positions | Resolution method | Decision |
|---|---|---|---|
| Analyze raw chunks or structured episodes? | Retrieval can cluster chunks; architecture and product need durable records. | Compare against the labeled set for duplicate rate, evidence integrity, and reviewer usefulness. | Use chunks for retrieval and episodes for analysis. |
| Start with a predefined taxonomy or unsupervised discovery? | Taxonomy improves consistency; discovery avoids confirmation bias. | Dual-pass extraction and holdout review. | Seed taxonomy plus emergent clusters; never taxonomy-only. |
| Use AI or deterministic automation first? | AI can interpret messy communication; deterministic rules are more reliable for known states. | For each pattern, locate the earliest observable signal and test whether it is rule-expressible. | Simplify/rule/automate first; add AI where interpretation is necessary. |
| Quantify every consequence in dollars? | Financial ranking is useful; false precision is dangerous. | Evidence grades, ranges, and separate confirmed versus estimated burden. | Quantify when supportable; otherwise use explicit time, delay, or relationship bands. |
| Require Brandon to define the patterns? | Leadership context is valuable; open-ended extraction has failed. | Present evidence-backed episodes and forced choices for correction. | Use Brandon for short validation and prioritization, not blank-sheet discovery. |
| Build continuous monitoring immediately? | Automation benefits from continuity; unvalidated detectors create noise. | Historical precision/recall and pilot false-positive threshold. | Historical read-only pilot first; continuous monitoring after validation. |

## Consensus Implementation Sequence

1. Freeze the episode, evidence, impact, and confidence contracts.
2. Audit 180-day source coverage and create the known-outcome ledger.
3. Build the human-labeled calibration set.
4. Run outcome-backward and signal-forward episode discovery.
5. Review, deduplicate, and cluster episodes into patterns.
6. Produce and challenge the ranked Operational Loss Portfolio.
7. Select one or two interventions based on burden, confidence, and
   preventability.
8. Implement deterministic workflow controls plus minimum necessary AI.
9. Measure the pilot for 30 to 60 days.
10. Promote validated patterns into continuous detection and the recurring-
    failure learning loop.

## Fail-Loud And Recurrence Guardrails

- **Cause:** Cross-source operational problems are currently synthesized for
  daily awareness, but not reconstructed longitudinally, quantified, clustered,
  and measured as recurring loss patterns.
- **Detection gap:** Communication volume and daily risk signals do not reveal
  whether the same breakdown repeatedly creates measurable consequences.
- **Prevention step:** Evidence-backed episode ledger, source-coverage report,
  reviewed pattern portfolio, and intervention outcome measurement.
- **Fail-loud behavior:** The analysis must stop or downgrade confidence when
  source coverage is weak, citations fail validation, project attribution is
  unresolved, structured impact values do not reconcile, provider output is
  empty, or episode quality falls below the agreed evaluation threshold.
- **Recurrence guardrail:** Every deployed intervention must create a detection
  metric and a prevention metric. If the episode recurs, the system records
  whether detection fired, whether action occurred, and why prevention failed.
- **Attribution guardrail:** Conflicting project assignments across copies of one
  logical Outlook/Teams conversation must fail the pattern-analysis gate and
  enter review instead of being counted as separate project evidence.

## Privacy, Fairness, And Trust Boundaries

- Analyze workflows and system boundaries, not employee character.
- Do not create individual productivity, loyalty, sentiment, or risk scores.
- Keep access aligned with existing source permissions and project boundaries.
- Redact or restrict sensitive HR, legal, health, and personal content.
- Preserve the exact source and context for challenge and correction.
- Separate direct quotes, facts, estimates, model inferences, and reviewer
  judgments.
- Publish limitations and under-observed scopes beside every ranking.
- Treat relationship risk as a decision-support signal, never an autonomous
  client action trigger.

## Open Questions

- Which financial and schedule records are reliable enough to serve as the
  known-outcome ledger for the first 180-day study?
- What loaded hourly rates or role-level cost bands should be used for rework
  and interruption estimates?
- Which client escalations or relationship events have a reliable source-of-
  truth record?
- Which projects have the best cross-source coverage and should form the first
  calibration cohort?
- What minimum precision should be required before a detector moves from review-
  only to automatic routing or escalation?

These questions can be answered during baseline setup; none should block
creating the episode contract or source coverage report.

## Recommended Next Step

Run a two-week **read-only Operational Loss Baseline**:

1. start with the six provisional patterns in the recent Deep Read baseline,
2. adjudicate or explicitly exclude the 16 historical Outlook conversation
   conflicts found by the new attribution verifier,
3. select three to five projects with strong source coverage, beginning with
   the corrected Superior/McLane rack-sprinkler and explicit
   handoff/remobilization cases,
4. trace each candidate to its original source IDs and structured consequences,
5. expand across the most recent 180 days,
6. create a 30- to 50-episode reviewed calibration set,
7. replace the provisional portfolio with a quantified ranked five-pattern
   portfolio, and
8. bring Brandon a short evidence-backed forced-choice review: “Which of these
   verified patterns should we prevent first?”

Do not build an intervention until that portfolio is reviewed. The first build
should then target the highest-burden pattern that has both a reliable early
signal and a measurable outcome.
