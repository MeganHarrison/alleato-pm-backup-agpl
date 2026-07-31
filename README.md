# Alleato-PM

Alleato-PM is a construction project management platform modeled on Procore workflows. The repository combines a Next.js 15 frontend, a Python/FastAPI backend, Supabase schema management, and a large set of automation and verification utilities.

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Python 3.11+
- Supabase access for the configured project

### Setup

```bash
npm install
cd frontend && npm install
cp frontend/.env.example frontend/.env.local
cp backend/.env.template backend/.env
```

Fill in the copied environment files with the required Supabase and API credentials.

### Run Locally

```bash
# repo root
npm run dev

# frontend only
npm run dev:frontend

# backend only
npm run dev:backend
```

## High-Signal Commands

```bash
# repo root
npm run db:types
npm run check:routes
npm run verify:browser
npm run test

# frontend/
npm run quality
npm run test
npm run test:unit
```

## Repository Layout

- `frontend/` - Next.js app, UI components, App Router routes, frontend tests
- `backend/` - FastAPI services, backend scripts, pytest coverage
- `supabase/` - migrations and DB helper scripts
- `scripts/` - repo-level automation, validation, and crawl utilities
- `docs/` - maintained project documentation
- `docs/` - AI-generated reports and PRP outputs
- `_bmad/` - BMAD method agents and workflows

## Where the Data Lives

The single most-asked question in this repo, answered bluntly. Two Supabase projects:
**PM APP** (`lgveqfnpkxvzbnnwuled`, the app DB) and **AI DB** (`fqcvmfqldlewvbsuxdvz`,
the RAG vector store). Nearly all communication content funnels into
`document_metadata` (PM APP) and is embedded into `document_chunks` (AI DB).

| Content | Table (DB) | How to find it | Synced by |
|---------|-----------|----------------|-----------|
| **Microsoft Teams messages** | `document_metadata` (PM APP) | `category='teams_message'` — DMs as `type='teams_dm'` / `'teams_dm_conversation'`, channels as `type='teams_message'` | `backend/.../microsoft_graph/teams.py` |
| Emails (raw, everything) | `outlook_email_intake` (PM APP) | one row per synced email | `microsoft_graph/outlook.py` |
| Emails (AI-relevant) | `document_metadata` (PM APP) | `category='email'` | same sync, relevance-filtered |
| Emails (project-matched) | `project_emails` (PM APP) | FK to project | same sync |
| Meeting transcripts (Fireflies) | `document_metadata` → `meeting_segments` (PM APP) | `meetings.transcript_document_id` links meeting → transcript | Fireflies sync |
| OneDrive/SharePoint files | `document_metadata` (PM APP) | `source_system='onedrive_file'` etc. | `microsoft_graph/onedrive.py` |
| Drawing OCR text | `document_metadata.content` (PM APP) | via `drawings.document_metadata_id` | OCR worker |
| **Semantic search over all of it** | `document_chunks` (AI DB) | `source_type` = `email`, `teams_dm`, `teams_channel`, `meeting_segment`, … | Graph/generic embedders |
| Extracted intelligence (tasks, risks, decisions) | `insight_cards` + `tasks` (PM APP) | linked to sources via `insight_card_evidence` | nightly intelligence pipeline |

⚠️ **Don't confuse the two chat systems.** `team_chat_channels` / `team_chat_messages`
back **Team Chat** (`/team-chat`) — the app's own internal chat product (channels, DMs,
comments-inbox). The UI is built but the feature is not yet rolled out; launching it is a
standing priority. It has nothing to do with Microsoft Teams — Microsoft Teams history is
the `document_metadata` row above. Full pipeline detail:
`docs/architecture/COMMUNICATIONS-DATA-PIPELINE.md`. Per-table truth:
`docs/architecture/TABLE-LIST.md` (generated) + `docs/architecture/tables.yaml` (source).

## Documentation

Start here:

- `docs/project-overview/index.md`
- `docs/project-overview/project-context.md`
- `docs/development/developer-manual.md`
- `docs/design/AI-UI-BASELINE.md`
- `AGENTS.md`

## Notes

- Supabase types are generated into `frontend/src/types/database.types.ts` via `npm run db:types`.
- Route conflicts are guarded by `npm run check:routes`.
- Browser-style verification artifacts are written under `tests/agent-browser-runs/` and should not be committed as active work products unless intentionally documenting a result.

## Commands

npm run audit:db - audit forms (frontend/scripts/audit/audit-db-inserts.ts)
