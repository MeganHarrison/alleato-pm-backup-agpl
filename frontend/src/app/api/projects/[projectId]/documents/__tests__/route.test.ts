process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;

function makeParams() {
  return {
    params: Promise.resolve({ projectId: "1009" }),
  };
}

function makeMultipartRequest(formData: FormData) {
  return new NextRequest("http://localhost/api/projects/1009/documents", {
    method: "POST",
    body: formData,
  });
}

function makeDocumentFormData() {
  const formData = new FormData();
  formData.append("file", new File(["hello"], "plan.pdf", { type: "application/pdf" }));
  formData.append("title", "Foundation Plan");
  formData.append("description", "Issued for construction");
  formData.append("folder", "Drawings");
  formData.append("status", "Published");
  formData.append("category", "Plans");
  formData.append("is_private", "true");
  return formData;
}

function buildSupabaseClient({
  insertError = null,
}: {
  insertError?: { message: string } | null;
} = {}) {
  const upload = jest.fn().mockResolvedValue({ data: null, error: null });
  const remove = jest.fn().mockResolvedValue({ data: null, error: null });
  const storageFrom = jest.fn(() => ({ upload, remove }));

  const insertedDocument = {
    id: 84,
    project_id: 1009,
    title: "Foundation Plan",
    file_name: "plan.pdf",
    storage_bucket: "documents",
    storage_path: "projects/1009/documents/file.pdf",
  };

  const insertQuery = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: insertError ? null : insertedDocument,
      error: insertError,
    }),
  };

  return {
    client: {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "pm@example.com" } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue(insertQuery),
      storage: {
        from: storageFrom,
      },
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    } as Awaited<ReturnType<typeof createClient>>,
    insertedDocument,
    insertQuery,
    remove,
    storageFrom,
    upload,
  };
}

describe("project document route POST", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("persists multipart uploads to Supabase Storage before inserting the document row", async () => {
    const supabase = buildSupabaseClient();
    createClientMock.mockResolvedValue(supabase.client);

    const response = await POST(makeMultipartRequest(makeDocumentFormData()), makeParams());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(supabase.insertedDocument);
    expect(supabase.storageFrom).toHaveBeenCalledWith("documents");
    expect(supabase.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^projects\/1009\/documents\/.+-plan\.pdf$/),
      expect.any(Buffer),
      {
        contentType: "application/pdf",
        upsert: false,
      },
    );

    const storagePath = supabase.upload.mock.calls[0]?.[0];
    expect(supabase.insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "Plans",
        content_type: "application/pdf",
        created_by: "user-1",
        description: "Issued for construction",
        file_name: "plan.pdf",
        file_size: 5,
        file_url: `supabase://documents/${storagePath}`,
        folder: "Drawings",
        is_private: true,
        project_id: 1009,
        status: "Published",
        storage_bucket: "documents",
        storage_path: storagePath,
        title: "Foundation Plan",
        uploaded_by: "pm@example.com",
      }),
    );
  });

  it("removes the uploaded storage object when the document row insert fails", async () => {
    const supabase = buildSupabaseClient({
      insertError: { message: "insert failed" },
    });
    createClientMock.mockResolvedValue(supabase.client);

    const response = await POST(makeMultipartRequest(makeDocumentFormData()), makeParams());

    expect(response.status).toBe(500);
    const storagePath = supabase.upload.mock.calls[0]?.[0];
    expect(supabase.remove).toHaveBeenCalledWith([storagePath]);
  });
});
