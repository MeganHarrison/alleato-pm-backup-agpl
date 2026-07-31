"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ds/status-badge";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/table-config/formatters";
import { ChangeEventLinkedChangeOrderTable } from "./change-event-linked-change-order-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinkedCommitmentPco {
  linkId: string;
  linkedAt: string;
  record_type?: "pco" | "change_order";
  id: string;
  pco_number: string | null;
  title: string;
  status: string;
  total_amount: number | null;
  schedule_impact: number | null;
  commitment_id: string;
  commitment_type: string;
  created_at: string;
}

interface ChangeEventCommitmentPCOsSectionProps {
  projectId: number;
  changeEventId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChangeEventCommitmentPCOsSection({
  projectId,
  changeEventId,
}: ChangeEventCommitmentPCOsSectionProps) {
  const [pcos, setPcos] = useState<LinkedCommitmentPco[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPcos = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch<{ data: LinkedCommitmentPco[] }>(
          `/api/projects/${projectId}/change-events/${changeEventId}/commitment-pcos`,
          { cache: "no-store" as RequestCache },
        );
        setPcos(res.data ?? []);
      } catch (err) {
        console.error("[ChangeEventCommitmentPCOsSection] Failed to load commitment change records:", err);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchPcos();
  }, [projectId, changeEventId]);

  if (!isLoading && pcos.length === 0) return null;

  return (
    <ChangeEventLinkedChangeOrderTable
      title="Commitment Change Orders"
      relatedHeading="Type"
      isLoading={isLoading}
      rowCount={pcos.length}
      rows={pcos.map((pco) => ({
        key: pco.linkId,
        number: (
          <Link
            href={
              pco.record_type === "change_order"
                ? `/${projectId}/change-orders/commitment/${pco.id}`
                : `/${projectId}/commitment-pcos/${pco.id}`
            }
            className="font-medium text-primary hover:underline"
          >
            {pco.pco_number ?? "—"}
          </Link>
        ),
        title: <span className="block truncate text-foreground">{pco.title}</span>,
        status: <StatusBadge status={pco.status} />,
        related: (
          <span className="text-muted-foreground capitalize">
            {pco.commitment_type === "purchase_order" ? "Purchase Order" : "Subcontract"}
          </span>
        ),
        amount: <span className="tabular-nums">{formatCurrency(pco.total_amount)}</span>,
        schedule: (
          <span className="text-muted-foreground tabular-nums">
            {pco.schedule_impact != null ? `${pco.schedule_impact}d` : "—"}
          </span>
        ),
        created: (
          <span className="text-muted-foreground">
            {formatDate(pco.created_at)}
          </span>
        ),
      }))}
    />
  );
}
