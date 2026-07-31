import { buildSourceSpecificRagAnswer } from "../source-specific-rag";
import { fetchRecentTeamsMessagesFromGraph } from "@/lib/microsoft-graph/recent-teams-messages";
import { listOutlookInboxMessages } from "@/lib/microsoft-graph/mail";

jest.mock("@/lib/microsoft-graph/recent-teams-messages", () => ({
  fetchRecentTeamsMessagesFromGraph: jest.fn(async () => ({
    status: "checked",
    checkedMailboxes: [],
    rows: [],
  })),
}));

jest.mock("@/lib/microsoft-graph/mail", () => ({
  listOutlookInboxMessages: jest.fn(async () => ({
    ok: true,
    source: "mock",
    mailboxUserId: "mock",
    messages: [],
    fetchedAt: "2026-06-22T00:00:00.000Z",
    truncated: false,
  })),
}));

function makeDocumentMetadataClient(rows: unknown[]) {
  const chain: Record<string, jest.Mock> = {};
  for (const method of [
    "select",
    "eq",
    "gte",
    "lte",
    "order",
    "limit",
    "or",
    "in",
  ]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = jest.fn(
    (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: rows, error: null }),
  );

  return {
    from: jest.fn((table: string) => {
      expect(table).toBe("document_metadata");
      return chain;
    }),
  };
}

function makeRagMetadataClient(rows: unknown[]) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.in = jest.fn(async () => ({ data: rows, error: null }));

  return {
    from: jest.fn((table: string) => {
      expect(table).toBe("rag_document_metadata");
      return chain;
    }),
  };
}

