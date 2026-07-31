process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { PATCH } from "../route";
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
  update: jest.Mock;
  single: jest.Mock;
  then: jest.Mock;
}

function createQueryBuilder(result: QueryResult): QueryBuilderMock {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    then: jest.fn((resolve: (value: QueryResult) => void) => resolve(result)),
  };

  return builder;
}

describe("/api/email-filter-rules/[ruleId] PATCH", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
  });

  it("updates rule match criteria and normalizes sender fields to lowercase", async () => {
    const profileBuilder = createQueryBuilder({
      data: { is_admin: true },
      error: null,
    });
    const existingRuleBuilder = createQueryBuilder({
      data: {
        sender_pattern: "old@example.com",
        sender_domain: null,
        subject_pattern: null,
        body_pattern: null,
      },
      error: null,
    });
    const updateBuilder = createQueryBuilder({
      data: {
        id: "rule-1",
        sender_pattern: null,
        sender_domain: "notification.capitalone.com",
        subject_pattern: "%statement%",
      },
      error: null,
    });

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder;
        if (table === "email_filter_rules") {
          if (existingRuleBuilder.eq.mock.calls.length === 0) return existingRuleBuilder;
          return updateBuilder;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await PATCH(
      new NextRequest("http://localhost/api/email-filter-rules/rule-1", {
        method: "PATCH",
        body: JSON.stringify({
          senderPattern: null,
          senderDomain: "Notification.CapitalOne.com",
          subjectPattern: "%statement%",
        }),
      }),
      { params: Promise.resolve({ ruleId: "rule-1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sender_pattern: null,
        sender_domain: "notification.capitalone.com",
        subject_pattern: "%statement%",
      }),
    );
  });

  it("rejects updates that would remove every match criterion", async () => {
    const profileBuilder = createQueryBuilder({
      data: { is_admin: true },
      error: null,
    });
    const existingRuleBuilder = createQueryBuilder({
      data: {
        sender_pattern: "sender@example.com",
        sender_domain: null,
        subject_pattern: null,
        body_pattern: null,
      },
      error: null,
    });
    const updateBuilder = createQueryBuilder({
      data: null,
      error: null,
    });

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder;
        if (table === "email_filter_rules") {
          if (existingRuleBuilder.eq.mock.calls.length === 0) return existingRuleBuilder;
          return updateBuilder;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await PATCH(
      new NextRequest("http://localhost/api/email-filter-rules/rule-1", {
        method: "PATCH",
        body: JSON.stringify({
          senderPattern: null,
          senderDomain: null,
          subjectPattern: null,
          bodyPattern: null,
        }),
      }),
      { params: Promise.resolve({ ruleId: "rule-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "INVALID_PAYLOAD",
      error_message:
        "At least one of senderPattern, senderDomain, subjectPattern, or bodyPattern must be set.",
    });
    expect(updateBuilder.update).not.toHaveBeenCalled();
  });
});
