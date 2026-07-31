import { BOARD_STATUSES, BOARD_STATUS_LABELS } from "../constants";

describe("product board status contract", () => {
  it("keeps Leadership review in the canonical board workflow", () => {
    expect(BOARD_STATUSES).toEqual([
      "submitted",
      "planned",
      "in_progress",
      "leadership_review",
      "shipped",
    ]);
    expect(BOARD_STATUS_LABELS.leadership_review).toBe("Leadership review");
  });
});
