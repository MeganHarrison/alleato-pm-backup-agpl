import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingService } from "@/services/DrawingService";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/services/DrawingService", () => ({
  DrawingService: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;
const DrawingServiceMock = DrawingService as jest.MockedClass<typeof DrawingService>;

function buildExistingDrawingQuery(existing: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: existing, error: null }),
  };
}

function buildServiceClient(existing: unknown) {
  const existingDrawingQuery = buildExistingDrawingQuery(existing);
  const documentMetadataInsert = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: "doc-meta-1" }, error: null }),
  };
  const drawingUpdate = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  };
  const storageBucket = {
    getPublicUrl: jest.fn((path: string) => ({
      data: { publicUrl: `https://storage.example/${path}` },
    })),
    remove: jest.fn().mockResolvedValue({ error: null }),
  };

  return {
    from: jest.fn((table: string) => {
      if (table === "drawings") return existingDrawingQuery;
      if (table === "document_metadata") return documentMetadataInsert;
      if (table === "drawing_revisions") return drawingUpdate;
      throw new Error(`Unexpected table ${table}`);
    }),
    storage: {
      from: jest.fn(() => storageBucket),
    },
    __queries: { existingDrawingQuery, documentMetadataInsert, drawingUpdate },
    __storageBucket: storageBucket,
  };
}

function buildService(overrides: Partial<Record<keyof DrawingService, jest.Mock>> = {}) {
  return {
    create: jest.fn().mockResolvedValue({ data: { id: "drawing-new" }, error: null }),
    createRevision: jest
      .fn()
      .mockResolvedValue({ data: { id: "revision-new" }, error: null }),
    getById: jest.fn().mockResolvedValue({
      data: {
        id: "drawing-new",
        drawing_number: "A101",
        current_revision: { id: "revision-new" },
      },
      error: null,
    }),
    unpublish: jest.fn().mockResolvedValue({ data: { id: "drawing-new" }, error: null }),
    delete: jest.fn().mockResolvedValue({ data: undefined, error: null }),
    uploadFile: jest.fn(),
    ...overrides,
  };
}

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/projects/42/drawings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      drawing_number: "A101",
      title: "First Floor Plan",
      revision_number: "1",
      received_date: "2026-06-23T12:00:00.000Z",
      upload_path: "drawings/A101.pdf",
      file_name: "A101.pdf",
      file_size: 12345,
      file_type: "application/pdf",
      ...body,
    }),
  });
}

describe("/api/projects/[projectId]/drawings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
    } as never);
  });

  it("creates first-time uploads as unpublished under-review drawings", async () => {
    const serviceClient = buildServiceClient(null);
    const service = buildService();
    createServiceClientMock.mockReturnValue(serviceClient as never);
    DrawingServiceMock.mockImplementation(() => service as never);

    const response = await POST(
      buildRequest({
        rotation_degrees: 90,
        ocr_confidence_label: "high",
        ocr_confidence_score: 0.85,
        ocr_confidence_source: "filename",
      }),
      {
        params: Promise.resolve({ projectId: "42" }),
      },
    );

    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(
      "42",
      expect.objectContaining({
        drawing_number: "A101",
        is_published: false,
      }),
      "user-1",
    );
    expect(service.createRevision).toHaveBeenCalledWith(
      "drawing-new",
      expect.objectContaining({
        revision_number: "1",
        status: "under_review",
        is_current_revision: true,
        update_review_revision: true,
        update_current_revision: true,
        file_url: "https://storage.example/drawings/A101.pdf",
        rotation_degrees: 90,
        ocr_confidence_label: "high",
        ocr_confidence_score: 0.85,
        ocr_confidence_source: "filename",
      }),
      "user-1",
    );
  });

  it("creates a new revision when the drawing number already exists", async () => {
    const existingDrawing = {
      id: "drawing-existing",
      drawing_number: "A101",
      title: "First Floor Plan",
      is_published: true,
    };
    const serviceClient = buildServiceClient(existingDrawing);
    const service = buildService({
      getById: jest.fn().mockResolvedValue({
        data: {
          id: "drawing-existing",
          drawing_number: "A101",
          current_revision: { id: "revision-new" },
        },
        error: null,
      }),
    });
    createServiceClientMock.mockReturnValue(serviceClient as never);
    DrawingServiceMock.mockImplementation(() => service as never);

    const response = await POST(
      buildRequest({
        revision_number: "2",
        rotation_degrees: 180,
        ocr_confidence_label: "medium",
        ocr_confidence_score: 0.6,
        ocr_confidence_source: "ocr",
      }),
      {
        params: Promise.resolve({ projectId: "42" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.createRevision).toHaveBeenCalledWith(
      "drawing-existing",
      expect.objectContaining({
        revision_number: "2",
        status: "under_review",
        is_current_revision: true,
        update_review_revision: true,
        update_current_revision: false,
        file_url: "https://storage.example/drawings/A101.pdf",
        rotation_degrees: 180,
        ocr_confidence_label: "medium",
        ocr_confidence_score: 0.6,
        ocr_confidence_source: "ocr",
      }),
      "user-1",
    );
    expect(service.unpublish).not.toHaveBeenCalled();
    expect(body).toEqual(
      expect.objectContaining({
        id: "drawing-existing",
        revision_created: true,
        logical_drawing_created: false,
      }),
    );
  });

  it("normalizes unsupported rotation and confidence values before creating revisions", async () => {
    const serviceClient = buildServiceClient(null);
    const service = buildService();
    createServiceClientMock.mockReturnValue(serviceClient as never);
    DrawingServiceMock.mockImplementation(() => service as never);

    const response = await POST(
      buildRequest({
        rotation_degrees: 45,
        ocr_confidence_label: "certain",
        ocr_confidence_score: 3,
        ocr_confidence_source: "guess",
      }),
      {
        params: Promise.resolve({ projectId: "42" }),
      },
    );

    expect(response.status).toBe(201);
    expect(service.createRevision).toHaveBeenCalledWith(
      "drawing-new",
      expect.objectContaining({
        rotation_degrees: 0,
        ocr_confidence_label: "unknown",
        ocr_confidence_score: null,
        ocr_confidence_source: "not_run",
      }),
      "user-1",
    );
  });
});
