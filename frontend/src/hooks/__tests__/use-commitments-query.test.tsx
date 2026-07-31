/**
 * @jest-environment jsdom
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

import { useCommitments } from "../use-commitments-query";
import type { CommitmentListResponse } from "@/lib/validation/commitments";

const apiFetchMock = jest.fn();

jest.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const PROJECT_ID = "1141";

function commitmentResponse(): CommitmentListResponse {
  return {
    data: [
      {
        id: "commitment-1",
        project_id: 1141,
        number: "SC-001",
        title: "Structural Steel Subcontract",
        type: "subcontract",
        status: "approved",
        executed: true,
        original_amount: 100000,
        revised_contract_amount: 100000,
        billed_to_date: 0,
        balance_to_finish: 100000,
        contract_company_id: "company-1",
        contract_company: { id: "company-1", name: "Acme Steel" },
        description: null,
        start_date: null,
        executed_date: null,
        retention_percentage: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        erp_status: null,
        ssov_status: null,
        approved_change_orders: 0,
        pending_change_orders: 0,
        draft_change_orders: 0,
        invoiced_amount: 0,
        payments_issued: 0,
        percent_paid: 0,
        remaining_balance: 100000,
        cost_codes: [],
        trade_names: [],
        scope_summary: null,
        is_private: false,
      },
    ],
    meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe("useCommitments", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  // Regression: the New Invoice form called useCommitments() with no projectId,
  // which fed an empty string into a query gated `enabled: !!projectId`, so the
  // commitment dropdown was always empty. Passing a projectId must load options.
  it("loads commitment options for a given projectId", async () => {
    apiFetchMock.mockResolvedValue(commitmentResponse());

    const { result } = renderHook(() => useCommitments(PROJECT_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = apiFetchMock.mock.calls[0]![0] as string;
    expect(requestedUrl).toContain(`projectId=${PROJECT_ID}`);

    expect(result.current.options).toEqual([
      {
        value: "commitment-1",
        label: "SC-001 - Structural Steel Subcontract",
        commitmentNumber: "SC-001",
        type: "subcontract",
        amount: 100000,
      },
    ]);
  });

  it("does not fetch when no projectId is supplied", async () => {
    const { result } = renderHook(() => useCommitments(), {
      wrapper: createWrapper(),
    });

    // Query is disabled with no projectId — nothing is fetched and no options load.
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.options).toEqual([]);
  });
});
