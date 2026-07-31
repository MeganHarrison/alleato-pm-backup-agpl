/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ScheduleResourceRosterResponse, ScheduleTask } from "@/types/scheduling";
import { ResourceAvailabilityPanel } from "../resource-availability-panel";

function task(id: string, name: string, startDate: string | null = "2026-08-03"): ScheduleTask {
  return {
    id,
    project_id: 67,
    parent_task_id: null,
    name,
    start_date: startDate,
    finish_date: startDate ? "2026-08-03" : null,
    duration_days: startDate ? 1 : null,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 0,
    created_at: "2026-07-22T00:00:00Z",
    updated_at: "2026-07-22T00:00:00Z",
  };
}

const resource = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  project_id: 67,
  person_id: "11111111-1111-4111-8111-111111111111",
  display_name: "Active Person",
  email: null,
  job_title: null,
  person_status: "active" as const,
  membership_status: "active" as const,
  eligible: true,
};

const tasks = [task("11111111-1111-4111-8111-111111111111", "Task A"), task("22222222-2222-4222-8222-222222222222", "Task B")];
const roster: ScheduleResourceRosterResponse = {
  resources: [resource],
  candidates: [],
  assignments: tasks.map((item, index) => ({
    id: `${index + 1}1111111-1111-4111-8111-111111111111`,
    project_id: 67,
    task_id: item.id,
    resource_id: resource.id,
    person_id: resource.person_id,
    allocation_percent: 60,
  })),
  can_manage: true,
  legacy_assignment_count: 0,
};

describe("ResourceAvailabilityPanel", () => {
  it("opens on demand and exposes daily overallocation without changing task dates", () => {
    render(
      <ResourceAvailabilityPanel
        roster={roster}
        tasks={tasks}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        today="2026-08-03"
      />,
    );

    const toggle = screen.getByRole("button", { name: "Project resource load" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("120% assigned")).toBeInTheDocument();
    expect(screen.getByText("20% over capacity")).toBeInTheDocument();
  });

  it("surfaces allocation diagnostics for unscheduled work", () => {
    const unscheduled = task("33333333-3333-4333-8333-333333333333", "Unscheduled", null);
    render(
      <ResourceAvailabilityPanel
        roster={{
          ...roster,
          assignments: [{
            id: "44444444-4444-4444-8444-444444444444",
            project_id: 67,
            task_id: unscheduled.id,
            resource_id: resource.id,
            person_id: resource.person_id,
            allocation_percent: 50,
          }],
        }}
        tasks={[unscheduled]}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        today="2026-08-03"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Project resource load" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Task needs start and finish dates: Unscheduled/i);
  });

  it("refreshes an untouched default range when the authoritative calendar arrives", () => {
    const { rerender } = render(
      <ResourceAvailabilityPanel
        roster={roster}
        tasks={tasks}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        today="2026-08-08"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Project resource load" }));
    expect(screen.getByLabelText("Start", { exact: true })).toHaveValue("08/10/2026");

    rerender(
      <ResourceAvailabilityPanel
        roster={roster}
        tasks={tasks}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5, 6], non_working_dates: [] }}
        today="2026-08-08"
      />,
    );
    expect(screen.getByLabelText("Start", { exact: true })).toHaveValue("08/08/2026");
  });

  it("withholds totals until the saved project calendar is ready", () => {
    render(
      <ResourceAvailabilityPanel
        roster={{ ...roster, legacy_assignment_count: 1 }}
        tasks={tasks}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        calendarReady={false}
        error="Resource load is unavailable until the saved calendar is restored."
        today="2026-08-03"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Project resource load" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/saved calendar is restored/i);
    expect(screen.queryByText("120% assigned")).not.toBeInTheDocument();
  });

  it("loads capacity only after expansion and uses it for project load", async () => {
    const onLoadCapacityRange = jest.fn().mockResolvedValue({
      project_id: 67,
      range: { start: "2026-08-03", finish: "2026-08-14" },
      profiles: [],
    });
    const { rerender } = render(
      <ResourceAvailabilityPanel
        roster={roster}
        tasks={tasks}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        today="2026-08-03"
        onLoadCapacityRange={onLoadCapacityRange}
      />,
    );
    expect(onLoadCapacityRange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Project resource load" }));
    await waitFor(() => expect(onLoadCapacityRange).toHaveBeenCalledWith("2026-08-03", "2026-08-14"));

    rerender(
      <ResourceAvailabilityPanel
        roster={roster}
        tasks={tasks}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        today="2026-08-03"
        capacityRange={{
          project_id: 67,
          range: { start: "2026-08-03", finish: "2026-08-14" },
          profiles: [{
            profile_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            project_id: 67,
            resource_id: resource.id,
            configured: true,
            version: 1,
            coverage_start_date: "2026-08-03",
            coverage_finish_date: "2026-08-14",
            weekday_overrides: [{ weekday: 1, capacity_percent: 50 }],
            exceptions: [],
          }],
        }}
        onLoadCapacityRange={onLoadCapacityRange}
      />,
    );
    expect(screen.getAllByText("Capacity 50%").length).toBeGreaterThan(0);
    expect(screen.getByText("70% over capacity")).toBeInTheDocument();
  });

  it("labels leveling as a no-write preview and exposes no apply action", () => {
    const onPreviewLeveling = jest.fn().mockResolvedValue(undefined);
    render(
      <ResourceAvailabilityPanel
        roster={roster}
        tasks={tasks}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        today="2026-08-03"
        levelingPreview={{
          status: "available",
          proposals: [],
          diagnostics: [],
          notice: "Preview only. No schedule dates were changed.",
        }}
        onPreviewLeveling={onPreviewLeveling}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Project resource load" }));
    expect(screen.getByText(/Preview only\. No schedule dates were changed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview leveling" }));
    expect(onPreviewLeveling).toHaveBeenCalledWith();
  });

  it("retries a failed capacity range without showing an indefinite loader", async () => {
    const onLoadCapacityRange = jest.fn().mockRejectedValue(new Error("Capacity request failed."));
    render(
      <ResourceAvailabilityPanel
        roster={roster}
        tasks={tasks}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        today="2026-08-03"
        capacityRangeError="Capacity request failed."
        onLoadCapacityRange={onLoadCapacityRange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Project resource load" }));
    await waitFor(() => expect(onLoadCapacityRange).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveTextContent("Capacity request failed.");
    expect(screen.queryByText("Loading project resource load...")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onLoadCapacityRange).toHaveBeenCalledTimes(2));
    expect(onLoadCapacityRange).toHaveBeenLastCalledWith("2026-08-03", "2026-08-14");
  });
});
