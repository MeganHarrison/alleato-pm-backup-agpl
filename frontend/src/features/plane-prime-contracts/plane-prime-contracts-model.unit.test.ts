/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { PrimeContract } from "@/lib/validation/prime-contracts";

import {
  formatPrimeContractCurrency,
  formatPrimeContractStatus,
  primeContractSearchText,
} from "./plane-prime-contracts-model";

const contract: PrimeContract = {
  id: "prime-contract-1",
  project_id: 31,
  contract_number: "PC-001",
  title: "Owner construction agreement",
  client_id: "client-1",
  description: "Base contract for the All Implementation project",
  status: "out_for_signature",
  erp_status: "unsynced",
  executed: false,
  original_contract_value: 2500000,
  revised_contract_value: 2600000,
  created_at: "2026-07-31",
  updated_at: "2026-07-31",
  client: {
    id: "client-1",
    name: "Alleato Owner",
  },
  attachment_count: 0,
};

describe("Plane Prime Contracts model", () => {
  it("formats canonical status and financial values", () => {
    expect(formatPrimeContractStatus("out_for_signature")).toBe(
      "Out for Signature",
    );
    expect(formatPrimeContractStatus(null)).toBe("No status");
    expect(formatPrimeContractCurrency(2600000)).toBe("$2,600,000");
  });

  it("builds searchable text from the canonical list fields", () => {
    const searchText = primeContractSearchText(contract);

    expect(searchText).toContain("pc-001");
    expect(searchText).toContain("alleato owner");
    expect(searchText).toContain("all implementation project");
  });
});
