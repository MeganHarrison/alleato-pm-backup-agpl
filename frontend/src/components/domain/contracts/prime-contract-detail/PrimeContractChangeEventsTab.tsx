"use client";

import { useMemo } from "react";

import Link from "next/link";

import { StatusBadge } from "@/components/ds";
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
import { useChangeEvents } from "@/hooks/use-change-events";
import type { ChangeEvent } from "@/types/change-events";

interface PrimeContractChangeEventsTabProps {
  projectId: string;
  contractId: string;
  formatCurrency: (value: number | null | undefined) => string;
}

function normalizePrimeContractId(value: ChangeEvent["prime_contract_id"] | string | null | undefined) {
  if (value === null || value === undefined) return null;
  return String(value);
}

export function PrimeContractChangeEventsTab({
  projectId,
  contractId,
  formatCurrency,
}: PrimeContractChangeEventsTabProps) {
  const { changeEvents, isLoading } = useChangeEvents({
    projectId: Number(projectId),
    limit: 200,
  });

  const rows = useMemo(
    () =>
      changeEvents.filter(
        (changeEvent) =>
          normalizePrimeContractId(
            (changeEvent as ChangeEvent & { prime_contract_id?: string | number | null }).prime_contract_id,
          ) === contractId,
      ),
    [changeEvents, contractId],
  );

  return (
    <section className="space-y-3">
      <SectionRuleHeading label="Change Events" />
      <InlineTable variant="read" tableClassName="min-w-full">
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell>#</InlineTableHeaderCell>
            <InlineTableHeaderCell>Title</InlineTableHeaderCell>
            <InlineTableHeaderCell>Type</InlineTableHeaderCell>
            <InlineTableHeaderCell>Status</InlineTableHeaderCell>
            <InlineTableHeaderCell>Scope</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Cost ROM</InlineTableHeaderCell>
            <InlineTableHeaderCell>Potential PCO</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          {isLoading ? (
            <InlineTableRow>
              <InlineTableCell colSpan={7} className="py-5 text-sm text-muted-foreground">
                Loading change events...
              </InlineTableCell>
            </InlineTableRow>
          ) : rows.length === 0 ? (
            <InlineTableRow>
              <InlineTableCell colSpan={7} className="py-5 text-sm text-muted-foreground">
                No change events associated with this prime contract yet.
              </InlineTableCell>
            </InlineTableRow>
          ) : (
            rows.map((changeEvent) => (
              <InlineTableRow key={String(changeEvent.id)}>
                <InlineTableCell className="font-medium">
                  <Link
                    href={`/${projectId}/change-events/${changeEvent.id}`}
                    className="text-primary hover:underline"
                  >
                    {changeEvent.number || "—"}
                  </Link>
                </InlineTableCell>
                <InlineTableCell>
                  <Link
                    href={`/${projectId}/change-events/${changeEvent.id}`}
                    className="text-foreground hover:underline"
                  >
                    {changeEvent.title || "Untitled"}
                  </Link>
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {changeEvent.type || "—"}
                </InlineTableCell>
                <InlineTableCell>
                  <StatusBadge status={changeEvent.status ?? "Open"} />
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {changeEvent.scope || "—"}
                </InlineTableCell>
                <InlineTableCell align="right" numeric>
                  {changeEvent.cost_rom != null ? formatCurrency(Number(changeEvent.cost_rom)) : "—"}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {changeEvent.prime_pco || "—"}
                </InlineTableCell>
              </InlineTableRow>
            ))
          )}
        </InlineTableBody>
      </InlineTable>
    </section>
  );
}
