# Daily Brief Design-Skill Bake-Off

This benchmark prevents four design skills from racing to overwrite one route
and then asking someone to pick from an unreviewable diff.

## Candidate lanes

Run four candidates from the same pinned `origin/main` commit and the exact
same [`DESIGN-BRIEF.md`](./DESIGN-BRIEF.md). Each candidate receives the same
fixture, scope, constraints, and required artifacts.

| Candidate | Skill lens | What it may optimize, without changing the brief |
| --- | --- | --- |
| A | `impeccable` | attention hierarchy, removal, workflow fit, and design-system reuse |
| B | `interface-design` | information architecture, scan path, and interaction affordance |
| C | `premium-frontend-design` | precise visual hierarchy and readable responsive composition |
| D | `Frontend Responsive Design Standards` | mobile structure, touch/keyboard ergonomics, and state resilience |

The skills are evaluated, not trusted. Every candidate must satisfy
[`RUBRIC.md`](./RUBRIC.md).

## Isolation protocol

1. Pin the base commit and create one worktree per candidate.
2. Give each worktree the same source fixture and design brief.
3. Candidate scope is the canonical Daily Brief composition plus the owner
   files it already imports. No candidate modifies another candidate or `main`.
4. Authenticate using `npm run verify:browser-auth` before any screenshot.
5. Validate artifacts with:

   ```bash
   node scripts/design-benchmark/daily-brief.mjs validate <candidate.json>
   ```

6. Score against the rubric. Do not merge automatically. Present a side-by-side
   evidence packet, select a winner, then transplant only that patch.

## Candidate manifest

```json
{
  "candidate": "A",
  "skill": "impeccable",
  "baseCommit": "<pinned commit>",
  "canonicalRoute": "/daily-brief",
  "desktopScreenshot": "<absolute evidence path>",
  "mobileScreenshot": "<absolute evidence path>",
  "interactionTranscript": "<absolute evidence path>",
  "score": {
    "decisionFirstHierarchy": 0,
    "actionCompletion": 0,
    "evidenceConfidence": 0,
    "informationDiscipline": 0,
    "workflowContinuity": 0,
    "responsiveKeyboard": 0,
    "designSystemAccessibility": 0
  },
  "automaticFailures": []
}
```

The validator rejects missing artifacts, unknown skills, an incorrect route,
scores outside their dimension budget, and a candidate with automatic failures.
