import { NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { PATCH } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const createServiceClientMock = createServiceClient as jest.Mock;

describe("invoicing settings route", () => {
  const rpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ denied: false } as never);
    createServiceClientMock.mockReturnValue({ rpc });
  });

  it("maps an automatic-period range conflict to an actionable 409", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          "Automatic billing schedule conflicts with an existing period for project 876 (2026-07-01 through 2026-07-31).",
      },
    });
    const request = new NextRequest(
      "http://localhost/api/projects/876/invoicing/settings",
      {
        method: "PATCH",
        body: JSON.stringify({
          automatic_billing_frequency: "monthly",
          automatic_anchor_start_date: "2026-07-01",
          automatic_anchor_end_date: "2026-07-31",
          automatic_anchor_due_date: "2026-08-05",
        }),
      },
    );

    const response = await PATCH(request, { params: { projectId: "876" } });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Automatic billing schedule conflicts with an existing period for project 876 (2026-07-01 through 2026-07-31).",
    });
  });
});
