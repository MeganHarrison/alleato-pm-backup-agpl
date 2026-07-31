import { NextResponse } from "next/server";

import {
  verifyProjectAccess,
  verifyProjectPermission,
} from "@/lib/supabase/auth-guard";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { getIsAdmin } from "@/lib/auth/current-user";
import { resolvePersonId } from "@/lib/auth/identity";
import { resolveProjectAccessForPerson } from "@/lib/auth/project-access";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn() },
}));
jest.mock("@/lib/auth/current-user", () => ({
  getIsAdmin: jest.fn(),
}));
jest.mock("@/lib/auth/identity", () => ({
  resolvePersonId: jest.fn(),
}));
jest.mock("@/lib/auth/project-access", () => ({
  resolveProjectAccessForPerson: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;
const getIsAdminMock = getIsAdmin as jest.MockedFunction<typeof getIsAdmin>;
const resolvePersonIdMock = resolvePersonId as jest.MockedFunction<
  typeof resolvePersonId
>;
const resolveProjectAccessMock =
  resolveProjectAccessForPerson as jest.MockedFunction<
    typeof resolveProjectAccessForPerson
  >;
const fromMock = serviceDb.from as jest.Mock;

function createQuery(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq"]) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(async () => result);
  return query;
}

describe("project authorization guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "auth-kebba",
      email: "kmass@alleatogroup.com",
    });
    createServiceClientMock.mockReturnValue({ from: jest.fn() } as never);
    getIsAdminMock.mockResolvedValue(false);
    resolvePersonIdMock.mockResolvedValue("person-kebba");
    fromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return createQuery({
          data: {
            is_admin: false,
            is_developer: false,
            full_name: "Kebba Mass",
            role: "Project Manager",
            onboarding_completed_at: null,
          },
          error: null,
        });
      }
      if (table === "permission_templates") {
        return createQuery({
          data: {
            rules_json: { commitments: ["read", "write"] },
          },
          error: null,
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("accepts role-backed access and carries the company template", async () => {
    resolveProjectAccessMock.mockResolvedValue({
      authorized: true,
      accessSource: "project-role",
      membershipId: "role:role-member-1",
      permissionTemplateId: "company-project-manager",
      userType: null,
    });

    const result = await verifyProjectAccess(1144);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) throw new Error("unexpected denial");
    expect(result.membership).toEqual(
      expect.objectContaining({
        membershipId: "role:role-member-1",
        personId: "person-kebba",
        projectId: 1144,
        permissionTemplateId: "company-project-manager",
      }),
    );
  });

  it("authorizes commitment writes from the effective company template", async () => {
    resolveProjectAccessMock.mockResolvedValue({
      authorized: true,
      accessSource: "project-role",
      membershipId: "role:role-member-1",
      permissionTemplateId: "company-project-manager",
      userType: null,
    });

    const result = await verifyProjectPermission(1144, "commitments", "write");

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(fromMock).toHaveBeenCalledWith("permission_templates");
  });

  it("returns a specific server error when access resolution fails", async () => {
    resolveProjectAccessMock.mockResolvedValue({
      authorized: false,
      reason: "project-access-query-failed",
      error: "role lookup failed",
    });

    const result = await verifyProjectAccess(1144);

    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) throw new Error("expected denial");
    expect(result.status).toBe(500);
    await expect(result.json()).resolves.toEqual({
      error: "Project access lookup failed",
      details: "role lookup failed",
    });
  });
});
