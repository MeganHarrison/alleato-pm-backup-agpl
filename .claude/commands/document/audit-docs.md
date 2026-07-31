---
title: Audit Documentation
description: Verify documentation files for accuracy and completeness
command: /audit-docs
---

# Documentation Audit Command

## Usage
```
/audit-docs <folder_path>
```

Example:
```
/audit-docs /Users/meganharrison/Documents/github/alleato-pm/PLANS/directory/
```

## What This Command Does

This command launches a specialized documentation auditor agent that:

1. **Scans all documentation files** in the specified directory (recursively)
2. **Verifies accuracy** by cross-referencing with actual code
3. **Checks completeness** against expected documentation standards
4. **Identifies outdated information** by checking timestamps and code changes
5. **Generates a detailed report** with findings and recommendations

## Audit Process

The agent performs the following checks:

### 1. Content Accuracy Verification
- Cross-references documentation claims with actual implementation
- Verifies code examples still work
- Checks that API references are current
- Validates file paths and dependencies mentioned

### 2. Completeness Assessment
- Ensures all required sections are present
- Checks for missing documentation for new features
- Verifies all public APIs are documented
- Confirms examples cover main use cases

### 3. Freshness Analysis
- Compares documentation timestamps with related code changes
- Identifies stale references to deprecated features
- Flags documentation that hasn't been updated recently
- Checks for broken links and references

### 4. Consistency Review
- Ensures formatting standards are followed
- Verifies naming conventions are consistent
- Checks that terminology is used uniformly
- Validates markdown structure and syntax

## Output Format

The audit automatically saves reports in TWO formats:

### 1. JSON Report (for fix-docs command)
- Location: `.audit-reports/audit-YYYY-MM-DD-HHMMSS.json`
- Purpose: Machine-readable format for the `/fix-docs` command
- Contains: Structured data with file paths, line numbers, and fix strategies

### 2. Markdown Report (for human review)
- Location: `.audit-reports/audit-YYYY-MM-DD-HHMMSS.md`
- Purpose: Human-readable format for team review
- Contains:
  - **Summary** - High-level overview of findings
  - **Critical Issues** - Documentation that is incorrect or misleading
  - **Warnings** - Areas that need updating or improvement
  - **Suggestions** - Recommendations for better documentation
  - **Action Items** - Prioritized list of fixes needed

### Automatic Saving
Reports are ALWAYS saved automatically to `.audit-reports/` directory with:
- Timestamped filenames for history
- Symlinks to `latest.json` and `latest.md` for easy access
- Ready for immediate use with `/fix-docs --report latest`

## Implementation

When you run this command, I will:

1. Launch the documentation-auditor agent with the specified folder path
2. The agent will systematically review all .md, .mdx, and documentation files
3. Cross-reference with the codebase to verify accuracy
4. Generate and SAVE comprehensive audit reports:
   - `.audit-reports/audit-[timestamp].json` (for fix-docs)
   - `.audit-reports/audit-[timestamp].md` (for review)
   - Symlinks to `latest.json` and `latest.md`
5. Display summary and next steps for fixing issues
6. Optionally create GitHub issues for tracking fixes

After audit completes, you'll see:
```
✓ Audit complete!
Reports saved:
- .audit-reports/audit-2024-01-19-093045.json (for fix-docs)
- .audit-reports/audit-2024-01-19-093045.md (for review)

To fix issues:
/fix-docs --report latest --severity critical
```

## Configuration Options

You can customize the audit with additional parameters:
- `--depth <number>` - How deep to traverse subdirectories (default: unlimited)
- `--types <extensions>` - File types to audit (default: .md,.mdx,.txt)
- `--strict` - Use stricter validation rules
- `--fix` - Attempt to auto-fix simple issues
- `--report-format <format>` - Output format: markdown, json, html (default: markdown)

## Example Command Execution

```bash
# Basic audit (saves reports automatically)
/audit-docs /Users/meganharrison/Documents/github/alleato-pm/PLANS/directory/

# Review the saved report
cat .audit-reports/latest.md

# Fix critical issues using the saved report
/fix-docs --report latest --severity critical

# Strict audit
/audit-docs /Users/meganharrison/Documents/github/alleato-pm/PLANS/directory/ --strict

# Complete workflow example
/audit-docs ./docs                          # Run audit (saves reports)
/fix-docs --report latest --interactive     # Fix issues interactively
/audit-docs ./docs                          # Re-audit to verify fixes
```

## Integration with Development Workflow

This command can be integrated into your workflow:
- Run before major releases
- Schedule weekly audits via CI/CD
- Hook into pre-commit for documentation changes
- Use as part of PR review process