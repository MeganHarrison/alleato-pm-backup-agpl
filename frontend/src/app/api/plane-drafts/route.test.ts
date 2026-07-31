import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  listPlaneDrafts: vi.fn(),
  getPlaneDraft: vi.fn(),
  insertPlaneDraft: vi.fn(),
  updatePlaneDraft: vi.fn(),
  deletePlaneDraft: vi.fn(),
  verifyProjectAccess: vi.fn(),
}));

vi.mock("@/features/plane-drafts/plane-drafts-repository", () => {
  class PlaneDraftsRepositoryError extends Error {
    constructor(
      readonly kind: "database" | "not_found" | "conflict",
      message: string,
      readonly code?: string,
    ) {
      super(message);
    }
  }
  return { PlaneDraftsRepositoryError, ...repository };
});

vi.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: repository.verifyProjectAccess,
  isAuthError: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails:
    (_where: string, handler: (context: { request: NextRequest }) => Promise<Response>) =>
    (request: NextRequest) =>
      handler({ request }),
  parseJsonBody: async (
    request: NextRequest,
    schema: { parse: (value: unknown) => unknown },
  ) => schema.parse(await request.json()),
  validateResponseContract: (
    schema: { parse: (value: unknown) => unknown },
    value: unknown,
  ) => schema.parse(value),
}));

import { DELETE, GET, PATCH, POST } from "./route";
import { PlaneDraftsRepositoryError } from "@/features/plane-drafts/plane-drafts-repository";

const USER_ID = "64f01345-828c-45ad-936e-1d776a1b3cf4";
const OTHER_USER_ID = "4fece34f-f86b-4a76-9c79-8fa55920308c";
const DRAFT_ID = "916fab35-3ca4-4576-abf5-f030f0276bf6";

const artifact = {
  id: DRAFT_ID,
  user_id: USER_ID,
  project_id: 31,
  artifact_type: "note",
  title: "Owner ceiling decision",
  status: "draft",
  version: 2,
  content: { text: "Confirm pricing." },
  context_snapshot: {},
  session_id: null,
  promoted_to: null,
  promoted_at: null,
  tags: [],
  created_at: "2026-07-31T10:00:00.000Z",
  updated_at: "2026-07-31T11:00:00.000Z",
} as const;

function request(method: string, body?: unknown, query = "") {
  return new NextRequest(`http://localhost/api/plane-drafts${query}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  repository.verifyProjectAccess.mockResolvedValue({
    membership: { authUserId: USER_ID },
  });
  repository.getPlaneDraft.mockResolvedValue(artifact);
});

describe("Plane Drafts API project and user boundaries", () => {
  it("lists only through the authenticated project membership scope", async () => {
    repository.listPlaneDrafts.mockResolvedValue([artifact]);

    const response = await GET(request("GET", undefined, "?project_id=31"), {
      params: Promise.resolve({}),
    });

    expect(repository.verifyProjectAccess).toHaveBeenCalledWith(31);
    expect(repository.listPlaneDrafts).toHaveBeenCalledWith(31, USER_ID);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ artifacts: [artifact] });
  });

  it("returns an access denial before any draft storage call", async () => {
    repository.verifyProjectAccess.mockResolvedValue(
      NextResponse.json(
        { error: "You do not have access to this project" },
        { status: 403 },
      ),
    );

    const response = await DELETE(
      request("DELETE", { project_id: 31, id: DRAFT_ID }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(403);
    expect(repository.deletePlaneDraft).not.toHaveBeenCalled();
  });

  it("creates a draft with the authenticated user rather than a client user", async () => {
    repository.insertPlaneDraft.mockResolvedValue(artifact);

    const response = await POST(
      request("POST", {
        action: "create",
        project_id: 31,
        title: artifact.title,
        text: "Confirm pricing.",
        user_id: OTHER_USER_ID,
      }),
      { params: Promise.resolve({}) },
    );

    expect(repository.insertPlaneDraft).toHaveBeenCalledWith({
      projectId: 31,
      userId: USER_ID,
      title: artifact.title,
      content: { text: "Confirm pricing." },
    });
    expect(response.status).toBe(201);
  });

  it("copies only a draft loaded through the requested project and authenticated user", async () => {
    repository.insertPlaneDraft.mockResolvedValue({
      ...artifact,
      id: "5f748af8-6244-4c1c-a823-395d8e2b9c20",
      title: `${artifact.title} (copy)`,
    });

    await POST(
      request("POST", { action: "copy", project_id: 31, id: DRAFT_ID }),
      { params: Promise.resolve({}) },
    );

    expect(repository.getPlaneDraft).toHaveBeenCalledWith(31, USER_ID, DRAFT_ID);
    expect(repository.insertPlaneDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 31,
        userId: USER_ID,
        title: `${artifact.title} (copy)`,
      }),
    );
  });

  it("updates draft content with the client-observed version", async () => {
    repository.updatePlaneDraft.mockResolvedValue({
      ...artifact,
      title: "Revised title",
      version: 3,
    });

    await PATCH(
      request("PATCH", {
        action: "update",
        project_id: 31,
        id: DRAFT_ID,
        version: 2,
        title: "Revised title",
        text: "Revised decision.",
      }),
      { params: Promise.resolve({}) },
    );

    expect(repository.getPlaneDraft).toHaveBeenCalledWith(31, USER_ID, DRAFT_ID);
    expect(repository.updatePlaneDraft).toHaveBeenCalledWith({
      projectId: 31,
      userId: USER_ID,
      id: DRAFT_ID,
      expectedVersion: 2,
      updates: {
        title: "Revised title",
        content: { text: "Revised decision." },
      },
    });
  });

  it.each([
    ["finalize", "final"],
    ["archive", "archived"],
  ] as const)("%s uses project, user, and version scope", async (action, status) => {
    repository.updatePlaneDraft.mockResolvedValue({
      ...artifact,
      status,
      version: 3,
    });

    await PATCH(
      request("PATCH", {
        action,
        project_id: 31,
        id: DRAFT_ID,
        version: 2,
      }),
      { params: Promise.resolve({}) },
    );

    expect(repository.updatePlaneDraft).toHaveBeenCalledWith({
      projectId: 31,
      userId: USER_ID,
      id: DRAFT_ID,
      expectedVersion: 2,
      updates: { status },
    });
  });

  it("surfaces a compare-and-swap miss as a loud conflict", async () => {
    repository.updatePlaneDraft.mockRejectedValue(
      new PlaneDraftsRepositoryError(
        "conflict",
        "This draft changed after you opened it. Reload the latest version and try again.",
      ),
    );

    await expect(
      PATCH(
        request("PATCH", {
          action: "finalize",
          project_id: 31,
          id: DRAFT_ID,
          version: 2,
        }),
        { params: Promise.resolve({}) },
      ),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      status: 409,
    });
  });

  it("deletes only within authenticated project and user scope", async () => {
    repository.deletePlaneDraft.mockResolvedValue(undefined);

    const response = await DELETE(
      request("DELETE", { project_id: 31, id: DRAFT_ID }),
      { params: Promise.resolve({}) },
    );

    expect(repository.verifyProjectAccess).toHaveBeenCalledWith(31);
    expect(repository.deletePlaneDraft).toHaveBeenCalledWith(31, USER_ID, DRAFT_ID);
    expect(response.status).toBe(204);
  });
});
