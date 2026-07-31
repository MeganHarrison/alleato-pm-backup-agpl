import { apiErrorResponse } from "@/lib/api-error";

describe("apiErrorResponse", () => {
  it("returns standardized error envelope fields", async () => {
    const response = apiErrorResponse(new Error("boom"));
    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(typeof body.error_code).toBe("string");
    expect(typeof body.error_message).toBe("string");
    expect(typeof body.where_it_failed).toBe("string");
    expect(typeof body.request_id).toBe("string");
    expect(typeof body.timestamp).toBe("string");
  });
});

