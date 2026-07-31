"use client";

import Link from "next/link";
import * as React from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SchemaExplorerTable } from "./schema-explorer.types";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProvenanceBadge({
  value,
}: {
  value: "curated" | "code-derived" | "inferred";
}) {
  return (
    <Badge variant="outline" className="h-5 text-[10px] font-normal">
      {value}
    </Badge>
  );
}

function CodeReference({
  filePath,
  lineNumber,
}: {
  filePath: string;
  lineNumber: number;
}) {
  const label = `${filePath}:${lineNumber}`;
  return (
    <div className="group flex items-start gap-2 py-1">
      <code className="min-w-0 flex-1 break-all text-xs text-foreground">
        {label}
      </code>
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        onClick={() =>
          void navigator.clipboard
            .writeText(label)
            .then(() => toast.success("Copied path"))
        }
        title="Copy path"
      >
        <Copy className="h-3 w-3" />
        <span className="sr-only">Copy path</span>
      </Button>
    </div>
  );
}

export function SchemaExplorerTableDetails({
  table,
}: {
  table: SchemaExplorerTable;
}) {
  const references = [
    ...table.references.writes,
    ...table.references.reads,
    ...table.references.migrations,
    ...table.references.unknown,
  ];
  const database = encodeURIComponent(table.database);

  return (
    <div className="space-y-8">
      <Section title="Purpose">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
            {table.purpose}
          </p>
          <ProvenanceBadge value={table.purposeProvenance} />
        </div>
      </Section>

      <Section title="Connected functionality">
        <ul className="space-y-2 text-sm">
          {table.featureConnections.map((connection) => (
            <li
              key={`${connection.provenance}:${connection.label}`}
              className="flex items-start gap-2"
            >
              <span className="min-w-0 flex-1 break-all">
                {connection.label}
              </span>
              <ProvenanceBadge value={connection.provenance} />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={
          table.primaryKeyColumns.length > 1
            ? "Composite primary key"
            : "Primary key"
        }
      >
        {table.primaryKeyColumns.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {table.primaryKeyColumns.map((column) => (
              <Badge key={column} variant="secondary" className="font-mono">
                {column}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No primary key is defined in the live schema.
          </p>
        )}
      </Section>

      <Section title={`Foreign keys (${table.foreignKeys.length})`}>
        {table.foreignKeys.length > 0 ? (
          <div className="divide-y divide-border/60 border-y border-border/60">
            {table.foreignKeys.map((foreignKey) => (
              <div key={foreignKey.name} className="space-y-1 py-3 text-sm">
                <p className="font-mono text-xs text-muted-foreground">
                  {foreignKey.name}
                </p>
                <p>
                  <code>{foreignKey.columns.join(", ")}</code> →{" "}
                  <code>
                    {foreignKey.referencedSchema}.{foreignKey.referencedTable}
                  </code>{" "}
                  ({foreignKey.referencedColumns.join(", ")})
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No outgoing foreign keys are defined in the live schema.
          </p>
        )}
      </Section>

      <Section title={`Columns (${table.columns.length})`}>
        <div className="overflow-hidden rounded-md border border-border/60">
          <div className="grid grid-cols-[minmax(9rem,1.2fr)_minmax(7rem,1fr)_4.5rem] gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Column</span>
            <span>Type</span>
            <span>Flags</span>
          </div>
          <div className="divide-y divide-border/50">
            {table.columns.map((column) => (
              <div
                key={column.name}
                className="grid grid-cols-[minmax(9rem,1.2fr)_minmax(7rem,1fr)_4.5rem] gap-2 px-3 py-2 text-xs"
              >
                <code className="break-all">{column.name}</code>
                <span className="break-all text-muted-foreground">
                  {column.dataType}
                </span>
                <span className="text-muted-foreground">
                  {column.isPrimaryKey
                    ? "PK"
                    : column.isNullable
                      ? "null"
                      : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {table.relatedTables.length > 0 && (
        <Section title="Related tables">
          <div className="flex flex-wrap gap-1.5">
            {table.relatedTables.map((name) => (
              <Button key={name} asChild variant="outline" size="xs">
                <Link
                  href={`/database-inventory/${encodeURIComponent(name)}?database=${database}`}
                  className="font-mono"
                >
                  {name}
                </Link>
              </Button>
            ))}
          </div>
        </Section>
      )}

      {references.length > 0 && (
        <Section title={`Code references (${references.length})`}>
          <div className="divide-y divide-border/50">
            {references.slice(0, 20).map((reference, index) => (
              <CodeReference
                key={`${reference.filePath}:${reference.lineNumber}:${index}`}
                {...reference}
              />
            ))}
          </div>
          {references.length > 20 && (
            <p className="text-xs text-muted-foreground">
              Showing the first 20 recorded references.
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
