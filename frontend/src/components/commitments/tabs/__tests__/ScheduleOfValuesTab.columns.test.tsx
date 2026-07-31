/**
 * @jest-environment jsdom
 *
 * Guardrail for the SOV totals-alignment bug class.
 *
 * The Schedule of Values footer once emitted one cell too many, shifting the
 * Billed and Remaining totals a column to the right. That bug was invisible to
 * TypeScript and ESLint. This test renders the real component and asserts the
 * footer/body column spans match the header in BOTH accounting methods, so the
 * drift cannot recur silently.
 */

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ScheduleOfValuesTab } from "../ScheduleOfValuesTab";
import { apiFetch } from "@/lib/api-client";
import { assertTableColumnIntegrity } from "@/test-utils/table-column-integrity";

// The component fetches budget-code options from the cost_codes table; stub it
// so the render is synchronous and data-independent.
jest.mock("@/hooks/use-cost-codes", () => ({
  useCostCodes: () => ({ options: [], isLoading: false }),
}));

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(async () => ({ budgetCodes: [] })),
}));

const lineItems = [
  {
    id: "line-1",
    line_number: 1,
    budget_code: "024113",
    description: "Demolition",
    amount: 25120,
    billed_to_date: 0,
    quantity: 4,
    uom: "EA",
    unit_cost: 6280,
  },
  {
    id: "line-2",
    line_number: 2,
    budget_code: "033000",
    description: "Concrete",
    amount: 18000,
    billed_to_date: 5000,
    quantity: 2,
    uom: "EA",
    unit_cost: 9000,
  },
];

function renderTab(accountingMethod: "amount" | "unit") {
  return render(
    <ScheduleOfValuesTab
      lineItems={lineItems}
      projectId={25125}
      commitmentId="test-commitment"
      commitmentType="subcontract"
      accountingMethod={accountingMethod}
    />,
  );
}

function renderLockedTab(accountingMethod: "amount" | "unit") {
  return render(
    <ScheduleOfValuesTab
      lineItems={lineItems}
      projectId={25125}
      commitmentId="test-commitment"
      commitmentType="subcontract"
      accountingMethod={accountingMethod}
      lockState={{
        locked: true,
        reason: "submitted_invoice",
        message: "This schedule of values is locked.",
      }}
    />,
  );
}

function renderApprovedStatusTab() {
  return render(
    <ScheduleOfValuesTab
      lineItems={lineItems}
      projectId={25125}
      commitmentId="test-commitment"
      commitmentType="subcontract"
      accountingMethod="amount"
      status="approved"
      lockState={{
        locked: false,
        reason: null,
        message: null,
      }}
    />,
  );
}

function renderTabWithSummary() {
  return render(
    <ScheduleOfValuesTab
      lineItems={lineItems}
      projectId={25125}
      commitmentId="test-commitment"
      commitmentType="subcontract"
      accountingMethod="amount"
      summary={{
        subtotal: 43120,
        originalContract: 43120,
        approvedChanges: 1250,
        contractTotal: 44370,
        billedToDate: 5000,
        amountRemaining: 39370,
        currentRetainage: 555.56,
        retainagePercent: 10,
      }}
    />,
  );
}

