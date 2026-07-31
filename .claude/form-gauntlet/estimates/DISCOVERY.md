# Estimates — Form Discovery

Tool: **Estimates**
Test project id: **67** (`/67/estimates`)
Discovered: 2026-06-13

This feature is unusual: most "forms" are **inline-edit cells, dialogs, and
imperative mutation handlers** rather than RHF `<form>` elements. Only the Edit
Estimate page uses `useForm`. The big detail client (`estimate-detail-client-v2.tsx`,
6144 lines) drives ~20 distinct mutations across 4 tabs (Summary / GC / Details /
Sublist), plus nested sub-entities (scope items, bid items, call logs, bid
invitations, awards).

Key files:
- List/table: `frontend/src/app/(main)/[projectId]/estimates/estimates-client.tsx`
- Edit form: `frontend/src/app/(main)/[projectId]/estimates/[estimateId]/edit/page.tsx`
- Detail (inline forms): `frontend/src/app/(main)/[projectId]/estimates/[estimateId]/estimate-detail-client-v2.tsx`
- Seed Budget modal: `frontend/src/components/domain/estimates/SeedBudgetFromEstimateModal.tsx`
- `new/page.tsx` is a **redirect only** (no form) — creation happens via the "New Estimate" button on the list, which POSTs a default record and routes to detail.

---

## Form: create_estimate_quick

**Title:** New Estimate (quick-create button)
**URL Path:** `/67/estimates`
**How to Open:** Click "New Estimate" button (header action OR empty-state action).
**Trigger:** `handleCreateEstimate` in `estimates-client.tsx:108`.

**Fields:** None — no dialog. POSTs hardcoded defaults: `title:"New Estimate"`, `revision:1`, `status:"draft"`, `estimate_date:today`, `insurance_rate:0.0125`, `fee_rate:0.1`, `contingency_amount:0`.

**Submit Action:** `POST /api/projects/67/estimates` → routes to `/67/estimates/{new_id}`.

**Success Criteria:**
- [ ] Navigates to the new estimate detail page
- [ ] New estimate appears in the list on return
- [ ] No error toast

**Cleanup:** Delete the created "New Estimate" record.

**Risk Notes:** Button disables during create (`isCreating`). On error, toast shown and button re-enabled. Low risk.

---

## Form: edit_estimate

**Title:** Edit Estimate (RHF + Zod — the only true react-hook-form form)
**URL Path:** `/67/estimates/{estimateId}/edit`
**How to Open:** Row ⋯ menu → "Edit" on the list, or from detail page.
**Trigger:** `EditEstimatePage`, `onSubmit` at `edit/page.tsx:116`.

**Fields:**
| Field | Type | Notes |
|-------|------|-------|
| Title | text (required) | |
| Estimate Number | text | |
| Revision | number | min 1 |
| Status | select | draft / pending_review / approved / rejected |
| Estimate Type | select | none / asrs / design_build — "none" maps to `null` |
| Date | date | ISO string conversion |
| Estimator | text | |
| Location | text | |
| Project Duration (weeks) | number | |
| Insurance Rate | number | 0–1, step 0.0001 |
| Fee Rate | number | 0–1, step 0.0001 |
| Contingency Amount | number | |
| Notes | textarea | |

**Submit Action:** `PUT /api/projects/67/estimates/{estimateId}` → routes to detail page.

**Success Criteria:**
- [ ] On open, ALL fields pre-fill from `GET /estimates/{id}` (form.reset)
- [ ] Status & Estimate Type selects show saved value, not placeholder
- [ ] Save → success toast → redirect to detail → values persisted
- [ ] Validation blocks empty Title

**Cleanup:** Revert edited fields if testing against a real record, or use a throwaway estimate.

**Risk Notes:**
- 🚩 **Save handler swallows errors** (`edit/page.tsx:126`): `catch` shows a generic `toast.error("Failed to update estimate")` and discards the real error message — violates CLAUDE.md "never return generic errors." Verify a 4xx/validation failure surfaces something actionable.
- Estimate Type "none"→null mapping: confirm round-trips (edit, set None, save, reopen → shows None).

---

## Form: delete_estimate (single)

**Title:** Delete Estimate (AlertDialog)
**URL Path:** `/67/estimates`
**How to Open:** Row ⋯ menu → "Delete".
**Trigger:** `handleDelete` in `estimates-client.tsx:135`.

