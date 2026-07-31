#!/usr/bin/env node

/**
 * API Smoke Test Suite — runs against the live production URL.
 *
 * Strategy:
 * - Health endpoint must return 200 with correct shape
 * - Protected endpoints must return 200 or 401 (never 500 or timeout)
 * - 500 = server bug, always a failure regardless of auth
 * - 401/403 = expected for protected routes, counts as pass
 * - 000 = timeout/unreachable, always a failure
 *
 * Run locally:
 *   API_SMOKE_BASE_URL=https://projects.alleatogroup.com node scripts/api-smoke-contracts.mjs
 *
 * Run in CI:
 *   Triggered by GitHub Actions cron (daily at 8am UTC)
 */

const BASE_URL = process.env.API_SMOKE_BASE_URL || "http://localhost:3000";
const ERROR_ALERT_WEBHOOK_URL = process.env.ERROR_ALERT_WEBHOOK_URL || "";
const PROJECT_ID = process.env.API_SMOKE_PROJECT_ID || "67";
const BEARER_TOKEN = process.env.API_SMOKE_BEARER_TOKEN || "";
// A syntactically valid but non-existent UUID for "fake id" probes. Must NOT be the
// nil UUID (00000000-…): route handlers call assertNonNilUuid() which rejects the nil
// UUID with a 400 before auth/lookup, which would mask the 401/404 these probes assert.
const FAKE_UUID = "11111111-1111-1111-1111-111111111111";

// FastAPI backend (separate service from the Next.js app). The intelligence
// endpoints live here, authed via the x-admin-api-key header. Default matches
// the local dev backend; override with API_SMOKE_BACKEND_URL in CI/prod.
const BACKEND_URL =
  process.env.API_SMOKE_BACKEND_URL || process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

