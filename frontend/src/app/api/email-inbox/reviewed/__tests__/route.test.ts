process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";
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
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<typeof createServiceClient>;
const createOutlookIntakeServiceClientMock =
  createOutlookIntakeServiceClient as jest.MockedFunction<typeof createOutlookIntakeServiceClient>;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface QueryBuilderMock {
  select: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
  update: jest.Mock;
  then: jest.Mock;
}

function createQueryBuilder(result: QueryResult): QueryBuilderMock {
  const builder: QueryBuilderMock = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    update: jest.fn().mockReturnThis(),
    then: jest.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject)),
  };

  return builder;
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/email-inbox/reviewed", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function getRequest() {
  return new NextRequest("http://localhost/api/email-inbox/reviewed");
}

describe("/api/email-inbox/reviewed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "reviewer-user",
      email: "bclymer@alleatogroup.com",
    });
  });

  it("loads non-admin reviewed feedback only for the signed-in mailbox and includes draft body", async () => {
    const profileBuilder = createQueryBuilder({
      data: { is_admin: false },
      error: null,
    });
    const reviewBuilder = createQueryBuilder({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          intake_email_id: 42,
          assistant_action: "reply",
          assistant_priority: "high",
          review_outcome: "draft_edited",
          reviewer_note: "Make it more direct.",
          draft_body: "Updated draft",
          assistant_reason: "External sender asked Brandon for a reply.",
          created_at: "2026-06-17T05:45:00.000Z",
          graph_message_id: "graph-42",
          mailbox_user_id: "bclymer@alleatogroup.com",
          source_metadata: {
            feedbackProvidedAt: "2026-06-30T09:00:00.000Z",
            sandboxCategory: "Reply Needed",
            projectAssignmentFeedback: {
              status: "incorrect",
              correctedProjectId: 25125,
              reasonSignals: ["message_body"],
              reasonNote: "The email body named the job directly.",
            },
          },
        },
      ],
      error: null,
    });
    const intakeBuilder = createQueryBuilder({
      data: [
        {
          id: 42,
          subject: "RE: ULTA update needed.",
          from_name: "Walter Allen",
          from_email: "wallen@ulta.com",
          received_at: "2026-06-17T05:00:00.000Z",
          project_id: null,
          source_metadata: { _inbox: { starred: true, tags: ["urgent"] } },
          body_html: null,
          body_text: "Can you confirm?",
          body: null,
          web_link: "https://outlook.office.com/mail/42",
        },
      ],
      error: null,
    });

    const authClient = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder;
        throw new Error(`Unexpected auth table: ${table}`);
      }),
    };
    const appClient = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_assistant_reviews") return reviewBuilder;
        throw new Error(`Unexpected app table: ${table}`);
      }),
    };
    const intakeClient = {
      from: jest.fn((table: string) => {
        if (table === "outlook_email_intake") return intakeBuilder;
        throw new Error(`Unexpected intake table: ${table}`);
      }),
    };

    createClientMock.mockResolvedValue(authClient as Awaited<ReturnType<typeof createClient>>);
    createServiceClientMock.mockReturnValue(appClient as never);
    createOutlookIntakeServiceClientMock.mockReturnValue(intakeClient as never);

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reviewBuilder.eq).toHaveBeenCalledWith("mailbox_user_id", "bclymer@alleatogroup.com");
    expect(body).toEqual([
      expect.objectContaining({
        reviewId: "11111111-1111-4111-8111-111111111111",
        id: 42,
        assistantAction: "reply",
        assistantPriority: "high",
        reviewerNote: "Make it more direct.",
        draftBody: "Updated draft",
        assistantCategory: "Reply Needed",
        feedbackProvidedAt: "2026-06-30T09:00:00.000Z",
        projectAssignmentFeedback: {
          status: "incorrect",
          correctedProjectId: 25125,
          reasonSignals: ["message_body"],
          reasonNote: "The email body named the job directly.",
        },
      }),
    ]);
  });

  it("updates reviewed feedback inline and stores cleared text as null", async () => {
    const profileBuilder = createQueryBuilder({
      data: { is_admin: false },
      error: null,
    });
    const existingReviewBuilder = createQueryBuilder({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        mailbox_user_id: "bclymer@alleatogroup.com",
      },
      error: null,
    });
    const updatedReviewBuilder = createQueryBuilder({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        intake_email_id: 42,
        assistant_action: "watch",
        assistant_priority: "normal",
        review_outcome: "skipped",
        reviewer_note: null,
        draft_body: null,
        source_metadata: {
          feedbackProvidedAt: "2026-06-30T09:00:00.000Z",
          sandboxCategory: "FYI",
          projectAssignmentFeedback: {
            status: "unreviewed",
            correctedProjectId: null,
            reasonSignals: [],
            reasonNote: null,
          },
        },
        updated_at: "2026-06-30T09:00:00.000Z",
      },
      error: null,
    });
    const appClient = {
      from: jest.fn(() => existingReviewBuilder),
    };

    createClientMock.mockResolvedValue({
      from: jest.fn(() => profileBuilder),
    } as Awaited<ReturnType<typeof createClient>>);
    createServiceClientMock.mockReturnValue(appClient as never);

    existingReviewBuilder.update.mockReturnValue(updatedReviewBuilder);

    const response = await PATCH(
      patchRequest({
        reviewId: "11111111-1111-4111-8111-111111111111",
        assistantAction: "watch",
        assistantPriority: "normal",
        assistantCategory: "FYI",
        reviewOutcome: "skipped",
        reviewerNote: "   ",
        draftBody: "",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(existingReviewBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        assistant_action: "watch",
        assistant_priority: "normal",
        review_outcome: "skipped",
        reviewer_note: null,
        draft_body: null,
        source_metadata: expect.objectContaining({
          feedbackProvidedAt: expect.any(String),
          feedbackProvidedBy: "bclymer@alleatogroup.com",
          sandboxCategory: "FYI",
          projectAssignmentFeedback: {
            status: "unreviewed",
            correctedProjectId: null,
            reasonSignals: [],
            reasonNote: null,
          },
        }),
      }),
    );
    expect(body).toEqual(
      expect.objectContaining({
        reviewId: "11111111-1111-4111-8111-111111111111",
        assistantAction: "watch",
        assistantPriority: "normal",
        assistantCategory: "FYI",
        reviewOutcome: "skipped",
        reviewerNote: null,
        draftBody: null,
        feedbackProvidedAt: "2026-06-30T09:00:00.000Z",
      }),
    );
  });

  it("records incorrect project assignment feedback and updates the intake email project", async () => {
    const profileBuilder = createQueryBuilder({
      data: { is_admin: false },
      error: null,
    });
    const existingReviewBuilder = createQueryBuilder({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        mailbox_user_id: "bclymer@alleatogroup.com",
        intake_email_id: 42,
        source_metadata: {},
      },
      error: null,
    });
    const updatedReviewBuilder = createQueryBuilder({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        intake_email_id: 42,
        assistant_action: "reply",
        assistant_priority: "high",
        review_outcome: "draft_edited",
        reviewer_note: "Wrong project.",
        draft_body: "Updated draft",
        source_metadata: {
          feedbackProvidedAt: "2026-06-30T09:00:00.000Z",
          sandboxCategory: "Reply Needed",
          projectAssignmentFeedback: {
            status: "incorrect",
            correctedProjectId: 25125,
            reasonSignals: ["subject_line", "sender"],
            reasonNote: "Sender and subject both referenced the project.",
          },
        },
        updated_at: "2026-06-30T09:00:00.000Z",
      },
      error: null,
    });
    const intakeUpdateBuilder = createQueryBuilder({
      data: null,
      error: null,
    });

    createClientMock.mockResolvedValue({
      from: jest.fn(() => profileBuilder),
    } as Awaited<ReturnType<typeof createClient>>);
    createServiceClientMock.mockReturnValue({
      from: jest.fn(() => existingReviewBuilder),
    } as never);
    createOutlookIntakeServiceClientMock.mockReturnValue({
      from: jest.fn(() => intakeUpdateBuilder),
    } as never);

    existingReviewBuilder.update.mockReturnValue(updatedReviewBuilder);

    const response = await PATCH(
      patchRequest({
        reviewId: "11111111-1111-4111-8111-111111111111",
        assistantAction: "reply",
        assistantPriority: "high",
        assistantCategory: "Reply Needed",
        reviewOutcome: "draft_edited",
        reviewerNote: "Wrong project.",
        draftBody: "Updated draft",
        projectAssignment: {
          status: "incorrect",
          correctedProjectId: 25125,
          reasonSignals: ["subject_line", "sender"],
          reasonNote: "Sender and subject both referenced the project.",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(intakeUpdateBuilder.update).toHaveBeenCalledWith({
      project_id: 25125,
    });
    expect(intakeUpdateBuilder.eq).toHaveBeenCalledWith("id", 42);
    expect(existingReviewBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        source_metadata: expect.objectContaining({
          sandboxCategory: "Reply Needed",
          projectAssignmentFeedback: {
            status: "incorrect",
            correctedProjectId: 25125,
            reasonSignals: ["subject_line", "sender"],
            reasonNote: "Sender and subject both referenced the project.",
          },
        }),
      }),
    );
    expect(body).toEqual(
      expect.objectContaining({
        assistantAction: "reply",
        assistantPriority: "high",
        assistantCategory: "Reply Needed",
        projectAssignmentFeedback: {
          status: "incorrect",
          correctedProjectId: 25125,
          reasonSignals: ["subject_line", "sender"],
          reasonNote: "Sender and subject both referenced the project.",
        },
      }),
    );
  });

  it("rejects non-admin edits for a different mailbox review", async () => {
    const profileBuilder = createQueryBuilder({
      data: { is_admin: false },
      error: null,
    });
    const existingReviewBuilder = createQueryBuilder({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        mailbox_user_id: "other@alleatogroup.com",
      },
      error: null,
    });

    createClientMock.mockResolvedValue({
      from: jest.fn(() => profileBuilder),
    } as Awaited<ReturnType<typeof createClient>>);
    createServiceClientMock.mockReturnValue({
      from: jest.fn(() => existingReviewBuilder),
    } as never);

    const response = await PATCH(
      patchRequest({
        reviewId: "11111111-1111-4111-8111-111111111111",
        reviewOutcome: "watched",
      }),
    );

    expect(response.status).toBe(403);
    expect(existingReviewBuilder.update).not.toHaveBeenCalled();
  });
});
