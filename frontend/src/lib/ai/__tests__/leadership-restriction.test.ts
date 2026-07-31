import {
  LEADERSHIP_ACCESS_LEVEL,
  isLeadershipRestrictedCategory,
  isLeadershipRestrictedChunkMetadata,
  filterLeadershipRestrictedChunks,
  withoutLeadershipRestricted,
} from "../leadership-restriction";
import { retrieveChunks } from "../retrieval/retrieve-chunks";
import type { OpenAI } from "@ai-sdk/openai";
import type { ServiceClientReturnType } from "@/lib/supabase/service";

jest.mock("@/lib/ai/tools/tool-utils", () => ({
  generateEmbedding: jest.fn().mockResolvedValue("[0.1]"),
  EMBEDDING: { LARGE: { model: "text-embedding-3-large", dimensions: 3072 } },
}));
jest.mock("@/lib/supabase/service", () => ({
  createRagServiceClient: jest.fn(),
}));
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

describe("isLeadershipRestrictedCategory", () => {
  it("matches Annual Review regardless of case and whitespace", () => {
    expect(isLeadershipRestrictedCategory("Annual Review")).toBe(true);
    expect(isLeadershipRestrictedCategory("annual review")).toBe(true);
    expect(isLeadershipRestrictedCategory("  ANNUAL REVIEW  ")).toBe(true);
  });

  it("does not match other categories or non-strings", () => {
    expect(isLeadershipRestrictedCategory("meeting")).toBe(false);
    expect(isLeadershipRestrictedCategory("email")).toBe(false);
    expect(isLeadershipRestrictedCategory(null)).toBe(false);
    expect(isLeadershipRestrictedCategory(undefined)).toBe(false);
    expect(isLeadershipRestrictedCategory(42)).toBe(false);
  });
});

describe("isLeadershipRestrictedChunkMetadata", () => {
  it("detects the leadership stamp", () => {
    expect(
      isLeadershipRestrictedChunkMetadata({
        access_level: LEADERSHIP_ACCESS_LEVEL,
      }),
    ).toBe(true);
  });

  it("ignores unstamped and malformed metadata", () => {
    expect(isLeadershipRestrictedChunkMetadata({})).toBe(false);
    expect(isLeadershipRestrictedChunkMetadata({ access_level: "team" })).toBe(
      false,
    );
    expect(isLeadershipRestrictedChunkMetadata(null)).toBe(false);
    expect(isLeadershipRestrictedChunkMetadata("leadership")).toBe(false);
  });
});

describe("filterLeadershipRestrictedChunks", () => {
  const rows = [
    { id: "open", doc_metadata: { title: "Normal meeting" } },
    {
      id: "restricted",
      doc_metadata: { title: "Annual review", access_level: "leadership" },
    },
    { id: "no-metadata" },
  ];

  it("drops leadership-stamped chunks for non-leadership users", () => {
    const result = filterLeadershipRestrictedChunks(rows, false);
    expect(result.map((r) => r.id)).toEqual(["open", "no-metadata"]);
  });

  it("keeps everything for leadership users", () => {
    const result = filterLeadershipRestrictedChunks(rows, true);
    expect(result.map((r) => r.id)).toEqual([
      "open",
      "restricted",
      "no-metadata",
    ]);
  });
});

describe("withoutLeadershipRestricted", () => {
  it("adds the null-safe exclusion filter for non-leadership users", () => {
    const query = { or: jest.fn().mockReturnValue("filtered") };
    const result = withoutLeadershipRestricted(query, false);
    expect(query.or).toHaveBeenCalledWith(
      "access_level.is.null,access_level.neq.leadership",
    );
    expect(result).toBe("filtered");
  });

  it("returns the query untouched for leadership users", () => {
    const query = { or: jest.fn() };
    const result = withoutLeadershipRestricted(query, true);
    expect(query.or).not.toHaveBeenCalled();
    expect(result).toBe(query);
  });
});

describe("retrieveChunks leadership default-deny", () => {
  const stampedRows = [
    { id: "a", chunk_text: "safe", doc_metadata: { title: "Normal" } },
    {
      id: "b",
      chunk_text: "annual review content",
      doc_metadata: { title: "Patrick review", access_level: "leadership" },
    },
  ];

  type MockRagClient = Partial<ServiceClientReturnType>;

  function mockClient(): MockRagClient {
    return {
      rpc: jest.fn().mockResolvedValue({ data: stampedRows, error: null }),
    };
  }

  it("drops leadership-restricted chunks by default", async () => {
    const rows = await retrieveChunks({
      query: "reviews",
      openai: {} as OpenAI,
      ragClient: mockClient(),
    });
    expect(rows.map((r) => r.id)).toEqual(["a"]);
  });

  it("returns restricted chunks only with explicit leadership opt-in", async () => {
    const rows = await retrieveChunks({
      query: "reviews",
      openai: {} as OpenAI,
      ragClient: mockClient(),
      includeLeadershipRestricted: true,
    });
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
