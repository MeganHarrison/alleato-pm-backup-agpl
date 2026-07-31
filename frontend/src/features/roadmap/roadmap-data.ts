// Alleato PM improvement roadmap — the master list of work.
//
// Two datasets power the /roadmap page:
//   - oneTimeItems: audits, fixes, builds, and bigger bets that happen once.
//   - ongoingItems: recurring maintenance, each with a cadence.
//
// This is intentionally a static, hand-maintained list for now (fast to read,
// sort, and group). It can later be promoted to a Supabase table for live
// status editing + reordering, or wired to the GitHub Issues backlog.

export type Priority = "P0" | "P1" | "P2" | "P3";
export type OneTimeCategory = "Audit" | "Fix" | "Build" | "Test" | "Improve" | "Bet";
export type Effort = "S" | "M" | "L";
export type WorkStatus = "Todo" | "In progress" | "Done";
export type Frequency = "Daily" | "Weekly" | "Monthly";

export interface OneTimeItem {
  id: string;
  title: string;
  category: OneTimeCategory;
  area: string;
  priority: Priority;
  effort: Effort;
  status: WorkStatus;
  /** GitHub issue number, when one already exists. */
  issue?: number;
}

export interface OngoingItem {
  id: string;
  task: string;
  frequency: Frequency;
  area: string;
  status: WorkStatus;
  issue?: number;
}

export const PRIORITY_RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
export const FREQUENCY_RANK: Record<Frequency, number> = { Daily: 0, Weekly: 1, Monthly: 2 };
export const EFFORT_RANK: Record<Effort, number> = { S: 0, M: 1, L: 2 };

export const oneTimeItems: OneTimeItem[] = [
  // P0 — unblock everything / active risk
  { id: "ot-ci", title: "Re-enable GitHub Actions / CI (billing lock)", category: "Fix", area: "Infra", priority: "P0", effort: "M", status: "Todo", issue: 736 },
  { id: "ot-linear-keys", title: "Rotate & purge leaked Linear keys committed to the repo", category: "Fix", area: "Security", priority: "P0", effort: "S", status: "Todo", issue: 727 },

  // P1 — high leverage / current risk
  { id: "ot-security-audit", title: "Security / RLS audit — policies, service-role usage, auth boundaries", category: "Audit", area: "Security", priority: "P1", effort: "L", status: "Todo" },
  { id: "ot-fk-audit", title: "Full FK ↔ form-dropdown mismatch audit (all forms)", category: "Audit", area: "Frontend", priority: "P1", effort: "M", status: "Todo" },
  { id: "ot-apifetch", title: "Fix apiFetch<T> null passthrough at the wrapper", category: "Fix", area: "Infra", priority: "P1", effort: "S", status: "Todo", issue: 726 },
  { id: "ot-typecheck", title: "Clear the ~70 typecheck errors (remove pre-push --no-verify)", category: "Fix", area: "Infra", priority: "P1", effort: "M", status: "Todo" },
  { id: "ot-radix-e2e", title: "Fix Radix Select E2E automation gap (~30 blocked tests)", category: "Test", area: "Testing", priority: "P1", effort: "M", status: "Todo", issue: 729 },
  { id: "ot-error-triage", title: "Triage the ~280 open error-tracker groups (batches of 10)", category: "Audit", area: "Quality", priority: "P1", effort: "L", status: "Todo", issue: 730 },
  { id: "ot-sov-dupes", title: "Fix duplicate SOV rows inflating Committed Costs (project 876)", category: "Fix", area: "Data", priority: "P1", effort: "S", status: "Todo", issue: 738 },
  { id: "ot-mislinked-invoices", title: "Re-attribute the 142 mis-linked invoices from SC-000316", category: "Fix", area: "Financial", priority: "P1", effort: "M", status: "Todo" },

  // P2 — important, not urgent
  { id: "ot-rename-registry", title: "Column-rename registry + CI gate (kills schema-rename drift)", category: "Build", area: "Infra", priority: "P2", effort: "M", status: "Todo", issue: 728 },
  { id: "ot-eslint-rules", title: "ESLint rules: error-message fidelity + PostgREST FK disambiguation", category: "Build", area: "Infra", priority: "P2", effort: "M", status: "Todo", issue: 731 },
  { id: "ot-ds-consistency", title: "Design-system consistency audit (whole repo)", category: "Audit", area: "Design", priority: "P2", effort: "M", status: "Todo" },
  { id: "ot-deadcode", title: "Dead-code audit (knip) — remove unused files/exports", category: "Audit", area: "Infra", priority: "P2", effort: "S", status: "Todo" },
  { id: "ot-bundle", title: "Bundle-size / performance audit (First-Load-JS budgets, N+1)", category: "Audit", area: "Frontend", priority: "P2", effort: "M", status: "Todo" },
  { id: "ot-a11y", title: "Accessibility audit (keyboard, contrast, labels)", category: "Audit", area: "Frontend", priority: "P2", effort: "M", status: "Todo" },
  { id: "ot-parity", title: "Procore parity audit per tool (/testing/parity)", category: "Audit", area: "Parity", priority: "P2", effort: "L", status: "Todo" },
  { id: "ot-coverage", title: "Test-coverage audit — untested critical paths (money, auth, writes)", category: "Audit", area: "Testing", priority: "P2", effort: "M", status: "Todo" },
  { id: "ot-detail-pages", title: "Finish the ~10 remaining detail pages to design-system standard", category: "Build", area: "Frontend", priority: "P2", effort: "L", status: "Todo" },
  { id: "ot-lowconf-ui", title: "Low-confidence attribution review UI (document_attribution_candidates)", category: "Build", area: "AI / RAG", priority: "P2", effort: "M", status: "Todo", issue: 735 },
  { id: "ot-azure-ocr", title: "Azure OCR activation + backfill 124 no_text files", category: "Build", area: "AI / RAG", priority: "P2", effort: "M", status: "Todo", issue: 732 },
  { id: "ot-deep-agents", title: "Deep Agents production validation + flag flip", category: "Test", area: "AI / RAG", priority: "P2", effort: "M", status: "Todo", issue: 733 },
  { id: "ot-estimates-seed", title: "Estimates tool seed data so its E2E can run", category: "Test", area: "Testing", priority: "P2", effort: "S", status: "Todo", issue: 734 },
  { id: "ot-prp-validate", title: "Run /prp-validate on the 7 financial tools", category: "Audit", area: "Parity", priority: "P2", effort: "M", status: "Todo", issue: 739 },
  { id: "ot-command-center", title: "Command Center page — Needs You / In Progress / Shipped, one glance", category: "Build", area: "Frontend", priority: "P2", effort: "M", status: "Todo" },

  // P3 — bigger bets / nice to have
  { id: "ot-meetings-ai", title: "Meetings tool AI phases 2–5 (already architected)", category: "Build", area: "AI / RAG", priority: "P3", effort: "L", status: "Todo" },
  { id: "ot-exec-intel", title: "Executive / financial intelligence polish (daily brief, risk surfacing)", category: "Bet", area: "AI / RAG", priority: "P3", effort: "L", status: "Todo" },
  { id: "ot-mobile", title: "Mobile ergonomics — approve/triage from your phone in a tap", category: "Bet", area: "Frontend", priority: "P3", effort: "M", status: "Todo" },
  { id: "ot-proactive-alerts", title: "Proactive alerting (overdue AR, over-committed contracts) before you look", category: "Bet", area: "AI / RAG", priority: "P3", effort: "M", status: "Todo" },
  { id: "ot-outlook-widget", title: "Wire Outlook inbox widget Project/Task actions to direct API calls", category: "Improve", area: "AI / RAG", priority: "P3", effort: "S", status: "Todo", issue: 737 },
  { id: "ot-generator", title: "The generator — auto-audit the app weekly and file new backlog items", category: "Build", area: "Infra", priority: "P3", effort: "M", status: "Todo" },
];

