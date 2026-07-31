import { removeRfiFromListResponse } from "./rfis-table";

describe("removeRfiFromListResponse", () => {
  const response = {
    data: [
      { id: "rfi-1", status: "open" },
      { id: "rfi-2", status: "closed" },
    ],
    meta: {
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
      tab_counts: { all: 3, open: 2, closed: 1 },
    },
  };

  it("removes the deleted row and updates totals immediately", () => {
    const next = removeRfiFromListResponse(response, { id: "rfi-1", status: "open" }, 2);

    expect(next.data).toEqual([{ id: "rfi-2", status: "closed" }]);
    expect(next.meta).toMatchObject({
      total: 2,
      totalPages: 1,
      tab_counts: { all: 2, open: 1, closed: 1 },
    });
  });
});
