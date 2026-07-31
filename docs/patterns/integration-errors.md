# Integration Errors — Known Patterns & Solutions

> Append new entries at the bottom. Each entry must include Context, Error, Root Cause, Fix, and Prevention.

---

### Acumatica OData $filter — HTTP 500 "Type Conversions Not Supported" — 2026-03-05

**Context:** AI Assistant CFO Agent calling Acumatica REST API for AP Aging, AR Aging, and Cash Position reports
**Error:** Acumatica returns HTTP 500 with body containing `"Type conversions not supported"` when using OData `$filter` parameters like `Balance gt 0` or date comparisons
**Root Cause:** Acumatica's OData implementation does not support type conversion on certain fields. Numeric comparisons (`Balance gt 0`) and date comparisons (`Date gt datetimeoffset'...'`) fail silently at the API level with a 500 error. The AI assistant then surfaces this as "temporary issue with the ERP system."
**Fix:** Remove all `$filter` parameters from Acumatica API calls. Filter data in-memory instead:

```typescript
// BAD — causes HTTP 500
const params: Record<string, string> = {
  $filter: "Balance gt 0",  // ❌ Acumatica can't handle this
};

// GOOD — filter after fetch
const bills = await this.get<APBill[]>("/entity/Default/24.200.001/Bill", {});
for (const bill of bills) {
  const balance = parseFloat(bill.Balance?.value || "0");
  if (balance <= 0) continue;  // ✅ Filter in-memory
  // ... process bill
}
```

**Prevention:**
- NEVER use OData `$filter` with Acumatica REST API — it frequently fails with type conversion errors
- Always fetch all records and filter in-memory
- `$select`, `$top`, and `$expand` are generally safe to use
- When Acumatica tools fail, test the raw API with Node.js (not curl — `!` in passwords causes shell issues)
- HTTP 500 from Acumatica usually means bad OData query, not an auth or server problem
**File:** `frontend/src/lib/acumatica/client.ts` — methods: `getAPAging()`, `getARAging()`, `getCashPosition()`

---

### Acumatica API Authentication — Password Shell Escaping — 2026-03-05

**Context:** Testing Acumatica login via command line (curl)
**Error:** JSON parsing error when sending login request via curl
**Root Cause:** The Acumatica password contains `!` which triggers bash history expansion when used in double-quoted strings. The `!` gets expanded by the shell before being sent to curl.
**Fix:** Test Acumatica API via Node.js `http` module instead of curl:

```javascript
// Use Node.js for Acumatica API testing — avoids shell escaping issues
node -e "
const http = require('https');
const data = JSON.stringify({
  name: process.env.ACCOUNTING_USER,
  password: process.env.ACCOUNTING_PASSWORD,
  company: 'Alleato Group LLC'
});
// ... make request
"
```

**Prevention:**
- Use Node.js (not curl) for testing APIs when passwords contain special characters (`!`, `$`, backticks, etc.)
- If you must use curl, use single quotes for the data payload and `$'...'` syntax
- Load credentials from `.env` via `process.env` rather than interpolating them into shell strings
**Credentials location:** `.env` file — `ACCOUNTING_USER` and `ACCOUNTING_PASSWORD`

---

### Vercel AI Gateway — Unnecessary Dual Billing — 2026-03-05

**Context:** AI Assistant chat returning "insufficient funds" error despite user having a funded OpenAI API key
**Error:** AI requests routed through `@ai-sdk/gateway` (Vercel AI Gateway) required separate funding from OpenAI, creating dual billing confusion
**Root Cause:** The codebase used `@ai-sdk/gateway` to proxy AI requests through Vercel's billing layer. This added a middleman between the app and OpenAI, requiring the user to fund both OpenAI AND Vercel separately. No benefit for single-provider setups.
**Fix:** Removed `@ai-sdk/gateway` entirely. All requests go directly through `@ai-sdk/openai`:

```typescript
// BAD — routes through Vercel billing proxy
import { gateway } from "@ai-sdk/gateway";
const model = gateway("openai/gpt-4.1-nano");

// GOOD — direct to OpenAI, only pay OpenAI
import { openai } from "@ai-sdk/openai";
const model = openai("gpt-4.1-nano");
```

**Prevention:**
- AI requests MUST go directly through `@ai-sdk/openai` — do NOT re-add `@ai-sdk/gateway`
- `OPENAI_API_KEY` is the ONLY key needed for AI features
- For production: set `OPENAI_API_KEY` in Vercel environment variables
- If adding future providers, add direct provider packages (e.g., `@ai-sdk/anthropic`), not the gateway
- The `resolveOpenAIModel()` function in `providers.ts` handles backward-compatible model ID mapping (strips `openai/` prefix, maps anthropic/google/xai IDs to OpenAI equivalents)
**Files:** `frontend/src/lib/ai/providers.ts`, `frontend/src/lib/ai/models.ts`

---

### Acumatica API — Correct Login Endpoint & Cookie-Based Auth — Reference

**Context:** Any code that needs to authenticate with Acumatica ERP
**Pattern:** Acumatica uses session-based authentication with cookies (NOT bearer tokens):

```typescript
// 1. Login — POST to /entity/auth/login
const loginResponse = await fetch("https://alleatogroup.acumatica.com/entity/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: process.env.ACCOUNTING_USER,      // Support@megankharrison.com
    password: process.env.ACCOUNTING_PASSWORD, // from .env
    company: "Alleato Group LLC"
  })
});
// Success = 204 No Content + Set-Cookie headers

// 2. Extract cookies from response
const cookies = loginResponse.headers.getSetCookie(); // ~12 cookies

// 3. Use cookies in subsequent requests
const dataResponse = await fetch("https://alleatogroup.acumatica.com/entity/Default/24.200.001/Bill", {
  headers: { Cookie: cookies.join("; ") }
});
```

**Key points:**
- Login returns HTTP 204 (no body) on success
- Authentication is via cookies, not Authorization header
- Company name is `"Alleato Group LLC"` (exact casing matters)
- API version is `24.200.001`
- Credentials in `.env`: `ACCOUNTING_USER`, `ACCOUNTING_PASSWORD`
