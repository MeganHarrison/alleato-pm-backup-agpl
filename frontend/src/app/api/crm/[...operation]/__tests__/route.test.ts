import { NextRequest } from "next/server";

import { dispatch } from "../route";

jest.mock("@/lib/crm/server", () => ({
  requireCrmAccess: jest.fn(),
  assertCrmOwnerOrAdmin: jest.fn(),
}));
jest.mock("server-only", () => ({}));

describe("CRM catch-all route dispatch", () => {
  it("rejects trailing path segments instead of accepting ambiguous lead routes", async () => {
    const response = await dispatch(
      new NextRequest("http://localhost/api/crm/leads/id/photo/unexpected", {
        method: "GET",
      }),
      {
        params: Promise.resolve({
          operation: ["leads", "id", "photo", "unexpected"],
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
  });
});
