import {
  buildTasksTableColumns,
  tasksColumns,
  tasksDefaultVisibleColumns,
} from "../tasks-table-config";

describe("tasks table configuration", () => {
  it("keeps secondary metadata hidden by default so the task name stays primary", () => {
    expect(tasksDefaultVisibleColumns).not.toContain("created_at");
    expect(tasksColumns.find((column) => column.id === "created_at")).toMatchObject({
      defaultVisible: false,
    });
  });

  it("gives the task name more room than supporting metadata columns", () => {
    const columns = buildTasksTableColumns();
    const taskNameColumn = columns.find((column) => column.id === "description");

    expect(taskNameColumn).toMatchObject({
      width: 380,
    });

    for (const columnId of [
      "feedback",
      "source_system",
      "source_date",
      "due_date",
      "created_at",
      "priority",
      "status",
    ]) {
      expect(columns.find((column) => column.id === columnId)?.width).toBeLessThan(
        taskNameColumn?.width ?? 0,
      );
    }
  });

  it("renders the task name with readable body-sized text instead of compressed metadata styling", () => {
    const taskNameColumn = buildTasksTableColumns().find(
      (column) => column.id === "description",
    );
    const rendered = taskNameColumn?.render({
      description: "Review weekly reports before distribution",
      title: null,
    });

    expect(rendered).toMatchObject({
      props: {
        className: expect.stringContaining("text-sm"),
      },
    });
  });
});
