---
title: Fix Documentation Issues
description: Automatically fix documentation issues identified by audit
command: /fix-docs
---

# Documentation Fix Command

## Usage
```
/fix-docs <audit-report-path> [options]
```

Or pipe from audit:
```
/audit-docs ./PLANS/directory/ | /fix-docs --auto
```

## Purpose

This command takes the output from `/audit-docs` and systematically fixes the identified issues. It's intentionally separate from the audit command to maintain:

1. **Clear separation of concerns** - Auditing vs Fixing
2. **Human review opportunity** - Review findings before auto-fixing
3. **Selective fixing** - Choose which issues to address
4. **Rollback capability** - Can revert fixes if needed

## Why Separate Commands?

### 1. Safety and Control
- **Audit is read-only** - Never modifies files, always safe to run
- **Fix requires approval** - Destructive changes need oversight
- **Selective application** - Not all audit findings should be auto-fixed

### 2. Different Use Cases
- **CI/CD** - Run audit in PR checks (read-only)
- **Development** - Fix during active development
- **Review** - Audit for reports without changes
- **Maintenance** - Scheduled fixes with human approval

### 3. Progressive Enhancement
```bash
# Step 1: Audit (safe, informational)
/audit-docs ./docs

# Step 2: Review the report
# Human decides what to fix

# Step 3: Apply fixes (with options)
/fix-docs --only critical
/fix-docs --type accuracy
/fix-docs --interactive
```

## Fix Categories

### 1. Auto-Fixable (Safe)
- ✅ Update completion percentages based on code analysis
- ✅ Fix broken internal links
- ✅ Update timestamps
- ✅ Correct file paths
- ✅ Fix markdown formatting
- ✅ Update method signatures from code

### 2. Semi-Automatic (Needs Confirmation)
- ⚠️ Archive stale documentation
- ⚠️ Consolidate duplicate content
- ⚠️ Update API examples from tests
- ⚠️ Sync schema documentation with database

### 3. Manual Only (Complex)
- ❌ Resolve conflicting information
- ❌ Write missing documentation
- ❌ Create new examples
- ❌ Design decisions and architecture

## Implementation Modes

### 1. Automatic Mode
```bash
/fix-docs --auto
```
- Fixes all auto-fixable issues
- Skips manual interventions
- Creates backup before changes
- Generates fix report

### 2. Interactive Mode
```bash
/fix-docs --interactive
```
```
Found: Outdated completion percentage
Current: 95%
Actual: 72%
Fix? [Y/n/skip/all]: y
✓ Fixed

Found: Stale file (30 days old)
File: OLD-PLAN.md
Action? [archive/delete/skip]: archive
✓ Moved to .archive/
```

### 3. Selective Mode
```bash
# Fix only critical issues
/fix-docs --severity critical

# Fix only specific types
/fix-docs --type accuracy,freshness

# Fix specific files
/fix-docs --files "PLANS-Directory.md,STATUS.md"
```

## Workflow Integration

### Recommended Workflow
```bash
# 1. Morning standup - check documentation health
/audit-docs ./PLANS/

# 2. Review critical issues with team
# 3. Fix agreed upon issues
/fix-docs --severity critical --auto

# 4. Handle warnings interactively
/fix-docs --severity warning --interactive

# 5. Commit fixes with audit report
git add -A
git commit -m "docs: fix documentation issues from audit

- Updated completion percentages to match implementation
- Archived stale planning documents
- Fixed broken internal links
See audit-report-2024-01-18.md for details"
```

### CI/CD Pipeline
```yaml
# .github/workflows/doc-quality.yml
name: Documentation Quality

on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Audit Documentation
        run: claude audit-docs ./docs --format json > audit.json

      - name: Check Critical Issues
        run: |
          if [ $(jq '.critical_issues | length' audit.json) -gt 0 ]; then
            echo "Critical documentation issues found"
            exit 1
          fi

      - name: Post PR Comment
        if: failure()
        run: |
          claude fix-docs audit.json --dry-run --format markdown |
          gh pr comment --body-file -
```

## Fix Report Output

After running fixes, generates a report:

```markdown
# Documentation Fix Report
Date: 2024-01-18
Mode: Automatic

## Fixed Issues (12)
✅ Updated completion percentage in STATUS.md (95% → 72%)
✅ Fixed 3 broken links in API-GUIDE.md
✅ Updated schema docs to match current database
✅ Archived 4 stale files to .archive/

## Skipped Issues (3)
⚠️ Conflicting information in PLANS.md (needs manual review)
⚠️ Missing examples in API docs (needs creation)
⚠️ Duplicate content across 2 files (needs decision)

## Backup Location
.backup/docs-backup-2024-01-18-143022/

## Next Steps
1. Review skipped issues manually
2. Run tests to ensure examples still work
3. Commit changes with audit report
```

## Safety Features

1. **Automatic Backup** - Before any changes
2. **Dry Run Mode** - Preview changes without applying
3. **Rollback Command** - Undo recent fixes
4. **Change Validation** - Verify fixes don't break things
5. **Git Integration** - Can auto-create branch for fixes

## Options

- `--auto` - Fix all auto-fixable issues
- `--interactive` - Prompt for each fix
- `--dry-run` - Preview without changing
- `--backup <path>` - Custom backup location
- `--severity <level>` - Filter by severity
- `--type <types>` - Filter by issue type
- `--files <patterns>` - Only fix specific files
- `--create-branch` - Create git branch for fixes
- `--max-changes <n>` - Limit number of changes