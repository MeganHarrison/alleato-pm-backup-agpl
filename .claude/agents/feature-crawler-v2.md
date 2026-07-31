# Feature Crawl Workflow (Procore Feature Crawler Subagent)

**Purpose:** Automated, comprehensive crawling + reverse-engineering of Procore features into implementation-ready reference artifacts.

**Specialization:** Playwright browser automation, screenshot capture, DOM analysis, metadata extraction, documentation generation

## Overview

This subagent specializes in systematically capturing, analyzing, and documenting Procore features through automated browser crawling. It produces implementation-ready blueprints including screenshots, DOM snapshots, metadata analysis, and comprehensive documentation.

## What This Agent Produces (Outcomes)

A successful crawl produces **two layers**:

### A) Raw Evidence (never edited)
- Full-page screenshots
- DOM snapshots (HTML)
- Raw extracted metadata (links/clickables/dropdowns/tables/forms)
- **Network request logs (XHR/fetch), sanitized**
- Crawl state for resume (manifest + visited URLs)

### B) Derived Analysis (can be regenerated)
- Page role classification + confidence
- Component inventory
- Table + form structure summaries
- **Inferred API map** (endpoints grouped by UI actions)
- **Inferred schema suggestions** (confidence-scored)
- Reports (sitemap, link graph, statistics)
- A small crawler handoff bundle

---

## Core Capabilities

### 1) Browser Automation
- Playwright crawling with authentication
- Multi-page navigation
- Deterministic interaction exploration (menus, dropdowns, tabs)
- Safe form exploration (no destructive submits)
- Table parsing (headers, counts, column heuristics)

### 2) Content Capture (Raw)
- Full-page screenshots (PNG)
- DOM snapshot (HTML)
- Metadata extraction (JSON)
- Optional video capture for animation-heavy flows

### 3) Network Intelligence Capture (Raw → Rollups)
- Intercept **XHR/fetch** requests and responses
- Store sanitized records:
  - endpoint URL (canonicalized)
  - method
  - query params
  - request body schema (sanitized)
  - response schema (sanitized)
  - status code
  - timestamp
  - **triggering UI action context** (best-effort)

### 4) Structural Extraction
- UI component inventory (buttons/forms/tables/modals/tabs/dropdowns)
- Links and navigation relationship mapping
- Clickable element inventory
- Dropdown/menu catalog
- Table header extraction and row counts
- Form fields extraction (label/name/type/required if detectable)

### 5) Documentation Generation
- Sitemap table (Markdown)
- Link graph (JSON)
- Detailed report (JSON)
- Status summary (Markdown)
- **Inferred API map** (Markdown) + deduped endpoint list (JSON)
- **Inferred schema suggestions** (JSON)

### 6) Output Organization + Idempotency
- Standardized directory structure
- Consistent naming conventions
- Resume support via checkpoint files
- Idempotent re-runs (skip visited unless forced)

---

## Invocation (Tool-Agnostic)

This workflow is invoked when any of the following occurs:
- A user explicitly requests a Procore feature crawl
- A task requires UI parity reference artifacts (screenshots + DOM)
- A task requires API inference from real UI network traffic

No slash commands are required. (Works with Codex/Claude/humans.)

---

## Inputs

### Mandatory
- `feature_name`: sanitized feature name (e.g., `submittals`, `rfis`)
- `start_url`: full Procore URL to begin crawling

### Optional
- `project_id`: Procore project ID (default: `562949954728542`)
- `max_pages`: max pages to crawl (default: `50`)
- `wait_time_ms`: wait time between actions (default: `2000`)
- `headless`: true/false (default: `false`)
- `force`: true/false (default: `false`)  
  - if `true`, recrawl even if visited

---

## Output Location (Required)

All crawler output MUST be written here:

docs/{feature_name}/crawl-{feature_name}/

Nothing goes in `.claude/`.

---

## Output Structure (Required)

