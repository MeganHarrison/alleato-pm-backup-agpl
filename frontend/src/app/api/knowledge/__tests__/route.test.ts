import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { DELETE, GET, normalizeTags } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn().mockResolvedValue({ id: "admin-user-id", email: "admin@example.com" }),
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

type QueryResult = { data: unknown; error: null | { message: string } };

function createThenableQuery(result: QueryResult, calls: Array<{ op: string; args: unknown[] }>) {
  const query = {
    select: jest.fn((...args: unknown[]) => {
      calls.push({ op: "select", args });
      return query;
    }),
    eq: jest.fn((...args: unknown[]) => {
      calls.push({ op: "eq", args });
      return query;
    }),
    in: jest.fn((...args: unknown[]) => {
      calls.push({ op: "in", args });
      return query;
    }),
    order: jest.fn((...args: unknown[]) => {
      calls.push({ op: "order", args });
      return query;
    }),
    limit: jest.fn((...args: unknown[]) => {
      calls.push({ op: "limit", args });
      return query;
    }),
    or: jest.fn((...args: unknown[]) => {
      calls.push({ op: "or", args });
      return query;
    }),
    maybeSingle: jest.fn().mockResolvedValue(result),
    delete: jest.fn(() => {
      calls.push({ op: "delete", args: [] });
      return query;
    }),
    then: (resolve: (value: QueryResult) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function makeSupabaseMock() {
  const calls: Record<string, Array<{ op: string; args: unknown[] }>> = {};
  const removeMock = jest.fn().mockResolvedValue({ error: null });

  const documentList = [
    {
      id: "doc-1",
      title: "Safety Manual",
      category: "knowledge",
      status: "embedded",
      file_name: "safety.pdf",
      tags: "safety, osha",
    },
  ];

  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "admin-user-id" } },
        error: null,
      }),
    },
    storage: {
      from: jest.fn(() => ({
        remove: removeMock,
      })),
    },
    from: jest.fn((table: string) => {
      calls[table] ??= [];
      if (table === "user_profiles") {
        return createThenableQuery(
          { data: { is_admin: true }, error: null },
          calls[table],
        );
      }
      if (table === "document_metadata") {
        return createThenableQuery(
          { data: documentList, error: null },
          calls[table],
        );
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { supabase, calls, removeMock, documentList };
}

describe("normalizeTags", () => {
  it("returns null for null/undefined/empty", () => {
    expect(normalizeTags(null)).toBeNull();
    expect(normalizeTags(undefined)).toBeNull();
    expect(normalizeTags("")).toBeNull();
    expect(normalizeTags("   ")).toBeNull();
  });

  it("splits comma- and semicolon-separated strings and trims", () => {
    expect(normalizeTags("safety, osha")).toEqual(["safety", "osha"]);
    expect(normalizeTags("a;b ; c")).toEqual(["a", "b", "c"]);
    expect(normalizeTags("hiring,,growth, ")).toEqual(["hiring", "growth"]);
  });

  it("parses a JSON-array string", () => {
    expect(normalizeTags('["a","b"]')).toEqual(["a", "b"]);
    expect(normalizeTags("[]")).toBeNull();
  });

  it("passes through and cleans an existing array", () => {
    expect(normalizeTags(["x", " y ", ""])).toEqual(["x", "y"]);
    expect(normalizeTags([])).toBeNull();
  });
});

describe("/api/knowledge route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists knowledge documents from document_metadata and filters public results to processed statuses", async () => {
    const { supabase, calls, documentList } = makeSupabaseMock();
    createClientMock.mockResolvedValue(supabase as never);

    const response = await GET(new NextRequest("http://localhost/api/knowledge"));

    expect(response.status).toBe(200);
    // tags is a TEXT column in the DB — the route must normalize it to an array
    // so downstream `.map`/`.join` consumers never receive a raw string.
    expect(await response.json()).toEqual({
      data: [{ ...documentList[0], tags: ["safety", "osha"] }],
    });
    expect(supabase.from).toHaveBeenCalledWith("document_metadata");
    expect(calls.document_metadata).toContainEqual({
      op: "eq",
      args: ["category", "knowledge"],
    });
    expect(calls.document_metadata).toContainEqual({
      op: "in",
      args: ["status", ["embedded", "extracted", "complete"]],
    });
  });

  it("requires admin verification for manage view and applies search/project filters", async () => {
    const { supabase, calls } = makeSupabaseMock();
    createClientMock.mockResolvedValue(supabase as never);

    const response = await GET(
      new NextRequest("http://localhost/api/knowledge?manage=true&search=safety&projectId=42"),
    );

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("user_profiles");
    expect(calls.document_metadata).toContainEqual({
      op: "or",
      args: ["title.ilike.%safety%,file_name.ilike.%safety%,tags.ilike.%safety%"],
    });
    expect(calls.document_metadata).toContainEqual({
      op: "eq",
      args: ["project_id", 42],
    });
    expect(calls.document_metadata.some((call) => call.op === "in")).toBe(false);
  });

  it("deletes knowledge document metadata and removes the backing storage object", async () => {
    const { supabase, calls, removeMock } = makeSupabaseMock();
    const prefetchResult = {
      data: { file_path: "knowledge/doc-1/safety.pdf", storage_bucket: "documents" },
      error: null,
    };
    const deleteResult = { data: [{ id: "doc-1" }], error: null };
    let documentQueryCount = 0;
    supabase.from.mockImplementation((table: string) => {
      calls[table] ??= [];
      if (table === "user_profiles") {
        return createThenableQuery({ data: { is_admin: true }, error: null }, calls[table]);
      }
      if (table === "document_metadata") {
        documentQueryCount += 1;
        return createThenableQuery(
          documentQueryCount === 1 ? prefetchResult : deleteResult,
          calls[table],
        );
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    createClientMock.mockResolvedValue(supabase as never);

    const response = await DELETE(new NextRequest("http://localhost/api/knowledge?id=doc-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(removeMock).toHaveBeenCalledWith(["knowledge/doc-1/safety.pdf"]);
    expect(calls.document_metadata).toContainEqual({
      op: "delete",
      args: [],
    });
    expect(calls.document_metadata).toContainEqual({
      op: "eq",
      args: ["category", "knowledge"],
    });
  });
});
