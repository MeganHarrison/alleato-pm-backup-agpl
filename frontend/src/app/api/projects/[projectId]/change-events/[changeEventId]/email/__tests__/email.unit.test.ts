/**
 * Regression tests for change-events email route — PDF attachment fallback.
 *
 * Root cause caught:
 *   Issue #193 — renderPdfFromHtml throws on Vercel (Puppeteer unavailable) →
 *   unhandled exception → 500 response → email silently not sent.
 *
 * Fix: wrap renderPdfFromHtml in try/catch; email sends without attachment on failure.
 * Commit: 24e1d0009
 *
 * "What would have caught this before it reached production?"
 *   This unit test. It mocks Puppeteer to throw and asserts the response is 200.
 *
 * "What guardrail is added now so this class of bug cannot recur?"
 *   1. This test fails if the try/catch is removed.
 *   2. Smoke contract entry in scripts/api-smoke-contracts.mjs catches endpoint regressions.
 *
 * Bucket: Should have been caught pre-deploy → this test is the guardrail.
 */

import { NextRequest } from "next/server";

// ── Mock heavy dependencies before any imports ─────────────────────────────

const mockSend = jest.fn();
const mockResendInstance = { emails: { send: mockSend } };
const MockResend = jest.fn().mockImplementation(() => mockResendInstance);

jest.mock("resend", () => ({
  Resend: MockResend,
}));

jest.mock("@/lib/documents/pdf", () => ({
  renderPdfFromHtml: jest.fn(),
  buildChangeEventHtml: jest.fn().mockReturnValue("<html><body>Test CE</body></html>"),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock permissions guard to always allow
jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn().mockResolvedValue({ denied: false, userId: "user-1", personId: "person-1" }),
}));

// Mock guardrails env validation so it doesn't try to read env vars
jest.mock("@/lib/guardrails/env", () => ({
  validateEnvVars: jest.fn(),
}));

// Mock supabase server client
const mockSingle = jest.fn();
const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "test-ce-uuid",
                number: "CE-001",
                title: "Test Change Event",
                status: "Open",
                project_id: 67,
                created_by: null,
                change_event_line_items: [],
              },
              error: null,
            }),
          }),
        }),
        single: mockSingle.mockResolvedValue({
          data: {
            id: 67,
            name: "Test Project",
            project_number: "P-001",
            address: "123 Test St",
            state: "CA",
          },
          error: null,
        }),
      }),
    }),
  }),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
  },
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabase),
  getApiRouteUser: jest.fn().mockResolvedValue({ id: "user-1", email: "test@example.com" }),
}));

function createServiceTable(table: string) {
  const insertResult =
    table === "email_events"
      ? { data: { id: "email-event-1" }, error: null }
      : { data: { id: "project-email-1" }, error: null };

  return {
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(insertResult),
      }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
}

const mockServiceClient = {
  from: jest.fn((table: string) => createServiceTable(table)),
};

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(() => mockServiceClient),
}));

// ── Imports after mocks ────────────────────────────────────────────────────

import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { logger } from "@/lib/logger";

// ── Test helpers ───────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    "http://localhost/api/projects/67/change-events/test-ce-uuid/email",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

async function callRoute(body: Record<string, unknown>) {
  // Import after all mocks are set up to get the mocked version
  const { POST } = await import("../route");
  const req = makeRequest(body);
  return POST(req, { params: Promise.resolve({ projectId: "67", changeEventId: "test-ce-uuid" }) });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("change-events email route — PDF attachment fallback (regression #193)", () => {
  const originalResendApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = "test-resend-key";
    // Default: Resend sends successfully
    mockSend.mockResolvedValue({ data: { id: "email-id-1" }, error: null });
    // Default: PDF generation succeeds
    (renderPdfFromHtml as jest.Mock).mockResolvedValue(Buffer.from("fake-pdf-content"));
  });

  afterAll(() => {
    if (originalResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey;
    }
  });

  /**
   * THE regression test — this is the exact failure path that caused issue #193.
   *
   * Before fix: renderPdfFromHtml threw → unhandled exception → 500
   * After fix:  try/catch catches → email sends without attachment → 200
   */
  it("sends email without PDF attachment when renderPdfFromHtml throws (Vercel/Puppeteer unavailable)", async () => {
    (renderPdfFromHtml as jest.Mock).mockRejectedValue(
      new Error("Cannot find module 'puppeteer-core'"),
    );

    const res = await callRoute({
      recipients: ["test@example.com"],
      subject: "Change Event CE-001",
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Verify email was sent without attachments
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [],
      }),
    );
  });

  it("logs the PDF error but does not propagate it when PDF generation fails", async () => {
    const pdfError = new Error("Puppeteer not available in Edge environment");
    (renderPdfFromHtml as jest.Mock).mockRejectedValue(pdfError);

    await callRoute({
      recipients: ["test@example.com"],
      subject: "Test Subject",
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining("PDF generation failed"),
        error: pdfError.message,
      }),
    );
  });

  it("sends email body without PDF claim when PDF generation fails", async () => {
    (renderPdfFromHtml as jest.Mock).mockRejectedValue(new Error("Puppeteer unavailable"));

    await callRoute({
      recipients: ["test@example.com"],
      subject: "Test Subject",
    });

    const sendCall = mockSend.mock.calls[0][0];
    // Should NOT claim PDF is attached when none was generated
    expect(sendCall.html).not.toContain("attached as a PDF");
    // Should include the dashboard fallback message
    expect(sendCall.html).toContain("project dashboard");
  });

  it("sends email with PDF attachment when renderPdfFromHtml succeeds", async () => {
    const fakePdf = Buffer.from("fake-pdf-binary");
    (renderPdfFromHtml as jest.Mock).mockResolvedValue(fakePdf);

    const res = await callRoute({
      recipients: ["test@example.com"],
      subject: "Change Event CE-001",
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: expect.stringMatching(/\.pdf$/),
            content: fakePdf.toString("base64"),
          }),
        ],
      }),
    );
  });

  it("returns 400 when recipients is empty", async () => {
    const res = await callRoute({ recipients: [], subject: "Test Subject" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("returns 400 when recipients is missing", async () => {
    const res = await callRoute({ subject: "Test Subject" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("returns 400 for an invalid email address in recipients", async () => {
    const res = await callRoute({
      recipients: ["not-a-valid-email"],
      subject: "Test Subject",
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/not-a-valid-email/);
  });

  it("returns 400 when subject is missing", async () => {
    const res = await callRoute({ recipients: ["test@example.com"], subject: "" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});
