import {
  summarizePlaneWorkItems,
  type PlaneWorkItemDisplayProperties,
} from "./plane-work-items-controls";

describe("Plane Work Items controls", () => {
  it("builds analytics from live task rows", () => {
    const summary = summarizePlaneWorkItems([
      {
        id: "one",
        status: "open",
        assignee_name: null,
        assignee_email: null,
        due_date: null,
      },
      {
        id: "two",
        status: "completed",
        assignee_name: "Megan",
        assignee_email: null,
        due_date: null,
      },
    ] as never);

    expect(summary).toEqual({
      status: { open: 1, in_progress: 0, done: 1 },
      total: 2,
      unassigned: 1,
      overdue: 0,
    });
  });

  it("keeps display properties explicit", () => {
    const properties: PlaneWorkItemDisplayProperties = {
      assignee: true,
      dueDate: false,
      priority: true,
    };

    expect(properties).toEqual({
      assignee: true,
      dueDate: false,
      priority: true,
    });
  });
});
