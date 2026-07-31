process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createOutlookIntakeServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createOutlookIntakeServiceClientMock =
  createOutlookIntakeServiceClient as jest.MockedFunction<
    typeof createOutlookIntakeServiceClient
  >;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface QueryBuilderMock {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
}

function createQueryBuilder(result: QueryResult): QueryBuilderMock {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
  };

  return builder;
}

function request(body: unknown) {
  return new NextRequest(
    "http://localhost/api/email-inbox/42/assistant-review",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("/api/email-inbox/[emailId]/assistant-review", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "reviewer-user",
      email: "bclymer@alleatogroup.com",
    });
  });

  it("inserts a review event for an authorized mailbox user", async () => {
    const profileBuilder = createQueryBuilder({
      data: { is_admin: false },
      error: null,
    });
    const emailBuilder = createQueryBuilder({
      data: {
        id: 42,
        graph_message_id: "graph-42",
        mailbox_user_id: "bclymer@alleatogroup.com",
      },
      error: null,
    });
    const reviewBuilder = createQueryBuilder({
      data: {
        id: "review-1",
        intake_email_id: 42,
        review_outcome: "draft_copied",
        created_at: "2026-06-17T05:45:00.000Z",
      },
      error: null,
    });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder;
        if (table === "outlook_email_intake") return emailBuilder;
        if (table === "outlook_email_assistant_reviews") return reviewBuilder;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );
    createOutlookIntakeServiceClientMock.mockReturnValue(supabase as never);

    const response = await POST(
      request({
        assistantAction: "reply",
        assistantPriority: "high",
        assistantCategory: "Reply Needed",
        assistantScore: 72,
        reviewOutcome: "draft_copied",
        draftBody: "That works. Thank You\nBrandon Clymer",
        assistantReason: "External sender is asking Brandon for a response.",
      }),
      { params: Promise.resolve({ emailId: "42" }) },
    );

    expect(response.status).toBe(201);
    expect(reviewBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        intake_email_id: 42,
        graph_message_id: "graph-42",
        mailbox_user_id: "bclymer@alleatogroup.com",
        reviewer_id: "reviewer-user",
        assistant_action: "reply",
        assistant_priority: "high",
        draft_body: "That works. Thank You\nBrandon Clymer",
        review_outcome: "draft_copied",
        source_metadata: expect.objectContaining({
          feedbackProvidedAt: expect.any(String),
          feedbackProvidedBy: "bclymer@alleatogroup.com",
          sandboxCategory: "Reply Needed",
        }),
      }),
    );
  });

  it("records incorrect project feedback and updates the intake assignment when creating feedback", async () => {
    const profileBuilder = createQueryBuilder({
      data: { is_admin: false },
      error: null,
    });
    const emailBuilder = createQueryBuilder({
      data: {
        id: 42,
        graph_message_id: "graph-42",
        mailbox_user_id: "bclymer@alleatogroup.com",
      },
      error: null,
    });
    const assignmentBuilder = createQueryBuilder({
      data: null,
      error: null,
    });
    const reviewBuilder = createQueryBuilder({
      data: {
        id: "review-1",
        intake_email_id: 42,
        review_outcome: "skipped",
        created_at: "2026-06-17T05:45:00.000Z",
      },
      error: null,
    });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder;
        if (table === "outlook_email_assistant_reviews") return reviewBuilder;
        throw new Error(`Unexpected app table: ${table}`);
      }),
    };
    const intake = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_intake") return emailBuilder;
        throw new Error(`Unexpected intake table: ${table}`);
      }),
    };

    emailBuilder.update.mockReturnValue(assignmentBuilder);
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );
    createOutlookIntakeServiceClientMock.mockReturnValue(intake as never);

    const response = await POST(
      request({
        assistantAction: "watch",
        assistantPriority: "normal",
        assistantCategory: "Watching",
        reviewOutcome: "skipped",
        projectAssignment: {
          status: "incorrect",
          correctedProjectId: 25125,
          reasonSignals: ["subject_line", "sender"],
          reasonNote: "Sender matched the known project contact.",
        },
      }),
      { params: Promise.resolve({ emailId: "42" }) },
    );

    expect(response.status).toBe(201);
    expect(emailBuilder.update).toHaveBeenCalledWith({ project_id: 25125 });
    expect(assignmentBuilder.eq).toHaveBeenCalledWith("id", 42);
    expect(reviewBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_metadata: expect.objectContaining({
          sandboxCategory: "Watching",
          projectAssignmentFeedback: {
            status: "incorrect",
            correctedProjectId: 25125,
            reasonSignals: ["subject_line", "sender"],
            reasonNote: "Sender matched the known project contact.",
          },
        }),
      }),
    );
  });

  it("rejects draft outcomes without draft body before insert", async () => {
    const supabase = {
      from: jest.fn(() => {
        throw new Error("No database query expected for invalid payload");
      }),
    };

    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );
    createOutlookIntakeServiceClientMock.mockReturnValue(supabase as never);

    const response = await POST(
      request({
        assistantAction: "reply",
        assistantPriority: "high",
        reviewOutcome: "draft_edited",
        draftBody: " ",
      }),
      { params: Promise.resolve({ emailId: "42" }) },
    );

    expect(response.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
