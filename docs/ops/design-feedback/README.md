# Conversation Frontend Feedback Ledger

This directory is the canonical repo-local memory for frontend and design
feedback that came from Codex or Claude conversations, not from the in-app
feedback system.

## Purpose

Use this ledger when the user says some version of:

- "This is too wordy."
- "I keep having to say this."
- "Stop doing this pattern."
- "This should be a site-wide rule."
- "Why does every new page repeat this mistake?"

The goal is to capture that correction once, normalize it into a reusable rule,
and make future frontend work consult it before building or reviewing UI.

## Scope

- Codex and Claude conversation feedback about frontend, UX, copy, layout, noise, hierarchy, or design-system consistency.
- Repo-local, dependency-free search and validation.
- Future-session workflow guidance for Alleato frontend tasks.

## Out Of Scope

- In-app product feedback stored in `admin_feedback_items`
- Backend-only incident tracking
- Generic engineering memory that does not change frontend behavior
- Automatic historical import of every old conversation

## Canonical Files

- Registry: `docs/ops/design-feedback/frontend-conversation-feedback.json`
- CLI: `scripts/ops/frontend-feedback-ledger.mjs`
- Focused tests: `scripts/__tests__/frontend-feedback-ledger.test.mjs`
- Future-session skill: `.codex/skills/frontend-conversation-feedback/SKILL.md`

## Commands

```bash
node scripts/ops/frontend-feedback-ledger.mjs validate
node scripts/ops/frontend-feedback-ledger.mjs lookup --text "too wordy view all" --files frontend/src/app/(main)/[projectId]/home/project-command-center.tsx
node scripts/ops/frontend-feedback-ledger.mjs capture \
  --title "Use short View all CTA copy" \
  --category copy \
  --source codex \
  --rule "Use the shortest direct secondary CTA label possible." \
  --rationale "Extra nouns and counts add noise without improving the next action." \
  --comment "This is way too wordy. Change this to View all." \
  --bad "View all subcontractors, 18 more" \
  --good "View all" \
  --tags cta,brevity,copy \
  --applies-to "frontend/src/app/**,frontend/src/components/**" \
  --evidence frontend/src/app/(main)/[projectId]/home/project-command-center.tsx:1032
node scripts/ops/frontend-feedback-ledger.mjs record \
  --id copy.short-view-all-cta \
  --source codex \
  --comment "Still too wordy. Keep it to View all." \
  --bad "View all subcontractors and hidden rows" \
  --good "View all" \
  --evidence frontend/src/components/example.tsx:12
node scripts/ops/frontend-feedback-ledger.mjs intake \
  --comment 'This is way too wordy: "View all subcontractors 18 more" Change this to "View all".' \
  --files 'frontend/src/app/(main)/[projectId]/home/project-command-center.tsx'
node scripts/ops/frontend-feedback-ledger.mjs intake \
  --comment 'This is way too wordy: "View all subcontractors 18 more" Change this to "View all".' \
  --files 'frontend/src/app/(main)/[projectId]/home/project-command-center.tsx' \
  --write
```

## Capture Contract

When a user gives frontend feedback in conversation and it is clearly meant to be
a reusable rule rather than a one-off preference:

1. Look up existing matching guidance first.
2. If a matching rule exists, update that entry instead of duplicating it.
3. If no rule exists, capture a new entry before closing the task.
4. Prefer normalized rules over vague sentiment.
5. Include one concrete bad example and one preferred replacement whenever
   possible.

Use `record` when the rule already exists and the new conversation comment
should extend its evidence, examples, or quotes instead of creating a duplicate
entry.

Use `intake` when you want the CLI to infer the likely category, title, rule,
and matching existing entry from a raw conversation comment. Add `--write` when
you want that inferred record written through immediately.

## Rule Quality Bar

Good entries are:

- short enough to scan quickly,
- specific enough to apply during implementation,
- attached to one or more frontend paths or surfaces,
- and grounded in a real user quote or correction.

Bad entries are:

- generic design philosophy with no concrete behavior,
- duplicate restatements of `AGENTS.md`,
- or one-off remarks that do not change future frontend decisions.
