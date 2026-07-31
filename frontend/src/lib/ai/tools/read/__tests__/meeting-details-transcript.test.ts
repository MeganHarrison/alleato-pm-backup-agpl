import { buildOptionalMeetingTranscriptDetails } from "@/lib/meetings/transcript-content";

describe("optional meeting transcript details", () => {
  it("preserves ordinary meeting details when transcript retrieval is not requested", () => {
    expect(buildOptionalMeetingTranscriptDetails(false, null)).toEqual({
      meetingFields: {},
      warning: null,
    });
  });

  it("degrades gracefully when an explicitly requested transcript is incomplete", () => {
    expect(
      buildOptionalMeetingTranscriptDetails(true, {
        content: "## Summary\nUseful meeting digest",
        source: "metadata_content",
        sourceUrl: null,
        completeTranscript: false,
        error: null,
      }),
    ).toEqual({
      meetingFields: {
        transcript: null,
        transcriptCoverage: {
          complete: false,
          source: "metadata_content",
          characters: 0,
          error:
            "A complete transcript was not available; meeting details are returned without transcript text.",
        },
      },
      warning:
        "A complete transcript was not available; meeting details are returned without transcript text.",
    });
  });

  it("includes transcript text only when the canonical transcript is complete", () => {
    const content = "## Transcript\nSpeaker: complete text";
    expect(
      buildOptionalMeetingTranscriptDetails(true, {
        content,
        source: "storage",
        sourceUrl: "https://example.test/meeting.md",
        completeTranscript: true,
        error: null,
      }),
    ).toEqual({
      meetingFields: {
        transcript: content,
        transcriptCoverage: {
          complete: true,
          source: "storage",
          characters: content.length,
          error: null,
        },
      },
      warning: null,
    });
  });
});
