---
name: alleato-assistant-card
description: >
  Alleato PM generative-UI pattern for AI chat — the canonical way to add or
  modify a "card" the assistant renders inline in chat (inbox summary, task
  summary, meeting intelligence, draft previews, decision packets, etc.). Use
  whenever you are asked to build a new assistant card/widget, turn a tool's
  output into a rich card instead of text, restyle an existing chat card, or add
  a generative-UI surface to the AI assistant. Covers the payload type, the
  registry, the renderer component, the server emit path, the gallery sample,
  tests, and the chat-UI design rules.
metadata:
  filePatterns:
    - "frontend/src/lib/ai/assistant-widgets.ts"
    - "frontend/src/components/ai-assistant/assistant-widget-renderer.tsx"
    - "frontend/src/components/ai-assistant/chat-area.tsx"
    - "frontend/src/app/auth/ai-widget-gallery/**"
    - "frontend/src/app/api/ai-assistant/chat/handler-v2.ts"
priority: 90
---

# Alleato Assistant Card (generative UI) Pattern

The AI chat renders rich React cards inline by streaming a custom
`data-assistant-widget` part. There are **23+ existing card types** — never invent
a new rendering mechanism, and **check for an existing type before adding one**
(e.g. emails already have `outlook_inbox_summary`; tasks have `task_summary`).

## The six wiring points (all required, in this order)

A new card is not "done" until all six are touched. Skipping #2 breaks a test;
skipping #5 means the card never appears.

| # | File | What you add |
|---|------|--------------|
| 1 | `frontend/src/lib/ai/assistant-widgets.ts` | The payload `type` + (optional) item type, **and** add the type to the `AssistantWidgetPayload` union |
| 2 | `frontend/src/lib/ai/assistant-widgets.ts` | Add the type string to the `ASSISTANT_WIDGET_TYPES` array — **the lockstep test fails until you do** |
| 3 | `frontend/src/components/ai-assistant/assistant-widget-renderer.tsx` | The React component |
| 4 | same file | Register the component in `assistantWidgetComponentRegistry` |
| 5 | server (a tool-output normalizer **or** `handler-v2.ts`) | Emit the widget into the stream |
| 6 | gallery sample + `__tests__` | A static sample + a render test |

### The lockstep guardrail (do not skip #2)

`assistant-widgets.test.ts` asserts the renderer registry keys equal
`ASSISTANT_WIDGET_TYPES`. If you add a component to the registry but forget the
array (or vice versa), this test fails:

```
keeps the payload registry and renderer registry in lockstep
```

Every card type must appear in **both** the union type, the `ASSISTANT_WIDGET_TYPES`
array, and the `assistantWidgetComponentRegistry`. Three places, always in sync.

## 1–2. Payload type + registry

```ts
// assistant-widgets.ts
export type MyCardWidgetItem = {
  id: string;
  // ...fields the row needs. For anything clickable to a source, carry a real URL:
  webLink?: string | null;
};

export type MyCardWidgetPayload = {
  type: "my_card";
  id: string;
  title: string;
  summary: string;        // executive overview shown under the title
  items: MyCardWidgetItem[];
  emptyState?: string;
};

// add to the union:
export type AssistantWidgetPayload =
  // ...existing
  | MyCardWidgetPayload;

// add to the array (REQUIRED — lockstep test):
export const ASSISTANT_WIDGET_TYPES = [
  // ...existing,
  "my_card",
] as const satisfies readonly AssistantWidgetKind[];
```

## 3–4. Renderer component + registry

The renderer receives `{ widget, selectedProjectId, onSubmit, onEditDraft }`.
`onSubmit(prompt)` sends a message back to the assistant as if the user typed it —
use it for row actions (Reply, AI Draft, Create task…).

