"use client";

import * as React from "react";

import { ArrowRight } from "lucide-react";

interface ManifestState {
  description?: string;
  columns?: Array<{ label: string }>;
  columnGroups?: Array<{ label: string; columns?: Array<{ label: string }> }>;
  formSections?: Array<{ title?: string; fields?: Array<{ label: string; type?: string; description?: string; required?: boolean }> }>;
  toolbarActions?: Array<{ label: string; type?: string }>;
  filters?: Array<{ label: string; type?: string }>;
  rowActions?: Array<{ label: string }>;
  tabs?: Array<{ label: string }>;
  headerFields?: Array<{ label: string; value?: string }>;
}

interface SpecData {
  feature: string;
  tool: {
    name: string;
    slug: string;
    description: string | null;
    procore_workflow: string | null;
    prp_path: string | null;
    status: string;
    category: string;
  } | null;
  manifestStates: Record<string, ManifestState>;
  prpSummary: string | null;
}

interface Props {
  feature: string | null;
}

function Pill({ label, variant = "default" }: { label: string; variant?: "default" | "action" | "filter" | "tab" }) {
  const colors: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    action: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    filter: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    tab: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[variant]}`}>
      {label}
    </span>
  );
}

function StateBlock({ id, state }: { id: string; state: ManifestState }) {
  const hasColumns = (state.columns ?? []).length > 0 || (state.columnGroups ?? []).length > 0;
  const hasActions = (state.toolbarActions ?? []).length > 0;
  const hasFilters = (state.filters ?? []).length > 0;
  const hasForm = (state.formSections ?? []).length > 0;
  const hasTabs = (state.tabs ?? []).length > 0;
  const hasRows = (state.rowActions ?? []).length > 0;

  return (
    <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground capitalize">
        {state.description ?? id.replace(/-/g, " ")}
      </p>

      {hasTabs && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Tabs</p>
          <div className="flex flex-wrap gap-1">
            {(state.tabs ?? []).map((t) => <Pill key={t.label} label={t.label} variant="tab" />)}
          </div>
        </div>
      )}

      {hasColumns && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Columns</p>
          <div className="flex flex-wrap gap-1">
            {(state.columnGroups ?? []).flatMap((g) =>
              (g.columns ?? []).map((c) => <Pill key={`${g.label}-${c.label}`} label={c.label} />)
            )}
            {(state.columns ?? []).map((c) => <Pill key={c.label} label={c.label} />)}
          </div>
        </div>
      )}

      {hasActions && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Toolbar Actions</p>
          <div className="flex flex-wrap gap-1">
            {(state.toolbarActions ?? []).map((a) => <Pill key={a.label} label={a.label} variant="action" />)}
          </div>
        </div>
      )}

      {hasFilters && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Filters</p>
          <div className="flex flex-wrap gap-1">
            {(state.filters ?? []).map((f) => <Pill key={f.label} label={f.label} variant="filter" />)}
          </div>
        </div>
      )}

      {hasRows && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Row Actions</p>
          <div className="flex flex-wrap gap-1">
            {(state.rowActions ?? []).map((r) => <Pill key={r.label} label={r.label} variant="action" />)}
          </div>
        </div>
      )}

      {hasForm && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Form Fields</p>
          <div className="space-y-2">
            {(state.formSections ?? []).map((section) => (
              <div key={section.title ?? "default"}>
                {section.title && (
                  <p className="text-[10px] text-muted-foreground/70 italic mb-1">{section.title}</p>
                )}
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="pb-1 pr-3 text-left font-medium text-muted-foreground">Name</th>
                      <th className="pb-1 pr-3 text-left font-medium text-muted-foreground">Type</th>
                      <th className="pb-1 pr-3 text-left font-medium text-muted-foreground">Description</th>
                      <th className="pb-1 text-left font-medium text-muted-foreground">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(section.fields ?? []).map((f) => (
                      <tr key={f.label} className="border-b border-border/20 last:border-0">
                        <td className="py-1 pr-3 font-medium text-foreground">{f.label}</td>
                        <td className="py-1 pr-3 text-muted-foreground">{f.type ?? "—"}</td>
                        <td className="py-1 pr-3 text-muted-foreground">{f.description ?? "—"}</td>
                        <td className="py-1 text-muted-foreground">
                          {f.required === true ? "Required" : f.required === false ? "Optional" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SpecTab({ feature }: Props) {
  const [data, setData] = React.useState<SpecData | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!feature) return;
    setLoading(true);
    fetch(`/api/dev-panel/spec/${feature}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [feature]);

  if (loading) return <Empty>Loading spec…</Empty>;
  if (!feature || !data) return <Empty>No spec available for this page.</Empty>;
  if (!data.tool && Object.keys(data.manifestStates).length === 0) {
    return <Empty>No spec found for {feature.replace(/-/g, " ")}.</Empty>;
  }

  const states = Object.entries(data.manifestStates);

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Left: tool summary */}
      <div className="w-56 shrink-0 overflow-y-auto border-r border-border/50 p-4 space-y-4">
        {data.tool ? (
          <>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Tool</p>
              <p className="text-sm font-semibold text-foreground">{data.tool.name}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(data.tool.status)}`}>
                {data.tool.status}
              </span>
            </div>
            {data.tool.category && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Category</p>
                <p className="text-xs text-foreground/80">{data.tool.category}</p>
              </div>
            )}
            {data.tool.description && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{data.tool.description}</p>
              </div>
            )}
            {data.tool.prp_path && (
              <a
                href={`/api/dev-panel/spec/${feature}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <ArrowRight className="h-3 w-3" /> View full PRP
              </a>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No tool record in database for &ldquo;{feature}&rdquo;.</p>
        )}
      </div>

      {/* Right: manifest states */}
      <div className="flex-1 overflow-y-auto p-4">
        {states.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Procore Views ({states.length})
            </p>
            {states.map(([id, state]) => (
              <StateBlock key={id} id={id} state={state} />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No manifest data. Run a Procore crawl to capture view details.
          </div>
        )}
      </div>
    </div>
  );
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s === "complete" || s === "done") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (s === "in_progress" || s === "in progress") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (s === "planned") return "bg-muted text-muted-foreground";
  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
