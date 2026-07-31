import { selectTradePublishedActivities } from "../schedule-trade-visibility";

const activities = [
  { sourceTaskId: "task-electrical", name: "Rough-in electrical", assigneePersonId: "person-electric" },
  { sourceTaskId: "task-plumbing", name: "Rough-in plumbing", assigneePersonId: "person-plumbing" },
  { sourceTaskId: "task-unassigned", name: "General conditions", assigneePersonId: null },
];

describe("selectTradePublishedActivities", () => {
  it("returns only activities assigned to the authorized trade person", () => {
    expect(selectTradePublishedActivities(activities, "person-electric")).toEqual([
      { sourceTaskId: "task-electrical", name: "Rough-in electrical", assigneePersonId: "person-electric" },
    ]);
  });

  it("fails closed when the user cannot be resolved to an assigned trade person", () => {
    expect(selectTradePublishedActivities(activities, null)).toEqual([]);
    expect(selectTradePublishedActivities(activities, "person-other")).toEqual([]);
  });
});
