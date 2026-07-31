import { getMeetingDetailHref } from "../meeting-routes";

describe("meeting route helpers", () => {
  it("keeps meeting detail links inside the current project scope", () => {
    expect(
      getMeetingDetailHref({
        projectId: "876",
        meetingId: "meeting-123",
      }),
    ).toBe("/876/meetings/meeting-123");
  });

  it("keeps global meetings links on the company meetings route", () => {
    expect(getMeetingDetailHref({ meetingId: "meeting-123" })).toBe(
      "/meetings/meeting-123",
    );
  });

  it("fails loudly when a meeting id is missing", () => {
    expect(() => getMeetingDetailHref({ meetingId: " " })).toThrow(
      "Cannot build meeting detail href without a meeting id.",
    );
  });
});
