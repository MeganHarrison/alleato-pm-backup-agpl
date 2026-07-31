# Issue #759: Project Intelligence Narratives Restoration

**Status:** Code changes complete, PR #763 ready for merge
**Date:** 2026-07-09
**Related Issue:** https://github.com/MeganHarrison/alleato-pm/issues/759

## Summary

Project intelligence narratives (`project_current_state` and `intelligence_packets` tables) were frozen at 2026-06-24. Root cause: the daily synthesis sweep cron accumulated projection budgets across all 200 projects, causing the guard to self-block after ~30 projects, which silently skipped the synthesis pass.

## Code Changes (PR #763)

### 1. Fixed Projection Budget Accumulation
**File:** `backend/src/services/intelligence/project_synthesizer.py`

**Change:** Reset the projection budget dict for each project instead of accumulating across all projects.

```python
# Before: single dict shared across all projects
projection_counts: Dict[str, int] = {}
for pid in project_ids:
    # append counts, eventually hits limit

# After: fresh dict per project
for pid in project_ids:
    project_projection_counts: Dict[str, int] = {}
    # each project starts fresh
```

**Impact:** Each project now gets its own 100-row projection budget. No accumulation across projects.

### 2. Added Staleness Health Check
**Files:**
- `backend/src/services/health/project_intelligence_staleness_check.py` (new)
- `render.yaml` (added new cron entry)

**Schedule:** Daily at 08:30 UTC (30 minutes after synthesis sweep at 07:00 UTC)

**Monitors:**
- `max(project_current_state.updated_at)` - should be <2 days old
- `max(intelligence_packets.generated_at)` - should be <2 days old for `compiler_version='project_intelligence_synthesis_v1'`

**Alerts:** If either table is older than 2 days (configurable via `PROJECT_INTELLIGENCE_STALENESS_CHECK_DAYS`)

## Next Steps (Manual)

### Step 1: Merge PR #763
- Review PR at https://github.com/MeganHarrison/alleato-pm/pull/763
- Merge to `main` when ready

### Step 2: Unsuspend the Cron in Render

The `alleato-project-synthesis-sweep` cron was suspended on 2026-06-30. To unsuspend:

1. Go to https://dashboard.render.com
2. Find service **`alleato-project-synthesis-sweep`** (ID: `crn-d8ne6u8js32c73dkbre0`)
3. Click the service
4. Click the **"Unsuspend"** button in the top menu
5. Confirm the action

**Alternative (via Render CLI):** *(if available)*
```bash
render services list --output json | grep alleato-project-synthesis-sweep
# Then use the dashboard URL or API to unsuspend
```

### Step 3: Verify the Fix

After unsuspending, monitor these indicators:

#### Indicator 1: Cron Completes Successfully
- **When:** Next scheduled run at 07:00 UTC
- **Check:** Render dashboard shows the run completed with exit code 0 (not 1)
- **Logs:** Should show `[ProjectSynthesizer] sweep done: projects=X emails=Y...`

#### Indicator 2: Narrative Tables Are Fresh
Run this query in the PM APP (Supabase) ~30 minutes after the cron runs:

```sql
-- Check project_current_state freshness
SELECT MAX(updated_at) as latest_update, COUNT(*) as total_rows
FROM project_current_state;
-- Expected: updated_at = today's date (or very recent)

-- Check intelligence_packets freshness (synthesis version)
SELECT MAX(generated_at) as latest_generation, COUNT(*) as total_packets
FROM intelligence_packets
WHERE compiler_version = 'project_intelligence_synthesis_v1'
  AND packet_type = 'current';
-- Expected: generated_at = today's date (or very recent)
```

#### Indicator 3: Intelligence Pages Show Current Narratives
1. Go to any project's intelligence page: `/[projectId]/intelligence`
2. Check the narrative section — it should show today's or very recent summaries
3. Compare with a project you know had recent activity (e.g., project 753, 754, 870, etc.)

#### Indicator 4: Health Check Reports Healthy
After the health check runs at 08:30 UTC:

```bash
# Check Render logs for the health check cron
# Look for: alleato-project-intelligence-staleness-check

# Expected output (healthy):
{
  "check": "project_intelligence_staleness",
  "healthy": true,
  "project_current_state_staleness_days": 0,
  "intelligence_packets_staleness_days": 0,
  "alerts": []
}

# If unhealthy (should not occur):
{
  "check": "project_intelligence_staleness",
  "healthy": false,
  "alerts": [
    {
      "table": "project_current_state",
      "staleness_days": 5,
      "message": "project_current_state narratives are stale: 5 days old"
    }
  ]
}
```

## Rollback Plan

If the cron fails again after unsuspending:

1. **Check the logs:** Render dashboard → service logs → find the error
2. **Common issues:**
   - `AppDbProjectionError` → the fix didn't work (investigate per-project budget logic)
   - LLM failure → check OpenAI API health / quota
   - DB connection → check Supabase status
3. **Suspend the cron again** to prevent noise
4. **File a follow-up issue** with the error details

## Success Criteria

✅ All of the following must be true:

- [ ] PR #763 is merged to `main`
- [ ] Cron `alleato-project-synthesis-sweep` is unsuspended in Render
- [ ] Cron's next run (07:00 UTC) completes with exit code 0
- [ ] `project_current_state.updated_at` is fresh (today or very recent)
- [ ] `intelligence_packets.generated_at` is fresh (today or very recent)
- [ ] At least one project's `/intelligence` page shows current narratives
- [ ] Health check runs at 08:30 UTC and reports healthy

## Monitoring Going Forward

The new health check (`alleato-project-intelligence-staleness-check`) will run daily at 08:30 UTC and alert if:
- Narratives go stale (project_current_state table is older than 2 days or empty)
- Synthesis packets fail to generate (intelligence_packets table is older than 2 days or empty)
- Sweep cron failures are detected indirectly via table staleness (no fresh rows)

This provides the missing visibility that allowed the 2+ week freeze in this incident.

## Related Issues

- #754: Graph-sync L2 synthesis gating (separate but adjacent)
- #744: Daily Deep Read model selection

---

**Created:** 2026-07-09
**Owner:** Claude Code / Megan Harrison
