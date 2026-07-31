import {
  getMeetingDetailsInputSchema,
  getMeetingsByDateInputSchema,
  searchMeetingsByTopicInputSchema,
} from "../meeting-schemas";

describe("meeting tool schemas", () => {
  it("matches the runtime meeting search contract", () => {
    expect(searchMeetingsByTopicInputSchema.parse({ topic: "OAC" })).toEqual({
      topic: "OAC",
      maxResults: 10,
    });
  });

  it("accepts a canonical meeting ID or title without requiring a transcript", () => {
    expect(
      getMeetingDetailsInputSchema.parse({ meetingId: "meeting-1" }),
    ).toEqual({ meetingId: "meeting-1", includeTranscript: false });
    expect(
      getMeetingDetailsInputSchema.parse({ meetingTitle: "Westfield OAC" }),
    ).toEqual({ meetingTitle: "Westfield OAC", includeTranscript: false });
    expect(() => getMeetingDetailsInputSchema.parse({})).toThrow();
  });

  it("matches the runtime meeting date contract", () => {
    expect(getMeetingsByDateInputSchema.parse({})).toEqual({ maxResults: 25 });
  });
});
