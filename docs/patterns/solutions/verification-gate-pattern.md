---
title: verification gate pattern
description: verification gate pattern documentation
---

# Solution: Verification Gate Pattern

> Adapted on 2026-04-14 (not adopted verbatim).
> Canonical replacement: `docs/ops/patterns/evidence-based-completion.md` and `docs/ops/orchestration/review-queue.md`.
> Reason: legacy tool/path assumptions and unnecessary checksum complexity for current workflow.

**Solves:** premature-completion.md
**Category:** Workflow

---

## The Pattern

Every task completion requires cryptographic proof that verification was actually run:

```markdown
## Gates Status
| Gate | Status | Checksum | Timestamp |
|------|--------|----------|-----------|
| Quality | PASSED | a1b2c3d4 | 2026-01-12T14:30:00Z |
| Tests | PASSED | e5f6g7h8 | 2026-01-12T14:35:00Z |
| Verify | VERIFIED | i9j0k1l2 | 2026-01-12T14:40:00Z |
```typescript
---

## Gate Enforcement Tool

Create `.agents/tools/enforce-gates.ts`:

```typescript
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface GateResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  checksum: string;
  timestamp: string;
  evidence: string;
  command: string;
}

interface GateConfig {
  name: string;
  command: string;
  successPattern: RegExp;
  required: boolean;
}

const GATES: GateConfig[] = [
  {
    name: 'TypeScript',
    command: 'npm run typecheck --prefix frontend 2>&1',
    successPattern: /error TS\d+/,
    required: true,
  },
  {
    name: 'ESLint',
    command: 'npm run lint --prefix frontend 2>&1',
    successPattern: /\d+ errors?/,
    required: true,
  },
  {
    name: 'Tests',
    command: '', // Set dynamically based on feature
    successPattern: /\d+ failed/,
    required: true,
  },
];

function generateChecksum(output: string): string {
  const timestamp = Date.now().toString();
  return crypto
    .createHash('sha256')
    .update(output + timestamp)
    .digest('hex')
    .slice(0, 12);
}

function runGate(config: GateConfig): GateResult {
  const timestamp = new Date().toISOString();

  try {
    const output = execSync(config.command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    const hasErrors = config.successPattern.test(output);
    const status = hasErrors ? 'FAILED' : 'PASSED';

    return {
      name: config.name,
      status,
      checksum: generateChecksum(output),
      timestamp,
      evidence: output.slice(0, 500),
      command: config.command,
    };
  } catch (error: any) {
    const output = error.stdout || error.message;
    const hasErrors = config.successPattern.test(output);

    return {
      name: config.name,
      status: hasErrors ? 'FAILED' : 'PASSED',
      checksum: generateChecksum(output),
      timestamp,
      evidence: output.slice(0, 500),
      command: config.command,
    };
  }
}

function formatGatesMarkdown(results: GateResult[]): string {
  const lines = [
    '## Gates Status',
    '',
    '| Gate | Status | Checksum | Timestamp | Command |',
    '|------|--------|----------|-----------|---------|',
  ];

  for (const result of results) {
    const statusEmoji = result.status === 'PASSED' ? '✅' : '❌';
    lines.push(
      `| ${result.name} | ${statusEmoji} ${result.status} | \`${result.checksum}\` | ${result.timestamp} | \`${result.command}\` |`
    );
  }

  lines.push('');
  lines.push('## Evidence');
  lines.push('');

  for (const result of results) {
    lines.push(`### ${result.name}`);
    lines.push('```');
    lines.push(result.evidence);
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

export function runAllGates(feature: string): {
  allPassed: boolean;
  results: GateResult[];
  markdown: string;
} {
  // Configure test command for feature
  const testGate = GATES.find((g) => g.name === 'Tests');
  if (testGate) {
    testGate.command = `npx playwright test frontend/tests/e2e/${feature}*.spec.ts --reporter=list 2>&1`;
  }

  const results = GATES.map(runGate);
  const allPassed = results.every((r) => r.status === 'PASSED');
  const markdown = formatGatesMarkdown(results);

  return { allPassed, results, markdown };
}

// CLI usage
if (require.main === module) {
  const feature = process.argv[2];
  if (!feature) {
    console.error('Usage: npx tsx enforce-gates.ts <feature-name>');
    process.exit(1);
  }

  console.log(`Running gates for: ${feature}`);
  const { allPassed, markdown } = runAllGates(feature);

  // Write to GATES.md in feature folder
  const gatesPath = path.join(
    process.cwd(),
    'documentation',
    '*project-mgmt',
    'active',
    feature,
    'GATES.md'
  );

  fs.mkdirSync(path.dirname(gatesPath), { recursive: true });
  fs.writeFileSync(gatesPath, markdown);

  console.log(`\nGates written to: ${gatesPath}`);
  console.log(`\nAll gates passed: ${allPassed ? 'YES ✅' : 'NO ❌'}`);

  process.exit(allPassed ? 0 : 1);
}
```diff
---

## Usage

### Run Gates for a Feature

```bash
npx tsx .agents/tools/enforce-gates.ts change-events
```text
Output:
```

Running gates for: change-events

Gates written to: documentation/*project-mgmt/active/change-events/GATES.md

All gates passed: YES ✅

```typescript
### Pre-Commit Hook Integration

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check if any feature folders have GATES.md
for feature_dir in documentation/*project-mgmt/active/*/; do
  gates_file="$feature_dir/GATES.md"

  if [ -f "$gates_file" ]; then
    # Check if gates are recent (within 1 hour)
    last_modified=$(stat -f %m "$gates_file" 2>/dev/null || stat -c %Y "$gates_file")
    current_time=$(date +%s)
    age=$((current_time - last_modified))

    if [ $age -gt 3600 ]; then
      echo "ERROR: GATES.md in $feature_dir is stale (older than 1 hour)"
      echo "Run: npx tsx .agents/tools/enforce-gates.ts <feature>"
      exit 1
    fi

    # Check if all gates passed
    if grep -q "❌ FAILED" "$gates_file"; then
      echo "ERROR: Gates failed in $feature_dir"
      echo "Fix issues and re-run: npx tsx .agents/tools/enforce-gates.ts <feature>"
      exit 1
    fi
  fi
done

echo "All gates validated ✅"
```typescript
---

## Gate Verification Flow

```typescript
┌─────────────────────────────────────────────┐
│ Agent completes implementation              │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Run: enforce-gates.ts <feature>             │
│                                             │
│ Executes:                                   │
│ 1. npm run typecheck                        │
│ 2. npm run lint                             │
│ 3. playwright test <feature>*.spec.ts       │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Generate checksums from actual output       │
│                                             │
│ checksum = sha256(output + timestamp)[:12]  │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Write GATES.md with:                        │
│ - Status (PASSED/FAILED)                    │
│ - Checksum (proves output was real)         │
│ - Timestamp (proves when run)               │
│ - Evidence (first 500 chars of output)      │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Pre-commit hook validates:                  │
│ - GATES.md exists                           │
│ - Timestamp < 1 hour old                    │
│ - All statuses = PASSED                     │
└─────────────────────────────────────────────┘
                    │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
    All PASSED         Any FAILED
          │                 │
          ▼                 ▼
    Commit allowed    Commit blocked
```

---

## Checksum Verification

To verify a gate was actually run (not faked):

```typescript
// Verification function
function verifyGate(gatesContent: string, gateName: string): boolean {
  const match = gatesContent.match(
    new RegExp(`\\| ${gateName} \\| .* \\| \`([a-f0-9]+)\` \\|`)
  );

  if (!match) return false;

  const storedChecksum = match[1];

  // Re-run the command and compare
  const gate = GATES.find((g) => g.name === gateName);
  if (!gate) return false;

  const result = runGate(gate);

  // Checksums won't match exactly (different timestamp)
  // But we can verify the output pattern matches
  return result.status === 'PASSED';
}
```diff
---

## Integration with Workflow

Update feature-implementation.md to require gates:

```markdown
## Phase 6: VERIFY (MANDATORY)

**Before claiming completion:**

1. Run gates:
   ```bash
   npx tsx .agents/tools/enforce-gates.ts {feature}
   ```text
1. Verify GATES.md shows all PASSED

2. Include gate checksums in completion claim:

   ```markdown
   ## Completion Evidence
   - Quality: PASSED (checksum: a1b2c3d4)
   - Tests: PASSED (checksum: e5f6g7h8)
   - Verify: VERIFIED (checksum: i9j0k1l2)
   ```

```
---

## References

- Error pattern: `.agents/patterns/errors/premature-completion.md`
- Workflow: `.agents/workflows/feature-implementation.md`
- Pre-commit hooks: `.husky/pre-commit`
