# Knowledge Article Schema

This file defines the format for all knowledge articles compiled from daily conversation logs.

## Article Format

Every article lives in `knowledge/concepts/` or `knowledge/connections/` and uses this structure:

```markdown
---
title: "Article Title"
slug: article-slug
type: concept | connection
tags: [tag1, tag2]
sources: [daily/YYYY-MM-DD.md]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

## Key Points

- Bullet point 1
- Bullet point 2
- Bullet point 3

## Details

First paragraph with in-depth explanation.

Second paragraph with additional context, cross-references using [[wikilinks]].

## Related Concepts

- [[concepts/related-slug-1]] — brief description of relationship
- [[concepts/related-slug-2]] — brief description of relationship

## Sources

- `daily/YYYY-MM-DD.md` — specific claim or context extracted from this log
```

## Concept Articles (`knowledge/concepts/`)

Use for: a technology, pattern, system, tool, decision, person, project, or recurring theme.

- Slug: lowercase-kebab-case
- Tags: categorize the domain (e.g., `database`, `frontend`, `ai`, `architecture`, `bug-fix`)
- Sources: list every daily log that contributed to this article
- Use `[[concepts/slug]]` wikilinks to link related articles

## Connection Articles (`knowledge/connections/`)

Use for: a non-obvious relationship between two or more existing concepts.

- Slug: `concept-a--concept-b` (double dash separates the two sides)
- Tags: include tags from both concepts
- Key Points: explain the relationship, not the individual concepts
- Details: when does this relationship matter? what are the implications?

## Index Entry Format (`knowledge/index.md`)

Table header:
```
| Article | Summary | Compiled From | Updated |
|---------|---------|---------------|---------|
```

Each row:
```
| [[concepts/slug]] | One-line summary of the concept | daily/YYYY-MM-DD.md | YYYY-MM-DD |
```

## Log Entry Format (`knowledge/log.md`)

Each compile run appends:
```
## [ISO-TIMESTAMP] compile | YYYY-MM-DD.md
- Source: daily/YYYY-MM-DD.md
- Articles created: [[concepts/x]], [[concepts/y]]
- Articles updated: [[concepts/z]] (if any)
```

## Quality Standards

- Every article must have complete YAML frontmatter (all fields filled in)
- Every article must link to at least 2 other articles via `[[wikilinks]]`
- Key Points: 3–5 bullets, each a standalone insight
- Details: minimum 2 paragraphs
- Related Concepts: minimum 2 entries with relationship descriptions
- Sources: cite specific claims, not just the file name
- Write in encyclopedia style — neutral, present tense, comprehensive
- Avoid phrases like "in this session" or "today we" — write as if permanent reference material
