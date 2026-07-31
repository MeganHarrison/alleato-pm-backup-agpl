/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { AiDashboardWorkspaceShell } from "../workspace-shell";
import AiDashboardAccountingPage from "../accounting/page";
import AiDashboardArchitecturePage from "../architecture/page";
import AiDashboardArchitectureChangesPage from "../architecture/changes/page";
import AiDashboardCashFlowPage from "../accounting/cash-flow/page";
import AiDashboardReconciliationPage from "../accounting/reconciliation/page";
import AiDashboardWipPage from "../accounting/wip/page";
import AiDashboardDecisionsPage from "../decisions/page";
import { ProjectsActivityPreview } from "../projects/projects-activity-preview";
import AiDashboardRagPipelinePage from "../rag-pipeline/page";
import {
  formatRecoveryError,
  RECOVERY_ERROR_MAX_LENGTH,
} from "../rag-pipeline/rag-pipeline-preview";
import {
  useAccountingDashboard,
  useAttentionFeed,
  useDocumentLifecycle,
  usePortfolioState,
  useWipPortfolio,
} from "../live-data";

const mockUsePathname = jest.fn(() => "/ai-dashboard");

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock("@/components/ui/charts", () => ({
  LineChart: () => <div role="img" aria-label="Accounting trend chart" />,
  BarChart: () => <div role="img" aria-label="Distribution chart" />,
}));

jest.mock("../live-data", () => {
  const actual = jest.requireActual("../live-data");
  return {
    ...actual,
    useAccountingDashboard: jest.fn(),
    useAttentionFeed: jest.fn(),
    useDocumentLifecycle: jest.fn(),
    usePortfolioState: jest.fn(),
    useWipPortfolio: jest.fn(),
  };
});

const queryResult = <T,>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
});

