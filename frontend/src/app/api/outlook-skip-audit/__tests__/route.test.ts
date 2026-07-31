process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface QueryBuilderMock {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  then: jest.Mock;
}

function createQueryBuilder(result: QueryResult): QueryBuilderMock {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    returns: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    then: jest.fn((resolve: (value: QueryResult) => void) => resolve(result)),
  };

  return builder;
}

describe("/api/outlook-skip-audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "admin-user" });
  });

  it("loads skipped email audit rows with classifier fields", async () => {
    const auditBuilder = createQueryBuilder({
      data: [
        {
          id: "skip-1",
          graph_message_id: "graph-message-1",
          mailbox_user_id: "sync@example.com",
          internet_message_id: "<message-1@example.com>",
          conversation_id: "conversation-1",
          subject: "Accepted: Weekly Meeting",
          body_preview: "Accepted",
          from_name: "Sender",
          from_email: "sender@example.com",
          received_at: "2026-05-06T20:00:00.000Z",
          web_link: "https://outlook.office.com/mail/id/1",
          classification_action: "skip",
          classification_category: "calendar_rsvp",
          classification_confidence: 0.98,
          classification_reason:
            "Pure calendar response with no substantive typed content.",
          classification_signals: ["calendar_header", "rsvp_subject"],
          source_metadata: { source: "outlook" },
          first_seen_at: "2026-05-06T20:00:00.000Z",
          last_seen_at: "2026-05-07T20:00:00.000Z",
          created_at: "2026-05-06T20:00:00.000Z",
        },
      ],
      error: null,
    });
    const builders: Record<string, QueryBuilderMock[]> = {
      user_profiles: [
        createQueryBuilder({
          data: { is_admin: true },
          error: null,
        }),
      ],
      outlook_email_skip_audit: [auditBuilder],
    };

    const supabase = {
      from: jest.fn((table: string) => {
        const builder = builders[table]?.shift();
        if (!builder) {
          throw new Error(`Unexpected query for table: ${table}`);
        }
        return builder;
      }),
    };

    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await GET(
      new NextRequest("http://localhost/api/outlook-skip-audit"),
      { params: Promise.resolve({}) },
    );
    const body = (await response.json()) as Array<{
      id: string;
      graphMessageId: string;
      classificationCategory: string;
      classificationSignals: string[];
    }>;

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: "skip-1",
      graphMessageId: "graph-message-1",
      classificationCategory: "calendar_rsvp",
      classificationSignals: ["calendar_header", "rsvp_subject"],
    });
    expect(auditBuilder.order).toHaveBeenCalledWith("last_seen_at", {
      ascending: false,
    });
    expect(auditBuilder.limit).toHaveBeenCalledWith(200);
  });

  it("applies classifier category and mailbox filters", async () => {
    const auditBuilder = createQueryBuilder({
      data: [],
      error: null,
    });
    const builders: Record<string, QueryBuilderMock[]> = {
      user_profiles: [
        createQueryBuilder({
          data: { is_admin: true },
          error: null,
        }),
      ],
      outlook_email_skip_audit: [auditBuilder],
    };

    const supabase = {
      from: jest.fn((table: string) => {
        const builder = builders[table]?.shift();
        if (!builder) {
          throw new Error(`Unexpected query for table: ${table}`);
        }
        return builder;
      }),
    };

    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await GET(
      new NextRequest(
        "http://localhost/api/outlook-skip-audit?classification_category=calendar_rsvp&mailbox_user_id=sync@example.com&limit=999",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(auditBuilder.eq).toHaveBeenCalledWith(
      "classification_category",
      "calendar_rsvp",
    );
    expect(auditBuilder.eq).toHaveBeenCalledWith(
      "mailbox_user_id",
      "sync@example.com",
    );
    expect(auditBuilder.limit).toHaveBeenCalledWith(500);
  });
});
