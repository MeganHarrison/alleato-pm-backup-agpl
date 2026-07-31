import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { loadUserPermissions } from "@/lib/permissions";
import { GET, PATCH } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/permissions", () => {
  const shared = jest.requireActual("@/lib/permissions-shared");
  return {
    loadUserPermissions: jest.fn(),
    hasPermission: shared.hasPermission,
    hasGranular: shared.hasGranular,
  };
});

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const loadUserPermissionsMock = loadUserPermissions as jest.MockedFunction<
  typeof loadUserPermissions
>;

function makePermissions(overrides?: {
  isAdmin?: boolean;
  budgetLevels?: Array<"read" | "write" | "admin">;
  granularFlags?: string[];
}) {
  return {
    userId: "user-1",
    personId: "person-1",
    projectId: 876,
    template: {
      id: "template-1",
      name: "Budget QA",
      rules: {
        directory: [],
        budget: overrides?.budgetLevels ?? ["read"],
        contracts: [],
        commitments: [],
        estimates: [],
        documents: [],
        schedule: [],
        submittals: [],
        rfis: [],
        change_orders: [],
        change_events: [],
        emails: [],
      },
      granularFlags: (overrides?.granularFlags ?? []) as Array<
        "create_budget_modifications" | "approve_budget_changes"
      >,
    },
    overrides: {
      directory: "none",
      budget: "none",
      contracts: "none",
      commitments: "none",
      estimates: "none",
      documents: "none",
      schedule: "none",
      submittals: "none",
      rfis: "none",
      change_orders: "none",
      change_events: "none",
      emails: "none",
    },
    granularOverrides: {},
    isAdmin: overrides?.isAdmin ?? false,
  };
}

function createListChain<T>(payload: T) {
  const terminal = Promise.resolve({ data: payload, error: null });
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: terminal.then.bind(terminal),
    catch: terminal.catch.bind(terminal),
    finally: terminal.finally.bind(terminal),
  };
}

function createSingleChain<T>(payload: T) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: payload, error: null }),
  };
}

describe("/api/projects/[projectId]/budget/modifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns row-level editable statuses from the server permission model", async () => {
    loadUserPermissionsMock.mockResolvedValue(
      makePermissions({
        budgetLevels: ["read"],
        granularFlags: ["create_budget_modifications"],
      }) as never,
    );

    createClientMock.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table !== "budget_modifications") {
          throw new Error(`Unexpected table ${table}`);
        }
        return createListChain([
          {
            id: "mod-1",
            number: "BM-0001",
            title: "Budget Transfer",
            reason: "QA transfer",
            status: "draft",
            effective_date: null,
            created_at: "2026-07-03T12:00:00.000Z",
            updated_at: "2026-07-03T12:00:00.000Z",
            created_by: "user-1",
            budget_mod_lines: [],
          },
        ]);
      }),
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/projects/876/budget/modifications"),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      modifications: [
        {
          id: "mod-1",
          editableStatuses: ["draft", "pending"],
          allowedActions: ["submit"],
          canDelete: true,
        },
      ],
      permissions: {
        canManageBudgetChanges: true,
        canApproveBudgetChanges: false,
        isAdmin: false,
      },
    });
  });

  it("rejects approval when the user lacks budget-change approval permission", async () => {
    loadUserPermissionsMock.mockResolvedValue(
      makePermissions({
        budgetLevels: ["read"],
        granularFlags: ["create_budget_modifications"],
      }) as never,
    );

    const currentModChain = createSingleChain({
      id: "mod-2",
      status: "pending",
      project_id: 876,
    });

    createClientMock.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "budget_modifications") return currentModChain;
        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: jest.fn(),
    } as never);

    const response = await PATCH(
      new NextRequest("http://localhost/api/projects/876/budget/modifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modificationId: "11111111-1111-4111-8111-111111111112",
          action: "approve",
        }),
      }),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      required: { granularFlag: "approve_budget_changes" },
    });
  });

  it("lets app admins move an approved budget change back to draft", async () => {
    loadUserPermissionsMock.mockResolvedValue(
      makePermissions({ isAdmin: true }) as never,
    );

    const currentModChain = createSingleChain({
      id: "mod-3",
      status: "approved",
      project_id: 876,
    });
    const updateChain = createSingleChain({
      id: "mod-3",
      number: "BM-0003",
      status: "draft",
      effective_date: null,
    });

    const fromMock = jest.fn((table: string) => {
      if (table === "budget_modifications") {
        return fromMock.mock.calls.filter(([name]) => name === "budget_modifications")
          .length === 1
          ? currentModChain
          : updateChain;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const rpcMock = jest.fn().mockResolvedValue({ error: null });

    createClientMock.mockResolvedValue({
      from: fromMock,
      rpc: rpcMock,
    } as never);

    const response = await PATCH(
      new NextRequest("http://localhost/api/projects/876/budget/modifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modificationId: "11111111-1111-4111-8111-111111111113",
          status: "draft",
        }),
      }),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { status: "draft" },
      message: "Modification returned to draft",
    });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft" }),
    );
    expect(rpcMock).toHaveBeenCalledWith("refresh_budget_rollup", {
      p_project_id: 876,
    });
  });
});