```tsx
function MyCardWidget({ widget, onSubmit }: {
  widget: MyCardWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  if (widget.items.length === 0) {
    return <div className="mt-3"><InfoAlert><span>{widget.emptyState ?? "Nothing to show."}</span></InfoAlert></div>;
  }
  return (
    <section className="mt-3 overflow-hidden rounded-xl bg-muted/30" aria-label={widget.title}>
      <div className="px-4 pb-3 pt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-primary">AI assistant</p>
        <p className="mt-1.5 text-lg font-semibold text-foreground">{widget.title}</p>
        {widget.summary ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{widget.summary}</p> : null}
      </div>
      <div className="border-t border-border/60">
        {widget.items.map((item) => ( /* row */ ))}
      </div>
    </section>
  );
}

// register (REQUIRED — lockstep test):
const assistantWidgetComponentRegistry = {
  // ...existing,
  my_card: (props) => (props.widget.type === "my_card" ? <MyCardWidget widget={props.widget} onSubmit={props.onSubmit} /> : null),
};
```

The reference implementation to copy is `OutlookInboxSummaryWidget` (same file) —
it has the header, expandable rows, attachment icon, draft signal, source links,
and footer all done correctly.

## 5. Emit the widget server-side

Two supported emit paths — pick the one that matches how the data arrives:

**A. Tool-output normalizer** (the data comes from an AI tool result). Add a
`normalize<X>ToolOutput(output): MyCardWidgetPayload | null` in
`assistant-widget-renderer.tsx` (see `normalizeGetRecentEmailsToolOutput`) and the
renderer turns the tool result into the card automatically.

**B. Direct stream write** in `handler-v2.ts` (you build the payload in the route):

```ts
writer.write({
  type: "data-assistant-widget",
  id: "assistant-widget-my-card",
  data: { widget: myCardPayload },
} as never);
```

The client (`chat-area.tsx → getAssistantWidgetParts`) extracts every
`data-assistant-widget` part and renders it through `AssistantWidgetRenderer`.

## 6. Gallery sample + test

- Add a static sample to `frontend/src/app/auth/ai-widget-gallery/ai-widget-gallery-client.tsx`
  (the `/auth/ai-widget-gallery` page renders the real registry — this is how you
  visually QA without driving the chat).
- Add a render test next to `assistant-widget-renderer.test.tsx`.

## Chat-UI design rules (non-negotiable — these are enforced product rules)

- **No `<Card>` / `<Alert>` wrappers, no `Bot` icon.** Card shell is
  `rounded-xl bg-muted/30` and spacing only. (CLAUDE.md "Chat UI".)
- **Semantic tokens only** — `text-primary` (the brand orange), `text-foreground`,
  `text-muted-foreground`, `border-border`. Zero hex, zero `gray-*`/`blue-*`.
  ESLint blocks hardcoded colors on staged files.
- **Always link back to the source.** Every row that summarizes a record (email,
  meeting, doc) must render its real URL (`webLink`/`href`) as a link or icon —
  a summary with no way to open the source is the #1 complaint. Carry the URL in
  the payload; never drop it.
- **Timestamps in local time, never raw UTC.** Use `formatTimeLabel(receivedAt)`
  (already local) — never print `HH:MM UTC`.
- **Quiet affordances.** A state signal (e.g. "draft ready") is a single colored
  icon (orange pencil when present, muted when absent) — not a loud badge. Apply
  the noise gate: an element earns its place or it's removed.
- **Round any displayed number**, empty fields render nothing (never a "—" dash).

## Verify before claiming done

```bash
cd frontend
npx jest src/components/ai-assistant/__tests__/assistant-widget-renderer.test.tsx \
         src/lib/ai/__tests__/assistant-widgets.test.ts
```

Both suites must pass — especially the lockstep test. Then visually confirm on
`/auth/ai-widget-gallery` (auth-gated; log in with `TEST_USER_1`/`TEST_PASSWORD_1`
from `.env` — never ask the user to log in) and screenshot the card.

## Why this skill exists

The generative-UI system is powerful but has three registries that must stay in
lockstep and a strict chat-UI design contract. Agents that skip the array, skip
the source link, or print UTC produce cards that fail tests or frustrate the user.
This skill makes new cards mechanical: six wiring points, one reference component
(`OutlookInboxSummaryWidget`), one test command.
