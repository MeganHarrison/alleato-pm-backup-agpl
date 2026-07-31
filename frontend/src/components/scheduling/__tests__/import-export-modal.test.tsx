/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import {
  exportFlatScheduleToCsv,
  exportFlatScheduleToJson,
  ImportExportModal,
} from "../import-export-modal";
import type { ScheduleTask } from "@/types/scheduling";

function task(overrides: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    id: "task-1",
    project_id: 43,
    parent_task_id: null,
    name: "Frame, walls",
    start_date: "2026-08-03",
    finish_date: "2026-08-04",
    duration_days: 2,
    percent_complete: 25,
    status: "in_progress",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: "1.1",
    sort_order: 1,
    created_at: "2026-07-28T00:00:00.000Z",
    updated_at: "2026-07-28T00:00:00.000Z",
    schedule_mode: "auto",
    dependencies: [{
      id: "dependency-1",
      task_id: "task-1",
      predecessor_task_id: "task-0",
      dependency_type: "finish_to_start",
      lag_days: 2,
      created_at: "2026-07-28T00:00:00.000Z",
    }],
    ...overrides,
  };
}

describe("flat schedule export", () => {
  it("escapes CSV cells without exporting relationships", () => {
    const csv = exportFlatScheduleToCsv([task()]);

    expect(csv).toContain("\"Frame, walls\"");
    expect(csv).not.toContain("dependency-1");
    expect(csv).not.toContain("task-0");
  });

  it("neutralizes spreadsheet formulas in user-controlled CSV fields", () => {
    const csv = exportFlatScheduleToCsv([
      task({ name: "=HYPERLINK(\"https://example.com\")", wbs_code: " @SUM(1,2)" }),
    ]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("' @SUM");
    expect(csv).not.toContain("\n=HYPERLINK");
  });

  it("exports only the documented flat task fields to JSON", () => {
    const json = JSON.parse(exportFlatScheduleToJson([task()])) as Array<Record<string, unknown>>;

    expect(json[0]).toMatchObject({
      name: "Frame, walls",
      wbs_code: "1.1",
      duration_days: 2,
      percent_complete: 25,
    });
    expect(json[0]).not.toHaveProperty("dependencies");
    expect(json[0]).not.toHaveProperty("parent_task_id");
  });

  it("labels the export as lossy and does not offer the retired CSV importer", () => {
    render(
      <ImportExportModal
        open
        onOpenChange={jest.fn()}
        projectId="43"
        tasks={[task()]}
      />,
    );

    expect(screen.getByText("Flat, intentionally lossy snapshot")).toBeInTheDocument();
    expect(screen.getByText(/separate atomic import workflow/i)).toBeInTheDocument();
    expect(screen.queryByText("Import Tasks")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select CSV File")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[calc(100svh-2rem)]",
      "overflow-y-auto",
    );
    expect(screen.getByRole("button", { name: "CSV" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "JSON" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "MS Project XML" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("downloads relationship-aware Microsoft Project XML", () => {
    const createObjectUrl = jest.fn(() => "blob:schedule-export");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <ImportExportModal
        open
        onOpenChange={jest.fn()}
        projectId="43"
        tasks={[task({ dependencies: [] })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "MS Project XML" }));

    expect(
      screen.getByText("Relationship-aware Project interchange"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Flat, intentionally lossy snapshot"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export 1 Tasks" }));

    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("application/xml");
    expect(screen.getByRole("status")).toHaveTextContent("standard Monday-Friday");
    expect(
      screen
        .getByText("Exported 1 tasks to schedule-microsoft-project-43.xml")
        .closest('[role="note"]'),
    ).toBeInTheDocument();
  });

  it("announces lossy Microsoft Project conversions after download", () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:schedule-export"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <ImportExportModal
        open
        onOpenChange={jest.fn()}
        projectId="43"
        tasks={[task({ schedule_mode: "manual", dependencies: [] })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "MS Project XML" }));
    fireEvent.click(screen.getByRole("button", { name: "Export 1 Tasks" }));

    expect(screen.getByText(/Export completed with 2 warnings/)).toBeInTheDocument();
    expect(screen.getByText(/manually scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/standard Monday-Friday/i)).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      screen
        .getByText("Exported 1 tasks to schedule-microsoft-project-43.xml")
        .closest('[role="note"]'),
    ).toBeInTheDocument();
  });

  it("downloads the selected flat snapshot and announces success", () => {
    const createObjectUrl = jest.fn(() => "blob:schedule-export");
    const revokeObjectUrl = jest.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <ImportExportModal
        open
        onOpenChange={jest.fn()}
        projectId="43"
        tasks={[task()]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export 1 Tasks" }));

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:schedule-export");
    expect(screen.getByRole("status")).toHaveTextContent(
      "schedule-flat-task-snapshot-43.csv",
    );
  });

  it("surfaces download failures in the dialog", () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => {
        throw new Error("Browser blocked the download");
      }),
    });

    render(
      <ImportExportModal
        open
        onOpenChange={jest.fn()}
        projectId="43"
        tasks={[task()]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export 1 Tasks" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Browser blocked the download",
    );
  });
});
