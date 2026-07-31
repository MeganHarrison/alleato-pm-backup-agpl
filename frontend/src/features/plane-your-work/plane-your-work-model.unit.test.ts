import type { TasksRow } from "@/features/tasks/task-utils";
import {
  filterPlaneYourWorkTasks,
  groupPlaneTasksByProject,
  normalizePlaneTaskStatus,
} from "./plane-your-work-model";

function task(overrides: Partial<TasksRow> = {}): TasksRow {
  return {
    id: "task-1",
    title: "Confirm storefront framing",
    description: "Confirm storefront framing",
    status: "open",
    project_id: 31,
    project_ids: [31],
    project_name: "All Implementation",
    priority: "high",
    due_date: "2026-08-05",
    assignee_person_id: "person-1",
    assignee_name: "Megan Harrison",
    assignee_email: "megan@example.com",
    metadata_id: null,
    segment_id: null,
    source_chunk_id: null,
    schedule_task_id: null,
    meeting_title: null,
    client_id: null,
    source_system: "manual",
    embedding: null,
    created_at: "2026-07-30T12:00:00.000Z",
    updated_at: null,
    file_name: null,
    source_title: null,
    source_type: null,
    source_date: null,
    source_url: null,
    source_web_url: null,
    fireflies_link: null,
    meeting_link: null,
    source_context: null,
    assigned_by: null,
    extraction_source: null,
    extraction_model: null,
    extraction_prompt_version: null,
    extraction_metadata: null,
    ...overrides,
  };
}

describe("Plane Your Work model", () => {
  it("normalizes legacy lifecycle values into canonical task status values", () => {
    expect(normalizePlaneTaskStatus("complete")).toBe("done");
    expect(normalizePlaneTaskStatus("started")).toBe("in_progress");
    expect(normalizePlaneTaskStatus("blocked")).toBe("blocked");
    expect(normalizePlaneTaskStatus(null)).toBe("open");
  });

  it("filters by status, project, and search without mock scope logic", () => {
    const result = filterPlaneYourWorkTasks(
      [
        task({ id: "keep", project_id: 31, title: "Storefront review" }),
        task({ id: "wrong-project", project_id: 42 }),
        task({ id: "done", project_id: 31, status: "done" }),
      ],
      "open",
      "31",
      "storefront",
    );

    expect(result.map((item) => item.id)).toEqual(["keep"]);
  });

  it("groups project work and keeps unscoped tasks separate", () => {
    const groups = groupPlaneTasksByProject([
      task({ id: "a", project_id: 31, project_name: "All Implementation" }),
      task({ id: "b", project_id: 31, project_name: "All Implementation" }),
      task({
        id: "c",
        project_id: null,
        project_ids: [],
        project_name: null,
      }),
    ]);

    expect(groups.map((group) => [group.label, group.tasks.length])).toEqual([
      ["All Implementation", 2],
      ["No project", 1],
    ]);
  });
});
