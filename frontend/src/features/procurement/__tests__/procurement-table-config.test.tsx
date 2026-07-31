import { formatProcurementStatus } from "../procurement-table-config";

describe("procurement table configuration", () => {
  it("uses readable lifecycle labels without visual status badges", () => {
    expect(formatProcurementStatus("approved_to_release")).toBe("Approved To Release");
  });
});
