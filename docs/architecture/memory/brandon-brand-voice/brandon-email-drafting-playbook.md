# Brandon Email Drafting Playbook

Last reviewed: 2026-05-19

Purpose: quick-use playbook for drafting email replies in Brandon's tone from current thread evidence.

Primary voice source: `docs/ai-plan/brandon-email-voice-profile.md`
Deeper operating context: `docs/ai-plan/brandon-operating-profile.md`

## Default Recipe

1. Read the current email/thread.
2. Identify the actual decision type: approve, clarify, delegate, correct, escalate, or acknowledge.
3. Extract only the facts needed: number, date, scope, owner, document, project, and requested action.
4. Draft in Brandon's voice: short, direct, specific.
5. Add an internal note only outside the email body if context is missing.

## Decision Type Prompts

### Approve

Use when the thread already proves what is being approved.

```text
Yes, that works. Please [specific action].

Thank You
```

### Clarify Cost Or Scope

Use when a change may affect budget, margin, or owner expectation.

```text
Is this actual added scope or a pricing change from the original number?

Please send the total and backup so we can see what changed.

Thank You
```

### Delegate

Use when Brandon should not be the person doing the follow-up.

```text
[Name],

Please get them what they need and copy me on the response.

Thank You
```

### Correct Routing

Use when Brandon is being pulled into noise.

```text
Please get this routed to the right person going forward so I am not the one receiving these.

Thank You
```

### Ask For Missing Evidence

Use when the thread references an absent attachment, photo, quote, drawing, or prior email.

```text
I do not see the attachment. Can you resend it with the backup?

Thank You
```

### Push For Status

Use when the business needs a clear update.

```text
What is the status on this and when will we have the number?
```

### Internal Software/AI Issue

Use when responding to internal tool problems.

```text
What is broken and what is causing it?

We need to fix the actual issue so this does not keep happening.
```

## Style Rules

- Keep the recipient-facing body short.
- Use "please" without softening the ask.
- Prefer "what is" and "do we have" over elaborate framing.
- Do not add a long recap unless the recipient needs it to act.
- Do not sanitize all personality out of the draft.
- Keep "Thank You" capitalized when using Brandon's common sign-off.

## Internal Note Template

Use only outside the email body:

```text
Internal note: I drafted this from [source/thread]. I am not fully confident on [missing fact], so I made the email ask for confirmation instead of approving it.
```

## Quality Bar

A draft is ready when:

- the first sentence could be sent by itself,
- no unsupported fact was introduced,
- the next action is obvious,
- the tone is practical and owner-level,
- uncertainty is handled by asking a direct question.
