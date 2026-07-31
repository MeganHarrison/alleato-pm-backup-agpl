---
title: Delegate Audit Tasks
description: Route documentation audit findings to appropriate specialized agents
command: /delegate-audit-tasks
---

# Delegate Audit Tasks Command

## Purpose
Takes audit findings and intelligently routes them to specialized agents based on task type.

## Usage
```bash
/delegate-audit-tasks --report <audit-report>
```

## Task Routing Matrix

### 1. **Code-Verification Agent** (`task-verification-enforcer`)
Handles tasks that require verifying implementation matches documentation:

| Task Type | Example | Agent Action |
|-----------|---------|--------------|
| Status Verification | "95% complete claimed" | Verify actual completion percentage |
| Feature Testing | "7 forms implemented" | Test if components exist and work |
| API Validation | "25 endpoints documented" | Test all endpoints return expected data |
| Integration Testing | "Import/Export working" | Run actual import/export operations |

**Example Tasks from Your Audit:**
- Verify actual completion percentage (claimed 95%, 91%, 83%)
- Test if CompanyEditDialog.tsx actually exists
- Validate all 7 forms are implemented and functional
- Test import/export functionality

### 2. **Documentation-Fixer Agent** (`codebase-cleanup-organizer`)
Handles documentation organization and cleanup:

| Task Type | Example | Agent Action |
|-----------|---------|--------------|
| Archive Stale Files | "10 files from Jan 15" | Move to .archive directory |
| Consolidate Duplicates | "Multiple status files" | Merge into single source |
| Remove Obsolete Docs | "Old implementation plans" | Delete or archive |
| Update File Paths | "Moved components" | Fix all references |

**Example Tasks from Your Audit:**
- Archive 10 stale files from Jan 15
- Consolidate duplicate status information
- Clean up old planning documents

### 3. **Documentation-Writer Agent** (`general-purpose`)
Creates or updates documentation content:

| Task Type | Example | Agent Action |
|-----------|---------|--------------|
| Update Percentages | "Fix completion stats" | Update with verified numbers |
| Add Missing Docs | "Undocumented features" | Write new documentation |
| Update Examples | "Outdated code samples" | Refresh with current code |
| Fix Descriptions | "Incorrect claims" | Rewrite accurate content |

**Example Tasks from Your Audit:**
- Update completion percentages after verification
- Document actually implemented features
- Remove claims about non-existent components

### 4. **Pattern-Analyzer Agent** (`pattern-analyzer`)
Analyzes codebase for documentation gaps:

| Task Type | Example | Agent Action |
|-----------|---------|--------------|
| Find Undocumented | "Missing API docs" | Scan for undocumented functions |
| Detect Inconsistencies | "Naming mismatches" | Find pattern violations |
| Coverage Analysis | "Test coverage" | Measure documentation coverage |

## Delegation Workflow

### Step 1: Parse Audit Report
```bash
/delegate-audit-tasks --report latest
```

### Step 2: Automatic Task Assignment
```yaml
Parsing audit report...
Found 15 tasks to delegate:

VERIFICATION TASKS (5) → task-verification-enforcer:
✓ Verify completion percentage claims
✓ Test CompanyEditDialog.tsx exists
✓ Validate form implementations
✓ Test import/export functionality
✓ Verify API endpoint responses

CLEANUP TASKS (4) → codebase-cleanup-organizer:
✓ Archive 10 stale files from Jan 15
✓ Consolidate duplicate status docs
✓ Remove obsolete planning files
✓ Organize directory structure

WRITING TASKS (4) → documentation-writer:
✓ Update completion percentages
✓ Document verified features
✓ Fix incorrect claims
✓ Add missing examples

ANALYSIS TASKS (2) → pattern-analyzer:
✓ Find undocumented functions
✓ Analyze documentation coverage
```

### Step 3: Parallel Execution
```bash
Launching agents in parallel...

[task-verification-enforcer]: Testing 7 forms... Found 4/7
[codebase-cleanup-organizer]: Archiving stale files... 10 moved
[documentation-writer]: Updating percentages... 3 files updated
[pattern-analyzer]: Scanning codebase... 23 undocumented functions
```

### Step 4: Consolidated Report
```markdown
## Delegation Results

### ✅ Completed Tasks (12/15)

**Verification Results:**
- Actual completion: 72% (not 95%)
- Forms found: 4 of 7 claimed
- Working endpoints: 18 of 25
- Import/Export: Partially working

**Cleanup Results:**
- Archived: 10 stale files
- Consolidated: 3 duplicate docs
- Removed: 5 obsolete files
- Organized: 2 directories

**Documentation Updates:**
- Updated: 3 completion percentages
- Documented: 4 verified features
- Fixed: 6 incorrect claims
- Added: 2 examples

### ⚠️ Requires Manual Review (3)
1. Conflicting architectural decisions
2. Complex feature documentation
3. Business logic explanations
```

## Example Delegation Commands

### Delegate Everything
```bash
# Parse audit and delegate all tasks
/delegate-audit-tasks --report latest --auto
```

### Selective Delegation
```bash
# Only delegate verification tasks
/delegate-audit-tasks --report latest --only verification

# Only delegate safe cleanup tasks
/delegate-audit-tasks --report latest --only cleanup --safe
```

### Interactive Delegation
```bash
/delegate-audit-tasks --report latest --interactive

> Found: Status verification needed
> Delegate to: task-verification-enforcer? [Y/n]: y

> Found: Archive stale files
> Delegate to: codebase-cleanup-organizer? [Y/n]: y
```

## Task Priority Matrix

| Priority | Task Type | Agent | Urgency |
|----------|-----------|-------|---------|
| **P0** | False claims verification | task-verification-enforcer | Immediate |
| **P0** | Fix critical inaccuracies | documentation-writer | Immediate |
| **P1** | Archive stale docs | codebase-cleanup-organizer | Today |
| **P1** | Update percentages | documentation-writer | Today |
| **P2** | Consolidate duplicates | codebase-cleanup-organizer | This week |
| **P2** | Add missing docs | documentation-writer | This week |
| **P3** | Improve examples | documentation-writer | Next sprint |
| **P3** | Coverage analysis | pattern-analyzer | Next sprint |

## Benefits of Delegation

1. **Parallel Execution** - Multiple agents work simultaneously
2. **Specialized Expertise** - Each agent excels at specific tasks
3. **Faster Resolution** - 4x faster than sequential fixing
4. **Better Quality** - Specialized agents produce better results
5. **Clear Accountability** - Each agent owns specific outcomes

## Integration with Fix-Docs

After delegation completes, remaining tasks can be handled by fix-docs:

```bash
# 1. Delegate specialized tasks
/delegate-audit-tasks --report latest

# 2. Handle remaining simple fixes
/fix-docs --report latest --only formatting

# 3. Manual review for complex issues
/fix-docs --report latest --interactive --only manual
```

## Success Metrics

Track delegation effectiveness:
- Tasks completed: 85% target
- Time saved: 75% faster than manual
- Accuracy improvement: 95% correct fixes
- Parallel efficiency: 4 agents = 4x speed