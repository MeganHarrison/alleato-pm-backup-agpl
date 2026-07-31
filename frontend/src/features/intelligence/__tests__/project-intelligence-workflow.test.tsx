/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { ProjectIntelligenceWorkflow } from "../project-intelligence-workflow";
import type { ClientProjectIntelligencePacket } from "@/lib/ai/intelligence/types";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const packet = {
  freshnessStatus: "fresh",
  generatedAt: "2026-07-21T12:00:00Z",
  executiveSummary: "The project is on track.",
  currentStatus: "On track with one decision pending.",
  strategicRead: "Keep the current handoff cadence.",
  recommendedNextMoves: ["Confirm the owner for the pending decision."],
} as unknown as ClientProjectIntelligencePacket;

describe("ProjectIntelligenceWorkflow", () => {
  it("exposes status, handoff actions, timeline, tasks, and report recommendations", () => {
    render(
      <ProjectIntelligenceWorkflow
        projectId={42}
        packet={packet}
        timelineEvents={[{ id: "event-1", event_at: "2026-07-20T12:00:00Z", title: "Packet compiled", summary: null, current_status: "complete" }]}
        tasks={[{ id: 1, title: "Confirm decision owner", status: "open", due_date: "2026-07-24", assignee_name: "Megan" }]}
        reportSuggestions={[{ id: "report-1", report_type: "weekly_client", title: "Weekly client report", business_date: null, week_start_date: "2026-07-20", status: "draft" }]}
      />,
    );

    expect(screen.getByText("The project is on track.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry run/i })).toBeInTheDocument();
    expect(screen.getByText("Packet compiled")).toBeInTheDocument();
    expect(screen.getByText("Confirm decision owner")).toBeInTheDocument();
    expect(screen.getByText("Weekly client report")).toBeInTheDocument();
  });
});
