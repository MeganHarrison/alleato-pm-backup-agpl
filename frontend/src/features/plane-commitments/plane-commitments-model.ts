/**
 * Adapted from Plane's issue-list filtering and row presentation model at
 * revision 39856932cd6b9bd17eab0920506d628190b47af2.
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { CommitmentListItem } from "@/lib/validation/commitments";

export const COMMITMENT_STATUS_FILTERS = [
  "all",
  "Draft",
  "Out for Bid",
  "Out for Signature",
  "Approved",
  "Complete",
  "Terminated",
] as const;

export const COMMITMENT_TYPE_FILTERS = [
  "all",
  "subcontract",
  "purchase_order",
] as const;

export type CommitmentStatusFilter = (typeof COMMITMENT_STATUS_FILTERS)[number];
export type CommitmentTypeFilter = (typeof COMMITMENT_TYPE_FILTERS)[number];

export function formatCommitmentCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCommitmentType(value: string): string {
  return value === "purchase_order" ? "Purchase order" : "Subcontract";
}

export function commitmentSearchText(item: CommitmentListItem): string {
  return [
    item.number,
    item.title,
    item.contract_company?.name,
    item.scope_summary,
    item.trade_names.join(" "),
    item.cost_codes.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesCommitmentQuery(
  item: CommitmentListItem,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  return !normalized || commitmentSearchText(item).includes(normalized);
}
