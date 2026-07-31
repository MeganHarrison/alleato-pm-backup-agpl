process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createOutlookIntakeServiceClient: jest.fn(),
  createServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createOutlookIntakeServiceClientMock =
  createOutlookIntakeServiceClient as jest.MockedFunction<
    typeof createOutlookIntakeServiceClient
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

function queryBuilder(data: unknown[] = []) {
  return {
    select: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
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

describe("/api/emails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user",
      email: "admin@alleatogroup.com",
    });
  });

  it("reads the live Outlook intake table by default", async () => {
    const intakeQuery = queryBuilder([
      {
        id: 3577,
        project_id: 876,
        subject: "Re: Exol Morrisville PA",
        body: null,
        body_html: null,
        body_text: "Live intake body",
        from_name: "Steve Fischer",
        from_email: "steve.fischer@exol.com",
        to_list: ["bclymer@alleatogroup.com"],
        cc_list: [],
        received_at: "2026-06-26T05:17:14+00:00",
        has_attachments: true,
        graph_message_id: "graph-message-3577",
        mailbox_user_id: "bclymer@alleatogroup.com",
        conversation_id: "conversation-3577",
        created_at: "2026-06-26T05:18:00+00:00",
      },
    ]);
    const attachmentQuery = queryBuilder([{ intake_email_id: 3577 }]);
    const projectQuery = queryBuilder([
      { id: 876, name: "Exol Morrisville", project_number: "876" },
    ]);
    const reviewQuery = queryBuilder([
      {
        id: "11111111-1111-4111-8111-111111111111",
        intake_email_id: 3577,
        assistant_action: "reply",
        assistant_priority: "high",
        assistant_score: 79,
        assistant_reason: "External sender needs Brandon response.",
        assistant_owner: "Brandon",
        assistant_risk: "Relationship follow-up.",
        assistant_evidence: "Re: Exol Morrisville PA. Live intake body",
        review_outcome: "draft_edited",
        reviewer_note: "Tighter.",
        draft_body: "Thanks, I can confirm.",
        source_metadata: {
          feedbackProvidedAt: "2026-06-30T09:00:00.000Z",
          sandboxCategory: "Reply Needed",
          fieldFeedback: {
            draft: "incorrect",
          },
          projectAssignmentFeedback: {
            status: "correct",
            correctedProjectId: null,
            reasonSignals: ["subject_line"],
            reasonNote: null,
          },
        },
        created_at: "2026-06-30T08:59:00.000Z",
      },
    ]);
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder(true);
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const intake = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_intake") return intakeQuery;
        if (table === "outlook_email_intake_attachments") return attachmentQuery;
        throw new Error(`Unexpected intake table: ${table}`);
      }),
    };
    const service = {
      from: jest.fn((table: string) => {
        if (table === "projects") return projectQuery;
        if (table === "outlook_email_assistant_reviews") return reviewQuery;
        throw new Error(`Unexpected service table: ${table}`);
      }),
    };
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );
    createOutlookIntakeServiceClientMock.mockReturnValue(intake as never);
    createServiceClientMock.mockReturnValue(service as never);

    const response = await GET(request("/api/emails"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 3577,
      subject: "Re: Exol Morrisville PA",
      status: "Received",
      graph_message_id: "graph-message-3577",
      mailbox_user_id: "bclymer@alleatogroup.com",
      has_attachments: true,
      project: {
        id: 876,
        name: "Exol Morrisville",
        project_number: "876",
      },
      assistant_action: "reply",
      assistant_priority: "high",
      assistant_category: "Reply Needed",
      assistant_score: 79,
      assistant_rules_applied: expect.arrayContaining([
        "External sender",
        "Sent to Brandon",
        "Attachment present",
      ]),
      assistant_review: {
        reviewId: "11111111-1111-4111-8111-111111111111",
        reviewOutcome: "draft_edited",
        reviewerNote: "Tighter.",
        draftBody: "Thanks, I can confirm.",
        assistantCategory: "Reply Needed",
        feedbackProvidedAt: "2026-06-30T09:00:00.000Z",
        fieldFeedback: expect.objectContaining({
          draft: "incorrect",
        }),
        projectAssignmentFeedback: {
          status: "correct",
          correctedProjectId: null,
          reasonSignals: ["subject_line"],
          reasonNote: null,
        },
      },
    });
    expect(intake.from).toHaveBeenCalledWith("outlook_email_intake");
    expect(intakeQuery.select.mock.calls[0]?.[0]).toContain("graph_message_id");
    expect(supabase.from).not.toHaveBeenCalledWith("project_emails");
  });

  it("does not apply stale project_emails source filters when source=app is explicit", async () => {
    const intakeQuery = queryBuilder([]);
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder(true);
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const intake = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_intake") return intakeQuery;
        throw new Error(`Unexpected intake table: ${table}`);
      }),
    };
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );
    createOutlookIntakeServiceClientMock.mockReturnValue(intake as never);

    const response = await GET(request("/api/emails?source=app"));

    expect(response.status).toBe(200);
    expect(intake.from).toHaveBeenCalledWith("outlook_email_intake");
    expect(supabase.from).not.toHaveBeenCalledWith("project_emails");
    expect(intakeQuery.is).not.toHaveBeenCalledWith("graph_message_id", null);
    expect(intakeQuery.is).not.toHaveBeenCalledWith("mailbox_user_id", null);
    expect(intakeQuery.is).not.toHaveBeenCalledWith("conversation_id", null);
  });

  it("lets admins scope the shared email feed to Brandon's mailbox", async () => {
    const intakeQuery = queryBuilder([]);
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder(true);
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const intake = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_intake") return intakeQuery;
        throw new Error(`Unexpected intake table: ${table}`);
      }),
    };
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );
    createOutlookIntakeServiceClientMock.mockReturnValue(intake as never);

    const response = await GET(
      request("/api/emails?source=outlook&mailboxUserId=bclymer@alleatogroup.com"),
    );

    expect(response.status).toBe(200);
    expect(intakeQuery.eq).toHaveBeenCalledWith(
      "mailbox_user_id",
      "bclymer@alleatogroup.com",
    );
  });

  it("blocks non-admins from reading a different mailbox through the shared feed", async () => {
    getApiRouteUserMock.mockResolvedValue({
      id: "regular-user",
      email: "other@alleatogroup.com",
    });
    const intakeQuery = queryBuilder([]);
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder(false);
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const intake = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_intake") return intakeQuery;
        throw new Error(`Unexpected intake table: ${table}`);
      }),
    };
    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );
    createOutlookIntakeServiceClientMock.mockReturnValue(intake as never);

    const response = await GET(
      request("/api/emails?source=outlook&mailboxUserId=bclymer@alleatogroup.com"),
    );

    expect(response.status).toBe(403);
    expect(intakeQuery.eq).not.toHaveBeenCalled();
  });
});
