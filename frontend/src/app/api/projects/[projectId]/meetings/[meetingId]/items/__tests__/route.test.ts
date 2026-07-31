import { NextRequest } from "next/server";

import { PATCH, POST } from "../route";
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
const CATEGORY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ITEM_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ITEM_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makePostRequest(projectId: string, meetingId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/items`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makePatchRequest(projectId: string, meetingId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/items`,
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

/** Chainable mock for a `.select().eq().eq().maybeSingle()`-style lookup. */
function makeMaybeSingleChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(async () => ({ error: null, ...result }));
  return chain;
}

/** Chainable mock for `.select().eq().order().limit()` returning a plain array result. */
function makeOrderLimitChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(async () => ({ error: null, ...result }));
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

describe("POST /api/projects/[projectId]/meetings/[meetingId]/items", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { category_id: CATEGORY_ID, title: "Item" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(401);
  });

  it("creates an item with position = max+1 and origin_meeting_id set to this meeting", async () => {
    const categoryChain = makeMaybeSingleChain({
      data: { id: CATEGORY_ID, meeting_id: MEETING_ID },
    });
    const maxPositionChain = makeOrderLimitChain({ data: [{ position: 2 }] });

    const insertSelect = jest.fn(() => ({
      single: jest.fn(async () => ({
        data: { id: ITEM_A, category_id: CATEGORY_ID, title: "Item", position: 3 },
        error: null,
      })),
    }));
    const insert = jest.fn(() => ({ select: insertSelect }));

    const from = jest.fn((table: string) => {
      if (table === "meeting_categories") return categoryChain;
      if (table === "meeting_items") return { select: maxPositionChain.select, insert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, {
        category_id: CATEGORY_ID,
        title: "Item",
      }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        meeting_id: MEETING_ID,
        category_id: CATEGORY_ID,
        title: "Item",
        position: 3,
        origin_meeting_id: MEETING_ID,
        status: "open",
      }),
    );
  });

  it("defaults position to 0 when the category has no existing items", async () => {
    const categoryChain = makeMaybeSingleChain({
      data: { id: CATEGORY_ID, meeting_id: MEETING_ID },
    });
    const maxPositionChain = makeOrderLimitChain({ data: [] });

    const insertSelect = jest.fn(() => ({
      single: jest.fn(async () => ({
        data: { id: ITEM_A, category_id: CATEGORY_ID, title: "Item", position: 0 },
        error: null,
      })),
    }));
    const insert = jest.fn(() => ({ select: insertSelect }));

    const from = jest.fn((table: string) => {
      if (table === "meeting_categories") return categoryChain;
      if (table === "meeting_items") return { select: maxPositionChain.select, insert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { category_id: CATEGORY_ID, title: "Item" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ position: 0 }));
  });

  it("returns 404 and performs no insert when the category doesn't belong to this meeting", async () => {
    const categoryChain = makeMaybeSingleChain({ data: null });
    const insert = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meeting_categories") return categoryChain;
      if (table === "meeting_items") return { insert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { category_id: CATEGORY_ID, title: "Item" }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 404 and performs no insert when the meeting is not in this project", async () => {
    assertMeetingInProjectMock.mockRejectedValueOnce(
      new GuardrailError({
        code: "NOT_FOUND",
        where: "test",
        message: "Meeting not found in this project",
      }),
    );
    const insert = jest.fn();
    const from = jest.fn((table: string) => {
      if (table === "meeting_items") return { insert };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("999", MEETING_ID, { category_id: CATEGORY_ID, title: "Item" }),
      callParams("999", MEETING_ID),
    );

    expect(response.status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/projects/[projectId]/meetings/[meetingId]/items", () => {
  it("rewrites positions 0..n in the given order for a valid ordered_ids list", async () => {
    const categoryChain = makeMaybeSingleChain({
      data: { id: CATEGORY_ID, meeting_id: MEETING_ID },
    });

    const existingItemsChain: Record<string, unknown> = {};
    existingItemsChain.select = jest.fn(() => existingItemsChain);
    existingItemsChain.eq = jest.fn(async () => ({
      data: [{ id: ITEM_A }, { id: ITEM_B }],
      error: null,
    }));

    const updateEq2 = jest.fn().mockResolvedValue({ error: null });
    const updateEq1 = jest.fn(() => ({ eq: updateEq2 }));
    const update = jest.fn(() => ({ eq: updateEq1 }));

    const reloadChain: Record<string, unknown> = {};
    reloadChain.select = jest.fn(() => reloadChain);
    reloadChain.eq = jest.fn(() => reloadChain);
    reloadChain.order = jest.fn(async () => ({
      data: [
        { id: ITEM_B, position: 0 },
        { id: ITEM_A, position: 1 },
      ],
      error: null,
    }));

    let itemsCallCount = 0;
    const from = jest.fn((table: string) => {
      if (table === "meeting_categories") return categoryChain;
      if (table === "meeting_items") {
        itemsCallCount += 1;
        if (itemsCallCount === 1) return existingItemsChain;
        if (itemsCallCount <= 3) return { update };
        return reloadChain;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, {
        category_id: CATEGORY_ID,
        ordered_ids: [ITEM_B, ITEM_A],
      }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ category_id: CATEGORY_ID, position: 0 }));
    expect(update).toHaveBeenNthCalledWith(2, expect.objectContaining({ category_id: CATEGORY_ID, position: 1 }));
    const body = await response.json();
    expect(body.items).toHaveLength(2);
  });

  it("rejects with 400 and performs no update when an id doesn't belong to this meeting", async () => {
    const categoryChain = makeMaybeSingleChain({
      data: { id: CATEGORY_ID, meeting_id: MEETING_ID },
    });

    const existingItemsChain: Record<string, unknown> = {};
    existingItemsChain.select = jest.fn(() => existingItemsChain);
    existingItemsChain.eq = jest.fn(async () => ({ data: [{ id: ITEM_A }], error: null }));

    const update = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === "meeting_categories") return categoryChain;
      if (table === "meeting_items") return { ...existingItemsChain, update };
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, {
        category_id: CATEGORY_ID,
        ordered_ids: [ITEM_A, ITEM_B],
      }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 404 and performs no mutation when the meeting is not in this project", async () => {
    assertMeetingInProjectMock.mockRejectedValueOnce(
      new GuardrailError({
        code: "NOT_FOUND",
        where: "test",
        message: "Meeting not found in this project",
      }),
    );

    const from = jest.fn(() => {
      throw new Error("should not query any table when the meeting scope guard fails");
    });

    createClientMock.mockResolvedValue({ from });

    const response = await PATCH(
      makePatchRequest("999", MEETING_ID, {
        category_id: CATEGORY_ID,
        ordered_ids: [ITEM_A],
      }),
      callParams("999", MEETING_ID),
    );

    expect(response.status).toBe(404);
  });
});
