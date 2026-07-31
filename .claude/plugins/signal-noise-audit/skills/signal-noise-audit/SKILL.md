---
name: signal-noise-audit
description: Scans the frontend codebase for visual noise violations — redundant labels, decorative borders, over-explained controls, nested cards, stacked buttons, unnecessary section headings — then fixes them. Use when the user says "audit for visual noise", "clean up UI noise", "run signal-noise-audit", or "fix visual clutter". Also use when reviewing any page or component for design quality.
argument-hint: "[path] [--fix] [--report-only]"
---

# Signal Over Noise — Audit & Fix Skill

Scans the frontend codebase for violations of the Signal Over Noise principle, then fixes them. Every element must earn its place. Decoration without functional purpose is noise.

## Core Principle

> Maximize signal. Minimize noise.
> We simplify the complex. We do not make the simple more complex.

This application is operational software — built for high-frequency, data-heavy workflows. It must feel like elite software (Linear, Superhuman, Raycast) — not a marketing site or consumer app.

---

## Arguments

Parse from `$ARGUMENTS`:
- **`[path]`** — Optional. Limit scan to a specific file or directory (e.g., `frontend/src/features/budget`). Default: all of `frontend/src/`.
- **`--fix`** — Apply fixes automatically. Default: on.
- **`--report-only`** — Produce a report without modifying files.

---

## Phase 1 — Discover Violations

Scan for these noise patterns. For each file found, record: file path, line numbers, violation type, severity.

### Violation Catalogue

#### V1 — Redundant Labels (Severity: HIGH)
Icon + text label where icon + `title` tooltip would suffice.

Grep patterns:
```bash
# Icon adjacent to a text span that repeats the icon's meaning
grep -rn "lucide\|LucideIcon" frontend/src --include="*.tsx" -l
```
Look for: `<PencilIcon /> Edit`, `<TrashIcon /> Delete`, `<PlusIcon /> Add Item`, `<CalendarIcon /> Set Date`.

Fix: Remove the text span. Add `title="Edit"` to the button wrapper.

---

#### V2 — Decorative Borders (Severity: HIGH)
Borders used for visual separation instead of structural boundaries.

Grep patterns:
```bash
grep -rn "border border-border\|border-b border\|border-t border\|divide-y\|border rounded" frontend/src --include="*.tsx"
```

Red flags — borders that are noise:
- `border` on a `<div>` wrapping a list section (use whitespace instead)
- `border-b` as a section separator in a sidebar or panel (use `mt-6` instead)
- `divide-y` on an info list inside a card (use `py-3` spacing instead)
- `border rounded-lg` wrapping a group of related fields that aren't a card

Keep borders only on:
- `<input>`, `<textarea>`, `<select>` (form controls)
- `<DataTable>` row separators (component-owned)
- Structural boundaries between completely distinct layout regions

Fix: Replace border-as-separator with spacing. Replace border-as-card with `bg-muted/50 rounded-lg` if tonal grouping is needed, or just whitespace.

---

#### V3 — Nested Card Trap (Severity: HIGH)
`bg-card + border border-border + rounded` wrapping content that already lives inside a card or panel.

Grep patterns:
```bash
grep -rn "bg-card.*border.*rounded\|rounded.*border.*bg-card" frontend/src --include="*.tsx"
grep -rn "bg-white.*border.*rounded\|bg-background.*border.*rounded" frontend/src --include="*.tsx"
```

Fix: Remove the wrapper. Use spacing and typography to create grouping. If visual grouping is needed, use `bg-muted/40 rounded-md p-3` without a border.

---

#### V4 — Section Headings That State the Obvious (Severity: MEDIUM)
A heading label directly above a control that already communicates its purpose.

Examples of redundant headings:
- `<h3>Priority</h3>` above a priority `<Select>`
- `<h4>Status</h4>` above a status `<StatusBadge>`
- `<p className="font-semibold">Actions</p>` above a group of action buttons
- `<Label>Date</Label>` above a `DatePicker` already labeled via placeholder

Grep patterns:
```bash
grep -rn "font-semibold\|font-medium\|text-sm.*font" frontend/src --include="*.tsx" | grep -v "components/ui\|components/ds"
```

Fix: Remove the heading. Ensure the control below has a `placeholder` or `title` that communicates its purpose. If the heading is needed for screen readers, use `sr-only`.

---

#### V5 — Stacked Option Buttons (Severity: HIGH)
Three or more stacked buttons representing mutually exclusive choices.

```bash
grep -rn "variant.*outline\|variant.*secondary" frontend/src --include="*.tsx" -l
```

Look for: priority buttons (Low / Medium / High), status buttons, type selectors rendered as button groups.

Fix: Replace with `<Select>` from `@/components/ui/select`. One line replaces three.

---

#### V6 — Over-Explained Controls (Severity: MEDIUM)
Helper text, description text, or instructional copy below an input that is already self-evident.

```bash
grep -rn "text-muted-foreground text-xs\|text-sm text-muted\|<p className.*muted" frontend/src --include="*.tsx"
```

Red flags:
- `<p>Enter the project name</p>` below a `placeholder="Project name"` input
- `<p>This will permanently delete the record.</p>` inside a `<ConfirmDeleteDialog>` that already says "Delete"
- `<p>Select a date for the deadline</p>` above a `DatePicker`

Fix: Remove the description. If the description contains non-obvious constraint information (e.g., "Max 255 characters"), keep it but trim to the essential fact only.

---

