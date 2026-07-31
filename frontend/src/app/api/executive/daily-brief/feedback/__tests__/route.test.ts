const mockRequireCurrentUserAppCapability = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn(() => ({ select: () => ({ single: mockSingle }) }));
const mockCreateServiceClient = jest.fn(() => ({
  from: () => ({ insert: mockInsert }),
}));

jest.mock("@/lib/app-capabilities", () => ({
  requireCurrentUserAppCapability: (...args: unknown[]) =>
    mockRequireCurrentUserAppCapability(...args),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: (...args: unknown[]) =>
    mockCreateServiceClient(...args),
}));

import { NextRequest } from "next/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { POST } from "../route";

function postRequest(body: unknown) {
  return new NextRequest(
    "http://localhost/api/executive/daily-brief/feedback",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const validBody = {
  subjectId: "uc-solar-decision",
  signal: "positive" as const,
  title: "Force the Union Collective solar decision",
  project: "Union Collective",
};

describe("POST /api/executive/daily-brief/feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireCurrentUserAppCapability.mockResolvedValue({
      user: { id: "user-1" },
      access: {},
    });
    mockSingle.mockResolvedValue({ data: { id: "evt-1" }, error: null });
  });

  it("gates on view_executive_briefing before writing feedback", async () => {
    mockRequireCurrentUserAppCapability.mockRejectedValue(
      new GuardrailError({
        code: "FORBIDDEN",
        where: "api.executive.daily-brief.feedback.POST",
        message: "Daily Brief access required.",
        status: 403,
      }),
    );

    const response = await POST(postRequest(validBody));

    expect(response.status).toBe(403);
    // The capability check must run before any insert into the AI learning loop.
    expect(mockRequireCurrentUserAppCapability).toHaveBeenCalledWith(
      "view_executive_briefing",
      "api.executive.daily-brief.feedback.POST",
      "Daily Brief access required.",
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("records the feedback event for an authorized user", async () => {
    const response = await POST(postRequest(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      eventId: "evt-1",
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_family: "packet_quality",
        subject_type: "daily_brief_item",
        subject_id: "uc-solar-decision",
        signal: "positive",
        user_id: "user-1",
      }),
    );
  });

  it("rejects an invalid signal without inserting", async () => {
    const response = await POST(
      postRequest({ subjectId: "x", signal: "bogus" }),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking the raw DB error to the client", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "violates not-null constraint on ai_feedback_events" },
    });

    const response = await POST(postRequest(validBody));
    const json = await response.json();

    expect(response.status).toBe(500);
    // The client envelope carries the message under `error_message` — it must be
    // the generic text, never the raw Supabase error (anywhere in the payload).
    expect(json.error_message).toBe("Failed to record brief feedback.");
    expect(JSON.stringify(json)).not.toContain("not-null constraint");
  });

  it("carries the item metadata into after_snapshot for the learning loop", async () => {
    await POST(postRequest(validBody));

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        after_snapshot: {
          title: "Force the Union Collective solar decision",
          project: "Union Collective",
          signal: "positive",
        },
      }),
    );
  });
});
