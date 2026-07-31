import { NextRequest } from "next/server";

import { assertPlaneStickyProjectAccess } from "@/features/plane-stickies/plane-stickies-permissions";
import { createPlaneStickiesRepository } from "@/features/plane-stickies/plane-stickies-repository";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DELETE, GET, PATCH, POST } from "../route";

jest.mock("@/features/plane-stickies/plane-stickies-permissions", () => ({
  assertPlaneStickyProjectAccess: jest.fn(),
}));
jest.mock("@/features/plane-stickies/plane-stickies-repository", () => ({
  createPlaneStickiesRepository: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const STICKY_ID = "22222222-2222-4222-8222-222222222222";

const sticky = {
  id: STICKY_ID,
  owner_id: USER_ID,
  workspace_key: "alleato",
  scope: "project" as const,
  project_id: 31,
  content: "Coordinate the next release",
  background_color: "gray" as const,
  sort_order: 20,
  is_pinned: false,
  archived_at: null,
  created_at: "2026-07-31T12:00:00.000Z",
  updated_at: "2026-07-31T13:00:00.000Z",
};

const userRepository = {
  list: jest.fn(),
  create: jest.fn(),
  findOwnedById: jest.fn(),
  updateOwned: jest.fn(),
  deleteOwned: jest.fn(),
};
const serviceRepository = {
  list: jest.fn(),
  create: jest.fn(),
  findOwnedById: jest.fn(),
  updateOwned: jest.fn(),
  deleteOwned: jest.fn(),
};

const getUserMock = jest.mocked(getApiRouteUser);
const createClientMock = jest.mocked(createClient);
const createServiceClientMock = jest.mocked(createServiceClient);
const createRepositoryMock = jest.mocked(createPlaneStickiesRepository);
const assertProjectAccessMock = jest.mocked(assertPlaneStickyProjectAccess);

describe("/api/plane-stickies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserMock.mockResolvedValue({
      id: USER_ID,
      email: "member@example.com",
    });
    createClientMock.mockResolvedValue({ scope: "user" } as never);
    createServiceClientMock.mockReturnValue({ scope: "service" } as never);
    createRepositoryMock.mockImplementation((client) =>
      (client as { scope?: string })?.scope === "service"
        ? serviceRepository
        : userRepository,
    );
    assertProjectAccessMock.mockResolvedValue();
    userRepository.list.mockResolvedValue({ data: [sticky], error: null });
    userRepository.create.mockResolvedValue({ data: sticky, error: null });
    userRepository.updateOwned.mockResolvedValue({
      data: { ...sticky, is_pinned: true },
      error: null,
    });
    userRepository.deleteOwned.mockResolvedValue({ data: null, error: null });
    serviceRepository.findOwnedById.mockResolvedValue({
      data: sticky,
      error: null,
    });
  });

  it("rejects unauthenticated requests with a specific sign-in error", async () => {
    getUserMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/plane-stickies?workspace_key=alleato&scope=workspace",
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "AUTH_EXPIRED",
      error_message: "Sign in to manage your stickies.",
    });
  });

  it("authorizes and lists only the current user's project stickies", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/plane-stickies?workspace_key=alleato&scope=project&project_id=31",
      ),
    );

    expect(response.status).toBe(200);
    expect(assertProjectAccessMock).toHaveBeenCalledWith(
      31,
      "read",
      "/api/plane-stickies#GET",
    );
    expect(userRepository.list).toHaveBeenCalledWith({
      ownerId: USER_ID,
      workspaceKey: "alleato",
      scope: "project",
      projectId: 31,
      archived: false,
      limit: 100,
    });
  });

  it("rejects invalid scope and project combinations", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/plane-stickies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_key: "alleato",
          scope: "project",
          project_id: null,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it("creates project stickies with server-owned identity after write access", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/plane-stickies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_key: "alleato",
          scope: "project",
          project_id: 31,
          content: "Coordinate the next release",
          background_color: "gray",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(assertProjectAccessMock).toHaveBeenCalledWith(
      31,
      "write",
      "/api/plane-stickies#POST",
    );
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: USER_ID, project_id: 31 }),
    );
  });

  it("returns a loud 503 without exposing raw database details", async () => {
    userRepository.list.mockResolvedValue({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "plane_stickies" does not exist',
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/plane-stickies?workspace_key=alleato&scope=workspace",
      ),
    );

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload).toMatchObject({
      error_code: "INTERNAL_ERROR",
      error_message:
        "Stickies are unavailable until the Plane Stickies database migration is applied.",
      details: {
        migration: "20260731231400_create_plane_stickies.sql",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("42P01");
    expect(JSON.stringify(payload)).not.toContain("relation");
  });

  it("checks ownership and project write access before updating", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/plane-stickies", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: STICKY_ID, is_pinned: true }),
      }),
    );

    expect(response.status).toBe(200);
    expect(serviceRepository.findOwnedById).toHaveBeenCalledWith(
      STICKY_ID,
      USER_ID,
    );
    expect(assertProjectAccessMock).toHaveBeenCalledWith(
      31,
      "write",
      "/api/plane-stickies#PATCH",
    );
    expect(userRepository.updateOwned).toHaveBeenCalledWith(
      STICKY_ID,
      USER_ID,
      { is_pinned: true },
    );
  });

  it("does not reveal or delete another user's sticky", async () => {
    serviceRepository.findOwnedById.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/plane-stickies", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: STICKY_ID }),
      }),
    );

    expect(response.status).toBe(404);
    expect(userRepository.deleteOwned).not.toHaveBeenCalled();
  });
});