**Fields:** Confirmation only.
**Submit Action:** `DELETE /api/projects/67/estimates/{id}` → `router.refresh()`.

**Success Criteria:**
- [ ] Confirm dialog shows estimate title
- [ ] Row disappears after confirm; success toast
- [ ] Cancel closes without deleting

**Cleanup:** None (delete IS the cleanup). Note: copy says "can be undone by an administrator" → likely soft delete.

**Risk Notes:** Has confirm + DELETE. Low risk.

---

## Form: bulk_delete_estimates

**Title:** Bulk Delete (toolbar)
**URL Path:** `/67/estimates`
**How to Open:** Select rows via checkboxes → toolbar bulk-delete.
**Trigger:** `handleBulkDelete` in `estimates-client.tsx:152`.

**Fields:** Selection only.
**Submit Action:** Parallel `DELETE /api/projects/67/estimates/{id}` for each selected id.

**Success Criteria:**
- [ ] Selected rows removed; "N estimates deleted" toast
- [ ] Selection cleared

**Risk Notes:**
- 🚩 **No confirmation dialog** for bulk delete (unlike single delete which has AlertDialog). `Promise.all` — if one DELETE fails the whole batch rejects and a generic error toast fires, but some rows may already be deleted server-side (partial-failure, inconsistent UI state until refresh). Single delete has a confirm; bulk does not — inconsistent.

---

## Form: seed_budget_from_estimate

**Title:** Seed Budget from Estimate (Modal w/ RadioGroup)
**URL Path:** `/67/estimates` (row menu, approved only) AND `/67/estimates/{id}` (Actions menu)
**How to Open:** Row ⋯ → "Seed Budget" (only when `status === "approved"`), or detail Actions → "Seed Budget from Estimate" (disabled unless approved).
**Trigger:** `SeedBudgetFromEstimateModal.handleSubmit` (`SeedBudgetFromEstimateModal.tsx:55`).

**Fields:**
| Field | Type | Options |
|-------|------|---------|
| Merge strategy | radio | replace / merge_add / merge_max |

**Submit Action:** `POST /api/projects/67/budget/seed-from-estimate` body `{ estimateId, mergeStrategy }`.

**Success Criteria:**
- [ ] Only enabled for approved estimates
- [ ] Success toast reports upserted/skipped count + total budget
- [ ] Budget lines created/updated in the Budget tool
- [ ] Strategy resets to "replace" on reopen

**Cleanup:** Seeded budget lines may need removal from the Budget tool depending on test scope.

**Risk Notes:** Error path surfaces `err.message` (good). Cross-tool side effect — verify against Budget tool, not just the toast.

---

## Form: gc_item_inline (Add / Edit / Delete row) — Tab: General Conditions

**Title:** GC Items inline table
**URL Path:** `/67/estimates/{id}` → "General Conditions" tab
**How to Open:** GC tab → "Add row" button / inline cell edits / row trash icon.
**Triggers:** `addGcRow` (1499), `patchGcItem` (1479), `deleteGcRow` (1529).

**Fields (per row, inline):** cost_code (text), description (text), cost_type (select: Labor/Expense/Subcontract/Revenue), qty_basis (select: ls/weeks/months), rate (number), allocation (number). Computed qty depends on duration.

**Submit Action:**
- Add: `POST /gc-items` (default Expense/ls row)
- Edit: `PATCH /gc-items/{id}` on cell blur
- Delete: `DELETE /gc-items/{id}` (optimistic, reverts on error)

**Success Criteria:**
- [ ] Add inserts a row that persists on reload
- [ ] Each inline cell (cost_code, description, cost_type, qty_basis, rate, allocation) **persists after reload**
- [ ] Delete removes row; reload confirms gone
- [ ] GC total recalculates

**Cleanup:** Delete added rows.

**Risk Notes:**
- 🚩 **Line-item cell persistence** is the primary risk class here — many inline cells PATCH on blur. Verify each column saves, especially the selects (cost_type, qty_basis) and rate/allocation numbers.
- Delete is optimistic with revert — good. No confirm on single GC row delete (acceptable for inline grid).

---

## Form: gc_template_save

**Title:** Save as Template (Dialog)
**URL Path:** `/67/estimates/{id}` → GC tab
**How to Open:** GC tab template menu → "Save as Template".
**Trigger:** `handleCreateTemplate` (1338). Dialog at line 1942.

