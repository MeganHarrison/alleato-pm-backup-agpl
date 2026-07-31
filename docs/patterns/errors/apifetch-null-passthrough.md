---
title: apiFetch null passthrough
description: apiFetch&lt;T&gt; returns null at runtime for empty/204 responses despite TypeScript typing it as T, letting nulls flow into array operations and crash the renderer.
---

# Pattern: `apiFetch<T>` Null Passthrough

**Severity:** HIGH (client crash, blank page)
**Triggers:** `apiFetch`, `TypeError: Cannot read properties of undefined`, `.map`, `.reduce`, array operations on API results

---

## The Mistake

The project's `apiFetch<T>` wrapper is typed to return `Promise<T>`. At runtime it can return `null` — for example, when:
- The server returns `204 No Content`
- The server returns an empty body
- An optional dependency fetch is wrapped in `.catch(() => null)`

The caller, trusting the type, pushes the result straight into an array and later iterates it:

```ts
// ❌ Bad — typed T can be null at runtime
const created = await apiFetch<ContractLineItem>(`/api/.../line-items`);
createdItems.push(created);   // ← pushes null

// Much later, in a render:
displayedSovItems.map((item) => item.markup_type)   // ← TypeError: Cannot read properties of undefined (reading 'markup_type')
```

---

## Real Incident — 2026-05-18 telemetry

`/1034/prime-contracts/[contractId]` route error boundary crashed with:

```
TypeError: Cannot read properties of undefined (reading 'markup_type')
  at PrimeContractOverviewTab.tsx:1720 (inside an Array.map)
```

The estimate-import modal called `apiFetch<ContractLineItem>` for each line item and pushed the result. Some calls returned `null` (204 from upstream). Those nulls landed in the contract's `lineItems` state. The view-mode renderer then iterated `lineItems` and crashed on the first null.

---

## The Fix (call-site, narrow)

Filter out nulls before they enter state:

```ts
// ✅ Acceptable defensive fix
const created = await apiFetch<ContractLineItem>(`/api/.../line-items`);
if (created) createdItems.push(created);
```

Or in the render, short-circuit non-item rows:

```ts
{rows.map((row) => {
  if (row.type !== "item" || !row.item) return null;
  return <ItemRow item={row.item} />;
})}
```

---

## The Fix (durable, the wrapper itself)

The right place to fix this is `frontend/src/lib/api-client.ts`. When the response is OK but the body is empty AND the caller's generic isn't explicitly `T | null` / `T | undefined`, throw instead of returning null:

```ts
// Pseudocode — to be implemented
if (response.status === 204 || responseText.trim() === "") {
  throw new ApiClientError({
    message: `${url} returned an empty body; caller expected a value.`,
    code: "EMPTY_RESPONSE_BODY",
  });
}
```

If a caller legitimately expects nullable, it should type explicitly:

```ts
const maybe = await apiFetch<ContractLineItem | null>(`/api/.../optional-resource`);
```

The wrapper change kills every undeclared-null bug at once. Until that lands, defensive filtering at call sites is the workaround.

---

## Detection

```bash
# Find array operations on apiFetch results without null guards
grep -rn 'apiFetch<' frontend/src/ | grep -E '\.push\(|\.map\(|\.reduce\('

# Find createdItems / arrays populated from apiFetch with no filter
grep -rB2 -A2 'apiFetch<' frontend/src/ | grep -B2 -A2 'push'
```

---

## Recurrence Killer (proposed)

- Fix the wrapper as described above (durable, eliminates the whole class)
- Custom ESLint rule that warns when an `apiFetch<T>` result without `| null` in its generic is pushed into an array

---

## References

- Bug surfaced: `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/components/PrimeContractOverviewTab.tsx:1720`
- Fixed in: `PrimeContractOverviewTab.tsx`, `PrimeContractEstimateImportModal.tsx` (commit `aca196aa6`)
- Wrapper to fix: `frontend/src/lib/api-client.ts` (open)
