import { describe, it, expect, vi, beforeEach } from "vitest";
import { retrieveChunks, type RagRow } from "../retrieve-chunks";
import * as toolUtils from "@/lib/ai/tools/tool-utils";
import type { OpenAI } from "@ai-sdk/openai";
import type { ServiceClientReturnType } from "@/lib/supabase/service";

// Mock the dependencies
vi.mock("@/lib/ai/tools/tool-utils");
vi.mock("@/lib/supabase/service");

type MockRagClient = Partial<ServiceClientReturnType>;

describe("retrieveChunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate embedding via generateEmbedding", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRagClient: MockRagClient = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.spyOn(toolUtils, "generateEmbedding").mockResolvedValue(
      '{"vector": "mocked"}',
    );

    await retrieveChunks({
      query: "test query",
      openai: mockOpenAI,
      ragClient: mockRagClient,
    });

    expect(toolUtils.generateEmbedding).toHaveBeenCalledWith(
      mockOpenAI,
      "test query",
      toolUtils.EMBEDDING.LARGE,
    );
  });

  it("should pass stringified embedding to RPC (never raw array)", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRagClient: MockRagClient = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const mockEmbedding = "[0.1, 0.2, 0.3]"; // Already JSON stringified
    vi.spyOn(toolUtils, "generateEmbedding").mockResolvedValue(mockEmbedding);

    await retrieveChunks({
      query: "test query",
      openai: mockOpenAI,
      ragClient: mockRagClient,
      projectId: 123,
      sourceTypes: ["email", "teams"],
    });

    expect(mockRagClient.rpc).toHaveBeenCalledWith("search_document_chunks", {
      query_embedding: mockEmbedding, // Verify it's the string, not parsed array
      filter_source_types: ["email", "teams"],
      filter_project_id: 123,
      match_count: 10,
      match_threshold: 0.45,
    });
  });

  it("should throw error loudly on RPC failure (never silent)", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRagClient: MockRagClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      }),
    };

    vi.spyOn(toolUtils, "generateEmbedding").mockResolvedValue(
      '{"vector": "mocked"}',
    );

    await expect(
      retrieveChunks({
        query: "test query",
        openai: mockOpenAI,
        ragClient: mockRagClient,
        errorLabel: "Test search",
      }),
    ).rejects.toThrow("Test search: RPC failed");
  });

  it("should return normalized rows on success", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRows: RagRow[] = [
      {
        id: "1",
        chunk_text: "test chunk",
        doc_title: "doc",
        similarity: 0.9,
      },
    ];
    const mockRagClient: MockRagClient = {
      rpc: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
    };

    vi.spyOn(toolUtils, "generateEmbedding").mockResolvedValue(
      '{"vector": "mocked"}',
    );

    const result = await retrieveChunks({
      query: "test query",
      openai: mockOpenAI,
      ragClient: mockRagClient,
    });

    expect(result).toEqual(mockRows);
  });

  it("should use default match_count and threshold", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRagClient: MockRagClient = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.spyOn(toolUtils, "generateEmbedding").mockResolvedValue(
      '{"vector": "mocked"}',
    );

    await retrieveChunks({
      query: "test query",
      openai: mockOpenAI,
      ragClient: mockRagClient,
    });

    const callArgs = mockRagClient.rpc.mock.calls[0][1];
    expect(callArgs.match_count).toBe(10);
    expect(callArgs.match_threshold).toBe(0.45);
  });

  it("should support hybrid ranking option", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRagClient: MockRagClient = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.spyOn(toolUtils, "generateEmbedding").mockResolvedValue(
      '{"vector": "mocked"}',
    );

    await retrieveChunks({
      query: "test query",
      openai: mockOpenAI,
      ragClient: mockRagClient,
      hybridRankingEnabled: true,
    });

    const callArgs = mockRagClient.rpc.mock.calls[0][1];
    expect(callArgs.ranking_mode).toBe("hybrid");
    expect(callArgs.query_text).toBe("test query");
  });
});
