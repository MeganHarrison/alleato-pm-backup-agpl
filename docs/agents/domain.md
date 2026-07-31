# Domain Documentation

Read `CONTEXT-MAP.md` before exploring a multi-surface change. It routes you to
the narrowest relevant context and names the supporting architecture sources.

## Required reading order

1. Read the root `CONTEXT.md` for shared domain vocabulary.
2. Read the relevant context file named by `CONTEXT-MAP.md`.
3. Read applicable decisions in `docs/ops/adr/` and architecture material in
   `docs/architecture/`.
4. Use the established terms in issue titles, specifications, tests, and code.

If the context or decision document does not exist, proceed without inventing
one. Use `domain-modeling` only when a real terminology or durable design gap
needs to be resolved.

When an intended change conflicts with an ADR, state the conflict explicitly
and explain why reopening the decision is warranted instead of silently
overriding it.
