/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  CrmGrowthWorkspace,
  crmDealControlValues,
  parseBuildingConnectedCsv,
} from "@/features/crm/growth-workspace";
import {
  CRM_REVIEW_ACCOUNTS,
  CRM_REVIEW_ACTIVITIES,
  CRM_REVIEW_DEALS,
  CRM_REVIEW_FOLLOW_UPS,
  CRM_REVIEW_STAGES,
} from "@/lib/crm/local-review-data";
import { apiFetch } from "@/lib/api-client";

jest.mock("next/navigation", () => ({
  usePathname: () => "/crm/growth",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@/hooks/use-crm", () => ({
  useCrmWorkspace: () => ({
    accounts: CRM_REVIEW_ACCOUNTS,
    leads: [],
    deals: CRM_REVIEW_DEALS,
    activities: CRM_REVIEW_ACTIVITIES,
    followUps: CRM_REVIEW_FOLLOW_UPS,
    stages: CRM_REVIEW_STAGES.map((stage) => ({
      ...stage,
      pipelineId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    })),
    refresh: jest.fn(),
  }),
}));

const apiFetchMock = jest.mocked(apiFetch);

describe("CRM growth workspace", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({
      data: {
        connection: {
          personId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          connectionStatus: "consent_required",
          mailConnected: false,
          calendarConnected: false,
          grantedScopes: [],
          privacyMode: "business_only",
          automaticMatchingEnabled: false,
          lastSuccessfulSyncAt: null,
          lastError:
            "Microsoft consent has not been granted. CRM email and calendar sync is off.",
          updatedAt: new Date(0).toISOString(),
        },
        forecastSnapshots: [],
        stageRequirements: [],
        salesAssets: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            assetType: "cadence",
            name: "New lead follow-up",
            description: "Approved cadence",
            steps: [{ day: 0, title: "Call new lead" }],
            approvalStatus: "approved",
            createdByPersonId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            approvedAt: new Date().toISOString(),
          },
        ],
        relationshipIntelligence: [],
        aiArtifacts: [],
      },
    } as never);
  });

  it("exposes every remaining phase without claiming Microsoft is connected", async () => {
    render(<CrmGrowthWorkspace />);

    expect(
      await screen.findByText("Microsoft 365 connection"),
    ).toBeInTheDocument();
    expect(screen.getByText("Consent Required")).toBeInTheDocument();
    expect(screen.getByText(/Mail off · Calendar off/)).toBeInTheDocument();
    expect(
      screen.getByText("Forecast and pursuit controls"),
    ).toBeInTheDocument();
    expect(screen.getByText("Stage exit criteria")).toBeInTheDocument();
    expect(
      screen.getByText("Cadences, playbooks, and approved templates"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Construction relationship intelligence"),
    ).toBeInTheDocument();
    expect(screen.getByText("Governed CRM assistant")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Add to Actions" }),
    ).toBeEnabled();
    expect(
      screen.getByText(/does not require a BuildingConnected API/),
    ).toBeInTheDocument();
  });

  it("hydrates controls from the selected deal", () => {
    expect(
      crmDealControlValues({
        ...CRM_REVIEW_DEALS[0],
        forecastCategory: "commit",
        pursuitType: "invited_bid",
        bidDueDate: "2026-08-03T17:00:00.000Z",
        qualificationScore: 86,
        winLossNotes: "Decision maker confirmed.",
      }),
    ).toEqual({
      forecastCategory: "commit",
      pursuitType: "invited_bid",
      bidDueDate: "2026-08-03",
      qualificationScore: 86,
      winLossNotes: "Decision maker confirmed.",
    });
    expect(crmDealControlValues(CRM_REVIEW_DEALS[1]).forecastCategory).toBe(
      "pipeline",
    );
  });

  it("parses quoted BuildingConnected CSV safely and enforces row limits", () => {
    expect(
      parseBuildingConnectedCsv(
        'company,contact,trade,email\n"Smith, Inc.","Jane ""JJ"" Smith",Electrical,jane@example.com',
      ),
    ).toEqual({
      header: ["company", "contact", "trade", "email"],
      dataRows: [
        ["Smith, Inc.", 'Jane "JJ" Smith', "Electrical", "jane@example.com"],
      ],
    });
    const oversized = [
      "company,contact,trade,email",
      ...Array.from({ length: 101 }, (_, index) => `Company ${index},,,`),
    ].join("\n");
    expect(() => parseBuildingConnectedCsv(oversized)).toThrow(
      /limited to 100/,
    );
    expect(
      parseBuildingConnectedCsv(
        "Acme Company,Jane Smith,Electrical,jane@example.com",
      ).dataRows,
    ).toHaveLength(1);
  });

  it("preserves a sales asset draft when the save fails", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        data: {
          connection: {
            personId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            connectionStatus: "consent_required",
            mailConnected: false,
            calendarConnected: false,
            grantedScopes: [],
            privacyMode: "business_only",
            automaticMatchingEnabled: false,
            lastSuccessfulSyncAt: null,
            lastError: "Consent is required.",
            updatedAt: new Date(0).toISOString(),
          },
          forecastSnapshots: [],
          stageRequirements: [],
          salesAssets: [],
          relationshipIntelligence: [],
          aiArtifacts: [],
        },
      } as never)
      .mockRejectedValueOnce(new Error("Save rejected"));

    render(<CrmGrowthWorkspace />);
    await screen.findByText("Microsoft 365 connection");
    const name = screen.getByLabelText("Sales asset name");
    const steps = screen.getByLabelText("Sales asset steps");
    fireEvent.change(name, { target: { value: "Three-call cadence" } });
    fireEvent.change(steps, { target: { value: "Call lead" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/crm/operating-system/workspace",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(name).toHaveValue("Three-call cadence");
    expect(steps).toHaveValue("Call lead");
  });

  it("treats a committed save as successful when only refresh fails", async () => {
    apiFetchMock.mockImplementation((_url, init) =>
      init?.method === "POST"
        ? Promise.resolve({ data: {} } as never)
        : Promise.reject(new Error("Refresh unavailable")),
    );

    render(<CrmGrowthWorkspace />);
    const name = screen.getByLabelText("Sales asset name");
    const steps = screen.getByLabelText("Sales asset steps");
    fireEvent.change(name, { target: { value: "Committed cadence" } });
    fireEvent.change(steps, { target: { value: "Call lead" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));

    await waitFor(() => expect(name).toHaveValue(""));
    expect(steps).toHaveValue("");
    expect(
      apiFetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
  });
});
