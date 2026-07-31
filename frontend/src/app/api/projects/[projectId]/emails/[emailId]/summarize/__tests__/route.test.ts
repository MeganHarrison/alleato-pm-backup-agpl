process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { generateText } from "ai";
import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

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

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const generateTextMock = generateText as jest.MockedFunction<typeof generateText>;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

function emailBuilder(result: QueryResult) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
}

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

function request() {
  return new NextRequest(
    "http://localhost/api/projects/876/emails/42/summarize",
    { method: "POST" },
  );
}

function params() {
  return { params: Promise.resolve({ projectId: "876", emailId: "42" }) };
}

describe("/api/projects/[projectId]/emails/[emailId]/summarize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user",
      email: "admin@alleatogroup.com",
    });
    generateTextMock.mockResolvedValue({
      text: "  Vendor requests a signed COI before Friday.  ",
      usage: undefined,
      finishReason: "stop",
      warnings: undefined,
      request: {},
      response: {
        id: "response-id",
        timestamp: new Date("2026-06-22T05:55:00Z"),
        modelId: "gpt-4.1-mini",
        messages: [],
      },
    } as Awaited<ReturnType<typeof generateText>>);
  });

  it("returns a trimmed AI summary for an accessible email", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder(true);
        if (table === "project_emails")
          return emailBuilder({
            data: {
              subject: "COI request",
              from_name: "Vendor",
              from_email: "vendor@example.com",
              body_text: "Please send a signed certificate of insurance by Friday.",
              body: null,
              body_html: null,
            },
            error: null,
          });
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(request(), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toBe("Vendor requests a signed COI before Friday.");
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("returns 404 without calling the model when the email is not accessible", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder(true);
        if (table === "project_emails")
          return emailBuilder({ data: null, error: null });
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(request(), params());

    expect(response.status).toBe(404);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("skips the model when there is no body to summarize", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder(true);
        if (table === "project_emails")
          return emailBuilder({
            data: {
              subject: "(empty)",
              from_name: null,
              from_email: null,
              body_text: null,
              body: null,
              body_html: null,
            },
            error: null,
          });
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(request(), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toContain("no body content");
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});
