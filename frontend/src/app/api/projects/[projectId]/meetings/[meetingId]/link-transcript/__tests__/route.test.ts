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
const DOC_ID = "11111111-2222-4333-8444-555555555555";

function makePostRequest(
  projectId: string,
  meetingId: string,
  body: unknown,
): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/link-transcript`,
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

/** Chainable query-builder mock for document_metadata lookups. */
function makeDocChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "is"];
  for (const method of methods) {
    chain[method] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(async () => result);
  return chain;
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

const DEFAULT_EXISTING_MEETING = {
  id: MEETING_ID,
  project_id: 42,
  deleted_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  getUserMock.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
  });
});

describe("POST /api/projects/[projectId]/meetings/[meetingId]/link-transcript", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: DOC_ID }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("rejects an invalid body (document_metadata_id not a uuid and not null)", async () => {
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: "not-a-uuid" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("clears the link when document_metadata_id is null", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: DEFAULT_EXISTING_MEETING });

    const meetingsInnerEq = jest.fn().mockResolvedValueOnce({ error: null });
    const meetingsEq = jest.fn(() => ({ eq: meetingsInnerEq }));
    const meetingsUpdate = jest.fn(() => ({ eq: meetingsEq }));

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update: meetingsUpdate };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });
    loadMeetingDetailMock.mockResolvedValueOnce({
      meeting: { id: MEETING_ID, transcript_document_id: null, status: "draft" },
      attendees: [],
      categories: [],
    });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: null }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(meetingsUpdate).toHaveBeenCalledWith({ transcript_document_id: null });
  });

  it("rejects a document from another project", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: DEFAULT_EXISTING_MEETING });
    const docChain = makeDocChain({
      data: { id: DOC_ID, project_id: 999, type: "meeting", deleted_at: null },
      error: null,
    });

    const from = jest.fn((table: string) => {
      if (table === "document_metadata") {
        return docChain;
      }
      if (table === "meetings") {
        return { select: existingMeetingChain.select };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: DOC_ID }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("rejects a document that isn't type='meeting'", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: DEFAULT_EXISTING_MEETING });
    const docChain = makeDocChain({
      data: { id: DOC_ID, project_id: 42, type: "drawing", deleted_at: null },
      error: null,
    });

    const from = jest.fn((table: string) => {
      if (table === "document_metadata") {
        return docChain;
      }
      if (table === "meetings") {
        return { select: existingMeetingChain.select };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: DOC_ID }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("rejects a soft-deleted document", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: DEFAULT_EXISTING_MEETING });
    const docChain = makeDocChain({
      data: { id: DOC_ID, project_id: 42, type: "meeting", deleted_at: "2026-01-01T00:00:00Z" },
      error: null,
    });

    const from = jest.fn((table: string) => {
      if (table === "document_metadata") {
        return docChain;
      }
      if (table === "meetings") {
        return { select: existingMeetingChain.select };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: DOC_ID }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("rejects a document that doesn't exist", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: DEFAULT_EXISTING_MEETING });
    const docChain = makeDocChain({ data: null, error: null });

    const from = jest.fn((table: string) => {
      if (table === "document_metadata") {
        return docChain;
      }
      if (table === "meetings") {
        return { select: existingMeetingChain.select };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: DOC_ID }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("links a valid document from the same project, type=meeting, not deleted", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: DEFAULT_EXISTING_MEETING });
    const docChain = makeDocChain({
      data: { id: DOC_ID, project_id: 42, type: "meeting", deleted_at: null },
      error: null,
    });

    const meetingsInnerEq = jest.fn().mockResolvedValueOnce({ error: null });
    const meetingsEq = jest.fn(() => ({ eq: meetingsInnerEq }));
    const meetingsUpdate = jest.fn(() => ({ eq: meetingsEq }));

    const from = jest.fn((table: string) => {
      if (table === "document_metadata") {
        return docChain;
      }
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update: meetingsUpdate };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });
    const detail = {
      meeting: { id: MEETING_ID, transcript_document_id: DOC_ID, status: "draft" },
      attendees: [],
      categories: [],
    };
    loadMeetingDetailMock.mockResolvedValueOnce(detail);

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: DOC_ID }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(meetingsUpdate).toHaveBeenCalledWith({
      transcript_document_id: DOC_ID,
    });
    expect(meetingsEq).toHaveBeenCalledWith("id", MEETING_ID);
    const body = await response.json();
    expect(body).toEqual(detail);
  });

  it("returns 404 and performs no update when the meeting belongs to a different project", async () => {
    const existingMeetingChain = makeExistingMeetingChain({ data: null });

    const meetingsUpdate = jest.fn();
    const docFrom = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update: meetingsUpdate };
      }
      if (table === "document_metadata") {
        docFrom();
        throw new Error("document_metadata should not be queried when the meeting scope guard fails");
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: DOC_ID }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(meetingsUpdate).not.toHaveBeenCalled();
    expect(docFrom).not.toHaveBeenCalled();
    expect(loadMeetingDetailMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the meeting is soft-deleted", async () => {
    const existingMeetingChain = makeExistingMeetingChain({
      data: { id: MEETING_ID, project_id: 42, deleted_at: "2026-01-01T00:00:00Z" },
    });

    const meetingsUpdate = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return { select: existingMeetingChain.select, update: meetingsUpdate };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { document_metadata_id: null }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(meetingsUpdate).not.toHaveBeenCalled();
  });
});
