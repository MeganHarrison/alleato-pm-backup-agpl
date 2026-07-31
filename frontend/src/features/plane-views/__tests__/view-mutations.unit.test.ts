import type { SavedTableView } from "@/hooks/use-saved-table-views";

import {
  buildDuplicateSavedViewInput,
  buildDuplicateViewName,
  buildProjectTaskViewFilters,
} from "../view-mutations";

describe("Plane saved view mutation helpers", () => {
  it("builds a unique duplicate name without changing the source name", () => {
    expect(
      buildDuplicateViewName("My view", [
        "My view",
        "My view (copy)",
        "MY VIEW (COPY 2)",
      ]),
    ).toBe("My view (copy 3)");
  });

  it("persists only supported task filter fields", () => {
    expect(
      buildProjectTaskViewFilters({
        name: "Urgent board",
        description: "  Needs attention  ",
        layout: "board",
        status: "open",
        priority: "urgent",
        dueDateFrom: "",
        dueDateTo: "2026-08-31",
        isDefault: true,
      }),
    ).toEqual({
      view: "board",
      status: "open",
      priority: "urgent",
      due_date_from: null,
      due_date_to: "2026-08-31",
      description: "Needs attention",
    });
  });

  it("duplicates every persisted configuration field but not default state", () => {
    const source: SavedTableView = {
      id: "view-1",
      scope_key: "project-tasks-31",
      name: "My view",
      is_default: true,
      visible_columns: ["name", "priority"],
      column_order: ["priority", "name"],
      column_widths: { name: 320 },
      sort_by: "priority",
      sort_direction: "desc",
      filters: { view: "board", status: "done" },
      created_at: "2026-07-31T00:00:00.000Z",
      updated_at: "2026-07-31T00:00:00.000Z",
    };

    expect(buildDuplicateSavedViewInput(source, ["My view"])).toEqual({
      name: "My view (copy)",
      is_default: false,
      visible_columns: ["name", "priority"],
      column_order: ["priority", "name"],
      column_widths: { name: 320 },
      sort_by: "priority",
      sort_direction: "desc",
      filters: { view: "board", status: "done" },
    });
  });
});
