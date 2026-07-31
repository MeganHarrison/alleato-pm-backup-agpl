import {
  detectTaskSourceReviewRequest,
  extractTaskTitleFromReviewRequest,
} from "../task-source-review";

describe("task source review routing", () => {
  const userPrompt =
    'theres a task that was created from the union collective interior design vision meeting today named "Prepare vision board and aesthetic concept presentation for Bourbon Trail theme to align project vision". Can you review this meeting and let me know if this was actually a task for the internal team or if this was something that the client needs to do';

  it("extracts a quoted generated task title from natural-language meeting review prompts", () => {
    expect(extractTaskTitleFromReviewRequest(userPrompt)).toBe(
      "Prepare vision board and aesthetic concept presentation for Bourbon Trail theme to align project vision",
    );
  });

  it("routes mixed task + source meeting + ownership questions to source review", () => {
    const result = detectTaskSourceReviewRequest(userPrompt);

    expect(result).toEqual({
      taskTitle: "Prepare vision board and aesthetic concept presentation for Bourbon Trail theme to align project vision",
      dateScope: "today",
    });
  });

  it("does not hijack generic generated-tasks-today list questions", () => {
    expect(detectTaskSourceReviewRequest("what tasks were generated today?")).toBeNull();
  });

  it("does not hijack direct task creation commands that mention an owner", () => {
    expect(
      detectTaskSourceReviewRequest(
        "Add a task for me to call the Ulta owner about the AC1 approval by Friday.",
      ),
    ).toBeNull();
  });

  it("does not hijack ordinary meeting summary questions", () => {
    expect(detectTaskSourceReviewRequest("review the Union Collective meeting from today")).toBeNull();
  });
});
