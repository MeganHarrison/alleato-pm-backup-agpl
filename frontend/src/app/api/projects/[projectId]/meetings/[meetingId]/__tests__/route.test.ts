import { NextRequest } from "next/server";

import { GET, PATCH, DELETE } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { loadMeetingDetail } from "@/lib/meetings/server";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/meetings/server", () => ({
  loadMeetingDetail: jest.fn(),
}));

const getUserMock = getApiRouteUser as jest.Mock;
const createClientMock = createClient as jest.Mock;
const loadMeetingDetailMock = loadMeetingDetail as jest.Mock;

const MEETING_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function makeGetRequest(projectId: string, meetingId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}`,
  );
}

function makePatchRequest(
  projectId: string,
  meetingId: string,
  body: unknown,
): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeDeleteRequest(projectId: string, meetingId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}`,
    { method: "DELETE" },
  );
}

function callParams(projectId: string, meetingId: string) {
  return { params: Promise.resolve({ projectId, meetingId }) };
}

/**
 * Chainable mock for the pre-write meeting-scope guard:
 * `.from("meetings").select(...).eq("id", ...).eq("project_id", ...).maybeSingle()`
 */
function makeExistingMeetingChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(async () => ({ error: null, ...result }));
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserMock.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
  });
});

describe("GET /api/projects/[projectId]/meetings/[meetingId]", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await GET(
      makeGetRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns a 404-shaped GuardrailError when loadMeetingDetail returns null", async () => {
    createClientMock.mockResolvedValue({ from: jest.fn() });
    loadMeetingDetailMock.mockResolvedValueOnce(null);

    const response = await GET(
      makeGetRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns the meeting detail on success", async () => {
    createClientMock.mockResolvedValue({ from: jest.fn() });
    const detail = {
      meeting: { id: MEETING_ID, status: "draft" },
      attendees: [],
      categories: [],
    };
    loadMeetingDetailMock.mockResolvedValueOnce(detail);

    const response = await GET(
      makeGetRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(detail);
    expect(loadMeetingDetailMock).toHaveBeenCalledWith(
      expect.anything(),
      42,
      MEETING_ID,
    );
  });
});

describe("PATCH /api/projects/[projectId]/meetings/[meetingId]", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, { name: "Updated" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("rejects an empty body", async () => {
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, {}),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("updates only supplied fields, stamps updated_at, and returns fresh detail", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: null },
    });

    const updateEq = jest.fn(() => ({ eq: jest.fn().mockResolvedValueOnce({ error: null }) }));
    const updateFn = jest.fn(() => ({ eq: updateEq }));

    let selectCallCount = 0;
    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        selectCallCount += 1;
        // First call in the route is the pre-write scope guard (select), then update.
        return selectCallCount === 1
          ? { select: existingMeetingChain.select, update: updateFn }
          : { select: existingMeetingChain.select, update: updateFn };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const detail = {
      meeting: { id: MEETING_ID, name: "Updated", status: "draft" },
      attendees: [],
      categories: [],
    };
    loadMeetingDetailMock.mockResolvedValueOnce(detail);

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, { name: "Updated" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated",
        updated_at: expect.any(String),
      }),
    );
    expect(updateEq).toHaveBeenCalledWith("id", MEETING_ID);
    const body = await response.json();
    expect(body).toEqual(detail);
  });

  it("replaces attendees atomically (delete-then-insert) when attendee_person_ids is supplied", async () => {
    const personId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: null },
    });

    const meetingsUpdateInnerEq = jest.fn().mockResolvedValueOnce({ error: null });
    const meetingsUpdateEq = jest.fn(() => ({ eq: meetingsUpdateInnerEq }));
    const meetingsUpdate = jest.fn(() => ({ eq: meetingsUpdateEq }));

    const attendeesDeleteEq = jest.fn().mockResolvedValueOnce({ error: null });
    const attendeesDelete = jest.fn(() => ({ eq: attendeesDeleteEq }));
    const attendeesInsert = jest.fn().mockResolvedValueOnce({ error: null });

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update: meetingsUpdate };
      }
      if (table === "meeting_attendees") {
        return { delete: attendeesDelete, insert: attendeesInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });
    loadMeetingDetailMock.mockResolvedValueOnce({
      meeting: { id: MEETING_ID, status: "draft" },
      attendees: [],
      categories: [],
    });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, { attendee_person_ids: [personId] }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(attendeesDelete).toHaveBeenCalled();
    expect(attendeesDeleteEq).toHaveBeenCalledWith("meeting_id", MEETING_ID);
    expect(attendeesInsert).toHaveBeenCalledWith([
      { meeting_id: MEETING_ID, person_id: personId },
    ]);

    // Delete must happen before insert.
    const deleteOrder = attendeesDelete.mock.invocationCallOrder[0];
    const insertOrder = attendeesInsert.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(insertOrder);
  });

  it("surfaces a clear error when the attendee insert fails after delete", async () => {
    const personId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: null },
    });

    const meetingsUpdateInnerEq = jest.fn().mockResolvedValueOnce({ error: null });
    const meetingsUpdateEq = jest.fn(() => ({ eq: meetingsUpdateInnerEq }));
    const meetingsUpdate = jest.fn(() => ({ eq: meetingsUpdateEq }));

    const attendeesDeleteEq = jest.fn().mockResolvedValueOnce({ error: null });
    const attendeesDelete = jest.fn(() => ({ eq: attendeesDeleteEq }));
    const attendeesInsert = jest
      .fn()
      .mockResolvedValueOnce({ error: { message: "insert failed" } });

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update: meetingsUpdate };
      }
      if (table === "meeting_attendees") {
        return { delete: attendeesDelete, insert: attendeesInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, { attendee_person_ids: [personId] }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns 404 and performs no update when the meeting belongs to a different project", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: null });

    const updateFn = jest.fn();
    const attendeesDelete = jest.fn();
    const attendeesInsert = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update: updateFn };
      }
      if (table === "meeting_attendees") {
        return { delete: attendeesDelete, insert: attendeesInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, {
        name: "Hijacked",
        attendee_person_ids: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
      }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(updateFn).not.toHaveBeenCalled();
    expect(attendeesDelete).not.toHaveBeenCalled();
    expect(attendeesInsert).not.toHaveBeenCalled();
    expect(loadMeetingDetailMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/projects/[projectId]/meetings/[meetingId]", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await DELETE(
      makeDeleteRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("soft-deletes by setting deleted_at, scoped to not-already-deleted rows", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: null },
    });

    const single = jest.fn().mockResolvedValueOnce({
      data: { id: MEETING_ID },
      error: null,
    });
    const select = jest.fn(() => ({ single }));
    const isFn = jest.fn(() => ({ select }));
    const eq = jest.fn(() => ({ eq: jest.fn(() => ({ is: isFn })) }));
    const update = jest.fn(() => ({ eq }));

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await DELETE(
      makeDeleteRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
    expect(eq).toHaveBeenCalledWith("id", MEETING_ID);
    expect(isFn).toHaveBeenCalledWith("deleted_at", null);
  });

  it("returns 404 when the meeting is already deleted or missing", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: "2026-01-01T00:00:00Z" },
    });

    const update = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await DELETE(
      makeDeleteRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 404 and performs no update when the meeting belongs to a different project", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: null });

    const update = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await DELETE(
      makeDeleteRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
