"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";

import { SectionRuleHeading } from "@/components/layout/spacing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDateTime } from "./shared";

interface AuditRow {
  id: number;
  actor_email: string | null;
  event_type: string;
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  notes: string | null;
  created_at: string;
  actor_display_name?: string | null;
}

function describe(row: AuditRow): string {
  switch (row.event_type) {
    case "invoice.created":
      return "Invoice created";
    case "field.updated":
      return `Updated ${(row.field_name ?? "field").replace(/_/g, " ")}`;
    case "line_item.updated":
      return `Updated ${row.field_name ?? "line item"}`;
    case "email.sent":
      return "Sent email";
    case "erp.resend_requested":
      return "Requested ERP resend";
    case "status.changed": {
      const from = typeof row.old_value === "string" ? row.old_value : "";
      const to = typeof row.new_value === "string" ? row.new_value : "";
      if (from && to) return `Status: ${from.replace(/_/g, " ")} → ${to.replace(/_/g, " ")}`;
      return "Status changed";
    }
    default:
      return row.event_type.replace(/[._]/g, " ");
  }
}

export function ChangeHistoryTab({
  projectId,
  invoiceId,
}: {
  projectId: string;
  invoiceId: number;
}) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/change-history`,
        );
        const body = await res.json();
        if (res.ok) setRows(body.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, invoiceId]);

  return (
    <section className="space-y-4">
      <SectionRuleHeading label="Change History" />
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <History className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No changes logged yet.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTime(r.created_at)}
                </TableCell>
                <TableCell>
                  {r.actor_display_name ?? r.actor_email ?? "Not recorded"}
                </TableCell>
                <TableCell className="font-medium">{describe(r)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {r.notes ??
                    (r.new_value
                      ? JSON.stringify(r.new_value).slice(0, 120)
                      : "—")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
