"use client";
/* eslint-disable design-system/no-raw-heading */

import * as React from "react";
import { Database, ArrowRight, FileText, LayoutList } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { appRouteForState, stateLabel } from "@/lib/procore-route-map";

// ---------------------------------------------------------------------------
// Supabase table mapping — tool slug → relevant tables
// ---------------------------------------------------------------------------

const TOOL_TABLES: Record<string, string[]> = {
  "prime-contracts": [
    "prime_contracts",
    "prime_contract_change_orders",
    "prime_contract_payment_applications",
    "prime_contract_payments",
    "prime_contract_sovs",
    "prime_contract_financial_summary",
    "contract_line_items",
    "sov_line_items",
    "contract_billing_periods",
  ],
  "change-events": [
    "change_events",
    "change_event_line_items",
    "change_event_rfqs",
    "change_event_rfq_responses",
    "change_event_approvals",
    "change_event_documents",
    "change_event_history",
    "change_events_summary",
  ],
  "change-orders": [
    "change_orders",
    "potential_change_orders",
    "pco_line_items",
    "pco_versions",
    "pcco_line_items",
    "prime_contract_change_orders",
    "commitment_change_order_lines",
  ],
  commitments: [
    "commitments_unified",
    "subcontracts",
    "subcontracts_with_totals",
    "purchase_orders",
    "purchase_orders_with_totals",
    "subcontract_sov_items",
    "purchase_order_sov_items",
    "schedule_of_values",
    "sov_line_items",
  ],
  budget: [
    "budget_lines",
    "budget_modifications",
    "budget_modification_lines",
    "budget_line_forecasts",
    "budget_line_history",
    "budget_snapshots",
    "budget_views",
    "budget_view_columns",
    "project_budget_codes",
  ],
  invoicing: [
    "owner_invoices",
    "owner_invoice_line_items",
    "payment_application_line_items",
    "billing_periods",
    "contract_billing_periods",
    "payment_transactions",
    "billing_invitations",
  ],
  "direct-costs": [
    "direct_costs",
    "direct_cost_line_items",
    "direct_costs_with_project",
  ],
  drawings: [
    "drawings",
    "drawing_revisions",
    "drawing_sets",
    "drawing_areas",
    "drawing_log",
    "drawing_markup_pins",
    "drawing_related_items",
  ],
  rfis: [
    "rfis",
    "rfi_assignees",
    "distribution_groups",
    "distribution_group_members",
  ],
  submittals: [
    "submittals",
    "submittal_doc_links",
    "submittal_workflow_steps",
    "submittal_distributions",
    "submittal_packages",
    "submittal_responses",
    "submittal_history",
  ],
  commitments_purchase_orders: ["purchase_orders", "purchase_orders_with_totals", "purchase_order_sov_items"],
  directory: ["people", "companies", "project_companies", "vendors"],
  "daily-log": ["daily_logs", "daily_log_notes", "daily_log_manpower", "daily_log_equipment"],
  photos: ["photos", "photo_albums", "photo_links", "project_photos"],
  documents: ["documents", "document_metadata", "document_chunks", "files", "project_documents_v2"],
  punch_list: ["punch_items", "punch_item_templates", "punch_item_template_categories", "observation_types"],
  specifications: [
    "specifications",
    "specification_sections",
    "specification_section_revisions",
    "specification_divisions",
    "specification_areas",
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManifestField { label: string; type?: string }
interface ManifestFormSection { title?: string; fields?: ManifestField[] }

interface ManifestState {
  id: string;
  description?: string;
  screenshot?: string;
  tabs?: Array<{ label: string }>;
  toolbarActions?: Array<{ label: string; type?: string }>;
  filters?: ManifestField[];
  rowActions?: Array<{ label: string }>;
  columns?: Array<{ label: string }>;
  columnGroups?: Array<{ label: string; columns?: Array<{ label: string }> }>;
  formSections?: ManifestFormSection[];
}

interface SpecData {
  feature: string;
  tool: {
    name: string;
    description: string | null;
    status: string;
    category: string;
  } | null;
  manifestStates: Record<string, ManifestState>;
}

// ---------------------------------------------------------------------------
// Pill helpers
// ---------------------------------------------------------------------------

type PillVariant = "tab" | "action" | "filter" | "column" | "field" | "table";

const PILL_COLORS: Record<PillVariant, string> = {
  tab:    "bg-teal-50 text-teal-700 border border-teal-100",
  action: "bg-blue-50 text-blue-700 border border-blue-100",
  filter: "bg-purple-50 text-purple-700 border border-purple-100",
  column: "bg-muted text-muted-foreground border border-border/50",
  field:  "bg-amber-50 text-amber-700 border border-amber-100",
  table:  "bg-primary/5 text-primary border border-primary/10 font-mono",
};

function Pill({ label, variant }: { label: string; variant: PillVariant }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${PILL_COLORS[variant]}`}>
      {label}
    </span>
  );
}

function PillGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

// Procore chrome noise to strip from toolbar actions
const TOOLBAR_NOISE = [
  "Alleato Group", "Project Tools", "CmdK", "AppsSelect",
  "Support & Feedback", "Announcements",
];
function isNoise(label: string) {
  return TOOLBAR_NOISE.some((n) => label.includes(n)) || label === "BC";
}

// ---------------------------------------------------------------------------
// Accordion page detail — screenshot left, spec right
// ---------------------------------------------------------------------------

function PageDetail({ state, feature }: { state: ManifestState; feature: string }) {
  const [imgError, setImgError] = React.useState(false);
  const imgSrc = `/api/procore-screenshots/${feature}/${state.id}.png`;

  const tabs       = state.tabs ?? [];
  const actions    = (state.toolbarActions ?? []).filter((a) => !isNoise(a.label));
  const filters    = state.filters ?? [];
  const rowActions = state.rowActions ?? [];
  const columns    = [
    ...(state.columnGroups ?? []).flatMap((g) => g.columns?.map((c) => c.label) ?? []),
    ...(state.columns ?? []).map((c) => c.label),
  ].filter((v, i, arr) => arr.indexOf(v) === i);
  const hasForms   = (state.formSections ?? []).some((s) => (s.fields ?? []).length > 0);

  const hasAnything = tabs.length || actions.length || filters.length ||
    rowActions.length || columns.length || hasForms;

  return (
    <div className="grid grid-cols-1 gap-6 pt-1 lg:grid-cols-2">
      {/* Screenshot */}
      <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/20">
        {imgError ? (
          <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
            Screenshot not available
          </div>
        ) : (
           
          <img
            src={imgSrc}
            alt={stateLabel(state.id)}
            className="w-full object-cover object-top"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
      </div>

      {/* Details */}
      <div className="space-y-4">
        {state.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {state.description}
          </p>
        )}

        {!hasAnything && (
          <p className="text-xs italic text-muted-foreground">
            No spec details captured for this view.
          </p>
        )}

        {tabs.length > 0 && (
          <PillGroup title="Tabs">
            {tabs.map((t) => <Pill key={t.label} label={t.label} variant="tab" />)}
          </PillGroup>
        )}

        {actions.length > 0 && (
          <PillGroup title="Action buttons">
            {actions.map((a) => <Pill key={a.label} label={a.label} variant="action" />)}
          </PillGroup>
        )}

        {filters.length > 0 && (
          <PillGroup title="Filters">
            {filters.map((f) => <Pill key={f.label} label={f.label} variant="filter" />)}
          </PillGroup>
        )}

        {rowActions.length > 0 && (
          <PillGroup title="Row actions">
            {rowActions.map((r) => <Pill key={r.label} label={r.label} variant="action" />)}
          </PillGroup>
        )}

        {columns.length > 0 && (
          <PillGroup title="Table columns">
            {columns.map((c) => <Pill key={c} label={c} variant="column" />)}
          </PillGroup>
        )}

        {hasForms && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Form fields
            </p>
            <div className="space-y-2">
              {(state.formSections ?? []).map((section, si) => {
                const fields = section.fields ?? [];
                if (!fields.length) return null;
                return (
                  <div key={section.title ?? si}>
                    {section.title && (
                      <p className="mb-1 text-[10px] italic text-muted-foreground/50">
                        {section.title}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {fields.map((f) => (
                        <Pill
                          key={f.label}
                          label={f.type ? `${f.label} (${f.type})` : f.label}
                          variant="field"
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OverviewTab({ feature }: { feature: string }) {
  const [data, setData] = React.useState<SpecData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lastProjectId, setLastProjectId] = React.useState<number | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem("last-project-id");
    if (stored && /^\d+$/.test(stored)) setLastProjectId(Number(stored));
  }, []);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/dev-panel/spec/${feature}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [feature]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-12 animate-pulse rounded-lg bg-muted" />
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const tool   = data?.tool ?? null;
  const states = Object.entries(data?.manifestStates ?? {});
  const tables = TOOL_TABLES[feature] ?? [];

  // Derive forms needed from states that have form sections
  const statesWithForms = states.filter(([, s]) =>
    (s.formSections ?? []).some((sec) => (sec.fields ?? []).length > 0)
  );

  return (
    <div className="space-y-10">
      {/* ── Description ── */}
      <div className="space-y-2">
        {tool?.description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {tool.description}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No description available for this tool.
          </p>
        )}
      </div>

      {/* ── Pages accordion ── */}
      {states.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <LayoutList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Pages &amp; Views
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({states.length})
              </span>
            </h2>
          </div>

          <Accordion type="multiple" className="space-y-1">
            {states.map(([id, state]) => (
              <AccordionItem
                key={id}
                value={id}
                className="rounded-lg border border-border/50 bg-background px-4"
              >
                <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
                  <div className="flex items-center gap-3 text-left min-w-0 flex-1">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    <span>{stateLabel(id)}</span>
                    {state.description && state.description !== stateLabel(id) && (
                      <span className="text-xs font-normal text-muted-foreground/60 truncate max-w-sm">
                        — {state.description}
                      </span>
                    )}
                    {(() => {
                      const route = appRouteForState(feature, id, lastProjectId);
                      if (!route) return null;
                      return (
                        <a
                          href={route}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-auto mr-2 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={lastProjectId ? `Open in app (project ${lastProjectId})` : "Open in app"}
                        >
                          <ArrowRight className="h-3 w-3" />
                          Open
                        </a>
                      );
                    })()}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <PageDetail state={state} feature={feature} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* ── Supabase tables ── */}
      {tables.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Supabase Tables
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({tables.length})
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <Pill key={t} label={t} variant="table" />
            ))}
          </div>
        </div>
      )}

      {/* ── Forms needed ── */}
      {statesWithForms.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Forms Required
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({statesWithForms.length})
              </span>
            </h2>
          </div>
          <div className="space-y-1">
            {statesWithForms.map(([id, state]) => {
              const fieldCount = (state.formSections ?? []).reduce(
                (sum, s) => sum + (s.fields?.length ?? 0), 0
              );
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-md border border-border/40 bg-muted/20 px-3 py-2"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="text-sm text-foreground">{stateLabel(id)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
