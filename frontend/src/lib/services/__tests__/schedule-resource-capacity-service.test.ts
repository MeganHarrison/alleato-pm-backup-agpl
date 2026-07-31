import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { ScheduleResourceService } from "../schedule-resource-service";

const resource = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  project_id: 67,
  person_id: "11111111-1111-4111-8111-111111111111",
  display_name: "Active Person",
  email: "active@example.com",
  job_title: null,
  person_status: "active" as const,
  membership_status: "active" as const,
  eligible: true,
};

const profile = {
  profile_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  project_id: 67,
  resource_id: resource.id,
  configured: true,
  version: 3,
  coverage_start_date: "2026-08-01",
  coverage_finish_date: "2026-08-10",
  weekday_overrides: [{ weekday: 1, capacity_percent: 80 }],
  exceptions: [{ date: "2026-08-03", capacity_percent: 0, reason: "Vacation" }],
};

function readModel(overrides: Record<string, unknown> = {}) {
  return {
    project_id: 67,
    range: { start: "2026-08-01", finish: "2026-08-10" },
    resources: [resource],
    capacity_profiles: [profile],
    tasks: [],
    dependencies: [],
    assignments: [],
    calendar: { working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [], working_date_overrides: [] },
    ...overrides,
  };
}

describe("ScheduleResourceService capacity profiles", () => {
  it("loads one coherent bounded project-capacity read model", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: readModel(), error: null });
    const service = new ScheduleResourceService({ rpc } as unknown as SupabaseClient<Database>);

    const result = await service.getCapacityRange(67, "2026-08-01", "2026-08-10");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_schedule_resource_read_model", {
      p_project_id: 67,
      p_start: "2026-08-01",
      p_finish: "2026-08-10",
      p_resource_id: null,
      p_horizon_days: null,
      p_include_leveling: false,
    });
    expect(result).toEqual({
      project_id: 67,
      range: { start: "2026-08-01", finish: "2026-08-10" },
      profiles: [profile],
    });
  });

  it("rejects an unbounded visible range before querying", async () => {
    const rpc = jest.fn();
    const service = new ScheduleResourceService({ rpc } as unknown as SupabaseClient<Database>);
    await expect(service.getCapacityRange(67, "2026-01-01", "2026-04-03")).rejects.toThrow("limited to 92");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns an explicit inherited profile from a coherent selected-resource read", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: readModel({
        range: { start: null, finish: null },
        capacity_profiles: [],
      }),
      error: null,
    });
    const service = new ScheduleResourceService({ rpc } as unknown as SupabaseClient<Database>);

    await expect(service.getCapacityProfile(67, resource.id)).resolves.toMatchObject({
      project_id: 67,
      resource_id: resource.id,
      configured: false,
      version: null,
      weekday_overrides: [],
      exceptions: [],
    });
    expect(rpc).toHaveBeenCalledWith("get_schedule_resource_read_model", expect.objectContaining({
      p_resource_id: resource.id,
      p_start: null,
      p_finish: null,
      p_include_leveling: false,
    }));
  });

  it("replaces one complete profile with compare-and-swap and uses the transactional result", async () => {
    const canonical = { ...profile, version: 4, coverage_start_date: null, coverage_finish_date: null };
    const rpc = jest.fn().mockResolvedValue({ data: canonical, error: null });
    const service = new ScheduleResourceService({ rpc } as unknown as SupabaseClient<Database>);

    const result = await service.replaceCapacityProfile(67, resource.id, {
      expected_version: 3,
      weekday_overrides: canonical.weekday_overrides,
      exceptions: canonical.exceptions,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("replace_schedule_resource_capacity_profile", {
      p_project_id: 67,
      p_resource_id: resource.id,
      p_weekday_overrides: [{ weekday: 1, capacity_percent: 80 }],
      p_exceptions: [{ date: "2026-08-03", capacity_percent: 0, reason: "Vacation" }],
      p_expected_version: 3,
    });
    expect(result).toEqual(canonical);
  });

  it("loads every leveling input from one statement snapshot", async () => {
    const task = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      project_id: 67,
      parent_task_id: null,
      name: "Install conveyors",
      start_date: "2026-08-03",
      finish_date: "2026-08-07",
      duration_days: 5,
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
    const assignment = {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      project_id: 67,
      task_id: task.id,
      resource_id: resource.id,
      person_id: resource.person_id,
      allocation_percent: 60,
    };
    const rpc = jest.fn().mockResolvedValue({
      data: readModel({
        range: { start: "2026-08-03", finish: "2027-08-07" },
        tasks: [task],
        assignments: [assignment],
      }),
      error: null,
    });
    const service = new ScheduleResourceService({ rpc } as unknown as SupabaseClient<Database>);

    const result = await service.loadLevelingContext(67, 365);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_schedule_resource_read_model", {
      p_project_id: 67,
      p_start: null,
      p_finish: null,
      p_resource_id: null,
      p_horizon_days: 365,
      p_include_leveling: true,
    });
    expect(result).toMatchObject({
      tasks: [task],
      resources: [resource],
      assignments: [assignment],
      capacity_profiles: [profile],
      horizon_days: 365,
    });
  });
});
