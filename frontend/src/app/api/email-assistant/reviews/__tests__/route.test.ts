process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createServiceClientMock =
  createServiceClient as jest.MockedFunction<typeof createServiceClient>;

function profileBuilder(isAdmin: boolean) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { is_admin: isAdmin },
      error: null,
    }),
  };
}

function reviewBuilder(data: unknown[] = []) {
  return {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({
        data,
        error: null,
      }),
    ),
  };
}

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("/api/email-assistant/reviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user",
      email: "admin@alleatogroup.com",
    });
  });

  it("returns the latest assistant review keyed by intake email id", async () => {
    const reviews = reviewBuilder([
      {
        id: "review-2",
        intake_email_id: 42,
        graph_message_id: "graph-42",
        mailbox_user_id: "bclymer@alleatogroup.com",
        assistant_action: "reply",
        assistant_priority: "high",
        assistant_score: 73,
        assistant_reason: "External sender asked Brandon for a response.",
        assistant_owner: "Brandon",
        assistant_risk: "Relationship follow-up.",
        assistant_evidence: "Please confirm.",
        review_outcome: "draft_copied",
        reviewer_note: "Good draft",
        draft_body: "Confirmed. Thank You\nBrandon Clymer",
        created_at: "2026-06-30T12:00:00+00:00",
      },
      {
        id: "review-1",
        intake_email_id: 42,
        graph_message_id: "graph-42",
        mailbox_user_id: "bclymer@alleatogroup.com",
        assistant_action: "watch",
        assistant_priority: "normal",
        assistant_score: 44,
        assistant_reason: "Earlier review",
        assistant_owner: "Assistant review",
        assistant_risk: "Context may matter later.",
        assistant_evidence: "Earlier evidence.",
        review_outcome: "watched",
        reviewer_note: null,
        draft_body: null,
        created_at: "2026-06-29T12:00:00+00:00",
      },
    ]);
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder(true);
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const service = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_assistant_reviews") return reviews;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );
    createServiceClientMock.mockReturnValue(service as never);

    const response = await GET(request("/api/email-assistant/reviews?emailId=42"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reviews.in).toHaveBeenCalledWith("intake_email_id", [42]);
    expect(body["42"]).toMatchObject({
      id: "review-2",
      intakeEmailId: 42,
      assistantAction: "reply",
      reviewOutcome: "draft_copied",
      draftBody: "Confirmed. Thank You\nBrandon Clymer",
    });
  });

  it("scopes non-admin review reads to the signed-in mailbox", async () => {
    getApiRouteUserMock.mockResolvedValue({
      id: "brandon-user",
      email: "bclymer@alleatogroup.com",
    });
    const reviews = reviewBuilder([]);
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder(false);
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const service = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_assistant_reviews") return reviews;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );
    createServiceClientMock.mockReturnValue(service as never);

    await GET(request("/api/email-assistant/reviews?emailId=42&emailId=43"));

    expect(reviews.in).toHaveBeenCalledWith("intake_email_id", [42, 43]);
    expect(reviews.eq).toHaveBeenCalledWith(
      "mailbox_user_id",
      "bclymer@alleatogroup.com",
    );
  });
});
