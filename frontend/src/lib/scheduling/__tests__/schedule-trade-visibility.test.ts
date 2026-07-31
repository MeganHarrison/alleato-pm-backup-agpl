import { selectTradePublishedActivities } from "../schedule-trade-visibility";

const activities = [
  { sourceTaskId: "task-electrical", name: "Rough-in electrical", assigneePersonId: "person-electric" },
  { sourceTaskId: "task-plumbing", name: "Rough-in plumbing", assigneePersonId: "person-plumbing" },
  { sourceTaskId: "task-unassigned", name: "General conditions", assigneePersonId: null },
];

describe("selectTradePublishedActivities", () => {
  it("returns activities assigned to authorized project members in the same company", () => {
    expect(
      selectTradePublishedActivities(
        activities,
        ["person-electric", "person-plumbing"],
      ),
    ).toEqual([
      {
        sourceTaskId: "task-electrical",
        name: "Rough-in electrical",
        assigneePersonId: "person-electric",
      },
      {
        sourceTaskId: "task-plumbing",
        name: "Rough-in plumbing",
        assigneePersonId: "person-plumbing",
      },
    ]);
  });

  it("fails closed without an authorized project-member list", () => {
    expect(selectTradePublishedActivities(activities, [])).toEqual([]);
    expect(selectTradePublishedActivities(activities, ["person-other"])).toEqual([]);
  });
});
