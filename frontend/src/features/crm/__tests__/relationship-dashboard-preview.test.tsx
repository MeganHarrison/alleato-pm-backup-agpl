/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  CRM_PREVIEW_ACCOUNTS,
  CrmRelationshipDashboardPreview,
} from "../relationship-dashboard-preview";

const replace = jest.fn();
const push = jest.fn();
const createLead = jest.fn();
const addDeal = jest.fn();

Object.defineProperties(HTMLElement.prototype, {
  hasPointerCapture: {
    configurable: true,
    value: jest.fn(() => false),
  },
  setPointerCapture: {
    configurable: true,
    value: jest.fn(),
  },
  releasePointerCapture: {
    configurable: true,
    value: jest.fn(),
  },
  scrollIntoView: {
    configurable: true,
    value: jest.fn(),
  },
});

jest.mock("next/navigation", () => ({
  usePathname: () => "/crm",
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/hooks/use-crm", () => ({
  useCrmWorkspace: () => ({
    accounts: [],
    leads: [],
    deals: [],
    activities: [],
    followUps: [],
    archivedAccountIds: [],
    archivedDealIds: [],
    addDeal,
    createLead,
    restoreAccount: jest.fn(),
    archiveAccount: jest.fn(),
    isLoading: false,
    error: null,
  }),
}));

describe("CRM relationship dashboard preview", () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    addDeal.mockReset();
    createLead.mockReset();
    createLead.mockResolvedValue({ id: "lead-new" });
  });

  it("shows the attention decision and filters relationships through the visible search", async () => {
    render(
      <CrmRelationshipDashboardPreview
        accounts={CRM_PREVIEW_ACCOUNTS}
        state="ready"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "CRM relationships" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Shared relationship health, pipeline, and follow-up work",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Open pipeline")).not.toBeInTheDocument();
    expect(screen.queryByText("Weighted pipeline")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Northline Distribution").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Search table" })[0]);
    fireEvent.change(
      screen.getByPlaceholderText("Search accounts, owners, or reasons..."),
      { target: { value: "Riverview" } },
    );

    await waitFor(() => {
      expect(screen.getAllByText("Riverview Health").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("Northline Distribution")).toHaveLength(0);
    });
  });

  it("fails loudly without presenting preview rows as live data", () => {
    render(
      <CrmRelationshipDashboardPreview
        accounts={CRM_PREVIEW_ACCOUNTS}
        state="error"
      />,
    );

    expect(screen.getByText("CRM preview could not load")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Reload the CRM workspace. Partial results are not displayed.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Northline Distribution"),
    ).not.toBeInTheDocument();
  });

  it("describes a genuinely empty production workspace accurately", () => {
    render(<CrmRelationshipDashboardPreview state="ready" />);

    expect(screen.getByText("No relationship records yet")).toBeInTheDocument();
    expect(
      screen.getByText("No CRM relationships have been added yet."),
    ).toBeInTheDocument();
  });

  it("adds a lead relationship without requiring a deal", async () => {
    render(<CrmRelationshipDashboardPreview state="ready" />);

    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Organization name" }),
      { target: { value: "New Prospect Company" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Primary contact" }),
      { target: { value: "Taylor Prospect" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Email" }),
      { target: { value: "taylor@example.com" } },
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Create lead" }).closest("form")!,
    );

    await waitFor(() => {
      expect(createLead).toHaveBeenCalledWith({
        prospectCompanyName: "New Prospect Company",
        fullName: "Taylor Prospect",
        email: "taylor@example.com",
        phone: "",
      });
      expect(addDeal).not.toHaveBeenCalled();
    });
  });
});