describe("AI dashboard workspace", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/ai-dashboard");
    jest.mocked(usePortfolioState).mockReturnValue(
      queryResult({
        canonicalPacket: { id: "packet-1", generatedAt: new Date().toISOString(), freshness: "fresh" },
        projects: [
          {
            projectId: 17,
            projectName: "Harbor Point",
            coverage: "ready" as const,
            freshness: "fresh",
            sourceEvidenceCount: 14,
            healthStatus: "The project operating record is current.",
            projection: { updatedAt: new Date().toISOString(), projectionGeneratedAt: new Date().toISOString() },
            openAttentionIds: ["a1"],
            openConflictIds: [],
            limitedReasons: [],
          },
          {
            projectId: 18,
            projectName: "Old Project",
            coverage: "limited" as const,
            freshness: "unknown",
            sourceEvidenceCount: 0,
            healthStatus: null,
            projection: { updatedAt: "2025-01-01T00:00:00Z", projectionGeneratedAt: "2025-01-01T00:00:00Z" },
            openAttentionIds: [],
            openConflictIds: [],
            limitedReasons: [{ code: "missing_packet_evidence", owner: "Compiler", recoveryPath: "Restore packet evidence." }],
          },
        ],
        summary: { eligibleProjectCount: 2, readyProjectCount: 1, limitedProjectCount: 1, openAttentionCount: 1, openConflictCount: 0 },
      }) as never,
    );
    jest.mocked(useAttentionFeed).mockReturnValue(
      queryResult({
        canonicalPacket: { id: "packet-1", generatedAt: new Date().toISOString(), freshness: "fresh", evidenceCount: 14 },
        items: [
          {
            id: "a1",
            projectId: 17,
            category: "schedule",
            title: "Confirm equipment release",
            summary: "Release timing controls the next field sequence.",
            priority: "high",
            impactOfDelay: "Field work shifts one week.",
            lifecycle: "open",
            accountableOwnerLabel: "Operations",
            dueAt: "2026-07-18T12:00:00Z",
            createdAt: "2026-07-16T08:00:00Z",
            evidence: [{ id: "e1", sourceOccurredAt: null }],
          },
        ],
      }) as never,
    );
    jest.mocked(useAccountingDashboard).mockReturnValue(
      queryResult({
        arAging: {
          current: { label: "Current (0–30 days)", count: 3, total: 500000 },
          days31to60: { label: "31–60 days", count: 2, total: 200000 },
          days61to90: { label: "61–90 days", count: 1, total: 100000 },
          days90plus: { label: "90+ days", count: 1, total: 50000 },
          totalOutstanding: 850000,
        },
        apAging: {
          current: { label: "Current (0–30 days)", count: 3, total: 250000 },
          days31to60: { label: "31–60 days", count: 0, total: 0 },
          days61to90: { label: "61–90 days", count: 0, total: 0 },
          days90plus: { label: "90+ days", count: 0, total: 0 },
          totalOutstanding: 250000,
        },
        cashPosition: { totalArOutstanding: 850000, totalApOutstanding: 250000, netCashPosition: 600000, paymentsReceivedThisMonth: 175000, checksIssuedThisMonth: 95000 },
        monthlyRevenueMargin: [{ month: "2026-07", revenue: 900000, cost: 650000, netMargin: 250000, netMarginPercent: 27.8 }],
        reconciliation: { duplicateCount: 3, onHoldCount: 5, syncIssueCount: 2, dollarsAtRisk: 42000, lastRunAt: "2026-07-16T08:00:00Z" },
        generatedAt: "2026-07-16T10:00:00Z",
      }) as never,
    );
    jest.mocked(useWipPortfolio).mockReturnValue(
      queryResult({
        rows: [{ projectCode: "1009", projectDescription: "Harbor Point", customer: "Owner", contractValue: 2000000, costsToDate: 800000, earnedRevenue: 950000, billedToDate: 875000, overUnderBilling: -75000, forecastGrossProfit: 400000, forecastGrossMarginPct: 20, wipPosition: "underbilled" as const, latestSyncAt: "2026-07-16T08:00:00Z" }],
        summary: { projectCount: 1, contractValue: 2000000, revisedCostBudget: 1600000, costsToDate: 800000, estimatedFinalCost: 1600000, earnedRevenue: 950000, billedToDate: 875000, overUnderBilling: -75000, forecastGrossProfit: 400000 },
        forecastDataAvailable: true,
        generatedAt: "2026-07-16T10:00:00Z",
      }) as never,
    );
    jest.mocked(useDocumentLifecycle).mockReturnValue(
      queryResult({
        documents: [
          { id: "d1", title: "Weekly project review", created_at: "2026-07-16T08:00:00Z", project_name: "Harbor Point", lifecycle_label: "Tasks extracted", pipeline_stage: "done", task_count: 4, error_message: null },
          { id: "d2", title: "Owner meeting", created_at: "2026-07-15T08:00:00Z", project_name: null, lifecycle_label: "Failed", pipeline_stage: "failed", task_count: 0, error_message: "Embedding request failed." },
        ],
        total: 2,
      }) as never,
    );
  });

  it("keeps recovery errors compact while preserving their actionable prefix", () => {
    const error = `canceling statement due to statement timeout ${"x".repeat(200)}`;

    expect(formatRecoveryError(error)).toHaveLength(RECOVERY_ERROR_MAX_LENGTH);
    expect(formatRecoveryError(error)).toMatch(/^canceling statement due to statement timeout/);
    expect(formatRecoveryError(error)).toMatch(/…$/);
  });

  it("exposes every child route through one shared responsive navigation", () => {
    render(
      <AiDashboardWorkspaceShell>
        <div>Workspace content</div>
      </AiDashboardWorkspaceShell>,
    );

    const workspaceMain = screen.getByText("Workspace content").closest("main");
    const workspaceGrid = workspaceMain?.parentElement;
    const workspaceCanvas = workspaceGrid?.parentElement;

    expect(workspaceCanvas).toHaveClass(
      "max-w-none",
      "px-6",
      "sm:px-8",
      "lg:px-10",
      "xl:px-12",
      "2xl:px-16",
    );
    expect(workspaceGrid).toHaveClass(
      "lg:grid-cols-[10rem_minmax(0,1fr)]",
      "gap-10",
    );
    expect(workspaceMain).toHaveClass("lg:px-6", "xl:px-8", "2xl:px-10");

    for (const [label, href] of [
      ["Overview", "/ai-dashboard"],
      ["Daily brief", "/daily-brief"],
      ["Decisions", "/ai-dashboard/decisions"],
      ["Accounting", "/ai-dashboard/accounting"],
      ["RAG Pipeline", "/ai-dashboard/rag-pipeline"],
      ["Architecture", "/ai-dashboard/architecture"],
    ]) {
      expect(screen.getAllByRole("link", { name: label })[0]).toHaveAttribute(
        "href",
        href,
      );
    }

    expect(
      screen.getAllByRole("link", { name: "Overview" })[0],
    ).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("Alleato intelligence")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "All projects" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Projects" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "AI System" })).not.toBeInTheDocument();
  });

  it("keeps accounting active across its nested report routes", () => {
    mockUsePathname.mockReturnValue("/ai-dashboard/accounting/wip");

    render(
      <AiDashboardWorkspaceShell>
        <div>WIP content</div>
      </AiDashboardWorkspaceShell>,
    );

    expect(
      screen
        .getAllByRole("link", { name: "Accounting" })
        .every((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
  });

  it("filters current project activity from the live portfolio projection", () => {
    render(<ProjectsActivityPreview />);

    expect(screen.getByText("Harbor Point")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "1 project updated in the last 14 days.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Old Project")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Current projects that need projection recovery",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Search active projects" }),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search active projects" }),
      { target: { value: "Harbor" } },
    );

    expect(screen.getByText("Harbor Point")).toBeInTheDocument();
    expect(screen.queryByText(/Preview data/i)).not.toBeInTheDocument();
  });

  it("renders decisions and accounting pages with canonical drill-through", () => {
    const { unmount } = render(<AiDashboardDecisionsPage />);
    expect(
      screen.getByRole("heading", {
        name: "1 decision is waiting on action.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open daily brief/i })).toHaveAttribute(
      "href",
      "/daily-brief",
    );
    expect(screen.getByRole("link", { name: /Open project/i })).toHaveAttribute(
      "href",
      "/17/home",
    );
    unmount();

    render(<AiDashboardAccountingPage />);
    expect(screen.getByRole("link", { name: /Open accounting/i })).toHaveAttribute(
      "href",
      "/accounting",
    );
    expect(screen.getByRole("link", { name: /Cash flow/i })).toHaveAttribute(
      "href",
      "/ai-dashboard/accounting/cash-flow",
    );
  });

  it("renders live accounting details and the canonical RAG pipeline", () => {
    const cash = render(<AiDashboardCashFlowPage />);
    expect(
      screen.getByRole("link", { name: /Open accounting dashboard/i }),
    ).toHaveAttribute("href", "/accounting");
    cash.unmount();

    const wip = render(<AiDashboardWipPage />);
    expect(
      screen.getByRole("link", { name: /Open canonical WIP report/i }),
    ).toHaveAttribute("href", "/accounting/wip");
    wip.unmount();

    const reconciliation = render(<AiDashboardReconciliationPage />);
    expect(
      screen.getByRole("link", { name: /Open canonical reconciliation/i }),
    ).toHaveAttribute("href", "/accounting/reconciliation");
    reconciliation.unmount();

    render(<AiDashboardRagPipelinePage />);
    expect(screen.getAllByText("Tasks extracted").length).toBeGreaterThan(0);
    expect(screen.getByText("Embedding request failed.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open pipeline operations/i }),
    ).toHaveAttribute("href", "/pipeline");
    expect(screen.queryByText(/RAD Pipeline/i)).not.toBeInTheDocument();
  });

  it("renders a source-backed interactive architecture explorer without repository controls", () => {
    mockUsePathname.mockReturnValue("/ai-dashboard/architecture");

    render(<AiDashboardArchitecturePage />);

    expect(
      screen.getByRole("heading", {
        name: "How the system is built, and how it stays organized.",
      }),
    ).toBeInTheDocument();
    const codebaseMapSection = screen.getByText("alleato-pm/").closest("section");
    const visibleProductSection = screen
      .getByRole("heading", { name: "What this structure produces" })
      .closest("section");

    expect(screen.queryByText("Interactive codebase map")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Select a path to see its responsibility",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Visible product")).not.toBeInTheDocument();
    expect(screen.queryByText("Keeping it clean")).not.toBeInTheDocument();
    expect(codebaseMapSection).not.toHaveClass("border-t");
    expect(visibleProductSection).not.toHaveClass("border-t", "border-border");
    expect(
      screen.getByRole("heading", {
        name: "Organization is maintained by the process, not manual cleanup",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("alleato-pm/")).toBeInTheDocument();
    expect(screen.queryByText("alleato-procore/")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select protected routes and pages" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Select operational services" }),
    );

    expect(screen.getByText("Operational services")).toBeInTheDocument();
    expect(screen.getByText("backend/src/services/")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Runtime ownership map/i }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("ALLEATO-SYSTEM-MAP.md"),
    );
    expect(
      screen.getByRole("img", {
        name: /Alleato executive workspace with shared navigation/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Alleato active projects page showing recent project activity/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Generated maps detect structural drift"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open detailed Architecture Center/i }),
    ).toHaveAttribute(
      "href",
      "https://alleato-docs-site.vercel.app/architecture/overview",
    );
    expect(
      screen.getByRole("link", { name: /View accepted changes/i }),
    ).toHaveAttribute("href", "/ai-dashboard/architecture/changes");
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Architecture" })
        .every((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
  });

  it("renders only accepted architecture changes with immutable evidence links", () => {
    mockUsePathname.mockReturnValue("/ai-dashboard/architecture/changes");

    render(<AiDashboardArchitectureChangesPage />);

    expect(
      screen.getByRole("heading", {
        name: "Accepted changes, with the revision and proof behind each one.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Accepted")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "AAI-1093" })).toHaveAttribute(
      "href",
      expect.stringContaining("linear.app"),
    );
    expect(
      screen.getByRole("link", { name: /Revision 68c70158d1/i }),
    ).toHaveAttribute(
      "href",
      "https://github.com/The-Alleato-Group/project-management/commit/68c70158d159b0c5ec6f462707d671b02c846b3b",
    );
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});
