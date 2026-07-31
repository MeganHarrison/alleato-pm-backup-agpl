import { NextRequest } from "next/server";

import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { loadMeetingDetail } from "@/lib/meetings/server";
import { GuardrailError } from "@/lib/guardrails/errors";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/meetings/guards", () => ({
  assertMeetingInProject: jest.fn(),
}));

jest.mock("@/lib/meetings/server", () => ({
  loadMeetingDetail: jest.fn(),
}));

const getUserMock = getApiRouteUser as jest.Mock;
const createClientMock = createClient as jest.Mock;
const assertMeetingInProjectMock = assertMeetingInProject as jest.Mock;
const loadMeetingDetailMock = loadMeetingDetail as jest.Mock;

const MEETING_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NEW_MEETING_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SERIES_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const CATEGORY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NEW_CATEGORY_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ITEM_OPEN = "11111111-1111-4111-8111-111111111111";
const ITEM_IN_PROGRESS = "22222222-2222-4222-8222-222222222222";
const ITEM_CLOSED = "33333333-3333-4333-8333-333333333333";
const ORIGIN_MEETING_ID = "99999999-9999-4999-8999-999999999999";
const ATTENDEE_PERSON = "44444444-4444-4444-8444-444444444444";

function makePostRequest(projectId: string, meetingId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/follow-up`,
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

const SOURCE_MEETING = {
  id: MEETING_ID,
  project_id: 42,
  series_id: SERIES_ID,
  number: 3,
  name: "Weekly OAC",
  timezone: "America/New_York",
  location: "Room 1",
  is_private: false,
  mode: "minutes",
  is_draft: false,
};

const SOURCE_CATEGORIES = [{ id: CATEGORY_A, meeting_id: MEETING_ID, name: "Open Items", position: 0 }];

const SOURCE_ITEMS = [
  {
    id: ITEM_OPEN,
    meeting_id: MEETING_ID,
    category_id: CATEGORY_A,
    title: "Open item",
    description: "desc",
    assignee_person_id: null,
    due_date: null,
    status: "open",
    priority: "medium",
    position: 0,
    origin_meeting_id: ORIGIN_MEETING_ID,
  },
  {
    id: ITEM_IN_PROGRESS,
    meeting_id: MEETING_ID,
    category_id: CATEGORY_A,
    title: "In progress item",
    description: "desc",
    assignee_person_id: null,
    due_date: null,
    status: "in_progress",
    priority: "low",
    position: 1,
    origin_meeting_id: null,
  },
  {
    id: ITEM_CLOSED,
    meeting_id: MEETING_ID,
    category_id: CATEGORY_A,
    title: "Closed item",
    description: "desc",
    assignee_person_id: null,
    due_date: null,
    status: "closed",
    priority: null,
    position: 2,
    origin_meeting_id: MEETING_ID,
  },
];

const SOURCE_ATTENDEES = [{ meeting_id: MEETING_ID, person_id: ATTENDEE_PERSON, is_required: true }];

/** Builds the standard mock `from()` router for a happy-path follow-up create. */
function buildFrom(options: {
  numberConflict?: boolean;
  itemsInsertError?: unknown;
  categoriesData?: typeof SOURCE_CATEGORIES;
  itemsData?: typeof SOURCE_ITEMS;
  attendeesData?: typeof SOURCE_ATTENDEES;
}) {
  const {
    numberConflict = false,
    itemsInsertError = null,
    categoriesData = SOURCE_CATEGORIES,
    itemsData = SOURCE_ITEMS,
    attendeesData = SOURCE_ATTENDEES,
  } = options;

  const sourceMeetingChain: Record<string, unknown> = {};
  sourceMeetingChain.select = jest.fn(() => sourceMeetingChain);
  sourceMeetingChain.eq = jest.fn(() => sourceMeetingChain);
  sourceMeetingChain.single = jest.fn(async () => ({ data: SOURCE_MEETING, error: null }));

  const categoriesReadChain: Record<string, unknown> = {};
  categoriesReadChain.select = jest.fn(() => categoriesReadChain);
  categoriesReadChain.eq = jest.fn(() => categoriesReadChain);
  categoriesReadChain.order = jest.fn(async () => ({ data: categoriesData, error: null }));

  const itemsReadChain: Record<string, unknown> = {};
  itemsReadChain.select = jest.fn(() => itemsReadChain);
  itemsReadChain.eq = jest.fn(() => itemsReadChain);
  itemsReadChain.order = jest.fn(async () => ({ data: itemsData, error: null }));

  const attendeesReadChain: Record<string, unknown> = {};
  attendeesReadChain.select = jest.fn(() => attendeesReadChain);
  attendeesReadChain.eq = jest.fn(async () => ({ data: attendeesData, error: null }));

  const maxNumberChain: Record<string, unknown> = {};
  maxNumberChain.select = jest.fn(() => maxNumberChain);
  maxNumberChain.eq = jest.fn(() => maxNumberChain);
  maxNumberChain.order = jest.fn(() => maxNumberChain);
  maxNumberChain.limit = jest.fn(async () => ({ data: [{ number: 3 }], error: null }));

  let meetingInsertCallCount = 0;
  const meetingInsertSingle = jest.fn(async () => {
    meetingInsertCallCount += 1;
    if (numberConflict && meetingInsertCallCount === 1) {
      return { data: null, error: { code: "23505", message: "duplicate" } };
    }
    return { data: { ...SOURCE_MEETING, id: NEW_MEETING_ID, number: 4 }, error: null };
  });
  const meetingInsertSelect = jest.fn(() => ({ single: meetingInsertSingle }));
  const meetingInsert = jest.fn(() => ({ select: meetingInsertSelect }));

  const meetingDeleteEq = jest.fn().mockResolvedValue({ error: null });
  const meetingDelete = jest.fn(() => ({ eq: meetingDeleteEq }));

  const attendeesInsert = jest.fn().mockResolvedValue({ error: null });

  let categoryInsertCallCount = 0;
  const categoryInsertSelect = jest.fn(() => ({
    single: jest.fn(async () => {
      categoryInsertCallCount += 1;
      return { data: { id: NEW_CATEGORY_A }, error: null };
    }),
  }));
  const categoryInsert = jest.fn(() => ({ select: categoryInsertSelect }));

  const itemsInsert = jest.fn().mockResolvedValue({ error: itemsInsertError });

  let meetingsCallCount = 0;
  let categoriesCallCount = 0;
  let itemsCallCount = 0;

  const from = jest.fn((table: string) => {
    if (table === "meetings") {
      meetingsCallCount += 1;
      if (meetingsCallCount === 1) return sourceMeetingChain;
      if (meetingsCallCount === 2) return maxNumberChain;
      if (numberConflict && meetingsCallCount === 3) return { insert: meetingInsert };
      if (numberConflict && meetingsCallCount === 4) return maxNumberChain;
      return { insert: meetingInsert, delete: meetingDelete };
    }
    if (table === "meeting_categories") {
      categoriesCallCount += 1;
      if (categoriesCallCount === 1) return categoriesReadChain;
      return { insert: categoryInsert };
    }
    if (table === "meeting_items") {
      itemsCallCount += 1;
      if (itemsCallCount === 1) return itemsReadChain;
      return { insert: itemsInsert };
    }
    if (table === "meeting_attendees") {
      return { select: attendeesReadChain.select, insert: attendeesInsert };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { from, meetingInsert, meetingDelete, attendeesInsert, categoryInsert, itemsInsert };
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserMock.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
  });
  assertMeetingInProjectMock.mockResolvedValue(undefined);
});

describe("POST /api/projects/[projectId]/meetings/[meetingId]/follow-up", () => {
  it("carries only open/in_progress items, chains carried_from_item_id, and preserves the original origin_meeting_id", async () => {
    const { from, itemsInsert } = buildFrom({});
    createClientMock.mockResolvedValue({ from });
    loadMeetingDetailMock.mockResolvedValueOnce({
      meeting: { id: NEW_MEETING_ID, number: 4 },
      attendees: [],
      categories: [],
    });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { carry_open_items: true }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(201);
    expect(itemsInsert).toHaveBeenCalledTimes(1);
    const insertedRows = itemsInsert.mock.calls[0][0] as Array<Record<string, unknown>>;

    // Only the open + in_progress items were carried, not the closed one.
    expect(insertedRows).toHaveLength(2);
    const titles = insertedRows.map((row) => row.title);
    expect(titles).toEqual(["Open item", "In progress item"]);

    const openRow = insertedRows.find((row) => row.carried_from_item_id === ITEM_OPEN);
    expect(openRow).toMatchObject({
      meeting_id: NEW_MEETING_ID,
      category_id: NEW_CATEGORY_A,
      carried_from_item_id: ITEM_OPEN,
      origin_meeting_id: ORIGIN_MEETING_ID, // preserved from the source item, not reset
      official_minutes: null,
    });

    const inProgressRow = insertedRows.find((row) => row.carried_from_item_id === ITEM_IN_PROGRESS);
    // Source item had no origin_meeting_id set -> falls back to its own meeting_id.
    expect(inProgressRow).toMatchObject({
      origin_meeting_id: MEETING_ID,
    });
  });

  it("does not copy any items when carry_open_items is false", async () => {
    const { from, itemsInsert } = buildFrom({});
    createClientMock.mockResolvedValue({ from });
    loadMeetingDetailMock.mockResolvedValueOnce({
      meeting: { id: NEW_MEETING_ID, number: 4 },
      attendees: [],
      categories: [],
    });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { carry_open_items: false }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(201);
    expect(itemsInsert).not.toHaveBeenCalled();
  });

  it("retries the meeting number exactly once on a 23505 conflict, then succeeds", async () => {
    const { from, meetingInsert } = buildFrom({ numberConflict: true });
    createClientMock.mockResolvedValue({ from });
    loadMeetingDetailMock.mockResolvedValueOnce({
      meeting: { id: NEW_MEETING_ID, number: 4 },
      attendees: [],
      categories: [],
    });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { carry_open_items: false }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(201);
    expect(meetingInsert).toHaveBeenCalledTimes(2);
  });

  it("deletes the new meeting and surfaces the error when a post-insert step fails partway through", async () => {
    const { from, meetingDelete } = buildFrom({
      itemsInsertError: { message: "insert failed" },
    });
    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", MEETING_ID, { carry_open_items: true }),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(500);
    expect(meetingDelete).toHaveBeenCalled();
    expect(loadMeetingDetailMock).not.toHaveBeenCalled();
  });

  it("returns 404 and creates nothing when the meeting is not in this project", async () => {
    assertMeetingInProjectMock.mockRejectedValueOnce(
      new GuardrailError({ code: "NOT_FOUND", where: "test", message: "Meeting not found in this project" }),
    );

    const from = jest.fn(() => {
      throw new Error("should not query any table when the meeting scope guard fails");
    });
    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("999", MEETING_ID, { carry_open_items: true }),
      callParams("999", MEETING_ID),
    );

    expect(response.status).toBe(404);
  });
});