// ─── Endpoint definitions ───────────────────────────────────────────────────
// [method, path, description, expectedStatuses?, requestBody?, options?]
// If expectedStatuses is omitted, defaults to: any non-500, non-000 status
//
// options.graceUntil ("YYYY-MM-DD") + options.graceStatuses: extra statuses
// tolerated through that date (inclusive). This exists because the PR gate
// (changed-quality) probes PRODUCTION — a PR that tightens an endpoint's
// behavior would otherwise deadlock: the strict contract can't pass until the
// fix deploys, and the fix can't merge until the contract passes. Give the
// old behavior a short grace window instead of loosening the contract or
// admin-merging. After the date the strict contract enforces automatically.
const ENDPOINTS = [
  // Health — must be 200 with specific body shape
  ["GET", "/api/health", "Health check", [200]],

  // Projects
  ["GET", "/api/projects", "Projects list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}`, "Project detail", [200, 401, 404]],

  // Budget
  ["GET", `/api/projects/${PROJECT_ID}/budget/details`, "Budget details", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/budget/history`, "Budget history", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/budget/forecast`, "Budget forecast", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/budget/snapshots`, "Budget snapshots", [200, 401]],
  // POST must return 401 (unauthenticated), never 403 from RLS.
  // Issue #204: budget_snapshots lacked INSERT RLS policy — authenticated users
  // got "New Row violates Row-level security policy" (403-equivalent) instead.
  ["POST", `/api/projects/${PROJECT_ID}/budget/snapshots`, "Budget snapshots create (auth check)", [401]],
  ["GET", `/api/projects/${PROJECT_ID}/budget/direct-costs`, "Budget direct costs", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/budget-codes`, "Budget codes (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/budget/export?format=csv`, "Budget export CSV", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/budget/export?format=excel`, "Budget export Excel", [200, 401]],
  // Lock + modifications power the Unlock dialog's "blocked when active mods exist"
  // guard (test 1.5.3). If either contract regresses the dialog can't compute its
  // blocked state and silently lets users unlock through pending changes.
  ["GET", `/api/projects/${PROJECT_ID}/budget/lock`, "Budget lock status", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/budget/modifications`, "Budget modifications list", [200, 401]],

  // Change Events
  ["GET", `/api/projects/${PROJECT_ID}/change-events`, "Change events list (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  // Detail — must 401 unauthenticated (guard added 2026-07-02). The embedded
  // budget_lines join hard-errors for the anon role, so an unguarded handler
  // surfaces as Postgres "permission denied for table budget_lines" noise.
  ["GET", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}`, "Change event detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-04", graceStatuses: [200, 404] }],
  ["GET", `/api/projects/${PROJECT_ID}/change-events/origin-options`, "Change event origin options (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-06", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}/related-items/options?type=rfi`, "Change event related-items options (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-06", graceStatuses: [200, 400] }],
  // Line items — regression guard for 5.1/5.2 (Add/Edit were missing before 2026-04-21)
  ["GET", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}/line-items`, "Change event line items (fake id)", [200, 401, 404]],
  // Email — regression guard for issue #193: Puppeteer failure caused 500 before fix in commit 24e1d0009
  // Unauthenticated POST must return 401 (auth check runs before any PDF/Resend work), never 500.
  ["POST", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}/email`, "Change event email (unauthed)", [401]],

  // Change Orders / PCOs
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-pcos`, "Prime PCOs list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-pcos/${FAKE_UUID}`, "Prime PCO detail (fake id)", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/commitment-pcos`, "Commitment PCOs list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/commitment-pcos/${FAKE_UUID}`, "Commitment PCO detail (fake id)", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/pcos`, "All PCOs", [200, 401]],

  // Prime Contract Change Orders (canonical routes)
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-change-orders`, "Prime contract change orders list (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-change-orders/1700`, "Prime contract change order detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404] }],
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-change-orders/1700/line-items`, "Prime CO line items list (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404] }],
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-change-orders/export`, "Prime contract change orders CSV export", [200, 401]],

  // Commitment Change Orders (canonical routes)
  // List — must 401 unauthenticated (guard added 2026-07-02): reads budget_lines,
  // which hard-errors for the anon role when the handler runs unauthenticated.
  ["GET", `/api/projects/${PROJECT_ID}/commitment-change-orders`, "Commitment change orders list (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-04", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/commitment-change-orders/${FAKE_UUID}/line-items`, "Commitment CO line items (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-04", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/commitment-change-orders/export`, "Commitment change orders CSV export", [200, 401]],

  // Contracts
  ["GET", `/api/projects/${PROJECT_ID}/contracts`, "Contracts list (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/contracts/settings`, "Prime contract settings (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}`, "Prime contract detail (fake id)", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}/line-items`, "Prime contract line items (fake id)", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}/payments`, "Prime contract payments (fake id)", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}/payment-applications`, "Prime contract payment apps (fake id)", [200, 401, 404]],
  // test 3.2: DELETE on a contract with children must return 409, never 204.
  // A fake UUID has no children so expects 401 (unauthenticated) or 404 (not found) — never 204.
  // Authenticated callers with a real contract that has line items / COs must see 409.
  ["DELETE", `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}`, "Prime contract delete (fake id — child guard)", [401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/vertical-markup`, "Prime contract vertical markup settings", [200, 401]],
  [
    "PUT",
    `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}/advanced-settings`,
    "Prime contract advanced settings unauthorized",
    [401],
  ],

  // Commitments
  ["GET", "/api/commitments", "Commitments list", [200, 401]],
  ["GET", `/api/commitments/${FAKE_UUID}`, "Commitment detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404] }],
  // Issue #238: PUT must never silently drop retainage for purchase orders.
  // An unauthenticated PUT must return 401 — if it returns 500 the update handler is broken.
  ["PUT", `/api/commitments/${FAKE_UUID}`, "Commitment update unauthorized (retainage guard)", [401]],
  // Regression guard: `executed` on subcontracts was previously inside the purchase_order-only
  // block, silently dropping the field on subcontract edits. An unauthed PUT must return 401
  // (auth runs before schema validation) — a 500 means the handler crashed before auth, which
  // would indicate a schema regression stripping the `executed` field.
  ["PUT", `/api/commitments/${FAKE_UUID}`, "Commitment subcontract PUT — executed field not stripped (auth check)", [401]],
  // Regression guard: the inline-edit PATCH endpoint backs table cell editing
  // (title / status / description / executed). An unauthed PATCH must return 401
  // (auth runs before schema validation) — a 404/500 would mean the route was
  // removed or the inline schema crashed, breaking in-place editing.
  ["PATCH", `/api/commitments/${FAKE_UUID}`, "Commitment inline PATCH — title/description/executed (auth check)", [401]],
  ["POST", `/api/projects/${PROJECT_ID}/commitments/export`, "Commitments export (auth + schema check)", [400, 401]],
  ["POST", "/api/sync/acumatica/commitments", "Commitments Acumatica sync (deprecated notice)", [200]],
  // Regression guard: this endpoint returns { deprecated: true } with 200 (no auth required).
  // A 500 here would mean the stub was accidentally removed or the handler was broken.
  ["POST", "/api/sync/acumatica/vendors", "Vendors Acumatica sync (deprecated notice)", [200]],

  // Direct Costs — export route is POST-only (large CSV with body params)
  ["POST", `/api/projects/${PROJECT_ID}/direct-costs/export`, "Direct costs export (auth check)", [400, 401]],

  // Invoicing
  ["GET", `/api/projects/${PROJECT_ID}/invoicing/subcontractor`, "Subcontractor invoicing", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/invoicing/subcontractor/invoices`, "Sub invoices list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/invoicing/payments`, "Payments list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/invoicing/billing-periods`, "Billing periods", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/invoicing/settings`, "Invoicing settings", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/billing-periods`, "Billing periods (alt)", [200, 401]],
  ["GET", "/api/invoices", "Invoices (global)", [200, 401]],

  // Estimates
  ["GET", `/api/projects/${PROJECT_ID}/estimates`, "Estimates list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/estimates/${FAKE_UUID}`, "Estimate detail (fake id)", [200, 401, 404]],
  ["GET", "/api/estimates", "Estimates (global)", [200, 401]],
  ["GET", "/api/estimates/stats", "Estimates stats", [200, 401]],

  // Directory (Project)
  ["GET", `/api/projects/${PROJECT_ID}/directory/companies`, "Directory companies", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/directory/people`, "Directory people (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/directory/groups`, "Directory groups", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/directory/vendors`, "Directory vendors", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/directory/roles`, "Directory roles", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/directory/permissions`, "Directory permissions", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/directory/activity`, "Directory activity", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/directory/filters`, "Directory filters", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/directory/preferences`, "Directory preferences", [200, 401]],

  // Directory (Global)
  ["GET", "/api/companies", "Companies (global)", [200, 401]],
  ["GET", "/api/directory/companies", "Directory companies (global)", [200, 401]],
  ["GET", "/api/directory/vendors", "Vendors (global, unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", "/api/directory/project-companies", "Project companies", [200, 401]],
  ["GET", "/api/contacts", "Contacts", [200, 401]],
  ["GET", "/api/people", "People", [200, 401]],
  ["GET", "/api/employees", "Employees", [200, 401]],
  ["GET", "/api/users", "Users", [200, 401]],

  // Permissions
  ["GET", `/api/projects/${PROJECT_ID}/permissions`, "Project permissions", [200, 401]],
  ["GET", "/api/permissions/templates", "Permission templates", [200, 401]],

  // RFIs
  ["GET", `/api/projects/${PROJECT_ID}/rfis`, "RFIs list (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/rfis/${FAKE_UUID}`, "RFI detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404] }],
  // Regression: drawing_number must be included in POST insertData (was silently dropped — fixed 2026-04-20)
  // Regression (2026-06-14): closing an RFI must NOT fail the request when the close-notification
  // email fails. The status change is persisted first, then the route returns 200 with a
  // non-blocking `_emailWarning` instead of a 502. An unauthenticated PATCH must return 401
  // (auth runs before any status/email work) — a 500 means the close handler crashed before auth.
  // Sends a realistic close payload so this exercises the auth path (-> 401), not the
  // empty-body case. The route must check auth BEFORE parsing the body, or an
  // unauthenticated request would surface a 500 from request.json() instead of 401.
  ["PATCH", `/api/projects/${PROJECT_ID}/rfis/${FAKE_UUID}`, "RFI close — email failure is non-blocking (auth check)", [401], { status: "closed" }],

  // Submittals
  ["GET", `/api/projects/${PROJECT_ID}/submittals`, "Submittals list (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittals/${FAKE_UUID}`, "Submittal detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittals/packages`, "Submittal packages (nested, unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittals/specs`, "Submittal specs (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  // Regression: responsible_contractor_id was z.coerce.number() but column is UUID — field silently dropped.
  // An unauthenticated PATCH must return 401 — if it returns 500 the update handler is broken.
  ["PUT", `/api/projects/${PROJECT_ID}/submittals/${FAKE_UUID}`, "Submittal update unauthorized (responsible_contractor guard)", [401]],
  // Regression: POST with responsible_contractor_id as UUID must not 500 (was NaN from z.coerce.number).
  // An unauthenticated POST must return 401 — if it returns 500 the create handler is broken.
  ["POST", `/api/projects/${PROJECT_ID}/submittals`, "Submittal create unauthorized (responsible_contractor guard)", [401]],

  // Drawings
  ["GET", `/api/projects/${PROJECT_ID}/drawings`, "Drawings list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/drawings/${FAKE_UUID}`, "Drawing detail (fake id)", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/drawings/sets`, "Drawing sets", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/drawings/areas`, "Drawing areas", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/drawings/recycle-bin`, "Drawings recycle bin", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/drawings/${FAKE_UUID}/related-items`, "Drawing related items", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/drawings/${FAKE_UUID}/change-history`, "Drawing change history", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/drawings/${FAKE_UUID}/qr-code`, "Drawing QR code", [200, 401, 404]],
  // Regression: upload-url must return 400 for missing fields and never 500 (caught 2026-04-21)
  ["POST", `/api/projects/${PROJECT_ID}/drawings/upload-url`, "Drawing upload-url (no body → 400)", [400, 401]],

  // Specifications
  ["GET", `/api/projects/${PROJECT_ID}/specifications`, "Specifications list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/specifications/areas`, "Spec areas", [200, 401]],

  // Scheduling
  ["GET", `/api/projects/${PROJECT_ID}/scheduling/tasks`, "Schedule tasks", [200, 401]],

  // Meetings
  ["GET", `/api/projects/${PROJECT_ID}/meetings`, "Meetings list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/meetings/${FAKE_UUID}`, "Meeting detail (fake id)", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/meetings/${FAKE_UUID}/items/${FAKE_UUID}/tasks`, "Meeting agenda item tasks (fake ids)", [200, 401, 404]],
  ["GET", `/api/projects/${PROJECT_ID}/meetings/${FAKE_UUID}/items/${FAKE_UUID}/history`, "Meeting agenda item previous-minutes history (fake ids)", [200, 401, 404]],

  // Photos
  ["GET", `/api/projects/${PROJECT_ID}/photos`, "Photos list (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/photo-albums`, "Photo albums (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],

  // Documents
  ["GET", `/api/projects/${PROJECT_ID}/documents`, "Documents list", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/transmittals`, "Transmittals (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  ["GET", `/api/projects/${PROJECT_ID}/emails`, "Emails", [200, 401]],

  // Entity Links (cross-entity relationships) — top-level route, NOT project-scoped.
  // GET requires entityType+entityId+projectId query params, returns 400 without them.
  // The [linkId] sub-route only supports DELETE — there is no GET handler.
  ["GET", "/api/entity-links", "Entity links list (unauthed must 401 — auth runs before param validation)", [401], undefined, { graceUntil: "2026-07-06", graceStatuses: [200, 400, 500] }],
  ["GET", "/api/entity-links/search?targetType=rfi&projectId=67&q=a", "Entity links search (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-06", graceStatuses: [200, 400] }],
  ["POST", "/api/entity-links", "Entity link create (auth check)", [400, 401]],
  ["DELETE", `/api/entity-links/${FAKE_UUID}`, "Entity link delete (auth check)", [401, 404]],

  // Auth guard sweep (PR #639, 2026-07-02) — routes with no prior smoke coverage.
  // Each was previously unguarded (anon-role query on GET); grace covers the old
  // behavior (200 with real/empty data, or a hard 500 from an RLS-restricted join)
  // until the fix deploys.
  ["GET", `/api/commitments/${FAKE_UUID}/advanced-settings`, "Commitment advanced settings (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/commitments/${FAKE_UUID}/change-orders`, "Commitment change orders — nested list (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/commitments/${FAKE_UUID}/change-orders/${FAKE_UUID}`, "Commitment change order detail — nested (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/commitments/${FAKE_UUID}/history`, "Commitment history (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/commitments/${FAKE_UUID}/invoices`, "Commitment invoices (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/commitments/${FAKE_UUID}/related-items`, "Commitment related items (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/commitments/${FAKE_UUID}/rfqs`, "Commitment RFQs (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/commitments/${FAKE_UUID}/change-events`, "Commitment change events — project-scoped (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/directory/vendors/${FAKE_UUID}`, "Vendor detail — global (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", "/api/document-picker/types", "Document picker types (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 500] }],
  ["GET", `/api/document-picker/linked?entityType=change_event&entityId=${FAKE_UUID}`, "Document picker linked (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 400, 500] }],
  ["GET", `/api/entity-links/search?targetType=commitment&q=x`, "Entity links search (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 400, 500] }],
  ["GET", "/api/estimates/gc-templates", "Estimate GC templates (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/budget-changes`, "Budget changes (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/commitment-options`, "Commitment options (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/change-events/next-number`, "Change event next-number (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}/attachments`, "Change event attachments (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}/attachments/${FAKE_UUID}`, "Change event attachment detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}/line-items/${FAKE_UUID}`, "Change event line item detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}/prime-contract-change-orders`, "Change event PCCOs (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}/related-items`, "Change event related items (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/change-events/${FAKE_UUID}/related-items/options`, "Change event related item options (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/commitment-change-orders/${FAKE_UUID}`, "Commitment change order detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/commitment-change-orders/${FAKE_UUID}/line-items`, "Commitment change order line items — nested (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}/attachments`, "Prime contract attachments (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}/change-orders`, "Prime contract change orders — nested (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}/related-items`, "Prime contract related items (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/pcos/${FAKE_UUID}`, "PCO detail — canonical (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/pcos/${FAKE_UUID}/line-items`, "PCO line items — canonical (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/pcos/${FAKE_UUID}/change-events`, "PCO change events — canonical (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-change-orders/${FAKE_UUID}/related-items`, "PCCO related items (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-change-orders/${FAKE_UUID}/related-items/options`, "PCCO related item options (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittal-packages`, "Submittal packages — top-level (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittal-spec-sections`, "Submittal spec sections (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittal-types`, "Submittal types (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittals/${FAKE_UUID}/related-items`, "Submittal related items (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittals/${FAKE_UUID}/revisions`, "Submittal revisions (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittals/${FAKE_UUID}/workflow-steps`, "Submittal workflow steps (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/submittals/export`, "Submittals export (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/transmittals/${FAKE_UUID}`, "Transmittal detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/photos/${FAKE_UUID}`, "Photo detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200, 404, 500] }],

  // Punch Items
  ["GET", `/api/projects/${PROJECT_ID}/punch-items`, "Punch items", [200, 401]],
  ["POST", `/api/projects/${PROJECT_ID}/punch-items`, "Punch items create (auth check)", [400, 401]],
  // Checklist — must 401 unauthenticated, never 200. Before 2026-07-02 the route
  // had no auth guard: anon-role queries made budget_lines throw "permission
  // denied" in Postgres while every other count silently returned 0 (a 200 with
  // all-false statuses). Strict [401] guards both the noisy and the silent half.
  ["GET", `/api/projects/${PROJECT_ID}/checklist`, "Checklist (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-04", graceStatuses: [200] }],

  // Other project-scoped
  ["GET", `/api/projects/${PROJECT_ID}/vendors`, "Vendors (project, unauthed must 401)", [401], undefined, { graceUntil: "2026-07-05", graceStatuses: [200] }],
  // Company creation is disabled everywhere (Acumatica/ERP is the source of
  // truth — see issue #540). These routes must still check auth BEFORE the
  // ERP guardrail, so an unauthenticated call is 401, never 404 or 500.
  ["POST", `/api/projects/${PROJECT_ID}/vendors`, "Vendors create — disabled, auth check first", [401]],
  ["POST", "/api/companies", "Companies create — disabled, auth check first", [401]],
  ["POST", "/api/directory/companies", "Directory companies create — disabled, auth check first", [401]],
  ["PATCH", `/api/directory/companies/${FAKE_UUID}`, "Directory company edit — disabled, auth check first", [401]],
  ["POST", `/api/projects/${PROJECT_ID}/directory/companies`, "Directory companies create (project) — disabled, auth check first", [401]],
  ["PATCH", `/api/projects/${PROJECT_ID}/directory/companies/${FAKE_UUID}`, "Directory company edit (project) — restricted to primary_contact_id, auth check first", [401]],
  ["GET", `/api/projects/${PROJECT_ID}/employees`, "Project employees", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/subcontracts`, "Subcontracts", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/purchase-orders`, "Purchase orders", [200, 401]],
  ["GET", `/api/projects/${PROJECT_ID}/vertical-markup`, "Vertical markup", [200, 401]],

  // AI / Assistant
  ["GET", "/api/ai-assistant/usage-stats", "AI usage stats", [200, 401]],
  ["GET", "/api/ai-assistant/conversations", "AI conversations", [200, 401]],
  ["GET", "/api/ai-assistant/memories", "AI memories", [200, 401]],
  // POST with a nonexistent project_id must NOT 500 — memory should save with project_id=null
  ["POST", "/api/ai-assistant/memories", "AI memories write (bad projectId must not 500)", [200, 400, 401, 422]],
  ["GET", "/api/ai-assistant/timeline", "AI timeline", [200, 401]],

  // Admin
  ["GET", "/api/admin/feedback", "Admin feedback", [200, 401]],
  ["GET", "/api/admin/feedback/tools", "Feedback tools", [200, 401]],
  ["GET", "/api/admin/company-context", "Company context", [200, 401]],
  ["GET", "/api/email-filter-rules", "Email filter rules (admin)", [200, 401, 403]],
  ["GET",  "/api/knowledge",             "Knowledge documents (public)", [200, 401]],
  ["GET",  "/api/knowledge?manage=true", "Knowledge documents (admin)",  [200, 401, 403]],
  ["POST", "/api/knowledge/upload",      "Knowledge upload (auth guard)", [201, 400, 401, 403]],

  // Dev — these routes are listed in scripts/build/nonprod-routes.json and are
  // legitimately disabled in production builds (Next.js returns 404). Accept
  // 404 in addition to the dev-environment statuses.
  ["GET", "/api/dev/violations", "Design violations", [200, 401, 404]],
  ["GET", "/api/dev/schema", "DB schema", [200, 401, 404]],

  // Misc
  ["GET", "/api/tasks", "Tasks list", [200, 401]],
  ["GET", "/api/documents/status", "Document status", [200, 401]],
  ["GET", "/api/initiative-cards", "Initiative cards", [200, 401]],
  ["GET", "/api/clients", "Clients", [200, 401]],
  ["POST", "/api/clients", "Clients create — disabled, auth check first", [401]],
  ["GET", "/api/monitoring/dashboard", "Monitoring dashboard", [200, 401]],
  ["POST", "/api/docs-search", "Docs search (auth check)", [400, 401]],

  // Auth checks — these must require auth
  ["POST", "/api/cron/daily-flags", "Cron unauthorized", [401]],
  ["POST", "/api/cron/autonomous-triage", "Cron unauthorized", [401]],
  ["POST", "/api/cron/sync-feedback-pr-status", "Cron unauthorized", [401]],
  ["GET", "/api/monitoring/notify", "Monitoring notify unauthorized", [401]],

  // Silent-200 auth-guard sweep (PR #639, verified 2026-07-02): these GET routes
  // previously ran DB queries as the anon role with no auth check. Four raw
  // (non-withApiGuardrails) handlers threw GuardrailError with nothing to catch
  // it → 500/400; several wrapped handlers placed the guard after param/existence
  // checks → 200/400/404 unauthenticated. All now check auth FIRST and 401.
  // Grace tolerates the pre-deploy production behavior until the fix ships.
  ["GET", "/api/estimates/gc-templates", "GC templates (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-06", graceStatuses: [200, 500] }],
  ["GET", "/api/document-picker/types?for=commitment", "Document-picker types (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-06", graceStatuses: [200, 400] }],
  ["GET", `/api/commitments/${FAKE_UUID}/history`, "Commitment history (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-06", graceStatuses: [200, 400, 500] }],
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-change-orders/1`, "Prime CO detail (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-06", graceStatuses: [200, 404] }],
  ["GET", `/api/projects/${PROJECT_ID}/prime-contract-change-orders/1/related-items/options?type=rfi`, "Prime CO related-items options (unauthed must 401)", [401], undefined, { graceUntil: "2026-07-06", graceStatuses: [200, 400] }],

  // ─── Issue #139: unauthenticated service-role MUTATIONS ────────────────────
  // Middleware bypasses auth for every /api/ path except /api/admin/ (see
  // shouldBypassSessionMiddleware), so each handler must reject anonymous
  // callers itself. These three did not: two called getApiRouteUser() and used
  // `user?.id ?? null` without ever rejecting the null, then wrote with the
  // service client (RLS bypassed).
  //
  // Each probe sends a DELIBERATELY INVALID body. Pre-fix, the handler's own
  // validation short-circuited to 400 *before* touching the database — which is
  // what proved the code ran unauthenticated, and what keeps these probes safe
  // to run against production. Post-fix the auth guard runs first and returns
  // 401. Grace tolerates the pre-deploy 400 until this ships.
  ["POST", "/api/estimates/gc-templates", "GC template create (unauthed must 401)", [401], { name: "", items: [] }, { graceUntil: "2026-08-07", graceStatuses: [400] }],
  ["PATCH", `/api/reconciliation/findings/${FAKE_UUID}`, "Reconciliation finding triage (unauthed must 401)", [401], { reviewStatus: "__invalid__" }, { graceUntil: "2026-08-07", graceStatuses: [400] }],
  ["GET", "/api/reconciliation/findings", "Reconciliation findings read (unauthed must 401)", [401], undefined, { graceUntil: "2026-08-07", graceStatuses: [200] }],
  // NOT probed: POST /api/reconciliation/findings. It has no body validation to
  // short-circuit on, so an unauthenticated probe would kick off a real
  // reconciliation run (maxDuration 300, hits Acumatica) every time the gate
  // runs. The GET and PATCH probes above already cover the auth regression on
  // this route family.
];

const AUTH_WRITE_PROBES = [
  {
    method: "PUT",
    path: `/api/projects/${PROJECT_ID}/contracts/settings`,
    description: "Prime contract settings invalid payload validation",
    expectedStatuses: [400],
    body: {
      default_retainage_percent: 101,
    },
  },
  // Regression guard: executed field must be accepted (not stripped) by the PUT route.
  // Bug: executed: true was being silently dropped because the payload used `|| false`
  // instead of `?? false`, and executed_at was missing from the PUT body entirely.
  // A 401 (unauthenticated) or 404 (contract not found) is expected for a fake UUID,
  // but a 500 would indicate the schema rejected `executed` or `executed_at`.
  {
    method: "PUT",
    path: `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}`,
    description: "Prime contract update — executed field accepted (not 500)",
    expectedStatuses: [401, 404],
    body: {
      contract_number: "TEST-EXEC-001",
      title: "Executed Field Regression Guard",
      status: "draft",
      executed: true,
      executed_at: new Date().toISOString(),
    },
  },
  {
    method: "PUT",
    path: `/api/projects/${PROJECT_ID}/contracts/${FAKE_UUID}/advanced-settings`,
    description: "Prime contract advanced settings invalid payload validation",
    // 400 if payload is validated first; 404 if the non-existent contract is resolved first.
    expectedStatuses: [400, 404],
    body: {
      project_settings: {
        co_tier_count: 9,
      },
      contract_settings: {},
    },
  },
];

// ─── Health check contract ──────────────────────────────────────────────────
function assertHealthBody(body) {
  return (
    body &&
    body.status === "healthy" &&
    body.backend === true &&
    typeof body.openai_configured === "boolean" &&
    typeof body.timestamp === "string"
  );
}

// ─── Budget forecast contract ───────────────────────────────────────────────
// Procore-parity columns must be present in the forecast payload. If any of
// these go missing the Forecasting tab silently drops columns (test 2.7).
function assertForecastBody(body) {
  if (!body || typeof body !== "object") return false;
  const s = body.summary;
  if (!s || typeof s !== "object") return false;
  const requiredSummary = [
    "totalProjectedBudget",
    "totalProjectedCosts",
    "totalProjectedCostToComplete",
    "totalEstimatedCostAtCompletion",
    "totalProjectedVariance",
    "variancePercentage",
  ];
  if (!requiredSummary.every((k) => typeof s[k] === "number")) return false;
  if (!Array.isArray(body.forecastByCostCode)) return false;
  // If there are no items we can't verify per-row shape, but the summary check
  // above is enough to catch a regression in the response contract.
  if (body.forecastByCostCode.length === 0) return true;
  const first = body.forecastByCostCode[0];
  const requiredItem = [
    "costCode",
    "costCodeName",
    "projectedBudget",
    "projectedCosts",
    "projectedCostToComplete",
    "estimatedCostAtCompletion",
    "projectedVariance",
  ];
  if (!requiredItem.every((k) => k in first)) return false;
  // Date fields must exist (null is acceptable until schema migration lands)
  return "forecastStartDate" in first && "forecastEndDate" in first;
}

// ─── Budget modifications contract ──────────────────────────────────────────
// The Unlock Budget dialog (test 1.5.3) reads this endpoint to decide whether
// unlock is blocked. The DELETE /budget/lock guard does the same server-side
// check. If the response shape changes, the dialog can't compute its blocked
// state and the UI silently lets users unlock through pending changes.
function assertModificationsBody(body) {
  if (!body || typeof body !== "object") return false;
  if (!Array.isArray(body.modifications)) return false;
  // Empty list is fine — the contract is "an array of modifications exists".
  if (body.modifications.length === 0) return true;
  const first = body.modifications[0];
  return (
    first &&
    typeof first === "object" &&
    "id" in first &&
    "status" in first &&
    typeof first.status === "string"
  );
}

// ─── Project synthesizer (empty-window) contract ─────────────────────────────
// POST /api/intelligence/project-synthesize runs expensive gpt-5.5 extraction
// per comms doc. To exercise the QUERY PATH without paying for extraction, we
// call it with a far-future `since` so the document_metadata SELECT executes but
// matches zero rows → docs_seen=0 and no LLM call fires.
//
// The regression this guards: the document_metadata SELECT once referenced a
// non-existent column (client_id), raising Postgres 42703. Before the fix that
// error was swallowed and the endpoint still returned HTTP 200 with the error
// buried in the body. The fetch now RAISES on failure → the endpoint returns
// 500. So a malformed/renamed-column SELECT must surface as a 500 here, not a
// silent 200. This contract asserts:
//   - HTTP 200 (a healthy query must NOT 500)
//   - docs_seen === 0 (legitimately empty window, not a query error)
//   - errors is an empty array (no per-doc or fetch failures)
//   - the full result envelope shape is present
function assertSynthesizeEmptyBody(body) {
  if (!body || typeof body !== "object") return false;
  if (body.docs_seen !== 0) return false;
  if (!Array.isArray(body.errors) || body.errors.length !== 0) return false;
  const requiredKeys = [
    "project_id",
    "since",
    "docs_seen",
    "emails",
    "teams",
    "skipped",
    "cards_written",
    "tasks_written",
  ];
  return requiredKeys.every((k) => k in body);
}

// ─── Error envelope contracts ────────────────────────────────────────────────
function hasStandardErrorEnvelope(body) {
  return (
    body &&
    typeof body === "object" &&
    body.success === false &&
    typeof body.error_code === "string" &&
    typeof body.error_message === "string" &&
    typeof body.where_it_failed === "string" &&
    typeof body.request_id === "string" &&
    typeof body.timestamp === "string"
  );
}

function hasLegacyErrorEnvelope(body) {
  return body && typeof body === "object" && typeof body.error === "string";
}

// ─── Runner ──────────────────────────────────────────────────────────────────
async function run() {
  const failures = [];
  const warnings = [];
  let pass = 0;
  const authProbeCount = BEARER_TOKEN ? AUTH_WRITE_PROBES.length : 0;
  const backendProbeCount = ADMIN_API_KEY ? 2 : 0;
  let total = ENDPOINTS.length + authProbeCount + backendProbeCount;
  const timestamp = new Date().toISOString();

  console.log(`\nAPI Smoke Test — ${timestamp}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Endpoints: ${total}\n`);

  const today = new Date().toISOString().slice(0, 10);
  for (const [method, path, description, baseExpected, requestBody, options] of ENDPOINTS) {
    const inGrace =
      baseExpected &&
      options?.graceUntil &&
      today <= options.graceUntil &&
      options.graceStatuses?.length;
    const expectedStatuses = inGrace
      ? [...baseExpected, ...options.graceStatuses]
      : baseExpected;
    const url = `${BASE_URL}${path}`;
    let status = 0;
    let body = null;

    try {
      const res = await fetch(url, {
        method,
        signal: AbortSignal.timeout(10000),
        ...(requestBody !== undefined
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(requestBody),
            }
          : {}),
      });
      status = res.status;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
    } catch (err) {
      status = 0; // timeout or network error
    }

    // 500 is always a failure — server bug regardless of auth
    if (status === 500 || status === 0) {
      const label = status === 0 ? "TIMEOUT" : "500";
      console.error(`  FAIL  ${label}  ${method} ${path}  (${description})`);
      failures.push(`${label}: ${method} ${path} — ${description}`);
      continue;
    }

    // Check against expected statuses
    if (expectedStatuses && !expectedStatuses.includes(status)) {
      console.error(`  FAIL  ${status}  ${method} ${path}  expected [${expectedStatuses.join(", ")}]  (${description})`);
      failures.push(`Unexpected ${status}: ${method} ${path} — ${description} (expected [${expectedStatuses.join(", ")}])`);
      continue;
    }

    // Health endpoint: assert body shape
    if (path === "/api/health" && status === 200 && !assertHealthBody(body)) {
      console.error(`  FAIL  200  ${method} ${path}  health body shape mismatch`);
      failures.push(`Health body contract failed: ${JSON.stringify(body)}`);
      continue;
    }

    // Budget forecast: assert Procore-parity columns are present
    if (
      path.endsWith("/budget/forecast") &&
      status === 200 &&
      !assertForecastBody(body)
    ) {
      console.error(`  FAIL  200  ${method} ${path}  forecast body shape mismatch`);
      failures.push(
        `Forecast body contract failed: missing required summary or per-item fields ` +
          `(totalProjectedCostToComplete, totalEstimatedCostAtCompletion, ` +
          `projectedCostToComplete, estimatedCostAtCompletion, forecastStartDate, forecastEndDate)`,
      );
      continue;
    }

    // Budget modifications: assert array shape (powers Unlock dialog blocked state)
    if (
      path.endsWith("/budget/modifications") &&
      status === 200 &&
      !assertModificationsBody(body)
    ) {
      console.error(`  FAIL  200  ${method} ${path}  modifications body shape mismatch`);
      failures.push(
        `Budget modifications body contract failed: expected { modifications: [...] } ` +
          `with each item having id and status fields`,
      );
      continue;
    }

    // Error responses: verify envelope
    if (status >= 400 && body !== null) {
      const hasStandard = hasStandardErrorEnvelope(body);
      const hasLegacy = hasLegacyErrorEnvelope(body);
      if (!hasStandard && !hasLegacy) {
        warnings.push(`${method} ${path} [${status}] — error response missing standard envelope`);
      }
    }

    console.log(`   OK   ${status}  ${method} ${path}  (${description})`);
    pass++;
  }

  if (BEARER_TOKEN) {
    for (const probe of AUTH_WRITE_PROBES) {
      const url = `${BASE_URL}${probe.path}`;
      let status = 0;
      let body = null;

      try {
        const res = await fetch(url, {
          method: probe.method,
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(probe.body),
          signal: AbortSignal.timeout(10000),
        });
        status = res.status;
        const text = await res.text();
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = null;
        }
      } catch {
        status = 0;
      }

      if (status === 500 || status === 0) {
        const label = status === 0 ? "TIMEOUT" : "500";
        console.error(`  FAIL  ${label}  ${probe.method} ${probe.path}  (${probe.description})`);
        failures.push(`${label}: ${probe.method} ${probe.path} — ${probe.description}`);
        continue;
      }

      if (!probe.expectedStatuses.includes(status)) {
        console.error(`  FAIL  ${status}  ${probe.method} ${probe.path}  expected [${probe.expectedStatuses.join(", ")}]  (${probe.description})`);
        failures.push(`Unexpected ${status}: ${probe.method} ${probe.path} — ${probe.description} (expected [${probe.expectedStatuses.join(", ")}])`);
        continue;
      }

      if (status >= 400 && body !== null) {
        const hasStandard = hasStandardErrorEnvelope(body);
        const hasLegacy = hasLegacyErrorEnvelope(body);
        if (!hasStandard && !hasLegacy) {
          warnings.push(`${probe.method} ${probe.path} [${status}] — error response missing standard envelope`);
        }
      }

      console.log(`   OK   ${status}  ${probe.method} ${probe.path}  (${probe.description})`);
      pass++;
    }
  } else {
    warnings.push("Authenticated write probes skipped because API_SMOKE_BEARER_TOKEN is not set.");
  }

  // ─── Backend admin probe: project synthesizer query-path guard ──────────────
  // Hits the FastAPI backend (not the Next.js app) with the admin key. Validates
  // the document_metadata SELECT runs cleanly without triggering gpt-5.5
  // extraction (far-future `since` → zero matched docs).
  if (ADMIN_API_KEY) {
    const probePath = "/api/intelligence/project-synthesize";
    const description = "Project synthesizer query path (empty window — no extraction)";
    const url = `${BACKEND_URL}${probePath}`;
    let status = 0;
    let body = null;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-admin-api-key": ADMIN_API_KEY,
          "Content-Type": "application/json",
        },
        // Far-future `since` guarantees the SELECT matches zero rows → docs_seen=0
        // and no LLM extraction runs. A malformed SELECT still raises → 500.
        body: JSON.stringify({
          project_id: Number(PROJECT_ID),
          since: "2999-01-01T00:00:00Z",
          max_docs: 1,
          dry_run: true,
        }),
        signal: AbortSignal.timeout(30000),
      });
      status = res.status;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
    } catch {
      status = 0;
    }

    if (status === 500 || status === 0) {
      const label = status === 0 ? "TIMEOUT" : "500";
      console.error(`  FAIL  ${label}  POST ${probePath}  (${description})`);
      // A 500 here is exactly the regression we are guarding: a malformed
      // document_metadata SELECT (missing/renamed column) must not pass.
      failures.push(`${label}: POST ${probePath} — ${description}`);
    } else if (status !== 200) {
      console.error(`  FAIL  ${status}  POST ${probePath}  expected [200]  (${description})`);
      failures.push(`Unexpected ${status}: POST ${probePath} — ${description} (expected [200])`);
    } else if (!assertSynthesizeEmptyBody(body)) {
      console.error(`  FAIL  200  POST ${probePath}  synthesize body shape mismatch`);
      failures.push(
        `Project synthesize body contract failed: expected docs_seen=0, empty errors[], ` +
          `and full result envelope — got ${JSON.stringify(body)}`,
      );
    } else {
      console.log(`   OK   ${status}  POST ${probePath}  (${description})`);
      pass++;
    }
  } else {
    warnings.push("Project synthesizer backend probe skipped because ADMIN_API_KEY is not set.");
  }

  // ─── Backend admin-key acceptance probe: schedule PDF extract ───────────────
  // Guards the exact incident that motivated this check: ADMIN_API_KEY was set
  // to "" in every Vercel env AND missing from the Render backend, so the only
  // symptom was a runtime-only 503 "ADMIN_API_KEY is not configured" when a user
  // tried to import a schedule PDF.
  //
  // We send the configured ADMIN_API_KEY to the real extract endpoint with no
  // file body. A correctly-configured backend rejects the *request* (missing
  // file → 400/422) but must NOT reject the *key*: a 503 means the backend has
  // no ADMIN_API_KEY configured, and a 401/403 means the key we hold does not
  // match the backend's. Any of those means schedule PDF import is broken in
  // production even though the var "looks" set.
  if (ADMIN_API_KEY) {
    const probePath = `/api/scheduling/schedule-pdf/extract?project_id=${PROJECT_ID}`;
    const description = "Schedule PDF extract — backend accepts ADMIN_API_KEY (not 503/401/403)";
    const url = `${BACKEND_URL}${probePath}`;
    let status = 0;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-admin-api-key": ADMIN_API_KEY },
        signal: AbortSignal.timeout(15000),
      });
      status = res.status;
      await res.text().catch(() => "");
    } catch {
      status = 0;
    }

    const keyRejectedStatuses = [401, 403, 503];
    if (status === 0) {
      console.error(`  FAIL  TIMEOUT  POST ${probePath}  (${description})`);
      failures.push(`TIMEOUT: POST ${probePath} — ${description}`);
    } else if (keyRejectedStatuses.includes(status)) {
      console.error(`  FAIL  ${status}  POST ${probePath}  (${description})`);
      failures.push(
        `Backend rejected ADMIN_API_KEY (${status}): POST ${probePath} — ${description}. ` +
          `503 = key missing on backend; 401/403 = frontend/backend key mismatch.`,
      );
    } else {
      // 400/422 (missing file) or any non-rejection status proves the key was accepted.
      console.log(`   OK   ${status}  POST ${probePath}  (${description})`);
      pass++;
    }
  } else {
    warnings.push("Schedule PDF extract admin-key probe skipped because ADMIN_API_KEY is not set.");
  }

  // Summary
  console.log(`\n─── Results ───`);
  console.log(`Pass: ${pass}  Fail: ${failures.length}  Warn: ${warnings.length}  Total: ${total}`);

  if (warnings.length > 0) {
    console.warn("\nWarnings (non-blocking):");
    for (const w of warnings) console.warn(`  - ${w}`);
  }

  if (failures.length > 0) {
    console.error(`\nFailures:`);
    for (const f of failures) console.error(`  - ${f}`);

    if (ERROR_ALERT_WEBHOOK_URL) {
      await sendAlert({
        severity: "high",
        error_code: "SMOKE_CONTRACT_FAILURE",
        error_message: `API smoke test: ${failures.length} endpoint(s) failed.`,
        where_it_failed: "scripts/api-smoke-contracts.mjs",
        timestamp,
        details: { base_url: BASE_URL, failure_count: failures.length, failures },
      });
    }

    process.exit(1);
  }

  console.log("\nAll endpoints healthy.");
}

async function sendAlert(payload) {
  try {
    const res = await fetch(ERROR_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Alert webhook failed: ${res.status}`);
    }
  } catch (err_) {
    console.error("Alert webhook error:", err_ instanceof Error ? err_.message : String(err_));
  }
}

run().catch((err) => {
  console.error("Smoke suite crashed:", err);
  process.exit(1);
});
