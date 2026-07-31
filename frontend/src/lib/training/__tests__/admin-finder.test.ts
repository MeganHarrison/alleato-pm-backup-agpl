import { runTrainingResourceFinderAdmin } from "../admin-finder";

jest.mock("server-only", () => ({}));

const input = {
  roleSlug: "project-manager",
  topicSlug: "change-management",
};

function response(overrides: Record<string, unknown> = {}) {
  return {
    status: "completed",
    query: "construction training",
    roleSlug: input.roleSlug,
    topicSlug: input.topicSlug,
    dryRun: false,
    searchedCount: 2,
    acceptedCount: 1,
    insertedCount: 1,
    duplicateCount: 0,
    rejectedCount: 1,
    failedCount: 0,
    outcomes: [],
    ...overrides,
  };
}

describe("runTrainingResourceFinderAdmin", () => {
  it("calls the protected canonical endpoint with review writes enabled", async () => {
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(response()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await runTrainingResourceFinderAdmin(input, {
      backendUrl: "https://backend.example.com/",
      adminApiKey: "admin-key",
      requestId: "request-1",
      fetcher,
    });

    expect(result.insertedCount).toBe(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://backend.example.com/api/admin/training/resources/find",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Admin-Api-Key": "admin-key",
          "X-Request-Id": "request-1",
        }),
        body: JSON.stringify({
          roleSlug: input.roleSlug,
          topicSlug: input.topicSlug,
          maxSearchResults: 8,
          maxInserts: 3,
          dryRun: false,
        }),
      }),
    );
  });

  it("preserves the backend's named failure and request id", async () => {
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: "TRAINING_RESOURCE_SEARCH_FAILED: provider unavailable",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      runTrainingResourceFinderAdmin(input, {
        backendUrl: "https://backend.example.com",
        adminApiKey: "admin-key",
        requestId: "request-2",
        fetcher,
      }),
    ).rejects.toThrow(
      "TRAINING_RESOURCE_SEARCH_FAILED: provider unavailable (request request-2)",
    );
  });

  it("rejects an invalid or read-only success contract", async () => {
    const invalidFetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "completed" }), { status: 200 }),
      );
    await expect(
      runTrainingResourceFinderAdmin(input, {
        backendUrl: "https://backend.example.com",
        adminApiKey: "admin-key",
        requestId: "request-invalid",
        fetcher: invalidFetcher,
      }),
    ).rejects.toThrow("invalid response contract");

    const dryRunFetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(response({ dryRun: true })), {
          status: 200,
        }),
      );
    await expect(
      runTrainingResourceFinderAdmin(input, {
        backendUrl: "https://backend.example.com",
        adminApiKey: "admin-key",
        requestId: "request-dry-run",
        fetcher: dryRunFetcher,
      }),
    ).rejects.toThrow("unexpectedly ran in read-only mode");
  });

  it("fails before fetch when required server configuration is missing", async () => {
    const fetcher = jest.fn<typeof fetch>();

    await expect(
      runTrainingResourceFinderAdmin(input, {
        backendUrl: "",
        adminApiKey: "admin-key",
        requestId: "request-missing-url",
        fetcher,
      }),
    ).rejects.toThrow(
      "BACKEND_URL or PYTHON_BACKEND_URL is missing or invalid",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
