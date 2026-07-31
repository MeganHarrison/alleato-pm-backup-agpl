process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { GET } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
  createRagServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.Mock;
const getApiRouteUserMock = getApiRouteUser as jest.Mock;
const createServiceClientMock = createServiceClient as jest.Mock;
const createRagServiceClientMock = createRagServiceClient as jest.Mock;

function buildRequest() {
  return new NextRequest(
    "http://localhost/api/projects/42/drawings/drawing-1/intelligence",
    { method: "GET" },
  );
}

function params() {
  return {
    params: Promise.resolve({ projectId: "42", drawingId: "drawing-1" }),
  };
}

function singleQuery(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
  };
}

function listQuery(data: unknown[], error: unknown = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data, error }),
  };
}

function chunkQuery(data: unknown[], error: unknown = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data, error }),
  };
}

function buildServiceClient({
  drawing,
  revisions = [],
  metadata = null,
  pages = [],
}: {
  drawing: unknown;
  revisions?: unknown[];
  metadata?: unknown;
  pages?: unknown[];
}) {
  const drawingQuery = singleQuery(drawing);
  const revisionsQuery = listQuery(revisions);
  const metadataQuery = singleQuery(metadata);
  const pagesQuery = listQuery(pages);

  return {
    from: jest.fn((table: string) => {
      if (table === "drawings") return drawingQuery;
      if (table === "drawing_revisions") return revisionsQuery;
      if (table === "document_metadata") return metadataQuery;
      if (table === "document_page_intelligence") return pagesQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
    __queries: { drawingQuery, revisionsQuery, metadataQuery, pagesQuery },
  };
}

function buildRagClient(chunks: unknown[]) {
  const chunksQuery = chunkQuery(chunks);
  return {
    from: jest.fn((table: string) => {
      if (table === "document_chunks") return chunksQuery;
      throw new Error(`Unexpected RAG table ${table}`);
    }),
    __queries: { chunksQuery },
  };
}

describe("/api/projects/[projectId]/drawings/[drawingId]/intelligence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("rejects unauthenticated inspection before service-role reads", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });
    getApiRouteUserMock.mockResolvedValue(null);

    const response = await GET(buildRequest(), params());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error_code).toBe("UNAUTHORIZED");
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(createRagServiceClientMock).not.toHaveBeenCalled();
  });

  it("returns explicit not-ready reasons when a drawing has no document metadata", async () => {
    const serviceClient = buildServiceClient({
      drawing: {
        id: "drawing-1",
        project_id: 42,
        drawing_number: "A101",
        title: "Floor plan",
        document_metadata_id: null,
        current_revision_id: null,
      },
    });
    createServiceClientMock.mockReturnValue(serviceClient);

    const response = await GET(buildRequest(), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.readiness.state).toBe("not_ready");
    expect(body.readiness.ocrTextReady).toBe(false);
    expect(body.readiness.visionReady).toBe(false);
    expect(body.readiness.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("no document metadata record"),
      ]),
    );
    expect(createRagServiceClientMock).not.toHaveBeenCalled();
  });

  it("separates OCR, visual AI, and retrieval evidence for processed drawings", async () => {
    const serviceClient = buildServiceClient({
      drawing: {
        id: "drawing-1",
        project_id: 42,
        drawing_number: "A101",
        title: "Floor plan",
        document_metadata_id: "doc-1",
        current_revision_id: "rev-1",
      },
      revisions: [
        {
          id: "rev-1",
          revision_number: "1",
          is_current_revision: true,
          document_metadata_id: "doc-1",
        },
      ],
      metadata: {
        id: "doc-1",
        title: "A101 Floor plan",
        status: "ocr_completed",
        document_type: "drawing",
        source_system: "drawings",
        file_name: "A101.pdf",
        storage_bucket: "documents",
        source_path: "drawings/A101.pdf",
        url: null,
        source_web_url: "https://example.test/A101.pdf",
        content: "Door schedule and fire stopping notes.",
        raw_text: null,
        created_at: "2026-06-24T12:00:00.000Z",
      },
      pages: [
        {
          page_number: 1,
          sheet_number: "A101",
          sheet_title: "Floor plan",
          discipline: "Architectural",
          scale: '1/8" = 1\'-0"',
          detail_references: ["A501/1"],
          implied_submittals: ["Doors"],
          notes_and_requirements: ["Provide fire-rated assemblies"],
          ai_summary: "Architectural floor plan with door and wall notes.",
          raw_extraction: { sheet: "A101" },
          vision_model: "gpt-4.1-mini",
          processed_at: "2026-06-24T12:05:00.000Z",
        },
      ],
    });
    const ragClient = buildRagClient([
      { chunk_index: 0, text: "Door schedule and hardware requirements." },
    ]);
    createServiceClientMock.mockReturnValue(serviceClient);
    createRagServiceClientMock.mockReturnValue(ragClient);

    const response = await GET(buildRequest(), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ocr).toMatchObject({
      ready: true,
      textLength: 38,
      textPreview: "Door schedule and fire stopping notes.",
    });
    expect(body.vision).toMatchObject({
      ready: true,
      pageCount: 1,
    });
    expect(body.vision.pages[0]).toEqual(
      expect.objectContaining({
        sheetNumber: "A101",
        aiSummary: "Architectural floor plan with door and wall notes.",
        impliedSubmittals: ["Doors"],
      }),
    );
    expect(body.retrieval).toMatchObject({
      ready: true,
      chunkCount: 1,
    });
    expect(body.readiness).toMatchObject({
      state: "ready",
      ocrTextReady: true,
      visionReady: true,
      embeddedReady: true,
      aiReviewReady: true,
    });
  });
});
