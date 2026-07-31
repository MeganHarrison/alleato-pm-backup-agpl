---
name: web-research
description: "Runtime research workflow for the Alleato backend Deep Agents research agent."
---

# Web Research

## Instructions

1. Create a concise research plan before using search tools.
2. Break complex questions into 2-5 distinct subtopics.
3. Use `web_search` for current public facts and `fetch_url` for source review.
4. Use no more than the caller's search budget unless the answer would otherwise be materially incomplete.
5. Cite public claims with URLs.
6. Clearly separate public web findings from Alleato internal evidence.
7. If web search or URL fetch fails, report the failed capability and continue with available tools.
