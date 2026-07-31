process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { generateText } from "ai";
import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";

jest.mock("ai", () => ({
  generateText: jest.fn(),
}));

jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn((modelId: string) => ({ modelId })),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createOutlookIntakeServiceClient: jest.fn(),
  createServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createServiceClientMock =
  createServiceClient as jest.MockedFunction<typeof createServiceClient>;
const createOutlookIntakeServiceClientMock =
  createOutlookIntakeServiceClient as jest.MockedFunction<
    typeof createOutlookIntakeServiceClient
  >;
const generateTextMock = generateText as jest.MockedFunction<typeof generateText>;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface QueryBuilderMock {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
}

function createQueryBuilder(result: QueryResult): QueryBuilderMock {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/email-inbox/42/draft-reply", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("/api/email-inbox/[emailId]/draft-reply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "reviewer-user",
      email: "bclymer@alleatogroup.com",
    });
    generateTextMock.mockResolvedValue({
      text: "That works.\n\nThank You\nBrandon Clymer",
      usage: undefined,
      finishReason: "stop",
      warnings: undefined,
      request: {},
      response: {
        id: "response-id",
        timestamp: new Date("2026-06-17T05:55:00Z"),
        modelId: "gpt-4.1-mini",
        messages: [],
      },
    } as Awaited<ReturnType<typeof generateText>>);
    createServiceClientMock.mockReturnValue({ from: jest.fn() } as never);
    createOutlookIntakeServiceClientMock.mockReturnValue(
      { from: jest.fn() } as never,
    );
  });

  it("injects bounded Brandon review learnings into the draft system prompt", async () => {
    const reviewBuilder = createQueryBuilder({
      data: [
        {
          review_outcome: "draft_copied",
          draft_body: "That works for us. See you tomorrow at 3pm.\n\nThank You\nBrandon Clymer",
          assistant_action: "reply",
          assistant_priority: "high",
          reviewer_note: null,
          created_at: "2026-06-17T05:00:00Z",
        },
      ],
      error: null,
    });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_assistant_reviews") return reviewBuilder;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(
      request({
        subject: "Meeting tomorrow",
        fromName: "Lauren",
        fromEmail: "lauren@example.com",
        bodyText: "Does 3pm tomorrow still work?",
        tone: "concise",
      }),
      { params: Promise.resolve({ emailId: "42" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.learning).toMatchObject({
      reviewCount: 1,
      draftCount: 1,
      guidance: expect.arrayContaining([
        "Keep Brandon replies concise; recent approved drafts are usually under 55 words.",
        'Prefer Brandon-style closing with "Thank You" when a sign-off is needed.',
      ]),
      guidanceItems: expect.arrayContaining([
        expect.objectContaining({
          id: "thank_you_closing",
          text: 'Prefer Brandon-style closing with "Thank You" when a sign-off is needed.',
        }),
      ]),
    });
    expect(reviewBuilder.eq).toHaveBeenCalledWith(
      "mailbox_user_id",
      "bclymer@alleatogroup.com",
    );
    expect(reviewBuilder.limit).toHaveBeenCalledWith(25);
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining("Brandon review learnings"),
      }),
    );
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining('"Thank You"'),
      }),
    );
  });

  it("fails loudly when the review learning lookup fails", async () => {
    const reviewBuilder = createQueryBuilder({
      data: null,
      error: { message: "permission denied for table outlook_email_assistant_reviews" },
    });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_assistant_reviews") return reviewBuilder;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(
      request({
        subject: "Meeting tomorrow",
        bodyText: "Does 3pm tomorrow still work?",
      }),
      { params: Promise.resolve({ emailId: "42" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error_message).toContain("Failed to load Brandon email review learnings");
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});
