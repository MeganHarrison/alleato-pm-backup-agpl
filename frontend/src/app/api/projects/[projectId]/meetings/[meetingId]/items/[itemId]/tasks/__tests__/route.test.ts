import { NextRequest } from "next/server";

import { GET, POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { GuardrailError } from "@/lib/guardrails/errors";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/meetings/guards", () => ({
  assertMeetingInProject: jest.fn(),
}));

const getUserMock = getApiRouteUser as jest.Mock;
const createClientMock = createClient as jest.Mock;
const assertMeetingInProjectMock = assertMeetingInProject as jest.Mock;

const MEETING_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_ID = "99999999-9999-4999-8999-999999999999";

function makePostRequest(
  projectId: string,
  meetingId: string,
  itemId: string,
  body: unknown,
): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/items/${itemId}/tasks`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeGetRequest(projectId: string, meetingId: string, itemId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/items/${itemId}/tasks`,
    { method: "GET" },
  );
}

function callParams(projectId: string, meetingId: string, itemId: string) {
  return { params: Promise.resolve({ projectId, meetingId, itemId }) };
}

function makeMaybeSingleChain(result: { data: unknown; error?: unknown }) {
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
  assertMeetingInProjectMock.mockResolvedValue(undefined);
});

describe("POST /api/projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks", () => {
  const EXPECTED_METADATA_ID = `meeting-item-task-${ITEM_ID}`;

  it("defaults title/description/assignee/due_date from the item and inserts a document_metadata stub + tasks row", async () => {
    const itemChain = makeMaybeSingleChain({
      data: {
        id: ITEM_ID,
        meeting_id: MEETING_ID,
        title: "Follow up on permit",
        description: "Chase the county office",
        assignee_person_id: PERSON_ID,
        due_date: "2026-08-01",
      },
    });

    // No existing stub for this agenda item yet.
    const docLookupChain = makeMaybeSingleChain({ data: null });
    const docInsert = jest.fn().mockResolvedValue({ error: null });

    const taskInsertSingle = jest.fn(async () => ({
      data: {
        id: "task-1",
        title: "Follow up on permit",
        description: "Chase the county office",
        assignee_person_id: PERSON_ID,
        due_date: "2026-08-01",
        meeting_item_id: ITEM_ID,
        extraction_source: "meeting_agenda",
        status: "open",
      },
      error: null,
    }));
    const taskInsertSelect = jest.fn(() => ({ single: taskInsertSingle }));
    const taskInsert = jest.fn(() => ({ select: taskInsertSelect }));

    const from = jest.fn((table: string) => {
      if (table === "meeting_items") return itemChain;
      if (table === "document_metadata") return { select: docLookupChain.select, insert: docInsert };
      if (table === "tasks") return { insert: taskInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, ITEM_ID, {}),
      callParams("42", MEETING_ID, ITEM_ID),
    );

    expect(response.status).toBe(201);

    // document_metadata stub is looked up by the deterministic id before
    // being inserted, and carries the exact deterministic id, the
    // "meeting_agenda_task" type (excluded from the Files/Documents UI), and
    // a "done" status (the safest available pipeline no-op signal).
    expect(docLookupChain.eq).toHaveBeenCalledWith("id", EXPECTED_METADATA_ID);
    expect(docInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: EXPECTED_METADATA_ID,
        type: "meeting_agenda_task",
        status: "done",
        source_system: "meeting_agenda",
        project_id: 42,
      }),
    );

    // tasks row uses people.id-shaped assignee, links back to the item, and is
    // tagged with the meeting_agenda extraction source.
    expect(taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Follow up on permit",
        description: "Chase the county office",
        assignee_person_id: PERSON_ID,
        due_date: "2026-08-01",
        meeting_item_id: ITEM_ID,
        project_id: 42,
        status: "open",
        source_system: "meeting_agenda",
        extraction_source: "meeting_agenda",
        metadata_id: EXPECTED_METADATA_ID,
      }),
    );

    // The metadata_id passed to tasks insert matches the id used for the
    // document_metadata stub (the FK must resolve).
    const docInsertArg = docInsert.mock.calls[0][0];
    const taskInsertArg = taskInsert.mock.calls[0][0];
    expect(taskInsertArg.metadata_id).toBe(docInsertArg.id);
  });

  it("reuses the existing stub for a second task on the same agenda item — no second document_metadata insert", async () => {
    const itemChain = makeMaybeSingleChain({
      data: {
        id: ITEM_ID,
        meeting_id: MEETING_ID,
        title: "Follow up on permit",
        description: "Chase the county office",
        assignee_person_id: PERSON_ID,
        due_date: "2026-08-01",
      },
    });

    // Stub already exists from a prior task creation on this same item.
    const docLookupChain = makeMaybeSingleChain({ data: { id: EXPECTED_METADATA_ID } });
    const docInsert = jest.fn().mockResolvedValue({ error: null });

    const taskInsertSingle = jest.fn(async () => ({
      data: {
        id: "task-2",
        title: "Second task from same item",
        meeting_item_id: ITEM_ID,
        status: "open",
      },
      error: null,
    }));
    const taskInsertSelect = jest.fn(() => ({ single: taskInsertSingle }));
    const taskInsert = jest.fn(() => ({ select: taskInsertSelect }));

    const from = jest.fn((table: string) => {
      if (table === "meeting_items") return itemChain;
      if (table === "document_metadata") return { select: docLookupChain.select, insert: docInsert };
      if (table === "tasks") return { insert: taskInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, ITEM_ID, { title: "Second task from same item" }),
      callParams("42", MEETING_ID, ITEM_ID),
    );

    expect(response.status).toBe(201);

    // Lookup happened, but since a stub already existed, no second insert
    // into document_metadata was made — the existing stub is reused.
    expect(docLookupChain.eq).toHaveBeenCalledWith("id", EXPECTED_METADATA_ID);
    expect(docInsert).not.toHaveBeenCalled();

    // The new task still points at the same deterministic metadata_id.
    expect(taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata_id: EXPECTED_METADATA_ID }),
    );
  });

  it("uses supplied overrides instead of item defaults when provided", async () => {
    const itemChain = makeMaybeSingleChain({
      data: {
        id: ITEM_ID,
        meeting_id: MEETING_ID,
        title: "Item title",
        description: "Item description",
        assignee_person_id: PERSON_ID,
        due_date: "2026-08-01",
      },
    });

    const docLookupChain = makeMaybeSingleChain({ data: null });
    const docInsert = jest.fn().mockResolvedValue({ error: null });
    const otherPersonId = "88888888-8888-4888-8888-888888888888";

    const taskInsertSingle = jest.fn(async () => ({
      data: { id: "task-2", title: "Custom title" },
      error: null,
    }));
    const taskInsertSelect = jest.fn(() => ({ single: taskInsertSingle }));
    const taskInsert = jest.fn(() => ({ select: taskInsertSelect }));

    const from = jest.fn((table: string) => {
      if (table === "meeting_items") return itemChain;
      if (table === "document_metadata") return { select: docLookupChain.select, insert: docInsert };
      if (table === "tasks") return { insert: taskInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, ITEM_ID, {
        title: "Custom title",
        assignee_person_id: otherPersonId,
        due_date: "2026-09-01",
      }),
      callParams("42", MEETING_ID, ITEM_ID),
    );

    expect(response.status).toBe(201);
    expect(taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Custom title",
        assignee_person_id: otherPersonId,
        due_date: "2026-09-01",
      }),
    );
  });

  it("uses explicit null owner and due date instead of inheriting item defaults", async () => {
    const itemChain = makeMaybeSingleChain({
      data: {
        id: ITEM_ID,
        meeting_id: MEETING_ID,
        title: "Item title",
        description: "Item description",
        assignee_person_id: PERSON_ID,
        due_date: "2026-08-01",
      },
    });

    const docLookupChain = makeMaybeSingleChain({ data: null });
    const docInsert = jest.fn().mockResolvedValue({ error: null });

    const taskInsertSingle = jest.fn(async () => ({
      data: { id: "task-3", title: "Custom title" },
      error: null,
    }));
    const taskInsertSelect = jest.fn(() => ({ single: taskInsertSingle }));
    const taskInsert = jest.fn(() => ({ select: taskInsertSelect }));

    const from = jest.fn((table: string) => {
      if (table === "meeting_items") return itemChain;
      if (table === "document_metadata") return { select: docLookupChain.select, insert: docInsert };
      if (table === "tasks") return { insert: taskInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, ITEM_ID, {
        title: "Custom title",
        assignee_person_id: null,
        due_date: null,
      }),
      callParams("42", MEETING_ID, ITEM_ID),
    );

    expect(response.status).toBe(201);
    expect(taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Custom title",
        assignee_person_id: null,
        due_date: null,
      }),
    );
  });

  it("returns 404 and performs no insert when the item doesn't belong to this meeting", async () => {
    const itemChain = makeMaybeSingleChain({ data: null });
    const docInsert = jest.fn();
    const taskInsert = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meeting_items") return itemChain;
      if (table === "document_metadata") return { insert: docInsert };
      if (table === "tasks") return { insert: taskInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, ITEM_ID, {}),
      callParams("42", MEETING_ID, ITEM_ID),
    );

    expect(response.status).toBe(404);
    expect(docInsert).not.toHaveBeenCalled();
    expect(taskInsert).not.toHaveBeenCalled();
  });

  it("returns 404 and performs no insert when the meeting is not in this project", async () => {
    assertMeetingInProjectMock.mockRejectedValueOnce(
      new GuardrailError({ code: "NOT_FOUND", where: "test", message: "Meeting not found in this project" }),
    );
    const docInsert = jest.fn();
    const taskInsert = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "document_metadata") return { insert: docInsert };
      if (table === "tasks") return { insert: taskInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("999", MEETING_ID, ITEM_ID, {}),
      callParams("999", MEETING_ID, ITEM_ID),
    );

    expect(response.status).toBe(404);
    expect(docInsert).not.toHaveBeenCalled();
    expect(taskInsert).not.toHaveBeenCalled();
  });

  it("cleans up the document_metadata stub when the tasks insert fails", async () => {
    const itemChain = makeMaybeSingleChain({
      data: {
        id: ITEM_ID,
        meeting_id: MEETING_ID,
        title: "Item title",
        description: "Item description",
        assignee_person_id: null,
        due_date: null,
      },
    });

    const docLookupChain = makeMaybeSingleChain({ data: null });
    const docInsert = jest.fn().mockResolvedValue({ error: null });
    const docDeleteEq = jest.fn().mockResolvedValue({ error: null });
    const docDelete = jest.fn(() => ({ eq: docDeleteEq }));

    const taskInsertSingle = jest.fn(async () => ({
      data: null,
      error: { message: "insert failed" },
    }));
    const taskInsertSelect = jest.fn(() => ({ single: taskInsertSingle }));
    const taskInsert = jest.fn(() => ({ select: taskInsertSelect }));

    const from = jest.fn((table: string) => {
      if (table === "meeting_items") return itemChain;
      if (table === "document_metadata")
        return { select: docLookupChain.select, insert: docInsert, delete: docDelete };
      if (table === "tasks") return { insert: taskInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, ITEM_ID, {}),
      callParams("42", MEETING_ID, ITEM_ID),
    );

    expect(response.status).toBe(500);
    // This call created the stub (no existingDoc), so it is safe to clean up.
    expect(docDelete).toHaveBeenCalled();
    expect(docDeleteEq).toHaveBeenCalledWith("id", EXPECTED_METADATA_ID);
  });

  it("does NOT delete a pre-existing stub when the tasks insert fails and the stub was reused", async () => {
    const itemChain = makeMaybeSingleChain({
      data: {
        id: ITEM_ID,
        meeting_id: MEETING_ID,
        title: "Item title",
        description: "Item description",
        assignee_person_id: null,
        due_date: null,
      },
    });

    // Stub already existed before this call.
    const docLookupChain = makeMaybeSingleChain({ data: { id: EXPECTED_METADATA_ID } });
    const docInsert = jest.fn().mockResolvedValue({ error: null });
    const docDeleteEq = jest.fn().mockResolvedValue({ error: null });
    const docDelete = jest.fn(() => ({ eq: docDeleteEq }));

    const taskInsertSingle = jest.fn(async () => ({
      data: null,
      error: { message: "insert failed" },
    }));
    const taskInsertSelect = jest.fn(() => ({ single: taskInsertSingle }));
    const taskInsert = jest.fn(() => ({ select: taskInsertSelect }));

    const from = jest.fn((table: string) => {
      if (table === "meeting_items") return itemChain;
      if (table === "document_metadata")
        return { select: docLookupChain.select, insert: docInsert, delete: docDelete };
      if (table === "tasks") return { insert: taskInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, ITEM_ID, {}),
      callParams("42", MEETING_ID, ITEM_ID),
    );

    expect(response.status).toBe(500);
    expect(docInsert).not.toHaveBeenCalled();
    // The stub pre-existed this call, so it must not be torn down — other
    // tasks from this same agenda item may still reference it.
    expect(docDelete).not.toHaveBeenCalled();
  });
});

describe("GET /api/projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks", () => {
  it("returns tasks scoped to the item", async () => {
    const itemChain = makeMaybeSingleChain({ data: { id: ITEM_ID, meeting_id: MEETING_ID } });

    const tasksChain: Record<string, unknown> = {};
    tasksChain.select = jest.fn(() => tasksChain);
    tasksChain.eq = jest.fn(() => tasksChain);
    tasksChain.order = jest.fn(async () => ({
      data: [{ id: "task-1", meeting_item_id: ITEM_ID }],
      error: null,
    }));

    const from = jest.fn((table: string) => {
      if (table === "meeting_items") return itemChain;
      if (table === "tasks") return tasksChain;
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await GET(
      makeGetRequest("42", MEETING_ID, ITEM_ID),
      callParams("42", MEETING_ID, ITEM_ID),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tasks).toHaveLength(1);
  });
});
