---
description: Write a new help article from scratch and publish it to the doc site at /docs
---

# New Doc

Write a brand-new help article for the Alleato doc site and publish it to `docs/help/articles/`.

## Usage

```
/new-doc <topic description> [category]
```

Examples:
- `/new-doc "Change event to change order workflow" "Financial Tools"`
- `/new-doc "How retainage works"`
- `/new-doc "Setting up your account for the first time" "Getting Started"`
- `/new-doc "Pay application walkthrough" "Financial Tools"`
- `/new-doc "What is the AI assistant" "AI Features"`

Category is optional. If omitted, infer it from the topic (see Category Inference below).

---

## Implementation Steps

### Step 1 — Parse the topic and infer missing values

Extract from the user's input:
- **topic**: the subject of the article (e.g. "Change event to change order workflow")
- **category**: from the argument, or infer using the table below

**Category Inference:**

| Topic keywords | Category |
|---|---|
| account, login, onboarding, first time, getting started, new user, setup | Getting Started |
| budget, cost code, change event, change order, commitment, invoice, pay app, retainage, direct cost, prime contract, estimate, forecast, SOV | Financial Tools |
| RFI, submittal, transmittal, specification, drawing, document, punch list, daily log, photo, progress report | Field & Document Tools |
| AI, assistant, intelligence, alerts, insights, meetings, chat, ask Alleato | AI Features |
| invite, user, permission, role, admin, company directory, organization | Administration |
| Outlook, Teams, Acumatica, integration, sync, email | Integrations |
| project, schedule, dashboard, home, navigation | Project Management |

Default to `"General"` if nothing matches.

**Derive the slug** from the topic, not the category:
```
slug = topic → lowercase → strip punctuation → spaces to hyphens → max 6 words
```
Examples:
- "Change event to change order workflow" → `change-event-to-change-order-workflow`
- "How retainage works" → `how-retainage-works`
- "Setting up your account for the first time" → `setting-up-your-account`

Check that slug doesn't already exist:
```bash
ls /Users/meganharrison/Documents/alleato-pm/docs/help/articles/<slug>.md 2>/dev/null && echo "EXISTS" || echo "OK"
```
If it exists, append `-guide` to the slug.

---

### Step 2 — Determine the Diátaxis document type

Pick **one** type based on the topic. Do not ask — infer:

| If the topic is about… | Type | Structure |
|---|---|---|
| Doing something step by step ("create a…", "submit a…", "workflow", "walkthrough", "how to…") | **How-to Guide** | Numbered steps, imperative verbs, minimal theory |
| A feature's data, fields, or columns ("what is…", "understanding…", "overview", "reference") | **Reference / Explanation** | Short definition, then field-by-field or concept-by-concept breakdown |
| A first-time setup experience ("getting started", "setting up", "first time") | **Tutorial** | Guided narrative with a clear end goal, checkpoints |
| A concept that needs background ("why", "how it works", "architecture") | **Explanation** | Prose paragraphs, analogies welcome, no numbered steps |

---

### Step 3 — Research the topic from the codebase

Before writing, pull real details so the article is accurate. Run these searches in parallel:

```bash
# Find relevant existing help articles for cross-links
grep -rl "<topic keywords>" /Users/meganharrison/Documents/alleato-pm/docs/help/articles/ | head -5

# Find related app routes to populate related_routes
find /Users/meganharrison/Documents/alleato-pm/frontend/src/app -type d | grep -i "<topic keywords>" | head -5

# Find any existing internal docs on the topic
find /Users/meganharrison/Documents/alleato-pm/docs -name "*.md" | xargs grep -l "<topic keywords>" 2>/dev/null | grep -v "help/articles" | head -5
```

Read the most relevant existing article (1–2 files max) to:
- Match terminology exactly (e.g. "Commitment Change Order" not "contract amendment")
- Identify which related articles to link
- Understand which app route to put in `related_routes`

---

### Step 4 — Write the article

Write the full article body following these rules:

**Voice & tone** (match existing articles exactly):
- Short, declarative sentences. No fluff.
- Imperative mood for steps: "Select", "Open", "Enter", "Save" — never "You can select" or "Users should"
- Construction PM vocabulary: use "commitment", "SOV", "cost code", "PCO", "retainage", "pay app", "ball-in-court" — not generic software terms
- No marketing language. No "powerful", "seamlessly", "robust"
- Second person ("you"), never third ("users")

