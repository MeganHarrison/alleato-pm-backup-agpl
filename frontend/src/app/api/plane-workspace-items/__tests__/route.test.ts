import { NextRequest } from "next/server";

import { assertPlaneWorkspaceProjectAccess } from "@/features/plane-workspace-items/plane-workspace-items-permissions";
import { createPlaneWorkspaceItemsRepository } from "@/features/plane-workspace-items/plane-workspace-items-repository";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DELETE, GET, PATCH, POST } from "../route";

jest.mock(
  "@/features/plane-workspace-items/plane-workspace-items-permissions",
  () => ({
    assertPlaneWorkspaceProjectAccess: jest.fn(),
  }),
);
jest.mock(
  "@/features/plane-workspace-items/plane-workspace-items-repository",
  () => ({
    createPlaneWorkspaceItemsRepository: jest.fn(),
  }),
);
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const getApiRouteUserMock = jest.mocked(getApiRouteUser);
const createClientMock = jest.mocked(createClient);
const createServiceClientMock = jest.mocked(createServiceClient);
const createRepositoryMock = jest.mocked(createPlaneWorkspaceItemsRepository);
const assertProjectAccessMock = jest.mocked(assertPlaneWorkspaceProjectAccess);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";

const item = {
  id: ITEM_ID,
  user_id: USER_ID,
  workspace_key: "alleato",
  project_id: 31,
  item_kind: "favorite" as const,
  entity_type: "project",
  entity_identifier: "31",
  name: "All Implementation",
  href: "/31/plane/work-items",
  sort_order: 65535,
  metadata: {},
  last_accessed_at: "2026-07-31T12:00:00.000Z",
  created_at: "2026-07-31T12:00:00.000Z",
  updated_at: "2026-07-31T12:00:00.000Z",
};

const userRepository = {
  list: jest.fn(),
  upsert: jest.fn(),
  findOwnedById: jest.fn(),
  updateOwned: jest.fn(),
  deleteOwned: jest.fn(),
};

const serviceRepository = {
  list: jest.fn(),
  upsert: jest.fn(),
  findOwnedById: jest.fn(),
  updateOwned: jest.fn(),
  deleteOwned: jest.fn(),
};

