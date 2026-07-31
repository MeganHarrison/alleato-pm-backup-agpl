"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

type AuditOperation = "create" | "update" | "skip" | "error";

interface OutboundAuditRow {
  run_id: string;
  project_id: number;
  contract_id: string | null;
  entity_name: string;
  source_table: string;
  source_record_id: string;
  source_reference: string | null;
  acumatica_entity: string;
  acumatica_reference: string | null;
  acumatica_doc_type: string | null;
  operation: AuditOperation;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

interface RunSummary {
  runId: string;
  startedAt: string;
  endedAt: string;
  triggeredByUserId: string | null;
  projectIds: number[];
  entities: string[];
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  total: number;
}

interface DailySummary {
  date: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  total: number;
}

interface ApiResponse {
  rows: OutboundAuditRow[];
  runs: RunSummary[];
  daily: DailySummary[];
  selectedRunId: string | null;
  legacyRows: Array<{
    entity: string;
    sourceTable: string;
    sourceId: string;
    sourceReference: string | null;
    projectId: number | null;
    contractId: string | null;
    acumaticaReference: string;
    acumaticaDocType: string | null;
    linkedAt: string | null;
  }>;
  legacySummary: {
    totalLinked: number;
    byEntity: Array<{ entity: string; count: number }>;
  };
  legacyError?: string | null;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function opBadgeVariant(op: AuditOperation): "default" | "secondary" | "destructive" | "outline" {
  if (op === "create") return "default";
  if (op === "update") return "secondary";
  if (op === "error") return "destructive";
  return "outline";
}

export default function AcumaticaSyncLogsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<ApiResponse>(
          "/api/admin/acumatica-outbound-logs?days=365&rowLimit=10000",
        );
        setData(payload);
        setSelectedRunId(payload.selectedRunId ?? payload.runs[0]?.runId ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load logs.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const selectedRun = useMemo(
    () => data?.runs.find((run) => run.runId === selectedRunId) ?? null,
    [data?.runs, selectedRunId],
  );

  const selectedRunRows = useMemo(
    () => data?.rows.filter((row) => row.run_id === selectedRunId) ?? [],
    [data?.rows, selectedRunId],
  );

  const latestSuccess = useMemo(() => {
    const row = data?.rows.find((r) => r.success && (r.operation === "create" || r.operation === "update"));
    return row?.created_at ?? null;
  }, [data?.rows]);

  return (
    <PageShell
      variant="content"
      title="Acumatica Sync Logs"
      description="Outbound app-to-Acumatica create/update/skip/error audit trail."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Refresh
        </Button>
      }
    >
      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border px-4 py-3">
            <p className="text-xs text-muted-foreground">Runs (14d)</p>
            <p className="text-xl font-semibold">{data?.runs.length ?? 0}</p>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <p className="text-xs text-muted-foreground">Rows (14d)</p>
            <p className="text-xl font-semibold">{data?.rows.length ?? 0}</p>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <p className="text-xs text-muted-foreground">Latest Successful Push</p>
            <p className="text-sm font-medium">
              {latestSuccess ? formatDateTime(latestSuccess) : "No successful create/update yet"}
            </p>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <p className="text-xs text-muted-foreground">Selected Run</p>
            <p className="truncate font-mono text-xs">{selectedRunId ?? "None"}</p>
          </div>
        </div>
      </section>

      {loading && <p className="py-8 text-sm text-muted-foreground">Loading logs...</p>}
      {error && <p className="py-8 text-sm text-destructive">{error}</p>}

      {!loading && !error && data && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Daily Summary</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Created</th>
                    <th className="px-3 py-2 text-right">Updated</th>
                    <th className="px-3 py-2 text-right">Skipped</th>
                    <th className="px-3 py-2 text-right">Errors</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((day) => (
                    <tr key={day.date} className="border-t">
                      <td className="px-3 py-2 font-medium">{day.date}</td>
                      <td className="px-3 py-2 text-right">{day.created}</td>
                      <td className="px-3 py-2 text-right">{day.updated}</td>
                      <td className="px-3 py-2 text-right">{day.skipped}</td>
                      <td className="px-3 py-2 text-right">{day.errors}</td>
                      <td className="px-3 py-2 text-right">{day.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Historical Linked Records (Read-Only)</h2>
            <p className="text-sm text-muted-foreground">
              Backfilled from existing mapped fields in your database
              (<code>acumatica_ref_nbr</code> / <code>acumatica_external_key</code>), including records linked before the new run-level audit logs.
            </p>
            {data.legacyError ? (
              <p className="text-sm text-destructive">
                Could not load historical linked rows: {data.legacyError}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border px-4 py-3">
                <p className="text-xs text-muted-foreground">Total Linked</p>
                <p className="text-xl font-semibold">{data.legacySummary.totalLinked}</p>
              </div>
              {data.legacySummary.byEntity.map((item) => (
                <div key={item.entity} className="rounded-lg border px-4 py-3">
                  <p className="text-xs text-muted-foreground">{item.entity}</p>
                  <p className="text-xl font-semibold">{item.count}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Linked At</th>
                    <th className="px-3 py-2 text-left">Entity</th>
                    <th className="px-3 py-2 text-left">Source Ref</th>
                    <th className="px-3 py-2 text-left">Project</th>
                    <th className="px-3 py-2 text-left">Acumatica Ref</th>
                    <th className="px-3 py-2 text-left">Doc Type</th>
                  </tr>
                </thead>
                <tbody>
                  {data.legacyRows.map((row) => (
                    <tr
                      key={`${row.sourceTable}-${row.sourceId}-${row.acumaticaReference}`}
                      className="border-t"
                    >
                      <td className="px-3 py-2">
                        {row.linkedAt ? formatDateTime(row.linkedAt) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.entity}
                        <div className="text-xs text-muted-foreground">{row.sourceTable}</div>
                      </td>
                      <td className="px-3 py-2">{row.sourceReference ?? row.sourceId}</td>
                      <td className="px-3 py-2">{row.projectId ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.acumaticaReference}</td>
                      <td className="px-3 py-2">{row.acumaticaDocType ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Recent Runs</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Run</th>
                    <th className="px-3 py-2 text-left">Ended</th>
                    <th className="px-3 py-2 text-right">Created</th>
                    <th className="px-3 py-2 text-right">Updated</th>
                    <th className="px-3 py-2 text-right">Skipped</th>
                    <th className="px-3 py-2 text-right">Errors</th>
                    <th className="px-3 py-2 text-left">Entities</th>
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((run) => (
                    <tr
                      key={run.runId}
                      className={`cursor-pointer border-t hover:bg-muted/30 ${
                        selectedRunId === run.runId ? "bg-muted/30" : ""
                      }`}
                      onClick={() => setSelectedRunId(run.runId)}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{run.runId}</td>
                      <td className="px-3 py-2">{formatDateTime(run.endedAt)}</td>
                      <td className="px-3 py-2 text-right">{run.created}</td>
                      <td className="px-3 py-2 text-right">{run.updated}</td>
                      <td className="px-3 py-2 text-right">{run.skipped}</td>
                      <td className="px-3 py-2 text-right">{run.errors}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {run.entities.map((entity) => (
                            <Badge key={entity} variant="outline">
                              {entity}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Run Details</h2>
            {!selectedRun && (
              <p className="text-sm text-muted-foreground">Select a run to inspect record-level details.</p>
            )}

            {selectedRun && (
              <>
                <p className="text-sm text-muted-foreground">
                  {selectedRunRows.length} row{selectedRunRows.length === 1 ? "" : "s"} in run{" "}
                  <span className="font-mono">{selectedRun.runId}</span>
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Time</th>
                        <th className="px-3 py-2 text-left">Entity</th>
                        <th className="px-3 py-2 text-left">Operation</th>
                        <th className="px-3 py-2 text-left">Source Ref</th>
                        <th className="px-3 py-2 text-left">Acumatica Ref</th>
                        <th className="px-3 py-2 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRunRows.map((row) => (
                        <tr key={`${row.run_id}-${row.source_table}-${row.source_record_id}-${row.created_at}`} className="border-t">
                          <td className="px-3 py-2">{formatDateTime(row.created_at)}</td>
                          <td className="px-3 py-2">
                            {row.entity_name}
                            <div className="text-xs text-muted-foreground">{row.source_table}</div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={opBadgeVariant(row.operation)}>{row.operation}</Badge>
                          </td>
                          <td className="px-3 py-2">{row.source_reference ?? row.source_record_id}</td>
                          <td className="px-3 py-2">
                            {row.acumatica_reference ?? "—"}
                            {row.acumatica_doc_type ? (
                              <div className="text-xs text-muted-foreground">{row.acumatica_doc_type}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-xs text-destructive">
                            {row.error_message ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
