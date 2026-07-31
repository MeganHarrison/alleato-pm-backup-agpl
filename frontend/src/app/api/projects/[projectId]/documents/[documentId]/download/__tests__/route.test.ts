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
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
  createOutlookIntakeServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;
const createOutlookIntakeServiceClientMock =
  createOutlookIntakeServiceClient as jest.MockedFunction<
    typeof createOutlookIntakeServiceClient
  >;

type DocumentRow = {
  id: number;
  file_name: string;
  file_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  source_system: string | null;
  source_web_url: string | null;
  source_metadata: {
    outlook_intake_attachment_id?: number | null;
    text_storage_bucket?: string | null;
    text_storage_path?: string | null;
  } | null;
};

function makeRequest(search = "") {
  return new NextRequest(
    `http://localhost/api/projects/1009/documents/42/download${search}`,
  );
}

function buildProjectDocumentQuery(result: {
  data: DocumentRow | null;
  error: { code?: string; message: string } | null;
}) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
}

function buildSupabaseClient(documentResult: {
  data: DocumentRow | null;
  error: { code?: string; message: string } | null;
}) {
  const query = buildProjectDocumentQuery(documentResult);
  const from = jest.fn((table: string) => {
    if (table !== "project_documents") {
      throw new Error(`Unexpected supabase.from("${table}")`);
    }
    return query;
  });

  return {
    client: {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
    } as Awaited<ReturnType<typeof createClient>>,
    query,
  };
}

function buildServiceClient() {
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: null,
    error: { message: "No signed URL" },
  });
  const download = jest.fn().mockResolvedValue({
    data: null,
    error: { message: "No text preview" },
  });
  const attachmentSingle = jest.fn();
  const attachmentQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: attachmentSingle,
  };
  const from = jest.fn((table: string) => {
    if (table === "outlook_email_intake_attachments") {
      return attachmentQuery;
    }
    throw new Error(`Unexpected serviceClient.from("${table}")`);
  });

  return {
    client: {
      from,
      storage: {
        from: jest.fn(() => ({
          createSignedUrl,
          download,
        })),
      },
    } as Awaited<ReturnType<typeof createServiceClient>>,
    createSignedUrl,
    download,
    attachmentQuery,
  };
}

describe("project document download route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
  });

  it("prefers file_url before source_web_url for external fallbacks", async () => {
    const supabase = buildSupabaseClient({
      data: {
        id: 42,
        file_name: "proposal.pdf",
        file_url: "https://files.example.com/proposal.pdf",
        storage_bucket: null,
        storage_path: null,
        source_system: null,
        source_web_url: "https://outlook.office.com/mail/id/abc",
        source_metadata: null,
      },
      error: null,
    });
    const service = buildServiceClient();
    createClientMock.mockResolvedValue(supabase.client);
    createServiceClientMock.mockReturnValue(service.client);
    createOutlookIntakeServiceClientMock.mockReturnValue(service.client);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ projectId: "1009", documentId: "42" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://files.example.com/proposal.pdf",
    );
    expect(response.headers.get("x-document-source")).toBe("file-url");
  });

  it("falls back to source_web_url only when no direct file URL exists", async () => {
    const supabase = buildSupabaseClient({
      data: {
        id: 42,
        file_name: "proposal.pdf",
        file_url: "graph://messages/abc/attachments/def",
        storage_bucket: null,
        storage_path: null,
        source_system: null,
        source_web_url: "https://outlook.office.com/mail/id/abc",
        source_metadata: null,
      },
      error: null,
    });
    const service = buildServiceClient();
    createClientMock.mockResolvedValue(supabase.client);
    createServiceClientMock.mockReturnValue(service.client);
    createOutlookIntakeServiceClientMock.mockReturnValue(service.client);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ projectId: "1009", documentId: "42" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://outlook.office.com/mail/id/abc",
    );
    expect(response.headers.get("x-document-source")).toBe("source-web-url");
  });

  it("streams extracted text for inline Microsoft previews instead of embedding the source page", async () => {
    const supabase = buildSupabaseClient({
      data: {
        id: 42,
        file_name: "proposal.pdf",
        file_url: "https://tenant.sharepoint.com/Documents/proposal.pdf",
        storage_bucket: null,
        storage_path: null,
        source_system: "onedrive",
        source_web_url: "https://tenant.sharepoint.com/Documents/proposal.pdf",
        source_metadata: {
          text_storage_bucket: "documents",
          text_storage_path: "onedrive/proposal.pdf.txt",
        },
      },
      error: null,
    });
    const service = buildServiceClient();
    service.download.mockResolvedValue({
      data: new Blob(["Extracted proposal preview"]),
      error: null,
    });
    createClientMock.mockResolvedValue(supabase.client);
    createServiceClientMock.mockReturnValue(service.client);
    createOutlookIntakeServiceClientMock.mockReturnValue(service.client);

    const response = await GET(makeRequest("?disposition=inline"), {
      params: Promise.resolve({ projectId: "1009", documentId: "42" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-document-source")).toBe(
      "extracted-text-preview",
    );
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("Extracted proposal preview");
  });

  it("does not iframe Microsoft source links when no inline preview artifact exists", async () => {
    const supabase = buildSupabaseClient({
      data: {
        id: 42,
        file_name: "proposal.pdf",
        file_url: "https://tenant.sharepoint.com/Documents/proposal.pdf",
        storage_bucket: null,
        storage_path: null,
        source_system: "onedrive",
        source_web_url: "https://tenant.sharepoint.com/Documents/proposal.pdf",
        source_metadata: null,
      },
      error: null,
    });
    const service = buildServiceClient();
    createClientMock.mockResolvedValue(supabase.client);
    createServiceClientMock.mockReturnValue(service.client);
    createOutlookIntakeServiceClientMock.mockReturnValue(service.client);

    const response = await GET(makeRequest("?disposition=inline"), {
      params: Promise.resolve({ projectId: "1009", documentId: "42" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "NOT_FOUND",
      success: false,
    });
  });

  it("streams promoted Outlook attachment bytes before falling back to the email web link", async () => {
    const supabase = buildSupabaseClient({
      data: {
        id: 42,
        file_name: "proposal.pdf",
        file_url: "https://outlook.office.com/mail/id/abc",
        storage_bucket: null,
        storage_path: null,
        source_system: "outlook_attachment",
        source_web_url: "https://outlook.office.com/mail/id/abc",
        source_metadata: {
          outlook_intake_attachment_id: 2060,
        },
      },
      error: null,
    });
    const service = buildServiceClient();
    service.attachmentQuery.single.mockResolvedValue({
      data: {
        id: 2060,
        file_name: "proposal.pdf",
        content: "\\x25504446",
        content_type: "application/pdf",
        project_id: 1009,
      },
      error: null,
    });
    createClientMock.mockResolvedValue(supabase.client);
    createServiceClientMock.mockReturnValue(service.client);
    createOutlookIntakeServiceClientMock.mockReturnValue(service.client);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ projectId: "1009", documentId: "42" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-document-source")).toBe(
      "outlook-intake-attachment",
    );
    expect(response.headers.get("content-type")).toBe("application/pdf");
    await expect(response.arrayBuffer()).resolves.toEqual(
      Uint8Array.from([0x25, 0x50, 0x44, 0x46]).buffer,
    );
  });
});
