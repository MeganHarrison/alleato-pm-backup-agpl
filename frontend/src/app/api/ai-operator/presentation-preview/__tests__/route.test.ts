process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { POST } from "../route";

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/ai-operator/presentation-preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/ai-operator/presentation-preview", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("renders a no-send Teams card preview", async () => {
    process.env.VERCEL_ENV = "development";

    const response = await POST(
      request({
        operatorId: "owner-comms",
        approvalId: "approval-123",
        title: "Approve Teams message",
        body: "Send the owner-facing change order approval message.",
        priority: "high",
        actions: [
          {
            id: "approve",
            label: "Approve",
            kind: "submit",
            value: "approve",
            style: "positive",
            affordance: "button",
            priority: 90,
          },
        ],
      }),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      card: {
        type: "AdaptiveCard",
        actions: [
          {
            type: "Action.Submit",
            title: "Approve",
          },
        ],
      },
      metadata: {
        operatorId: "owner-comms",
        approvalId: "approval-123",
        renderedActionIds: ["approve"],
      },
    });
  });

  it("fails loudly with validation details", async () => {
    process.env.VERCEL_ENV = "development";

    const response = await POST(
      request({
        operatorId: "",
        approvalId: "approval-123",
        title: "",
        body: "No actions.",
        actions: [],
      }),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error_code: "INVALID_OPERATOR_MESSAGE",
      field_errors: {
        operatorId: expect.any(Array),
        title: expect.any(Array),
        actions: expect.any(Array),
      },
    });
  });

  it("is disabled in production", async () => {
    process.env.VERCEL_ENV = "production";

    const response = await POST(
      request({
        operatorId: "owner-comms",
        approvalId: "approval-123",
        title: "Approve",
        body: "Body",
        actions: [{ id: "approve", label: "Approve" }],
      }),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      success: false,
      error_code: "FORBIDDEN",
      where_it_failed: "/api/ai-operator/presentation-preview#POST",
    });
  });
});
