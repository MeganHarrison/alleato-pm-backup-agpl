"use client";

import type { ReactNode } from "react";

import { SectionHeader } from "@/components/ds/section-header";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";

const columnClasses = {
  number: "w-[10rem] whitespace-nowrap",
  title: "w-[24rem]",
  status: "w-[11rem] whitespace-nowrap",
  related: "w-[14rem]",
  amount: "w-[10rem] whitespace-nowrap text-right",
  schedule: "w-[8rem] whitespace-nowrap",
  created: "w-[10rem] whitespace-nowrap",
} as const;

interface ChangeEventLinkedChangeOrderTableProps {
  title: string;
  relatedHeading: string;
  loadingLabel?: string;
  isLoading: boolean;
  rowCount: number;
  rows: Array<{
    key: string;
    number: ReactNode;
    title: ReactNode;
    status: ReactNode;
    related: ReactNode;
    amount: ReactNode;
    schedule: ReactNode;
    created: ReactNode;
  }>;
}

export function ChangeEventLinkedChangeOrderTable({
  title,
  relatedHeading,
  loadingLabel = "Loading…",
  isLoading,
  rowCount,
  rows,
}: ChangeEventLinkedChangeOrderTableProps) {
  if (!isLoading && rowCount === 0) return null;

  return (
    <div className="space-y-3">
      <SectionHeader title={title} />
      <InlineTable variant="read" tableClassName="table-fixed min-w-[87rem]">
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell className={columnClasses.number}>Number</InlineTableHeaderCell>
            <InlineTableHeaderCell className={columnClasses.title}>Title</InlineTableHeaderCell>
            <InlineTableHeaderCell className={columnClasses.status}>Status</InlineTableHeaderCell>
            <InlineTableHeaderCell className={columnClasses.related}>{relatedHeading}</InlineTableHeaderCell>
            <InlineTableHeaderCell className={columnClasses.amount}>Amount</InlineTableHeaderCell>
            <InlineTableHeaderCell className={columnClasses.schedule}>Schedule</InlineTableHeaderCell>
            <InlineTableHeaderCell className={columnClasses.created}>Date Created</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          {isLoading ? (
            <InlineTableRow>
              <InlineTableCell colSpan={7} className="py-4 text-center text-muted-foreground">
                {loadingLabel}
              </InlineTableCell>
            </InlineTableRow>
          ) : (
            rows.map((row) => (
              <InlineTableRow key={row.key}>
                <InlineTableCell className={columnClasses.number}>{row.number}</InlineTableCell>
                <InlineTableCell className={columnClasses.title}>{row.title}</InlineTableCell>
                <InlineTableCell className={columnClasses.status}>{row.status}</InlineTableCell>
                <InlineTableCell className={columnClasses.related}>{row.related}</InlineTableCell>
                <InlineTableCell className={columnClasses.amount}>{row.amount}</InlineTableCell>
                <InlineTableCell className={columnClasses.schedule}>{row.schedule}</InlineTableCell>
                <InlineTableCell className={columnClasses.created}>{row.created}</InlineTableCell>
              </InlineTableRow>
            ))
          )}
        </InlineTableBody>
      </InlineTable>
    </div>
  );
}
