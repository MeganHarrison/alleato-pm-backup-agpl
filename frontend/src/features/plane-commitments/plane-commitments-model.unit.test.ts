/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { CommitmentListItem } from "@/lib/validation/commitments";

import {
  commitmentSearchText,
  formatCommitmentCurrency,
  formatCommitmentType,
  matchesCommitmentQuery,
} from "./plane-commitments-model";

const commitment: CommitmentListItem = {
  id: "commitment-1",
  project_id: 31,
  number: "SC-001",
  title: "Concrete subcontract",
  type: "subcontract",
  status: "Draft",
  executed: false,
  original_amount: 125000,
  revised_contract_amount: 130000,
  billed_to_date: 25000,
  balance_to_finish: 105000,
  contract_company_id: "company-1",
  contract_company: {
    id: "company-1",
    name: "Acme Concrete",
  },
  description: null,
  start_date: null,
  executed_date: null,
  retention_percentage: 10,
  created_at: "2026-07-31",
  updated_at: "2026-07-31",
  erp_status: null,
  ssov_status: null,
  approved_change_orders: 5000,
  pending_change_orders: 0,
  draft_change_orders: 0,
  invoiced_amount: 25000,
  payments_issued: 20000,
  percent_paid: 19.23,
  remaining_balance: 105000,
  cost_codes: ["03-3000"],
  trade_names: ["Concrete"],
  scope_summary: "Foundations and slabs",
  is_private: false,
};

describe("Plane Commitments model", () => {
  it("builds search text from the canonical commitment list fields", () => {
    const searchText = commitmentSearchText(commitment);

    expect(searchText).toContain("sc-001");
    expect(searchText).toContain("acme concrete");
    expect(searchText).toContain("foundations and slabs");
    expect(matchesCommitmentQuery(commitment, "03-3000")).toBe(true);
    expect(matchesCommitmentQuery(commitment, "steel")).toBe(false);
  });

  it("formats commitment type and currency for the Plane list", () => {
    expect(formatCommitmentType("subcontract")).toBe("Subcontract");
    expect(formatCommitmentType("purchase_order")).toBe("Purchase order");
    expect(formatCommitmentCurrency(130000)).toBe("$130,000");
  });
});
