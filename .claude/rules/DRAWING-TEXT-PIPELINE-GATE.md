# Drawing Text Pipeline Gate

**Trigger:** Any task that reads, searches, displays, or compares drawing content —
including AI review, `has_vectorized_content` checks, drawing search, or any feature
that needs text extracted from a drawing PDF.

## Before writing any code that reads drawing text

**Read the existing implementation first:**

```bash
grep -n "document_metadata_id\|drawing.*content\|checkVectorizedContent" \
  frontend/src/lib/ai/tools/document-intelligence.ts \
  frontend/src/app/api/projects/\[projectId\]/submittals/\[submittalId\]/linked-drawings/route.ts
```

## Where drawing text lives at each stage

| Stage | Table | DB | How to query |
|-------|-------|----|-------------|
| Just uploaded | nowhere | — | show "processing" |
| After OCR (≤30 min) | `document_metadata` WHERE `status IN ('raw_ingested','ocr_partial')` | PM APP (`lgveqfnpkxvzbnnwuled`) | `createServiceClient()` |
| After embed cron (≤60 min) | `document_chunks` WHERE `document_id = <doc_metadata_id>` | AI DB (`fqcvmfqldlewvbsuxdvz`) | `createRagServiceClient()` |

## The canonical ID chain

```
drawings.document_metadata_id
  └── drawing_revisions.document_metadata_id
        └── document_metadata.id  (PM APP)
              └── document_chunks.document_id  (AI DB, after embed cron)
```

## The canonical implementation

`reviewSubmittalAgainstDrawings` in `frontend/src/lib/ai/tools/document-intelligence.ts`
is the reference implementation. It:
1. Tries RAG `document_chunks` first (post-embedding, best for semantic search)
2. Falls back to PM APP `document_metadata.content` (post-OCR, available immediately)

Copy this pattern. Do not invent a new one.

## What NOT to do

- Do NOT query `document_chunks` with `metadata->>document_type = 'drawing'` — drawing chunks
  don't have that metadata key (confirmed 2026-06-23).
- Do NOT query `rag_document_metadata` — drawing uploads don't go through that table.
- Do NOT check only the RAG DB — drawings have text in PM APP immediately after OCR,
  before the embed cron runs.

## Full pipeline reference

`docs/architecture/AI-RAG-ARCHITECTURE.md` → "Drawing Upload Pipeline — WHERE TEXT LIVES AT EACH STAGE"

## CRITICAL DISAMBIGUATION: "Drawing PDFs" vs "Submittal PDFs"

These are two completely different things. Confusing them wastes time every session.

| Term | What it means | Where content lives | Status for Morrisville |
|------|--------------|--------------------|-----------------------|
| **Drawing PDF** | The actual construction drawing file uploaded to the Drawings module | `document_metadata.content` (OCR'd immediately) | ✅ ALL 63 drawings have OCR text CONFIRMED 2026-06-23 |
| **Submittal PDF** | A file uploaded as an attachment to a specific submittal item | `submittal_documents.extracted_text` | ❌ Morrisville submittals were imported from Procore as metadata only — no attached files |

**The Morrisville drawings have thumbnails in the UI and OCR text in the DB. DO NOT question this.**

When "AI Review" says "no submittal text" for a Morrisville submittal, the drawings are fine.
The submittal itself is missing its uploaded document package. That's the user's data gap, not a code bug.

## Why this gate exists

Built an AI review feature that said "no vectorized content" for drawings that had
real OCR text. Root cause: `checkVectorizedContent` queried `document_chunks` in the
RAG DB instead of `document_metadata` in the PM APP. The embed cron hadn't run yet
so the chunks didn't exist — but the text was there the whole time. Cost: one wasted
debugging session. Fix: always check PM APP `document_metadata.content` as fallback.

Second time lost: used the word "PDFs" ambiguously after a successful AI review test,
implying drawings lacked content when they didn't. The drawings worked the whole time.
The gap was on the submittal side (no uploaded submittal package). Cost: user frustration.
