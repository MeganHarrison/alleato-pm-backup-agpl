import { fetchWithPolicy } from "@/lib/guardrails/dependency";

describe("fetchWithPolicy", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("retries retryable failures and eventually succeeds", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(new Response("bad", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    global.fetch = mockFetch as typeof fetch;

    const response = await fetchWithPolicy(
      "req_test",
      "dependency.test",
      "test-service",
      "https://example.com",
      { method: "GET" },
      { maxRetries: 2, backoffMs: 1, timeoutMs: 5000 },
    );

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

