import { NextRequest } from "next/server";

import { PATCH } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const getUserMock = getApiRouteUser as jest.Mock;
const createClientMock = createClient as jest.Mock;

const MEETING_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PERSON_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function makePatchRequest(
  projectId: string,
  meetingId: string,
  body: unknown,
): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/attendees`,
    {
      method: "PATCH",
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

/**
 * Chainable mock for the attendee lookup + update:
 * `.from("meeting_attendees").select(...).eq(...).eq(...).maybeSingle()`
 * `.from("meeting_attendees").update(...).eq(...).eq(...).select(...).single()`
 */
function makeAttendeeChain(existing: { data: unknown }, updated: { data: unknown; error?: unknown }) {
  const selectChain: Record<string, unknown> = {};
  selectChain.select = jest.fn(() => selectChain);
  selectChain.eq = jest.fn(() => selectChain);
  selectChain.maybeSingle = jest.fn(async () => ({ error: null, ...existing }));

  const updateChain: Record<string, unknown> = {};
  updateChain.eq = jest.fn(() => updateChain);
  updateChain.select = jest.fn(() => updateChain);
  updateChain.single = jest.fn(async () => ({ error: null, ...updated }));

  return { selectChain, updateChain };
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserMock.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
  });
});

describe("PATCH /api/projects/[projectId]/meetings/[meetingId]/attendees", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, { person_id: PERSON_ID, attended: true }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("rejects an invalid payload", async () => {
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, { person_id: "not-a-uuid", attended: true }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("marks an attendee as attended", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: null },
    });
    const { selectChain, updateChain } = makeAttendeeChain(
      { data: { id: "attendee-1", meeting_id: MEETING_ID, person_id: PERSON_ID } },
      { data: { id: "attendee-1", meeting_id: MEETING_ID, person_id: PERSON_ID, attended: true } },
    );

    const update = jest.fn(() => updateChain);
    let attendeesCallCount = 0;
    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select };
      }
      if (table === "meeting_attendees") {
        attendeesCallCount += 1;
        if (attendeesCallCount === 1) {
          return { select: selectChain.select };
        }
        return { update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, { person_id: PERSON_ID, attended: true }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ attended: true });
    const body = await response.json();
    expect(body.attended).toBe(true);
  });

  it("returns 404 and performs no update when the meeting belongs to a different project", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: null });
    const update = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select };
      }
      if (table === "meeting_attendees") {
        return { update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, { person_id: PERSON_ID, attended: true }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 404 when no attendee row exists for the given person", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: null },
    });
    const { selectChain } = makeAttendeeChain({ data: null }, { data: null });
    const update = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select };
      }
      if (table === "meeting_attendees") {
        return { select: selectChain.select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, { person_id: PERSON_ID, attended: false }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
