import {
  containsTranscriptSection,
  loadMeetingTranscriptContent,
} from "../transcript-content";

describe("meeting transcript content", () => {
  it("loads the canonical storage transcript before summary metadata", async () => {
    const fetchImpl = jest.fn(async () =>
      new Response("# Review\n\n## Transcript\n\nFull conversation", { status: 200 }),
    );

    const result = await loadMeetingTranscriptContent(
      {
        id: "meeting-1",
        url: "https://example.supabase.co/storage/v1/object/public/meetings/review.md",
        content: "Short summary only",
      },
      fetchImpl,
    );

    expect(result.source).toBe("storage");
    expect(result.completeTranscript).toBe(true);
    expect(result.content).toContain("Full conversation");
  });

  it("marks summary-only fallback as incomplete instead of calling it a transcript", async () => {
    const result = await loadMeetingTranscriptContent(
      { id: "meeting-2", content: "A generated meeting summary." },
      jest.fn(),
    );

    expect(result.source).toBe("metadata_content");
    expect(result.completeTranscript).toBe(false);
    expect(containsTranscriptSection(result.content ?? "")).toBe(false);
  });

  it("returns a diagnosable error when storage and metadata are unavailable", async () => {
    const result = await loadMeetingTranscriptContent(
      {
        id: "meeting-3",
        url: "https://example.supabase.co/storage/v1/object/public/meetings/missing.md",
      },
      jest.fn(async () => new Response("missing", { status: 404 })),
    );

    expect(result.completeTranscript).toBe(false);
    expect(result.error).toContain("HTTP 404");
  });
});
