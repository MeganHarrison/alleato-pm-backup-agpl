/**
 * Adapted from Plane's issue-list presentation model at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { PrimeContract } from "@/lib/validation/prime-contracts";

export const PRIME_CONTRACT_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "out_for_signature", label: "Out for Signature" },
  { value: "approved", label: "Approved" },
  { value: "complete", label: "Complete" },
  { value: "terminated", label: "Terminated" },
] as const;

export type PrimeContractStatusFilter =
  (typeof PRIME_CONTRACT_STATUS_FILTERS)[number]["value"];

export function formatPrimeContractStatus(
  status: PrimeContract["status"],
): string {
  if (!status) return "No status";
  return (
    PRIME_CONTRACT_STATUS_FILTERS.find((option) => option.value === status)
      ?.label ?? status.replaceAll("_", " ")
  );
}

export function formatPrimeContractCurrency(
  value: number | null | undefined,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function primeContractSearchText(contract: PrimeContract): string {
  return [
    contract.contract_number,
    contract.title,
    contract.client?.name,
    contract.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
