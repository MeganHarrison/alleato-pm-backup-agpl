import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/tasks/task-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("tasks PATCH route validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  });

  it("rejects invalid statuses before writing to Supabase", async () => {
    const response = await PATCH(makePatchRequest({ status: "completed" }), {
      params: Promise.resolve({ taskId: "task-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: "Invalid request body" }),
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects invalid priorities before writing to Supabase", async () => {
    const response = await PATCH(makePatchRequest({ priority: "normal" }), {
      params: Promise.resolve({ taskId: "task-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: "Invalid request body" }),
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
