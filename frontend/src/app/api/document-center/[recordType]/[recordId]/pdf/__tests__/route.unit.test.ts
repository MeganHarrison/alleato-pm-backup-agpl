import { NextRequest } from "next/server";

jest.mock("@/lib/guardrails/env", () => ({
  validateEnvVars: jest.fn(),
}));

jest.mock("@/lib/documents/pdf", () => ({
  renderPdfFromHtml: jest.fn(),
}));

jest.mock("@/lib/documents/record-documents", () => ({
  getDocumentPdfOptions: jest.fn(),
  getDocumentBundle: jest.fn(),
  renderDocumentHtml: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUserFromRequest: jest
    .fn()
    .mockResolvedValue({ id: "user-1", email: "test@example.com" }),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn().mockReturnValue({}),
}));

import { renderPdfFromHtml } from "@/lib/documents/pdf";
import {
  getDocumentBundle,
  getDocumentPdfOptions,
  renderDocumentHtml,
} from "@/lib/documents/record-documents";
import { logger } from "@/lib/logger";

function makeRequest() {
  return new NextRequest("http://localhost/api/document-center/commitment/test-id/pdf", {
    method: "GET",
  });
}

async function callRoute() {
  const { GET } = await import("../route");
  return GET(makeRequest(), {
    params: Promise.resolve({ recordType: "commitment", recordId: "test-id" }),
  });
}

describe("document-center pdf route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDocumentBundle as jest.Mock).mockResolvedValue({
      recordType: "commitment",
      recordId: "test-id",
      filename: "commitment-test.pdf",
    });
    (getDocumentPdfOptions as jest.Mock).mockReturnValue({});
    (renderDocumentHtml as jest.Mock).mockReturnValue("<html><head></head><body><main>Commitment</main></body></html>");
  });

  it("returns a PDF when server-side rendering succeeds", async () => {
    (renderPdfFromHtml as jest.Mock).mockResolvedValue(Buffer.from("fake-pdf"));

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("commitment-test.pdf");
    expect(logger.error).not.toHaveBeenCalled();
    expect(renderPdfFromHtml).toHaveBeenCalledWith(expect.any(String), {});
  });

  it("returns a 500 JSON error when PDF rendering fails", async () => {
    (renderPdfFromHtml as jest.Mock).mockRejectedValue(new Error("Puppeteer unavailable"));

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual(
      expect.objectContaining({
        error: "PDF generation failed",
        details: "Puppeteer unavailable",
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining("PDF generation failed"),
        recordType: "commitment",
        recordId: "test-id",
      }),
    );
  });
});
