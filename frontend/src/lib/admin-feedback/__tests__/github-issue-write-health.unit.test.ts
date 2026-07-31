import { probeFeedbackIssueWritePermission } from "../github";

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn();
global.fetch = mockFetch;

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ORIGINAL_ENV = process.env;

describe("probeFeedbackIssueWritePermission", () => {
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

  it("reports not_configured without hitting GitHub when token is missing", async () => {
    process.env.GITHUB_FEEDBACK_TOKEN = "";
    const result = await probeFeedbackIssueWritePermission();
    expect(result).toEqual({ ok: false, code: "not_configured", status: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("treats 422 (write allowed, body rejected) as healthy and creates no issue", async () => {
    mockFetch.mockResolvedValueOnce(response(422, { message: "Validation Failed" }));
    const result = await probeFeedbackIssueWritePermission();
    expect(result).toEqual({ ok: true });
    // Exactly one probe call; no follow-up close call.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({ title: "" });
  });

  it("classifies 403 as insufficient_permissions (the token that broke the pipeline)", async () => {
    mockFetch.mockResolvedValueOnce(
      response(403, { message: "Resource not accessible by personal access token" }),
    );
    const result = await probeFeedbackIssueWritePermission();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("insufficient_permissions");
      expect(result.status).toBe(403);
    }
  });

  it("classifies 401 as invalid_credentials (expired token)", async () => {
    mockFetch.mockResolvedValueOnce(response(401, { message: "Bad credentials" }));
    const result = await probeFeedbackIssueWritePermission();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_credentials");
  });

  it("classifies 404 as repo_not_found", async () => {
    mockFetch.mockResolvedValueOnce(response(404, { message: "Not Found" }));
    const result = await probeFeedbackIssueWritePermission();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("repo_not_found");
  });

  it("closes an issue if GitHub ever unexpectedly creates one on 2xx", async () => {
    mockFetch
      .mockResolvedValueOnce(response(201, { number: 999 }))
      .mockResolvedValueOnce(response(200, {}));
    const result = await probeFeedbackIssueWritePermission();
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain("/issues/999");
    expect(mockFetch.mock.calls[1][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(mockFetch.mock.calls[1][1]?.body))).toEqual({ state: "closed" });
  });
});
