/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { TradeScheduleActivities } from "../trade-schedule-activities";
import { apiFetch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("TradeScheduleActivities", () => {
  beforeEach(() => jest.clearAllMocks());

  it("announces loading while the scoped feed is unresolved", () => {
    apiFetchMock.mockReturnValue(new Promise(() => {}));

    render(<TradeScheduleActivities projectId="43" revisionId="revision-2" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading assigned schedule activities",
    );
  });

  it("labels company-scoped published assignments and links to their source tasks", async () => {
    apiFetchMock.mockResolvedValue({
      revisionId: "revision-2",
      visibility: {
        type: "company",
        companyId: "company-1",
        label: "Air Systems LLC",
      },
      data: [
        {
          sourceTaskId: "activity-1",
          name: "Install air-handling unit",
          assigneePersonId: "person-2",
        },
      ],
    } as Awaited<ReturnType<typeof apiFetch>>);

    render(<TradeScheduleActivities projectId="43" revisionId="revision-2" />);

    await waitFor(() =>
      expect(screen.getByText("Company assigned activities")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Air Systems LLC/)).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "Company assigned schedule activities",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Install air-handling unit" })).toHaveAttribute("href", "/43/schedule?task_id=activity-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/projects/43/scheduling/reports?view=trade-activities", { cache: "no-store" });
  });

  it("makes an unavailable published assignment feed explicit", async () => {
    apiFetchMock.mockRejectedValue(new Error("No published schedule revision is available for trade visibility."));

    render(<TradeScheduleActivities projectId="43" revisionId="revision-2" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Assigned activities unavailable: No published schedule revision is available for trade visibility.");
  });

  it("keeps company scope visible when the published feed is empty", async () => {
    apiFetchMock.mockResolvedValue({
      revisionId: "revision-2",
      visibility: {
        type: "company",
        companyId: "company-1",
        label: "Air Systems LLC",
      },
      data: [],
    } as Awaited<ReturnType<typeof apiFetch>>);

    render(<TradeScheduleActivities projectId="43" revisionId="revision-2" />);

    expect(
      await screen.findByRole("region", {
        name: "Company assigned schedule activities",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Air Systems LLC · Published schedule/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No published schedule activities are assigned to Air Systems LLC",
    );
  });
});
