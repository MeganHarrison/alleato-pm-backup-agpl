import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const permissionServiceMock = {
  hasPermission: jest.fn(),
};

const inviteServiceMock = {
  resendInvite: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn().mockResolvedValue(null),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

const createClientMock = createClient as jest.Mock;

jest.mock("@/services/permissionService", () => ({
  PermissionService: jest.fn().mockImplementation(() => permissionServiceMock),
}));

jest.mock("@/services/inviteService", () => ({
  InviteService: jest.fn().mockImplementation(() => inviteServiceMock),
}));

describe("Directory reinvite route", () => {
  let supabaseMock: { auth: { getUser: jest.Mock } };

  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
    createClientMock.mockResolvedValue(supabaseMock);
  });

  const params = { params: Promise.resolve({ projectId: "42", personId: "person-1" }) };

  const request = new NextRequest("http://localhost/api/.../reinvite", {
    method: "POST",
  });

  it("returns unauthorized without a user", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(request, params);

    expect(response.status).toBe(401);
    expect(inviteServiceMock.resendInvite).not.toHaveBeenCalled();
  });

  it("returns forbidden when lacking permissions", async () => {
    permissionServiceMock.hasPermission.mockResolvedValue(false);

    const response = await POST(request, params);

    expect(response.status).toBe(403);
    expect(inviteServiceMock.resendInvite).not.toHaveBeenCalled();
  });

  it("propagates invite service errors", async () => {
    permissionServiceMock.hasPermission.mockResolvedValue(true);
    inviteServiceMock.resendInvite.mockResolvedValue({
      success: false,
      error: "No invite exists",
    });

    const response = await POST(request, params);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "No invite exists",
    });
  });

  it("resends invite when permission and service succeed", async () => {
    permissionServiceMock.hasPermission.mockResolvedValue(true);
    inviteServiceMock.resendInvite.mockResolvedValue({
      success: true,
      token: "new-token",
    });

    const response = await POST(request, params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      token: "new-token",
    });
    expect(inviteServiceMock.resendInvite).toHaveBeenCalledWith(
      "42",
      "person-1",
    );
  });
});
