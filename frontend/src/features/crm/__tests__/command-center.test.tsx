/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { CrmCommandCenterContent } from "@/features/crm/command-center";
import {
  CRM_REVIEW_ACTIVITIES,
  CRM_REVIEW_DEALS,
  CRM_REVIEW_FOLLOW_UPS,
  CRM_REVIEW_SETTINGS,
} from "@/lib/crm/local-review-data";

jest.mock("next/navigation", () => ({
  usePathname: () => "/crm/command-center",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/hooks/use-crm", () => ({
  useCrmWorkspace: () => ({
    deals: CRM_REVIEW_DEALS,
    activities: [
      ...CRM_REVIEW_ACTIVITIES,
      {
        ...CRM_REVIEW_ACTIVITIES[0],
        id: "outlook-activity",
        recordOrigin: "auto",
        sourceSystem: "outlook",
      },
    ],
    followUps: CRM_REVIEW_FOLLOW_UPS,
    dealStageEvents: [],
    settings: CRM_REVIEW_SETTINGS,
    archivedDealIds: [],
  }),
}));

describe("CRM command center", () => {
  it("shows forecast, source health, pursuits, and evidence controls", () => {
    render(<CrmCommandCenterContent />);

    expect(screen.getByText("Forecast now")).toBeInTheDocument();
    expect(
      screen.getByText("Communication source activity"),
    ).toBeInTheDocument();
    expect(screen.getByText("CRM activity received")).toBeInTheDocument();
    expect(screen.getByText("Construction pursuits")).toBeInTheDocument();
    expect(screen.getByText("Evidence briefing")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Work CRM actions" }),
    ).toHaveAttribute("href", "/crm/tasks");
  });
});
