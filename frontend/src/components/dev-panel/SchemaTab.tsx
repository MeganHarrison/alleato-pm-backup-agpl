"use client";

import * as React from "react";

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Globe,
  KeyRound,
  Link as LinkIcon,
  MapPin,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  findPageSchema,
  type TableSchema,
} from "@/components/dev-tools/page-schema-registry";

// ── FK Type Reference ──────────────────────────────────────────────────────────
const FK_TYPE_REFERENCE = [
  { table: "projects",  pk: "id: number (INTEGER)",  fk: "project_id" },
  { table: "people",    pk: "id: string (UUID)",      fk: "person_id" },
  { table: "vendors",   pk: "id: string (UUID)",      fk: "vendor_id" },
  { table: "companies", pk: "id: string (UUID)",      fk: "company_id" },
  { table: "users",     pk: "id: string (UUID)",      fk: "user_id" },
];

// ── CHECK Constraint Values ────────────────────────────────────────────────────
const CHECK_CONSTRAINTS: Record<string, string[]> = {
  "subcontracts.status":      ["Draft", "Sent", "Pending", "Approved", "Executed", "Closed", "Void"],
  "direct_costs.status":      ["Draft", "Approved", "Rejected", "Paid"],
  "direct_costs.cost_type":   ["Expense", "Invoice", "Subcontractor Invoice"],
  "change_orders.status":     ["draft", "pending", "approved", "rejected", "void"],
  "companies.status":         ["ACTIVE", "INACTIVE"],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
    POST:   "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
    PATCH:  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
    PUT:    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300",
    DELETE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold", colors[method] ?? "bg-muted text-muted-foreground")}>
      {method}
    </span>
  );
}

