import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import { PUT } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;

function makePutRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/projects/876/prime-contract-change-orders/4797",
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

/**
 * Builds a Supabase stub whose `.update(payload)` captures the payload and
 * returns a chain resolving to `returnedRow`. Only `prime_contract_change_orders`
 * is expected.
 */
function buildSupabaseStub(returnedRow: Record<string, unknown>) {
  const captured: { payload?: Record<string, unknown> } = {};

  const updateChain = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: returnedRow, error: null }),
  };

  const supabase = {
    from: jest.fn((table: string) => {
      if (table !== "prime_contract_change_orders") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        update: jest.fn((payload: Record<string, unknown>) => {
          captured.payload = payload;
          return updateChain;
        }),
      };
    }),
  };

  return { supabase, captured };
}

function invokePut(body: Record<string, unknown>) {
  return PUT(makePutRequest(body), {
    params: Promise.resolve({ projectId: "876", primeCoId: "4797" }),
  });
}

describe("prime contract change order PUT route — approved_at invariant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      denied: false,
    } as Awaited<ReturnType<typeof requirePermission>>);
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user-1",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
  });

  it("clears approved_at when status transitions out of approved back to draft", async () => {
    const { supabase, captured } = buildSupabaseStub({
      id: 4797,
      project_id: 876,
      status: "draft",
      approved_at: null,
    });
    createClientMock.mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await invokePut({ status: "draft" });

    expect(response.status).toBe(200);
    expect(captured.payload).toEqual(
      expect.objectContaining({ status: "draft", approved_at: null }),
    );
  });

  it("clears approved_at for any non-approved status (case-insensitive)", async () => {
    const { supabase, captured } = buildSupabaseStub({
      id: 4797,
      project_id: 876,
      status: "Rejected",
      approved_at: null,
    });
    createClientMock.mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    await invokePut({ status: "Rejected" });

    expect(captured.payload?.approved_at).toBeNull();
  });

  it("does NOT clear approved_at when status is set to approved", async () => {
    const { supabase, captured } = buildSupabaseStub({
      id: 4797,
      project_id: 876,
      status: "approved",
    });
    createClientMock.mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    await invokePut({ status: "approved" });

    // Approval owns approved_at via the dedicated approve route; PUT must not
    // null it out when the target state is approved.
    expect(captured.payload).not.toHaveProperty("approved_at");
  });

  it("does NOT touch approved_at when status is not part of the update", async () => {
    const { supabase, captured } = buildSupabaseStub({
      id: 4797,
      project_id: 876,
      title: "Updated title",
    });
    createClientMock.mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    await invokePut({ title: "Updated title" });

    expect(captured.payload).toEqual({ title: "Updated title" });
    expect(captured.payload).not.toHaveProperty("approved_at");
  });
});
