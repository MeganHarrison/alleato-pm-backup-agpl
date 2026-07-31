---
name: wiki-markdown
description: Formatting reference for writing persistent wiki-style markdown
  (Obsidian-compatible). Use when writing to the wiki or raw knowledge-base
  files under memories/. Covers wikilinks, frontmatter, embeds, callouts, and
  tags.
---

# Wiki Markdown

Reference for all wiki and raw file writing. Use these conventions
consistently across the knowledge base.

## Storage

Always save wiki and raw knowledge-base files under `memories/` so they persist
between threads. Do not create top-level `wiki/` or `raw/` directories.

## Wikilinks

Internal links between files in the knowledge base:

```markdown
[[memories/wiki/topic-slug]]                        — link to a wiki topic
[[memories/wiki/topic-slug|display text]]           — link with custom display text
[[memories/wiki/topic-slug#section]]                — link to a specific section
[[memories/raw/tweets/2026-W16]]                    — link to raw material
[[memories/raw/articles/some-article|source]]       — link to a raw article
```

Link aggressively. Connections between topics are where insights live.

## Frontmatter

YAML properties at the top of every file:

```markdown
---
title: Agent Frameworks
created: 2026-04-14
updated: 2026-04-14
tags: [ai, tooling, agents]
status: active
---
```

**Required fields for wiki topics:**
- `title` — human-readable name
- `created` — date first created
- `updated` — date last modified
- `tags` — relevant tags for categorization
- `status` — `active`, `stale`, or `retired`

**Required fields for raw material:**
- `title` — descriptive title
- `captured` — date captured
- `source` — URL or author attribution
- `tags` — relevant tags

## Embeds

Pull content from other files inline:

```markdown
![[memories/wiki/topic-slug]]            — embed entire file
![[memories/wiki/topic-slug#section]]    — embed a specific section
```

Use sparingly. Prefer wikilinks over embeds for most references.

## Tags

Use tags in frontmatter, not inline. Keep tags lowercase, hyphenated:

```yaml
tags: [agent-frameworks, llm-tooling, open-source]
```

## Callouts

For highlighting important notes in wiki articles:

```markdown
> [!NOTE] Context
> Additional context about this topic.

> [!WARNING] Unverified
> This claim has not been independently verified.
```

Use `NOTE` for context, `WARNING` for unverified claims, `TIP` for
posting angles.

## File Naming

- Wiki topics: `memories/wiki/{topic-slug}.md` — lowercase, hyphenated
- Raw tweets: `memories/raw/tweets/{YYYY-Www}.md` — ISO week format
- Raw articles: `memories/raw/articles/{slug}.md` — descriptive slug from title
- Index: `memories/wiki/index.md` — always exists, always current
