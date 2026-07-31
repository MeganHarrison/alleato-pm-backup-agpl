import { createGitHubIssue } from "@/lib/admin-feedback/github";
import { mirrorVeltCommentToFeedback } from "@/lib/admin-feedback/velt-feedback";
import { ingestAdminFeedbackLearning } from "@/lib/ai/services/agent-learning-service";
import { serviceDb } from "@/lib/supabase/service-db";

jest.mock("@/lib/admin-feedback/github", () => ({
  createGitHubIssue: jest.fn(),
}));

jest.mock("@/lib/admin-feedback/tool-matcher", () => ({
  getToolById: jest.fn(),
  matchFeedbackToTool: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/admin-feedback/context-resolver", () => ({
  contextToAgentPayload: jest.fn(),
  resolveToolContext: jest.fn(),
}));

jest.mock("@/lib/ai/services/agent-learning-service", () => ({
  ingestAdminFeedbackLearning: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn() },
}));

const createGitHubIssueMock = createGitHubIssue as jest.MockedFunction<
  typeof createGitHubIssue
>;
const ingestAdminFeedbackLearningMock =
  ingestAdminFeedbackLearning as jest.MockedFunction<
    typeof ingestAdminFeedbackLearning
  >;
const fromMock = serviceDb.from as jest.Mock;

function emptyLookupQuery() {
  const query = {
    select: jest.fn(),
    contains: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  query.select.mockReturnValue(query);
  query.contains.mockReturnValue(query);
  return query;
}

function insertQuery() {
  const query = {
    insert: jest.fn(),
    select: jest.fn(),
    single: jest.fn().mockResolvedValue({
      data: { id: "feedback-1", title: "Comment title", status: "open" },
      error: null,
    }),
  };
  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

function updateQuery() {
  const query = {
    update: jest.fn(),
    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  query.update.mockReturnValue(query);
  return query;
}

function mirrorInput(createIssue: boolean) {
  return {
    annotationId: "annotation-1",
    commentId: "comment-1",
    documentId: "/876/budget",
    pageUrl: "https://app.alleato.com/876/budget",
    pageTitle: "Budget",
    commentText: "The committed cost is incorrect.",
    author: {
      userId: "user-1",
      name: "Megan Harrison",
      email: "megan@example.com",
    },
    createIssue,
    source: "velt_comment_annotation" as const,
  };
}

describe("mirrorVeltCommentToFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ingestAdminFeedbackLearningMock.mockResolvedValue(undefined);
  });

  it("persists comment-only annotations without calling GitHub", async () => {
    fromMock
      .mockReturnValueOnce(emptyLookupQuery())
      .mockReturnValueOnce(emptyLookupQuery())
      .mockReturnValueOnce(insertQuery());

    const result = await mirrorVeltCommentToFeedback(mirrorInput(false));

    expect(createGitHubIssueMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      feedbackId: "feedback-1",
      feedbackStatus: "open",
      githubIssueNumber: null,
      githubIssueUrl: null,
    });
    expect(fromMock).toHaveBeenCalledTimes(3);
  });

  it("creates one GitHub issue when the annotation explicitly requests it", async () => {
    createGitHubIssueMock.mockResolvedValue({
      number: 42,
      url: "https://github.com/alleato-ai/alleato-pm/issues/42",
      state: "open",
    });
    const update = updateQuery();
    fromMock
      .mockReturnValueOnce(emptyLookupQuery())
      .mockReturnValueOnce(emptyLookupQuery())
      .mockReturnValueOnce(insertQuery())
      .mockReturnValueOnce(update);

    const result = await mirrorVeltCommentToFeedback(mirrorInput(true));

    expect(createGitHubIssueMock).toHaveBeenCalledTimes(1);
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        github_issue_number: 42,
        status: "submitted",
      }),
    );
    expect(result).toMatchObject({
      feedbackStatus: "submitted",
      githubIssueNumber: 42,
    });
  });

  it("keeps the comment and records a loud failure when GitHub creation fails", async () => {
    createGitHubIssueMock.mockResolvedValue(null);
    const update = updateQuery();
    fromMock
      .mockReturnValueOnce(emptyLookupQuery())
      .mockReturnValueOnce(emptyLookupQuery())
      .mockReturnValueOnce(insertQuery())
      .mockReturnValueOnce(update);

    const result = await mirrorVeltCommentToFeedback(mirrorInput(true));

    expect(update.update).toHaveBeenCalledWith({ status: "github_failed" });
    expect(result).toMatchObject({
      feedbackId: "feedback-1",
      feedbackStatus: "github_failed",
      githubIssueNumber: null,
      githubIssueUrl: null,
    });
  });
});
