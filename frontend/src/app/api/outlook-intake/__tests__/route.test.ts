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

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface QueryBuilderMock {
  select: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  or: jest.Mock;
  contains: jest.Mock;
  in: jest.Mock;
  is: jest.Mock;
  order: jest.Mock;
  returns: jest.Mock;
  single: jest.Mock;
  then: jest.Mock;
}

function createQueryBuilder(result: QueryResult): QueryBuilderMock {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    returns: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    then: jest.fn((resolve: (value: QueryResult) => void) => resolve(result)),
  };

  return builder;
}

function makeIntakeRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    graph_message_id: `graph-message-${index + 1}`,
    mailbox_user_id: "sync@example.com",
    project_id: null,
    document_metadata_id: `document-${index + 1}`,
    conversation_id: `conversation-${index + 1}`,
    subject: `Email ${index + 1}`,
    from_name: "Sender",
    from_email: "sender@example.com",
    to_list: ["sync@example.com"],
    match_status: "matched",
    assignment_method: "subject_match",
    assignment_confidence: 0.9,
    received_at: "2026-05-06T20:00:00.000Z",
    has_attachments: false,
    web_link: null,
    created_at: "2026-05-06T20:00:00.000Z",
    projects: null,
    outlook_email_intake_attachments: [],
    source_metadata: {
      user_tags: ["automated"],
      plane_intake: {
        decision: "pending",
        snoozed_till: "2026-08-01T13:00:00.000Z",
        duplicate_task_id: null,
        accepted_task_id: null,
        resolved_at: null,
        updated_at: "2026-07-31T13:00:00.000Z",
      },
      intake_classification: {
        action: "quarantine",
        category: "calendar_low_value",
        confidence: 0.84,
        reason:
          "Calendar-related message has only low-value or ambiguous content.",
        signals: ["calendar_header"],
      },
    },
  }));
}

