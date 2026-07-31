/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { ScheduleRiskSummary } from "../schedule-risk-summary";
import { apiFetch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("ScheduleRiskSummary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders source-linked material risks without a dashboard wrapper", async () => {
    apiFetchMock.mockResolvedValue({ data: {
      state: "ready", revisionId: "revision-2", revisionNumber: 2,
      risks: [{ id: "submittal-1", kind: "submittal", summary: "Steel shop drawings are rejected.", source: { href: "/43/submittals/submittal-1", label: "View submittal" } }],
    } } as Awaited<ReturnType<typeof apiFetch>>);

    render(<ScheduleRiskSummary projectId="43" revisionId="revision-2" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Schedule risks" })).toBeInTheDocument());
    expect(screen.getByText("Steel shop drawings are rejected.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View submittal" })).toHaveAttribute("href", "/43/submittals/submittal-1");
  });
});
