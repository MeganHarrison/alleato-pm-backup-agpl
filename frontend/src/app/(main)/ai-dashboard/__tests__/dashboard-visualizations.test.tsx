/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import {
  matchesProjectFilter,
  type ExecutiveDashboardVisualizations,
} from "@/lib/ai-dashboard/dashboard-visualization-contract";
import { ExecutiveDashboardVisualizations as DashboardVisualizations } from "../visualizations/executive-dashboard-visualizations";
import { useAttentionFeed, useDashboardVisualizations } from "../live-data";

jest.mock("@/components/ui/charts", () => ({
  AreaChart: () => <div role="img" aria-label="Portfolio activity river" />,
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
}));

jest.mock("../visualizations/visualization-detail-slideover", () => ({
  VisualizationDetailSlideover: ({ selection }: { selection: { kind: string; key: string } | null }) =>
    selection ? <div role="dialog">{selection.kind}:{selection.key}</div> : null,
}));

jest.mock("../live-data", () => {
  const actual = jest.requireActual("../live-data");
  return {
    ...actual,
    useAttentionFeed: jest.fn(),
    useDashboardVisualizations: jest.fn(),
  };
});

const stage = (
  key: ExecutiveDashboardVisualizations["lifecycle"]["stages"][number]["key"],
  label: string,
  projectCount: number,
) => ({
  key,
  label,
  projectCount,
  totalValue: projectCount * 1_000_000,
  weightedValue: projectCount * 800_000,
  percentageOfLifecycle: projectCount * 5,
  valueCoverageCount: projectCount,
  missingValueCount: 0,
  averageDaysInStage: null,
  medianDaysInStage: null,
  overdueCount: null,
  conversionRate: null,
  priorPeriodChange: null,
  health: projectCount ? ("healthy" as const) : ("unavailable" as const),
  healthReason: projectCount ? "No current health exception" : "No current records",
  dataState: "confirmed" as const,
  highestValueProject: null,
  mostUrgentProject: null,
});

const fixture: ExecutiveDashboardVisualizations = {
  generatedAt: "2026-07-16T12:00:00Z",
  filters: { range: "7d", projectId: null, projects: [{ id: 17, name: "Carmel Build" }] },
  lifecycle: {
    source: { status: "incomplete", label: "Project lifecycle", detail: "Stage-transition history is not recorded.", recoveryHref: "/projects" },
    stages: [
      stage("lead", "Lead", 0),
      stage("qualification", "Qualification", 0),
      stage("estimating", "Estimating", 3),
      stage("proposal", "Proposal submitted", 0),
      stage("negotiation", "Contract negotiation", 0),
      stage("preconstruction", "Preconstruction", 12),
      stage("active", "Active construction", 6),
      stage("closeout", "Punch and closeout", 2),
      stage("completed", "Completed", 18),
    ],
    totalRecords: 113,
    incompleteRecordCount: 72,
    valueCoverageCount: 14,
    comparisonAvailable: false,
    insight: "Preconstruction contains the largest current concentration.",
  },
  activity: {
    source: { status: "ready", label: "Activity river", detail: "Current source records are aggregated before rendering.", recoveryHref: "/ai-dashboard/rag-pipeline" },
    range: "7d",
    buckets: [{ key: "1", label: "Jul 16", startAt: "2026-07-16T00:00:00Z", communication: 12, financial: 3, project_delivery: 19, intelligence: 7 }],
    categories: [
      { key: "communication", label: "Communication", total: 12, requiresActionCount: 0, highRiskCount: 0, changePercent: null, mostActiveProject: "Carmel Build", anomaly: null },
      { key: "financial", label: "Financial", total: 3, requiresActionCount: 2, highRiskCount: 1, changePercent: null, mostActiveProject: "Carmel Build", anomaly: null },
      { key: "project_delivery", label: "Project delivery", total: 19, requiresActionCount: 4, highRiskCount: 1, changePercent: null, mostActiveProject: "Carmel Build", anomaly: null },
      { key: "intelligence", label: "Intelligence", total: 7, requiresActionCount: 3, highRiskCount: 2, changePercent: null, mostActiveProject: "Carmel Build", anomaly: null },
    ],
    totalEvents: 41,
    activeProjectCount: 1,
    requiringActionCount: 9,
    highRiskCount: 4,
    quietProjects: [],
    sampled: false,
    sourceRecordCount: 41,
    insight: "Project delivery accelerated this week.",
  },
  opportunities: {
    source: { status: "incomplete", label: "AI opportunities", detail: "Validated impact values are unavailable.", recoveryHref: "/ai-dashboard/rag-pipeline" },
    categories: [
      { key: "cost_savings", label: "Cost savings", count: 2, averageConfidence: 0.9, urgency: 0.8, executiveActionCount: 1, totalImpact: null, priorPeriodChange: null, highestPriorityTitle: "Resolve duplicate exposure", dataState: "ai_inference" },
      { key: "revenue_growth", label: "Revenue growth", count: 0, averageConfidence: 0, urgency: 0, executiveActionCount: 0, totalImpact: null, priorPeriodChange: null, highestPriorityTitle: null, dataState: "ai_inference" },
      { key: "schedule_acceleration", label: "Schedule acceleration", count: 1, averageConfidence: 0.65, urgency: 0.7, executiveActionCount: 1, totalImpact: null, priorPeriodChange: null, highestPriorityTitle: "Release long-lead equipment", dataState: "ai_inference" },
      { key: "risk_reduction", label: "Risk reduction", count: 4, averageConfidence: 0.9, urgency: 0.9, executiveActionCount: 3, totalImpact: null, priorPeriodChange: null, highestPriorityTitle: "Close contract gap", dataState: "ai_inference" },
      { key: "quality_improvement", label: "Quality improvement", count: 1, averageConfidence: 0.65, urgency: 0.4, executiveActionCount: 0, totalImpact: null, priorPeriodChange: null, highestPriorityTitle: "Resolve review loop", dataState: "ai_inference" },
      { key: "operational_efficiency", label: "Operational efficiency", count: 3, averageConfidence: 0.9, urgency: 0.6, executiveActionCount: 2, totalImpact: null, priorPeriodChange: null, highestPriorityTitle: "Reduce handoff delay", dataState: "ai_inference" },
    ],
    activeOpportunityCount: 11,
    averageConfidence: 0.82,
    executiveActionCount: 7,
    totalOpportunityValue: null,
    comparisonAvailable: false,
    insight: "Close contract gap ranks first on confidence and urgency.",
  },
};