describe("/api/outlook-intake", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "admin-user" });
  });

  it("loads many intake rows without embedding document_metadata in the intake query", async () => {
    const intakeRows = makeIntakeRows(60);
    const documentRows = intakeRows.map((row) => ({
      id: row.document_metadata_id,
      status: "embedded",
    }));
    const intakeBuilder = createQueryBuilder({
      data: intakeRows,
      error: null,
    });
    const builders: Record<string, QueryBuilderMock[]> = {
      user_profiles: [
        createQueryBuilder({
          data: { is_admin: true },
          error: null,
        }),
      ],
      outlook_email_intake: [intakeBuilder],
      document_metadata: [
        createQueryBuilder({
          data: documentRows.slice(0, 25),
          error: null,
        }),
        createQueryBuilder({
          data: documentRows.slice(25, 50),
          error: null,
        }),
        createQueryBuilder({
          data: documentRows.slice(50),
          error: null,
        }),
      ],
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
    createServiceClientMock.mockReturnValue(supabase as never);
    createOutlookIntakeServiceClientMock.mockReturnValue(supabase as never);

    const response = await GET(
      new NextRequest("http://localhost/api/outlook-intake"),
      { params: Promise.resolve({}) },
    );
    const body = (await response.json()) as Array<{
      id: number;
      documentMetadataId: string | null;
      documentStatus: string | null;
    }>;

    expect(response.status).toBe(200);
    expect(body).toHaveLength(60);
    expect(body[0]).toMatchObject({
      id: 1,
      documentMetadataId: "document-1",
      documentStatus: "embedded",
      intakeClassification: {
        action: "quarantine",
        category: "calendar_low_value",
      },
      planeIntakeState: {
        decision: "pending",
        snoozedTill: "2026-08-01T13:00:00.000Z",
        duplicateTaskId: null,
        acceptedTaskId: null,
        resolvedAt: null,
        updatedAt: "2026-07-31T13:00:00.000Z",
      },
    });

    expect(supabase.from).toHaveBeenCalledWith("outlook_email_intake");
    expect(supabase.from).toHaveBeenCalledWith("document_metadata");
    expect(
      supabase.from.mock.calls.filter(
        ([table]) => table === "document_metadata",
      ),
    ).toHaveLength(3);

    const intakeSelect = intakeBuilder.select.mock.calls[0]?.[0] ?? "";
    expect(intakeSelect).not.toMatch(/\bdocument_metadata\s*\(/);
  });

  it("excludes ignored intake rows from the default list", async () => {
    const intakeBuilder = createQueryBuilder({
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
      outlook_email_intake: [intakeBuilder],
      document_metadata: [],
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
    createServiceClientMock.mockReturnValue(supabase as never);
    createOutlookIntakeServiceClientMock.mockReturnValue(supabase as never);

    const response = await GET(
      new NextRequest("http://localhost/api/outlook-intake"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(intakeBuilder.neq).toHaveBeenCalledWith("match_status", "ignored");
    expect(intakeBuilder.eq).not.toHaveBeenCalledWith(
      "match_status",
      expect.any(String),
    );
    expect(intakeBuilder.eq).not.toHaveBeenCalledWith(
      "project_id",
      expect.any(Number),
    );
  });

  it("allows explicitly filtering to ignored intake rows", async () => {
    const intakeBuilder = createQueryBuilder({
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
      outlook_email_intake: [intakeBuilder],
      document_metadata: [],
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
    createServiceClientMock.mockReturnValue(supabase as never);
    createOutlookIntakeServiceClientMock.mockReturnValue(supabase as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/outlook-intake?match_status=ignored",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(intakeBuilder.eq).toHaveBeenCalledWith("match_status", "ignored");
    expect(intakeBuilder.neq).not.toHaveBeenCalledWith(
      "match_status",
      "ignored",
    );
  });

  it("scopes an authorized admin request to one validated project", async () => {
    const intakeBuilder = createQueryBuilder({
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
      outlook_email_intake: [intakeBuilder],
      document_metadata: [],
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
    createServiceClientMock.mockReturnValue(supabase as never);
    createOutlookIntakeServiceClientMock.mockReturnValue(supabase as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/outlook-intake?project_id=31",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(intakeBuilder.eq).toHaveBeenCalledWith("project_id", 31);
  });

  it.each(["", "0", "-1", "31.5", "31oops", "9007199254740992"])(
    "rejects invalid project_id=%s before querying Outlook Intake",
    async (projectId) => {
      const profileBuilder = createQueryBuilder({
        data: { is_admin: true },
        error: null,
      });
      const supabase = {
        from: jest.fn((table: string) => {
          if (table === "user_profiles") return profileBuilder;
          throw new Error(`Unexpected query for table: ${table}`);
        }),
      };

      createClientMock.mockResolvedValue(
        supabase as Awaited<ReturnType<typeof createClient>>,
      );

      const response = await GET(
        new NextRequest(
          `http://localhost/api/outlook-intake?project_id=${encodeURIComponent(projectId)}`,
        ),
        { params: Promise.resolve({}) },
      );
      const body = (await response.json()) as {
        error_code: string;
        error_message: string;
      };

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        error_code: "VALIDATION_ERROR",
        error_message: "project_id must be a positive integer.",
      });
      expect(createOutlookIntakeServiceClientMock).not.toHaveBeenCalled();
    },
  );

  it("rejects unauthenticated requests before querying Outlook Intake", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    createClientMock.mockResolvedValue({ from: jest.fn() } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/outlook-intake?project_id=31",
      ),
      { params: Promise.resolve({}) },
    );
    const body = (await response.json()) as {
      error_code: string;
      error_message: string;
    };

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      error_code: "AUTH_EXPIRED",
      error_message: "Authentication required.",
    });
    expect(createOutlookIntakeServiceClientMock).not.toHaveBeenCalled();
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin members before constructing either service client", async () => {
    const profileBuilder = createQueryBuilder({
      data: { is_admin: false },
      error: null,
    });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileBuilder;
        throw new Error(`Unexpected query for table: ${table}`);
      }),
    };

    createClientMock.mockResolvedValue(
      supabase as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await GET(
      new NextRequest(
        "http://localhost/api/outlook-intake?project_id=31",
      ),
      { params: Promise.resolve({}) },
    );
    const body = (await response.json()) as {
      error_code: string;
      error_message: string;
    };

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error_code: "FORBIDDEN",
      error_message: "Admin access required.",
    });
    expect(createOutlookIntakeServiceClientMock).not.toHaveBeenCalled();
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("filters by intake classification action", async () => {
    const intakeBuilder = createQueryBuilder({
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
      outlook_email_intake: [intakeBuilder],
      document_metadata: [],
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
    createServiceClientMock.mockReturnValue(supabase as never);
    createOutlookIntakeServiceClientMock.mockReturnValue(supabase as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/outlook-intake?classification_action=quarantine",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(intakeBuilder.eq).toHaveBeenCalledWith(
      "source_metadata->intake_classification->>action",
      "quarantine",
    );
  });

  it("filters by sender, recipient, tag, and triage action", async () => {
    const intakeBuilder = createQueryBuilder({
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
      outlook_email_intake: [intakeBuilder],
      document_metadata: [],
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
    createServiceClientMock.mockReturnValue(supabase as never);
    createOutlookIntakeServiceClientMock.mockReturnValue(supabase as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/outlook-intake?sent_from=alerts&sent_to=brandon%40alleatogroup.com&tag=automated&triage_action=delete",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(intakeBuilder.or).toHaveBeenCalledWith(
      "from_email.ilike.%alerts%,from_name.ilike.%alerts%",
    );
    expect(intakeBuilder.or).toHaveBeenCalledWith(
      'mailbox_user_id.ilike.%brandon@alleatogroup.com%,to_list.cs.{"brandon@alleatogroup.com"}',
    );
    expect(intakeBuilder.contains).toHaveBeenCalledWith(
      "source_metadata->user_tags",
      ["automated"],
    );
    expect(intakeBuilder.eq).toHaveBeenCalledWith("triage_action", "delete");
  });
});
