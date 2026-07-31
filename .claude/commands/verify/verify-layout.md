# Verify Layout Implementation

Perform comprehensive verification of layout changes to ensure they meet design requirements.

## Steps:

1. **Run Type Check**
   ```bash
   npm run typecheck --prefix frontend
   ```

2. **Run Layout Tests**
   ```bash
   npm run test:e2e -- layout-verification.spec.ts --prefix frontend
   ```

3. **Visual Inspection Checklist**
   - [ ] Open page in browser at 375px (mobile)
   - [ ] Open page in browser at 768px (tablet)  
   - [ ] Open page in browser at 1440px (desktop)
   - [ ] Open page in browser at 1920px (large)
   
   For each viewport:
   - [ ] Check padding from edges
   - [ ] Toggle sidebar open/closed
   - [ ] Verify content doesn't touch edges
   - [ ] Check spacing between sections
   - [ ] Verify no horizontal scroll

4. **Browser Console Check**
   - [ ] No errors in console
   - [ ] No warnings about missing CSS variables

5. **Cross-Browser Check**
   - [ ] Test in Chrome
   - [ ] Test in Firefox
   - [ ] Test in Safari (if available)

6. **Edge Cases**
   - [ ] Test with empty content
   - [ ] Test with very long content
   - [ ] Test with wide tables
   - [ ] Test loading states

## Common Issues to Check:

### Spacing Issues
- Double padding (parent + layout padding)
- Missing horizontal padding
- Inconsistent section gaps
- Hard-coded spacing values

### Responsive Issues  
- Content touching edges on mobile
- Sidebar overlap issues
- Max-width not working
- Breakpoint transitions

### CSS Variable Issues
- Variables not injecting
- Wrong spacing profile selected
- Density not applying to tables

## Report Format:

```markdown
## Layout Verification Report

**Layout:** [Name]
**Date:** [Date]
**Verified by:** Claude

### Type Check
- [ ] Passed / [ ] Failed
- Issues: [List any]

### E2E Tests
- [ ] Passed / [ ] Failed  
- Issues: [List any]

### Visual Inspection
- Mobile: [ ] Pass / [ ] Issues
- Tablet: [ ] Pass / [ ] Issues
- Desktop: [ ] Pass / [ ] Issues
- Large: [ ] Pass / [ ] Issues

### Issues Found:
1. [Issue description]
2. [Issue description]

### Fixes Applied:
1. [Fix description]
2. [Fix description]
```