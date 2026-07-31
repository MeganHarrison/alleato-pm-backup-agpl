import type { AllCommentItem } from "@/app/api/comments/all/route";
import {
  cleanCommentPreview,
  documentLabel,
  filterComments,
  matchesMention,
  relativeTimeLabel,
  sanitizeComments,
  sortComments,
  statusLabel,
} from "../comments-page-utils";

function comment(overrides: Partial<AllCommentItem>): AllCommentItem {
  return {
    documentId: "/25125/submittals",
    annotationId: "comment-1",
    annotationNumber: null,
    authorName: "Megan Harrison",
    preview: "Submittal needs review",
    statusName: null,
    replyCount: 0,
    lastUpdated: Date.UTC(2026, 5, 25, 12, 0, 0),
    messages: [],
    ...overrides,
  };
}

describe("comments page utilities", () => {
  it("turns Velt route ids into readable source labels", () => {
    expect(documentLabel("/25125/submittals/new")).toBe("25125 / submittals / new");
    expect(documentLabel("/")).toBe("Home");
  });

  it("keeps active comments ahead of resolved comments, then sorts by recency", () => {
    const rows = [
      comment({
        annotationId: "resolved-new",
        statusName: "Resolved",
        lastUpdated: Date.UTC(2026, 5, 25, 13, 0, 0),
      }),
      comment({
        annotationId: "active-old",
        statusName: "Open",
        lastUpdated: Date.UTC(2026, 5, 24, 12, 0, 0),
      }),
      comment({
        annotationId: "active-new",
        statusName: null,
        lastUpdated: Date.UTC(2026, 5, 25, 12, 0, 0),
      }),
    ];

    expect([...rows].sort(sortComments).map((row) => row.annotationId)).toEqual([
      "active-new",
      "active-old",
      "resolved-new",
    ]);
  });

  it("filters by unresolved, resolved, all, mine, mentions, and source text search", () => {
    const rows = [
      comment({ annotationId: "open", preview: "KPI cards should link to home" }),
      comment({
        annotationId: "mine",
        authorName: "Megan Harrison",
        preview: "I can take this thread",
      }),
      comment({
        annotationId: "mention",
        authorName: "Brandon C.",
        preview: "@Megan Harrison can you review this row?",
      }),
      comment({
        annotationId: "resolved",
        preview: "Old thread",
        statusName: "Closed",
        documentId: "/67/submittals",
      }),
    ];

    expect(filterComments(rows, "unresolved", "").map((row) => row.annotationId)).toEqual([
      "open",
      "mine",
      "mention",
    ]);
    expect(filterComments(rows, "resolved", "").map((row) => row.annotationId)).toEqual([
      "resolved",
    ]);
    expect(filterComments(rows, "all", "67 / submittals").map((row) => row.annotationId)).toEqual([
      "resolved",
    ]);
    expect(
      filterComments(rows, "mine", "", "Megan Harrison").map(
        (row) => row.annotationId,
      ),
    ).toEqual(["open", "mine", "resolved"]);
    expect(
      filterComments(rows, "mentions", "", "Megan Harrison").map(
        (row) => row.annotationId,
      ),
    ).toEqual(["mention"]);
  });

  it("removes excluded annotation ids from the inbox feed", () => {
    const rows = [
      comment({ annotationId: "8e0a5ed8-750b-49f1-9aa6-bbc01f634074" }),
      comment({ annotationId: "visible-comment" }),
    ];

    expect(sanitizeComments(rows).map((row) => row.annotationId)).toEqual([
      "visible-comment",
    ]);
  });

  it("falls back to actionable status and time labels", () => {
    const now = Date.UTC(2026, 5, 25, 12, 10, 0);

    expect(statusLabel(comment({ statusName: null }))).toBe("Open");
    expect(relativeTimeLabel(Date.UTC(2026, 5, 25, 12, 5, 0), now)).toBe("5m");
    expect(relativeTimeLabel(null, now)).toBe("Unknown");
  });

  it("detects lightweight @mentions from preview text", () => {
    expect(
      matchesMention(comment({ preview: "@Megan please review" }), "Megan Harrison"),
    ).toBe(true);
    expect(
      matchesMention(comment({ preview: "No direct mention here" }), "Megan Harrison"),
    ).toBe(false);
  });

  it("strips Velt placeholder tokens from previews", () => {
    expect(
      cleanCommentPreview(
        "{{1854b4b0-3e8e-4d69-86df-32cdb3c80ee0}} Page should look cleaner",
      ),
    ).toBe("Page should look cleaner");
  });
});
