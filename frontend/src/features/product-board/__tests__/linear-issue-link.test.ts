import { getLinearIssueLink, parseLinearIssueUrl } from "../linear-issue-link";

describe("linear issue links", () => {
  it("parses Linear issue URLs", () => {
    expect(parseLinearIssueUrl("https://linear.app/alleato/issue/aai-773/add-column")).toEqual({
      url: "https://linear.app/alleato/issue/aai-773/add-column",
      label: "AAI-773",
      issueId: "AAI-773",
    });
  });

  it("ignores non-Linear URLs", () => {
    expect(parseLinearIssueUrl("https://example.com/AAI-773")).toBeNull();
  });

  it("prefers explicit Linear metadata", () => {
    expect(
      getLinearIssueLink({
        linear_issue_id: "aai-773",
        linear_issue_url: "https://linear.app/alleato/issue/aai-773/add-column",
      }),
    ).toMatchObject({
      label: "AAI-773",
      issueId: "AAI-773",
    });
  });

  it("falls back to metadata links", () => {
    expect(
      getLinearIssueLink({
        links: [
          { id: "docs", label: "Docs", url: "https://example.com" },
          { id: "linear", label: "Tracker", url: "https://linear.app/alleato/issue/aai-774/fix" },
        ],
      }),
    ).toMatchObject({
      label: "AAI-774",
      issueId: "AAI-774",
    });
  });
});