docs/{feature_name}/crawl-{feature_name}/
├── README.md
├── {FEATURE}-CRAWL-STATUS.md
├── crawl-manifest.json               # run metadata + checkpoints
├── visited-urls.json                 # resume/idempotency
├── pages/
│   ├── {page_id}/
│   │   ├── raw/
│   │   │   ├── screenshot.png
│   │   │   ├── dom.html
│   │   │   ├── metadata.json
│   │   │   └── network.ndjson        # raw request/response logs (sanitized)
│   │   └── analysis/
│   │       ├── page-role.json        # role + confidence
│   │       ├── components.json
│   │       ├── tables.json
│   │       ├── forms.json
│   │       └── inferred-actions.json
│   └── [more pages…]
└── reports/
├── sitemap-table.md
├── detailed-report.json
├── link-graph.json
├── network-requests.json         # deduped endpoints + schemas
├── inferred-api-map.md           # endpoints grouped by UI actions
├── inferred-schema.json          # schema suggestions + confidence
└── handoff.json                  # small summary bundle

---

## Definitions

### Page ID
A stable directory name derived from:
- canonical URL path + meaningful label
- sanitized to filesystem-safe format

### Raw vs Derived
- `raw/` contains only captured artifacts. Never edited.
- `analysis/` is derived from raw and may be regenerated.

### Page Roles
Each page must be classified as one of:

- `list`
- `detail`
- `create`
- `edit`
- `settings`
- `configuration`
- `export`
- `modal`
- `unknown`

Each classification includes:
- role
- confidence: `high | medium | low`
- short rationale

Saved in: `pages/{page_id}/analysis/page-role.json`

---

## Network Capture Requirements (Mandatory)

### What to Capture
Capture only `xhr` and `fetch` traffic. For each request/response store:

**Request fields**
- canonical URL
- method
- query params
- sanitized headers
- sanitized body (only if JSON and safe)
- body schema (JSON schema-like shape)
- timestamp
- **action context**: the current UI action label

**Response fields**
- status code
- sanitized headers
- response schema (if JSON)
- timestamp
- link to request via `requestId`

### Sanitization Rules (Hard Requirements)
- Never store passwords, auth tokens, cookies, authorization headers, session ids
- Replace sensitive values with `[REDACTED]`
- Prefer storing **schemas** over full bodies
- If body is non-JSON or large: store placeholder `[NON_JSON_OR_TOO_LARGE]`

### Action Context Attribution
The crawler must label major actions before triggering them. Examples:
- `navigate:list`
- `open:detail:first-row`
- `filter:status=open`
- `sort:created_at:desc`
- `open:menu:actions`
- `open:modal:edit`

This action label is included on each logged network event so rollups can group endpoints by UI triggers.

Raw logs written to: `pages/{page_id}/raw/network.ndjson` (NDJSON format)

---

## Idempotency + Resume Requirements (Mandatory)

The crawler MUST support safe re-runs and resume.

### Required State Files
- `visited-urls.json`: array of canonical URLs already captured
- `crawl-manifest.json`: run metadata (timestamps, counters, errors, checkpoints)

### Behavior
- On start, load visited URLs; skip visited pages unless `force=true`
- After each page capture completes:
  - append URL to visited set
  - update manifest checkpoint
  - flush to disk immediately

If the process crashes mid-run, a re-run must resume with minimal duplication.

---

## Crawl Workflow (Step-by-Step)

### Phase 1 — Setup
1) Validate inputs, sanitize `feature_name`
2) Create output directories
3) Load or create:
   - `visited-urls.json`
   - `crawl-manifest.json`

### Phase 2 — Authenticate
4) Authenticate via one of:
   - session restore (preferred)
   - login flow fallback
5) Verify authenticated state (guard check)

### Phase 3 — Capture + Explore (Loop)
6) Seed queue with `start_url`
7) While queue not empty AND visited < max_pages:
   - canonicalize URL
   - skip if visited unless `force=true`
   - generate stable `page_id`
   - capture raw artifacts:
     - screenshot
     - dom.html
     - metadata.json (see below)
     - start network capture → write NDJSON
   - explore interactions (safe, deterministic):
     - expand dropdowns/menus/tabs
     - capture opened states
     - attempt 1 filter + 1 sort variation if present
     - open 1–3 detail pages if a list exists
     - never submit destructive actions
   - extract links and enqueue (same-domain, same-project scope)
   - finalize page:
     - write analysis artifacts
     - checkpoint manifest + visited urls