**Fields:** Template Name (text, required).
**Submit Action:** `POST /api/estimates/gc-templates` body `{ name, items: [...current GC rows] }`.

**Success Criteria:**
- [ ] Name required (no-op if blank)
- [ ] Success toast; template appears in load list
- [ ] Captures current GC rows

**Cleanup:** Templates are global (not project-scoped) — created test templates persist app-wide; delete if a delete path exists, otherwise note pollution.

**Risk Notes:** 🚩 Global side effect (template list is app-wide, `/api/estimates/gc-templates` not project-scoped) — test templates will appear for all projects.

---

## Form: gc_template_load

**Title:** Load Template (confirm Dialog)
**URL Path:** `/67/estimates/{id}` → GC tab
**How to Open:** GC tab template menu → select a template.
**Trigger:** `handleSelectTemplate` (1370) → `handleConfirmLoadTemplate` (1393). Dialog at line 1981.

**Fields:** Confirmation only.
**Submit Action:** **`DELETE /gc-items` (bulk wipe all GC rows)** then `POST /gc-items` with template items.

**Success Criteria:**
- [ ] Confirm dialog warns existing rows will be replaced
- [ ] After load: old GC rows gone, template rows present
- [ ] GC total updates

**Risk Notes:**
- 🚩 **Destructive**: load does a full `DELETE /gc-items` wipe before insert. If the subsequent fetch/insert fails after the delete, GC items are lost with no rollback (delete + fetch-template + insert are not transactional client-side). Verify failure mid-sequence doesn't leave an empty GC tab.

---

## Form: detail_item_inline (catalog row edit / create / delete) — Tab: Details

**Title:** Detail Items by CSI division (large catalog grid)
**URL Path:** `/67/estimates/{id}` → "Details" tab
**How to Open:** Details tab → expand a division → edit a catalog row's amount/cost_type; rows auto-create on first edit (`upsertDetailCatalogRow`, 1572).
**Triggers:** `upsertDetailCatalogRow` (1572, POST on first edit / PATCH if exists), `patchDetailItem` (1552), `deleteDetailRow` (1627).

**Fields (inline per catalog row):** estimated_amount (number), cost_type (select), plus catalog-driven cost_code/name/division.

**Submit Action:**
- First edit: `POST /detail-items`
- Subsequent: `PATCH /detail-items/{id}`
- Delete: `DELETE /detail-items/{id}` (optimistic)

**Success Criteria:**
- [ ] Editing a blank catalog row's amount **creates** a persisted detail row (reload confirms)
- [ ] Re-editing PATCHes the same row (no duplicate created)
- [ ] cost_type select persists
- [ ] Division totals + grand total recompute
- [ ] "Hide empty rows" toggle works

**Cleanup:** Delete created detail rows.

**Risk Notes:**
- 🚩 **Line-item cell persistence / duplicate-create risk**: `upsertDetailCatalogRow` matches existing rows by `division_code + cost_code`. If matching is off, a second edit could POST a duplicate instead of PATCHing. Verify edit-twice does NOT create two rows.

---

## Form: estimate_summary_fields_inline — Tab: Summary

**Title:** Estimate-level editable fields (duration, rates, contingency)
**URL Path:** `/67/estimates/{id}` → "Summary" tab
**How to Open:** Summary tab inline fields.
**Trigger:** `patchEstimate` (1439), `handleDurationMonthsBlur` (1465).

**Fields:** project_duration_months (→ derives weeks), insurance_rate, fee_rate, contingency_amount — all `PUT /estimates/{id}` on blur.

**Success Criteria:**
- [ ] Editing duration months updates weeks AND persists both
- [ ] Rate/contingency edits persist on reload
- [ ] Totals recompute live

**Risk Notes:**
- 🚩 **`handleSave` is fake** (1430): the "Save" button shown when `isDirty` just `setTimeout(300)` + toast "Changes saved" — it does NOT call any API. Real saves happen on blur via `patchEstimate`. The visible Save button is theater; if a user edits and clicks Save expecting it to flush, it does nothing meaningful. Confirm there's no unsaved-state data loss.
- `patchEstimate` catch logs + shows `showEstimateError` with real message (good).

---

## Form: sublist_sub_inline (add bidder / company picker / contact / status cells) — Tab: Sublist

