import { NextRequest } from "next/server";

import { DELETE, PATCH } from "../route";
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
const CATEGORY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CATEGORY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ITEM_1 = "11111111-1111-4111-8111-111111111111";
const ITEM_2 = "22222222-2222-4222-8222-222222222222";

function makeDeleteRequest(projectId: string, meetingId: string, categoryId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/categories/${categoryId}`,
    { method: "DELETE" },
  );
}

function makePatchRequest(
  projectId: string,
  meetingId: string,
  categoryId: string,
  body: unknown,
): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/categories/${categoryId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function callParams(projectId: string, meetingId: string, categoryId: string) {
  return { params: Promise.resolve({ projectId, meetingId, categoryId }) };
}

function makeMaybeSingleChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(async () => ({ error: null, ...result }));
  return chain;
}

function makeOrderChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(async () => ({ error: null, ...result }));
  return chain;
}

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

describe("DELETE /api/projects/[projectId]/meetings/[meetingId]/categories/[categoryId]", () => {
  it("rejects with 400 and performs no delete when it is the meeting's only category", async () => {
    const categoryLookupChain = makeMaybeSingleChain({
      data: { id: CATEGORY_A, meeting_id: MEETING_ID },
    });
    const allCategoriesChain = makeOrderChain({ data: [{ id: CATEGORY_A, position: 0 }] });

    const deleteFn = jest.fn();
    let categoriesCallCount = 0;

    const from = jest.fn((table: string) => {
      if (table === "meeting_categories") {
        categoriesCallCount += 1;
        if (categoriesCallCount === 1) return categoryLookupChain;
        return { ...allCategoriesChain, delete: deleteFn };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await DELETE(
      makeDeleteRequest("42", MEETING_ID, CATEGORY_A),
      callParams("42", MEETING_ID, CATEGORY_A),
    );

    expect(response.status).toBe(400);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("moves items to the first remaining category, appended after its existing items, then deletes the category", async () => {
    const categoryLookupChain = makeMaybeSingleChain({
      data: { id: CATEGORY_A, meeting_id: MEETING_ID },
    });
    const allCategoriesChain = makeOrderChain({
      data: [
        { id: CATEGORY_A, position: 0 },
        { id: CATEGORY_B, position: 1 },
      ],
    });
    const itemsToMoveChain = makeOrderChain({
      data: [
        { id: ITEM_1, position: 0 },
        { id: ITEM_2, position: 1 },
      ],
    });
    const targetCategoryItemsChain = makeOrderLimitChain({ data: [{ position: 4 }] });

    const updateEq2 = jest.fn().mockResolvedValue({ error: null });
    const updateEq1 = jest.fn(() => ({ eq: updateEq2 }));
    const update = jest.fn(() => ({ eq: updateEq1 }));

    const deleteEq2 = jest.fn().mockResolvedValue({ error: null });
    const deleteEq1 = jest.fn(() => ({ eq: deleteEq2 }));
    const deleteFn = jest.fn(() => ({ eq: deleteEq1 }));

    let categoriesCallCount = 0;
    let itemsCallCount = 0;

    const from = jest.fn((table: string) => {
      if (table === "meeting_categories") {
        categoriesCallCount += 1;
        if (categoriesCallCount === 1) return categoryLookupChain;
        if (categoriesCallCount === 2) return allCategoriesChain;
        return { delete: deleteFn };
      }
      if (table === "meeting_items") {
        itemsCallCount += 1;
        if (itemsCallCount === 1) return itemsToMoveChain;
        if (itemsCallCount === 2) return targetCategoryItemsChain;
        return { update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await DELETE(
      makeDeleteRequest("42", MEETING_ID, CATEGORY_A),
      callParams("42", MEETING_ID, CATEGORY_A),
    );

    expect(response.status).toBe(200);
    // Target category (CATEGORY_B) had a max position of 4 -> items appended at 5, 6.
    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ category_id: CATEGORY_B, position: 5 }),
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ category_id: CATEGORY_B, position: 6 }),
    );
    expect(deleteFn).toHaveBeenCalled();
    const body = await response.json();
    expect(body.moved_item_count).toBe(2);
  });

  it("returns 404 and performs no delete when the meeting is not in this project", async () => {
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

    const response = await DELETE(
      makeDeleteRequest("999", MEETING_ID, CATEGORY_A),
      callParams("999", MEETING_ID, CATEGORY_A),
    );

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/projects/[projectId]/meetings/[meetingId]/categories/[categoryId]", () => {
  it("renames the category", async () => {
    const categoryLookupChain = makeMaybeSingleChain({
      data: { id: CATEGORY_A, meeting_id: MEETING_ID },
    });

    const updateSelect = jest.fn(() => ({
      single: jest.fn(async () => ({
        data: { id: CATEGORY_A, name: "Renamed", meeting_id: MEETING_ID },
        error: null,
      })),
    }));
    const updateEq2 = jest.fn(() => ({ select: updateSelect }));
    const updateEq1 = jest.fn(() => ({ eq: updateEq2 }));
    const update = jest.fn(() => ({ eq: updateEq1 }));

    let categoriesCallCount = 0;
    const from = jest.fn((table: string) => {
      if (table === "meeting_categories") {
        categoriesCallCount += 1;
        if (categoriesCallCount === 1) return categoryLookupChain;
        return { update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await PATCH(
      makePatchRequest("42", MEETING_ID, CATEGORY_A, { name: "Renamed" }),
      callParams("42", MEETING_ID, CATEGORY_A),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ name: "Renamed" });
  });
});
