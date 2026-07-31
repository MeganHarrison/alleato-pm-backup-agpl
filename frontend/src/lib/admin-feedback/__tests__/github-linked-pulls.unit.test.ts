import {
  buildFeedbackPullRequestIndex,
  checkGitHubIssueExistence,
  extractClosingIssueNumbers,
  extractReferencedIssueNumbers,
  findLinkedPullRequests,
  referencesIssue,
} from "../github";

const mockFetch = jest.fn<Promise<Response>, [string, RequestInit?]>();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  mockFetch.mockReset();
  process.env = {
    ...ORIGINAL_ENV,
    GITHUB_FEEDBACK_REPO_OWNER: "acme",
    GITHUB_FEEDBACK_REPO_NAME: "widgets",
    GITHUB_FEEDBACK_TOKEN: "test-token",
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("findLinkedPullRequests", () => {
  it("returns null when GitHub is not configured", async () => {
    process.env.GITHUB_FEEDBACK_TOKEN = "";
    const result = await findLinkedPullRequests(123);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns an open PR without a merge lookup", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            number: 42,
            html_url: "https://github.com/acme/widgets/pull/42",
            state: "open",
            title: "fix: something",
            body: "Closes #123",
            pull_request: {},
          },
        ],
      }),
    );

    const result = await findLinkedPullRequests(123);

    expect(result).toEqual([
      { number: 42, url: "https://github.com/acme/widgets/pull/42", state: "open", merged: false },
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fetches merge status for a closed PR", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              number: 42,
              html_url: "https://github.com/acme/widgets/pull/42",
              state: "closed",
              title: "fix #123",
              body: null,
              pull_request: {},
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ merged: true }));

    const result = await findLinkedPullRequests(123);

    expect(result).toEqual([
      { number: 42, url: "https://github.com/acme/widgets/pull/42", state: "closed", merged: true },
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain("/pulls/42");
  });

  it("filters fuzzy search false-positives that don't exactly reference the issue", async () => {
    // GitHub's `"#123"` search can return PRs that only mention #1234 or nothing.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            number: 99,
            html_url: "https://github.com/acme/widgets/pull/99",
            state: "open",
            title: "fix: #1234 unrelated",
            body: "no real reference here",
            pull_request: {},
          },
        ],
      }),
    );

    const result = await findLinkedPullRequests(123);
    expect(result).toEqual([]);
  });

  it("skips search results that are plain issues, not pull requests", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [{ number: 7, html_url: "https://github.com/acme/widgets/issues/7", state: "open", title: "#123" }],
      }),
    );

    const result = await findLinkedPullRequests(123);
    expect(result).toEqual([]);
  });
});

describe("referencesIssue / extractReferencedIssueNumbers", () => {
  it("matches an exact issue reference but not a numeric prefix", () => {
    expect(referencesIssue("Closes #123", 123)).toBe(true);
    expect(referencesIssue("Closes #1234", 123)).toBe(false);
    expect(referencesIssue("see #12 and #123 too", 123)).toBe(true);
    expect(referencesIssue("nothing here", 123)).toBe(false);
  });

  it("extracts every distinct referenced issue number", () => {
    expect(
      extractReferencedIssueNumbers("Closes #551\nCloses #552 and mentions #551 again"),
    ).toEqual(expect.arrayContaining([551, 552]));
    expect(extractReferencedIssueNumbers("Closes #551\nCloses #552").length).toBe(2);
    expect(extractReferencedIssueNumbers("no refs")).toEqual([]);
  });

  it("extractClosingIssueNumbers only counts closing-keyword references, not bare mentions", () => {
    expect(extractClosingIssueNumbers("Closes #551\nFixes #552\nresolved #553")).toEqual(
      expect.arrayContaining([551, 552, 553]),
    );
    // Bare mention (like an autofix infra PR discussing another issue) must NOT link.
    expect(extractClosingIssueNumbers("similar to #570, see also #605")).toEqual([]);
    expect(extractClosingIssueNumbers("fix: some title (#644)")).toEqual([]); // squash suffix, no keyword+space
    expect(extractClosingIssueNumbers("Fix #123 now")).toEqual([123]);
  });
});

describe("buildFeedbackPullRequestIndex", () => {
  it("maps referenced issues to merged/open PRs from list pages", async () => {
    // open PRs page 1 (short → stops), open page ... then closed pages.
    // Each list page returns < 100 items, so listPulls stops after page 1 for
    // both open and closed → exactly two fetches.
    mockFetch
      // open, page 1 (short → stop)
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 645,
            html_url: "https://github.com/acme/widgets/pull/645",
            state: "open",
            title: "feat: tasks filters",
            body: "Closes #582\nCloses #583",
            merged_at: null,
          },
        ]),
      )
      // closed, page 1 (short → stop)
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 626,
            html_url: "https://github.com/acme/widgets/pull/626",
            state: "closed",
            title: "fix: rename add contact (#577)",
            body: "Closes #577",
            merged_at: "2026-07-02T00:00:00Z",
          },
        ]),
      );

    const index = await buildFeedbackPullRequestIndex();
    expect(index).not.toBeNull();
    expect(index!.get(582)?.openPr?.number).toBe(645);
    expect(index!.get(583)?.openPr?.number).toBe(645);
    expect(index!.get(577)?.mergedPr?.number).toBe(626);
    expect(index!.get(999)).toBeUndefined();
  });
});

describe("checkGitHubIssueExistence", () => {
  it("classifies 200 / 410 / 404 / other", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ number: 1 }, 200));
    expect(await checkGitHubIssueExistence(1)).toBe("exists");
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "deleted" }, 410));
    expect(await checkGitHubIssueExistence(2)).toBe("deleted");
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "not found" }, 404));
    expect(await checkGitHubIssueExistence(3)).toBe("deleted");
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "rate limited" }, 403));
    expect(await checkGitHubIssueExistence(4)).toBe("unknown");
  });
});
