# Fix-Docs Implementation: Data Flow

## The Problem
`/fix-docs` needs to know:
1. Which files have issues
2. What the specific issues are
3. Where to find the files
4. What the correct fixes should be

## Solution: Audit Report as Input

### Method 1: Save and Reference (Recommended)
```bash
# Step 1: Run audit and save report
/audit-docs /Users/meganharrison/Documents/github/alleato-pm/PLANS/directory/ --save

# This creates: .audit-reports/audit-2024-01-19-093045.json

# Step 2: Fix using the saved report
/fix-docs --report .audit-reports/audit-2024-01-19-093045.json --only "status conflicts"

# Or use 'latest' shorthand
/fix-docs --report latest --only "status conflicts"
```

### Method 2: Pipe Directly
```bash
# Pipe audit output directly to fix
/audit-docs ./PLANS/directory/ --format json | /fix-docs --stdin --only "status conflicts"
```

### Method 3: Re-specify Location with Filters
```bash
# Fix-docs runs a targeted audit internally
/fix-docs ./PLANS/directory/ --only "status conflicts"
# This actually runs audit first, then applies fixes
```

## Audit Report Structure

The audit saves a structured report that fix-docs can read:

```json
{
  "audit_id": "audit-2024-01-19-093045",
  "directory": "/Users/meganharrison/Documents/github/alleato-pm/PLANS/directory/",
  "timestamp": "2024-01-19T09:30:45Z",
  "issues": [
    {
      "id": "issue-001",
      "type": "status-conflict",
      "severity": "critical",
      "files": [
        {
          "path": "/PLANS/directory/DIRECTORY-STATUS-UPDATE.md",
          "line": 15,
          "current_value": "95%",
          "suggested_value": "72%",
          "evidence": "Code analysis shows 72% implementation"
        },
        {
          "path": "/PLANS/directory/FORMS-Directory.md",
          "line": 8,
          "current_value": "91%",
          "suggested_value": "72%"
        }
      ],
      "fix_strategy": "update-percentage",
      "auto_fixable": true
    },
    {
      "id": "issue-002",
      "type": "stale-documentation",
      "severity": "warning",
      "files": [
        {
          "path": "/PLANS/directory/OLD-PLAN-Jan15.md",
          "last_modified": "2024-01-15",
          "suggested_action": "archive",
          "archive_path": ".archive/2024-01/OLD-PLAN-Jan15.md"
        }
      ],
      "fix_strategy": "archive-file",
      "auto_fixable": true
    }
  ],
  "summary": {
    "total_issues": 15,
    "critical": 3,
    "warnings": 8,
    "suggestions": 4,
    "auto_fixable": 12
  }
}
```

## How Fix-Docs Uses This

```python
# Pseudo-code for fix-docs implementation
class DocumentationFixer:
    def fix(self, report_path, filters):
        # Load the audit report
        audit_report = load_json(report_path)

        # Filter issues based on user request
        issues_to_fix = filter_issues(
            audit_report.issues,
            only=filters.get('only'),  # e.g., "status conflicts"
            severity=filters.get('severity'),
            type=filters.get('type')
        )

        # Apply fixes
        for issue in issues_to_fix:
            if issue.auto_fixable:
                apply_fix(issue)
            else:
                prompt_for_manual_fix(issue)
```

## Practical Examples

### Example 1: Fix Specific Issue Type
```bash
# After running audit
/audit-docs ./PLANS/directory/ --save

# Fix only status conflicts
/fix-docs --report latest --only "status-conflict"
```

### Example 2: Fix by Severity
```bash
# Fix only critical issues from latest audit
/fix-docs --report latest --severity critical
```

### Example 3: Fix Specific Files
```bash
# Fix issues only in specific files
/fix-docs --report latest --files "STATUS.md,FORMS.md"
```

### Example 4: Interactive Fix with Context
```bash
/fix-docs --report latest --interactive

> Found: Status conflict in DIRECTORY-STATUS-UPDATE.md
> Current: 95% complete
> Suggested: 72% complete (based on code analysis)
> Evidence: 3 missing components, 2 incomplete features
> Fix this? [Y/n/details]: details

> Missing components:
> - CompanyEditDialog.tsx (not found)
> - DistributionGroupDialog.tsx (not found)
> - PermissionTemplateDialog.tsx (not found)
>
> Apply fix? [Y/n]: y
> ✓ Updated to 72%
```

## Default Behavior

If no report is specified, fix-docs will:

1. Check for `.audit-reports/latest.json` symlink
2. If not found, prompt: "No audit report found. Run /audit-docs first?"
3. Optionally run audit inline if user confirms

```bash
# This won't work without prior audit
/fix-docs --only "status conflicts"
> Error: No audit report found
> Run: /audit-docs ./path/to/docs --save
> Then: /fix-docs --report latest --only "status conflicts"
```

## Storage Location

Audit reports are stored in:
```
.audit-reports/
├── audit-2024-01-19-093045.json  # Full audit report
├── audit-2024-01-19-093045.md    # Human-readable version
└── latest.json -> audit-2024-01-19-093045.json  # Symlink to latest
```

## Advanced: Continuous Mode

For ongoing documentation maintenance:

```bash
# Run audit and auto-fix safe issues daily
0 2 * * * /audit-docs ./docs --save && /fix-docs --report latest --auto --safe-only

# Weekly interactive fix session reminder
0 9 * * MON echo "Review docs: /fix-docs --report latest --interactive"
```

## The Complete Workflow

```bash
# 1. Initial audit (you've done this)
/audit-docs /Users/meganharrison/Documents/github/alleato-pm/PLANS/directory/ --save

# 2. Review the report
cat .audit-reports/latest.md

# 3. Fix critical issues first
/fix-docs --report latest --severity critical

# 4. Fix specific issue types
/fix-docs --report latest --only "status-conflict"
/fix-docs --report latest --only "stale-documentation" --action archive

# 5. Handle remaining issues interactively
/fix-docs --report latest --interactive

# 6. Verify fixes
/audit-docs /Users/meganharrison/Documents/github/alleato-pm/PLANS/directory/
```

## Why This Design?

1. **Traceable**: Every fix links back to an audit finding
2. **Selective**: Can fix subsets of issues
3. **Reviewable**: Audit reports can be reviewed by team
4. **Reproducible**: Same audit report = same fixes
5. **Safe**: Can preview fixes before applying