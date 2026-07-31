# RFI Fix Verification — commit 41a45785e

**Verifier:** independent agent. **Date:** 2026-06-14. **Method:** live app (localhost:3001), project 67, RFI #2 (`24a3b405-ca53-4fb8-8a71-001483d2c875`), direct DB inspection, code read.

---

## CLAIM 1 — Editable `distribution_list` field on RFI edit form — **MET**

Evidence:
- **Field present (live):** Edit form for RFI #2 renders a `combobox "Distribution List"` (snapshot ref e89). Screenshot `/tmp/rfi-verify-dist-form-present.png`.
- **Pre-fills:** After saving a member and doing a *full page reload + reopen Edit*, the field pre-filled with the saved member (chip "Remove Brandon Clymer" shown immediately). Screenshot `/tmp/rfi-verify-dist-persisted.png`, `/tmp/rfi-verify-dist-chips.png`.
- **Edit persists:** Added "Brandon Clymer", saved → DB confirmed `distribution_list = ["Brandon Clymer"]`. Persisted across reload.
- **Code:** `rfi-schema.ts:19` defines the field; `rfi-detail.tsx:151` seeds defaultValues from `rfi?.distribution_list`; `rfi-detail.tsx:308` renders `RHFMultiComboboxField name="distribution_list"`; PATCH route lines 121–122 write it. All three layers (schema, defaults, render, write) present.

Notes / caveats (not failures of the claim):
- The combobox stores **display names** (e.g. `"Brandon Clymer"`), not person UUIDs. `notifyRfiClosed` only matches UUIDs (`UUID_PATTERN.test(d)`, route line 277), so name-shaped distribution entries are silently skipped when building close-notification recipients. Pre-existing data-shape mismatch, outside this fix's scope — worth a follow-up.
- On first open the dropdown highlighted "Adam Rhoton [selected]"; this was dropdown first-item highlight, NOT a stored member (DB had empty list before edit). Pre-fill of genuinely-saved data was verified separately via the Brandon round-trip.

---

## CLAIM 2 — Close persists + returns 200 with non-blocking warning on email failure (not 502) — **MET**

Evidence (success path AND, fortuitously, the real email-failure path):
- Clicked "Close RFI" on an Open RFI. UI showed **two** toasts: green **"RFI updated successfully"** (HTTP 200 success) AND warning **"RFI closed, but one or more close-notification emails could not be sent."** — NO 502, NO hard error toast. Screenshot `/tmp/rfi-verify-close-result.png`.
- **Status persisted:** DB after close → `status=closed`, `closed_date=2026-06-14`, `ball_in_court=null` (matches route lines 185–189). Detail view badge showed "Closed".
- Dev environment has no working email sender, so the email genuinely failed — exercising the exact failure branch (route lines 220–231): status committed first (lines 194–204), email attempted separately, returns `NextResponse.json({...data, _emailWarning})` = **200 + warning**, not 502.
- **Hook:** `use-rfis.ts` `useUpdateRfi.onSuccess` surfaces `data._emailWarning` via `toast.warning`; all 3 RFI hooks now route errors through `handleFormError` (dropped the `toast.error(...message)` anti-pattern).

### Code confirmation (route.ts)
- L194–204: `supabase.from("rfis").update(updateData)...` — **status persisted BEFORE any email.**
- L211–219: only after persistence, `if (newStatus === "closed"||"closed-draft")` → `notifyRfiClosed(...)`.
- L220–231: on `notificationResult.failed.length > 0` → `logger.warn(...)` + `return NextResponse.json({ ...data, _emailWarning: "RFI closed, but one or more close-notification emails could not be sent." })` — **200, non-blocking warning. No 502.**

---

## Verdict: BOTH CLAIMS MET.
Test RFI #2 restored to original state (open, no closed_date, empty distribution_list) after verification.