**Title:** Sublist subs table (bid pursuit per CSI division)
**URL Path:** `/67/estimates/{id}` → "Sublist" tab
**How to Open:** Sublist tab → expand division → add draft sub → fill company/contact/status inline.
**Triggers:** `createDraftSub`/`persistDraftSub` (2772/2843), `selectCompany` (3598), `commitManualCompany` (3623), `patchSublistSub` (1650), `deleteSublistSub` (1668).

**Fields (inline):** company (combobox from `companies` table, or free-text manual), contact_name, email, cell, price, intend_to_submit (select Yes/No), email_sent, phone_follow_up, bid_received, comments.

**Submit Action:** Draft persisted via `POST /sublist`; edits `PATCH /sublist/{id}`; delete `DELETE /sublist/{id}` (with `window.confirm`).

**Success Criteria:**
- [ ] Selecting a company from combobox fills company_id + name + contact + email + cell, all persist
- [ ] Manual (free-text) company saves with `company_id: null`
- [ ] Status selects persist (intend/email_sent/phone_follow_up/bid_received)
- [ ] price persists
- [ ] Delete prompts confirm, removes row, reload confirms

**Cleanup:** Delete created subs.

**Risk Notes:**
- **FK check — PASS (no mismatch):** sublist `company_id` FK → `companies` table; combobox sources from `companies` (`createClient().from("companies")`, line 3513) and stores `company.id`. Route validates `company_id` as `z.string().uuid()`. Read path also re-fills from companies. ✅ Not the known vendor/companies mismatch.
- 🚩 **Line-item cell persistence** across many inline columns — verify each status select + price + contact field round-trips.
- Delete uses `window.confirm` (not the DS ConfirmDeleteDialog) — works but inconsistent with design system.

---

## Form: scope_item_inline (add / check / delete / seed) — Tab: Sublist (per division)

**Title:** Scope package items per division
**URL Path:** `/67/estimates/{id}` → Sublist tab → division scope panel
**Triggers:** `addScopeItem` (3047), `toggleScopeItemChecked` (3082), `deleteScopeItem` (3112), seed button (inline `onClick` at 4243).

**Fields:** description (text input + add), is_checked (checkbox toggle).
**Submit Action:** `POST /scope-items`, `PATCH /scope-items/{id}` (is_checked), `DELETE /scope-items/{id}`, `POST /scope-items/seed` (bulk seed from estimate detail).

**Success Criteria:**
- [ ] Add scope item persists (reload)
- [ ] Checkbox toggle persists
- [ ] Seed adds N items from estimate, toast reports count
- [ ] Delete removes item

**Risk Notes:**
- 🚩 `toggleScopeItemChecked` (3099) catch **silently reverts** with NO toast/log — a failed checkbox save just snaps back with no user feedback (swallowed error). Verify the toggle actually persisted.
- `deleteScopeItem` has no confirm (inline, acceptable) but optimistic-reverts on error (good).

---

## Form: bid_item_inline (structured bid entry per sub) — Tab: Sublist

**Title:** Bid items (line-item bid breakdown per sub)
**URL Path:** `/67/estimates/{id}` → Sublist → expand a sub's bid breakdown
**Triggers:** `addBidItem` (3231), `patchBidItem` (3285), `deleteBidItem` (3318).

**Fields:** description (text, required), amount (number), scope_item_id (optional select linking to a scope item), is_excluded (toggle).
**Submit Action:** `POST /sublist/{subId}/bid-items`, `PATCH /bid-items/{id}`, `DELETE /bid-items/{id}`. Each mutation recomputes and PATCHes the sub's `price`.

**Success Criteria:**
- [ ] Add bid item (desc required) persists; sub price updates to sum of non-excluded items
- [ ] Edit amount → sub price recalculates and persists
- [ ] Toggle is_excluded → excluded from price total
- [ ] Delete → price recomputes; on error, `loadBidItems` re-syncs

**Risk Notes:**
- 🚩 **Line-item persistence + derived-total coupling**: bid item price changes cascade to `onPatchSub(subId, { price })`. If the bid-item write succeeds but the sub price PATCH fails, sub price drifts from bid-item sum. Verify totals stay consistent after add/edit/delete.

---

## Form: call_log (Dialog) — Tab: Sublist

**Title:** Log a call / outreach
**URL Path:** `/67/estimates/{id}` → Sublist → sub call-log action
**Trigger:** `openCallLog` (2888) → `submitCallLog` (2898).

