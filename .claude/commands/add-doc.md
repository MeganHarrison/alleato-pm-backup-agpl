---
description: Add a markdown file to the frontend docs page (/docs) with a specified category
---

# Add Doc

Publish an existing markdown file to the frontend help center at `/docs`.

## Usage

```
/add-doc <file-path> <category>
```

Examples:
- `/add-doc docs/ai-plan/rag-pipeline/rag-pipeline.md Features`
- `/add-doc /Users/meganharrison/Documents/alleato-pm/docs/database/DATABASE_ARCHITECTURE.md Database`
- `/add-doc docs/patterns/form-id-mismatch-prevention.md Developer Reference`

You can also describe the file in plain English instead of giving a path:
- `/add-doc the rag pipeline doc in docs/ai-plan Features`

## What This Command Does

1. **Resolves the file path** — accepts absolute paths, relative paths from project root, or plain-English descriptions
2. **Reads the source file** — extracts the title (first `#` heading), description (first non-heading paragraph), and content
3. **Creates a help article** in `docs/help/articles/` with proper frontmatter
4. **Verifies** the article appears correctly on the `/docs` page

## Implementation Steps

### Step 1 — Resolve the file

If a path is given, check if it exists:
```bash
# Try as absolute path first, then relative to project root
ls <path>
```

If the file is described in words, search for it:
```bash
find /Users/meganharrison/Documents/alleato-pm/docs -name "*.md" | xargs grep -l "<keyword>" | head -5
```

Show the user which file you found and confirm before proceeding.

### Step 2 — Read the source file

Read the full content of the resolved file.

Extract:
- **title**: the first `# Heading` in the file (strip the `# `)
- **description**: the first non-empty, non-heading paragraph (first 1–2 sentences, max 160 chars)
- **module**: derive from the file's parent directory name (e.g. `docs/ai-plan/rag-pipeline/` → `ai-plan`, `docs/database/` → `database`)
- **slug**: derive from the filename without extension, lowercased, spaces→hyphens

If the file already has YAML frontmatter, read those values and use them as defaults — only add what's missing.

### Step 3 — Determine the slug and output path

```
slug = <filename-without-extension> (lowercase, hyphens)
output = docs/help/articles/<slug>.md
```

Check if the output path already exists:
```bash
ls /Users/meganharrison/Documents/alleato-pm/docs/help/articles/<slug>.md
```

If it exists, ask the user: "An article with slug `<slug>` already exists. Update it, or choose a new name?"

### Step 4 — Choose audience and visibility

Default values (apply unless user specifies otherwise):
- `audience`: `internal`
- `visibility`: `published`
- `client_visible`: `false`
- `ai_visible`: `true`

If the category suggests a user-facing topic (Getting Started, Features, Workflows), prompt: "Should this be visible to clients? (default: no)"

### Step 5 — Determine the order value

Check the highest `order` value in existing articles for the same category:
```bash
grep -h "^order:" /Users/meganharrison/Documents/alleato-pm/docs/help/articles/*.md | sort -n | tail -1
```

Use `(max + 10)` as the new order value.

### Step 6 — Write the help article

Create `docs/help/articles/<slug>.md` with this exact frontmatter format:

```markdown
---
title: <extracted or user-provided title>
description: <extracted or user-provided description>
audience: internal
visibility: published
module: <derived from parent dir>
category: <category argument from command>
tags: [<derived from module and filename>]
featured: false
client_visible: false
ai_visible: true
order: <max + 10>
related_routes: []
related_actions: []
---

<!-- allow-outside-documentation -->

<full content of source file, preserving all markdown>
```

The `<!-- allow-outside-documentation -->` comment is required — it suppresses the lint rule that flags articles outside `docs/help/articles/`.

### Step 7 — Verify

Check the article parses correctly:
```bash
cd /Users/meganharrison/Documents/alleato-pm/frontend && node -e "
const { getHelpArticles } = require('./src/lib/help-articles');
getHelpArticles().then(a => {
  const found = a.find(x => x.slug === '<slug>');
  console.log(found ? 'FOUND: ' + found.frontmatter.title : 'NOT FOUND');
}).catch(e => console.error(e.message));
" 2>&1 | tail -5
```

If the check fails due to TypeScript, run it via ts-node or just verify the file exists with correct frontmatter via `head -20`.

### Step 8 — Report

Tell the user:
- The article was created at `docs/help/articles/<slug>.md`
- It will appear under the **<category>** section at `/docs`
- Direct link: `/docs/<slug>`
- Any fields they may want to customize (title, description, audience, client_visible)

## Notes

- **Never copy files into `docs/help/articles/` that already live there** — the system reads from `docs/help/articles/` directly
- If the source file is already in `docs/help/articles/`, just update its frontmatter
- The category name appears exactly as given in the article list — use Title Case
- Valid `audience` values: `internal`, `client`, `subcontractor`, `admin`
- Valid `visibility` values: `draft`, `published`, `internal`, `archived`
- To hide an article temporarily, set `visibility: draft`
- Articles with `ai_visible: true` are available to the AI assistant for RAG