export const ongoingItems: OngoingItem[] = [
  // Daily
  { id: "og-assignment-inbox", task: "Triage the assignment inbox (unassigned meetings/emails/Teams/docs)", frequency: "Daily", area: "Attribution", status: "Todo" },
  { id: "og-deep-read", task: "Review the Daily Deep Read candidate queue (human gate)", frequency: "Daily", area: "Intelligence", status: "Todo" },
  { id: "og-errors-skim", task: "Skim new /errors groups for high-severity / high-volume issues", frequency: "Daily", area: "Quality", status: "Todo" },
  { id: "og-sync-health", task: "Sync health check (Graph/Teams/OneDrive cron; RAG embed backlog = 0)", frequency: "Daily", area: "Pipeline", status: "Todo" },
  { id: "og-deploy-health", task: "Deploy health glance (Vercel + Render green, no error spike)", frequency: "Daily", area: "Infra", status: "Todo" },

  // Weekly
  { id: "og-error-batch", task: "Triage a batch (~10) of the error-tracker backlog into issues", frequency: "Weekly", area: "Quality", status: "Todo", issue: 730 },
  { id: "og-feedback-inbox", task: "Client feedback inbox → convert to backlog issues", frequency: "Weekly", area: "Feedback", status: "Todo" },
  { id: "og-rag-health", task: "RAG health report (embedding coverage, stuck jobs, low-content skips)", frequency: "Weekly", area: "Pipeline", status: "Todo" },
  { id: "og-deps", task: "Dependency + security advisory check", frequency: "Weekly", area: "Security", status: "Todo" },
  { id: "og-acumatica", task: "Acumatica financial reconciliation spot-check (AR/CO drift, mis-links)", frequency: "Weekly", area: "Financial", status: "Todo" },

  // Monthly
  { id: "og-data-integrity", task: "Data-integrity sweep (duplicate rows, orphans, FK gaps)", frequency: "Monthly", area: "Data", status: "Todo" },
  { id: "og-ds-drift", task: "Design-system drift sweep (ui-audit / audit:consistency)", frequency: "Monthly", area: "Design", status: "Todo" },
  { id: "og-doc-freshness", task: "Doc freshness (PROJECT-MAP, TABLE-LIST, AI-RAG-ARCHITECTURE)", frequency: "Monthly", area: "Docs", status: "Todo" },
  { id: "og-e2e", task: "Playwright auth/session refresh + full E2E run", frequency: "Monthly", area: "Testing", status: "Todo" },
];

export function priorityVariant(priority: Priority): "error" | "orange" | "info" | "neutral" {
  switch (priority) {
    case "P0": return "error";
    case "P1": return "orange";
    case "P2": return "info";
    case "P3": return "neutral";
  }
}

export function frequencyVariant(frequency: Frequency): "info" | "purple" | "neutral" {
  switch (frequency) {
    case "Daily": return "info";
    case "Weekly": return "purple";
    case "Monthly": return "neutral";
  }
}

export function statusVariant(status: WorkStatus): "neutral" | "info" | "success" {
  switch (status) {
    case "Todo": return "neutral";
    case "In progress": return "info";
    case "Done": return "success";
  }
}