describe("ScheduleOfValuesTab column integrity", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  async function waitForBudgetCodes() {
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
  }

  it("keeps header, body, and footer aligned in amount mode (7 columns)", async () => {
    const { container } = renderTab("amount");
    await waitForBudgetCodes();
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(assertTableColumnIntegrity(table as HTMLTableElement)).toBe(7);
  });

  it("keeps header, body, and footer aligned in unit mode (10 columns)", async () => {
    const { container } = renderTab("unit");
    await waitForBudgetCodes();
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(assertTableColumnIntegrity(table as HTMLTableElement)).toBe(10);
  });

  it("keeps header, body, and footer aligned in locked amount mode (6 columns)", async () => {
    const { container } = renderLockedTab("amount");
    await waitForBudgetCodes();
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(assertTableColumnIntegrity(table as HTMLTableElement)).toBe(6);
  });

  it("keeps header, body, and footer aligned in locked unit mode (9 columns)", async () => {
    const { container } = renderLockedTab("unit");
    await waitForBudgetCodes();
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(assertTableColumnIntegrity(table as HTMLTableElement)).toBe(9);
  });

  it("omits duplicate commitment SOV financial summary rows", async () => {
    renderTabWithSummary();
    await waitForBudgetCodes();

    expect(screen.queryByText("Line Items Total")).not.toBeInTheDocument();
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument();
    expect(screen.queryByText("Original Contract")).not.toBeInTheDocument();
    expect(screen.queryByText("Approved Changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Contract Total")).not.toBeInTheDocument();
    expect(screen.getAllByText("Billed to Date")).toHaveLength(1);
    expect(screen.queryByText("Amount Remaining")).not.toBeInTheDocument();
    expect(screen.queryByText(/Current Retainage/)).not.toBeInTheDocument();
    expect(screen.queryByText("$44,370.00")).not.toBeInTheDocument();
    expect(screen.queryByText("$555.56")).not.toBeInTheDocument();
  });

  it("does not render a retainage summary when no retainage is configured", async () => {
    render(
      <ScheduleOfValuesTab
        lineItems={lineItems}
        projectId={25125}
        commitmentId="test-commitment"
        commitmentType="subcontract"
        accountingMethod="amount"
        summary={{
          subtotal: 43120,
          originalContract: 43120,
          approvedChanges: 0,
          contractTotal: 43120,
          billedToDate: 0,
          amountRemaining: 43120,
          currentRetainage: 0,
          retainagePercent: 0,
        }}
      />,
    );
    await waitForBudgetCodes();

    expect(screen.queryByText("Current Retainage")).not.toBeInTheDocument();
    expect(screen.queryByText(/Current Retainage \(/)).not.toBeInTheDocument();
  });

  it("renders locked rows as read-only content instead of edit controls", async () => {
    renderLockedTab("amount");
    await waitForBudgetCodes();

    expect(screen.queryByRole("textbox", { name: /Description 1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move line 1 up/i })).not.toBeInTheDocument();
    expect(screen.getByText("Demolition")).toBeInTheDocument();
    // Read-only cell shows the stored budget_code text, never a raw "Unmapped:" prefix.
    expect(screen.getByText("024113")).toBeInTheDocument();
    expect(screen.queryByText(/^Unmapped:/)).not.toBeInTheDocument();
  });

  it("read-only cell falls back to stored budget_code text instead of a raw id when codes are unresolved", async () => {
    // Mirrors an imported/adopted SOV line: project_budget_code_id is a real UUID,
    // budget_code carries the human code, but the budget-codes option list is empty
    // (still loading / failed). The cell must show the human code, never "Unmapped: <uuid>".
    render(
      <ScheduleOfValuesTab
        lineItems={[
          {
            id: "line-x",
            line_number: 1,
            budget_code: "50-7000.S",
            project_budget_code_id: "035f4c1f-d2f0-4b78-b55d-93977365f932",
            description: "Fire Sprinkler Design",
            amount: 500000,
            billed_to_date: 0,
          },
        ]}
        projectId={879}
        commitmentId="test-commitment"
        commitmentType="subcontract"
        accountingMethod="amount"
        lockState={{ locked: true, reason: "submitted_invoice", message: "locked" }}
      />,
    );
    await waitForBudgetCodes();

    expect(screen.getByText("50-7000.S")).toBeInTheDocument();
    expect(
      screen.queryByText(/035f4c1f-d2f0-4b78-b55d-93977365f932/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Unmapped:/)).not.toBeInTheDocument();
  });

  it("forces approved commitments into read-only mode even if lockState says unlocked", async () => {
    renderApprovedStatusTab();
    await waitForBudgetCodes();

    expect(
      screen.getByText(
        "Schedule of Values is locked for approved contracts.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Add Line Item")).not.toBeInTheDocument();
    expect(screen.queryByText("Import from Budget")).not.toBeInTheDocument();
    expect(screen.queryByText("Save Changes")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Description 1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move line 1 up/i })).not.toBeInTheDocument();
  });
});
