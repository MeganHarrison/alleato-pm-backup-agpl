process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { DELETE } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;

function makeRequest() {
  return new NextRequest("http://localhost/api/projects/1009/documents/42");
}

function makeParams() {
  return {
    params: Promise.resolve({ projectId: "1009", documentId: "42" }),
  };
}

function buildSupabaseClient({
  document = {
    id: 42,
    storage_bucket: "documents",
    storage_path: "projects/1009/documents/file.pdf",
  },
  lookupError = null,
  updateError = null,
}: {
  document?: {
    id: number;
    storage_bucket: string | null;
    storage_path: string | null;
  } | null;
  lookupError?: { code?: string; message: string } | null;
  updateError?: { code?: string; message: string } | null;
} = {}) {
  const lookupQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: document,
      error: lookupError,
    }),
  };

  const updateQuery = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 42 },
      error: updateError,
    }),
  };

  const from = jest
    .fn()
    .mockReturnValueOnce(lookupQuery)
    .mockReturnValueOnce(updateQuery);

  return {
    client: {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    } as Awaited<ReturnType<typeof createClient>>,
    lookupQuery,
    updateQuery,
  };
}

function buildServiceClient(removeError: { message: string } | null = null) {
  const remove = jest.fn().mockResolvedValue({ data: null, error: removeError });
  const storageFrom = jest.fn(() => ({ remove }));

  return {
    client: {
      rpc: jest.fn().mockResolvedValue({ data: "error-event-1", error: null }),
      storage: {
        from: storageFrom,
      },
    } as Awaited<ReturnType<typeof createServiceClient>>,
    remove,
    storageFrom,
  };
}

describe("project document route DELETE", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
  });

  it("removes a storage-backed file before soft-deleting the document row", async () => {
    const supabase = buildSupabaseClient();
    const service = buildServiceClient();
    createClientMock.mockResolvedValue(supabase.client);
    createServiceClientMock.mockReturnValue(service.client);

    const response = await DELETE(makeRequest(), makeParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, id: 42 });
    expect(service.storageFrom).toHaveBeenCalledWith("documents");
    expect(service.remove).toHaveBeenCalledWith([
      "projects/1009/documents/file.pdf",
    ]);
    expect(supabase.updateQuery.update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
    });
  });

  it("does not soft-delete the row when storage cleanup fails", async () => {
    const supabase = buildSupabaseClient();
    const service = buildServiceClient({ message: "storage unavailable" });
    createClientMock.mockResolvedValue(supabase.client);
    createServiceClientMock.mockReturnValue(service.client);

    const response = await DELETE(makeRequest(), makeParams());

    expect(response.status).toBe(502);
    expect(service.remove).toHaveBeenCalledWith([
      "projects/1009/documents/file.pdf",
    ]);
    expect(supabase.updateQuery.update).not.toHaveBeenCalled();
  });

  it("soft-deletes legacy URL-only rows without calling storage cleanup", async () => {
    const supabase = buildSupabaseClient({
      document: {
        id: 42,
        storage_bucket: null,
        storage_path: null,
      },
    });
    const service = buildServiceClient();
    createClientMock.mockResolvedValue(supabase.client);
    createServiceClientMock.mockReturnValue(service.client);

    const response = await DELETE(makeRequest(), makeParams());

    expect(response.status).toBe(200);
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(supabase.updateQuery.update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
    });
  });
});
