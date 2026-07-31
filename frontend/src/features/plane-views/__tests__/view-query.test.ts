import {
  applyProjectTaskViewFiltersToSearchParams,
  describeProjectTaskViewFilters,
  normalizeProjectTaskViewFilters,
  projectTaskViewFiltersFromSearchParams,
} from "@/features/plane-views/view-query";

describe("Plane-derived project task view query adapter", () => {
  it("normalizes unsupported values to canonical task defaults", () => {
    expect(
      normalizeProjectTaskViewFilters({
        status: "blocked",
        priority: "critical",
        due_date_from: "",
      }),
    ).toEqual({
      view: "list",
      status: "open",
      priority: null,
      due_date_from: null,
      due_date_to: null,
      description: null,
      access: "private",
    });
  });

  it("maps saved view filters to canonical task URL params without dropping scope", () => {
    const result = applyProjectTaskViewFiltersToSearchParams(
      new URLSearchParams("scope=all&task=task-1"),
      {
        view: "board",
        status: "done",
        priority: "high",
        due_date_from: "2026-07-01",
        due_date_to: "2026-07-31",
      },
    );

    expect(result.toString()).toBe(
      "scope=all&view=board&status=done&priority=high&due_from=2026-07-01&due_to=2026-07-31",
    );
  });

  it("reads canonical task URL params back into a saved-view filter contract", () => {
    expect(
      projectTaskViewFiltersFromSearchParams(
        new URLSearchParams(
          "view=board&status=done&priority=urgent&due_to=2026-08-01",
        ),
      ),
    ).toEqual({
      view: "board",
      status: "done",
      priority: "urgent",
      due_date_from: null,
      due_date_to: "2026-08-01",
      description: null,
      access: "private",
    });
  });

  it("describes active criteria without decorative summary data", () => {
    const description = describeProjectTaskViewFilters({
      status: "open",
      priority: "medium",
      due_date_to: "2026-08-01",
    });

    expect(description).toBe(
      "Open \u00b7 Medium priority \u00b7 Due by 2026-08-01",
    );
    expect(description).not.toContain("\u00c2");
  });
});
