---
title: Telemetry noise classification
description: Expected behavior (auth failures, validation errors, library lock contention) was being logged as application errors, inverting the signal-to-noise ratio on /errors and burying real bugs.
---

# Pattern: Telemetry Noise Classification

**Severity:** HIGH (silently destroys the value of the entire error tracker)
**Triggers:** `app_error_events`, `recordAppErrorEvent`, `withApiGuardrails`, `reportApiFailure`, `/errors`, "Authentication required", "Lock broken", "File too large"

---

## The Mistake

The app's error tracker (`/errors`, backed by `app_error_groups` / `app_error_events`) was logging **every** `GuardrailError` caught by the API guardrails layer, regardless of HTTP status or error code. Same on the client side — `apiFetch`'s `reportApiFailure` was POSTing every non-OK response.

Result: 614+ noise events buried the 5 real bugs in this codebase.

---

## What Counts as Noise (and Why)

| Class | Examples | Why It's Not a Bug |
|---|---|---|
| **Auth-state 401/403** | "Authentication required", "Sign in before loading your profile", "Unauthorized cron invocation" | The user wasn't signed in. The auth system worked correctly. Logging this is just measuring "how often unauthed users hit endpoints." |
| **Supabase auth client lock contention** | "Lock broken by another request with the 'steal' option", "Lock was stolen by another request", `lock:sb-...-auth-token` released | `supabase-js` uses LocalStorage locks to coordinate token refresh across tabs. When two tabs refresh at once, one steals the lock. This is an internal library operation, not an application error. |
| **4xx user-validation** | "File too large. Maximum size is 50MB.", "Budget line cannot be deleted because 1 active budget modification references…", "Change event not found." (after route-level nil-UUID guard returns 400) | The API correctly told the user they did something invalid. Logging these is logging the user's behavior, not a bug in the app. |

---

## What Is a Bug (and stays logged)

- Any 5xx response (`INTERNAL_ERROR`, `DB_ERROR`, `UPSTREAM_FAILURE`, `UPSTREAM_TIMEOUT`)
- Client-side TypeErrors that crash the route error boundary
- Any error in code we own that we wouldn't expect at runtime

---

## The Fix

### Server-side (in `withApiGuardrails`)

`frontend/src/lib/guardrails/api.ts` — before calling `recordAppErrorEvent`, check both auth and user-error codes:

```ts
// 401/403 are user-state, not application errors — do not pollute telemetry
const authCodes = new Set(["AUTH_EXPIRED", "UNAUTHORIZED", "AUTH_FORBIDDEN", "FORBIDDEN"]);
const httpStatus = error.status ?? catalog.httpStatus;
const isAuthNoise = authCodes.has(error.code) || httpStatus === 401 || httpStatus === 403;

// 4xx with user-error codes are user behavior, not application bugs
const userErrorCodes = new Set([
  "INVALID_PAYLOAD", "INVALID_INPUT", "BAD_REQUEST",
  "VALIDATION_ERROR", "VALIDATION",
  "NOT_FOUND", "ROUTE_BINDING_MISSING",
  "READ_ONLY_RESOURCE",
  "PRECONDITION_FAILED",
]);
const is4xxUserError =
  httpStatus >= 400 && httpStatus < 500 && userErrorCodes.has(error.code);

if (!isAuthNoise && !is4xxUserError) {
  await recordAppErrorEvent(/* ... */);
}
```

### Client-side (in `apiFetch.reportApiFailure`)

`frontend/src/lib/api-client.ts` — same logic, plus the Supabase lock patterns:

```ts
// 401/403 are user-state, not application errors
if (status === 401 || status === 403) return;

// Supabase auth-client lock contention is library noise, not app bugs
const LOCK_NOISE_PATTERNS = [
  "lock broken by another request",
  "lock was stolen by another request",
  'lock "lock:sb-',
  "was released because another",
];
if (LOCK_NOISE_PATTERNS.some((p) => message.toLowerCase().includes(p))) return;
```

---

## Backfill Existing Noise

After the code fix, run a one-shot SQL backfill via `node -e "..."`:

```js
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mark every existing noise group as `ignored`
await s.from('app_error_groups')
  .update({ status: 'ignored' })
  .or('latest_error_code.in.(AUTH_EXPIRED,UNAUTHORIZED,AUTH_FORBIDDEN,FORBIDDEN),latest_message.ilike.%authentication required%')
  .neq('status', 'fixed').neq('status', 'ignored');
```

2026-05-18 backfill cleared **645 groups** representing 1000+ noise events.

---

## Status Workflow on `/errors`

| Status | Meaning |
|---|---|
| `new` | A real bug; nobody's looked at it. |
| `triaged` | Acknowledged but not actively being worked. |
| `in_progress` | A fix is in flight (commit pending) or just shipped (waiting on telemetry to confirm). |
| `fixed` | A fix shipped AND 7+ days passed with zero new events. |
| `ignored` | Noise (per the classification above) or known-WontFix user behavior. |
| `needs_human` | The AI agent can't classify or fix — escalation queue. |

---

## Recurrence Killer

The suppress-lists at both server and client write points are now permanent. Any future error code added to the catalog needs to be classified and added to one of the sets in `api.ts` / `api-client.ts`.

The reporter is the single chokepoint for telemetry — it cannot leak noise as long as the suppress-list stays correct.

---

## References

- Server filter: `frontend/src/lib/guardrails/api.ts`
- Client filter: `frontend/src/lib/api-client.ts`
- Error code catalog: `frontend/src/lib/guardrails/errors.ts`
- Backfill examples: commits `0bf0c5878` (auth) and `3e9931613` (locks + 4xx)
