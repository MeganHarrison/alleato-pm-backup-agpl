import {
  assertLevelingUndoSafe,
  buildEnterpriseCapacitySlots,
  expandPersonWorkCalendarSlots,
  expandProjectWorkingCalendarSlots,
  normalizeWeeklyWorkIntervals,
  previewHourlyResourceLeveling,
  validateTaskScheduleSegments,
  type EnterpriseCapacitySlot,
  type EnterpriseReservation,
  type HourlyLevelingTask,
  type TaskScheduleSegment,
} from "../schedule-hourly-leveling";

const PERSON_ID = "10000000-0000-4000-8000-000000000001";

function iso(hour: number, minute = 0): string {
  return `2026-08-03T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

function quarterHourSlots(
  startHour: number,
  finishHour: number,
): EnterpriseCapacitySlot[] {
  const slots: EnterpriseCapacitySlot[] = [];
  for (let minute = startHour * 60; minute < finishHour * 60; minute += 15) {
    const next = minute + 15;
    slots.push({
      person_id: PERSON_ID,
      starts_at: iso(Math.floor(minute / 60), minute % 60),
      ends_at: iso(Math.floor(next / 60), next % 60),
      capacity_minutes: 15,
      occupied_minutes: 0,
      available_minutes: 15,
      busy_sources: [],
    });
  }
  return slots;
}

describe("Phase 4C hourly scheduling", () => {
  it("expands local person shifts into 15-minute UTC capacity slots", () => {
    const slots = expandPersonWorkCalendarSlots({
      calendar: {
        person_id: PERSON_ID,
        calendar_id: "calendar-a",
        timezone_name: "America/Indiana/Indianapolis",
        slot_minutes: 15,
        weekly_intervals: [
          {
            weekday: 1,
            start_minute: 480,
            end_minute: 540,
            capacity_percent: 80,
          },
        ],
        date_intervals: [],
      },
      range_start: "2026-08-03T00:00:00.000Z",
      range_finish: "2026-08-04T00:00:00.000Z",
    });

    expect(slots).toHaveLength(4);
    expect(slots[0]).toMatchObject({
      person_id: PERSON_ID,
      starts_at: "2026-08-03T12:00:00.000Z",
      ends_at: "2026-08-03T12:15:00.000Z",
      capacity_minutes: 12,
      available_minutes: 12,
    });
  });

  it("treats a configured empty calendar as zero availability", () => {
    expect(
      expandPersonWorkCalendarSlots({
        calendar: {
          person_id: PERSON_ID,
          calendar_id: "calendar-empty",
          timezone_name: "America/Indiana/Indianapolis",
          slot_minutes: 15,
          weekly_intervals: [],
          date_intervals: [],
        },
        range_start: "2026-08-03T00:00:00.000Z",
        range_finish: "2026-08-04T00:00:00.000Z",
      }),
    ).toEqual([]);
  });

  it("normalizes an overnight weekly shift into same-day interval rows", () => {
    expect(
      normalizeWeeklyWorkIntervals([
        {
          weekday: 1,
          start_minute: 23 * 60,
          end_minute: 2 * 60,
          capacity_percent: 100,
        },
      ]),
    ).toEqual([
      {
        weekday: 1,
        start_minute: 1380,
        end_minute: 1440,
        capacity_percent: 100,
      },
      { weekday: 2, start_minute: 0, end_minute: 120, capacity_percent: 100 },
    ]);
  });

  it("accepts task gaps but rejects overlapping or off-grid segments", () => {
    const valid: TaskScheduleSegment[] = [
      {
        id: "segment-a",
        task_id: "task-a",
        segment_index: 0,
        starts_at: iso(9),
        ends_at: iso(10),
        planned_minutes: 60,
        lock_reason: null,
      },
      {
        id: "segment-b",
        task_id: "task-a",
        segment_index: 1,
        starts_at: iso(11),
        ends_at: iso(12),
        planned_minutes: 60,
        lock_reason: null,
      },
    ];

    expect(validateTaskScheduleSegments(valid)).toEqual(valid);
    expect(() =>
      validateTaskScheduleSegments([
        valid[0],
        { ...valid[1], starts_at: iso(9, 45) },
      ]),
    ).toThrow("Task segments must not overlap");
    expect(() =>
      validateTaskScheduleSegments([
        { ...valid[0], ends_at: "2026-08-03T09:52:00.000Z" },
      ]),
    ).toThrow("15-minute grid");
  });

  it("subtracts other-project work by person and redacts unauthorized source details", () => {
    const reservations: EnterpriseReservation[] = [
      {
        person_id: PERSON_ID,
        project_id: 43,
        task_id: "local-task",
        project_name: "Authorized project",
        task_name: "Local task",
        starts_at: iso(9),
        ends_at: iso(10),
        allocation_percent: 50,
      },
      {
        person_id: PERSON_ID,
        project_id: 99,
        task_id: "private-task",
        project_name: "Private project",
        task_name: "Confidential task",
        starts_at: iso(9),
        ends_at: iso(10),
        allocation_percent: 50,
      },
    ];

    const [slot] = buildEnterpriseCapacitySlots({
      base_slots: quarterHourSlots(9, 10),
      reservations,
      authorized_project_ids: [43],
    });

    expect(slot.occupied_minutes).toBe(15);
    expect(slot.available_minutes).toBe(0);
    expect(slot.busy_sources).toEqual([
      expect.objectContaining({
        project_id: 43,
        task_id: "local-task",
        redacted: false,
      }),
      {
        project_id: null,
        task_id: null,
        project_name: null,
        task_name: null,
        redacted: true,
      },
    ]);
  });

  it("creates ordered split segments around an external reservation", () => {
    const external: EnterpriseReservation = {
      person_id: PERSON_ID,
      project_id: 99,
      task_id: "external-task",
      project_name: "Another project",
      task_name: "External work",
      starts_at: iso(10),
      ends_at: iso(11),
      allocation_percent: 100,
    };
    const capacity = buildEnterpriseCapacitySlots({
      base_slots: quarterHourSlots(9, 12),
      reservations: [external],
      authorized_project_ids: [],
    });
    const task: HourlyLevelingTask = {
      task_id: "task-a",
      task_name: "Install controls",
      earliest_start_at: iso(9),
      work_minutes: 120,
      allow_split: true,
      fixed: false,
      assignments: [{ person_id: PERSON_ID, allocation_percent: 100 }],
    };

    const result = previewHourlyResourceLeveling({
      tasks: [task],
      capacity_slots: capacity,
      slot_minutes: 15,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.proposals).toEqual([
      expect.objectContaining({
        task_id: "task-a",
        segments: [
          expect.objectContaining({
            segment_index: 0,
            starts_at: iso(9),
            ends_at: iso(10),
          }),
          expect.objectContaining({
            segment_index: 1,
            starts_at: iso(11),
            ends_at: iso(12),
          }),
        ],
      }),
    ]);
  });

  it("never moves fixed or progressed work", () => {
    const task: HourlyLevelingTask = {
      task_id: "task-fixed",
      task_name: "Commission system",
      earliest_start_at: iso(9),
      work_minutes: 60,
      allow_split: true,
      fixed: true,
      assignments: [{ person_id: PERSON_ID, allocation_percent: 100 }],
    };

    expect(
      previewHourlyResourceLeveling({
        tasks: [task],
        capacity_slots: quarterHourSlots(9, 12),
        slot_minutes: 15,
      }),
    ).toEqual({
      proposals: [],
      diagnostics: [
        expect.objectContaining({ code: "fixed_task", task_id: "task-fixed" }),
      ],
    });
  });

  it("places a successor after the leveled predecessor finish", () => {
    const predecessor: HourlyLevelingTask = {
      task_id: "task-predecessor",
      task_name: "Rough-in",
      earliest_start_at: iso(9),
      current_start_at: iso(9),
      current_finish_at: iso(10),
      work_minutes: 60,
      allow_split: true,
      fixed: false,
      assignments: [{ person_id: PERSON_ID, allocation_percent: 100 }],
    };
    const successor: HourlyLevelingTask = {
      task_id: "task-successor",
      task_name: "Trim",
      earliest_start_at: iso(9),
      current_start_at: iso(10),
      current_finish_at: iso(11),
      work_minutes: 60,
      allow_split: true,
      fixed: false,
      assignments: [{ person_id: PERSON_ID, allocation_percent: 100 }],
      predecessors: [
        {
          task_id: predecessor.task_id,
          dependency_type: "finish_to_start",
          lag_minutes: 0,
          current_start_at: iso(9),
          current_finish_at: iso(10),
        },
      ],
    };

    const result = previewHourlyResourceLeveling({
      tasks: [successor, predecessor],
      capacity_slots: quarterHourSlots(9, 12),
    });

    expect(result.proposals[0].segments[0].starts_at).toBe(iso(9));
    expect(result.proposals[1].segments[0].starts_at).toBe(iso(10));
  });

  it("applies dependency lag through project working time across a weekend", () => {
    const projectWorkingSlots = expandProjectWorkingCalendarSlots({
      calendar: {
        working_weekdays: [1, 2, 3, 4, 5],
        non_working_dates: [],
      },
      timezone_name: "UTC",
      range_start: "2026-08-07T00:00:00.000Z",
      range_finish: "2026-08-12T00:00:00.000Z",
    });
    const predecessor: HourlyLevelingTask = {
      task_id: "friday-work",
      task_name: "Friday work",
      earliest_start_at: "2026-08-07T16:00:00.000Z",
      current_start_at: "2026-08-07T16:00:00.000Z",
      current_finish_at: "2026-08-07T17:00:00.000Z",
      work_minutes: 60,
      allow_split: false,
      fixed: true,
      assignments: [{ person_id: PERSON_ID, allocation_percent: 100 }],
    };
    const successor: HourlyLevelingTask = {
      task_id: "successor",
      task_name: "Successor",
      earliest_start_at: "2026-08-07T17:00:00.000Z",
      work_minutes: 60,
      allow_split: false,
      fixed: false,
      assignments: [{ person_id: PERSON_ID, allocation_percent: 100 }],
      predecessors: [{
        task_id: predecessor.task_id,
        dependency_type: "finish_to_start",
        lag_minutes: 480,
        current_start_at: predecessor.current_start_at!,
        current_finish_at: predecessor.current_finish_at!,
      }],
    };
    const tuesdayCapacity = Array.from({ length: 4 }, (_, index) => ({
      person_id: PERSON_ID,
      starts_at: `2026-08-11T08:${String(index * 15).padStart(2, "0")}:00.000Z`,
      ends_at: `2026-08-11T${index === 3 ? "09:00" : `08:${String((index + 1) * 15).padStart(2, "0")}`}:00.000Z`,
      capacity_minutes: 15,
      occupied_minutes: 0,
      available_minutes: 15,
      busy_sources: [],
    }));

    const result = previewHourlyResourceLeveling({
      tasks: [successor, predecessor],
      capacity_slots: tuesdayCapacity,
      project_working_slots: projectWorkingSlots,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].segments[0].starts_at).toBe("2026-08-11T08:00:00.000Z");
  });

  it("applies a negative dependency lead backward through project working time", () => {
    const projectWorkingSlots = expandProjectWorkingCalendarSlots({
      calendar: { working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] },
      timezone_name: "UTC",
      range_start: "2026-08-07T00:00:00.000Z",
      range_finish: "2026-08-11T00:00:00.000Z",
    });
    const predecessor: HourlyLevelingTask = {
      task_id: "monday-work",
      task_name: "Monday work",
      earliest_start_at: "2026-08-10T08:00:00.000Z",
      current_start_at: "2026-08-10T08:00:00.000Z",
      current_finish_at: "2026-08-10T09:00:00.000Z",
      work_minutes: 60,
      allow_split: false,
      fixed: true,
      assignments: [{ person_id: PERSON_ID, allocation_percent: 100 }],
    };
    const successor: HourlyLevelingTask = {
      task_id: "lead-successor",
      task_name: "Lead successor",
      earliest_start_at: "2026-08-07T08:00:00.000Z",
      work_minutes: 60,
      allow_split: false,
      fixed: false,
      assignments: [{ person_id: PERSON_ID, allocation_percent: 100 }],
      predecessors: [{
        task_id: predecessor.task_id,
        dependency_type: "start_to_start",
        lag_minutes: -480,
        current_start_at: predecessor.current_start_at!,
        current_finish_at: predecessor.current_finish_at!,
      }],
    };

    const result = previewHourlyResourceLeveling({
      tasks: [successor, predecessor],
      capacity_slots: quarterHourSlots(8, 9).map((slot) => ({
        ...slot,
        starts_at: slot.starts_at.replace("2026-08-03", "2026-08-07"),
        ends_at: slot.ends_at.replace("2026-08-03", "2026-08-07"),
      })),
      project_working_slots: projectWorkingSlots,
    });

    expect(result.proposals[0].segments[0].starts_at).toBe("2026-08-07T08:00:00.000Z");
  });

  it("schedules higher leveling priority first", () => {
    const makeTask = (
      taskId: string,
      priority: number,
    ): HourlyLevelingTask => ({
      task_id: taskId,
      task_name: taskId,
      earliest_start_at: iso(9),
      work_minutes: 60,
      allow_split: false,
      fixed: false,
      leveling_priority: priority,
      assignments: [{ person_id: PERSON_ID, allocation_percent: 100 }],
    });
    const result = previewHourlyResourceLeveling({
      tasks: [makeTask("low", 100), makeTask("high", 900)],
      capacity_slots: quarterHourSlots(9, 11),
    });
    expect(result.proposals.map((proposal) => proposal.task_id)).toEqual([
      "high",
      "low",
    ]);
    expect(result.proposals[0].segments[0].starts_at).toBe(iso(9));
    expect(result.proposals[1].segments[0].starts_at).toBe(iso(10));
  });

  it("allows compensating undo only while the applied after-state is unchanged", () => {
    expect(() =>
      assertLevelingUndoSafe("after-state-v1", "after-state-v1"),
    ).not.toThrow();
    expect(() =>
      assertLevelingUndoSafe("after-state-v1", "later-manual-edit"),
    ).toThrow(
      "Leveling undo conflict: affected schedule state changed after apply",
    );
  });
});
