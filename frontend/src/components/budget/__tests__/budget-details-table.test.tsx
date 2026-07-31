/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import {
  BudgetDetailsTable,
  type BudgetDetailLineItem,
} from "../budget-details-table";

const rows: BudgetDetailLineItem[] = [
  {
    id: "commitment-1",
    budgetCode: "09-9123",
    budgetCodeDescription: "Painting",
    vendor: "Acme Paint",
    item: "SC-001",
    detailType: "commitments",
    status: "Approved",
    detailHref: "/876/commitments/commitment-1",
    committedCosts: 12500,
  },
  {
    id: "budget-1",
    budgetCode: "02-0000",
    budgetCodeDescription: "Existing Conditions",
    item: "Original Budget",
    detailType: "original_budget",
    status: "Current",
    originalBudgetAmount: 90000,
  },
];

describe("BudgetDetailsTable", () => {
  it("renders the read-only Procore Standard Budget report with source links", () => {
    render(<BudgetDetailsTable data={rows} />);

    expect(screen.getAllByText("Procore Standard Budget").length).toBeGreaterThan(0);
    expect(screen.getByText("Read-only budget detail report")).toBeInTheDocument();
    expect(screen.getAllByText("Budget Code").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Original Budget Amount").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending Cost Changes").length).toBeGreaterThan(0);

    const sourceLink = screen.getAllByRole("link", { name: "SC-001" })[0];
    expect(sourceLink).toHaveAttribute("href", "/876/commitments/commitment-1");
  });

  it("filters visible rows by budget code and keeps the row count honest", () => {
    render(<BudgetDetailsTable data={rows} />);

    fireEvent.change(screen.getByPlaceholderText("Filter budget code, vendor, or item"), {
      target: { value: "09-9123" },
    });

    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getAllByText("09-9123").length).toBeGreaterThan(0);
    expect(screen.queryByText("02-0000")).not.toBeInTheDocument();
  });
});
