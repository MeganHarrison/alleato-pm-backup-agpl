/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { apiFetch } from "@/lib/api-client";
import type { ScheduleCostModelResponse, ScheduleTask } from "@/types/scheduling";
import { ScheduleResourceCostPanel } from "../schedule-resource-cost-panel";

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;
const task: ScheduleTask = {
  id: "11111111-1111-4111-8111-111111111111",
  project_id: 67,
  parent_task_id: null,
  name: "Install framing",
  start_date: "2026-07-27",
  finish_date: "2026-07-31",
  duration_days: 5,
  percent_complete: 40,
  status: "in_progress",
  is_milestone: false,
  constraint_type: null,
  constraint_date: null,
  wbs_code: "1.1",
  sort_order: 1,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

const model: ScheduleCostModelResponse = {
  project_id: 67,
  can_manage: true,
  resources: [{
    id: "22222222-2222-4222-8222-222222222222",
    project_id: 67,
    person_id: null,
    resource_kind: "equipment",
    display_name: "Tower crane",
    standard_rate: 1_000,
    cost_per_use: 0,
    rate_unit: "day",
    cost_version: 1,
  }],
  assignments: [{
    id: "33333333-3333-4333-8333-333333333333",
    project_id: 67,
    task_id: task.id,
    resource_id: "22222222-2222-4222-8222-222222222222",
    allocation_percent: 100,
    planned_units: 2,
    actual_units: 1,
    actual_rate: 1_000,
    actual_cost: null,
    cost_version: 1,
  }],
};

describe("ScheduleResourceCostPanel", () => {
  beforeAll(() => {
    Object.defineProperties(HTMLElement.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      releasePointerCapture: { configurable: true, value: () => undefined },
      setPointerCapture: { configurable: true, value: () => undefined },
      scrollIntoView: { configurable: true, value: () => undefined },
    });
  });

  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(model);
  });

  it("shows earned-value metrics from persisted explicit resource facts", async () => {
    render(<ScheduleResourceCostPanel projectId="67" tasks={[task]} />);

    expect((await screen.findAllByText("Tower crane")).length).toBeGreaterThan(0);
    expect(screen.getByText("BAC").parentElement).toHaveTextContent("$2,000");
    expect(screen.getByText("EV").parentElement).toHaveTextContent("$800");
    expect(screen.getByText("AC").parentElement).toHaveTextContent("$1,000");
    expect(screen.queryByText("Incomplete cost facts")).not.toBeInTheDocument();
  });

  it("creates an equipment resource with the validated day-rate contract", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ ...model, resources: [], assignments: [] })
      .mockResolvedValueOnce({ data: model.resources[0] })
      .mockResolvedValueOnce(model);

    render(<ScheduleResourceCostPanel projectId="67" tasks={[task]} />);
    await screen.findByText("No cost assignments yet.");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Tower crane" },
    });
    fireEvent.change(screen.getByLabelText("Rate per day"), {
      target: { value: "900" },
    });
    fireEvent.change(screen.getByLabelText("Cost per use"), {
      target: { value: "250" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save resource" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/projects/67/scheduling/resources?operation=cost-resource",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          id: null,
          resource_kind: "equipment",
          display_name: "Tower crane",
          standard_rate: 900,
          cost_per_use: 250,
          rate_unit: "day",
          expected_cost_version: null,
        }),
      }),
    ));
  });

  it("creates a material resource with the validated unit-rate contract", async () => {
    const user = userEvent.setup();
    apiFetchMock
      .mockResolvedValueOnce({ ...model, resources: [], assignments: [] })
      .mockResolvedValueOnce({ data: model.resources[0] })
      .mockResolvedValueOnce(model);

    render(<ScheduleResourceCostPanel projectId="67" tasks={[task]} />);
    await screen.findByText("No cost assignments yet.");

    await user.click(screen.getByLabelText("Resource type"));
    await user.click(screen.getByRole("option", { name: "Material" }));
    await user.type(screen.getByLabelText("Name"), "Structural steel");
    fireEvent.change(screen.getByLabelText("Rate per unit"), {
      target: { value: "125" },
    });
    await user.click(screen.getByRole("button", { name: "Save resource" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/projects/67/scheduling/resources?operation=cost-resource",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          id: null,
          resource_kind: "material",
          display_name: "Structural steel",
          standard_rate: 125,
          cost_per_use: null,
          rate_unit: "unit",
          expected_cost_version: null,
        }),
      }),
    ));
  });

  it("renders person labor facts and surfaces incomplete cost diagnostics", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ...model,
      resources: [{
        ...model.resources[0],
        person_id: "44444444-4444-4444-8444-444444444444",
        resource_kind: "person",
        display_name: "Alex Foreman",
        standard_rate: null,
        rate_unit: "hour",
      }],
    });

    render(<ScheduleResourceCostPanel projectId="67" tasks={[task]} />);

    expect((await screen.findAllByText("Alex Foreman")).length).toBeGreaterThan(0);
    expect(screen.getByText("Incomplete cost facts")).toBeInTheDocument();
    expect(screen.getByText(/standard rate/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Alex Foreman" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Delete Alex Foreman" })).not.toBeInTheDocument();
  });

  it("requires explicit confirmation before permanently deleting a cost assignment", async () => {
    apiFetchMock
      .mockResolvedValueOnce(model)
      .mockResolvedValueOnce({ deleted: true })
      .mockResolvedValueOnce({ ...model, assignments: [] });

    render(<ScheduleResourceCostPanel projectId="67" tasks={[task]} />);
    await screen.findByText("Install framing");

    fireEvent.click(screen.getByRole("button", { name: "Delete cost assignment" }));
    expect(await screen.findByText("Delete cost assignment?")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/projects/67/scheduling/tasks/${task.id}/assignments`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({
          assignment_id: "33333333-3333-4333-8333-333333333333",
          expected_cost_version: 1,
        }),
      }),
    ));
  });
});
