import {
  filterAndSortPlaneWorkItems,
  parsePlaneWorkItemsQuery,
  serializePlaneWorkItemsQuery,
  updatePlaneWorkItemsQuery,
  type PlaneWorkItemRecord,
} from "./work-items-query";

const items: PlaneWorkItemRecord[] = [
  {
    id: "one",
    title: "Approve storefront submittal",
    status: "open",
    assignee_person_id: "person-a",
    assignee_name: "Megan",
    priority: "high",
    due_date: "2026-07-30",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-03T00:00:00Z",
  },
  {
    id: "two",
    description: "Confirm concrete delivery",
    status: "completed",
    assignee_email: "field@example.com",
    priority: "urgent",
    due_date: "2026-08-01",
    created_at: "2026-07-02T00:00:00Z",
    updated_at: "2026-07-02T00:00:00Z",
  },
  {
    id: "three",
    title: "Review owner response",
    status: "in progress",
    priority: null,
    due_date: null,
    created_at: "2026-07-03T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  },
];

describe("Plane Work Items URL contract", () => {
  it("parses every supported URL-backed control and drops invalid values", () => {
    expect(
      parsePlaneWorkItemsQuery(
        "?view=board&q=store&status=open,bad,done&assignee=person-a,unassigned&priority=high,nope&due=overdue&sort=priority&direction=desc&peek=one",
      ),
    ).toEqual({
      view: "board",
      search: "store",
      statuses: ["open", "done"],
      assignees: ["person-a", "unassigned"],
      priorities: ["high"],
      due: ["overdue"],
      dueFrom: null,
      dueTo: null,
      sort: "priority",
      direction: "desc",
      peekId: "one",
    });
  });

  it("serializes a canonical URL without default noise", () => {
    const params = serializePlaneWorkItemsQuery(
      parsePlaneWorkItemsQuery(
        "?view=invalid&status=open,open&sort=invalid&direction=invalid&peek=three",
      ),
    );

    expect(params.toString()).toBe("status=open&peek=three");
  });

  it("patches URL state while retaining independent filters", () => {
    expect(
      updatePlaneWorkItemsQuery("?view=board&status=open", {
        search: "owner",
        peekId: "three",
      }).toString(),
    ).toBe("view=board&q=owner&status=open&peek=three");
  });

  it("preserves valid legacy saved-view date ranges in canonical URLs", () => {
    const query = parsePlaneWorkItemsQuery(
      "?status=done&due_from=2026-07-01&due_to=2026-07-31",
    );

    expect(query).toMatchObject({
      statuses: ["done"],
      dueFrom: "2026-07-01",
      dueTo: "2026-07-31",
    });
    expect(serializePlaneWorkItemsQuery(query).toString()).toBe(
      "status=done&due_from=2026-07-01&due_to=2026-07-31",
    );
  });
});

describe("Plane Work Items filtering and sorting contract", () => {
  it("applies search, status, assignee, priority, and due-date filters", () => {
    const query = parsePlaneWorkItemsQuery(
      "?q=storefront&status=open&assignee=person-a&priority=high&due=overdue",
    );

    expect(
      filterAndSortPlaneWorkItems(items, query, { today: "2026-07-31" }).map(
        (item) => item.id,
      ),
    ).toEqual(["one"]);
  });

  it("matches normalized status aliases and explicit unassigned records", () => {
    const done = filterAndSortPlaneWorkItems(
      items,
      parsePlaneWorkItemsQuery("?status=done"),
    );
    const unassigned = filterAndSortPlaneWorkItems(
      items,
      parsePlaneWorkItemsQuery("?assignee=unassigned&due=none"),
    );

    expect(done.map((item) => item.id)).toEqual(["two"]);
    expect(unassigned.map((item) => item.id)).toEqual(["three"]);
  });

  it("sorts priority and dates deterministically without mutating input", () => {
    const originalOrder = items.map((item) => item.id);
    const priority = filterAndSortPlaneWorkItems(
      items,
      parsePlaneWorkItemsQuery("?sort=priority"),
    );
    const updated = filterAndSortPlaneWorkItems(
      items,
      parsePlaneWorkItemsQuery("?sort=updated&direction=desc"),
    );

    expect(priority.map((item) => item.id)).toEqual(["two", "one", "three"]);
    expect(updated.map((item) => item.id)).toEqual(["one", "two", "three"]);
    expect(items.map((item) => item.id)).toEqual(originalOrder);
  });

  it("applies legacy saved-view date ranges to live task rows", () => {
    const range = filterAndSortPlaneWorkItems(
      items,
      parsePlaneWorkItemsQuery("?due_from=2026-07-31&due_to=2026-08-01"),
    );

    expect(range.map((item) => item.id)).toEqual(["two"]);
  });
});
