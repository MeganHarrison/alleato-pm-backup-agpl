import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid-1234"),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn().mockResolvedValue({ id: "admin-1" }),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function makeAdminSupabaseMock(overrides: Record<string, unknown> = {}) {
  const removeMock = jest.fn().mockResolvedValue({ error: null });
  const storageMock = {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ error: null }),
      remove: removeMock,
    })),
  };

  const fromMock = jest.fn((table: string) => {
    if (table === "user_profiles") {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { is_admin: true }, error: null }),
      };
    }
    if (table === "document_metadata") {
      return {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: "test-id",
            title: "Test Doc",
            category: "knowledge",
            status: "uploaded",
            file_name: "test.pdf",
          },
          error: null,
        }),
      };
    }
    return {};
  });

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }),
    },
    from: fromMock,
    storage: storageMock,
    _removeMock: removeMock,
    ...overrides,
  };
}

function makeFormDataRequest(fileName: string, fileSize: number, fileType = "application/pdf") {
  const file = new File([new Uint8Array(fileSize)], fileName, { type: fileType });
  const formData = new FormData();
  formData.append("file", file);
  return new NextRequest("http://localhost/api/knowledge/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/knowledge/upload", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 for disallowed extension (.exe)", async () => {
    const mock = makeAdminSupabaseMock();
    createClientMock.mockResolvedValue(mock as never);

    const req = makeFormDataRequest("malware.exe", 1024, "application/octet-stream");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error_code).toBe("INVALID_PAYLOAD");
    expect(body.error_message).toContain(".exe");
  });

  it("returns 400 for file exceeding 50MB", async () => {
    const mock = makeAdminSupabaseMock();
    createClientMock.mockResolvedValue(mock as never);

    const FIFTY_MB_PLUS_ONE = 50 * 1024 * 1024 + 1;
    const req = makeFormDataRequest("bigfile.pdf", FIFTY_MB_PLUS_ONE);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error_code).toBe("INVALID_PAYLOAD");
    expect(body.error_message).toContain("50MB");
  });

  it("returns 201 with document metadata on success", async () => {
    const mock = makeAdminSupabaseMock();
    createClientMock.mockResolvedValue(mock as never);

    const req = makeFormDataRequest("report.pdf", 1024);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body.data.category).toBe("knowledge");
    expect(body.data.status).toBe("uploaded");
  });

  it("cleans up storage when metadata insert fails (storage.remove called)", async () => {
    const removeMock = jest.fn().mockResolvedValue({ error: null });
    const storageMock = {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        remove: removeMock,
      })),
    };

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: { is_admin: true }, error: null }),
          };
        }
        if (table === "document_metadata") {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "duplicate key value" },
            }),
          };
        }
        return {};
      }),
      storage: storageMock,
    } as never);

    const req = makeFormDataRequest("report.pdf", 1024);
    const res = await POST(req);
    // UPSTREAM_FAILURE maps to 502 in the guardrails error handler
    expect(res.status).toBe(502);
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
