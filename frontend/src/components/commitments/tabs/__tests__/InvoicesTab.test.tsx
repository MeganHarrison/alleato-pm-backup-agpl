/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { InvoicesTab } from "../InvoicesTab";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("InvoicesTab", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("renders retainage-aware commitment invoice list values", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        data: [
          {
            id: 100,
            invoice_number: "APP-01",
            period_start: "2026-04-01",
            period_end: "2026-04-30",
            billing_date: "2026-04-30",
            status: "draft",
            is_retainage_release: true,
            total_completed: 3500,
            total_retainage: 350,
            net_amount: 3150,
            total_contract_amount: 10000,
            original_contract_sum: 9500,
            net_change_by_cos: 500,
            percent_complete: 40,
          },
        ],
      }),
      headers: new Headers({ "content-type": "application/json" }),
    } as Response);

    (globalThis as typeof globalThis & { fetch: typeof fetchMock }).fetch =
      fetchMock;

    render(
      <InvoicesTab
        commitmentId="commitment-1"
        projectId="42"
        commitmentType="subcontract"
      />,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/42/invoicing/subcontractor/invoices?subcontract_id=commitment-1",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    expect(await screen.findByText("APP-01")).toBeInTheDocument();
    expect(screen.getByText("Retainage Release")).toBeInTheDocument();
    expect(screen.getAllByText("$350.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$3,150.00").length).toBeGreaterThan(0);
  });
});
