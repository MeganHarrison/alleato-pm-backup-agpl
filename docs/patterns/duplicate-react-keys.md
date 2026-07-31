# Duplicate React Keys — Prevention Guide

## The Error

```
Encountered two children with the same key, `%s`. Keys should be unique so that
components maintain their identity across updates.
```

React logs the key value where `%s` appears. A value of **`-undefined`** or
**`undefined`** means a key was built from a field that is `undefined` or `null`.

---

## Root Causes in This Codebase

### 1. Key derived from a nullable/optional field

```tsx
// BAD — if option.value is undefined, every item gets key="undefined"
{options.map((option) => (
  <SelectItem key={option.value} value={option.value}>
    {option.label}
  </SelectItem>
))}
```

**Fix:** Deduplicate and filter before rendering. The canonical place for
dropdown options is the **hook that builds them** (`use-cost-codes.ts`,
`use-vendors.ts`, etc.) — not in each consumer.

```tsx
// GOOD — options are pre-filtered in the hook
{options.map((option) => (
  <SelectItem key={option.value} value={option.value}>
    {option.label}
  </SelectItem>
))}
```

`use-cost-codes.ts` already applies this fix:

```ts
const seen = new Set<string>();
const costCodeOptions = costCodes
  .filter((code) => {
    if (!code.id) return false;       // skip empty ids
    if (seen.has(code.id)) return false; // skip duplicates
    seen.add(code.id);
    return true;
  })
  .map((code) => ({ value: code.id, ... }));
```

Apply the same pattern to any hook that produces dropdown `options`.

---

### 2. Key built from two fields where one may be undefined

```tsx
// BAD — produces "something-undefined" if item.label is undefined
key={`${item.href}-${item.label}`}
```

**Fix:** Provide a fallback or use a guaranteed-unique field:

```tsx
key={item.href ?? item.label ?? String(index)}
```

---

### 3. Same component rendered twice with identical static keys

```tsx
// BAD — two SummaryCardGrid renders in different branches can produce
// duplicate keys if React reconciles them together
<SummaryCardGrid cards={summaryCards} />   // branch A
<SummaryCardGrid cards={summaryCards} />   // branch B (same array, same ids)
```

**Fix:** Ensure truly exclusive rendering (only one branch active at a time),
or add a namespace prefix to the card ids:

```tsx
const summaryCards = [
  { id: 'co-approved', ... },
  { id: 'co-pending',  ... },
];
```

---

## Where This Has Been Fixed

| File | What was fixed | Date |
|------|---------------|------|
| `frontend/src/hooks/use-cost-codes.ts` | Added dedup+filter before building `costCodeOptions` | 2026-04-07 |

---

## Prevention Checklist

Before any `.map()` that uses a `key`:

1. **Is the key field guaranteed non-null?** If not, add `?? index` as a last
   resort (index alone is only safe when the list never reorders/deletes).
2. **Could duplicates exist in the source data?** If yes, deduplicate in the
   data layer (hook or API response normaliser), not in the component.
3. **Is the component rendered more than once on the same page with the same
   data?** If yes, namespace the ids.

## Quick Diagnostic

When you see `key="-undefined"`:
- The key was a template literal `` `${a}-${b}` `` where `b` is `undefined`
- Search for `key={\`` or `key={item.` near the warning's component stack
- Check the **data source** (hook or API), not just the render

When you see `key="undefined"`:
- A single field used directly as key (`key={item.id}`) resolved to `undefined`
- The field is optional/nullable — add dedup+filter in the data layer
