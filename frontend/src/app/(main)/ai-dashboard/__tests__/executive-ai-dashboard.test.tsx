/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Link from "next/link";

import { ExecutiveAiDashboard } from "../executive-ai-dashboard";
import {
  useAttentionFeed,
  useDailyBrief,
  useSystemHealth,
} from "../live-data";

jest.mock("../visualizations/executive-dashboard-visualizations", () => ({
  ExecutiveDashboardVisualizations: () => (
    <section aria-label="Portfolio intelligence visualizations">
      <div role="heading" aria-level={2}>Project lifecycle</div>
      <div role="heading" aria-level={2}>Activity river</div>
      <div role="heading" aria-level={2}>AI opportunity wheel</div>
      <Link href="/ai-dashboard/decisions">All decisions</Link>
    </section>
  ),
}));

jest.mock("../live-data", () => {
  const actual = jest.requireActual("../live-data");
  return {
    ...actual,
    useAttentionFeed: jest.fn(),
    useDailyBrief: jest.fn(),
    useSystemHealth: jest.fn(),
  };
});

const queryResult = <T,>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
});

describe("ExecutiveAiDashboard", () => {
  beforeEach(() => {
    jest.mocked(useAttentionFeed).mockReturnValue(
      queryResult({
        canonicalPacket: {
          id: "packet-1",
          generatedAt: "2026-07-16T10:00:00Z",
          freshness: "fresh",
          evidenceCount: 12,
        },
        items: [
          {
            id: "a1",
            projectId: 17,
            category: "schedule",
            title: "Confirm equipment release",
            summary: "The release date controls the next field sequence.",
            priority: "high",
            impactOfDelay: "Field work shifts one week.",
            lifecycle: "open",
            accountableOwnerLabel: "Operations",
            dueAt: "2026-07-17T12:00:00Z",
            createdAt: "2026-07-16T09:00:00Z",
            evidence: [{ id: "e1", sourceOccurredAt: null }],
          },
          {
            id: "a2",
            projectId: null,
            category: "delivery",
            title: "Restore packet delivery evidence",
            summary: "The current packet has no correlated delivery receipt.",
            priority: "high",
            impactOfDelay: "Leadership delivery remains unproven.",
            lifecycle: "open",
            accountableOwnerLabel: "Delivery owner",
            dueAt: null,
            createdAt: "2026-07-16T09:30:00Z",
            evidence: [],
          },
        ],
      }) as never,
    );
    jest.mocked(useDailyBrief).mockReturnValue(
      queryResult({
        sourceOfTruth: "intelligence_packets" as const,
        targetSlug: "daily-executive-brief",
        packet: {
          id: "packet-1",
          title: "Daily Executive Brief — July 16",
          generatedAt: "2026-07-16T10:00:00Z",
          businessDate: "2026-07-16",
          freshnessStatus: "fresh",
          sourceCount: 160,
          currentStatus: "Two leadership actions are holding the operating plan.",
          strategicRead: null,
          whyItMatters: "Both actions affect near-term delivery confidence.",
          recommendedNextMoves: ["Confirm release date", "Restore delivery receipt"],
        },
      }) as never,
    );
    jest.mocked(useSystemHealth).mockReturnValue(
      queryResult({
        nodes: [
          { id: "packet", title: "Source to canonical packet", owner: "Compiler", health: "healthy" as const, affectedSurface: "Daily Brief" },
          { id: "delivery", title: "Packet-correlated delivery", owner: "Delivery", health: "exception" as const, affectedSurface: "Executive delivery" },
        ],
        exceptions: [{ id: "x1", title: "Delivery unproven", affectedSurface: "Executive delivery", owner: "Delivery", recoveryPath: "Retry delivery", detail: "No receipt" }],
      }) as never,
    );
  });

  it("renders the live executive entry point with source-backed decision visuals", () => {
    render(<ExecutiveAiDashboard />);

    expect(
      screen.getByRole("heading", { name: "2 executive decisions need attention." }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Brief generated/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Live sources")).not.toBeInTheDocument();
    expect(screen.getByText("Daily Executive Brief — July 16")).toBeInTheDocument();
    expect(screen.getByText("160")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project lifecycle" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activity river" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI opportunity wheel" })).toBeInTheDocument();
    expect(
      screen
        .getByRole("heading", { name: "Project lifecycle" })
        .compareDocumentPosition(
          screen.getByRole("heading", { name: "Daily Executive Brief — July 16" }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "All decisions" })).toHaveAttribute(
      "href",
      "/ai-dashboard/decisions",
    );
  });

  it("removes the invented preview metrics and remains distinct from AI chat", () => {
    render(<ExecutiveAiDashboard />);

    expect(screen.queryByText(/preview data/i)).not.toBeInTheDocument();
    expect(screen.queryByText("82.4")).not.toBeInTheDocument();
    expect(screen.queryByText("+8.6%")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/ai"),
    ).toBe(false);
  });

  it("names a failed live source and leaves the canonical recovery path visible", () => {
    jest.mocked(useDailyBrief).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Executive detail access expired."),
    } as never);

    render(<ExecutiveAiDashboard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Daily Brief could not be loaded. Executive detail access expired.",
    );
    expect(
      screen.getByRole("link", { name: "Open daily executive brief" }),
    ).toHaveAttribute("href", "/daily-brief");
  });
});