**Structure rules by type:**

*How-to Guide:*
```markdown
# [Title]

[One sentence: what this guide helps you do.]

## [First major action or phase]

1. Step one.
2. Step two.
3. Step three.

## [Second major action or phase]

[Continue...]

## Related Articles

- [Article Name](/docs/slug)
```

*Reference / Explanation:*
```markdown
# [Title]

[One sentence definition.]

## [Section: key concept or field group]

- **Field Name** — what it means, when it matters.
- **Field Name** — ...

## [Next section]

[Continue...]

## Related Articles
```

*Tutorial (Getting Started):*
```markdown
# [Title]

By the end of this guide you will have [concrete outcome].

## Before you begin

- [Prerequisite 1]
- [Prerequisite 2]

## Step 1 — [Action]

[Brief context, then:]

1. Do this.
2. Do that.

**Checkpoint:** You should now see [X].

## Step 2 — [Next action]

[Continue...]

## Next steps

- [Link to next logical article]
```

---

### Step 5 — Determine frontmatter values

**`audience`:**
- `client` if category is Getting Started, Financial Tools, Field & Document Tools, AI Features, Project Management
- `admin` if category is Administration
- `internal` if category is Developer Reference or unclear

**`client_visible`:**
- `true` if audience is `client`
- `false` if audience is `admin` or `internal`

**`featured`:**
- `true` only if the topic is a primary tool (Budget, Commitments, RFIs, Submittals, Drawings, Change Events, AI Assistant)
- `false` for everything else

**`order`:**
```bash
grep -h "^order:" /Users/meganharrison/Documents/alleato-pm/docs/help/articles/*.md | sort -n | tail -1
```
Use `(max + 10)`.

**`tags`:** derive 3–5 lowercase hyphenated tags from the topic keywords.

**`related_routes`:** populate from Step 3 research. Format: `/[projectId]/tool-name`. Leave `[]` if uncertain.

---

### Step 6 — Write the file

Create `docs/help/articles/<slug>.md`:

```markdown
---
title: <title>
description: <one sentence, max 160 chars>
audience: <client|admin|internal>
visibility: published
module: <slug of primary tool, e.g. "budget", "commitments", "rfis">
category: <category>
tags: [<tag1>, <tag2>, <tag3>]
featured: <true|false>
client_visible: <true|false>
ai_visible: true
order: <max + 10>
related_routes:
  - /[projectId]/<tool>
related_actions: []
---

<!-- allow-outside-documentation -->

<full article body>
```

---

### Step 7 — Verify the file parses

```bash
head -20 /Users/meganharrison/Documents/alleato-pm/docs/help/articles/<slug>.md
```

Confirm the frontmatter block opens and closes correctly (starts and ends with `---`).

---

### Step 8 — Update the scratch ideas file

Remove the topic from the ideas list if it appears there:
```bash
grep -n "<topic keywords>" /Users/meganharrison/Documents/alleato-pm/alleato-ai/_scratch/docs-ideas.md 2>/dev/null
```

If found, note the line so the user can remove it.

---

### Step 9 — Report

Tell the user:
- ✅ Article created: `docs/help/articles/<slug>.md`
- 📂 Category: **<category>**
- 🔗 Link: `/docs/<slug>`
- 👥 Visible to clients: yes / no
- Any frontmatter fields worth reviewing (especially `client_visible`, `featured`, `related_routes`)

---

## Tone reference

Study these existing articles before writing to match their style exactly:
- `docs/help/articles/change-events.md` — how-to, Financial Tools
- `docs/help/articles/commitments.md` — how-to, Financial Tools
- `docs/help/articles/budget-overview.md` — reference/explanation, Financial Tools
- `docs/help/articles/rfis.md` — how-to, Field & Document Tools

## Rules

- **Never ask clarifying questions** — infer everything from the topic and research
- **Never use placeholder text** — every section must have real content
- **Never invent features** — only write what exists in the codebase or existing articles
- **Always include a Related Articles section** with 2–4 real links to existing articles
- **Never add `eslint-disable` comments** to generated markdown
- Articles with `ai_visible: true` feed the AI assistant's RAG pipeline — accuracy matters
