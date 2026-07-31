---
name: frontend-conversation-feedback
description: Capture and reuse frontend and design feedback that came from Codex or Claude conversations. Use when the user says a frontend comment should become a reusable rule, when a UI audit should consult prior conversational guidance, or when a repeated UX/copy correction should stop being rediscovered in chat.
---

# Frontend Conversation Feedback

Use this skill for Alleato frontend work when conversation feedback, not in-app
feedback, needs to become a reusable implementation or audit rule.

## Canonical Files

- `docs/ops/design-feedback/frontend-conversation-feedback.json`
- `docs/ops/design-feedback/README.md`
- `scripts/ops/frontend-feedback-ledger.mjs`

## Required Behavior

1. Before new frontend implementation or UI audit work, run:

```bash
node scripts/ops/frontend-feedback-ledger.mjs lookup --text "<user request or likely issue>" --files <owned-paths>
```

2. If the user gives a reusable frontend correction in conversation, either:
   - update the existing matching ledger entry, or
   - capture a new entry before closeout.

Prefer `record` for day-to-day use because it will append to an existing rule
when the `id` already exists and create a new entry otherwise:

```bash
node scripts/ops/frontend-feedback-ledger.mjs record \
  --id "<existing-id-if-known>" \
  --title "<title>" \
  --category copy|layout|hierarchy|noise|interaction|component \
  --source codex|claude \
  --comment "<user quote>" \
  [--rule "<normalized rule>"] \
  [--rationale "<why>"] \
  [--bad "<bad example>"] \
  [--good "<good example>"] \
  [--tags "a,b"] \
  [--applies-to "glob1,glob2"] \
  [--evidence "path:line,path2:line"]
```

If you only have the raw conversation comment, use `intake` first. It will
infer the likely rule shape and show likely matching entry IDs before you write:

```bash
node scripts/ops/frontend-feedback-ledger.mjs intake \
  --comment "<raw conversation comment>" \
  --files "<owned-paths>"
```

3. Treat the ledger as conversation-derived guidance only. Do not mix it with
   app-captured `admin_feedback_items`.

4. Prefer normalized rules over vague complaints:
   - bad: `user said the page feels weird`
   - good: `secondary CTA copy should not append entity names or hidden counts`

5. Validation is mandatory before closeout:

```bash
node scripts/ops/frontend-feedback-ledger.mjs validate
```

## Capture Example

```bash
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
```

## When Not To Use It

- Backend-only work
- Database or migration issues
- In-app feedback inbox triage unless the task also turns the lesson into a
  conversation-derived frontend rule
