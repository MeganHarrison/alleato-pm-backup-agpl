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

function makePostRequest(
  projectId: string,
  meetingId: string,
  body: unknown,
): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/convert`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
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

describe("POST /api/projects/[projectId]/meetings/[meetingId]/convert", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { mode: "minutes" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("rejects an invalid mode", async () => {
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { mode: "bogus" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("converting to minutes sets mode=minutes and is_draft=false", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: null },
    });

    const eq = jest.fn(() => ({ eq: jest.fn().mockResolvedValueOnce({ error: null }) }));
    const update = jest.fn(() => ({ eq }));

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const detail = {
      meeting: { id: MEETING_ID, mode: "minutes", is_draft: false, status: "minutes" },
      attendees: [],
      categories: [],
    };
    loadMeetingDetailMock.mockResolvedValueOnce(detail);

    const response = await POST(
      makePostRequest("42", MEETING_ID, { mode: "minutes" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "minutes",
        is_draft: false,
        updated_at: expect.any(String),
      }),
    );
    expect(eq).toHaveBeenCalledWith("id", MEETING_ID);
    const body = await response.json();
    expect(body).toEqual(detail);
  });

  it("reverting to agenda sets mode=agenda without touching is_draft", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: null },
    });

    const eq = jest.fn(() => ({ eq: jest.fn().mockResolvedValueOnce({ error: null }) }));
    const update = jest.fn(() => ({ eq }));

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const detail = {
      meeting: { id: MEETING_ID, mode: "agenda", status: "draft" },
      attendees: [],
      categories: [],
    };
    loadMeetingDetailMock.mockResolvedValueOnce(detail);

    const response = await POST(
      makePostRequest("42", MEETING_ID, { mode: "agenda" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    const updatePayload = update.mock.calls[0][0];
    expect(updatePayload.mode).toBe("agenda");
    expect(updatePayload.is_draft).toBeUndefined();
    const body = await response.json();
    expect(body).toEqual(detail);
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
      makePostRequest("42", MEETING_ID, { mode: "minutes" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(loadMeetingDetailMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the meeting is soft-deleted", async () => {
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

    const response = await POST(
      makePostRequest("42", MEETING_ID, { mode: "minutes" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
