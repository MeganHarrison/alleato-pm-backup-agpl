/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProgressReportEditor } from "../progress-report-editor";
import type {
  ProgressReportDetailResponse,
  ProgressReportPhotoRecord,
} from "@/lib/progress-reports/types";

const useProgressReportMock = jest.fn();
const useProgressReportHistoryMock = jest.fn();
const useRefineProgressReportMock = jest.fn();
const useUpdateProgressReportMock = jest.fn();
const useDeletePhotoMock = jest.fn();

jest.mock("@/hooks/use-progress-reports", () => ({
  progressReportKeys: {
    detail: (projectId: number, reportId: string) =>
      ["progress-reports", projectId, "detail", reportId] as const,
  },
  useProgressReport: (...args: unknown[]) => useProgressReportMock(...args),
  useProgressReportHistory: (...args: unknown[]) => useProgressReportHistoryMock(...args),
  useRefineProgressReport: (...args: unknown[]) => useRefineProgressReportMock(...args),
  useUpdateProgressReport: (...args: unknown[]) => useUpdateProgressReportMock(...args),
}));

jest.mock("@/hooks/use-photos", () => ({
  useDeletePhoto: (...args: unknown[]) => useDeletePhotoMock(...args),
}));

jest.mock("@/hooks/useProjectTitle", () => ({
  useProjectTitle: jest.fn(),
}));

jest.mock("@/hooks/use-pdf-export", () => ({
  downloadPdf: jest.fn(),
}));

jest.mock("@/components/misc/markdown", () => ({
  Markdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function buildPhoto(overrides: Partial<ProgressReportPhotoRecord>): ProgressReportPhotoRecord {
  return {
    id: 1,
    title: "Site photo.jpeg",
    description: null,
    file_url: "https://example.com/photo.jpeg",
    date_taken: "2026-07-05",
    created_at: "2026-07-05T00:00:00Z",
    location: null,
    tags: null,
    ...overrides,
  };
}

function buildDetail(
  availablePhotos: ProgressReportPhotoRecord[],
): ProgressReportDetailResponse {
  return {
    report: {
      id: "report-123",
      project_id: 876,
      title: "Weekly Progress Report",
      report_type: "weekly",
      status: "draft",
      week_start: "2026-07-03",
      week_end: "2026-07-10",
      construction_start_date: null,
      scheduled_completion_date: null,
      past_week_highlights: "",
      upcoming_week_activities: "",
      open_items: "",
      internal_notes: null,
      weather_days_lost: 0,
      contacts: [],
      client_recipients: [],
      source_snapshot: {
        generatedAt: "2026-07-10T00:00:00Z",
        strategy: "test",
        meetings: [],
        emails: [],
        photos: [],
      },
      sent_at: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-07-10T00:00:00Z",
      updated_at: "2026-07-10T00:00:00Z",
    },
    selectedPhotos: [],
    availablePhotos,
  };
}

describe("ProgressReportEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProgressReportHistoryMock.mockReturnValue({ data: { versions: [] } });
    useRefineProgressReportMock.mockReturnValue({ mutate: jest.fn(), isPending: false });
    useUpdateProgressReportMock.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
    useDeletePhotoMock.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
    });
  });

  it("shows an actionable error state instead of a permanent skeleton when the detail query fails", () => {
    useProgressReportMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error("Authentication required."),
      refetch: jest.fn(),
    });

    renderWithClient(<ProgressReportEditor projectId={876} reportId="report-123" />);

    expect(screen.getByText("Could not load progress report")).toBeInTheDocument();
    expect(screen.getByText("Authentication required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders a delete affordance for each project photo and confirms before deleting", async () => {
    const photo = buildPhoto({ id: 581, title: "Outside doors 1-2.jpeg" });
    const deleteMutateAsync = jest.fn().mockResolvedValue(undefined);
    useDeletePhotoMock.mockReturnValue({ mutateAsync: deleteMutateAsync, isPending: false });
    useProgressReportMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: buildDetail([photo]),
      refetch: jest.fn(),
    });

    renderWithClient(<ProgressReportEditor projectId={876} reportId="report-123" />);

    // Enter edit mode where the photo picker lives.
    fireEvent.click(screen.getByRole("button", { name: /edit progress report/i }));

    // Every photo tile exposes a delete control.
    const deleteButton = screen.getByRole("button", {
      name: /delete photo outside doors 1-2\.jpeg/i,
    });
    fireEvent.click(deleteButton);

    // A confirm dialog gates the destructive action — nothing deleted yet.
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Delete this photo?")).toBeInTheDocument();
    expect(deleteMutateAsync).not.toHaveBeenCalled();

    // Confirming issues the delete with the photo's id and closes the dialog.
    fireEvent.click(within(dialog).getByRole("button", { name: /delete photo/i }));
    expect(deleteMutateAsync).toHaveBeenCalledWith(581);
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
