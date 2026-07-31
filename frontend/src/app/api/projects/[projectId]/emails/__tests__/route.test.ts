process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createOutlookIntakeServiceClient: jest.fn(),
}));

jest.mock("@/lib/emails/access", () => ({
  buildOwnEmailsFilter: jest.fn(() => "from_email.eq.user@example.com"),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
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

function queryBuilder(result: QueryResult) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: jest.fn((resolve: (value: QueryResult) => void) => resolve(result)),
  };
}

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function params() {
  return { params: Promise.resolve({ projectId: "876" }) };
}

function makeClients({
  appRows = [],
  outlookRows = [],
}: {
  appRows?: unknown[];
  outlookRows?: unknown[];
}) {
  const appEmailQuery = queryBuilder({ data: appRows, error: null });
  const profileQuery = queryBuilder({ data: { is_admin: true }, error: null });
  const projectQuery = queryBuilder({
    data: { id: 876, name: "Exol Morrisville", project_number: "876" },
    error: null,
  });

  const appClient = {
    from: jest.fn((table: string) => {
      if (table === "user_profiles") return profileQuery;
      if (table === "project_emails") return appEmailQuery;
      if (table === "projects") return projectQuery;
      throw new Error(`Unexpected app table: ${table}`);
    }),
  };

  const outlookQuery = queryBuilder({ data: outlookRows, error: null });
  const attachmentQuery = queryBuilder({
    data: [{ intake_email_id: 3577 }],
    error: null,
  });
  const intakeClient = {
    from: jest.fn((table: string) => {
      if (table === "outlook_email_intake") return outlookQuery;
      if (table === "outlook_email_intake_attachments") return attachmentQuery;
      throw new Error(`Unexpected intake table: ${table}`);
    }),
  };

  createClientMock.mockResolvedValue(
    appClient as Awaited<ReturnType<typeof createClient>>,
  );
  createOutlookIntakeServiceClientMock.mockReturnValue(intakeClient as never);

  return {
    appClient,
    intakeClient,
    appEmailQuery,
    outlookQuery,
    attachmentQuery,
  };
}

describe("/api/projects/[projectId]/emails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user",
      email: "admin@alleatogroup.com",
    });
  });

  it("returns live Outlook intake rows on the default project Emails feed", async () => {
    const { appClient, intakeClient, outlookQuery, attachmentQuery } = makeClients({
      appRows: [],
      outlookRows: [
        {
          id: 3577,
          project_id: 876,
          received_at: "2026-06-26T05:17:14+00:00",
          subject: "Re: Exol Morrisville PA",
          body: "Latest live Outlook body",
          body_html: null,
          body_text: "Latest live Outlook body",
          from_name: "Steve Fischer",
          from_email: "steve.fischer@exol.com",
          to_list: ["bclymer@alleatogroup.com"],
          cc_list: [],
          has_attachments: true,
          graph_message_id: "graph-message-3577",
          mailbox_user_id: "bclymer@alleatogroup.com",
          conversation_id: "conversation-3577",
          created_at: "2026-06-26T05:18:00+00:00",
        },
      ],
    });

    const response = await GET(request("/api/projects/876/emails"), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 3577,
      project_id: 876,
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
    });
    expect(appClient.from).toHaveBeenCalledWith("project_emails");
    expect(intakeClient.from).toHaveBeenCalledWith("outlook_email_intake");
    expect(outlookQuery.eq).toHaveBeenCalledWith("project_id", 876);
    expect(attachmentQuery.in).toHaveBeenCalledWith("intake_email_id", [3577]);
  });

  it("source=outlook bypasses project_emails so the stale projection cannot hide synced mail", async () => {
    const { appClient, intakeClient } = makeClients({
      outlookRows: [
        {
          id: 3577,
          project_id: 876,
          subject: "Live Outlook only",
          body: null,
          body_html: null,
          body_text: null,
          from_name: null,
          from_email: null,
          to_list: [],
          cc_list: [],
          received_at: "2026-06-26T05:17:14+00:00",
          has_attachments: false,
          graph_message_id: "graph-message-3577",
          mailbox_user_id: "bclymer@alleatogroup.com",
          conversation_id: "conversation-3577",
          created_at: "2026-06-26T05:18:00+00:00",
        },
      ],
    });

    const response = await GET(
      request("/api/projects/876/emails?source=outlook"),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(appClient.from).not.toHaveBeenCalledWith("project_emails");
    expect(intakeClient.from).toHaveBeenCalledWith("outlook_email_intake");
  });

  it("source=app preserves the existing app-authored project email path", async () => {
    const { appClient, intakeClient, appEmailQuery } = makeClients({
      appRows: [
        {
          id: 12,
          project_id: 876,
          subject: "Draft client update",
          status: "Draft",
          created_at: "2026-06-26T04:00:00+00:00",
          sent_at: null,
          received_at: null,
          projects: {
            id: 876,
            name: "Exol Morrisville",
            project_number: "876",
          },
        },
      ],
    });

    const response = await GET(
      request("/api/projects/876/emails?source=app"),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 12,
      subject: "Draft client update",
      project: {
        id: 876,
        name: "Exol Morrisville",
      },
    });
    expect(appClient.from).toHaveBeenCalledWith("project_emails");
    expect(appEmailQuery.is).toHaveBeenCalledWith("graph_message_id", null);
    expect(intakeClient.from).not.toHaveBeenCalled();
  });
});
