import { retrieveChunks, type RagRow } from "../retrieve-chunks";
import * as toolUtils from "@/lib/ai/tools/tool-utils";
import type OpenAI from "openai";
import { createRagServiceClient } from "@/lib/supabase/service";

// Mock the dependencies
jest.mock("@/lib/ai/tools/tool-utils", () => ({
  EMBEDDING: { LARGE: "text-embedding-3-large" },
  generateEmbedding: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createRagServiceClient: jest.fn(),
}));
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

type MockRagClient = Partial<ReturnType<typeof createRagServiceClient>>;

describe("retrieveChunks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should generate embedding via generateEmbedding", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRagClient: MockRagClient = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    jest
      .spyOn(toolUtils, "generateEmbedding")
      .mockResolvedValue('{"vector": "mocked"}');

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
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    const mockEmbedding = "[0.1, 0.2, 0.3]"; // Already JSON stringified
    jest.spyOn(toolUtils, "generateEmbedding").mockResolvedValue(mockEmbedding);

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
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      }),
    };

    jest
      .spyOn(toolUtils, "generateEmbedding")
      .mockResolvedValue('{"vector": "mocked"}');

    await expect(
      retrieveChunks({
        query: "test query",
        openai: mockOpenAI,
        ragClient: mockRagClient,
        errorLabel: "Test search",
      }),
    ).rejects.toThrow("Test search: RPC failed");
  });

  it("forwards an exact Business Area filter to the canonical RPC", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRagClient: MockRagClient = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    jest
      .spyOn(toolUtils, "generateEmbedding")
      .mockResolvedValue('{"vector": "mocked"}');

    await retrieveChunks({
      query: "quarterly forecast",
      openai: mockOpenAI,
      ragClient: mockRagClient,
      businessAreaId: 17,
    });

    expect(mockRagClient.rpc).toHaveBeenCalledWith(
      "search_document_chunks",
      expect.objectContaining({
        filter_business_area_id: 17,
      }),
    );
    expect(mockRagClient.rpc.mock.calls[0][1]).not.toHaveProperty(
      "filter_project_id",
    );
  });

  it("rejects mixed project and Business Area filters before embedding", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRagClient: MockRagClient = {
      rpc: jest.fn(),
    };
    const embeddingSpy = jest.spyOn(toolUtils, "generateEmbedding");

    await expect(
      retrieveChunks({
        query: "mixed scope",
        openai: mockOpenAI,
        ragClient: mockRagClient,
        projectId: 60,
        businessAreaId: 17,
      }),
    ).rejects.toThrow(
      "projectId and businessAreaId are mutually exclusive search scopes",
    );

    expect(embeddingSpy).not.toHaveBeenCalled();
    expect(mockRagClient.rpc).not.toHaveBeenCalled();
  });

  it("should return normalized rows on success", async () => {
    const mockOpenAI = {} as OpenAI;
    const rpcRows: RagRow[] = [
      {
        id: "1",
        chunk_text: "test chunk",
        doc_title: "doc",
        similarity: 0.9,
      },
    ];
    const mockRagClient: MockRagClient = {
      rpc: jest.fn().mockResolvedValue({ data: rpcRows, error: null }),
    };

    jest
      .spyOn(toolUtils, "generateEmbedding")
      .mockResolvedValue('{"vector": "mocked"}');

    const result = await retrieveChunks({
      query: "test query",
      openai: mockOpenAI,
      ragClient: mockRagClient,
    });

    expect(result).toEqual(rpcRows);
  });

  it("should use default match_count and threshold", async () => {
    const mockOpenAI = {} as OpenAI;
    const mockRagClient: MockRagClient = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    jest
      .spyOn(toolUtils, "generateEmbedding")
      .mockResolvedValue('{"vector": "mocked"}');

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
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    jest
      .spyOn(toolUtils, "generateEmbedding")
      .mockResolvedValue('{"vector": "mocked"}');

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
