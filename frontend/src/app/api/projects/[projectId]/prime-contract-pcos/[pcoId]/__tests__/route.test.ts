import { NextRequest } from "next/server";

import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { requirePermission } from "@/lib/permissions-guard";
import { PATCH } from "../route";

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: jest.fn((value) => value instanceof Response),
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const verifyProjectAccessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;
const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/projects/876/prime-contract-pcos/pco-1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

type SingleResult = { data: unknown; error: null | { message: string } };

function buildSelectChain(results: SingleResult[]) {
  let cursor = 0;

  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(async () => {
      const result = results[cursor] ?? results[results.length - 1];
      cursor += 1;
      return result;
    }),
  };
}

describe("prime contract PCO PATCH route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "admin-user-1",
      personId: "person-1",
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("allows an admin-permitted user to update status on an active PCO", async () => {
    const updateChain = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: "pco-1",
          project_id: 876,
          prime_contract_id: "contract-1",
          status: "pending",
          title: "Lobby credit",
        },
        error: null,
      }),
    };
    const selectChain = buildSelectChain([
      {
        data: {
          id: "pco-1",
          project_id: 876,
          prime_contract_id: "contract-1",
          status: "draft",
          title: "Lobby credit",
        },
        error: null,
      },
    ]);

    const serviceClient = {
      from: jest.fn((table: string) => {
        if (table !== "prime_contract_pcos") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          ...selectChain,
          update: jest.fn((payload: Record<string, unknown>) => {
            expect(payload).toEqual(
              expect.objectContaining({
                status: "pending",
                updated_by: "admin-user-1",
              }),
            );
            return updateChain;
          }),
        };
      }),
    };

    verifyProjectAccessMock.mockResolvedValue({
      membership: {
        membershipId: "membership-1",
        personId: "person-1",
        authUserId: "admin-user-1",
        projectId: 876,
        permissionTemplateId: null,
        userType: "admin",
      },
      serviceClient,
      userProfile: { is_admin: true },
    } as unknown as Awaited<ReturnType<typeof verifyProjectAccess>>);

    const response = await PATCH(makePatchRequest({ status: "pending" }), {
      params: Promise.resolve({ projectId: "876", pcoId: "pco-1" }),
    });

    expect(response.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(876, "change_orders", "write");
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        id: "pco-1",
        status: "pending",
      }),
    );
  });

  it("keeps void PCOs immutable even for admins", async () => {
    const selectChain = buildSelectChain([
      {
        data: {
          id: "pco-1",
          project_id: 876,
          prime_contract_id: "contract-1",
          status: "void",
          title: "Lobby credit",
        },
        error: null,
      },
    ]);

    const serviceClient = {
      from: jest.fn((table: string) => {
        if (table !== "prime_contract_pcos") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          ...selectChain,
          update: jest.fn(() => {
            throw new Error("Update should not be attempted for void PCOs");
          }),
        };
      }),
    };

    verifyProjectAccessMock.mockResolvedValue({
      membership: {
        membershipId: "membership-1",
        personId: "person-1",
        authUserId: "admin-user-1",
        projectId: 876,
        permissionTemplateId: null,
        userType: "admin",
      },
      serviceClient,
      userProfile: { is_admin: true },
    } as unknown as Awaited<ReturnType<typeof verifyProjectAccess>>);

    const response = await PATCH(makePatchRequest({ status: "draft" }), {
      params: Promise.resolve({ projectId: "876", pcoId: "pco-1" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: "Cannot update PCO",
        details: "Void PCOs cannot be updated",
      }),
    );
  });
});
