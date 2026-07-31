import { NextRequest } from "next/server";

import { GET } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { loadMeetingDetail } from "@/lib/meetings/server";
import { renderMeetingPdfBuffer } from "@/lib/meeting-pdf";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/meetings/server", () => ({
  loadMeetingDetail: jest.fn(),
}));

jest.mock("@/lib/meeting-pdf", () => ({
  renderMeetingPdfBuffer: jest.fn(),
}));

const getUserMock = getApiRouteUser as jest.Mock;
const createClientMock = createClient as jest.Mock;
const loadMeetingDetailMock = loadMeetingDetail as jest.Mock;
const renderMeetingPdfBufferMock = renderMeetingPdfBuffer as jest.Mock;

const MEETING_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ASSIGNEE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function makeGetRequest(projectId: string, meetingId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/${meetingId}/pdf`,
  );
}

function callParams(projectId: string, meetingId: string) {
  return { params: Promise.resolve({ projectId, meetingId }) };
}

function makeDetail(overrides?: Partial<ReturnType<typeof baseDetail>>) {
  return { ...baseDetail(), ...overrides };
}

function baseDetail() {
  return {
    meeting: {
      id: MEETING_ID,
      number: 7,
      name: "Weekly OAC",
      status: "minutes",
      mode: "minutes",
      meeting_date: "2026-06-01",
      start_time: "09:00:00",
      end_time: "10:00:00",
      location: "Trailer",
    },
    attendees: [],
    categories: [
      {
        id: "cat-1",
        name: "Old Business",
        items: [
          {
            id: "item-1",
            agenda_number: "1.1",
            title: "Review budget",
            description: "Discuss Q2 budget line items",
            assignee_person_id: ASSIGNEE_ID,
            due_date: "2026-06-10",
            status: "open",
            priority: "high",
            official_minutes: "Discussed and closed.",
          },
        ],
      },
    ],
  };
}

function makePeopleChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.in = jest.fn(async () => ({ error: null, ...result }));
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserMock.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
  });
});

describe("GET /api/projects/[projectId]/meetings/[meetingId]/pdf", () => {
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
    expect(renderMeetingPdfBufferMock).not.toHaveBeenCalled();
  });

  it("returns a PDF with the correct content-type and content-disposition on success", async () => {
    const peopleChain = makePeopleChain({
      data: [{ id: ASSIGNEE_ID, first_name: "Jane", last_name: "Doe" }],
    });
    const from = jest.fn((table: string) => {
      if (table === "people") return peopleChain;
      throw new Error(`Unexpected table ${table}`);
    });
    createClientMock.mockResolvedValue({ from });

    loadMeetingDetailMock.mockResolvedValueOnce(makeDetail());
    renderMeetingPdfBufferMock.mockResolvedValueOnce(Buffer.from("%PDF-1.4 fake"));

    const response = await GET(
      makeGetRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="meeting-7.pdf"',
    );

    expect(renderMeetingPdfBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeNamesById: { [ASSIGNEE_ID]: "Jane Doe" },
      }),
    );

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(bytes).toString("utf-8")).toContain("%PDF");
  });

  it("skips the people lookup when no agenda items have an assignee", async () => {
    const from = jest.fn((table: string) => {
      throw new Error(`Unexpected table ${table}`);
    });
    createClientMock.mockResolvedValue({ from });

    loadMeetingDetailMock.mockResolvedValueOnce(
      makeDetail({
        categories: [
          {
            id: "cat-1",
            name: "Old Business",
            items: [
              {
                id: "item-1",
                agenda_number: "1.1",
                title: "Review budget",
                description: null,
                assignee_person_id: null,
                due_date: null,
                status: "open",
                priority: null,
                official_minutes: null,
              },
            ],
          },
        ],
      }),
    );
    renderMeetingPdfBufferMock.mockResolvedValueOnce(Buffer.from("%PDF-1.4 fake"));

    const response = await GET(
      makeGetRequest("42", MEETING_ID),
      callParams("42", MEETING_ID),
    );

    expect(response.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
  });
});