describe("buildSourceSpecificRagAnswer Teams hydration", () => {
  beforeEach(() => {
    jest.mocked(fetchRecentTeamsMessagesFromGraph).mockResolvedValue({
      status: "checked",
      checkedMailboxes: [],
      rows: [],
    });
  });

  it("hydrates empty stored Teams rows from RAG metadata content", async () => {
    const answer = await buildSourceSpecificRagAnswer({
      supabase: makeDocumentMetadataClient([
        {
          id: "teamsdm_today",
          title: "Teams DM Conversation: Operations",
          source: "microsoft_graph",
          category: "teams_message",
          type: "teams_dm_conversation",
          date: "2026-06-22T00:00:00+00:00",
          created_at: "2026-06-22T15:43:55+00:00",
          content: null,
          summary: null,
          overview: null,
          project_id: null,
        },
      ]) as never,
      ragSupabase: makeRagMetadataClient([
        {
          id: "teamsdm_today",
          content:
            "Jesse Dawson: Please make sure all subcontractor billings are entered and approved.",
          raw_text: null,
          summary: null,
          overview: null,
        },
      ]) as never,
      request: {
        kind: "recent_teams_discussions",
        label: "Teams messages",
        query: "look through teams",
        startDate: "2026-06-22",
        endDate: "2026-06-22",
        limit: 12,
      },
      scope: {
        userId: "user",
        personId: null,
        isAdmin: true,
        isLeadership: true,
        allowedProjectIds: [],
        allowedBusinessAreaIds: [],
        allowedCompanyIds: [],
        pinnedProjectId: null,
      },
    });

    expect(answer.content).toContain(
      "Jesse Dawson: Please make sure all subcontractor billings are entered and approved.",
    );
    expect(answer.content).not.toContain("No text excerpt stored");
    expect(answer.rows[0]?.content).toContain("subcontractor billings");
  });

  it("formats Teams prefetch as synthesis evidence instead of a raw audit answer", async () => {
    jest.mocked(fetchRecentTeamsMessagesFromGraph).mockResolvedValue({
      status: "checked",
      checkedMailboxes: ["acannon@alleatogroup.com"],
      rows: [
        {
          id: "1782326658464",
          mailbox: "acannon@alleatogroup.com",
          chatLabel: "19:31fc2e2e29e54",
          createdDateTime: "2026-06-24T19:31:00.000Z",
          lastModifiedDateTime: "2026-06-24T19:31:10.000Z",
          senderName: "Patrick Antone",
          content: "I have 5 concrete follow-ups for the warehouse pour.",
          participants: ["Patrick Antone", "acannon@alleatogroup.com"],
        },
      ],
    });

    const answer = await buildSourceSpecificRagAnswer({
      supabase: makeDocumentMetadataClient([]) as never,
      ragSupabase: makeRagMetadataClient([]) as never,
      request: {
        kind: "recent_teams_discussions",
        label: "Teams messages",
        query: "what insights can be found in the teams messages today?",
        startDate: "2026-06-24",
        endDate: "2026-06-25",
        limit: 10,
      },
      scope: {
        userId: "user",
        personId: null,
        isAdmin: true,
        isLeadership: true,
        allowedProjectIds: [],
        allowedBusinessAreaIds: [],
        allowedCompanyIds: [],
        pinnedProjectId: null,
      },
    });

    expect(answer.content).toContain("Teams Message Evidence For Synthesis");
    expect(answer.content).toContain("Use these Teams snippets as evidence");
    expect(answer.content).toContain("Teams conversation");
    expect(answer.content).toContain("warehouse pour");
    expect(answer.content).toContain("Live Microsoft Graph Teams message");
    expect(answer.content).toContain("Retrieved 1 Teams row(s)");
    expect(answer.content).toContain(
      "document_metadata/document_chunks-backed Teams index",
    );
    expect(answer.content).not.toContain("**Main Teams Discussions");
    expect(answer.content).not.toContain("**Observability**");
    expect(answer.content).not.toContain("**Next Step**");
    expect(answer.content).not.toContain("[Sources:");
    expect(answer.content).not.toContain("live-teams:");
    expect(answer.content).not.toContain("19:31fc2e2e29e54");
  });

  it("sanitizes stored Teams conversation snippets before synthesis", async () => {
    const answer = await buildSourceSpecificRagAnswer({
      supabase: makeDocumentMetadataClient([
        {
          id: "teamsdm_license",
          title: "Teams DM Conversation: 19:5f9d3daf-",
          source: "microsoft_graph",
          category: "teams_message",
          type: "teams_dm_conversation",
          date: "2026-06-24T00:00:00+00:00",
          created_at: "2026-06-24T20:21:19+00:00",
          content:
            "[Teams Direct Message Conversation: 19:5f9d3daf-] Date: 2026-06-24 [message:1782332479114] [2026-06-24 19:44:54] Andrew Cannon: Is our Business ownership name &amp; Doing Business &nbsp;license in the Nevada folder?",
          summary: null,
          overview: null,
          project_id: null,
        },
        {
          id: "teamsdm_marketing",
          title: "Teams DM Conversation: Alleato Marketing",
          source: "microsoft_graph",
          category: "teams_message",
          type: "teams_dm_conversation",
          date: "2026-06-24T00:00:00+00:00",
          created_at: "2026-06-24T17:49:00+00:00",
          content:
            "[Teams Direct Message Conversation: Alleato Marketing] Date: 2026-06-24 [message:1782323340196] [2026-06-24 17:49:00] Maria Calcetero: aisun &nbsp; Mamedova &nbsp;this blog post will be ready today.",
          summary: null,
          overview: null,
          project_id: null,
        },
      ]) as never,
      ragSupabase: makeRagMetadataClient([]) as never,
      request: {
        kind: "recent_teams_discussions",
        label: "Teams messages",
        query: "what insights can be found in the teams messages today?",
        startDate: "2026-06-24",
        endDate: "2026-06-25",
        limit: 10,
      },
      scope: {
        userId: "user",
        personId: null,
        isAdmin: true,
        isLeadership: true,
        allowedProjectIds: [],
        allowedBusinessAreaIds: [],
        allowedCompanyIds: [],
        pinnedProjectId: null,
      },
    });

    expect(answer.content).toContain("Teams Message Evidence For Synthesis");
    expect(answer.content).toContain("Teams conversation");
    expect(answer.content).toContain(
      "[2026-06-24 19:44:54] Andrew Cannon: Is our Business ownership name & Doing Business license in the Nevada folder?",
    );
    expect(answer.content).toContain(
      "Teams DM conversation: Alleato Marketing",
    );
    expect(answer.content).toContain(
      "Maria Calcetero: aisun Mamedova this blog post will be ready today.",
    );
    expect(answer.content).not.toContain("[Teams Direct Message Conversation:");
    expect(answer.content).not.toContain("[message:");
    expect(answer.content).not.toContain("19:5f9d3daf-");
    expect(answer.content).not.toContain("Teams conversation:54");
    expect(answer.content).not.toContain("&nbsp;");
    expect(answer.content).not.toContain("&amp;");
  });
});

