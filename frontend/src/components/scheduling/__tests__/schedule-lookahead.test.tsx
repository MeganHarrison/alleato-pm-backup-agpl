/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { ScheduleLookahead } from "../schedule-lookahead";
import { apiFetch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("ScheduleLookahead", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the selected published revision and its traceable risk context", async () => {
    apiFetchMock.mockResolvedValue({
      data: {
        revisionId: "revision-2",
        revisionNumber: 2,
        snapshotProvenance: "captured",
        window: { startDate: "2026-08-03", endDate: "2026-08-16", weeks: 2 },
        activities: [{
          sourceTaskId: "task-1",
          name: "Place foundation",
          forecastStartDate: "2026-08-04",
          forecastFinishDate: "2026-08-08",
          constraint: { type: "finish_no_later_than", date: "2026-08-07" },
          dependencies: [{ predecessorSourceId: "task-permit", type: "finish_to_start", lagDays: 1 }],
          submittalRisk: { status: "at_risk", reason: "Concrete mix submittal is overdue." },
        }],
      },
    } as Awaited<ReturnType<typeof apiFetch>>);

    render(<ScheduleLookahead projectId="43" startDate="2026-08-03" />);

    expect(screen.getByRole("button", { name: "2 weeks" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByText(/Published revision 2/)).toBeInTheDocument());
    expect(screen.getByText("Place foundation")).toBeInTheDocument();
    expect(screen.getByText("Concrete mix submittal is overdue.")).toBeInTheDocument();
    expect(screen.getByText("finish to start +1d")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export XLSX" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeEnabled();
  });
});
