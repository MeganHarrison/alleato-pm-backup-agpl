import { sortNotificationsByPriority } from "../notification-priority";

describe("sortNotificationsByPriority", () => {
  it("moves actor-authored notifications above automated ones", () => {
    const result = sortNotificationsByPriority([
      { id: "1", actorId: null },
      { id: "2", actorId: "user-a" },
      { id: "3", actorId: null },
      { id: "4", actorId: "user-b" },
    ]);

    expect(result.map((n) => n.id)).toEqual(["2", "4", "1", "3"]);
  });

  it("preserves recency order within each priority group", () => {
    const result = sortNotificationsByPriority([
      { id: "newest-automated", actorId: null },
      { id: "newest-comment", actorId: "user-a" },
      { id: "older-comment", actorId: "user-b" },
      { id: "older-automated", actorId: null },
    ]);

    expect(result.map((n) => n.id)).toEqual([
      "newest-comment",
      "older-comment",
      "newest-automated",
      "older-automated",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [{ id: "1", actorId: null }, { id: "2", actorId: "user-a" }];
    const inputCopy = [...input];

    sortNotificationsByPriority(input);

    expect(input).toEqual(inputCopy);
  });
});
