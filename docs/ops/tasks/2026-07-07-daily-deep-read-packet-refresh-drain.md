# Task: Daily Deep Read Packet Refresh Drain Verification

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1009 - https://linear.app/megankharrison/issue/AAI-1009/finalize-daily-deep-read-backfill-and-ai-packet-first-routing

## Objective

Verify the packet refresh job queued by Daily Deep Read promotion is actually drainable by the existing intelligence compiler and updates the project intelligence packet.

## Findings

- Job `6728a0b6-1794-4522-b4f9-688ac1f1be04` initially remained `queued`.
- First local drain attempt failed loudly because PM final projection writes require `ALLOW_PM_APP_FINAL_PROJECTIONS=true`.
- Second attempt with that flag failed because the packet needed 201 projection rows and the default `PM_APP_PROJECTION_MAX_TOTAL_ROWS` is 200.
- Third attempt with `ALLOW_PM_APP_FINAL_PROJECTIONS=true PM_APP_PROJECTION_MAX_TOTAL_ROWS=250` succeeded.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Queue status read-back | Direct RAG Supabase read | Pass | Job was queued before manual drain. |
| Drain attempt | `PYTHONPATH=backend python3 - <<'PY' ... process_packet_refresh_job(...)` | Failed loud | Blocked by `ALLOW_PM_APP_FINAL_PROJECTIONS` guard. |
| Drain attempt | `ALLOW_PM_APP_FINAL_PROJECTIONS=true ... process_packet_refresh_job(...)` | Failed loud | Blocked by `PM_APP_PROJECTION_MAX_TOTAL_ROWS` at 201 > 200. |
| Drain attempt | `ALLOW_PM_APP_FINAL_PROJECTIONS=true PM_APP_PROJECTION_MAX_TOTAL_ROWS=250 ... process_packet_refresh_job(...)` | Pass | Created packet `6e6558f3-b8b9-42fa-931a-c4cfafee4036`. |
| DB read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-packet-refresh-drain.json` | Pass | Job is `succeeded`; promoted card `988cf9e2-84a0-4fca-82f3-bd130b4d23d0` is linked to the refreshed packet in `section=decisions`. |

## Outcome

- The Daily Deep Read promotion queue handoff works.
- The existing packet compiler can rebuild the project intelligence packet from the promoted Daily Deep Read card.
- The remaining operational risk is production env/config: scheduled drains must have PM projection writes enabled with a row cap above current packet size.

## Final Status

- [x] Complete
