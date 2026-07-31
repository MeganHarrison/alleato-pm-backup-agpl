# Drawings Long-tail Fix Report

Fixed: 2026-06-14

## Issues addressed

### 1. drawing_related_items — UUID validation + entity existence check

**Root cause:** The "Link Related Item" dialog accepted any free-text string as an Item ID. If it wasn't a valid UUID the DB insert would fail with a cryptic Postgres error; if it was a valid UUID that pointed to nothing the insert silently created a dangling reference.

**Frontend fix (`DrawingRelatedItemsPanel.tsx`):**
- Added `UUID_REGEX` client-side validation on submit — rejects non-UUIDs before the request fires, highlights the field red, shows an inline error message.
- `handleAdd` replaced by `validateAndAdd` which clears errors on type, validates format, then calls the mutation. Dialog reset (field + error) on close.
- Helper text now says "The server will verify the item exists" so the user knows the round-trip is intentional.

**API fix (`related-items/route.ts`):**
- Added `UUID_REGEX` server-side guard (belt-and-suspenders; rejects `400` if non-UUID reaches the API directly).
- Added `RELATED_TYPE_TABLE` map: `rfi→rfis`, `submittal→submittals`, `observation→observations`, `punch_item→punch_items`, `task→tasks`.
- Before insert: queries the entity table with `.maybeSingle()`. Returns `404` with message `"<type> with ID <uuid> does not exist"` if the row is missing. Returns `500` (with real DB message) if the lookup itself fails.
- `change_order` is excluded from the existence check because change orders use a composite structure that differs per project; the DB FK will still enforce referential integrity.

**Deferral:** A full entity picker (combobox searching RFIs/submittals by name/number) is deferred. The UUID-paste UX is honest and validated; an entity picker would remove the need for UUID knowledge entirely but requires per-type search APIs. Filed for future improvement.

---

### 2. link_pin coordination_issue / task — honest draft-only state

**Root cause:** Both `CoordinationIssueContent` and `TaskContent` in `LinkPinModal.tsx` called `onConfirm` with `entity_status: "open"`, implying a real record existed. No `coordination_issues` table exists in the DB; the `tasks` table is for AI-extracted tasks from comms, not drawing-linked tasks. Both were silent false-successes.

**Fix (`LinkPinModal.tsx`):**
- Both panels now show a `bg-muted` notice block at the top: **"Draft pin only."** with a plain-English explanation that no separate record is created and the title is stored on the pin only.
- Button text changed from "Place Pin" → "Place Draft Pin" to reinforce the draft nature at the action level.
- `entity_status` changed from `"open"` to `"draft"` so the `StatusDot` in `DrawingLinksPanel` renders correctly (muted colour, not primary blue).
- The pin IS persisted to `drawing_markup_pins` — the existing data path is correct. The fix is transparency only.

**No deferral:** these types cannot be "wired to real creates" without first building the respective modules. The draft-pin approach is the correct design until those modules exist.

---

### 3. drawing_pin_delete single-click — no other unconfirmed deletes found

**Finding:** `DrawingLinksPanel.tsx` (already fixed per scope exclusion note) is the only place `useDeleteDrawingPin` is called in the entire codebase. The viewer page (`viewer/[drawingId]/page.tsx`) delegates pin deletion entirely to `DrawingLinksPanel`. No other single-click destructive delete paths exist in the drawings tool for pins.

**No code change required for this issue.**

---

## Files changed

| File | Change |
|---|---|
| `frontend/src/components/drawings/DrawingRelatedItemsPanel.tsx` | UUID client-side validation, inline error state, dialog reset on close |
| `frontend/src/app/api/projects/[projectId]/drawings/[drawingId]/related-items/route.ts` | UUID server-side guard + entity existence check before insert |
| `frontend/src/components/drawings/LinkPinModal.tsx` | Honest draft-only notice + button label for coordination_issue and task pin types |

## Verification

- `npx tsc --noEmit 2>&1 | grep -i drawing` → no output (zero new type errors)
- `bash scripts/lint-staged/run-frontend-eslint.sh strict <all 3 changed files>` → no output (zero lint errors)
