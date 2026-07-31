import { NextRequest } from "next/server";

import { GET } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const getUserMock = getApiRouteUser as jest.Mock;
const createClientMock = createClient as jest.Mock;

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/meeting-templates");
}

function callParams() {
  return { params: Promise.resolve({}) };
}

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq", "in", "is", "order", "or", "limit"];
  for (const method of methods) {
    chain[method] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(async () => result);
  chain.single = jest.fn(async () => result);
  chain.then = (resolve: (value: typeof result) => unknown) => resolve(result);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/meeting-templates", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await GET(makeGetRequest(), callParams());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("works for a regular (non-admin) authenticated user and returns id+name ordered by name", async () => {
    getUserMock.mockResolvedValueOnce({
      id: "22222222-2222-4222-8222-222222222222",
      email: "regular-user@example.com",
    });

    const templateRows = [
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Alpha" },
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Beta" },
    ];

    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return makeChain({ data: templateRows, error: null });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    createClientMock.mockResolvedValue({ from });

    const response = await GET(makeGetRequest(), callParams());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.templates).toEqual(templateRows);
  });
});
