# Handoff: Fix Teams Exclusion From Workday Daily Deep Read

Status: RESOLVED 2026-07-07 (see Resolution below)
Owner: Claude (implemented)
Created: 2026-07-07
Related packet: `e081fd85-7314-4636-9fea-dc193bd7051c` (superseded by `95317ddb-8ae4-4cc6-a80d-5fa34d93e36f`)
Related task: `docs/ops/tasks/2026-07-07-daily-deep-read-workday-run.md`
Resolution task: `docs/ops/tasks/2026-07-07-daily-deep-read-teams-fix-and-central-review.md`

## Resolution (2026-07-07)

Implemented in `scripts/intelligence/daily-executive-brief.mjs`:

- Teams rows now include by per-message timestamps `[YYYY-MM-DD HH:mm:ss]` parsed as
  **UTC** — not America/New_York as this handoff guessed. Proof: the ingestion writer
  (`backend/src/services/integrations/microsoft_graph/teams.py`, `_ingest` message line)
  formats `createdDateTime[:19]` from Microsoft Graph, which is UTC ISO.
- Date-only `Date: YYYY-MM-DD` headers are day evidence only: they can include a row on a
  full-day (>=24h) window matching the business date, and never exclude a row from a
  sub-day window — the row-timestamp fallback decides instead.
- Row fallback precedence now includes `last_synced_at` per this handoff.
- Loud failure added: `assertLaneCoverage` throws before any live write when a lane has
  in-window rows (by row fallback timestamp) but zero included sources
  (`--allow-empty-lanes` overrides).
- `--sources-only` flag added for cheap inclusion preflights without a model run.

Verified: workday preflight for 2026-07-07 went from `teams: 0` to `teams: 15` (all
`basis=teams-message-timestamps-utc`); 40 out-of-window Teams rows still skipped. Live
rerun wrote current packet `95317ddb-8ae4-4cc6-a80d-5fa34d93e36f`
(meetings 11 / emails 98 / teams 15 / documents 20); the old teams=0 packet flipped to
`snapshot` by existing runner behavior. Evidence:
`docs/ops/evidence/2026-07-07-daily-deep-read-workday-teams-fix/`.

## Problem

The July 7 workday Daily Deep Read reported `teams: 0`, but Teams rows definitely existed in `public.rag_document_metadata` during the requested workday window.

This is not primarily a Microsoft Graph ingestion outage. It is a Daily Deep Read source-window inclusion bug introduced/triggered by strict timestamp filtering.

## Requested Business Window

- Business date: `2026-07-07`
- Local window: `2026-07-07 06:00-18:00 America/New_York`
- UTC window: `2026-07-07T10:00:00.000Z` to `2026-07-07T22:00:00.000Z`

## Evidence

The live workday packet was generated with:

```bash
node scripts/intelligence/daily-executive-brief.mjs \
  --date 2026-07-07 \
  --packetType current \
  --covered-start-at 2026-07-07T10:00:00.000Z \
  --covered-end-at 2026-07-07T22:00:00.000Z \
  --evidence-dir docs/ops/evidence/2026-07-07-daily-deep-read-workday
```

Packet read-back confirmed:

- Packet ID: `e081fd85-7314-4636-9fea-dc193bd7051c`
- Source counts: `meetings=11`, `emails=95`, `teams=0`, `documents=16`

But direct RAG database query for the same window showed Teams rows:

```sql
select coalesce(source,'null') source,
       coalesce(source_system,'null') source_system,
       coalesce(type,'null') type,
       count(*)::int count
from public.rag_document_metadata
where coalesce(last_content_loaded_at,last_indexed_at,last_synced_at,updated_at,created_at)
      >= '2026-07-07T10:00:00Z'::timestamptz
  and coalesce(last_content_loaded_at,last_indexed_at,last_synced_at,updated_at,created_at)
      < '2026-07-07T22:00:00Z'::timestamptz
group by 1,2,3
order by count desc;
```

Relevant counts from that query:

- `microsoft_graph / teams_dm / teams_dm_conversation`: `15`
- `microsoft_graph / null / teams_dm_conversation`: `28`
- So at least `43` Teams DM conversation rows had load/index timestamps inside the requested workday window.

Sample Teams rows inside the requested window:

```text
teamsdm_be216efdb7c22230_2026-07-07
Teams DM Conversation: Company Vehicle Owners
source=microsoft_graph
source_system=teams_dm
type=teams_dm_conversation
last_content_loaded_at=2026-07-07T21:40:27.091Z

teamsdm_80c18e47af0e973f_2026-07-07
Teams DM Conversation: 19:meeting_Y
source=microsoft_graph
source_system=teams_dm
type=teams_dm_conversation
last_content_loaded_at=2026-07-07T16:23:57.850Z
```

## Root Cause

`scripts/intelligence/daily-executive-brief.mjs` uses `parseDateFromText(text)` before falling back to row timestamps.

Teams content contains a date-only header:

```text
[Teams Direct Message Conversation: Company Vehicle Owners]
Date: 2026-07-07

[message:1783458418387] [2026-07-07 21:06:58] Maria Calcetero: ...
```

