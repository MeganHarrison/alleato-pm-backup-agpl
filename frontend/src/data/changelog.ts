// AUTO-MANAGED CHANGELOG DATA — single source of truth for the /updates page.
//
// To add a release: from frontend/, run
//   npm run changelog:draft -- <version> <since-date>
// e.g. npm run changelog:draft -- 1.12.0 2026-06-27
// Paste the printed draft block at the TOP of RELEASES below, curate the wording into
// user-facing language, then move the "Latest" label from the previous release to the
// new one. Entries should describe what changed for a user, not the commit message.

export type UpdateType = "new" | "improved" | "fixed" | "coming-soon";
export type UpdateArea =
  | "ai"
  | "financial"
  | "operations"
  | "ui"
  | "infrastructure"
  | "integrations"
  | "security";

export interface UpdateEntry {
  type: UpdateType;
  area: UpdateArea;
  title: string;
  description: string;
}

export interface Release {
  version: string;
  date: string;
  label?: string;
  entries: UpdateEntry[];
}

export const RELEASES: Release[] = [
  {
    version: "1.11.0",
    date: "Jun 27, 2026",
    label: "Latest",
    entries: [
      {
        type: "new",
        area: "ai",
        title: "AI Learning Loops",
        description:
          "Thumbs-up/down feedback on AI chat, submittal reviews, the executive brief, and progress reports now feeds back into future output. Corrections are stored as surface-scoped learnings and injected into the relevant generator so the assistant gets sharper over time.",
      },
      {
        type: "new",
        area: "ai",
        title: "Autonomous Feedback Triage",
        description:
          "Stuck learning candidates are now triaged automatically on a schedule, so feedback turns into applied improvements without manual review.",
      },
      {
        type: "new",
        area: "operations",
        title: "Project Documents Browser",
        description:
          "A Dropbox-style resizable document browser with real file previews — PDF first pages, image thumbnails, and Office files (Word via docx-preview, Excel via SheetJS) rendered in the grid — plus a smart-group rail and click-to-preview pane.",
      },
      {
        type: "new",
        area: "ai",
        title: "Submittal AI Review",
        description:
          "Submittals are automatically matched against project drawings and reviewed by AI — no manual linking required. Results persist across refreshes and tab switches.",
      },
      {
        type: "improved",
        area: "operations",
        title: "Submittals — Detail Page Redesign",
        description:
          "The submittal detail page now mirrors Prime Contracts: DetailPanel sections, full field parity with the form, inline editing, a Communications tab, and an aligned workflow sidebar.",
      },
      {
        type: "new",
        area: "ai",
        title: "Drawing Intelligence",
        description:
          "Drawings flow through an OCR → embedding pipeline, and an AI tool surfaces the submittal packages a drawing set requires. Includes a new Fabric.js annotation viewer.",
      },
      {
        type: "new",
        area: "operations",
        title: "RFI Subcontractor Response System",
        description:
          "Subcontractors can respond to RFIs without an account via magic link or by replying to an Alleato-branded email. Responses are ingested automatically by a cron and all participants are notified on updates.",
      },
      {
        type: "improved",
        area: "ai",
        title: "Executive Daily Brief",
        description:
          "The CEO daily brief now runs the full synthesis pipeline every time, adding a financial pulse layer, change-order exposure, and deduplicated, source-cited action items.",
      },
      {
        type: "fixed",
        area: "security",
        title: "Authentication Hardening",
        description:
          "Migrated 385 API routes to a shared auth seam, ending a session-revocation race that could log users out during parallel requests. Added a guard so password resets can't overwrite the wrong account.",
      },
      {
        type: "new",
        area: "operations",
        title: "Teams Messages Inbox",
        description:
          "A split-screen reader for Microsoft Teams conversations, reading live from the source rather than a synced copy.",
      },
    ],
  },
  {
    version: "1.10.0",
    date: "May 28, 2026",
    entries: [
      {
        type: "new",
        area: "integrations",
        title: "Microsoft Teams Bot",
        description:
          "A full Teams bot with proactive direct messages, daily brief delivery, a sendTeamsMessage AI tool, message chunking, and a persistent session per thread.",
      },
      {
        type: "new",
        area: "operations",
        title: "Product Feature Board",
        description:
          "A Trello-style kanban board for feature requests — inline card creation, named labels, due dates, cover images, assignees, a table view, and add-from-AI-chat.",
      },
      {
        type: "new",
        area: "ai",
        title: "Email & Task Intelligence Pipeline",
        description:
          "Outlook ingestion with multi-layer spam/noise filtering, a task-extraction cron, feedback-trained task creation with few-shot examples, and an email inbox with intake, assigned, review, and attachments tabs.",
      },
      {
        type: "new",
        area: "operations",
        title: "Unified Document Architecture",
        description:
          "Every entity now shares a single document store via junction tables and a common picker, backed by a document-type taxonomy. One way to attach, find, and embed files across the app.",
      },
      {
        type: "improved",
        area: "ai",
        title: "Project Intelligence — Pipeline B",
        description:
          "Rebuilt project synthesis with rolling-state and portfolio layers, timeline cards, sentiment and initiative card types, and a calendar read tool. AI tools, pages, and routes migrated to the new pipeline.",
      },
      {
        type: "new",
        area: "operations",
        title: "Project Timeline",
        description:
          "A chronological feed of project events with expandable items, kind labels, and markdown rendering.",
      },
      {
        type: "new",
        area: "infrastructure",
        title: "AI System Health Dashboard",
        description:
          "Model-aware cost pricing plus provider quota and auth canaries that page Teams when an AI provider goes down — so silent AI outages surface immediately.",
      },
      {
        type: "improved",
        area: "ui",
        title: "Zero-Config Tables",
        description:
          "UnifiedTablePage now handles sorting, pagination, CSV export, bulk delete with confirmation, and column-visibility persistence internally — no extra wiring required.",
      },
      {
        type: "new",
        area: "infrastructure",
        title: "Database Inventory",
        description:
          "A live table catalog at Admin → Database Inventory, backed by a tables.yaml source of truth and a CI drift gate that blocks schema changes from going undocumented.",
      },
    ],
  },
  {
    version: "1.9.0",
    date: "Apr 30, 2026",
    entries: [
      {
        type: "new",
        area: "financial",
        title: "Invoicing — Procore Parity",
        description:
          "Full invoicing with Schedule of Values, subcontractor invoices, payments, manual/automatic billing periods, and PDF/email delivery.",
      },
      {
        type: "new",
        area: "financial",
        title: "Retainage Billing",
        description:
          "Dollar-amount and percentage retainage with auto-calculation on both owner and subcontractor invoices, plus bulk Set Retainage and Release All actions.",
      },
      {
        type: "improved",
        area: "financial",
        title: "Change Orders & PCO Workflow",
        description:
          "A two-tier commitment change order flow (change event straight to commitment change order), prime contract PCO sections, and Procore-parity fields throughout.",
      },
      {
        type: "improved",
        area: "operations",
        title: "Unified Directory",
        description:
          "Consolidated the separate vendors table into companies — a single directory model used across API routes, hooks, pages, and the Acumatica sync.",
      },
      {
        type: "new",
        area: "security",
        title: "Permissions System",
        description:
          "Module-level permission templates, a Senior PM role, company-wide access, a project admin panel with member overrides, and an audit log.",
      },
      {
        type: "new",
        area: "integrations",
        title: "Acumatica Accounting Mirror",
        description:
          "A mirror sync engine with an accounting dashboard and a scheduled sync endpoint to keep financial data aligned with Acumatica ERP.",
      },
      {
        type: "new",
        area: "ui",
        title: "Design System & Storybook",
        description:
          "Comprehensive Storybook coverage, stricter ESLint rules (raw headings now a build error), and loading skeletons plus error boundaries on every route.",
      },
      {
        type: "new",
        area: "infrastructure",
        title: "API Guardrails Rollout",
        description:
          "Nearly 400 API routes moved onto a shared guardrails wrapper, with predeploy and postdeploy gates and an expanded smoke-test suite to catch endpoint regressions.",
      },
      {
        type: "new",
        area: "operations",
        title: "In-App Testing Framework",
        description:
          "Test matrices for every tool, an end-to-end Project Lifecycle suite, a results-history view with per-run drill-down, and feedback-inbox integration.",
      },
    ],
  },
  {
    version: "1.8.0",
    date: "Mar 13, 2026",
    entries: [
      {
        type: "new",
        area: "ai",
        title: "AI Memory System",
        description:
          "Alleato AI now remembers context across sessions. Preferences, project facts, lessons, and commitments are stored as typed memories with pgvector embeddings, automatically surfaced in each conversation.",
      },
      {
        type: "new",
        area: "ai",
        title: "Soul & Identity Layers",
        description:
          "The AI assistant now has a distinct voice and self-concept — direct, specific, and fluent in construction PM. Personality is separated from operational instructions for independent evolution.",
      },
      {
        type: "new",
        area: "ai",
        title: "Memory Admin UI",
        description:
          "View, edit, and delete everything the AI remembers about you in Settings → AI → Memory. Inline editing with importance sliders and type filtering.",
      },
      {
        type: "new",
        area: "ai",
        title: "Post-Conversation Memory Extraction",
        description:
          "After each AI session, GPT-4.1-nano analyzes the transcript and extracts up to 5 durable memories — zero user-facing latency via Next.js after() hook.",
      },
      {
        type: "new",
        area: "ai",
        title: "Meeting-Triggered Memory Extraction",
        description:
          "When a meeting is ingested via Fireflies, the pipeline extracts team-visible facts, lessons, and commitments automatically and stores them for the whole team.",
      },
      {
        type: "new",
        area: "ai",
        title: "Memory Deduplication",
        description:
          "Duplicate memories are prevented via similarity-threshold RPC (0.88 cosine). When a near-duplicate is found, the existing memory is updated rather than creating a new one.",
      },
      {
        type: "new",
        area: "ai",
        title: "Commitment → Action Item Bridge",
        description:
          "Commitment-type memories automatically create action items in AI Insights so nothing falls through the cracks.",
      },
      {
        type: "new",
        area: "infrastructure",
        title: "Confidence Decay Cron",
        description:
          "A weekly cron (Sundays 4am) decays importance and confidence on stale, rarely-accessed memories — preventing the AI from giving outdated context undue weight.",
      },
    ],
  },
  {
    version: "1.7.0",
    date: "Mar 5, 2026",
    entries: [
      {
        type: "new",
        area: "ai",
        title: "Council Mode (C-Suite AI Panel)",
        description:
          "Engage multiple AI personas simultaneously — CFO, COO, CRO, CHRO, VP BD — for multi-angle analysis on any project decision.",
      },
      {
        type: "new",
        area: "ai",
        title: "Company Knowledge Base",
        description:
          "Upload SOPs, templates, and company docs. The AI retrieves relevant internal knowledge as context during conversations.",
      },
      {
        type: "new",
        area: "ai",
        title: "AI Strategist",
        description:
          "A dedicated AI assistant page with conversation history, suggested prompts, and full access to project and financial data via tool calls.",
      },
      {
        type: "improved",
        area: "ai",
        title: "RAG Tool Expansion",
        description:
          "Added 7 new RAG tools: budget analysis, change event tracking, commitment lookup, schedule risk, RFI aging, punchlist status, and subcontractor performance.",
      },
      {
        type: "new",
        area: "operations",
        title: "Meetings — Company-Wide View",
        description:
          "View all meetings across projects from a single table. Filter by project, host, or date range.",
      },
      {
        type: "improved",
        area: "ui",
        title: "Sidebar Navigation Overhaul",
        description:
          "Grouped navigation with Financial, Operations, Company, and Admin sections. Icon-based collapsed mode with hover tooltips.",
      },
      {
        type: "fixed",
        area: "infrastructure",
        title: "Vercel Build — Deep Type Instantiation Errors",
        description:
          "Resolved TypeScript errors from excessively deep type instantiation in retired collaboration-demo components that were blocking production deploys.",
      },
    ],
  },
  {
    version: "1.6.0",
    date: "Feb 20, 2026",
    entries: [
      {
        type: "new",
        area: "operations",
        title: "Estimates Module",
        description:
          "Create and manage project estimates with line items, trade breakdowns, and PDF export. Estimates can be linked to projects and versioned.",
      },
      {
        type: "new",
        area: "operations",
        title: "Prospects Pipeline",
        description:
          "Track potential projects from lead to bid with a Kanban-style pipeline, contact associations, and probability weighting.",
      },
      {
        type: "new",
        area: "operations",
        title: "Company-Wide Task Board",
        description:
          "Tasks across all projects aggregated into a single board. Assignee filtering, due date tracking, and priority levels.",
      },
      {
        type: "improved",
        area: "financial",
        title: "Budget — Unified Table Page",
        description:
          "Budget migrated to the UnifiedTablePage component. Column visibility toggles, search, CSV export, and inline status editing.",
      },
      {
        type: "improved",
        area: "financial",
        title: "Direct Costs — Form Stability",
        description:
          "Fixed DirectCostForm hanging on creation. Resolved race condition in cost code lookup that caused the submit handler to silently fail.",
      },
      {
        type: "fixed",
        area: "operations",
        title: "Sidebar Links — No Project Selected",
        description:
          "Sidebar links no longer 404 when no project is selected. Company-level routes now resolve correctly without a projectId segment.",
      },
    ],
  },
  {
    version: "1.5.0",
    date: "Feb 5, 2026",
    entries: [
      {
        type: "new",
        area: "integrations",
        title: "Fireflies Meeting Ingestion",
        description:
          "Automatic ingestion of Fireflies.ai meeting transcripts. Speaker diarization, topic extraction, and action item detection run post-ingestion.",
      },
      {
        type: "new",
        area: "integrations",
        title: "Acumatica Accounting Integration",
        description:
          "Connect Acumatica ERP for two-way financial sync. Invoices, commitments, and change orders flow between systems. Cookie-based auth with persistent sessions.",
      },
      {
        type: "new",
        area: "ai",
        title: "Daily Digest",
        description:
          "Automated daily summary delivered to the AI Strategist each morning — overdue items, budget alerts, upcoming milestones, and open RFIs.",
      },
      {
        type: "improved",
        area: "financial",
        title: "Prime Contracts — API Routes",
        description:
          "Built full CRUD API layer for Prime Contracts (previously 0 API routes). Create, read, update, delete now all functional with RLS-secured endpoints.",
      },
      {
        type: "improved",
        area: "financial",
        title: "Invoicing — Table Migration",
        description:
          "Invoicing migrated from deprecated DataTablePage to UnifiedTablePage for consistency with other financial tools.",
      },
      {
        type: "improved",
        area: "financial",
        title: "Change Events & Change Orders",
        description:
          "Linked change events to change orders with approval workflow. Status transitions enforced at the API layer.",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "Jan 15, 2026",
    entries: [
      {
        type: "new",
        area: "ui",
        title: "Design System — Token Enforcement",
        description:
          "ESLint rules now enforce design system compliance as build errors: no hardcoded colors, no arbitrary spacing, semantic token requirements. Prevents visual drift across the app.",
      },
      {
        type: "new",
        area: "ui",
        title: "Unified Table Page Component",
        description:
          "Shared table infrastructure for all financial tools — consistent search, column visibility, export, and toolbar patterns across Budget, Commitments, Change Orders, and more.",
      },
      {
        type: "new",
        area: "security",
        title: "Row-Level Security Rollout",
        description:
          "RLS policies applied to all core tables. Users can only access data within their workspace. Service-role bypass for background jobs.",
      },
      {
        type: "improved",
        area: "operations",
        title: "Schedule — Gantt View",
        description:
          "Timeline Gantt view for project schedule. Task dependencies rendered as arrows, critical path highlighted, drag-to-reschedule support.",
      },
      {
        type: "new",
        area: "infrastructure",
        title: "Supabase Types Gate",
        description:
          "Automated type generation from live schema (npm run db:types) enforced before any database work. Prevents FK type mismatches and missing column errors.",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "Dec 10, 2025",
    entries: [
      {
        type: "new",
        area: "operations",
        title: "RFIs & Submittals",
        description:
          "Full RFI workflow with question/answer threading, due dates, ball-in-court tracking, and Procore sync. Submittals with revision tracking and approval chains.",
      },
      {
        type: "new",
        area: "operations",
        title: "Punch List",
        description:
          "Create, assign, and close punch list items with photo attachments, location tagging, and trade categorization.",
      },
      {
        type: "new",
        area: "financial",
        title: "Commitments — Subcontract & PO Management",
        description:
          "Manage subcontracts and purchase orders with line items, retention tracking, and change order linkage. Approval workflow with status gating.",
      },
      {
        type: "improved",
        area: "ui",
        title: "Project Home Dashboard",
        description:
          "Redesigned project home with KPI blocks, budget health indicator, schedule status, and open items summary. Data-driven from live project state.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "Nov 1, 2025",
    entries: [
      {
        type: "new",
        area: "financial",
        title: "Budget Module",
        description:
          "Project budget with line items, cost codes, budget vs. actual tracking, and SOV management. Integrated with commitments and change events for real-time variance.",
      },
      {
        type: "new",
        area: "operations",
        title: "Project Directory",
        description:
          "Company and contact management at the project level. Role assignments, vendor categories, insurance tracking.",
      },
      {
        type: "new",
        area: "operations",
        title: "Document Management",
        description:
          "Project document storage with folder structure, version history, and permission-based access. PDF preview and bulk download.",
      },
      {
        type: "new",
        area: "infrastructure",
        title: "Multi-Project Architecture",
        description:
          "Platform rebuilt around multi-project support with project-scoped routing (/[projectId]/tool), permission modules, and per-project RLS.",
      },
    ],
  },
];
