# Usability & Architecture Checklist

Reference for Phase 4 of the feature-audit skill. Use this to systematically evaluate
the quality of a feature beyond "does it work."

---

## Performance Checklist

### Library Assessment

| What to check | Red flag | Recommendation |
|--------------|----------|---------------|
| PDF viewer library | `react-pdf` with large files (> 10MB) loads slowly | Consider `@pspdfkit/web-sdk`, `pdf-lib`, or raw `pdfjs-dist` with progressive rendering and web workers |
| Table/grid for large datasets | Re-renders entire list on filter change | Use virtualization (`@tanstack/react-virtual`) for 100+ rows |
| Image handling | Full-resolution images loaded in thumbnails | Use `next/image` with proper sizes, or generate thumbnails server-side |
| Date library | Importing full `moment.js` | Use `date-fns` (tree-shakeable) — already in the project |
| Canvas/drawing library | Custom canvas code for annotations | Consider `tldraw`, `Excalidraw`, or `fabric.js` for annotation features |
| Rich text editing | Custom contentEditable implementations | Use `tiptap` or `lexical` |

### Load Time Indicators

| Observation | Severity | Action |
|-------------|----------|--------|
| Page takes > 2s to show content | High | Check for blocking API calls, missing Suspense boundaries |
| Table takes > 1s to filter/sort | Medium | Check if filtering is client-side with large dataset |
| Form submission takes > 3s | High | Check API route for N+1 queries, missing indexes |
| Images/thumbnails pop in late | Low | Add loading skeletons, lazy loading |
| Full page flash on navigation | Medium | Missing loading.tsx in the route |

### Bundle Concerns

- Is the component using `next/dynamic` for heavy dependencies? (react-pdf, chart libraries)
- Are there client-side imports that could be server components?
- Is there a `"use client"` at the top of a file that only has a small interactive section?

---

## Missing Capabilities Checklist

### Core Capabilities (expected for any data management tool)

| Capability | Check | If missing → Impact |
|-----------|-------|-------------------|
| Create record | Does the create form exist and work? | Critical |
| Read/view record | Is there a detail page? | Critical |
| Edit record | Is there an edit form/mode? | Critical |
| Delete record | Can users delete from list AND detail? | High |
| Bulk select | Can users select multiple records? | Medium |
| Bulk delete | Can users delete selected records? | Medium |
| Bulk export | Can users export selected records? | Medium |
| Search | Is there a search bar that filters? | High |
| Filter | Are there filter controls for key fields? | High |
| Sort | Can users sort by clicking column headers? | Medium |
| Pagination | Does the list paginate for large datasets? | Medium |
| Empty state | Does an empty list show a helpful message + CTA? | Medium |

### Enhanced Capabilities (expected for premium tools)

| Capability | Check | If missing → Impact |
|-----------|-------|-------------------|
| Drag-and-drop reordering | Can users reorder items visually? | Medium |
| Keyboard shortcuts | Does the viewer/editor support keyboard nav? | Medium |
| Undo/redo | Can users undo recent actions? | Low |
| Print/export to PDF | Can users print or export? | Medium |
| Mobile responsive | Does it work on 375px viewport? | High |
| Offline access | For field-use tools, does it work offline? | Low (for now) |
| Real-time updates | Do changes from other users appear? | Low |
| Activity log / audit trail | Is there a change history? | Medium |
| Email notifications | Are users notified of relevant changes? | Low |

### Construction-Specific Capabilities (Procore parity)

| Capability | Check for | If missing → Impact |
|-----------|-----------|-------------------|
| Revision tracking | Can users upload new versions? | High (drawings, submittals) |
| Status workflow | Are there status transitions? | High (RFIs, submittals, COs) |
| Markup/annotation | Can users annotate on drawings? | High (drawings) |
| Cost tracking | Are costs calculated correctly? | High (budget, commitments) |
| Linked items | Can records link to other tools? | Medium |
| QR codes | Can field workers scan to access? | Low |
| OCR | Is text extracted from uploaded PDFs? | Low |

---

## UX Quality Checklist

### Navigation

- [ ] Feature is reachable from the project sidebar
- [ ] Breadcrumbs or back button on detail/form pages
- [ ] Tab navigation between sub-sections is clear
- [ ] Active tab is visually highlighted
- [ ] URL updates when navigating (supports back button, bookmarking)

### Forms

- [ ] Required fields are marked (asterisk or "Required" label)
- [ ] Validation errors appear inline next to the field (not just a toast)
- [ ] Validation triggers on blur or submit (not on every keystroke)
- [ ] Dropdowns load quickly (no long spinner)
- [ ] Date pickers have sensible defaults (today for "received date")
- [ ] File uploads show progress indicator
- [ ] File type restrictions are communicated before upload attempt
- [ ] Cancel button discards changes (with confirmation if data entered)

### Feedback

- [ ] Success toast after create/update/delete
- [ ] Error toast with specific message (not "Something went wrong")
- [ ] Loading indicator during API calls
- [ ] Disabled submit button while submitting (prevents double-submit)
- [ ] Confirmation dialog for destructive actions (delete, overwrite)

### Empty States

- [ ] Empty table/list shows message + primary action CTA
- [ ] Filtered-to-empty shows different message ("No results — try adjusting filters")
- [ ] Empty tabs say what will appear there, not just "No data"

### Visual Quality

- [ ] Uses design system components (StatusBadge, DataTable, EmptyState, KpiBlock)
- [ ] No hardcoded colors (bg-gray-*, bg-white, hex codes)
- [ ] No arbitrary spacing (p-[10px], m-7)
- [ ] Card shadows are xs or sm only
- [ ] Consistent spacing between sections
- [ ] Mobile: grids collapse, tables scroll horizontally, no overflow

---

## Code Quality Signals

| Signal | Where to look | Action |
|--------|--------------|--------|
| File > 400 lines | Page components, form components | Recommend extraction |
| Component doing too many things | Single file with form + table + modal + API calls | Recommend splitting |
| Inline styles or raw HTML | `<div style={}` or `<button>` instead of `<Button>` | Design system violation |
| Missing error boundary | Page-level components without try/catch or ErrorBoundary | Recommend adding |
| Missing loading state | Page renders blank while fetching | Add Suspense or loading.tsx |
| Stale TODOs | `// TODO`, `// FIXME`, `// HACK` older than 2 weeks | Flag for cleanup or removal |
| Hardcoded IDs or URLs | Magic numbers in component code | Extract to constants/config |
| Duplicate logic | Same fetch/transform in multiple files | Extract to shared hook/util |

---

## Severity Guide for Recommendations

| Impact | Effort | Priority | Action |
|--------|--------|----------|--------|
| High | S (< 1hr) | **Do First** | Fix immediately |
| High | M (1-4hr) | **Do First** | Fix this sprint |
| Medium | S (< 1hr) | **Quick Win** | Fix if time allows |
| High | L (half day) | **Plan Next** | Schedule for next sprint |
| Medium | M (1-4hr) | **Quick Win** | Fix if time allows |
| High | XL (1+ day) | **Plan Next** | Schedule for next sprint |
| Medium | L/XL | **Backlog** | Track but don't prioritize |
| Low | Any | **If Time** | Only if literally nothing else |