Current parser behavior:

```js
const emailDate = text.match(/^Date:\s*([^\n]+)/im)?.[1]?.trim();
if (emailDate) return new Date(emailDate);
```

For `Date: 2026-07-07`, JavaScript returns `2026-07-07T00:00:00.000Z`.

The workday inclusion check then compares that parsed timestamp to the workday window:

```js
include: parsedTime >= windowBounds.start.getTime() &&
         parsedTime < windowBounds.end.getTime()
```

Because midnight UTC is before `2026-07-07T10:00:00Z`, every Teams row with a date-only header is skipped before the runner ever falls back to `last_content_loaded_at`.

The run evidence proves this:

```json
{
  "id": "teamsdm_be216efdb7c22230_2026-07-07",
  "title": "Teams DM Conversation: Company Vehicle Owners",
  "lane": "teams",
  "reason": "not in 2026-07-07 by parsed-source-timestamp",
  "sourceAt": "2026-07-07T00:00:00.000Z"
}
```

## Correct Design

For Teams rows, the content-level `Date: YYYY-MM-DD` is a conversation/day label, not a precise event timestamp. It must not override the row load/index timestamp for a workday-hour window.

Recommended source timestamp precedence:

1. For Teams rows, parse individual message timestamps like `[2026-07-07 21:06:58]` and include the row if any message timestamp falls within the covered window.
2. If no message-level timestamp is parseable, use row timestamp fallback:
   `source_at`, `last_content_loaded_at`, `last_indexed_at`, `last_synced_at`, `updated_at`, `created_at`.
3. Treat `Date: YYYY-MM-DD` as date-only day evidence. It can include a row for a full-day run, but it must not exclude a row from a sub-day workday run when the row fallback timestamp is inside the window.

Do not make Teams a special "always include by date" shortcut without timestamp/window guardrails. That would reintroduce full-day bleed into workday packets.

## Files To Change

- `scripts/intelligence/daily-executive-brief.mjs`
- Add or update tests near the runner if a test harness exists; if not, add a small script-level unit test around source inclusion helpers.

## Suggested Implementation

Refactor source inclusion into lane-aware helpers:

```js
function parseTeamsMessageTimestamps(text) {
  // Matches "[2026-07-07 21:06:58]" in Teams message bodies.
}

function rowFallbackTimestamp(row) {
  return row.source_at ?? row.last_content_loaded_at ?? row.last_indexed_at ??
    row.last_synced_at ?? row.updated_at ?? row.created_at;
}

function isIncludedForBusinessDate(row, text, lane) {
  if (lane === "teams") {
    const messageTimes = parseTeamsMessageTimestamps(text);
    if (messageTimes.length) {
      return include if any timestamp is within [start, end);
    }
    return include by rowFallbackTimestamp(row);
  }

  // Keep existing meeting/email/document behavior, but avoid date-only values
  // being treated as exact midnight timestamps for sub-day windows.
}
```

Important: if parsing `YYYY-MM-DD HH:mm:ss`, decide and document timezone. Existing Teams text appears to store local-looking timestamps. For the July 2026 workday use case, interpret them as America/New_York unless source metadata proves UTC.

## Verification Commands

1. Run a no-write preflight:

```bash
node scripts/intelligence/daily-executive-brief.mjs \
  --date 2026-07-07 \
  --packetType current \
  --covered-start-at 2026-07-07T10:00:00.000Z \
  --covered-end-at 2026-07-07T22:00:00.000Z \
  --evidence-dir docs/ops/evidence/2026-07-07-daily-deep-read-workday-teams-fix \
  --no-write
```

Expected result:

- The Teams included count must be greater than `0`.
- Evidence `source-manifest.json` must show Teams rows included with `lane="teams"`.
- Skipped Teams rows from outside the workday should still be skipped.

2. Run syntax check:

```bash
node --check scripts/intelligence/daily-executive-brief.mjs
```

3. After code fix only, rerun the live packet if requested:

```bash
node scripts/intelligence/daily-executive-brief.mjs \
  --date 2026-07-07 \
  --packetType current \
  --covered-start-at 2026-07-07T10:00:00.000Z \
  --covered-end-at 2026-07-07T22:00:00.000Z \
  --evidence-dir docs/ops/evidence/2026-07-07-daily-deep-read-workday-teams-fix
```

Then rerun consumers:

```bash
node scripts/intelligence/daily-deep-read-consumers.mjs --packetId <new_packet_id>
```

## Acceptance Criteria

- Daily Deep Read workday preflight includes Teams rows for July 7.
- Source coverage no longer reports `teams: 0` when Teams rows exist inside the window.
- Date-only headers do not incorrectly exclude rows from sub-day windows.
- Existing meeting/email/document inclusion still works.
- Failure mode is loud: if Teams rows exist in the SQL preflight but `included.teams === 0`, the runner should warn or throw before writing a live packet.

## Notes

The current production/current Daily Executive Brief packet is already written without Teams. Do not silently overwrite it after the fix unless the operator explicitly wants a rerun. If rerun, the new packet should become `packet_type='current'` and the previous packet should become `snapshot` by existing runner behavior.
