import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn().mockResolvedValue({ id: "user-1" }),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function makeQuery(doc: Record<string, unknown> | null) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn().mockResolvedValue({ data: doc, error: null }),
  };
  return query;
}

function makeSupabaseMock({
  doc,
  signedUrl = "https://storage.example.com/file.pdf",
  signError = null,
}: {
  doc: Record<string, unknown> | null;
  signedUrl?: string | null;
  signError?: { message: string } | null;
}) {
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: signedUrl ? { signedUrl } : null,
    error: signError,
  });

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: jest.fn(() => makeQuery(doc)),
    storage: {
      from: jest.fn(() => ({ createSignedUrl })),
    },
    createSignedUrl,
  };
}

describe("GET /api/knowledge/signed-url", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a Supabase Storage signed URL when the backing object exists", async () => {
    const mock = makeSupabaseMock({
      doc: {
        file_path: "knowledge/doc-1/safety.pdf",
        storage_bucket: "documents",
        source_web_url: "https://sharepoint.example.com/safety.pdf",
        url: null,
      },
    });
    createClientMock.mockResolvedValue(mock as never);

    const response = await GET(
      new NextRequest("http://localhost/api/knowledge/signed-url?id=doc-1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://storage.example.com/file.pdf",
    });
    expect(mock.createSignedUrl).toHaveBeenCalledWith(
      "knowledge/doc-1/safety.pdf",
      3600,
    );
  });

  it("falls back to the source document URL when storage signing fails", async () => {
    const mock = makeSupabaseMock({
      doc: {
        file_path: "knowledge-base/missing.docx",
        storage_bucket: "documents",
        source_web_url: "https://sharepoint.example.com/missing.docx",
        url: null,
      },
      signedUrl: null,
      signError: { message: "Object not found" },
    });
    createClientMock.mockResolvedValue(mock as never);

    const response = await GET(
      new NextRequest("http://localhost/api/knowledge/signed-url?id=doc-1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://sharepoint.example.com/missing.docx",
    });
  });

  it("returns 404 when neither storage path nor source URL exists", async () => {
    const mock = makeSupabaseMock({
      doc: {
        file_path: null,
        storage_bucket: "documents",
        source_web_url: null,
        url: null,
      },
    });
    createClientMock.mockResolvedValue(mock as never);

    const response = await GET(
      new NextRequest("http://localhost/api/knowledge/signed-url?id=doc-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error_code).toBe("NOT_FOUND");
    expect(body.error_message).toContain("source URL");
  });
});
