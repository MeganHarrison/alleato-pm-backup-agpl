---
title: Status endpoint sequential I/O
description: A status/health endpoint runs many sequential Supabase queries with no caching, exceeding the upstream fetch timeout and producing repeated 504s.
---

# Pattern: Status Endpoint Sequential I/O

**Severity:** HIGH (repeated 504s, broken admin UI, telemetry pollution)
**Triggers:** `/api/admin/*/status`, `/api/*/health`, `fetchWithPolicy`, `UPSTREAM_TIMEOUT`, "did not complete within retry policy"

---

## The Mistake

A status or health endpoint issues 10+ sequential queries to one or more databases on every request. There is no cache. The upstream timeout (default 25s with 1 retry → ~50s worst case) is exceeded every time the underlying DB is even mildly slow.

The Next.js API route proxying to the backend reports `UPSTREAM_TIMEOUT` 504s on every call, which then floods the error tracker AND the consumer (an admin dashboard polling the endpoint).

---

## Real Incident — 2026-05-18 telemetry

| Route | Events | Status | Real cause |
|---|---|---|---|
| `GET /api/admin/source-sync/status` | 18 + 16 + 5 | 504 | Backend handler made 10+ sequential Supabase queries across two projects, scanning up to 2500 `document_metadata` rows + 5000 `fireflies_ingestion_jobs` rows + 5000 `source_intelligence_jobs` rows + a paginated batch-join for `document_chunks` |

---

## The Fix (two layers)

### 1. Cache at the backend

Status endpoints are called constantly (every page render of the admin dashboard, every poll cycle). They should answer in <500ms and represent state from the last ~60s.

Use an in-process cache with double-checked locking:

```python
# backend/src/api/main.py — pattern
import asyncio, time

_CACHE: dict = {}
_CACHE_LOCK = asyncio.Lock()
_TTL = 60  # seconds

@app.get("/api/health/source-sync")
async def source_sync_health():
    now = time.time()
    cached = _CACHE.get("source_sync_health")
    if cached and (now - cached["ts"]) < _TTL:
        return {**cached["payload"], "cacheAgeSeconds": int(now - cached["ts"])}

    async with _CACHE_LOCK:
        # re-check inside the lock to avoid thundering herd
        cached = _CACHE.get("source_sync_health")
        if cached and (now - cached["ts"]) < _TTL:
            return {**cached["payload"], "cacheAgeSeconds": int(now - cached["ts"])}

        payload = await _compute_source_sync_health()
        _CACHE["source_sync_health"] = {"payload": payload, "ts": now}
        return {**payload, "cacheAgeSeconds": 0}
```

### 2. Graceful degradation at the frontend proxy

If the backend is genuinely unreachable, return a structured `"unavailable"` payload as HTTP 200 instead of bubbling the 504. The UI can render "checking…" instead of erroring, and the error tracker stays clean.

```ts
// frontend/src/app/api/admin/source-sync/status/route.ts
try {
  const data = await fetchWithPolicy(BACKEND_URL, /* ... */);
  return NextResponse.json(data);
} catch (error) {
  if (error.code === "UPSTREAM_TIMEOUT" || error.code === "UPSTREAM_FAILURE") {
    // Don't surface 504 to the user or pollute /errors; return structured status.
    return NextResponse.json({
      status: "unavailable",
      message: "Backend health check did not respond. Retrying in the background.",
    });
  }
  throw error;
}
```

---

## Detection

```bash
# Find candidate offenders: status/health endpoints with many awaited supabase calls
for f in $(grep -rl "status\|health" frontend/src/app/api/admin/ backend/src/api/); do
  count=$(grep -c "supabase\.\|.from(" "$f" 2>/dev/null || echo 0)
  if [ "$count" -ge 5 ]; then
    echo "$count queries in $f"
  fi
done
```

---

## Status Endpoint Checklist

Before any new `/api/*/status` or `/api/*/health` route ships:

- [ ] Total worst-case response time under 500ms in steady state
- [ ] Cache layer with TTL appropriate to consumer polling rate (60s default)
- [ ] Backend cache uses double-checked locking to prevent thundering herd
- [ ] Frontend proxy degrades to a structured `"unavailable"` payload on upstream failure (HTTP 200, not 5xx)
- [ ] Suppress-list excludes the frontend route's `UPSTREAM_TIMEOUT` so a backend outage doesn't spam `/errors`

This checklist is **not** automatable — it's a code review gate.

---

## References

- Fix applied: `backend/src/api/main.py` (cache), `frontend/src/app/api/admin/source-sync/status/route.ts` (degradation), `frontend/src/app/api/admin/source-sync/_contracts.ts` (added `"unavailable"` status to enum) — commit `aca196aa6`
- Pattern document: this file
