# Design System Report

Generate a comprehensive report of design system status.

## Usage
```
/design-report [format]
```

**Formats:**
- `summary` - Quick overview (default)
- `full` - Detailed report with all violations
- `markdown` - Export as markdown file
- `json` - Raw JSON export

## Instructions

Generate a design system compliance report.

### Step 1: Load Current State
Read `.claude/design-audit/violations.json`

### Step 2: Calculate Metrics

```
Total Violations: X
  - Pending: X
  - In Progress: X
  - Fixed: X
  - Verified: X
  - Needs Review: X

By Severity:
  - Critical: X
  - Major: X
  - Minor: X
  - Suggestion: X

By Category:
  - Color: X
  - Spacing: X
  - Typography: X
  - Border Radius: X
  - Shadow: X
  - Component Usage: X
  - Layout: X
  - Responsive: X
  - Accessibility: X
  - Naming: X
  - Dark Mode: X
  - Animation: X

Compliance Score: X% (verified / total * 100)
```

### Step 3: Generate Report Based on Format

**Format: summary** (default)
```
Design System Compliance Report
===============================
Generated: [timestamp]

Compliance Score: X%

Status:
  Verified: X | Fixed: X | Pending: X | Needs Review: X

Top Issues:
  1. [category]: X violations
  2. [category]: X violations
  3. [category]: X violations

Top Files:
  1. path/to/file.tsx: X violations
  2. path/to/file.tsx: X violations
  3. path/to/file.tsx: X violations

Recommended Actions:
  - [action based on data]
```

**Format: full**
Include all violations grouped by file, with full details.

**Format: markdown**
Write report to `.claude/design-audit/DESIGN-REPORT.md`

**Format: json**
Write raw data to `.claude/design-audit/report-[timestamp].json`

### Step 4: Recommendations

Based on the data, provide actionable recommendations:
- If many color violations: "Focus on replacing raw hex values with design tokens"
- If many spacing violations: "Standardize on 8px grid spacing"
- If many component violations: "Migrate raw HTML to ShadCN components"
- If high pending count: "Run /design-fix-loop to address violations"
- If high needs_review: "Manual review needed for complex cases"
