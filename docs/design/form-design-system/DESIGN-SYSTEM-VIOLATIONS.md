# DESIGN SYSTEM VIOLATIONS LOG

This file tracks all known violations of DESIGN-SYSTEM.md rules.

**Format:**

```markdown
## [Date] - [File/Component]
- **Violation**: Description
- **Rule**: Which rule was broken
- **Fix Required**: What needs to happen
- **Priority**: P0 (blocking) | P1 (high) | P2 (medium) | P3 (low)
```

---

## 2026-01-05 - Project Directory Page

**File**: `frontend/src/app/[projectId]/directory/page.tsx`

### Status: ✅ REFACTORED (2026-01-05)

All violations have been fixed:

1. ✅ **EmptyState component** - Now uses `<EmptyState>` for all zero states
2. ✅ **Removed spacing classes** - Removed all `className="space-y-4"`
3. ✅ **Clean component usage** - Page only composes components, no raw styling

### Remaining Work

- DirectoryTable component still needs refactoring (separate task)

---

## 2026-01-05 - DirectoryTable Component

**File**: `frontend/src/components/directory/DirectoryTable.tsx`

### Violations

1. **Raw Tailwind for complex layouts**
   - **Rule**: Component-First Design
   - **Current**: Complex inline Tailwind classes
   - **Fix**: Extract sub-components (TableHeader, TableRow, etc.)
   - **Priority**: P2

2. **Hardcoded spacing values**
   - **Rule**: Design Tokens
   - **Current**: `gap-2`, `gap-4`, `space-y-4`
   - **Fix**: Use spacing tokens
   - **Priority**: P2

3. **Inconsistent button sizing**
   - **Rule**: Button System
   - **Current**: Mix of `size="icon"`, `size="sm"`
   - **Fix**: Standardize button sizes
   - **Priority**: P3

---

## GLOBAL VIOLATIONS

### Missing Foundation Components

**Priority**: P0 (BLOCKING)

Missing components that must exist before continuing:

- [ ] Stack (vertical spacing)
- [ ] Inline (horizontal spacing)
- [ ] Container (page width)
- [ ] EmptyState (feedback)
- [ ] FormField (form wrapper)

**Impact**: Every page violates spacing rules until these exist.

---

### Incomplete Token System

**Priority**: P0 (BLOCKING)

Current `globals.css` has partial tokens:

- ✅ Colors defined
- ✅ Radii defined
- ❌ Spacing scale incomplete
- ❌ Typography scale incomplete
- ❌ Not all components use tokens

**Action Required**: Complete token definition before any new components.

---

### Pages with Raw Styling

**Priority**: P1 (HIGH)

Pages that need refactoring (partial list):

- `/[projectId]/directory/page.tsx`
- `/[projectId]/home/page.tsx`
- `/[projectId]/commitments/page.tsx`
- `/dashboard/page.tsx`

**Pattern**: All use manual Tailwind instead of components.

---

## NEXT ACTIONS

1. **STOP**: No new features until foundation exists
2. **CREATE**: Missing layout primitives (Stack, Inline, Container, EmptyState)
3. **AUDIT**: Complete token system in `globals.css`
4. **REFACTOR**: Directory page as exemplar
5. **TEMPLATE**: Use directory as pattern for other pages
6. **ENFORCE**: Add ESLint rules to prevent future violations

---

## TRACKING

- **Total Known Violations**: 8 major, many minor
- **Blocking Issues**: 2 (missing primitives, incomplete tokens)
- **Last Updated**: 2026-01-05
- **Next Review**: After foundation components exist
