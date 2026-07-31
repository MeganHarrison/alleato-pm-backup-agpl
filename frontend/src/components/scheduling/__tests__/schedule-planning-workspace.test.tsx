/** @jest-environment jsdom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  getScheduleWorkspace,
  SchedulePlanningWorkspace,
  ScheduleWorkspaceNavigation,
} from "../schedule-planning-workspace";

const mockRevisionControls = jest.fn(() => <div>Revision controls</div>);
const mockLookahead = jest.fn(() => <div>Construction lookahead</div>);
const mockRiskSummary = jest.fn(() => <div>Schedule risks</div>);
const mockTradeActivities = jest.fn(() => <div>Assigned activities</div>);
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/43/schedule",
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("../schedule-revision-controls", () => ({
  ScheduleRevisionControls: (props: unknown) => mockRevisionControls(props),
}));
jest.mock("../schedule-lookahead", () => ({
  ScheduleLookahead: (props: unknown) => mockLookahead(props),
}));
jest.mock("../schedule-risk-summary", () => ({
  ScheduleRiskSummary: (props: unknown) => mockRiskSummary(props),
}));
jest.mock("../trade-schedule-activities", () => ({
  TradeScheduleActivities: (props: unknown) => mockTradeActivities(props),
}));

const baseProps = {
  projectId: "43",
  revisions: [
    {
      id: "revision-published",
      status: "published" as const,
      revision_number: 4,
      published_at: "2026-07-29T00:00:00.000Z",
    },
  ],
  baselines: [],
  canManageBaselines: false,
  onSnapshot: jest.fn(),
  onTransition: jest.fn(),
  onCaptureBaseline: jest.fn(),
  onActivateBaseline: jest.fn(),
  lookaheadStartDate: "2026-07-29",
  resourceAvailability: <div>Resource availability</div>,
};

describe("SchedulePlanningWorkspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps every planning module under one focused workspace owner", () => {
    render(<SchedulePlanningWorkspace {...baseProps} />);

    expect(
      screen.getByRole("heading", {
        name: "Resources, costs, publishing, and reports",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Resource availability")).toBeInTheDocument();
    expect(screen.getByText("Revision controls")).toBeInTheDocument();
    expect(screen.getByText("Construction lookahead")).toBeInTheDocument();
    expect(screen.getByText("Schedule risks")).toBeInTheDocument();
    expect(screen.getByText("Assigned activities")).toBeInTheDocument();
  });

  it("pins reports to the published revision", () => {
    render(<SchedulePlanningWorkspace {...baseProps} />);

    expect(mockLookahead).toHaveBeenCalledWith(
      expect.objectContaining({ revisionId: "revision-published" }),
    );
    expect(mockRiskSummary).toHaveBeenCalledWith(
      expect.objectContaining({ revisionId: "revision-published" }),
    );
    expect(mockTradeActivities).toHaveBeenCalledWith(
      expect.objectContaining({ revisionId: "revision-published" }),
    );
  });

  it("maps URL state and navigation to the correct accessible workspace", () => {
    expect(getScheduleWorkspace(new URLSearchParams())).toBe("schedule");
    expect(
      getScheduleWorkspace(new URLSearchParams("workspace=planning")),
    ).toBe("planning");
    expect(
      getScheduleWorkspace(new URLSearchParams("workspace=unsupported")),
    ).toBe("schedule");

    const { rerender } = render(
      <ScheduleWorkspaceNavigation projectId="43" workspace="schedule" />,
    );
    const scheduleTab = screen.getByRole("button", { name: "Schedule" });
    const planningTab = screen.getByRole("button", {
      name: "Resources, costs, leveling, revisions & reports",
    });

    expect(scheduleTab).toHaveAttribute("aria-current", "page");
    expect(planningTab).not.toHaveAttribute("aria-current");
    fireEvent.click(planningTab);
    expect(mockPush).toHaveBeenCalledWith("/43/schedule?workspace=planning");

    rerender(
      <ScheduleWorkspaceNavigation projectId="43" workspace="planning" />,
    );
    expect(scheduleTab).not.toHaveAttribute("aria-current");
    expect(planningTab).toHaveAttribute("aria-current", "page");
  });

  it("explains how to activate revision-backed reports", () => {
    render(<SchedulePlanningWorkspace {...baseProps} revisions={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Snapshot the current schedule, open Revision history, select Request review, then Publish revision",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Publishing activates lookahead, risk, and trade reports",
    );
  });

  it("keeps the page wired to the durable owner and isolates task errors", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "src/app/(main)/[projectId]/schedule/page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("getScheduleWorkspace(searchParams)");
    expect(pageSource).toContain("<SchedulePlanningWorkspace");
    expect(pageSource).toContain(
      "{(isPlanningWorkspace || (!isLoading && !error)) && (",
    );
    expect(pageSource).toContain(
      "Resource task context is unavailable: ${error.message}",
    );
    expect(pageSource).not.toContain(
      'import { ScheduleLookahead } from "@/components/scheduling/schedule-lookahead"',
    );
  });
});
