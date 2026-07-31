---
title: README
description: README documentation
---

# Pattern Library

> Deprecated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/index.md`.
> Reason: references outdated `.agents/patterns` path and old injection workflow.

This folder contains documented patterns for preventing recurring AI mistakes in the Alleato-Procore project.

## Purpose

The pattern library serves three functions:

1. **Documentation** - Record mistakes that have occurred and their solutions
2. **Prevention** - Auto-inject relevant patterns into agent prompts
3. **Learning** - Build institutional knowledge that survives between sessions

## Structure

```text
.agents/patterns/
├── errors/                    # Documented mistakes
│   ├── networkidle-timeout.md
│   ├── auth-fixture-missing.md
│   ├── route-param-mismatch.md
│   ├── premature-completion.md
│   ├── fk-constraint-user.md
│   └── supabase-types-stale.md
├── solutions/                 # Proven fixes
│   ├── domcontentloaded-pattern.md
│   ├── auth-fixture-pattern.md
│   └── verification-gate-pattern.md
├── index.json                 # Machine-readable catalog
└── README.md                  # This file
```markdown
## Pattern File Format

Each pattern file follows this structure:

```markdown
# Pattern: [Name]

**Severity:** CRITICAL | HIGH | MEDIUM | LOW
**Triggers:** [keywords that should trigger this pattern]
**Category:** Testing | Database | Routing | Workflow

---

## The Mistake
[What agents do wrong]

## The Fix
[Exact code/approach to use instead]

## Detection
[How to know if this mistake is happening]

## References
[Links to related files and documentation]
```markdown
## How to Use

### For Agents

Before starting any task:
1. Read `index.json` to find relevant patterns
2. Match task keywords against `triggers` arrays
3. Read and follow the matched pattern files

Example:
```typescript
// If task mentions "playwright" and "test":
// - Read errors/networkidle-timeout.md
// - Read errors/auth-fixture-missing.md
// - Apply solutions/domcontentloaded-pattern.md
// - Apply solutions/auth-fixture-pattern.md
```

### For Auto-Injection

The injection system works as follows:

```typescript
import patterns from '.agents/patterns/index.json';

function getRelevantPatterns(taskPrompt: string): string[] {
  return patterns.patterns
    .filter(p => p.triggers.some(t =>
      taskPrompt.toLowerCase().includes(t.toLowerCase())
    ))
    .sort((a, b) => {
      const severity = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severity[a.severity] - severity[b.severity];
    })
    .slice(0, patterns.injectionRules.maxPatternsPerPrompt)
    .map(p => fs.readFileSync(`.agents/patterns/${p.file}`, 'utf-8'));
}
```

### For Humans

When debugging recurring issues:

1. Check `errors/` for documented patterns
2. Verify the fix is being applied
3. If new pattern, add it to the library

## Adding New Patterns

When a new recurring mistake is identified:

1. Create error file in `errors/`:

   ```bash
   touch .agents/patterns/errors/new-mistake.md
   ```text
2. Document the mistake following the template

3. If there's a solution, create it in `solutions/`:

   ```bash
   touch .agents/patterns/solutions/new-solution.md
   ```text
4. Update `index.json`:

   ```json
   {
     "id": "new-mistake",
     "name": "New Mistake",
     "type": "error",
     "severity": "HIGH",
     "file": "errors/new-mistake.md",
     "triggers": ["keyword1", "keyword2"],
     "solution": "solutions/new-solution.md",
     "summary": "Brief description"
   }
   ```

## Current Patterns

### Critical Severity

| Pattern | Summary |
|---------|---------|
| networkidle-timeout | Use domcontentloaded instead of networkidle |
| auth-fixture-missing | Import from fixtures for authenticated requests |
| route-param-mismatch | Use [projectId] not [id] for routes |
| premature-completion | Require gate checksums for completion |

### High Severity

| Pattern | Summary |
|---------|---------|
| fk-constraint-user | Check profile exists before created_by |
| supabase-types-stale | Regenerate types before database work |

## Metrics

Track pattern effectiveness:

- Times pattern was triggered
- Times mistake was prevented
- Times mistake occurred despite pattern

## Related

- Workflow: `.agents/workflows/feature-implementation.md`
- Rules: `.agents/rules/`
- Gate enforcement: `.agents/tools/enforce-gates.ts`
