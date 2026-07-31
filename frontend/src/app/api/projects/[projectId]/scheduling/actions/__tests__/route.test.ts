process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { ScheduleResourceService, ScheduleResourceServiceError } from "@/lib/services/schedule-resource-service";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));
jest.mock("@/lib/services/schedule-resource-service", () => ({
  ...jest.requireActual("@/lib/services/schedule-resource-service"),
  ScheduleResourceService: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const context = { params: Promise.resolve({ projectId: "43" }) };
const baselineId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
const runId = "44444444-4444-4444-8444-444444444444";
const eventId = "55555555-5555-4555-8555-555555555555";

function postAction(body: object) {
  return POST(
    new NextRequest("http://localhost/api/projects/43/scheduling/actions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    context,
  );
}

describe("scheduling actions dispatcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
  });

  it("rejects an unrecognized action shape before any RPC or service call", async () => {
    const rpc = jest.fn();
    createClientMock.mockResolvedValue({ rpc } as never);
    const response = await postAction({ entity_type: "baseline", action: "delete", entity_id: baselineId });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  describe("baseline activate", () => {
    it("activates only through the project-scoped manager RPC", async () => {
      const rpc = jest.fn().mockResolvedValue({ data: { id: baselineId, is_active: true }, error: null });
      createClientMock.mockResolvedValue({ rpc } as never);
      const response = await postAction({ entity_type: "baseline", action: "activate", entity_id: baselineId });
      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("activate_schedule_baseline", { p_project_id: 43, p_baseline_id: baselineId });
    });

    it("maps a cross-project or missing baseline to not found", async () => {
      const rpc = jest.fn().mockResolvedValue({ data: null, error: { code: "P0002", message: "Baseline not found in this project." } });
      createClientMock.mockResolvedValue({ rpc } as never);
      const response = await postAction({ entity_type: "baseline", action: "activate", entity_id: baselineId });
      expect(response.status).toBe(404);
    });
  });

  describe("revision transition", () => {
    it("rejects a malformed status before the database RPC", async () => {
      const rpc = jest.fn();
      createClientMock.mockResolvedValue({ rpc } as never);
      const response = await postAction({ entity_type: "revision", action: "transition", entity_id: revisionId, payload: { status: "draft" } });
      expect(response.status).toBe(400);
      expect(rpc).not.toHaveBeenCalled();
    });

    it("transitions through the guarded revision RPC", async () => {
      const rpc = jest.fn().mockResolvedValue({ data: { id: revisionId, status: "review" }, error: null });
      createClientMock.mockResolvedValue({ rpc } as never);
      const response = await postAction({ entity_type: "revision", action: "transition", entity_id: revisionId, payload: { status: "review" } });
      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("transition_schedule_revision", { p_project_id: 43, p_revision_id: revisionId, p_to_status: "review" });
    });
  });

  describe("resource leveling run apply", () => {
    const applyLevelingRun = jest.fn();
    beforeEach(() => {
      (createClient as jest.Mock).mockResolvedValue({});
      (ScheduleResourceService as jest.Mock).mockImplementation(() => ({ applyLevelingRun }));
    });

    it("applies a saved run through the guarded service", async () => {
      applyLevelingRun.mockResolvedValue({ event: { id: "event-1", event_type: "applied" } });
      const response = await postAction({ entity_type: "resource_leveling_run", action: "apply", entity_id: runId, payload: { reason: "Resolve overload" } });
      expect(response.status).toBe(200);
      expect(applyLevelingRun).toHaveBeenCalledWith(43, runId, "Resolve overload");
    });

    it("returns 409 when the preview is stale", async () => {
      applyLevelingRun.mockRejectedValue(new ScheduleResourceServiceError(
        "The schedule changed after preview.",
        "rpc",
        { code: "PT409", message: "The schedule changed after preview." },
      ));
      const response = await postAction({ entity_type: "resource_leveling_run", action: "apply", entity_id: runId, payload: { reason: null } });
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({ error_code: "PRECONDITION_FAILED" });
    });
  });

  describe("resource leveling event undo", () => {
    const undoLevelingEvent = jest.fn();
    beforeEach(() => {
      (createClient as jest.Mock).mockResolvedValue({});
      (ScheduleResourceService as jest.Mock).mockImplementation(() => ({ undoLevelingEvent }));
    });

    it("undoes an applied event through the guarded service", async () => {
      undoLevelingEvent.mockResolvedValue({ event: { id: eventId, event_type: "undone" } });
      const response = await postAction({ entity_type: "resource_leveling_event", action: "undo", entity_id: eventId, payload: { reason: "Restore schedule" } });
      expect(response.status).toBe(200);
      expect(undoLevelingEvent).toHaveBeenCalledWith(43, eventId, "Restore schedule");
    });
  });
});
