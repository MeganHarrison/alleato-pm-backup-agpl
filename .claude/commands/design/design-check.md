# Design System Check (Quick)

Quick design check for a specific file or component.

## Usage
```
/design-check path/to/file.tsx
```

## Instructions

Perform a quick design system check on: $ARGUMENTS

1. **Read the file** specified in the argument

2. **Check for common violations:**

   ### Colors
   - [ ] No raw hex colors (like #DB802D, #ffffff)
   - [ ] Using design tokens (text-brand, bg-background, etc.)
   - [ ] Status colors use semantic tokens (text-status-success, etc.)

   ### Spacing
   - [ ] No arbitrary spacing (p-[10px], gap-[15px])
   - [ ] Using 8px grid (p-2, p-4, p-6, p-8)

   ### Typography
   - [ ] No arbitrary font sizes (text-[14px])
   - [ ] Using scale (text-xs, text-sm, text-base, etc.)

   ### Components
   - [ ] Using ShadCN components where available
   - [ ] No raw <button>, <input> elements

   ### Responsive
   - [ ] Mobile-first approach
   - [ ] Proper breakpoint usage (sm:, md:, lg:)

3. **Output a quick report:**
   ```
   Design Check: path/to/file.tsx

   ✓ Colors: OK (or list issues)
   ✓ Spacing: OK (or list issues)
   ✓ Typography: OK (or list issues)
   ✓ Components: OK (or list issues)
   ✓ Responsive: OK (or list issues)

   Total: X issues found
   ```

4. **If issues found**, offer to fix them immediately