describe("buildSourceSpecificRagAnswer Business Area authorization", () => {
  it("returns an allowed branch and rejects Finance despite a retained project label", async () => {
    const answer = await buildSourceSpecificRagAnswer({
      supabase: makeDocumentMetadataClient([
        {
          id: "marketing-doc",
          title: "Marketing plan",
          source: "microsoft_graph",
          category: "document",
          type: "document",
          date: "2026-06-24T00:00:00+00:00",
          created_at: "2026-06-24T17:49:00+00:00",
          content: "Approved marketing campaign plan.",
          summary: null,
          overview: null,
          project_id: 89,
          business_area_id: 5,
        },
        {
          id: "finance-doc",
          title: "Finance policy",
          source: "microsoft_graph",
          category: "document",
          type: "document",
          date: "2026-06-24T00:00:00+00:00",
          created_at: "2026-06-24T17:48:00+00:00",
          content: "Restricted finance policy.",
          summary: null,
          overview: null,
          project_id: 60,
          business_area_id: 3,
        },
      ]) as never,
      request: {
        kind: "recent_onedrive_documents",
        label: "OneDrive documents",
        query: "recent company documents",
        startDate: "2026-06-22",
        endDate: "2026-06-25",
        limit: 10,
      },
      scope: {
        userId: "user",
        personId: "person",
        isAdmin: false,
        isLeadership: false,
        allowedProjectIds: [60, 89],
        allowedBusinessAreaIds: [5],
        allowedCompanyIds: [],
        pinnedProjectId: null,
      },
    });

    expect(answer.rows.map((row) => row.id)).toEqual(["marketing-doc"]);
    expect(answer.content).toContain("Marketing plan");
    expect(answer.content).not.toContain("Finance policy");
    expect(answer.trace).toMatchObject({
      output: {
        rowCount: 1,
        rows: [{ id: "marketing-doc", businessAreaId: 5 }],
      },
    });
  });

  it("returns authorized indexed branch email without opening the live mailbox", async () => {
    jest.mocked(listOutlookInboxMessages).mockClear();

    const answer = await buildSourceSpecificRagAnswer({
      supabase: makeDocumentMetadataClient([
        {
          id: "marketing-email",
          title: "Marketing launch",
          source: "microsoft_graph",
          category: "email",
          type: "outlook_message",
          date: "2026-06-24T00:00:00+00:00",
          created_at: "2026-06-24T17:49:00+00:00",
          content: "Authorized launch details.",
          summary: null,
          overview: null,
          project_id: 89,
          business_area_id: 5,
        },
        {
          id: "finance-email",
          title: "Finance close",
          source: "microsoft_graph",
          category: "email",
          type: "outlook_message",
          date: "2026-06-24T00:00:00+00:00",
          created_at: "2026-06-24T17:48:00+00:00",
          content: "Restricted close details.",
          summary: null,
          overview: null,
          project_id: 60,
          business_area_id: 3,
        },
        {
          id: "project-email",
          title: "Project-only thread",
          source: "microsoft_graph",
          category: "email",
          type: "outlook_message",
          date: "2026-06-24T00:00:00+00:00",
          created_at: "2026-06-24T17:47:00+00:00",
          content: "Project-scoped communication.",
          summary: null,
          overview: null,
          project_id: 1009,
          business_area_id: null,
        },
      ]) as never,
      request: {
        kind: "recent_emails",
        label: "Recent Outlook emails",
        query: "recent company emails",
        startDate: "2026-06-22",
        endDate: "2026-06-25",
        limit: 10,
      },
      scope: {
        userId: "user",
        personId: "person",
        isAdmin: false,
        isLeadership: false,
        allowedProjectIds: [60, 89, 1009],
        allowedBusinessAreaIds: [5],
        allowedCompanyIds: [],
        pinnedProjectId: null,
      },
    });

    expect(listOutlookInboxMessages).not.toHaveBeenCalled();
    expect(answer.rows.map((row) => row.id)).toEqual(["marketing-email"]);
    expect(answer.content).toContain("Marketing launch");
    expect(answer.content).not.toContain("Finance close");
    expect(answer.content).not.toContain("Project-only thread");
    expect(answer.content).toContain(
      "live Microsoft Graph Outlook was skipped by permissions",
    );
  });
});
