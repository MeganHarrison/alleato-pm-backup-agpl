import { displayAdminFeedbackTitle, isCommentRedundantWithTitle } from "../title";

describe("isCommentRedundantWithTitle", () => {
  it("is redundant when the title is a truncated copy of the comment (no explicit title submitted)", () => {
    const comment =
      "make the issues in the left column more compact. its just showing the title duplicated. remove one.";
    const title = displayAdminFeedbackTitle({
      storedTitle: "",
      requestType: "bug",
      comment,
      targetText: null,
      pageTitle: null,
    });

    expect(isCommentRedundantWithTitle(title, comment)).toBe(true);
  });

  it("is not redundant when an explicit title differs from the comment", () => {
    expect(
      isCommentRedundantWithTitle("Compact list items", "the sidebar list rows are too tall"),
    ).toBe(false);
  });

  it("treats an empty comment as redundant (nothing extra to show)", () => {
    expect(isCommentRedundantWithTitle("Some title", "")).toBe(true);
    expect(isCommentRedundantWithTitle("Some title", null)).toBe(true);
  });
});