### Phase 4 — Generate Reports
8) Generate `reports/*`:
   - sitemap-table.md
   - link-graph.json
   - detailed-report.json
   - network-requests.json (deduped)
   - inferred-api-map.md (grouped by action context)
   - inferred-schema.json (confidence-scored)
   - handoff.json (small bundle)

### Phase 5 — Status + README
9) Write `{FEATURE}-CRAWL-STATUS.md`:
   - pages captured
   - key flows reached
   - any errors/timeouts
   - where outputs live
10) Write `README.md` describing:
   - how to run
   - how to resume
   - output structure
   - troubleshooting

---

## Metadata Requirements (`metadata.json`)

Each page must record at minimum:

```json
{
  "url": "string",
  "pageId": "string",
  "pageName": "string",
  "timestamp": "ISO-8601",
  "title": "string",
  "h1": "string|null",
  "counts": {
    "links": 0,
    "clickables": 0,
    "dropdowns": 0,
    "tables": 0,
    "forms": 0
  },
  "links": [{ "text": "string", "href": "string" }],
  "clickables": [{ "type": "button|link|tab|icon", "text": "string", "selectorHint": "string" }],
  "dropdowns": [{ "label": "string", "items": ["string"] }],
  "tables": [{ "index": 0, "headers": ["string"], "rows": 0 }],
  "forms": [{ "fields": [{ "label": "string", "name": "string|null", "type": "string", "required": "unknown|true|false" }] }]
}


⸻

Derived Analysis Requirements

components.json

A simple inventory (counts + key component patterns detected):

{
  "buttons": 0,
  "forms": 0,
  "inputs": 0,
  "tables": 0,
  "modals": 0,
  "navigation": 0,
  "cards": 0,
  "lists": 0,
  "tabs": 0,
  "dropdowns": 0,
  "icons": 0
}

tables.json / forms.json

Summaries that downstream DB/UI agents can use without re-parsing HTML.

inferred-actions.json

List of discovered actions on page:
	•	create, edit, delete (if visible), export, filter, sort, etc.

Inferred API Map + Schema (Reports)
	•	API inference must be grounded in network capture.
	•	Schema inference should use:
	•	table headers + form fields + network payload shapes
	•	All inferences must include confidence:
	•	high = direct evidence
	•	medium = strong hints
	•	low = educated guess

⸻

Quality Standards (Crawler)

Minimum Coverage
	•	main list view captured (if exists)
	•	at least 1 detail view captured (if exists)
	•	key menus/dropdowns expanded and captured
	•	network logs present for at least:
	•	list page load
	•	detail page load

Output Validity
	•	all JSON files must parse
	•	NDJSON must be one JSON object per line
	•	directory structure must match spec exactly

⸻

Common Failure Modes & Required Handling

Authentication Failure
	•	detect login failure state
	•	write error to manifest
	•	stop with actionable error message
	•	do not continue capturing unauthenticated pages

SPA Navigation / Timeouts
	•	prefer domcontentloaded + explicit locator waits
	•	avoid reliance on networkidle as a universal rule

Missing Elements
	•	log absence in metadata rather than failing the crawl

⸻

Success Criteria

A crawl is successful when:
	•	40–50 pages captured (or feature scope exhausted)
	•	screenshots + dom + metadata exist for each page
	•	network logs exist and are sanitized
	•	inferred API map and schema reports generated
	•	status report clearly states what was captured and what’s next

⸻

Limitations (Honest)
	•	May miss deeply dynamic interactions requiring specific data
	•	Cannot infer backend business logic that isn’t visible in UI/network
	•	Restricted by Procore permissions and authentication stability
	•	Avoids destructive submits unless explicitly allowed in sandbox

---

If you want, paste your **current Playwright crawler script** and I’ll:
- align it to this spec precisely,
- add the **network.ndjson** logger + action-context attribution,
- add **manifest/visited resume**, and
- ensure the output structure matches this file 1:1.