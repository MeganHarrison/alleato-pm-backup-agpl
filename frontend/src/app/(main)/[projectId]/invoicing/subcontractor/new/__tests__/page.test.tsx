/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useBillingPeriodsList } from "@/hooks/use-billing-periods";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import NewSubcontractorInvoicePage from "../page";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "42" }),
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/42/invoicing/subcontractor/new",
  useSearchParams: () =>
    new URLSearchParams(
      "commitmentType=subcontract&commitmentId=commitment-1",
    ),
}));

jest.mock("@/hooks/use-billing-periods", () => ({
  useBillingPeriodsList: jest.fn(),
}));

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const useBillingPeriodsListMock =
  useBillingPeriodsList as jest.MockedFunction<typeof useBillingPeriodsList>;
const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;
const toastErrorMock = toast.error as jest.MockedFunction<typeof toast.error>;
const openBillingPeriod = {
  id: "period-1",
  project_id: 42,
  name: "July 2026",
  start_date: "2026-07-01",
  end_date: "2026-07-31",
  due_date: "2026-08-10",
  is_closed: false,
  period_number: 7,
  closed_by: null,
  closed_date: null,
  created_at: null,
  updated_at: null,
};

describe("NewSubcontractorInvoicePage billing-period defaults", () => {
  beforeAll(() => {
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    useBillingPeriodsListMock.mockReturnValue({
      data: [openBillingPeriod],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBillingPeriodsList>);
    apiFetchMock.mockImplementation(async (url, options) => {
      const requestUrl = String(url);
      if (options?.method === "POST") {
        return { data: { id: 99 } };
      }
      if (requestUrl.endsWith("/invoices")) {
        return { line_items: [] };
      }
      if (requestUrl.endsWith("/change-orders")) {
        return { data: [] };
      }
      return {
        data: {
          contract_number: "SC-001",
          title: "Drywall",
          company_name: "Example Subcontractor",
        },
      };
    });
  });

  it("prefills all invoice dates from the open billing period", async () => {
    render(<NewSubcontractorInvoicePage />);

    await waitFor(() => {
      expect(useBillingPeriodsListMock).toHaveBeenCalledWith("42", {
        is_closed: false,
      });
    });

    expect(
      await screen.findByRole("button", { name: "Period Start" }),
    ).toHaveTextContent("July 1st, 2026");
    expect(
      screen.getByRole("button", { name: "Period End" }),
    ).toHaveTextContent("July 31st, 2026");
    expect(
      screen.getByRole("button", { name: "Billing Date" }),
    ).toHaveTextContent("July 31st, 2026");
  });

  it("submits the populated current billing-period dates", async () => {
    render(<NewSubcontractorInvoicePage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Save as Draft" }),
    );

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([url, options]) =>
            String(url) ===
              "/api/projects/42/invoicing/subcontractor/invoices" &&
            options?.method === "POST",
        ),
      ).toBe(true);
    });
    const createCall = apiFetchMock.mock.calls.find(
      ([url, options]) =>
        String(url) === "/api/projects/42/invoicing/subcontractor/invoices" &&
        options?.method === "POST",
    );
    const body = JSON.parse(String(createCall?.[1]?.body)) as Record<
      string,
      unknown
    >;

    expect(body).toMatchObject({
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      billing_date: "2026-07-31",
    });
    expect(body).not.toHaveProperty("billing_period_id");
  });

  it("does not overwrite a date the user entered before the period loads", async () => {
    useBillingPeriodsListMock.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    } as ReturnType<typeof useBillingPeriodsList>);
    const { rerender } = render(<NewSubcontractorInvoicePage />);
    const periodStart = await screen.findByRole("button", {
      name: "Period Start",
    });

    fireEvent.click(periodStart);
    fireEvent.click(screen.getByRole("button", { name: /15th/ }));
    const manualDateLabel = periodStart.textContent;

    useBillingPeriodsListMock.mockReturnValue({
      data: [openBillingPeriod],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBillingPeriodsList>);
    rerender(<NewSubcontractorInvoicePage />);

    await waitFor(() => {
      expect(periodStart).toHaveTextContent(manualDateLabel ?? "");
      expect(
        screen.getByRole("button", { name: "Period End" }),
      ).toHaveTextContent("July 31st, 2026");
      expect(
        screen.getByRole("button", { name: "Billing Date" }),
      ).toHaveTextContent("July 31st, 2026");
    });
  });

  it("surfaces a recoverable error when billing-period dates cannot load", async () => {
    useBillingPeriodsListMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("Billing period service unavailable."),
    } as ReturnType<typeof useBillingPeriodsList>);

    render(<NewSubcontractorInvoicePage />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Billing period dates could not be loaded",
        {
          description:
            "Billing period service unavailable. Refresh the page or enter the invoice dates manually.",
        },
      );
    });
    expect(
      await screen.findByRole("button", { name: "Period Start" }),
    ).toHaveTextContent("Pick a date");
  });

  it("fails loudly when the project has no open billing period", async () => {
    useBillingPeriodsListMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBillingPeriodsList>);

    render(<NewSubcontractorInvoicePage />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "No billing period is open for this project",
        {
          description:
            "Open or create a billing period before creating this invoice.",
        },
      );
    });
  });
});
