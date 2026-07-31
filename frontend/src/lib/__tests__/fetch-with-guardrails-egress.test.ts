import { GuardrailError } from "@/lib/guardrails/errors";

const fetchWithPolicy = jest.fn();

jest.mock("@/lib/guardrails/dependency", () => ({
  fetchWithPolicy: (...args: unknown[]) => fetchWithPolicy(...args),
}));

import { fetchWithGuardrails } from "@/lib/fetch-with-guardrails";

describe("fetchWithGuardrails — SSRF egress gate", () => {
  beforeEach(() => {
    fetchWithPolicy.mockReset();
    fetchWithPolicy.mockResolvedValue(new Response("ok", { status: 200 }));
  });

  it("blocks a private-IP host before any network call", async () => {
    await expect(
      fetchWithGuardrails("http://169.254.169.254/latest/meta-data/", {
        requestId: "r1",
        where: "test/ssrf",
      }),
    ).rejects.toBeInstanceOf(GuardrailError);
    expect(fetchWithPolicy).not.toHaveBeenCalled();
  });

  it("redacts a token in the blocked URL details (no secret leak)", async () => {
    expect.assertions(3);
    try {
      await fetchWithGuardrails("http://127.0.0.1/cb?access_token=supersecret", {
        requestId: "r2",
        where: "test/ssrf",
      });
    } catch (error) {
      const guardrail = error as GuardrailError;
      const details = guardrail.details as { url?: string; blocked_host?: string };
      expect(guardrail).toBeInstanceOf(GuardrailError);
      expect(details.url).not.toContain("supersecret");
      expect(details.blocked_host).toBe("127.0.0.1");
    }
  });

  it("allows a public host through to fetchWithPolicy", async () => {
    const res = await fetchWithGuardrails("https://api.openai.com/v1/x", {
      requestId: "r3",
      where: "test/ok",
    });
    expect(res.status).toBe(200);
    expect(fetchWithPolicy).toHaveBeenCalledTimes(1);
  });

  it("honors allowPrivateHosts for an intentional internal call", async () => {
    await fetchWithGuardrails("http://10.0.0.5/internal", {
      requestId: "r4",
      where: "test/internal",
      allowPrivateHosts: true,
    });
    expect(fetchWithPolicy).toHaveBeenCalledTimes(1);
  });
});
