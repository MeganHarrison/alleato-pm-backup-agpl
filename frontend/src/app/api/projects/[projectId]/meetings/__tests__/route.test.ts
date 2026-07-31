import { NextRequest } from "next/server";

import { GET, POST } from "../route";
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

function makeGetRequest(projectId: string, query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings${query}`,
  );
}

function makePostRequest(projectId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function callParams(projectId: string) {
  return { params: Promise.resolve({ projectId }) };
}

/**
 * Builds a chainable query-builder mock. Every chain method returns `this`
 * so calls can be composed in any order; the chain is also thenable so
 * `await query` resolves with the configured result.
 */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "neq",
    "in",
    "is",
    "order",
    "or",
    "limit",
  ];
  for (const method of methods) {
    chain[method] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(async () => result);
  chain.single = jest.fn(async () => result);
  chain.then = (resolve: (value: typeof result) => unknown) =>
    resolve(result);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserMock.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
  });
});

describe("GET /api/projects/[projectId]/meetings", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await GET(makeGetRequest("42"), callParams("42"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("groups meetings by series, derives status, and honors deleted=exclude default", async () => {
    const seriesA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const seriesB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const meetingsRows = [
      {
        id: "m1",
        series_id: seriesA,
        number: 1,
        name: "Weekly Sync",
        meeting_date: "2026-06-01",
        location: null,
        is_draft: false,
        mode: "minutes",
        template_id: null,
        transcript_document_id: null,
        deleted_at: null,
      },
      {
        id: "m2",
        series_id: seriesA,
        number: 2,
        name: "Weekly Sync",
        meeting_date: "2026-06-08",
        location: null,
        is_draft: true,
        mode: "agenda",
        template_id: null,
        transcript_document_id: null,
        deleted_at: null,
      },
      {
        id: "m3",
        series_id: seriesB,
        number: 1,
        name: "Kickoff",
        meeting_date: "2026-05-01",
        location: "Site trailer",
        is_draft: false,
        mode: "agenda",
        template_id: "tttttttt-tttt-4ttt-8ttt-tttttttttttt",
        transcript_document_id: null,
        deleted_at: null,
      },
    ];

    const seriesRows = [
      { id: seriesA, name: "Weekly Sync" },
      { id: seriesB, name: "Kickoff" },
    ];

    const itemCountRows = [
      { meeting_id: "m1" },
      { meeting_id: "m1" },
      { meeting_id: "m2" },
    ];

    const templateRows = [
      { id: "tttttttt-tttt-4ttt-8ttt-tttttttttttt", name: "OAC Meeting Template" },
    ];

    const from = jest.fn((table: string) => {
      if (table === "meetings") {
        return makeChain({ data: meetingsRows, error: null });
      }
      if (table === "meeting_series") {
        return makeChain({ data: seriesRows, error: null });
      }
      if (table === "meeting_items") {
        return makeChain({ data: itemCountRows, error: null });
      }
      if (table === "meeting_templates") {
        return makeChain({ data: templateRows, error: null });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await GET(makeGetRequest("42"), callParams("42"));

    expect(response.status).toBe(200);
    const body = await response.json();

    // Series sorted by most recent meeting_date desc: seriesA (2026-06-08) before seriesB (2026-05-01)
    expect(body.series).toHaveLength(2);
    expect(body.series[0].series_id).toBe(seriesA);
    expect(body.series[0].name).toBe("Weekly Sync");
    expect(body.series[1].series_id).toBe(seriesB);

    // Meetings within series sorted by number desc
    expect(body.series[0].meetings.map((m: { number: number }) => m.number)).toEqual([2, 1]);

    // Status derivation: is_draft wins
    const m2 = body.series[0].meetings.find((m: { id: string }) => m.id === "m2");
    expect(m2.status).toBe("draft");
    const m1 = body.series[0].meetings.find((m: { id: string }) => m.id === "m1");
    expect(m1.status).toBe("minutes");
    const m3 = body.series[1].meetings[0];
    expect(m3.status).toBe("awaiting_minutes");

    // Batched agenda_item_count via meeting_items grouped by meeting_id
    expect(m1.agenda_item_count).toBe(2);
    expect(m2.agenda_item_count).toBe(1);
    expect(m3.agenda_item_count).toBe(0);

    // Only one meeting_items query call (batched, not per-meeting)
    const meetingItemsCalls = from.mock.calls.filter(([table]) => table === "meeting_items");
    expect(meetingItemsCalls).toHaveLength(1);

    // template_name resolved via one batched meeting_templates lookup, keyed off template_id
    expect(m1.template_name).toBeNull();
    expect(m2.template_name).toBeNull();
    expect(m3.template_name).toBe("OAC Meeting Template");
    const templateCalls = from.mock.calls.filter(([table]) => table === "meeting_templates");
    expect(templateCalls).toHaveLength(1);

    // deleted=exclude default -> filters is("deleted_at", null) on meetings query
    const meetingsChainCall = from.mock.results.find((r, idx) => from.mock.calls[idx][0] === "meetings");
    expect(meetingsChainCall).toBeDefined();
  });
});

describe("POST /api/projects/[projectId]/meetings", () => {
  it("returns a 401-shaped GuardrailError when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(null);
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await POST(
      makePostRequest("42", { name: "Weekly Sync" }),
      callParams("42"),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns 400 with Zod details for an invalid body", async () => {
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await POST(
      makePostRequest("42", { meeting_date: "not-a-date" }),
      callParams("42"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.details).toBeDefined();
  });

  it("upserts the series, computes next number, inserts meeting/attendees/default category, and returns MeetingDetail", async () => {
    const seriesId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const newMeetingId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const personId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    const seriesSelectSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: null }); // no existing series
    const seriesInsertSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: seriesId, name: "Weekly Sync" }, error: null });

    const maxNumberChain = makeChain({ data: [], error: null }); // no existing meetings in series -> max = 0

    const meetingInsertSingle = jest.fn().mockResolvedValueOnce({
      data: {
        id: newMeetingId,
        series_id: seriesId,
        number: 1,
        name: "Weekly Sync",
        project_id: 42,
      },
      error: null,
    });

    const attendeesInsert = jest.fn().mockResolvedValueOnce({ error: null });
    const categoryInsert = jest.fn().mockResolvedValueOnce({ error: null });

    let meetingsCallCount = 0;

    const from = jest.fn((table: string) => {
      if (table === "meeting_series") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: seriesSelectSingle,
              })),
            })),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: seriesInsertSingle,
            })),
          })),
        };
      }
      if (table === "meetings") {
        meetingsCallCount += 1;
        if (meetingsCallCount === 1) {
          // max-number lookup
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => maxNumberChain),
                })),
              })),
            })),
          };
        }
        // insert new meeting
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: meetingInsertSingle,
            })),
          })),
        };
      }
      if (table === "meeting_attendees") {
        return { insert: attendeesInsert };
      }
      if (table === "meeting_categories") {
        return { insert: categoryInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });
    loadMeetingDetailMock.mockResolvedValue({
      meeting: { id: newMeetingId, status: "draft" },
      attendees: [],
      categories: [],
    });

    const response = await POST(
      makePostRequest("42", {
        name: "Weekly Sync",
        attendee_person_ids: [personId],
      }),
      callParams("42"),
    );

    expect(response.status).toBe(201);

    // Series upsert: created since none existed
    expect(seriesInsertSingle).toHaveBeenCalled();

    // Meeting insert payload
    expect(meetingInsertSingle).toHaveBeenCalled();
    const meetingsFromCalls = from.mock.calls.filter(([t]) => t === "meetings");
    expect(meetingsFromCalls.length).toBeGreaterThanOrEqual(2);

    // Attendee insert payload includes person id + meeting id
    expect(attendeesInsert).toHaveBeenCalledWith([
      { meeting_id: newMeetingId, person_id: personId },
    ]);

    // Default category insert
    expect(categoryInsert).toHaveBeenCalledWith({
      meeting_id: newMeetingId,
      name: "Uncategorized Items",
      position: 0,
    });

    expect(loadMeetingDetailMock).toHaveBeenCalledWith(
      expect.anything(),
      42,
      newMeetingId,
    );

    const body = await response.json();
    expect(body.meeting.id).toBe(newMeetingId);
  });

  it("copies template categories/items when template_id is provided, setting origin_meeting_id to the new meeting", async () => {
    const seriesId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const newMeetingId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const templateId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const templateCategoryId = "11111111-2222-4333-8444-555555555555";
    const templateItemId = "66666666-7777-4888-8999-aaaaaaaaaaaa";
    const newCategoryId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

    const seriesSelectSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: seriesId, name: "Weekly Sync" }, error: null });

    const maxNumberChain = makeChain({ data: [{ number: 3 }], error: null });

    const meetingInsertSingle = jest.fn().mockResolvedValueOnce({
      data: {
        id: newMeetingId,
        series_id: seriesId,
        number: 4,
        name: "Weekly Sync",
        project_id: 42,
      },
      error: null,
    });

    const attendeesInsert = jest.fn().mockResolvedValueOnce({ error: null });
    const defaultCategoryInsert = jest.fn().mockResolvedValueOnce({ error: null });

    const templateCategoriesChain = makeChain({
      data: [{ id: templateCategoryId, name: "Old Business", position: 0 }],
      error: null,
    });
    const templateItemsChain = makeChain({
      data: [
        {
          id: templateItemId,
          template_category_id: templateCategoryId,
          title: "Review budget",
          description: null,
          priority: "medium",
          position: 0,
        },
      ],
      error: null,
    });

    const copiedCategoryInsertSingle = jest.fn().mockResolvedValueOnce({
      data: { id: newCategoryId },
      error: null,
    });
    const copiedItemsInsert = jest.fn().mockResolvedValueOnce({ error: null });

    let meetingsCallCount = 0;
    let categoryInsertCallCount = 0;

    const from = jest.fn((table: string) => {
      if (table === "meeting_series") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: seriesSelectSingle,
              })),
            })),
          })),
          insert: jest.fn(),
        };
      }
      if (table === "meetings") {
        meetingsCallCount += 1;
        if (meetingsCallCount === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => maxNumberChain),
                })),
              })),
            })),
          };
        }
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: meetingInsertSingle,
            })),
          })),
        };
      }
      if (table === "meeting_attendees") {
        return { insert: attendeesInsert };
      }
      if (table === "meeting_categories") {
        categoryInsertCallCount += 1;
        if (categoryInsertCallCount === 1) {
          // default "Uncategorized Items" category
          return { insert: defaultCategoryInsert };
        }
        // copied template category
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: copiedCategoryInsertSingle,
            })),
          })),
        };
      }
      if (table === "meeting_items") {
        return { insert: copiedItemsInsert };
      }
      if (table === "meeting_template_categories") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => templateCategoriesChain),
            })),
          })),
        };
      }
      if (table === "meeting_template_items") {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => templateItemsChain),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });
    loadMeetingDetailMock.mockResolvedValue({
      meeting: { id: newMeetingId, status: "draft" },
      attendees: [],
      categories: [],
    });

    const response = await POST(
      makePostRequest("42", {
        name: "Weekly Sync",
        template_id: templateId,
      }),
      callParams("42"),
    );

    expect(response.status).toBe(201);
    expect(copiedItemsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        meeting_id: newMeetingId,
        category_id: newCategoryId,
        title: "Review budget",
        description: null,
        priority: "medium",
        position: 0,
        origin_meeting_id: newMeetingId,
        status: "open",
      }),
    ]);
  });

  it("retries the insert once after a series-number unique-constraint conflict (23505), then succeeds", async () => {
    const seriesId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const newMeetingId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

    const seriesSelectSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: seriesId, name: "Weekly Sync" }, error: null });

    const maxNumberChain = makeChain({ data: [{ number: 3 }], error: null });

    const meetingInsertSingle = jest
      .fn()
      // First attempt: races another concurrent submit and hits the unique
      // constraint on (series_id, number).
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      })
      // Retry attempt: succeeds after re-reading the max number.
      .mockResolvedValueOnce({
        data: {
          id: newMeetingId,
          series_id: seriesId,
          number: 5,
          name: "Weekly Sync",
          project_id: 42,
        },
        error: null,
      });

    const attendeesInsert = jest.fn().mockResolvedValueOnce({ error: null });
    const categoryInsert = jest.fn().mockResolvedValueOnce({ error: null });

    let meetingsInsertCallCount = 0;

    const from = jest.fn((table: string) => {
      if (table === "meeting_series") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: seriesSelectSingle,
              })),
            })),
          })),
          insert: jest.fn(),
        };
      }
      if (table === "meetings") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => maxNumberChain),
              })),
            })),
          })),
          insert: jest.fn(() => {
            meetingsInsertCallCount += 1;
            return {
              select: jest.fn(() => ({
                single: meetingInsertSingle,
              })),
            };
          }),
        };
      }
      if (table === "meeting_attendees") {
        return { insert: attendeesInsert };
      }
      if (table === "meeting_categories") {
        return { insert: categoryInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });
    loadMeetingDetailMock.mockResolvedValue({
      meeting: { id: newMeetingId, status: "draft" },
      attendees: [],
      categories: [],
    });

    const response = await POST(
      makePostRequest("42", { name: "Weekly Sync" }),
      callParams("42"),
    );

    expect(response.status).toBe(201);
    expect(meetingInsertSingle).toHaveBeenCalledTimes(2);
    expect(meetingsInsertCallCount).toBe(2);

    const body = await response.json();
    expect(body.meeting.id).toBe(newMeetingId);
  });

  it("cleans up the orphaned meeting row when the attendee insert fails after the meeting was created", async () => {
    const seriesId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const newMeetingId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const personId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    const seriesSelectSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: seriesId, name: "Weekly Sync" }, error: null });

    const maxNumberChain = makeChain({ data: [], error: null });

    const meetingInsertSingle = jest.fn().mockResolvedValueOnce({
      data: {
        id: newMeetingId,
        series_id: seriesId,
        number: 1,
        name: "Weekly Sync",
        project_id: 42,
      },
      error: null,
    });

    const attendeesInsert = jest
      .fn()
      .mockResolvedValueOnce({ error: { message: "insert failed" } });

    const meetingsDeleteEq = jest.fn().mockResolvedValueOnce({ error: null });

    let meetingsCallCount = 0;

    const from = jest.fn((table: string) => {
      if (table === "meeting_series") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: seriesSelectSingle,
              })),
            })),
          })),
          insert: jest.fn(),
        };
      }
      if (table === "meetings") {
        meetingsCallCount += 1;
        if (meetingsCallCount === 1) {
          // max-number lookup
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => maxNumberChain),
                })),
              })),
            })),
          };
        }
        if (meetingsCallCount === 2) {
          // insert new meeting
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: meetingInsertSingle,
              })),
            })),
          };
        }
        // cleanup delete after the attendee insert fails
        return {
          delete: jest.fn(() => ({
            eq: meetingsDeleteEq,
          })),
        };
      }
      if (table === "meeting_attendees") {
        return { insert: attendeesInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockResolvedValue({ from });

    const response = await POST(
      makePostRequest("42", {
        name: "Weekly Sync",
        attendee_person_ids: [personId],
      }),
      callParams("42"),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);

    // The orphaned meeting row must be cleaned up with the new meeting's id.
    expect(meetingsDeleteEq).toHaveBeenCalledWith("id", newMeetingId);
  });
});

describe("parseProjectId via GET (projectId <= 0)", () => {
  it("returns a 400-shaped error for projectId '0'", async () => {
    createClientMock.mockResolvedValue({ from: jest.fn() });

    const response = await GET(makeGetRequest("0"), callParams("0"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
