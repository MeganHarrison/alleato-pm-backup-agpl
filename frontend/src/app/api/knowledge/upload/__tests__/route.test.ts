process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("uuid", () => ({
  v4: jest.fn(() => "00000000-0000-4000-8000-000000000004"),
}));

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

function queryBuilder(result: QueryResult) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
  };
}

function uploadRequest(
  businessAreaId?: string,
  {
    fileName = "operations.txt",
    fileType = "text/plain",
    fileSize,
  }: {
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  } = {},
) {
  const formData = new FormData();
  const file = new File(
    [fileSize === undefined ? "branch knowledge" : new Uint8Array(fileSize)],
    fileName,
    { type: fileType },
  );
  formData.append(
    "file",
    file,
  );
  formData.append("title", "Operations playbook");
  if (businessAreaId !== undefined) {
    formData.append("business_area_id", businessAreaId);
  }

  return new NextRequest("http://localhost/api/knowledge/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/knowledge/upload Business Area scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user",
      email: "admin@example.com",
    });
  });

  it("preserves extension and size guardrails before storage mutation", async () => {
    const profile = queryBuilder({
      data: { is_admin: true },
      error: null,
    });
    const storage = {
      upload: jest.fn(),
      remove: jest.fn(),
    };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profile;
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: { from: jest.fn(() => storage) },
    };
    createClientMock.mockResolvedValue(supabase as never);

    const invalidType = await POST(
      uploadRequest(undefined, {
        fileName: "payload.exe",
        fileType: "application/octet-stream",
      }),
      { params: Promise.resolve({}) },
    );
    expect(invalidType.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();

    const oversized = await POST(
      uploadRequest(undefined, {
        fileName: "large.pdf",
        fileType: "application/pdf",
        fileSize: 50 * 1024 * 1024 + 1,
      }),
      { params: Promise.resolve({}) },
    );
    expect(oversized.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("keeps unscoped uploads working for the existing knowledge surface", async () => {
    const profile = queryBuilder({
      data: { is_admin: true },
      error: null,
    });
    const metadata = queryBuilder({
      data: { id: "document-id", business_area_id: null },
      error: null,
    });
    const storage = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      remove: jest.fn().mockResolvedValue({ error: null }),
    };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profile;
        if (table === "document_metadata") return metadata;
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: { from: jest.fn(() => storage) },
    };
    createClientMock.mockResolvedValue(supabase as never);

    const response = await POST(uploadRequest(), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(201);
    expect(supabase.from).not.toHaveBeenCalledWith("business_areas");
    expect(metadata.insert).toHaveBeenCalledWith(
      expect.objectContaining({ business_area_id: null }),
    );
  });

  it("stamps a verified Business Area on the initial metadata insert", async () => {
    const profile = queryBuilder({
      data: { is_admin: true },
      error: null,
    });
    const area = queryBuilder({ data: { id: 4 }, error: null });
    const metadata = queryBuilder({
      data: { id: "document-id", business_area_id: 4 },
      error: null,
    });
    const storage = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      remove: jest.fn().mockResolvedValue({ error: null }),
    };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profile;
        if (table === "business_areas") return area;
        if (table === "document_metadata") return metadata;
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: jest.fn(() => storage),
      },
    };
    createClientMock.mockResolvedValue(supabase as never);

    const response = await POST(uploadRequest("4"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(201);
    expect(area.eq).toHaveBeenCalledWith("id", 4);
    expect(metadata.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Operations playbook",
        business_area_id: 4,
      }),
    );
    expect(storage.upload).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid Business Area before storage is mutated", async () => {
    const profile = queryBuilder({
      data: { is_admin: true },
      error: null,
    });
    const storage = {
      upload: jest.fn(),
      remove: jest.fn(),
    };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profile;
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: jest.fn(() => storage),
      },
    };
    createClientMock.mockResolvedValue(supabase as never);

    const response = await POST(uploadRequest("-2"), {
      params: Promise.resolve({}),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error_message).toContain(
      "Business Area must be a positive numeric identifier",
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("rejects a missing Business Area before storage is mutated", async () => {
    const profile = queryBuilder({
      data: { is_admin: true },
      error: null,
    });
    const area = queryBuilder({ data: null, error: null });
    const storage = {
      upload: jest.fn(),
      remove: jest.fn(),
    };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profile;
        if (table === "business_areas") return area;
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: { from: jest.fn(() => storage) },
    };
    createClientMock.mockResolvedValue(supabase as never);

    const response = await POST(uploadRequest("999"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("removes the stored object when metadata registration fails", async () => {
    const profile = queryBuilder({
      data: { is_admin: true },
      error: null,
    });
    const area = queryBuilder({ data: { id: 4 }, error: null });
    const metadata = queryBuilder({
      data: null,
      error: { message: "metadata insert failed" },
    });
    const storage = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      remove: jest.fn().mockResolvedValue({ error: null }),
    };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profile;
        if (table === "business_areas") return area;
        if (table === "document_metadata") return metadata;
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: { from: jest.fn(() => storage) },
    };
    createClientMock.mockResolvedValue(supabase as never);

    const response = await POST(uploadRequest("4"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(502);
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });
});
