process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { ScheduleResourceService } from "@/lib/services/schedule-resource-service";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/services/schedule-resource-service", () => ({
  ...jest.requireActual("@/lib/services/schedule-resource-service"),
  ScheduleResourceService: jest.fn(),
}));

const createLevelingRun = jest.fn();
const params = Promise.resolve({ projectId: "67" });

describe("authoritative resource leveling preview route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getApiRouteUser as jest.Mock).mockResolvedValue({ id: "user-1" });
    (createClient as jest.Mock).mockResolvedValue({});
    (createServiceClient as jest.Mock).mockReturnValue({ trusted: true });
    (ScheduleResourceService as jest.Mock).mockImplementation(() => ({
      createLevelingRun,
    }));
  });

  it("accepts only a leveling horizon and delegates calculation to the server service", async () => {
    createLevelingRun.mockResolvedValue({
      preview: { proposals: [], diagnostics: [] },
      run: null,
    });
    const body = {
      range_start: "2026-08-03T00:00:00.000Z",
      range_finish: "2026-08-31T00:00:00.000Z",
    };
    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/67/scheduling/resource-leveling-runs",
        { method: "POST", body: JSON.stringify(body) },
      ),
      { params },
    );

    expect(response.status).toBe(201);
    expect(createLevelingRun).toHaveBeenCalledWith(67, body, {
      client: { trusted: true },
      actorUserId: "user-1",
    });
  });

  it("rejects client-authored task changes and revision vectors", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/67/scheduling/resource-leveling-runs",
        {
          method: "POST",
          body: JSON.stringify({
            range_start: "2026-08-03T00:00:00.000Z",
            range_finish: "2026-08-31T00:00:00.000Z",
            changes: [{ task_id: "22222222-2222-4222-8222-222222222222" }],
            person_revision_vector: {},
          }),
        },
      ),
      { params },
    );

    expect(response.status).toBe(400);
    expect(createLevelingRun).not.toHaveBeenCalled();
  });
});
