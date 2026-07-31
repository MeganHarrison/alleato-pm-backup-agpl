const login = jest.fn();
const getProjectBudgetSummary = jest.fn();
const getBills = jest.fn();
const getInvoices = jest.fn();
const getPurchaseOrders = jest.fn();
const createAcumaticaClient = jest.fn(() => ({
  login,
  getBills,
  getInvoices,
  getProjectBudgetSummary,
  getPurchaseOrders,
}));

jest.mock("ai", () => ({
  tool: (definition: unknown) => definition,
}));

jest.mock("@/lib/acumatica/client", () => ({
  createAcumaticaClient: (...args: unknown[]) =>
    createAcumaticaClient(...args),
}));

import {
  createAcumaticaTools,
  normalizeAcumaticaDate,
  normalizeAcumaticaText,
} from "../acumatica";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("normalizeAcumaticaDate", () => {
  it("keeps valid dates and converts missing provider wrappers to null", () => {
    expect(normalizeAcumaticaDate("2026-07-31T00:00:00+00:00")).toBe(
      "2026-07-31T00:00:00+00:00",
    );
    expect(
      normalizeAcumaticaDate({ value: "2026-08-01T00:00:00+00:00" }),
    ).toBe("2026-08-01T00:00:00+00:00");
    expect(normalizeAcumaticaDate({})).toBeNull();
    expect(normalizeAcumaticaDate({ value: null })).toBeNull();
    expect(normalizeAcumaticaText({})).toBeNull();
  });
});

it("executes the Acumatica budget adapter with its provider-specific project code", async () => {
  getProjectBudgetSummary.mockResolvedValue({
    projectId: "26119",
    projectDescription: "26-119 Union Collective KY",
    projectStatus: "Active",
    customer: "Union Collective",
    linesByType: {
      income: [],
      expense: [
        {
          CostCode: "01-000",
          Description: {},
          Type: "Expense",
          OriginalBudgetedAmount: 100,
          RevisedBudgetedAmount: 125,
          ActualAmount: 25,
          RevisedCommittedAmount: 50,
        },
      ],
    },
    totals: {
      income: 200,
      expenses: 125,
    },
    lineCount: 1,
    asOf: "2026-07-31T00:00:00.000Z",
  });

  const tool = createAcumaticaTools(
    "00000000-0000-4000-8000-000000000001",
  ).getAcumaticaProjectBudget;
  const result = await tool.execute!(
    {
      acumaticaProjectId: "26119",
      typeFilter: "all",
    },
    {
      toolCallId: "call-1",
      messages: [],
      abortSignal: new AbortController().signal,
    },
  );

  expect(login).toHaveBeenCalledTimes(1);
  expect(getProjectBudgetSummary).toHaveBeenCalledWith("26119");
  expect(result).toMatchObject({
    sourceRef:
      "[Source: Acumatica Project Budget - 26-119 Union Collective KY (26119)]",
    project: {
      id: "26119",
    },
    lineCount: {
      total: 1,
      withActivity: 1,
    },
    budgetLines: [
      expect.objectContaining({
        costCode: "01-000",
        description: null,
      }),
    ],
  });
  expect(result).not.toHaveProperty("error");
});

it("normalizes missing provider wrappers across bill, invoice, and purchase-order rows", async () => {
  getBills.mockResolvedValue([
    {
      ReferenceNbr: "B-1",
      Vendor: "VENDOR",
      Date: {},
      DueDate: {},
      Amount: 10,
      Balance: 5,
      Status: "Open",
      Description: {},
    },
  ]);
  getInvoices.mockResolvedValue([
    {
      ReferenceNbr: "I-1",
      Customer: "CUSTOMER",
      Date: {},
      DueDate: {},
      Amount: 20,
      Balance: 10,
      Status: "Open",
      Description: {},
    },
  ]);
  getPurchaseOrders.mockResolvedValue([
    {
      OrderNbr: "PO-1",
      Vendor: {},
      Date: {},
      Status: "Open",
      OrderTotal: 30,
      BilledAmount: 0,
      Description: {},
    },
  ]);

  const tools = createAcumaticaTools(
    "00000000-0000-4000-8000-000000000001",
  );
  const context = {
    toolCallId: "call-1",
    messages: [],
    abortSignal: new AbortController().signal,
  };
  const bills = (await tools.getRecentBills.execute!(
    { status: undefined, limit: 1 },
    context,
  )) as { bills: Array<Record<string, unknown>> };
  const invoices = (await tools.getRecentInvoices.execute!(
    { status: undefined, limit: 1 },
    context,
  )) as { invoices: Array<Record<string, unknown>> };
  const purchaseOrders = (await tools.getPurchaseOrderSummary.execute!(
    { status: undefined, limit: 1 },
    context,
  )) as { purchaseOrders: Array<Record<string, unknown>> };

  expect(bills.bills[0]).toMatchObject({
    date: null,
    dueDate: null,
    description: null,
  });
  expect(invoices.invoices[0]).toMatchObject({
    date: null,
    dueDate: null,
    description: null,
  });
  expect(purchaseOrders.purchaseOrders[0]).toMatchObject({
    vendor: null,
    date: null,
    description: null,
  });
});
