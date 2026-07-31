import { validateScheduleTaskCreateInput } from "../task-validation";

describe("validateScheduleTaskCreateInput", () => {
  it("accepts a valid schedule task create payload", () => {
    expect(
      validateScheduleTaskCreateInput({
        name: "Rough-in inspection",
        status: "in_progress",
        start_date: "2026-05-12",
        finish_date: "2026-05-13",
        percent_complete: 50,
      }),
    ).toEqual([]);
  });

  it("rejects invalid values instead of rewriting them", () => {
    expect(
      validateScheduleTaskCreateInput({
        name: "Bad import row",
        status: "completed",
        start_date: "2026-05-15",
        finish_date: "2026-05-12",
        percent_complete: 140,
      }),
    ).toEqual([
      {
        field: "status",
        error: "Status must be one of: not_started, in_progress, complete",
      },
      {
        field: "finish_date",
        error: "Start date cannot be after finish date",
      },
      {
        field: "percent_complete",
        error: "Percent complete must be between 0 and 100",
      },
    ]);
  });

  it("rejects milestone tasks with non-zero duration", () => {
    expect(
      validateScheduleTaskCreateInput({
        name: "Substantial completion",
        is_milestone: true,
        duration_days: 1,
      }),
    ).toEqual([
      {
        field: "duration_days",
        error: "Milestones must have zero duration",
      },
    ]);
  });

  it("rejects task names that are PDF internal objects", () => {
    const pdfNames = ["/TilingType 1", "/Filter/FlateDecode", "/Resources<<", "/XObject<<"];
    for (const name of pdfNames) {
      const errors = validateScheduleTaskCreateInput({ name });
      expect(errors.some((e) => e.field === "name")).toBe(true);
    }
  });

  it("accepts real task names that start with a slash-like character sequence in context", () => {
    expect(
      validateScheduleTaskCreateInput({ name: "Phase 1 - Foundation" }),
    ).toEqual([]);
    expect(
      validateScheduleTaskCreateInput({ name: "100% Complete Review" }),
    ).toEqual([]);
  });
});
