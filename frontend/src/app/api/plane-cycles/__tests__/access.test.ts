import { NextResponse } from "next/server";
import { authorizePlaneCycles } from "../access";
import {
  verifyProjectAccess,
  verifyProjectPermission,
} from "@/lib/supabase/auth-guard";
import { getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  verifyProjectPermission: jest.fn(),
  isAuthError: (result: unknown) => result instanceof NextResponse,
}));

const getUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const verifyAccessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;
const verifyPermissionMock = verifyProjectPermission as jest.MockedFunction<
  typeof verifyProjectPermission
>;

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "member@example.com",
};

describe("Plane cycle project authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests before project lookup", async () => {
    getUserMock.mockResolvedValue(null);

    const result = await authorizePlaneCycles(31, "read");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(verifyAccessMock).not.toHaveBeenCalled();
    expect(verifyPermissionMock).not.toHaveBeenCalled();
  });

  it("uses canonical project membership for reads", async () => {
    getUserMock.mockResolvedValue(USER as never);
    verifyAccessMock.mockResolvedValue({
      membership: {},
      serviceClient: {},
      userProfile: null,
    } as never);

    const result = await authorizePlaneCycles(31, "read");

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(verifyAccessMock).toHaveBeenCalledWith(31, USER);
    expect(verifyPermissionMock).not.toHaveBeenCalled();
  });

  it("uses canonical schedule write permission for mutations", async () => {
    getUserMock.mockResolvedValue(USER as never);
    verifyPermissionMock.mockResolvedValue({
      membership: {},
      serviceClient: {},
      userProfile: null,
    } as never);

    const result = await authorizePlaneCycles(31, "write");

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(verifyPermissionMock).toHaveBeenCalledWith(
      31,
      "schedule",
      "write",
    );
  });

  it("returns canonical permission denials unchanged", async () => {
    getUserMock.mockResolvedValue(USER as never);
    verifyPermissionMock.mockResolvedValue(
      NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      ) as never,
    );

    const result = await authorizePlaneCycles(31, "write");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
