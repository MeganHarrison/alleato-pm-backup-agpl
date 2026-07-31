---
name: rag-stats
description: Print a concise Alleato source RAG health/stat report for a requested day window. Use when the user says "rag stats", "rag sats", "RAG health stats", "RAG status for 7 days", or asks for synced/chunked/embedded counts across meetings, email, Teams, OneDrive, attachments, Teams compiler, and project intelligence.
argument-hint: <days>
---

# RAG Stats

This skill is for `/Users/meganharrison/Documents/alleato-pm`.

Use it when the user wants a low-cognitive-load RAG status report instead of a long operational narrative.

## Command

Run from the repo root:

```bash
npm run rag:stats -- <days>
```

Examples:

```bash
npm run rag:stats -- 1
npm run rag:stats -- 3 days
npm run rag:stats -- seven days
```

## Output Rules

- Return the script output directly.
- Keep the answer compact.
- Do not expand into a long explanation unless the user asks for root-cause diagnosis.
- Preserve the definitions:
  - `Synced` = source rows in app `document_metadata`.
  - `Chunked` = vector chunks/documents created in split RAG `document_chunks` during the requested window.
  - `Embedded` = vector chunks/documents with non-null embeddings in split RAG `document_chunks` during the requested window.
  - `Metadata Backlog` = synced rows still in raw/processed/segmented/error states.
- If anything is degraded, call it out in one short sentence after the table.

## Report Includes

- Meeting Transcripts
- Emails
- Teams
- OneDrive Files
- Email Attachments
- Teams Compiler last run and recent statuses
- Project Intelligence last updated
- Backlog / health flags

## Failure Format

If the command fails, report only:

- exact failing command
- short error text
- likely missing env var/table
- recommended next step