#### V7 — Redundant Icon + Text Badges (Severity: MEDIUM)
Badges or pills that show an icon AND label AND color when color + label alone suffice.

```bash
grep -rn "<StatusBadge\|badge.*flex.*gap\|pill.*icon" frontend/src --include="*.tsx"
```

Fix: Use `<StatusBadge status="..." />` — it already handles color + label. Remove any wrapping `<span>` that adds a redundant icon.

---

#### V8 — Full-Width Labeled Edit Buttons in Dense Panels (Severity: HIGH)
A full-width `<Button variant="outline">Edit Section</Button>` at the bottom of a panel when an inline `MoreVertical` icon would do.

```bash
grep -rn "variant.*outline.*Edit\|Edit.*variant.*outline" frontend/src --include="*.tsx"
grep -rn "w-full.*Edit\|Edit.*w-full" frontend/src --include="*.tsx"
```

Fix: Replace with `<Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>` placed inline with the section title.

---

#### V9 — Hardcoded Colors (Severity: HIGH)
Any `bg-white`, `bg-gray-*`, `text-gray-*`, `bg-blue-*`, hex values, or arbitrary Tailwind values.

```bash
grep -rn "bg-white\|bg-gray\|text-gray\|text-blue\|text-red\|bg-blue\|bg-red\|bg-green" frontend/src --include="*.tsx" | grep -v "components/ui\|components/ds\|\.test\."
grep -rn "#[0-9a-fA-F]\{3,6\}" frontend/src --include="*.tsx" | grep -v "svg\|fill\|stroke\|components/ui"
```

Fix: Replace with semantic tokens only:
- `bg-white` → `bg-card` or `bg-background`
- `bg-gray-50` → `bg-muted`
- `text-gray-500` → `text-muted-foreground`
- `text-gray-900` → `text-foreground`

---

#### V10 — Explanatory Section Headers Above Self-Evident Groups (Severity: LOW)
A bolded or semibold text label above a group of controls where the group's purpose is already clear from context.

Look for: `<p className="font-semibold text-sm">Danger Zone</p>` above a delete button — the button's destructive styling communicates danger already.

Fix: Remove. Let the control communicate.

---

## Phase 2 — Triage

Group violations by file. Sort by severity (HIGH first). Skip violations inside:
- `frontend/src/components/ui/` — shadcn primitives, do not touch
- `frontend/src/components/ds/` — design system components, careful edits only
- `*.test.tsx`, `*.spec.tsx` — test files

Output a triage table:

```
| File | Line | Violation | Severity | Action |
|------|------|-----------|----------|--------|
| features/budget/budget-line-item.tsx | 42 | V2 decorative border | HIGH | Remove border, add mt-4 |
```

---

## Phase 3 — Fix

If `--report-only` was passed, stop after Phase 2.

Otherwise, fix each violation:

1. Read the file
2. Apply the minimal targeted fix — do not refactor surrounding code
3. Verify the fix compiles (no TypeScript errors introduced)
4. Move to next violation

**Fixing rules:**
- Never change component APIs or prop signatures
- Never restructure a component while fixing noise — one targeted edit per violation
- If a fix requires understanding surrounding context deeply, flag it for manual review instead of guessing
- Do not remove empty states, loading states, or error states — those are signal, not noise

After all fixes in a file, run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -20
```

If new TS errors appear, revert that file's changes and flag for manual review.

---

## Phase 4 — Screenshot Verification

After fixes, use `agent-browser` to take before/after screenshots of affected pages.

For each fixed page:
1. `agent-browser open http://localhost:3000/<path>`
2. `agent-browser screenshot /tmp/signal-noise-after-<page>.png`
3. Read the screenshot
4. Confirm: does the page look calmer, more information-dense, and more intentional? If yes — done.

If the page looks broken or worse — revert and flag.

---

## Phase 5 — Report

Produce a final summary:

```
## Signal Over Noise Audit Report
Date: <date>
Scope: <path>

### Fixed
| File | Violation | Fix Applied |
|------|-----------|-------------|
| ... | ... | ... |

### Flagged for Manual Review
| File | Violation | Reason not auto-fixed |
|------|-----------|----------------------|
| ... | ... | ... |

### Stats
- Files scanned: N
- Violations found: N
- Auto-fixed: N
- Flagged: N
```

---

## What NOT to touch

These are signal, not noise:
- `<EmptyState>` components — they communicate absence
- `<ErrorState>` components — they communicate failure
- `<InfoAlert variant="warning">` — communicates a real constraint
- `<StatusBadge>` — communicates state
- Loading skeletons — communicate in-progress
- `<ConfirmDeleteDialog>` — communicates consequence
- Required field indicators (`*`)
- Form validation error messages
- Column headers in tables — they identify data

If uncertain whether something is signal or noise, **do not remove it**. Flag it in the report.

---

## Design Reference

The authoritative doctrine is Gate 18 in `CLAUDE.md` — "Signal Over Noise — The Governing Design Principle".

Elite reference points for what the UI should feel like:
- **Linear** — hierarchy through weight, zero decorative chrome
- **Superhuman** — density without clutter, keyboard-first clarity
- **Raycast** — ruthless icon-over-label preference, instant scanning
- **Notion Calendar** — information compression, no wasted space
- **Bloomberg Terminal** — operational density, color as signal only

What we are NOT building:
- Consumer apps (rounded pill buttons everywhere, oversized padding)
- Marketing sites (hero sections in operational panels)
- Over-explained enterprise software (label above label above label)
