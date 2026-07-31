"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ds/status-badge";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/table-config/formatters";

interface PrimePco {
  id: string;
  prime_contract_id?: string | null;
  pco_number: string | null;
  title: string;
  status: string;
  total_amount: number | null;
  description: string | null;
  revision: number | null;
  schedule_impact: number | null;
  change_reason: string | null;
  created_at: string;
  promoted_co_number: string | null;
  linked_change_event_number: string | null;
  linked_change_event_type: string | null;
}

interface PrimeContractPcosSectionProps {
  projectId: string;
  contractId: string;
  formatCurrency: (value: number | null | undefined) => string;
}

export function PrimeContractPcosSection({
  projectId,
  contractId,
  formatCurrency,
}: PrimeContractPcosSectionProps) {
  const [pcos, setPcos] = useState<PrimePco[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPcos = async () => {
      setIsLoading(true);
      try {
        const json = await apiFetch<{ data?: PrimePco[] } | PrimePco[]>(
          `/api/projects/${projectId}/prime-contract-pcos`,
        );
        const allPcos: PrimePco[] = Array.isArray(json) ? json : (json.data ?? []);
        setPcos(
          contractId
            ? allPcos.filter((pco) => pco.prime_contract_id === contractId)
            : allPcos,
        );
      } catch (error) {
        console.error("Failed to load potential change orders:", error);
        toast.error("Failed to load potential change orders. Try refreshing the page.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPcos();
  }, [contractId, projectId]);

  const totalAmount = useMemo(
    () => pcos.reduce((sum, pco) => sum + (pco.total_amount ?? 0), 0),
    [pcos],
  );

  return (
    <section className="space-y-3">
      <SectionRuleHeading label="Potential Change Orders" />
      <InlineTable variant="read" tableClassName="min-w-full">
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell>Number</InlineTableHeaderCell>
            <InlineTableHeaderCell>Revision</InlineTableHeaderCell>
            <InlineTableHeaderCell>Title</InlineTableHeaderCell>
            <InlineTableHeaderCell>Status</InlineTableHeaderCell>
            <InlineTableHeaderCell>Date Initiated</InlineTableHeaderCell>
            <InlineTableHeaderCell>Change Reason</InlineTableHeaderCell>
            <InlineTableHeaderCell>PCCO</InlineTableHeaderCell>
            <InlineTableHeaderCell>Change Event</InlineTableHeaderCell>
            <InlineTableHeaderCell>Change Event Type</InlineTableHeaderCell>
            <InlineTableHeaderCell>Schedule Impact</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          {isLoading ? (
            <InlineTableRow>
              <InlineTableCell colSpan={11} className="py-5 text-sm text-muted-foreground">
                Loading potential change orders...
              </InlineTableCell>
            </InlineTableRow>
          ) : pcos.length === 0 ? (
            <InlineTableRow>
              <InlineTableCell colSpan={11} className="py-5 text-sm text-muted-foreground">
                No potential change orders created yet.
              </InlineTableCell>
            </InlineTableRow>
          ) : (
            pcos.map((pco) => (
              <InlineTableRow key={pco.id}>
                <InlineTableCell className="font-medium">
                  <Link
                    href={`/${projectId}/prime-contracts/${contractId}/change-orders/pcos/${pco.id}`}
                    className="text-primary hover:underline"
                  >
                    {pco.pco_number || "—"}
                  </Link>
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {pco.revision ?? "—"}
                </InlineTableCell>
                <InlineTableCell>
                  <Link
                    href={`/${projectId}/prime-contracts/${contractId}/change-orders/pcos/${pco.id}`}
                    className="text-foreground hover:underline"
                  >
                    {pco.title || "Untitled PCO"}
                  </Link>
                </InlineTableCell>
                <InlineTableCell>
                  <StatusBadge status={pco.status} />
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {formatDate(pco.created_at)}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {pco.change_reason || "—"}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {pco.promoted_co_number || "—"}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {pco.linked_change_event_number || "—"}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {pco.linked_change_event_type || "—"}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {pco.schedule_impact != null ? `${pco.schedule_impact}d` : "—"}
                </InlineTableCell>
                <InlineTableCell align="right" numeric>
                  {formatCurrency(pco.total_amount ?? 0)}
                </InlineTableCell>
              </InlineTableRow>
            ))
          )}
        </InlineTableBody>
        {!isLoading && pcos.length > 0 ? (
          <tfoot>
            <tr className="border-t border-border/60">
              <td className="px-3 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground" colSpan={10}>
                Total
              </td>
              <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums">
                {formatCurrency(totalAmount)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </InlineTable>
    </section>
  );
}
