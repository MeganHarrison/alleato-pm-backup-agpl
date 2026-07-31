---
title: Telemetry suppress-list
description: The two-layer suppress-list (server + client) that keeps expected behaviors out of /errors. Companion to the telemetry-noise-classification error pattern.
---

# Solution: Telemetry Suppress-List

**Solves:** [telemetry-noise-classification](../errors/telemetry-noise-classification.md)

---

## The Architecture

Two write points, two filters. Both must agree.

```
  Server: GuardrailError → withApiGuardrails → [SERVER FILTER] → recordAppErrorEvent
  Client: fetch failure  → reportApiFailure  → [CLIENT FILTER] → POST /api/app-error-events
```

If a noise class is missed at one layer, it shows up in `/errors` anyway. Always add new entries to both.

---

## Server Filter

`frontend/src/lib/guardrails/api.ts`:

```ts
// 401/403 are user-state, not application errors — do not pollute telemetry
const authCodes = new Set([
  "AUTH_EXPIRED",
  "UNAUTHORIZED",
  "AUTH_FORBIDDEN",
  "FORBIDDEN",
]);
const httpStatus = error.status ?? catalog.httpStatus;
const isAuthNoise =
  authCodes.has(error.code) || httpStatus === 401 || httpStatus === 403;

// 4xx with user-error codes are user behavior, not application bugs
const userErrorCodes = new Set([
  "INVALID_PAYLOAD",
  "INVALID_INPUT",
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "VALIDATION",
  "NOT_FOUND",
  "ROUTE_BINDING_MISSING",
  "READ_ONLY_RESOURCE",
  "PRECONDITION_FAILED",
]);
const is4xxUserError =
  httpStatus >= 400 &&
  httpStatus < 500 &&
  userErrorCodes.has(error.code);

if (where !== "/api/app-error-events#POST" && !isAuthNoise && !is4xxUserError) {
  void recordAppErrorEvent(/* ... */);
}
```

---

## Client Filter

`frontend/src/lib/api-client.ts`:

```ts
// Same auth-state suppression
if (typeof window === "undefined") return;
if (url.includes("/api/app-error-events")) return;
if (status === 401 || status === 403) return;

// Supabase auth client lock contention is library noise, not an app bug
const LOCK_NOISE_PATTERNS = [
  "lock broken by another request",
  "lock was stolen by another request",
  'lock "lock:sb-',
  "was released because another",
];
const lowered = message.toLowerCase();
if (LOCK_NOISE_PATTERNS.some((p) => lowered.includes(p))) return;
```

---

## What Is and Isn't Noise

| Class | Suppressed? | Reasoning |
|---|---|---|
| 401, 403 (any code) | ✅ Yes | User isn't signed in or doesn't have permission. Working as designed. |
| 4xx user-validation codes (e.g. `INVALID_PAYLOAD`, `NOT_FOUND`) | ✅ Yes | User did something invalid. The API correctly told them. |
| `supabase-js` lock contention messages | ✅ Yes | Internal library coordination, not an app bug. |
| `UPSTREAM_TIMEOUT` from a status endpoint | ✅ Yes (graceful-degraded to 200 at the proxy) | Backend availability, not a bug in our code. See `status-endpoint-sequential-io.md`. |
| Any 5xx response | ❌ NO | Real bugs. Keep these. |
| Any client TypeError that hits route_error_boundary | ❌ NO | Real bugs. Keep these. |
| `INTERNAL_ERROR`, `DB_ERROR`, `UPSTREAM_FAILURE` (non-status routes) | ❌ NO | Real bugs. Keep these. |

---

## When to Add a New Suppress Rule

1. **Confirm it's noise**: events represent expected behavior, not application failures
2. **Add to BOTH layers**: server and client (even if only one currently emits the event)
3. **Update the table above** in this doc
4. **Backfill existing groups**: write a one-shot SQL via `node -e "..."` to mark historical groups as `ignored`. The fix is forward-looking; backfilling clears the queue.

```js
// Example one-shot backfill
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

await s.from('app_error_groups')
  .update({ status: 'ignored' })
  .ilike('latest_message', '%<new noise pattern>%')
  .neq('status', 'fixed')
  .neq('status', 'ignored');
```

---

## When NOT to Add a Rule

If the message is unique to your codebase ("Failed to load tasks", "Change event not found", etc.), it's almost certainly a real bug, not noise. **Don't suppress** — fix the root cause and let the reduced volume speak for itself.

Suppressing real bugs is how you end up with zero events on `/errors` and a broken app.

---

## References

- Error pattern: `docs/patterns/errors/telemetry-noise-classification.md`
- Suppress-list location: `frontend/src/lib/guardrails/api.ts` (server) + `frontend/src/lib/api-client.ts` (client)
- Introduced in commits: `0bf0c5878` (auth), `3e9931613` (locks + 4xx)
