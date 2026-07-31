import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { ScheduleResourceService } from "../schedule-resource-service";

const personId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";

function clientWithRpc(rpc: jest.Mock): SupabaseClient<Database> {
  const client = Object.create(null) as SupabaseClient<Database>;
  Object.defineProperty(client, "rpc", { value: rpc });
  return client;
}

function clientWithRpcAndCalendar(rpc: jest.Mock): SupabaseClient<Database> {
  const client = clientWithRpc(rpc);
  Object.defineProperty(client, "from", {
    value: jest.fn((table: string) => ({
      select: () => ({
        eq: () => table === "project_schedule_calendars"
          ? {
              maybeSingle: async () => ({
                data: {
                  working_weekdays: [1, 2, 3, 4, 5],
                  timezone_name: "America/Indiana/Indianapolis",
                },
                error: null,
              }),
            }
          : Promise.resolve({ data: [], error: null }),
      }),
    })),
  });
  return client;
}

describe("ScheduleResourceService Phase 4C contracts", () => {
  it("loads a bounded, redaction-aware enterprise capacity snapshot", async () => {
    const capacity = {
      project_id: 67,
      source_token: "a".repeat(64),
      range: { start: "2026-08-03T12:00:00Z", finish: "2026-08-10T21:00:00Z" },
      person_revisions: { [personId]: 4 },
      calendars: [
        {
          person_id: personId,
          calendar_id: null,
          timezone_name: "America/Indiana/Indianapolis",
          slot_minutes: 15,
          version: null,
          weekly_intervals: [],
          date_intervals: [],
        },
      ],
      reservations: [
        {
          person_id: personId,
          project_id: null,
          task_id: null,
          project_name: null,
          task_name: null,
          redacted: true,
          starts_at: "2026-08-04T12:00:00Z",
          ends_at: "2026-08-04T13:00:00Z",
          allocation_percent: 100,
        },
      ],
    };
    const rpc = jest.fn().mockResolvedValue({ data: capacity, error: null });
    const service = new ScheduleResourceService(clientWithRpc(rpc));

    await expect(
      service.getEnterpriseCapacity(
        67,
        [personId],
        capacity.range.start,
        capacity.range.finish,
      ),
    ).resolves.toEqual(capacity);
    expect(rpc).toHaveBeenCalledWith("get_schedule_enterprise_capacity", {
      p_project_id: 67,
      p_person_ids: [personId],
      p_range_start: capacity.range.start,
      p_range_finish: capacity.range.finish,
    });
  });

  it("saves a person's shift calendar with optimistic concurrency", async () => {
    const saved = {
      id: "33333333-3333-4333-8333-333333333333",
      person_id: personId,
      timezone_name: "America/Indiana/Indianapolis",
      slot_minutes: 15,
      version: 3,
    };
    const rpc = jest.fn().mockResolvedValue({ data: saved, error: null });
    const service = new ScheduleResourceService(clientWithRpc(rpc));

    await expect(
      service.replacePersonWorkCalendar(67, personId, {
        timezone_name: "America/Indiana/Indianapolis",
        expected_version: 2,
        weekly_intervals: [
          {
            weekday: 1,
            start_minute: 480,
            end_minute: 1020,
            capacity_percent: 100,
          },
        ],
        date_intervals: [],
      }),
    ).resolves.toEqual(saved);
    expect(rpc).toHaveBeenCalledWith(
      "replace_schedule_person_work_calendar",
      expect.objectContaining({
        p_project_id: 67,
        p_person_id: personId,
        p_expected_version: 2,
      }),
    );
  });

  it("persists split-task segments with a task version guard", async () => {
    const saved = {
      task_id: taskId,
      task_version: 8,
      state: { task: {}, segments: [] },
    };
    const rpc = jest.fn().mockResolvedValue({ data: saved, error: null });
    const service = new ScheduleResourceService(clientWithRpc(rpc));

    await expect(
      service.replaceTaskSegments(67, taskId, {
        expected_task_version: 7,
        segments: [
          {
            segment_index: 0,
            starts_at: "2026-08-03T12:00:00Z",
            ends_at: "2026-08-03T16:00:00Z",
            planned_minutes: 240,
            lock_reason: null,
          },
        ],
      }),
    ).resolves.toEqual(saved);
    expect(rpc).toHaveBeenCalledWith(
      "replace_schedule_task_segments",
      expect.objectContaining({
        p_project_id: 67,
        p_task_id: taskId,
        p_expected_task_version: 7,
      }),
    );
  });

  it("creates, applies, lists, and undoes immutable leveling records", async () => {
    const context = {
      project_id: 67,
      source_token: "b".repeat(64),
      range: {
        start: "2026-08-03T00:00:00.000Z",
        finish: "2026-08-04T00:00:00.000Z",
      },
      person_revisions: { [personId]: 1 },
      project_timezone: "America/Indiana/Indianapolis",
      calendars: [
        {
          person_id: personId,
          calendar_id: "33333333-3333-4333-8333-333333333333",
          timezone_name: "America/Indiana/Indianapolis",
          slot_minutes: 15,
          version: 1,
          weekly_intervals: [
            {
              weekday: 1,
              start_minute: 480,
              end_minute: 1020,
              capacity_percent: 100,
            },
          ],
          date_intervals: [],
        },
      ],
      reservations: [],
      dependencies: [],
      assignments: [
        { task_id: taskId, person_id: personId, allocation_percent: 100 },
      ],
      tasks: [
        {
          id: taskId,
          name: "Install controls",
          start_date: "2026-08-03",
          finish_date: "2026-08-03",
          forecast_start_date: null,
          forecast_finish_date: null,
          duration_days: 1,
          remaining_duration_days: 1,
          percent_complete: 0,
          status: "not_started",
          is_milestone: false,
          actual_start_date: null,
          actual_finish_date: null,
          constraint_type: "none",
          constraint_date: null,
          work_minutes: 60,
          allow_leveling_split: true,
          leveling_priority: 500,
          schedule_version: 7,
          segments: [],
        },
      ],
    };
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({
        data: { event: { id: "event-1", event_type: "applied" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ event: { id: "event-1" }, can_undo: true }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { event: { id: "event-2", event_type: "undone" } },
        error: null,
      });
    const authoritativeRpc = jest.fn().mockResolvedValue({
      data: { run: { id: "run-1" }, changes: [] },
      error: null,
    });
    const authoritativeClient = clientWithRpc(authoritativeRpc);
    const service = new ScheduleResourceService(clientWithRpcAndCalendar(rpc));

    await service.createLevelingRun(67, {
      range_start: context.range.start,
      range_finish: context.range.finish,
    }, {
      client: authoritativeClient,
      actorUserId: "66666666-6666-4666-8666-666666666666",
    });
    await service.applyLevelingRun(
      67,
      "44444444-4444-4444-8444-444444444444",
      "Resolve overload",
    );
    await service.getLevelingHistory(67, 25);
    await service.undoLevelingEvent(
      67,
      "55555555-5555-4555-8555-555555555555",
      "Restore prior plan",
    );

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "get_schedule_hourly_leveling_context",
      "apply_schedule_leveling_run",
      "get_schedule_leveling_history",
      "undo_schedule_leveling_event",
    ]);
    expect(rpc.mock.calls[0][1]).toEqual({
      p_project_id: 67,
      p_range_start: context.range.start,
      p_range_finish: context.range.finish,
    });
    expect(authoritativeRpc).toHaveBeenCalledWith("create_authoritative_schedule_leveling_run", expect.objectContaining({
      p_actor_user_id: "66666666-6666-4666-8666-666666666666",
      p_algorithm_version: "hourly-15m-v2",
      p_person_revision_vector: { [personId]: 1 },
      p_changes: [
        expect.objectContaining({
          task_id: taskId,
          expected_task_version: 7,
          after_state: expect.objectContaining({ segments: expect.any(Array) }),
        }),
      ],
    }));
  });

  it("blocks a successor when its predecessor has no schedule bounds", async () => {
    const predecessorId = "77777777-7777-4777-8777-777777777777";
    const context = {
      project_id: 67,
      source_token: "c".repeat(64),
      range: {
        start: "2026-08-03T00:00:00.000Z",
        finish: "2026-08-04T00:00:00.000Z",
      },
      person_revisions: { [personId]: 1 },
      project_timezone: "America/Indiana/Indianapolis",
      calendars: [{
        person_id: personId,
        calendar_id: null,
        timezone_name: "America/Indiana/Indianapolis",
        slot_minutes: 15,
        version: null,
        weekly_intervals: [],
        date_intervals: [],
      }],
      reservations: [],
      dependencies: [{
        task_id: taskId,
        predecessor_task_id: predecessorId,
        dependency_type: "finish_to_start",
        lag_minutes: 0,
      }],
      assignments: [{ task_id: taskId, person_id: personId, allocation_percent: 100 }],
      tasks: [
        {
          id: predecessorId,
          name: "Unscheduled predecessor",
          start_date: null,
          finish_date: null,
          forecast_start_date: null,
          forecast_finish_date: null,
          duration_days: 1,
          remaining_duration_days: 1,
          percent_complete: 0,
          status: "not_started",
          is_milestone: false,
          actual_start_date: null,
          actual_finish_date: null,
          constraint_type: "none",
          constraint_date: null,
          work_minutes: 60,
          allow_leveling_split: true,
          leveling_priority: 500,
          schedule_version: 1,
          segments: [],
        },
        {
          id: taskId,
          name: "Successor",
          start_date: "2026-08-03",
          finish_date: "2026-08-03",
          forecast_start_date: null,
          forecast_finish_date: null,
          duration_days: 1,
          remaining_duration_days: 1,
          percent_complete: 0,
          status: "not_started",
          is_milestone: false,
          actual_start_date: null,
          actual_finish_date: null,
          constraint_type: "none",
          constraint_date: null,
          work_minutes: 60,
          allow_leveling_split: true,
          leveling_priority: 500,
          schedule_version: 1,
          segments: [],
        },
      ],
    };
    const rpc = jest.fn().mockResolvedValue({ data: context, error: null });
    const service = new ScheduleResourceService(clientWithRpcAndCalendar(rpc));

    const result = await service.createLevelingRun(67, {
      range_start: context.range.start,
      range_finish: context.range.finish,
    });

    expect(result.run).toBeNull();
    expect(result.preview.proposals).toEqual([]);
    expect(result.preview.diagnostics).toEqual([
      expect.objectContaining({ code: "constraint_blocked", task_id: taskId }),
    ]);
  });
});
