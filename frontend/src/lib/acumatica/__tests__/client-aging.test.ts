import { AcumaticaClient } from "@/lib/acumatica/client";

describe("AcumaticaClient AR aging", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("requests only fields declared by the live Invoice contract", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: {
            "Set-Cookie": "ASP.NET_SessionId=test; Path=/; HttpOnly",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
          {
            DueDate: { value: "2026-07-01" },
            Balance: { value: 1250 },
          },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    global.fetch = fetchMock as typeof fetch;

    const client = new AcumaticaClient();
    await client.login();
    const aging = await client.getARAging();

    const invoiceUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(invoiceUrl.pathname).toContain("/Invoice");
    expect(invoiceUrl.searchParams.get("$select")).toBe("DueDate,Balance");
    expect(invoiceUrl.searchParams.get("$select")).not.toContain("CustomerName");
    expect(aging.totalBalance).toBe(1250);
    expect(aging.buckets.reduce((count, bucket) => count + bucket.count, 0)).toBe(
      1,
    );
  });
});
