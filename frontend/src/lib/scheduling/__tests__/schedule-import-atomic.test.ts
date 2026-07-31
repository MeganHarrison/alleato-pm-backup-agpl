import {
  normalizeScheduleRows,
  validateScheduleImportGraph,
} from "../schedule-import-preview";

describe("schedule import graph validation", () => {
  it("preserves predecessor relationship types and lags from tabular sources", () => {
    const preview = normalizeScheduleRows([
      {
        "Task ID": "1",
        "Task Name": "Mobilize",
        Predecessors: "",
      },
      {
        "Task ID": "2",
        "Task Name": "Install",
        Predecessors: "1FS+2, 1SS-1",
      },
    ], "csv");

    expect(preview.tasks[1]?.predecessors).toEqual([
      { predecessor_external_id: "1", dependency_type: "finish_to_start", lag_days: 2 },
      { predecessor_external_id: "1", dependency_type: "start_to_start", lag_days: -1 },
    ]);
  });

  it("rejects invalid graph references before a replacement can begin", () => {
    expect(() => validateScheduleImportGraph([
      {
        external_id: "1",
        parent_external_id: null,
        predecessors: [{ predecessor_external_id: "missing", dependency_type: "finish_to_start", lag_days: 0 }],
        name: "Install",
        wbs_code: null,
        start_date: null,
        finish_date: null,
        duration_days: null,
        percent_complete: 0,
        status: "not_started",
        is_milestone: false,
        sort_order: 1,
      },
    ])).toThrow("Task \"Install\" references missing predecessor \"missing\".");
  });

  it("rejects duplicate external identifiers before a replacement can begin", () => {
    expect(() => validateScheduleImportGraph([
      {
        external_id: "1",
        parent_external_id: null,
        predecessors: [],
        name: "First",
        wbs_code: null,
        start_date: null,
        finish_date: null,
        duration_days: null,
        percent_complete: 0,
        status: "not_started",
        is_milestone: false,
        sort_order: 1,
      },
      {
        external_id: "1",
        parent_external_id: null,
        predecessors: [],
        name: "Second",
        wbs_code: null,
        start_date: null,
        finish_date: null,
        duration_days: null,
        percent_complete: 0,
        status: "not_started",
        is_milestone: false,
        sort_order: 2,
      },
    ])).toThrow('Duplicate external ID "1". Each imported task must have a unique ID.');
  });

  it("rejects a circular relationship before a replacement can begin", () => {
    const taskFields = {
      parent_external_id: null,
      wbs_code: null,
      start_date: null,
      finish_date: null,
      duration_days: null,
      percent_complete: 0,
      status: "not_started" as const,
      is_milestone: false,
    };

    expect(() => validateScheduleImportGraph([
      {
        ...taskFields,
        external_id: "1",
        predecessors: [{ predecessor_external_id: "2", dependency_type: "finish_to_start", lag_days: 0 }],
        name: "First",
        sort_order: 1,
      },
      {
        ...taskFields,
        external_id: "2",
        predecessors: [{ predecessor_external_id: "1", dependency_type: "finish_to_start", lag_days: 0 }],
        name: "Second",
        sort_order: 2,
      },
    ])).toThrow("Imported dependencies contain a circular relationship.");
  });
});
