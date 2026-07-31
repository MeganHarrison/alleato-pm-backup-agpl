import { NextRequest } from "next/server";

import { GET } from "../route";
import { getIsAdmin } from "@/lib/auth/current-user";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";

jest.mock("@/lib/auth/current-user", () => ({
  getIsAdmin: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
  createRagServiceClient: jest.fn(),
}));

const getIsAdminMock = getIsAdmin as jest.Mock;
const getUserMock = getApiRouteUser as jest.Mock;
const createServiceClientMock = createServiceClient as jest.Mock;
const createRagServiceClientMock = createRagServiceClient as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
});

function makeRequest() {
  return new NextRequest("http://localhost/api/assignment-inbox/rules");
}

describe("assignment-inbox rules GET route", () => {
  it("requires auth", async () => {
    getUserMock.mockResolvedValue(null);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(401);
  });

  it("returns rules for signed-in non-admin users without admin-only candidate counts", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    getIsAdminMock.mockResolvedValue(false);

    const limit = jest.fn().mockResolvedValue({
      data: [
        {
          id: "rule-1",
          project_id: 42,
          rule_type: "domain",
          pattern: "vendor.com",
          confidence: 0.92,
          priority: 35,
          source: "manual_admin",
          notes: "Shared vendor domain",
          status: "active",
          updated_at: "2026-07-03T12:00:00Z",
          projects: [{ name: "Danville Theatre" }],
        },
      ],
      error: null,
    });
    const order3 = jest.fn().mockReturnValue({ limit });
    const order2 = jest.fn().mockReturnValue({ order: order3 });
    const order1 = jest.fn().mockReturnValue({ order: order2 });

    createServiceClientMock.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: order1,
        })),
      })),
    });

    const response = await GET(makeRequest(), {
      params: Promise.resolve({}),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.isAdmin).toBe(false);
    expect(json.counts.pendingCandidates).toBeNull();
    expect(json.rules).toEqual([
      expect.objectContaining({
        id: "rule-1",
        projectId: 42,
        projectName: "Danville Theatre",
        ruleType: "domain",
      }),
    ]);
    expect(createRagServiceClientMock).not.toHaveBeenCalled();
  });

  it("includes pending candidate counts for admins", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    getIsAdminMock.mockResolvedValue(true);

    const limit = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const order3 = jest.fn().mockReturnValue({ limit });
    const order2 = jest.fn().mockReturnValue({ order: order3 });
    const order1 = jest.fn().mockReturnValue({ order: order2 });

    createServiceClientMock.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: order1,
        })),
      })),
    });

    const eq = jest.fn().mockResolvedValue({ count: 7, error: null });
    createRagServiceClientMock.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq,
        })),
      })),
    });

    const response = await GET(makeRequest(), {
      params: Promise.resolve({}),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.isAdmin).toBe(true);
    expect(json.counts.pendingCandidates).toBe(7);
  });
});
