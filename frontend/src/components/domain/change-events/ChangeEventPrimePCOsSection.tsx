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

interface PrimeContractInfo {
  id: string;
  contract_number: string | null;
  title: string | null;
  status: string | null;
}

interface LinkedPrimePco {
  linkId: string;
  linkedAt: string;
  id: string;
  pco_number: string | null;
  title: string;
  status: string;
  total_amount: number | null;
  schedule_impact: number | null;
  created_at: string;
  prime_contract_id: string;
  prime_contracts: PrimeContractInfo | null;
}

interface ChangeEventPrimePCOsSectionProps {
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

export function ChangeEventPrimePCOsSection({
  projectId,
  changeEventId,
}: ChangeEventPrimePCOsSectionProps) {
  const [pcos, setPcos] = useState<LinkedPrimePco[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPcos = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch<{ data: LinkedPrimePco[] }>(
          `/api/projects/${projectId}/change-events/${changeEventId}/prime-pcos`,
          { cache: "no-store" as RequestCache },
        );
        setPcos(res.data ?? []);
      } catch (err) {
        console.error("[ChangeEventPrimePCOsSection] Failed to load prime contract PCOs:", err);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchPcos();
  }, [projectId, changeEventId]);

  if (!isLoading && pcos.length === 0) return null;

  return (
    <ChangeEventLinkedChangeOrderTable
      title="Prime Contract Potential Change Orders"
      relatedHeading="Prime Contract"
      isLoading={isLoading}
      rowCount={pcos.length}
      rows={pcos.map((pco) => ({
        key: pco.linkId,
        number: (
          <Link
            href={`/${projectId}/prime-contracts/${pco.prime_contract_id}/change-orders/pcos/${pco.id}`}
            className="font-medium text-primary hover:underline"
          >
            {pco.pco_number ?? "—"}
          </Link>
        ),
        title: <span className="block truncate text-foreground">{pco.title}</span>,
        status: <StatusBadge status={pco.status} />,
        related: pco.prime_contracts ? (
          <Link
            href={`/${projectId}/prime-contracts/${pco.prime_contract_id}`}
            className="block truncate text-primary hover:underline"
          >
            {pco.prime_contracts.contract_number ||
              pco.prime_contracts.title ||
              "—"}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
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
