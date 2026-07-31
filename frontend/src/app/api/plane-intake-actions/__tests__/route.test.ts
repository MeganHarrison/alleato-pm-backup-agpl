process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { POST } from "../route";
import { requirePermission } from "@/lib/permissions-guard";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createOutlookIntakeServiceClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: {
    from: jest.fn(),
  },
}));

jest.mock("node:crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));

const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const createOutlookClientMock =
  createOutlookIntakeServiceClient as jest.MockedFunction<
    typeof createOutlookIntakeServiceClient
  >;
const serviceFromMock = serviceDb.from as jest.Mock;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

function query(result: QueryResult) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq", "is", "insert", "update", "delete"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = jest.fn((resolve) => Promise.resolve(result).then(resolve));
  return builder;
}

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/plane-intake-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function call(body: Record<string, unknown>) {
  return POST(request(body), { params: Promise.resolve({}) });
}

describe("POST /api/plane-intake-actions", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "user-1",
      personId: "person-1",
    });
  });

  it("returns the canonical permission denial before any persistence", async () => {
    requirePermissionMock.mockResolvedValueOnce({
      denied: true,
      response: Response.json(
        { error: "No project membership found" },
        { status: 403 },
      ),
    } as never);

    const response = await call({
      source: "task",
      sourceId: "1f665092-2708-4bc0-987d-296a698b0114",
      projectId: 31,
      action: "decline",
    });

    expect(response.status).toBe(403);
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it("rejects a past snooze date", async () => {
    const response = await call({
      source: "task",
      sourceId: "1f665092-2708-4bc0-987d-296a698b0114",
      projectId: 31,
      action: "snooze",
      snoozeUntil: "2020-01-01T12:00:00.000Z",
    });

    expect(response.status).toBe(400);
    expect(requirePermissionMock).not.toHaveBeenCalled();
  });

  it("records a task decline without changing task lifecycle status", async () => {
    const actorRead = query({
      data: { is_admin: true, email: "admin@example.com", full_name: "Admin" },
      error: null,
    });
    const sourceRead = query({
      data: {
        id: "1f665092-2708-4bc0-987d-296a698b0114",
        project_id: 31,
        project_ids: [31],
        extraction_metadata: { existing: true },
        source_url: null,
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const sourceUpdate = query({
      data: { id: "1f665092-2708-4bc0-987d-296a698b0114" },
      error: null,
    });
    serviceFromMock
      .mockReturnValueOnce(actorRead)
      .mockReturnValueOnce(sourceRead)
      .mockReturnValueOnce(sourceUpdate);

    const response = await call({
      source: "task",
      sourceId: "1f665092-2708-4bc0-987d-296a698b0114",
      projectId: 31,
      action: "decline",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.state.decision).toBe("declined");
    expect(sourceUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        extraction_metadata: expect.objectContaining({
          existing: true,
          plane_intake: expect.objectContaining({ decision: "declined" }),
        }),
      }),
    );
    expect(sourceUpdate.update.mock.calls[0][0]).not.toHaveProperty("status");
  });

  it("returns the accepted task as the canonical task for task-source acceptance", async () => {
    const actorRead = query({
      data: { is_admin: true, email: "admin@example.com", full_name: "Admin" },
      error: null,
    });
    const sourceRead = query({
      data: {
        id: "1f665092-2708-4bc0-987d-296a698b0114",
        project_id: 31,
        project_ids: [31],
        extraction_metadata: {},
        source_url: null,
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const sourceUpdate = query({
      data: { id: "1f665092-2708-4bc0-987d-296a698b0114" },
      error: null,
    });
    serviceFromMock
      .mockReturnValueOnce(actorRead)
      .mockReturnValueOnce(sourceRead)
      .mockReturnValueOnce(sourceUpdate);

    const response = await call({
      source: "task",
      sourceId: "1f665092-2708-4bc0-987d-296a698b0114",
      projectId: 31,
      action: "accept",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      taskId: "1f665092-2708-4bc0-987d-296a698b0114",
      idempotent: true,
      state: {
        decision: "accepted",
        accepted_task_id: "1f665092-2708-4bc0-987d-296a698b0114",
      },
    });
    expect(sourceUpdate.update.mock.calls[0][0]).not.toHaveProperty("project_id");
    expect(sourceUpdate.update.mock.calls[0][0]).not.toHaveProperty("project_ids");
    expect(sourceUpdate.eq).toHaveBeenCalledWith(
      "updated_at",
      "2026-07-31T11:00:00.000Z",
    );
    expect(sourceUpdate.eq).toHaveBeenCalledWith("project_id", 31);
    expect(sourceUpdate.eq).toHaveBeenCalledWith("project_ids", [31]);
  });

  it("returns the surviving target task for task-source duplicate resolution", async () => {
    const actorRead = query({
      data: { is_admin: true, email: "admin@example.com", full_name: "Admin" },
      error: null,
    });
    const sourceId = "1f665092-2708-4bc0-987d-296a698b0114";
    const targetId = "a42e005f-a01c-4bc4-8c68-2a134a867489";
    const sourceRead = query({
      data: {
        id: sourceId,
        project_id: 31,
        project_ids: [31],
        extraction_metadata: {},
        source_url: null,
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const targetRead = query({
      data: {
        id: targetId,
        project_id: 31,
        project_ids: [31],
        extraction_metadata: {},
        source_url: null,
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const sourceUpdate = query({ data: { id: sourceId }, error: null });
    serviceFromMock
      .mockReturnValueOnce(actorRead)
      .mockReturnValueOnce(sourceRead)
      .mockReturnValueOnce(targetRead)
      .mockReturnValueOnce(sourceUpdate);

    const response = await call({
      source: "task",
      sourceId,
      projectId: 31,
      action: "duplicate",
      duplicateTaskId: targetId,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      taskId: targetId,
      state: {
        decision: "duplicate",
        duplicate_task_id: targetId,
      },
    });
  });

  it("blocks a non-admin from resolving another member's task", async () => {
    const actorRead = query({
      data: { is_admin: false, email: "me@example.com", full_name: "Me" },
      error: null,
    });
    const sourceRead = query({
      data: {
        id: "1f665092-2708-4bc0-987d-296a698b0114",
        project_id: 31,
        project_ids: [31],
        extraction_metadata: {},
        source_url: null,
        assignee_person_id: "person-2",
        assignee_email: "other@example.com",
        assignee_name: "Other",
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    serviceFromMock
      .mockReturnValueOnce(actorRead)
      .mockReturnValueOnce(sourceRead);

    const response = await call({
      source: "task",
      sourceId: "1f665092-2708-4bc0-987d-296a698b0114",
      projectId: 31,
      action: "decline",
    });

    expect(response.status).toBe(403);
    expect(serviceFromMock).toHaveBeenCalledTimes(2);
  });

  it("blocks a non-admin duplicate target assigned to another member", async () => {
    const sourceId = "1f665092-2708-4bc0-987d-296a698b0114";
    const targetId = "a42e005f-a01c-4bc4-8c68-2a134a867489";
    const actorRead = query({
      data: { is_admin: false, email: "me@example.com", full_name: "Me" },
      error: null,
    });
    const sourceRead = query({
      data: {
        id: sourceId,
        project_id: 31,
        project_ids: [31],
        extraction_metadata: {},
        source_url: null,
        assignee_person_id: "person-1",
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const targetRead = query({
      data: {
        id: targetId,
        project_id: 31,
        project_ids: [31],
        extraction_metadata: {},
        source_url: null,
        assignee_person_id: "person-2",
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    serviceFromMock
      .mockReturnValueOnce(actorRead)
      .mockReturnValueOnce(sourceRead)
      .mockReturnValueOnce(targetRead);

    const response = await call({
      source: "task",
      sourceId,
      projectId: 31,
      action: "duplicate",
      duplicateTaskId: targetId,
    });

    expect(response.status).toBe(403);
    expect(serviceFromMock).toHaveBeenCalledTimes(3);
  });

  it("returns 409 when a task changes between read and action update", async () => {
    const actorRead = query({
      data: { is_admin: true, email: "admin@example.com", full_name: "Admin" },
      error: null,
    });
    const sourceRead = query({
      data: {
        id: "1f665092-2708-4bc0-987d-296a698b0114",
        project_id: 31,
        project_ids: [31],
        extraction_metadata: {},
        source_url: null,
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const sourceUpdate = query({ data: null, error: null });
    serviceFromMock
      .mockReturnValueOnce(actorRead)
      .mockReturnValueOnce(sourceRead)
      .mockReturnValueOnce(sourceUpdate);

    const response = await call({
      source: "task",
      sourceId: "1f665092-2708-4bc0-987d-296a698b0114",
      projectId: 31,
      action: "decline",
    });

    expect(response.status).toBe(409);
  });

  it("logs persistence details without exposing raw PostgREST messages", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const actorRead = query({
      data: { is_admin: true, email: "admin@example.com", full_name: "Admin" },
      error: null,
    });
    const sourceRead = query({
      data: null,
      error: { message: "relation secret_table does not exist" },
    });
    serviceFromMock
      .mockReturnValueOnce(actorRead)
      .mockReturnValueOnce(sourceRead);

    const response = await call({
      source: "task",
      sourceId: "1f665092-2708-4bc0-987d-296a698b0114",
      projectId: 31,
      action: "decline",
    });
    const bodyText = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(bodyText).not.toContain("secret_table");
    expect(bodyText).toContain("app.tasks.source.read");
    expect(consoleError.mock.calls.flat().join(" ")).toContain("secret_table");
    consoleError.mockRestore();
  });

  it("creates one real task when an admin accepts an Outlook item", async () => {
    const adminRead = query({ data: { is_admin: true }, error: null });
    const idempotencyRead = query({ data: null, error: null });
    const taskInsert = query({ data: { id: "task-created" }, error: null });
    serviceFromMock
      .mockReturnValueOnce(adminRead)
      .mockReturnValueOnce(idempotencyRead)
      .mockReturnValueOnce(taskInsert);

    const outlookRead = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: "Please review the attached package.",
        body_text: "Please review the attached package.",
        web_link: "https://outlook.example/message",
        match_status: "matched",
        source_metadata: { existing: true },
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const outlookClaim = query({ data: { id: 42 }, error: null });
    const outlookLatest = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: "Please review the attached package.",
        body_text: "Please review the attached package.",
        web_link: "https://outlook.example/message",
        match_status: "matched",
        source_metadata: { existing: true, concurrent: "preserved" },
        updated_at: "2026-07-31T11:00:01.000Z",
      },
      error: null,
    });
    const outlookUpdate = query({ data: { id: 42 }, error: null });
    const outlookFrom = jest
      .fn()
      .mockReturnValueOnce(outlookRead)
      .mockReturnValueOnce(outlookClaim)
      .mockReturnValueOnce(outlookLatest)
      .mockReturnValueOnce(outlookUpdate);
    createOutlookClientMock.mockReturnValue({ from: outlookFrom } as never);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "accept",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      source: "outlook",
      taskId: "task-created",
      idempotent: false,
      state: { decision: "accepted", accepted_task_id: "task-created" },
    });
    expect(taskInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_system: "outlook_intake",
        source_url: "outlook-intake:42",
        project_id: 31,
        project_ids: [31],
      }),
    );
    expect(outlookUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 31,
        match_status: "matched",
        source_metadata: expect.objectContaining({
          existing: true,
          concurrent: "preserved",
          plane_intake: expect.objectContaining({
            accepted_task_id: "task-created",
          }),
        }),
      }),
    );
    expect(outlookClaim.eq).toHaveBeenCalledWith(
      "updated_at",
      "2026-07-31T11:00:00.000Z",
    );
    expect(outlookUpdate.eq).toHaveBeenCalledWith(
      "updated_at",
      "2026-07-31T11:00:01.000Z",
    );
  });

  it("reuses the deterministic Outlook task on acceptance retry", async () => {
    const adminRead = query({ data: { is_admin: true }, error: null });
    const existingTask = query({
      data: {
        id: "task-existing",
        project_id: 31,
        project_ids: [31],
        extraction_metadata: {},
        source_url: "outlook-intake:42",
      },
      error: null,
    });
    serviceFromMock
      .mockReturnValueOnce(adminRead)
      .mockReturnValueOnce(existingTask);

    const outlookRead = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: null,
        body_text: "Review it",
        web_link: null,
        match_status: "matched",
        source_metadata: {},
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const outlookUpdate = query({ data: { id: 42 }, error: null });
    createOutlookClientMock.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(outlookRead)
        .mockReturnValueOnce(outlookUpdate),
    } as never);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "accept",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      taskId: "task-existing",
      idempotent: true,
    });
    expect(serviceFromMock).toHaveBeenCalledTimes(2);
  });

  it("compensates task creation when the Outlook final read fails", async () => {
    const adminRead = query({ data: { is_admin: true }, error: null });
    const idempotencyRead = query({ data: null, error: null });
    const taskInsert = query({ data: { id: "task-created" }, error: null });
    const taskDelete = query({ data: null, error: null });
    serviceFromMock
      .mockReturnValueOnce(adminRead)
      .mockReturnValueOnce(idempotencyRead)
      .mockReturnValueOnce(taskInsert)
      .mockReturnValueOnce(taskDelete);

    const outlookRead = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: "Review it",
        body_text: "Review it",
        web_link: null,
        match_status: "matched",
        source_metadata: {},
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const outlookClaim = query({ data: { id: 42 }, error: null });
    const outlookFinalRead = query({
      data: null,
      error: { message: "Outlook final read unavailable" },
    });
    const outlookCleanupLatest = query({
      data: {
        id: 42,
        source_metadata: {
          plane_intake_accept_claim: {
            claim_id: "11111111-1111-4111-8111-111111111111",
          },
        },
        updated_at: "2026-07-31T11:00:01.000Z",
      },
      error: null,
    });
    const outlookClaimCleanup = query({ data: { id: 42 }, error: null });
    createOutlookClientMock.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(outlookRead)
        .mockReturnValueOnce(outlookClaim)
        .mockReturnValueOnce(outlookFinalRead)
        .mockReturnValueOnce(outlookCleanupLatest)
        .mockReturnValueOnce(outlookClaimCleanup),
    } as never);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "accept",
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).toContain(
      "Failed to refresh the Outlook Intake item before finalization",
    );
    expect(JSON.stringify(body)).toContain("created task removed");
    expect(taskDelete.delete).toHaveBeenCalled();
    expect(outlookClaimCleanup.update).toHaveBeenCalled();
  });

  it("compensates task creation when the Outlook final row disappears", async () => {
    const adminRead = query({ data: { is_admin: true }, error: null });
    const idempotencyRead = query({ data: null, error: null });
    const taskInsert = query({ data: { id: "task-created" }, error: null });
    const taskDelete = query({ data: null, error: null });
    serviceFromMock
      .mockReturnValueOnce(adminRead)
      .mockReturnValueOnce(idempotencyRead)
      .mockReturnValueOnce(taskInsert)
      .mockReturnValueOnce(taskDelete);

    const outlookRead = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: "Review it",
        body_text: "Review it",
        web_link: null,
        match_status: "matched",
        source_metadata: {},
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const outlookClaim = query({ data: { id: 42 }, error: null });
    const outlookFinalRead = query({ data: null, error: null });
    const outlookCleanupLatest = query({
      data: {
        id: 42,
        source_metadata: {
          plane_intake_accept_claim: {
            claim_id: "11111111-1111-4111-8111-111111111111",
          },
        },
        updated_at: "2026-07-31T11:00:01.000Z",
      },
      error: null,
    });
    const outlookClaimCleanup = query({ data: { id: 42 }, error: null });
    createOutlookClientMock.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(outlookRead)
        .mockReturnValueOnce(outlookClaim)
        .mockReturnValueOnce(outlookFinalRead)
        .mockReturnValueOnce(outlookCleanupLatest)
        .mockReturnValueOnce(outlookClaimCleanup),
    } as never);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "accept",
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(JSON.stringify(body)).toContain("created task removed");
    expect(taskDelete.delete).toHaveBeenCalled();
    expect(outlookClaimCleanup.update).toHaveBeenCalled();
  });

  it("removes a newly-created task if the Outlook state update fails", async () => {
    const adminRead = query({ data: { is_admin: true }, error: null });
    const idempotencyRead = query({ data: null, error: null });
    const taskInsert = query({ data: { id: "task-created" }, error: null });
    const taskDelete = query({ data: null, error: null });
    serviceFromMock
      .mockReturnValueOnce(adminRead)
      .mockReturnValueOnce(idempotencyRead)
      .mockReturnValueOnce(taskInsert)
      .mockReturnValueOnce(taskDelete);

    const outlookRead = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: "Review it",
        body_text: "Review it",
        web_link: null,
        match_status: "matched",
        source_metadata: {},
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const outlookClaim = query({ data: { id: 42 }, error: null });
    const outlookLatest = query({
      data: {
        id: 42,
        source_metadata: {
          concurrent: "preserved",
          plane_intake_accept_claim: {
            claim_id: "11111111-1111-4111-8111-111111111111",
          },
        },
        updated_at: "2026-07-31T11:00:01.000Z",
      },
      error: null,
    });
    const outlookUpdate = query({
      data: null,
      error: { message: "Outlook database unavailable" },
    });
    const outlookCleanupLatest = query({
      data: {
        id: 42,
        source_metadata: {
          concurrent: "preserved",
          plane_intake_accept_claim: {
            claim_id: "11111111-1111-4111-8111-111111111111",
          },
        },
        updated_at: "2026-07-31T11:00:02.000Z",
      },
      error: null,
    });
    const outlookClaimCleanup = query({ data: { id: 42 }, error: null });
    createOutlookClientMock.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(outlookRead)
        .mockReturnValueOnce(outlookClaim)
        .mockReturnValueOnce(outlookLatest)
        .mockReturnValueOnce(outlookUpdate)
        .mockReturnValueOnce(outlookCleanupLatest)
        .mockReturnValueOnce(outlookClaimCleanup),
    } as never);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "accept",
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).toContain(
      "Failed to accept the Outlook Intake item",
    );
    expect(taskDelete.delete).toHaveBeenCalled();
    expect(taskDelete.eq).toHaveBeenCalledWith("id", "task-created");
    expect(outlookClaimCleanup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        source_metadata: { concurrent: "preserved" },
        triage_action: undefined,
      }),
    );
    expect(outlookClaimCleanup.eq).toHaveBeenCalledWith(
      "source_metadata->plane_intake_accept_claim->>claim_id",
      expect.any(String),
    );
  });

  it("releases the Outlook acceptance claim when task creation fails", async () => {
    const adminRead = query({ data: { is_admin: true }, error: null });
    const idempotencyRead = query({ data: null, error: null });
    const taskInsert = query({
      data: null,
      error: { message: "Task insert unavailable" },
    });
    serviceFromMock
      .mockReturnValueOnce(adminRead)
      .mockReturnValueOnce(idempotencyRead)
      .mockReturnValueOnce(taskInsert);

    const outlookRead = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: "Review it",
        body_text: "Review it",
        web_link: null,
        match_status: "matched",
        source_metadata: { existing: true },
        triage_action: "watch",
        triage_reason: "Original reason",
        triage_at: "2026-07-30T12:00:00.000Z",
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const outlookClaim = query({ data: { id: 42 }, error: null });
    const outlookCleanupLatest = query({
      data: {
        id: 42,
        source_metadata: {
          existing: true,
          concurrent: "preserved",
          plane_intake_accept_claim: {
            claim_id: "11111111-1111-4111-8111-111111111111",
          },
        },
        updated_at: "2026-07-31T11:00:01.000Z",
      },
      error: null,
    });
    const outlookClaimCleanup = query({ data: { id: 42 }, error: null });
    createOutlookClientMock.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(outlookRead)
        .mockReturnValueOnce(outlookClaim)
        .mockReturnValueOnce(outlookCleanupLatest)
        .mockReturnValueOnce(outlookClaimCleanup),
    } as never);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "accept",
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).toContain(
      "Failed to create a project task from the Outlook Intake item",
    );
    expect(outlookClaimCleanup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        source_metadata: { existing: true, concurrent: "preserved" },
        triage_action: "watch",
        triage_reason: "Original reason",
        triage_at: "2026-07-30T12:00:00.000Z",
      }),
    );
  });

  it("removes a newly-created task when the final Outlook claim is no longer owned", async () => {
    const adminRead = query({ data: { is_admin: true }, error: null });
    const idempotencyRead = query({ data: null, error: null });
    const taskInsert = query({ data: { id: "task-created" }, error: null });
    const taskDelete = query({ data: null, error: null });
    serviceFromMock
      .mockReturnValueOnce(adminRead)
      .mockReturnValueOnce(idempotencyRead)
      .mockReturnValueOnce(taskInsert)
      .mockReturnValueOnce(taskDelete);

    const outlookRead = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: "Review it",
        body_text: "Review it",
        web_link: null,
        match_status: "matched",
        source_metadata: {},
        triage_action: null,
        triage_reason: null,
        triage_at: null,
        updated_at: "2026-07-31T11:00:00.000Z",
      },
      error: null,
    });
    const outlookClaim = query({ data: { id: 42 }, error: null });
    const outlookLatest = query({
      data: {
        id: 42,
        source_metadata: {
          plane_intake_accept_claim: {
            claim_id: "11111111-1111-4111-8111-111111111111",
          },
        },
        updated_at: "2026-07-31T11:00:01.000Z",
      },
      error: null,
    });
    const outlookFinalConflict = query({ data: null, error: null });
    const outlookCleanupLatest = query({
      data: {
        id: 42,
        source_metadata: {
          plane_intake_accept_claim: {
            claim_id: "11111111-1111-4111-8111-111111111111",
          },
        },
        updated_at: "2026-07-31T11:00:02.000Z",
      },
      error: null,
    });
    const outlookClaimCleanup = query({ data: null, error: null });
    createOutlookClientMock.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(outlookRead)
        .mockReturnValueOnce(outlookClaim)
        .mockReturnValueOnce(outlookLatest)
        .mockReturnValueOnce(outlookFinalConflict)
        .mockReturnValueOnce(outlookCleanupLatest)
        .mockReturnValueOnce(outlookClaimCleanup),
    } as never);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "accept",
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(JSON.stringify(body)).toContain("created task removed");
    expect(taskDelete.delete).toHaveBeenCalled();
    expect(taskDelete.eq).toHaveBeenCalledWith("id", "task-created");
    expect(outlookClaimCleanup.eq).toHaveBeenCalledWith(
      "source_metadata->plane_intake_accept_claim->>claim_id",
      expect.any(String),
    );
  });

  it("rejects a concurrent Outlook acceptance while an active claim exists", async () => {
    const adminRead = query({ data: { is_admin: true }, error: null });
    serviceFromMock.mockReturnValueOnce(adminRead);

    const outlookRead = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: "Review it",
        body_text: "Review it",
        web_link: null,
        match_status: "matched",
        source_metadata: {
          plane_intake_accept_claim: {
            claimed_at: new Date().toISOString(),
            claimed_by: "another-user",
          },
        },
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    const outlookFrom = jest.fn().mockReturnValueOnce(outlookRead);
    createOutlookClientMock.mockReturnValue({ from: outlookFrom } as never);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "accept",
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(JSON.stringify(body)).toContain("already being accepted");
    expect(outlookFrom).toHaveBeenCalledTimes(1);
    expect(serviceFromMock).toHaveBeenCalledTimes(1);
  });

  it("blocks decline while another request owns Outlook acceptance", async () => {
    const adminRead = query({ data: { is_admin: true }, error: null });
    serviceFromMock.mockReturnValueOnce(adminRead);
    const outlookRead = query({
      data: {
        id: 42,
        project_id: 31,
        subject: "Review submittal",
        body: "Review it",
        body_text: "Review it",
        web_link: null,
        match_status: "matched",
        source_metadata: {
          plane_intake_accept_claim: {
            claim_id: "claim-owned-by-first-request",
            claimed_at: new Date().toISOString(),
            claimed_by: "another-user",
          },
        },
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    createOutlookClientMock.mockReturnValue({
      from: jest.fn().mockReturnValueOnce(outlookRead),
    } as never);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "decline",
    });

    expect(response.status).toBe(409);
    expect(serviceFromMock).toHaveBeenCalledTimes(1);
  });

  it("requires app-admin access for Outlook actions", async () => {
    const adminRead = query({ data: { is_admin: false }, error: null });
    serviceFromMock.mockReturnValueOnce(adminRead);

    const response = await call({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "decline",
    });

    expect(response.status).toBe(403);
    expect(createOutlookClientMock).not.toHaveBeenCalled();
  });
});