function TableAccordion({ table }: { table: TableSchema }) {
  const [open, setOpen] = React.useState(false);
  const fkCount = table.columns.filter((c) => c.fk).length;

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <Database className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-[11px] font-semibold">{table.name}</span>
          <span className="text-[10px] text-muted-foreground">({table.columns.length} cols{fkCount > 0 ? `, ${fkCount} FK` : ""})</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); copyToClipboard(table.name); }}
          title="Copy table name"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3 w-3" />
        </button>
      </button>

      {open && (
        <div className="overflow-x-auto">
          {table.description && (
            <p className="px-6 py-1 text-[10px] italic text-muted-foreground">{table.description}</p>
          )}
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-3 py-1 text-left font-medium text-muted-foreground">Column</th>
                <th className="px-3 py-1 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-1 text-center font-medium text-muted-foreground">PK</th>
                <th className="px-3 py-1 text-left font-medium text-muted-foreground">FK →</th>
                <th className="px-3 py-1 text-left font-medium text-muted-foreground">Notes</th>
                <th className="w-6 px-2" />
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => (
                <tr key={col.name} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                  <td className={cn("px-3 py-1 font-mono", col.pk ? "font-bold text-primary" : "")}>
                    {col.name}{col.nullable && <span className="text-muted-foreground">?</span>}
                  </td>
                  <td className="px-3 py-1 font-mono text-muted-foreground">{col.type}</td>
                  <td className="px-3 py-1 text-center">
                    {col.pk && <KeyRound className="mx-auto h-3 w-3 text-primary" />}
                  </td>
                  <td className="px-3 py-1 font-mono">
                    {col.fk && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <LinkIcon className="h-3 w-3 shrink-0" />
                        {col.fk.table}.{col.fk.column}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1 text-muted-foreground">
                    {col.notes?.startsWith("⚠️") ? (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {col.notes.replace("⚠️ ", "")}
                      </span>
                    ) : col.notes}
                  </td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(col.name)}
                      title="Copy column name"
                      className="rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground"
                    >
                      <Copy className="h-2.5 w-2.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  pathname: string;
  params: Record<string, string | string[] | undefined>;
  detectedTableName?: string;
  columnMappings?: Array<{ visibleColumnName: string; actualColumnOrFormula: string; notes: string }>;
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Section = "schema" | "columns" | "constants";

export function SchemaTab({ pathname, params, detectedTableName, columnMappings }: Props) {
  const [section, setSection] = React.useState<Section>("schema");
  const schema = findPageSchema(pathname);

  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  const resolveRoute = (path: string) => {
    let r = path;
    if (projectId) r = r.replace("[projectId]", projectId);
    for (const [key, val] of Object.entries(params)) {
      if (val && !Array.isArray(val)) r = r.replace(`[${key}]`, val);
    }
    return r;
  };

  const fkMismatchCount = schema?.fieldMappings.filter(
    (m) => m.fkTarget && m.dropdownSource && m.fkTarget !== m.dropdownSource
  ).length ?? 0;

  const SECTIONS: { id: Section; label: string; badge?: number }[] = [
    { id: "schema",    label: "Tables & Routes", badge: fkMismatchCount > 0 ? fkMismatchCount : undefined },
    { id: "columns",   label: "Column Map" },
    { id: "constants", label: "DB Constants" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sub-nav */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border/50 px-3 py-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              section === s.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s.label}
            {s.badge !== undefined && (
              <span className="rounded-full bg-amber-100 px-1 text-[9px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Tables & Routes ── */}
        {section === "schema" && (
          <div className="p-4 space-y-5">
            {!schema ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>No schema registered for this page.</p>
                <p className="mt-1 text-xs">
                  Add an entry to{" "}
                  <code className="rounded bg-muted px-1 py-0.5">page-schema-registry.ts</code>.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">{schema.label}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {schema.tables.length}t · {schema.apiRoutes.length}r · {schema.fieldMappings.length}f
                    {fkMismatchCount > 0 && (
                      <span className="ml-2 text-amber-600"> · {fkMismatchCount} FK mismatch</span>
                    )}
                  </span>
                </div>

                {/* Tables */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Database className="h-3 w-3" /> Supabase Tables
                  </p>
                  <div className="rounded-md border border-border/50">
                    {schema.tables.map((t) => <TableAccordion key={t.name} table={t} />)}
                  </div>
                </div>

                {/* API Routes */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Globe className="h-3 w-3" /> API Routes
                  </p>
                  <div className="space-y-0.5">
                    {schema.apiRoutes.map((route, i) => (
                      <div
                        key={`${route.method}-${route.path}-${i}`}
                        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/40 group"
                      >
                        <MethodBadge method={route.method} />
                        <code className="flex-1 text-[11px] font-mono text-foreground truncate">
                          {resolveRoute(route.path)}
                        </code>
                        <span className="shrink-0 text-[10px] text-muted-foreground hidden group-hover:block">
                          {route.description}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(resolveRoute(route.path))}
                          className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Field mappings */}
                {schema.fieldMappings.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Form → DB Mappings
                    </p>
                    <div className="overflow-x-auto rounded-md border border-border/50">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-border/50 bg-muted/30">
                            <th className="px-3 py-1 text-left font-medium text-muted-foreground">Field</th>
                            <th className="px-3 py-1 text-left font-medium text-muted-foreground">DB Column</th>
                            <th className="px-3 py-1 text-left font-medium text-muted-foreground">FK Target</th>
                            <th className="px-3 py-1 text-left font-medium text-muted-foreground">Dropdown</th>
                            <th className="px-3 py-1 text-left font-medium text-muted-foreground">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schema.fieldMappings.map((m, i) => {
                            const mismatch = m.fkTarget && m.dropdownSource && m.fkTarget !== m.dropdownSource;
                            return (
                              <tr key={`${m.formField}-${i}`} className={cn("border-b border-border/30 last:border-0", mismatch ? "bg-amber-50/50 dark:bg-amber-950/20" : "")}>
                                <td className="px-3 py-1 font-mono font-medium">{m.formField}</td>
                                <td className="px-3 py-1 font-mono text-muted-foreground">{m.dbTable}.{m.dbColumn}</td>
                                <td className="px-3 py-1 font-mono text-primary">{m.fkTarget}</td>
                                <td className={cn("px-3 py-1 font-mono", mismatch ? "font-semibold text-amber-600" : "")}>{m.dropdownSource}</td>
                                <td className="px-3 py-1 text-muted-foreground">
                                  {m.notes?.startsWith("⚠️") ? (
                                    <span className="flex items-center gap-1 text-amber-600">
                                      <AlertTriangle className="h-3 w-3" />{m.notes.replace("⚠️ ", "")}
                                    </span>
                                  ) : m.notes}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Column Map ── */}
        {section === "columns" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 flex-1">
                <p className="text-[10px] text-muted-foreground">Detected Table</p>
                <p className="mt-0.5 font-mono text-[11px] text-foreground">{detectedTableName ?? "Unknown"}</p>
              </div>
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>

            {!columnMappings || columnMappings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No visible table headers detected for this page.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/50">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Visible Label</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">DB Column / Formula</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Notes</th>
                      <th className="w-8 px-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {columnMappings.map((row) => (
                      <tr key={`${row.visibleColumnName}-${row.actualColumnOrFormula}`} className="border-b border-border/30 last:border-0 hover:bg-muted/20 group">
                        <td className="px-3 py-1.5 font-medium">{row.visibleColumnName}</td>
                        <td className="px-3 py-1.5 font-mono text-foreground">{row.actualColumnOrFormula}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.notes}</td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(row.actualColumnOrFormula)}
                            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── DB Constants ── */}
        {section === "constants" && (
          <div className="p-4 space-y-5">
            {/* FK Types */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <LinkIcon className="h-3 w-3" /> FK Type Reference
                <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">CRITICAL</span>
              </p>
              <div className="rounded-md border border-border/50 bg-muted/20 overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Table</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">PK type</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">FK column name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FK_TYPE_REFERENCE.map((ref) => (
                      <tr key={ref.table} className="border-b border-border/30 last:border-0 hover:bg-muted/20 group">
                        <td className="px-3 py-1.5 font-mono font-semibold">{ref.table}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{ref.pk}</td>
                        <td className="px-3 py-1.5 font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          {ref.fk}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(ref.fk)}
                            className="opacity-0 group-hover:opacity-100 ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CHECK Constraints */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                CHECK Constraint Values <span className="normal-case font-normal">(case-sensitive!)</span>
              </p>
              <div className="space-y-3">
                {Object.entries(CHECK_CONSTRAINTS).map(([key, values]) => (
                  <div key={key} className="rounded-md border border-border/50 bg-muted/20 p-3">
                    <p className="mb-1.5 font-mono text-[11px] font-semibold text-foreground">{key}</p>
                    <div className="flex flex-wrap gap-1">
                      {values.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => copyToClipboard(v)}
                          title="Click to copy"
                          className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] hover:border-primary/50 hover:bg-primary/5 transition-colors"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
