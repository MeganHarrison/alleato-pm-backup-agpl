"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { StatusBadge } from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LineageRow {
  pco_type: "prime" | "commitment";
  pco: {
    id: string;
    number: string | null;
    title: string | null;
    status: string | null;
    total_amount: number | null;
    record_type?: "pco" | "change_order";
  };
  resulting_co: {
    id: string | number;
    number: string | null;
    title: string | null;
    status: string | null;
    total_amount: number | null;
  } | null;
  linked_at: string | null;
}

interface ChangeEventLineagePanelProps {
  projectId: number;
  changeEventId: string;
  refreshSignal?: number;
}

function formatCurrency(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function ChangeEventLineagePanel({
  projectId,
  changeEventId,
  refreshSignal = 0,
}: ChangeEventLineagePanelProps) {
  const [rows, setRows] = useState<LineageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchLineage = async () => {
      setIsLoading(true);
      try {
        const payload = await apiFetch<{ data?: LineageRow[] }>(
          `/api/projects/${projectId}/change-events/${changeEventId}/lineage`,
          { cache: "no-store" as RequestCache },
        );
        if (!cancelled) {
          setRows(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchLineage();
    return () => {
      cancelled = true;
    };
  }, [projectId, changeEventId, refreshSignal]);

  return (
    <div className="space-y-2">
      <Label>Workflow Lineage</Label>
      <div className="rounded-md border border-border">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            This change event has not been linked to any change orders yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Resulting CO</TableHead>
                <TableHead>Linked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const pcoHref =
                  row.pco_type === "prime"
                    ? `/${projectId}/prime-contract-pcos/${row.pco.id}`
                    : row.pco.record_type === "change_order"
                      ? `/${projectId}/change-orders/commitment/${row.pco.id}`
                      : `/${projectId}/commitment-pcos/${row.pco.id}`;
                const coHref = row.resulting_co
                  ? row.pco_type === "prime"
                    ? `/${projectId}/change-orders/prime/${row.resulting_co.id}`
                    : `/${projectId}/change-orders/commitment/${row.resulting_co.id}`
                  : null;

                return (
                  <TableRow key={`${row.pco_type}:${row.pco.id}`}>
                    <TableCell>
                      {row.pco_type === "prime" ? "Prime Contract" : "Commitment"}
                    </TableCell>
                    <TableCell>
                      <Link href={pcoHref} className="text-primary hover:underline">
                        {row.pco.number ||
                          (row.pco.record_type === "change_order" ? "CO" : "PCO")}{" "}
                        — {row.pco.title || "Untitled"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.pco.status ? (
                        <StatusBadge status={row.pco.status} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.pco.total_amount)}
                    </TableCell>
                    <TableCell>
                      {row.resulting_co && coHref ? (
                        <div className="space-y-1">
                          <Link href={coHref} className="text-primary hover:underline">
                            {row.resulting_co.number || "CO"} — {row.resulting_co.title || "Untitled"}
                          </Link>
                          {row.resulting_co.status ? (
                            <div>
                              <StatusBadge status={row.resulting_co.status} />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {row.pco.record_type === "change_order" ? "Direct CO" : "Not promoted"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.linked_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
