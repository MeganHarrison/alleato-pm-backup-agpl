# Documentation Maintenance Workflow

## Two-Command System for Documentation Quality

### 1. `/audit-docs` - Detection (Read-Only)
**Purpose**: Identify issues without making changes
**Safety**: 100% safe, never modifies files
**Use**: Daily checks, PR validation, health monitoring

### 2. `/fix-docs` - Correction (Write)
**Purpose**: Fix issues identified by audit
**Safety**: Requires approval, creates backups
**Use**: After review, during maintenance windows

## Quick Start Examples

### Simple Health Check
```bash
# Just check documentation status
/audit-docs ./PLANS/directory/
```

### Fix Critical Issues Only
```bash
# Audit first
/audit-docs ./PLANS/directory/ > audit.md

# Review the audit report
# Then fix only critical issues
/fix-docs audit.md --severity critical
```

### Interactive Fix Session
```bash
# Get interactive prompts for each fix
/audit-docs ./PLANS/ | /fix-docs --interactive
```

## Why Two Commands?

Think of it like going to the doctor:

1. **Diagnosis** (`/audit-docs`)
   - Non-invasive examination
   - Identifies problems
   - Provides recommendations
   - No side effects

2. **Treatment** (`/fix-docs`)
   - Requires consent
   - Makes actual changes
   - Can be selective
   - Reversible with backups

## Common Workflows

### Daily Standup
```bash
# Morning check
/audit-docs ./docs --format summary

# Quick fix if needed
/fix-docs --auto --safe-only
```

### Before Code Review
```bash
# Ensure docs are accurate
/audit-docs ./feature-docs/

# Fix any issues
/fix-docs --interactive
```

### Sprint Planning
```bash
# Generate documentation debt report
/audit-docs ./entire-project/ --format detailed > tech-debt.md

# Plan fixes for sprint
```

### Release Preparation
```bash
# Must pass documentation gate
/audit-docs ./docs --severity critical

# If issues found
/fix-docs --severity critical --auto

# Verify fixes
/audit-docs ./docs --severity critical
```

## Decision Tree

```
Start
  ↓
Run /audit-docs
  ↓
Issues found?
  ├─ No → Done! ✅
  └─ Yes ↓
     Critical issues?
       ├─ Yes → /fix-docs --severity critical
       └─ No ↓
          Time available?
            ├─ Yes → /fix-docs --interactive
            └─ No → Schedule for later
```

## Safety Levels

| Command | Options | Risk Level | Use Case |
|---------|---------|------------|----------|
| `/audit-docs` | Any | **Zero Risk** | Always safe |
| `/fix-docs --dry-run` | Preview | **Zero Risk** | Preview changes |
| `/fix-docs --safe-only` | Auto-safe | **Low Risk** | Formatting, links |
| `/fix-docs --interactive` | Selective | **Medium Risk** | Guided fixes |
| `/fix-docs --auto` | All auto | **Medium Risk** | Trusted fixes |
| `/fix-docs --all --force` | Everything | **High Risk** | Emergency only |

## Integration Examples

### Git Pre-Commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check documentation quality
if /audit-docs ./docs --severity critical --quiet; then
  exit 0
else
  echo "Critical documentation issues found!"
  echo "Run: /fix-docs --severity critical"
  exit 1
fi
```

### CI/CD Pipeline
```yaml
# GitHub Actions
- name: Documentation Audit
  run: /audit-docs ./docs --format json > audit.json

- name: Check for Critical Issues
  run: |
    if [ $(jq '.critical_count' audit.json) -gt 0 ]; then
      echo "Documentation issues found"
      exit 1
    fi
```

### VS Code Task
```json
{
  "label": "Check Docs",
  "type": "shell",
  "command": "/audit-docs ${workspaceFolder}/docs",
  "group": "test"
},
{
  "label": "Fix Docs",
  "type": "shell",
  "command": "/fix-docs --interactive",
  "group": "build"
}
```

## Best Practices

### ✅ DO
- Run audits frequently (they're free!)
- Review before fixing
- Fix incrementally
- Keep audit reports for tracking
- Use appropriate fix options

### ❌ DON'T
- Don't fix without auditing first
- Don't auto-fix production without review
- Don't ignore audit warnings indefinitely
- Don't fix everything at once

## Metrics and Reporting

Track documentation health over time:

```bash
# Weekly trend
for week in {1..4}; do
  /audit-docs ./docs --format json > week$week.json
done

# Generate trend report
/audit-docs --trend week*.json > trend-report.md
```

## Quick Reference Card

```bash
# Check everything
/audit-docs .

# Check specific folder
/audit-docs ./PLANS/

# Fix critical issues only
/fix-docs --severity critical

# Preview fixes without applying
/fix-docs --dry-run

# Interactive fix session
/fix-docs --interactive

# Fix formatting only
/fix-docs --type formatting --auto

# Create backup and fix
/fix-docs --backup ./backups/ --auto
```