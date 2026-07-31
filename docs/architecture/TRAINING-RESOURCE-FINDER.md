# Training Resource Finder

## Purpose

The training resource finder discovers public construction-training resources
for one active role/topic pair and submits eligible results to the existing
human review queue. It never publishes a resource.

## Runtime Owners

- Search transport: `backend/src/services/agents/research_agent/tools.py`
  exposes the shared structured Tavily search helper used by both the research
  agent and this deterministic job.
- Eligibility and orchestration:
  `backend/src/services/training/finder.py`.
- Typed input/output: `backend/src/services/training/contracts.py`.
- Manual operator entrypoint:
  `backend/src/scripts/run_training_resource_finder.py`.
- Database write boundary: applied Supabase function
  `public.create_training_review_candidate`.

The finder is a deterministic backend job, not a second Deep Agent. The existing
research stack remains the public-web provider owner, while final eligibility is
code-owned so untrusted search or model output cannot choose cost, status, role
links, or publish state.

## Execution

Dry-run is the default:

```bash
cd backend
python3 src/scripts/run_training_resource_finder.py \
  --role project-manager \
  --topic project-scheduling
```

An explicit commit can create review candidates:

```bash
cd backend
python3 src/scripts/run_training_resource_finder.py \
  --role project-manager \
  --topic project-scheduling \
  --max-inserts 1 \
  --commit
```

Required runtime variables:

- `TAVILY_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Missing provider or database configuration produces a named failure and a
non-zero process exit.

## Eligibility Contract

Version `deterministic-v1` uses these gates:

1. Normalize the result to one HTTPS canonical identity, including HTTP inputs,
   so a scheme-only variant cannot bypass deduplication.
2. Remove tracking parameters and normalize YouTube URL variants.
3. Reject an existing database URL or a same-run canonical duplicate.
4. Reject Procore hosts and any result whose searchable evidence references
   Procore.
5. Reject paid/access-restricted language.
6. Require positive free-access evidence. V1 discovery is scoped to public
   YouTube results; other hosts require explicit free/open-access evidence.
7. Require both construction-role context and topic-specific evidence. Weekly
   targets use explicit normalized phrases (for example `look ahead` or
   `pull planning`) so generic overlap such as `planning` cannot qualify an
   unrelated course.
8. Require depth evidence from readable content or a long-form training cue.
9. Respect the per-run insert limit.

Every accepted payload fixes `level = deep-dive`, derives the audience track
from the active role, records finder provenance in `metadata`, and omits `cost`
and `status` entirely. The RPC owns `cost = free` and `status = review`.

## Database Boundary

The service-role client may read training taxonomy/resources and execute
`create_training_review_candidate`. The job does not call
`table("training_resource").insert(...)` or write role links directly.

The RPC validates active topic/role IDs, inserts a single free review candidate,
creates only that candidate's role links, and returns the new UUID. The response
is marked `partial` or `failed` if any accepted candidate insert fails; it never
claims an unsuccessful candidate was inserted.

## Deployment And Scheduling

`alleato-backend` owns the provider and Supabase credentials. The canonical
`render.yaml` declares all three secret variable names.

ALL-23 adds `alleato-training-resource-finder-weekly`, scheduled for Monday at
13:15 UTC. Render invokes the weekly runner with explicit `--commit`; the runner
still fixes `maxInserts = 1`, so one scheduled run cannot add more than one
review candidate.

The `weekly-role-rotation-v1` policy uses Monday 2026-01-05 as its UTC anchor and
cycles through six curated role/topic pairs in product sort order:

1. Project Engineer — Submittal Review & Management
2. Assistant Project Manager — Procurement & the Procurement Log
3. Project Manager — Project Scheduling
4. Estimator — Buyout & Writing Scopes of Work
5. Assistant Superintendent — Look-Aheads & Pull Planning
6. Superintendent — Safety Management

The next week returns to the first target. `--for-date YYYY-MM-DD` provides a
deterministic replay/dry-run target without changing the schedule. The optional
in-app trigger remains deferred; adding a second privileged write surface is
not required for the scheduled acceptance path.

## Failure Modes

- `TRAINING_RESOURCE_SEARCH_FAILED`: Tavily key, HTTP call, or result contract
  failed.
- `TRAINING_TAXONOMY_*`: requested active role/topic is absent or unreadable.
- `TRAINING_RESOURCE_READ_FAILED`: existing URL inventory cannot be read or
  contains an invalid URL.
- `TRAINING_RESOURCE_INSERT_FAILED`: atomic candidate RPC failed or returned no
  resource ID.
- Per-result rejection: invalid URL, duplicate, Procore, paid, unknown free
  access, insufficient depth, or insert limit.

Retries are safe because the job canonicalizes both existing and discovered
URLs before every insert attempt, while the database retains its exact URL
unique constraint.
