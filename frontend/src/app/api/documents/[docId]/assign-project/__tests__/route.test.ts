import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

const createClientMock = createClient as jest.Mock;

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/documents/meeting-1/assign-project", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("documents assign-project PATCH route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  });

  it("writes both project_id and the canonical project name", async () => {
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq: updateEq });
    const projectSingle = jest.fn().mockResolvedValue({
      data: { id: 178, name: "Superior Beverae Exotec " },
      error: null,
    });
    const from = jest.fn((table: string) => {
      if (table === "projects") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: projectSingle,
            }),
          }),
        };
      }
      if (table === "document_metadata") {
        return { update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
    });

    const response = await PATCH(makePatchRequest({ project_id: 178 }), {
      params: Promise.resolve({ docId: "meeting-1" }),
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      project_id: 178,
      project: "Superior Beverae Exotec ",
    });
    expect(updateEq).toHaveBeenCalledWith("id", "meeting-1");
  });

  it("clears both project fields when assignment is removed", async () => {
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    const from = jest.fn((table: string) => {
      if (table === "document_metadata") {
        return { update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
    });

    const response = await PATCH(makePatchRequest({ project_id: null }), {
      params: Promise.resolve({ docId: "meeting-1" }),
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      project_id: null,
      project: null,
    });
  });
});
