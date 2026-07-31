/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { TradeScheduleActivities } from "../trade-schedule-activities";
import { apiFetch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("TradeScheduleActivities", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders only the caller's published assignments as source-linked schedule activities", async () => {
    apiFetchMock.mockResolvedValue({
      revisionId: "revision-2",
      data: [{ sourceTaskId: "activity-1", name: "Install air-handling unit", assigneePersonId: "person-1" }],
    } as Awaited<ReturnType<typeof apiFetch>>);

    render(<TradeScheduleActivities projectId="43" revisionId="revision-2" />);

    await waitFor(() => expect(screen.getByText("My assigned activities")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Install air-handling unit" })).toHaveAttribute("href", "/43/schedule?task_id=activity-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/projects/43/scheduling/reports?view=trade-activities", { cache: "no-store" });
  });

  it("makes an unavailable published assignment feed explicit", async () => {
    apiFetchMock.mockRejectedValue(new Error("No published schedule revision is available for trade visibility."));

    render(<TradeScheduleActivities projectId="43" revisionId="revision-2" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Assigned activities unavailable: No published schedule revision is available for trade visibility.");
  });
});