**Fields:** outcome (select/required: e.g. Reached/Voicemail/No answer), notes (textarea, optional).
**Submit Action:** `POST /sublist/{subId}/call-logs`; also PATCHes sub `phone_follow_up`.

**Success Criteria:**
- [ ] Outcome required (no-op if empty)
- [ ] Log appears in the sub's call history list
- [ ] sub `phone_follow_up` updates
- [ ] "Call logged" toast

**Cleanup:** Call logs accumulate; no UI delete observed.

**Risk Notes:** Moderate. Verify the log persists and phone_follow_up reflects outcome.

---

## Form: bid_invitation (Dialog — Outlook draft) — Tab: Sublist

**Title:** Send Bid Invitation
**URL Path:** `/67/estimates/{id}` → Sublist → sub "invite" action
**Trigger:** `sendBidInvitation` (3409). Dialog at line 5679.

**Fields:** bid_due_date (date, optional), custom_message (textarea, optional).
**Submit Action:** `POST /sublist/{subId}/bid-invitation` → creates an Outlook draft via Microsoft Graph; PATCHes sub `email_sent: "Yes"`.

**Success Criteria:**
- [ ] Requires a sub with a reachable contact (email)
- [ ] On success: "draft created in Outlook" toast with "Open in Outlook" action link
- [ ] sub `email_sent` flips to Yes
- [ ] Dialog fields reset

**Cleanup:** Created Outlook draft may need manual deletion from Brandon's mailbox.

**Risk Notes:** 🚩 External side effect (Microsoft Graph draft). Requires sub to have an email. Verify graceful failure when no contact email exists.

---

## Form: award_sub (action, not a dialog) — Tab: Sublist

**Title:** Award / Revoke sub
**URL Path:** `/67/estimates/{id}` → Sublist
**Trigger:** `awardSub` (1734).

**Fields:** None (toggle action). `body: { revoke: boolean }`.
**Submit Action:** `POST /sublist/{subId}/award`. Awarding one sub un-awards others in same division. On award with company_id+price, offers a toast action to create a subcontract (deep-links to `/commitments/new?...`).

**Success Criteria:**
- [ ] Award marks sub awarded, un-awards siblings in division
- [ ] Revoke clears awarded flag
- [ ] "Create Subcontract →" action appears when company_id + price present
- [ ] Toasts reflect state

**Risk Notes:** 🚩 No confirm before award/revoke (state-changing, mutates sibling rows). The commitments deep-link passes `vendor_id: company_id` — confirm commitments/new accepts a companies UUID as vendor_id (cross-tool FK boundary; companies.id is the vendor FK target per CLAUDE.md known mismatch — likely correct here but verify the prefill lands).

---

## Form: use_bid (action) — Tab: Sublist

**Title:** Use bid (flow bid into estimate detail)
**URL Path:** `/67/estimates/{id}` → Sublist
**Trigger:** inline `onClick` at lines 4243-area / 5050-5070 → `POST /sublist/{subId}/use-bid`.

**Fields:** None.
**Submit Action:** `POST /sublist/{subId}/use-bid` → "Bid flowed into estimate" toast.

**Success Criteria:**
- [ ] Only shown when sub.price > 0
- [ ] Detail items reflect the flowed bid amount
- [ ] Toast confirms

**Risk Notes:**
- 🚩 **Swallowed result / no error handling**: the inline handler is `void apiFetch(...).then(() => toast.success(...))` with **no `.catch`** — a failed use-bid POST throws an unhandled rejection and shows NO error to the user, while the success toast logic is bypassed. Also no UI refresh of detail items shown in the handler. Verify the flow actually updates detail data, and that failures surface.

---

## Cross-cutting notes

- **PDF export** (`handleExportPDF`, 1832): `GET /pdf` blob download — not a form, but a mutation-adjacent action. Verify it downloads.
- **`new/page.tsx`**: redirect only, no form.
- **`line-items` API route**: exists at `/estimates/{id}/line-items[/{lineItemId}]` but exports **no HTTP handlers** and is **not referenced by the UI** — dead/stub route, ignore for gauntlet.
- **Error handling is mostly good** in the detail client via `showEstimateError` (surfaces real `error.message`), EXCEPT: `edit/page.tsx` generic toast, `toggleScopeItemChecked` silent revert, and `use-bid` missing `.catch` (all flagged above).