const queryResult = <T,>(data: T) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
});

describe("ExecutiveDashboardVisualizations", () => {
  beforeEach(() => {
    jest.mocked(useDashboardVisualizations).mockReturnValue(queryResult(fixture) as never);
    jest.mocked(useAttentionFeed).mockReturnValue(queryResult({ canonicalPacket: { id: "packet", generatedAt: fixture.generatedAt, freshness: "fresh", evidenceCount: 1 }, items: [] }) as never);
  });

  it("renders all three source-backed visuals without inventing impact dollars", () => {
    render(<DashboardVisualizations />);

    expect(screen.getByRole("heading", { name: "Where work is concentrating" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Portfolio activity river" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Where leadership can create leverage" })).toBeInTheDocument();
    expect(screen.getByText("Impact value unavailable · no period comparison")).toBeInTheDocument();
    expect(screen.queryByText("Stage-transition history is not recorded.")).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Review source" })
        .some((link) => link.getAttribute("href") === "/projects"),
    ).toBe(true);
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
  });

  it("supports keyboard-visible stage, stream, and opportunity drilldowns", async () => {
    const user = userEvent.setup();
    render(<DashboardVisualizations />);

    await user.click(screen.getByRole("button", { name: /Active construction: 6/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("lifecycle:active");

    await user.click(screen.getByRole("button", { name: /Financial/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("activity:financial");

    await user.click(screen.getByRole("button", { name: /Risk reduction/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("opportunity:risk_reduction");
  });

  it("names the failed executive source and provides a recovery path", () => {
    jest.mocked(useDashboardVisualizations).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error("Project source timed out."),
      refetch: jest.fn(),
    } as never);

    render(<DashboardVisualizations />);

    expect(screen.getByText(/Project source timed out/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review source pipeline/ })).toHaveAttribute(
      "href",
      "/ai-dashboard/rag-pipeline",
    );
  });

  it("keeps company scope broad but rejects records outside a selected project", () => {
    expect(matchesProjectFilter(1102, null)).toBe(true);
    expect(matchesProjectFilter(1102, 1102)).toBe(true);
    expect(matchesProjectFilter(17, 1102)).toBe(false);
    expect(matchesProjectFilter(null, 1102)).toBe(false);
  });
});
