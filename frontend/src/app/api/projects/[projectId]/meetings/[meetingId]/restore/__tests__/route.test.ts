import { NextRequest } from "next/server";

import { POST } from "../route";
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

function makePostRequest(projectId: string, meetingId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/restore`,
    { method: "POST" },
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

describe("POST /api/projects/[projectId]/meetings/[meetingId]/restore", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await POST(
      makePostRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("clears deleted_at and returns the fresh detail", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: "2026-01-01T00:00:00Z" },
    });

    const single = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: MEETING_ID }, error: null });
    const select = jest.fn(() => ({ single }));
    const eq = jest.fn(() => ({ eq: jest.fn(() => ({ select })) }));
    const update = jest.fn(() => ({ eq }));

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const detail = {
      meeting: { id: MEETING_ID, status: "draft" },
      attendees: [],
      categories: [],
    };
    loadMeetingDetailMock.mockResolvedValueOnce(detail);

    const response = await POST(
      makePostRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ deleted_at: null });
    expect(eq).toHaveBeenCalledWith("id", MEETING_ID);
    const body = await response.json();
    expect(body).toEqual(detail);
  });

  it("returns 404 when the meeting doesn't exist", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: null });

    const update = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID),
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

    const response = await POST(
      makePostRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(loadMeetingDetailMock).not.toHaveBeenCalled();
  });

  it("restores a meeting that is currently soft-deleted (restore ignores deleted_at)", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: "2026-01-01T00:00:00Z" },
    });

    const single = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: MEETING_ID }, error: null });
    const select = jest.fn(() => ({ single }));
    const eq = jest.fn(() => ({ eq: jest.fn(() => ({ select })) }));
    const update = jest.fn(() => ({ eq }));

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });
    loadMeetingDetailMock.mockResolvedValueOnce({
      meeting: { id: MEETING_ID, status: "draft" },
      attendees: [],
      categories: [],
    });

    const response = await POST(
      makePostRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ deleted_at: null });
  });
});