describe("/api/plane-workspace-items", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
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
    userRepository.list.mockResolvedValue({ data: [item], error: null });
    userRepository.upsert.mockResolvedValue({ data: item, error: null });
    userRepository.updateOwned.mockResolvedValue({
      data: { ...item, name: "Renamed" },
      error: null,
    });
    userRepository.deleteOwned.mockResolvedValue({
      data: null,
      error: null,
    });
    serviceRepository.findOwnedById.mockResolvedValue({
      data: item,
      error: null,
    });
  });

  it("rejects an unauthenticated list with a structured 401", async () => {
    getApiRouteUserMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/plane-workspace-items?workspace_key=alleato",
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error_code: "AUTH_EXPIRED",
      error_message: "Sign in to manage Favorites and Recents.",
    });
  });

  it("rejects a list without a workspace key", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/plane-workspace-items"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "VALIDATION_ERROR",
      error_message: "Invalid Favorites or Recents query.",
    });
    expect(userRepository.list).not.toHaveBeenCalled();
  });

  it("lists only the authenticated user's project-scoped items", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/plane-workspace-items?workspace_key=alleato&project_id=31&item_kind=favorite&limit=20",
      ),
    );

    expect(response.status).toBe(200);
    expect(assertProjectAccessMock).toHaveBeenCalledWith(
      31,
      "project",
      USER_ID,
      "/api/plane-workspace-items#GET",
    );
    expect(userRepository.list).toHaveBeenCalledWith({
      userId: USER_ID,
      workspaceKey: "alleato",
      projectId: 31,
      itemKind: "favorite",
      limit: 20,
    });
  });

  it("requires project scope for Plane project entities", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/plane-workspace-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_key: "alleato",
          project_id: null,
          item_kind: "favorite",
          entity_type: "work_item",
          entity_identifier: "task-1",
          name: "Task",
          href: "/31/plane/work-items?peek=task-1",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "VALIDATION_ERROR",
      error_message: "This workspace item requires a project.",
    });
    expect(userRepository.upsert).not.toHaveBeenCalled();
  });

  it("returns a specific 403 when project access is denied", async () => {
    assertProjectAccessMock.mockRejectedValue(
      new GuardrailError({
        code: "FORBIDDEN",
        where: "/api/plane-workspace-items#POST",
        message:
          "You do not have access to save workspace items for this project.",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/plane-workspace-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_key: "alleato",
          project_id: 31,
          item_kind: "favorite",
          entity_type: "project",
          entity_identifier: "31",
          name: "All Implementation",
          href: "/31/plane/work-items",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "FORBIDDEN",
      error_message:
        "You do not have access to save workspace items for this project.",
    });
  });

  it("upserts an idempotent entity record with server-owned identity", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/plane-workspace-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_key: "alleato",
          project_id: 31,
          item_kind: "favorite",
          entity_type: "project",
          entity_identifier: "31",
          name: "All Implementation",
          href: "/31/plane/work-items",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(userRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        workspace_key: "alleato",
        project_id: 31,
        item_kind: "favorite",
        entity_type: "project",
        entity_identifier: "31",
        sort_order: 65535,
      }),
    );
    await expect(response.json()).resolves.toEqual({ item });
  });

  it("checks ownership and project access before an update", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/plane-workspace-items", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ITEM_ID, name: "Renamed" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(serviceRepository.findOwnedById).toHaveBeenCalledWith(
      ITEM_ID,
      USER_ID,
    );
    expect(assertProjectAccessMock).toHaveBeenCalledWith(
      31,
      "project",
      USER_ID,
      "/api/plane-workspace-items#PATCH",
    );
    expect(userRepository.updateOwned).toHaveBeenCalledWith(ITEM_ID, USER_ID, {
      name: "Renamed",
    });
  });

  it("owns recent-access timestamps on the server", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-31T14:30:00.000Z"));
    try {
      const response = await PATCH(
        new NextRequest("http://localhost/api/plane-workspace-items", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: ITEM_ID, touch: true }),
        }),
      );

      expect(response.status).toBe(200);
      expect(userRepository.updateOwned).toHaveBeenCalledWith(
        ITEM_ID,
        USER_ID,
        { last_accessed_at: "2026-07-31T14:30:00.000Z" },
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not reveal or delete an item owned by another user", async () => {
    serviceRepository.findOwnedById.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/plane-workspace-items", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ITEM_ID }),
      }),
    );

    expect(response.status).toBe(404);
    expect(userRepository.deleteOwned).not.toHaveBeenCalled();
  });

  it("does not serialize raw database details into failures", async () => {
    userRepository.list.mockResolvedValue({
      data: null,
      error: {
        message: 'relation "user_workspace_items" does not exist',
        code: "42P01",
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/plane-workspace-items?workspace_key=alleato",
      ),
    );

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({
      error_code: "INTERNAL_ERROR",
      error_message: "Failed to load Favorites and Recents.",
      details: { operation: "load Favorites and Recents" },
    });
    expect(JSON.stringify(payload)).not.toContain("user_workspace_items");
    expect(JSON.stringify(payload)).not.toContain("42P01");
  });

  it("deletes an owned item only after project access succeeds", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/plane-workspace-items", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ITEM_ID }),
      }),
    );

    expect(response.status).toBe(204);
    expect(assertProjectAccessMock).toHaveBeenCalledWith(
      31,
      "project",
      USER_ID,
      "/api/plane-workspace-items#DELETE",
    );
    expect(userRepository.deleteOwned).toHaveBeenCalledWith(ITEM_ID, USER_ID);
  });
});
