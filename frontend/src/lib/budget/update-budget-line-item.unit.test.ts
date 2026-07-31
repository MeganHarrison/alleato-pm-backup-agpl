import { ApiError, apiFetch } from "@/lib/api-client";
import {
  formatBudgetCreateError,
  formatBudgetUpdateError,
  updateBudgetLineItem,
} from "./update-budget-line-item";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return {
    ...actual,
    apiFetch: jest.fn(),
  };
});

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("formatBudgetCreateError", () => {
  it("preserves the server error message for budget creation failures", () => {
    const error = new Error("Budget line items are locked by accounting sync.");

    expect(formatBudgetCreateError(error)).toBe(
      "Budget line items are locked by accounting sync.",
    );
  });

  it("includes the request id when budget creation fails through apiFetch", () => {
    const error = new ApiError(500, {
      error_message: "Budget creation failed because the budget is locked.",
      request_id: "req_budget_create_123",
    });

    expect(formatBudgetCreateError(error)).toBe(
      "Budget creation failed because the budget is locked. | Request ID: req_budget_create_123",
    );
  });
});

describe("formatBudgetUpdateError", () => {
  it("preserves the server error message and request id for support/debugging", () => {
    const error = new ApiError(500, {
      error_message: "Budget line update failed because the record is locked.",
      request_id: "req_budget_123",
    });

    expect(formatBudgetUpdateError(error)).toBe(
      "Budget line update failed because the record is locked. | Request ID: req_budget_123",
    );
  });

  it("falls back to a stable message when the thrown value is opaque", () => {
    expect(formatBudgetUpdateError(null)).toBe(
      "An unexpected error occurred while saving the budget line.",
    );
  });
});

describe("updateBudgetLineItem", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(undefined as never);
  });

  it("sends unit_of_measure through the shared budget update payload", async () => {
    await updateBudgetLineItem("760", "line-1", {
      quantity: 3,
      uom: "ea",
      unitCost: 3921,
      originalAmount: 11763,
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/projects/760/budget/lines/line-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          quantity: 3,
          unit_of_measure: "ea",
          unit_cost: 3921,
          original_amount: 11763,
        }),
      }),
    );
  });
});
