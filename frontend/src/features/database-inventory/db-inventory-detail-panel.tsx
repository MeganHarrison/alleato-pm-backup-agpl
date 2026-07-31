"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { InfoAlert } from "@/components/ds/InfoAlert";
import type { DbInventoryTable } from "@/components/dev-tools/db-inventory.generated";
import { STATUS_VARIANT } from "./db-inventory-table-config";

interface DbInventoryDetailPanelProps {
  table: DbInventoryTable | null;
  onClose: () => void;
  onNavigateToTable?: (tableName: string) => void;
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"));
}

function RefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function RefLine({ filePath, lineNumber, snippet }: { filePath: string; lineNumber: number; snippet: string }) {
  const label = `${filePath}:${lineNumber}`;
  return (
    <div className="group flex items-start gap-2 py-1">
      <code className="flex-1 text-xs text-foreground break-all">{label}</code>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
        onClick={() => copyToClipboard(label)}
        title="Copy path"
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function DbInventoryDetailPanel({
  table,
  onClose,
  onNavigateToTable,
}: DbInventoryDetailPanelProps) {
  if (!table) return null;

  const hasWrites = table.references.writes.length > 0;
  const hasReads = table.references.reads.length > 0;
  const hasMigrations = table.references.migrations.length > 0;
  const hasUnknown = table.references.unknown.length > 0;

  return (
    <Sheet open={Boolean(table)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{table.db}</Badge>
            <Badge variant={STATUS_VARIANT[table.status] ?? "secondary"} className="text-xs">
              {table.status}
            </Badge>
            {table.cleanupPriority && (
              <Badge variant="destructive" className="text-xs">
                cleanup: {table.cleanupPriority}
              </Badge>
            )}
          </div>
          <SheetTitle className="font-mono text-lg">{table.name}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            {table.domain} · {table.owner}
          </p>
        </SheetHeader>

        <div className="py-4 space-y-6">
          {/* Purpose */}
          <RefSection title="Purpose">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{table.purpose}</p>
          </RefSection>

          {/* Gotchas */}
          {table.gotchas && (
            <RefSection title="⚠ Gotchas">
              <InfoAlert variant="warning">
                <p className="text-sm whitespace-pre-wrap">{table.gotchas}</p>
              </InfoAlert>
            </RefSection>
          )}

          {/* Live Stats */}
          <RefSection title="Live Stats">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Approx Rows" value={table.liveStats.approxRows.toLocaleString()} />
              <Stat label="Total Size" value={table.liveStats.totalSize} />
              <Stat label="Live Tuples" value={table.liveStats.nLiveTup.toLocaleString()} />
              <Stat label="Dead Tuples" value={table.liveStats.nDeadTup.toLocaleString()} />
              {table.liveStats.lastAutoanalyze && (
                <Stat
                  label="Last Autoanalyze"
                  value={new Date(table.liveStats.lastAutoanalyze).toLocaleString()}
                />
              )}
              <Stat
                label="Stats Refreshed"
                value={new Date(table.liveStats.refreshedAt).toLocaleString()}
              />
            </div>
          </RefSection>

          {/* Columns */}
          {table.columns.length > 0 && (
            <RefSection title={`Columns (${table.columns.length})`}>
              <div className="rounded-md border border-border/50 overflow-hidden">
                <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>Column</span>
                  <span>Type</span>
                  <span>Nullable</span>
                </div>
                <div className="divide-y divide-border/30">
                  {table.columns.map((col) => (
                    <div key={col.name} className="grid grid-cols-3 px-3 py-1.5 text-xs hover:bg-muted/30">
                      <span className="font-mono">{col.name}</span>
                      <span className="text-muted-foreground">{col.dataType}</span>
                      <span className="text-muted-foreground">{col.isNullable ? "yes" : "no"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </RefSection>
          )}

          {/* Writers */}
          {hasWrites && (
            <RefSection title={`Writers (${table.references.writes.length})`}>
              <div className="space-y-0.5">
                {table.references.writes.map((ref, i) => (
                  <RefLine key={i} {...ref} />
                ))}
              </div>
            </RefSection>
          )}

          {/* Readers */}
          {hasReads && (
            <RefSection title={`Readers (${table.references.reads.length})`}>
              <div className="space-y-0.5">
                {table.references.reads.map((ref, i) => (
                  <RefLine key={i} {...ref} />
                ))}
              </div>
            </RefSection>
          )}

          {/* Migrations */}
          {hasMigrations && (
            <RefSection title={`Migrations (${table.references.migrations.length})`}>
              <div className="space-y-0.5">
                {table.references.migrations.map((ref, i) => (
                  <RefLine key={i} {...ref} />
                ))}
              </div>
            </RefSection>
          )}

          {/* Unknown refs */}
          {hasUnknown && (
            <RefSection title={`Other References (${table.references.unknown.length})`}>
              <div className="space-y-0.5">
                {table.references.unknown.map((ref, i) => (
                  <RefLine key={i} {...ref} />
                ))}
              </div>
            </RefSection>
          )}

          {/* Related tables */}
          {table.relatedTables.length > 0 && (
            <RefSection title="Related Tables">
              <div className="flex flex-wrap gap-1.5">
                {table.relatedTables.map((name) => (
                  <Button
                    key={name}
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateToTable?.(name)}
                    className="h-auto px-2 py-1 text-xs font-mono"
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </RefSection>
          )}

          {/* Notes for AI */}
          {table.notesForAi && (
            <RefSection title="Notes for AI">
              <InfoAlert variant="info">
                <p className="text-xs whitespace-pre-wrap">{table.notesForAi}</p>
              </InfoAlert>
            </RefSection>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
