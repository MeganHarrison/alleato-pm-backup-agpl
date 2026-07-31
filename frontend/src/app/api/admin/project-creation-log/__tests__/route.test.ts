process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { requireAppAdmin } from "@/lib/auth/require-app-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { GET } from "../route";

jest.mock("@/lib/auth/require-app-admin", () => ({
  requireAppAdmin: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const requireAppAdminMock = requireAppAdmin as jest.Mock;
const createServiceClientMock = createServiceClient as jest.Mock;
const fromMock = jest.fn();

function makeChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "order", "range", "or", "eq", "in"]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = (resolve: (value: typeof result) => unknown) => resolve(result);
  return chain;
}

function callParams() {
  return { params: Promise.resolve({}) };
}

describe("GET /api/admin/project-creation-log", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAppAdminMock.mockResolvedValue(undefined);
    createServiceClientMock.mockReturnValue({ from: fromMock });
  });

  it("returns the scoped creation projection with resolved actor names", async () => {
    const event = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      project_id: 1145,
      project_name: "GW Excel Playground",
      project_number: "title: [{'plain_text': '26-9999'}]\ntype: title",
      created_by: "11111111-1111-4111-8111-111111111111",
      created_via: "web_app",
      creation_request_id: "request-123",
      creation_run_id: null,
      created_at: "2026-07-20T17:25:41.760Z",
      attribution_status: "complete",
      project_exists: true,
    };
    const creationChain = makeChain({ data: [event], error: null, count: 1 });
    const profileChain = makeChain({
      data: [
        {
          id: event.created_by,
          full_name: "Project Creator",
          email: "creator@example.com",
        },
      ],
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "project_creation_audit_log") return creationChain;
      if (table === "user_profiles") return profileChain;
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/project-creation-log?search=GW&created_via=web_app",
      ),
      callParams(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          ...event,
          project_number: null,
          created_by_name: "Project Creator",
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
    });
    expect(requireAppAdminMock).toHaveBeenCalledWith(
      "api.admin.project-creation-log#GET",
    );
    expect(creationChain.eq as jest.Mock).toHaveBeenCalledWith(
      "created_via",
      "web_app",
    );
  });

  it("rejects unknown filters before querying the audit projection", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/project-creation-log?created_via=spoofed",
      ),
      callParams(),
    );

    expect(response.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("keeps the app-admin gate failure shape", async () => {
    const { GuardrailError } = await import("@/lib/guardrails/errors");
    requireAppAdminMock.mockRejectedValueOnce(
      new GuardrailError({
        code: "FORBIDDEN",
        where: "api.admin.project-creation-log#GET",
        message: "Admin access required.",
        status: 403,
      }),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/admin/project-creation-log"),
      callParams(),
    );

    expect(response.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
