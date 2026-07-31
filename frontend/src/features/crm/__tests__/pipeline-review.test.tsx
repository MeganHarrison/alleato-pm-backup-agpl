/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import {
  CRM_REVIEW_DEALS,
  CRM_REVIEW_FOLLOW_UPS,
  CRM_REVIEW_SETTINGS,
  CRM_REVIEW_STAGES,
} from "@/lib/crm/local-review-data";
import { CrmPipelineReview } from "@/features/crm/pipeline-review";

jest.mock("next/navigation", () => ({
  usePathname: () => "/crm/pipeline",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/hooks/use-crm", () => ({
  useCrmWorkspace: () => ({
    deals: CRM_REVIEW_DEALS,
    stages: CRM_REVIEW_STAGES,
    followUps: CRM_REVIEW_FOLLOW_UPS,
    settings: CRM_REVIEW_SETTINGS,
    archivedDealIds: [],
    moveDeal: jest.fn(),
  }),
}));

describe("CRM pipeline action hygiene", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-29T14:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the next scheduled task and explains missing next actions", () => {
    render(<CrmPipelineReview />);

    expect(screen.getAllByText("Next action").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Schedule controls discovery · Jul 30, 2026"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("No next action").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("No open CRM task is scheduled for today or later.")
        .length,
    ).toBeGreaterThan(0);
  });

  it("offers pipeline hygiene filters without crowding the board", () => {
    render(<CrmPipelineReview />);

    expect(
      screen.getByRole("combobox", { name: "Pipeline hygiene filter" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("crm-pipeline-board")).toBeInTheDocument();
    expect(
      screen
        .getByTestId("crm-pipeline-board")
        .closest(".max-w-screen-2xl"),
    ).toBeInTheDocument();
  });
});
