process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { GET } from "../route";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));
jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: (value: unknown) => value instanceof Response,
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const verifyProjectAccessMock = verifyProjectAccess as jest.MockedFunction<typeof verifyProjectAccess>;
const context = { params: Promise.resolve({ projectId: "43" }) };

function revisionQuery(result: { data: unknown; error: unknown }) {
  const value = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), maybeSingle: jest.fn() };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  value.order.mockReturnValue(value);
  value.maybeSingle.mockResolvedValue(result);
  return value;
}

function listQuery(result: { data: unknown; error: unknown }) {
  const value = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    then: (resolve: (result: { data: unknown; error: unknown }) => unknown) => Promise.resolve(result).then(resolve),
  };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  value.in.mockReturnValue(value);
  value.order.mockReturnValue(value);
  return value;
}

function riskQuery(result: { data: unknown; error: unknown }) {
  const value = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    maybeSingle: jest.fn(),
    then: (resolve: (result: { data: unknown; error: unknown }) => unknown) => Promise.resolve(result).then(resolve),
  };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  value.order.mockReturnValue(value);
  value.maybeSingle.mockResolvedValue(result);
  return value;
}

describe("consolidated schedule reports API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unsupported report instead of silently selecting one", async () => {
    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/reports?view=unknown"), context);
    expect(response.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(verifyProjectAccessMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated lookahead before reading schedule state", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/reports?view=lookahead&weeks=2&start_date=2026-08-03"), context);
    expect(response.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("fails loudly when a lookahead has no published revision", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const projects = revisionQuery({ data: { current_schedule_revision_id: null }, error: null });
    const from = jest.fn().mockReturnValue(projects);
    createClientMock.mockResolvedValue({ from } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/reports?view=lookahead&weeks=2&start_date=2026-08-03"), context);
    expect(response.status).toBe(404);
    expect(from).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error_code: "NOT_FOUND",
      error_message: "No published schedule revision is available for this report.",
    });
  });

  it("projects a lookahead only from the pointed revision and frozen submittal snapshots", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const revisionId = "11111111-1111-4111-8111-111111111111";
    const project = revisionQuery({ data: { current_schedule_revision_id: revisionId }, error: null });
    const revision = revisionQuery({ data: { id: revisionId, project_id: 43, revision_number: 7, status: "published", snapshot_context_provenance: "captured" }, error: null });
    const tasks = listQuery({ data: [{
      source_task_id: "task-1",
      name: "Release steel",
      start_date: "2026-08-04",
      finish_date: "2026-08-10",
      forecast_start_date: null,
      forecast_finish_date: null,
      is_milestone: false,
      constraint_type: null,
      constraint_date: null,
    }], error: null });
    const dependencies = listQuery({ data: [], error: null });
    const submittals = listQuery({ data: [{
      source_task_id: "task-1",
      submittal_id: "submittal-1",
      submittal_number: "05 12 00-1",
      title: "Structural steel",
      submittal_status: "Rejected",
      required_approval_date: "2026-08-03",
      response_statuses: [],
    }], error: null });
    const from = jest.fn()
      .mockReturnValueOnce(project)
      .mockReturnValueOnce(revision)
      .mockReturnValueOnce(tasks)
      .mockReturnValueOnce(dependencies)
      .mockReturnValueOnce(submittals);
    createClientMock.mockResolvedValue({ from } as never);

    const response = await GET(new NextRequest(`http://localhost/api/projects/43/scheduling/reports?view=lookahead&weeks=2&start_date=2026-08-03&revision_id=${revisionId}`), context);
    expect(response.status).toBe(200);
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "projects",
      "schedule_revisions",
      "schedule_revision_task_snapshots",
      "schedule_revision_dependency_snapshots",
      "schedule_revision_submittal_snapshots",
    ]);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        revisionId,
        revisionNumber: 7,
        snapshotProvenance: "captured",
        activities: [{
          sourceTaskId: "task-1",
          submittalRisk: {
            status: "at_risk",
            blocking_submittal_id: "submittal-1",
            reason: "Submittal 05 12 00-1 is rejected.",
          },
        }],
      },
    });
  });

  it("returns an explicit unavailable risk state without a published revision", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const projects = riskQuery({ data: { current_schedule_revision_id: null }, error: null });
    createClientMock.mockResolvedValue({ from: jest.fn().mockReturnValue(projects) } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/reports?view=risk"), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { state: "unavailable", reason: "No published schedule revision is available for this summary." } });
  });

  it("builds risks only from the pointed published snapshot and exposes canonical sources", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const revisionId = "11111111-1111-4111-8111-111111111111";
    const from = jest.fn()
      .mockReturnValueOnce(riskQuery({ data: { current_schedule_revision_id: revisionId }, error: null }))
      .mockReturnValueOnce(riskQuery({ data: { id: revisionId, revision_number: 7 }, error: null }))
      .mockReturnValueOnce(riskQuery({ data: [{ source_task_id: "task-1", name: "Place foundation", start_date: "2026-08-02", forecast_start_date: null, forecast_finish_date: "2026-08-08", constraint_type: "finish_no_later_than", constraint_date: "2026-08-07" }], error: null }))
      .mockReturnValueOnce(riskQuery({ data: [], error: null }))
      .mockReturnValueOnce(riskQuery({ data: [{ source_task_id: "task-1", submittal_id: "submittal-1", submittal_number: "03 30 00-1", title: "Concrete mix", submittal_status: "Rejected", required_approval_date: "2026-08-01", response_statuses: [] }], error: null }));
    createClientMock.mockResolvedValue({ from } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/reports?view=risk"), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: {
      state: "ready",
      revisionId,
      revisionNumber: 7,
      risks: [
        { kind: "constraint", source: { href: "/43/schedule?task_id=task-1", label: "Place foundation" } },
        { kind: "submittal", source: { href: "/43/submittals/submittal-1", label: "View submittal" } },
      ],
    } });
  });

  it("returns no mutable trade activities when there is no published revision", async () => {
    const revisions = revisionQuery({ data: null, error: null });
    const serviceClient = { from: jest.fn().mockReturnValue(revisions) };
    verifyProjectAccessMock.mockResolvedValue({ membership: { personId: "person-electric", projectId: 43 }, serviceClient } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/reports?view=trade-activities"), context);
    expect(response.status).toBe(404);
    expect(revisions.eq).toHaveBeenCalledWith("status", "published");
    expect(serviceClient.from).toHaveBeenCalledTimes(1);
  });

  it("filters published trade activities to active project members in the caller's company", async () => {
    const revision = revisionQuery({ data: { id: "revision-2", status: "published" }, error: null });
    const actor = revisionQuery({
      data: {
        company_id: "company-trade",
        company: { name: "Trade Partners LLC" },
      },
      error: null,
    });
    const people = listQuery({
      data: [{ id: "person-electric" }, { id: "person-foreman" }, { id: "person-off-project" }],
      error: null,
    });
    const memberships = listQuery({
      data: [
        { person_id: "person-electric" },
        { person_id: "person-foreman" },
      ],
      error: null,
    });
    const tasks = listQuery({
      data: [
        {
          source_task_id: "electrical",
          name: "Electrical",
          assignee_person_id: "person-electric",
        },
        {
          source_task_id: "foreman",
          name: "Foreman inspection",
          assignee_person_id: "person-foreman",
        },
      ],
      error: null,
    });
    const serviceClient = {
      from: jest.fn()
        .mockReturnValueOnce(revision)
        .mockReturnValueOnce(actor)
        .mockReturnValueOnce(people)
        .mockReturnValueOnce(memberships)
        .mockReturnValueOnce(tasks),
    };
    verifyProjectAccessMock.mockResolvedValue({ membership: { personId: "person-electric", projectId: 43 }, serviceClient } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/reports?view=trade-activities"), context);
    expect(response.status).toBe(200);
    expect(actor.select).toHaveBeenCalledWith(
      "company_id, company:companies!people_company_id_fkey(name)",
    );
    expect(memberships.in).toHaveBeenCalledWith("person_id", [
      "person-electric",
      "person-foreman",
      "person-off-project",
    ]);
    expect(tasks.in).toHaveBeenCalledWith("assignee_person_id", [
      "person-electric",
      "person-foreman",
    ]);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          sourceTaskId: "electrical",
          name: "Electrical",
          assigneePersonId: "person-electric",
        },
        {
          sourceTaskId: "foreman",
          name: "Foreman inspection",
          assigneePersonId: "person-foreman",
        },
      ],
      revisionId: "revision-2",
      visibility: {
        type: "company",
        companyId: "company-trade",
        label: "Trade Partners LLC",
      },
    });
  });

  it("falls back to the caller's assignments when no company identity exists", async () => {
    const revision = revisionQuery({
      data: { id: "revision-2", status: "published" },
      error: null,
    });
    const actor = revisionQuery({
      data: { company_id: null, company: null },
      error: null,
    });
    const tasks = listQuery({
      data: [
        {
          source_task_id: "electrical",
          name: "Electrical",
          assignee_person_id: "person-electric",
        },
      ],
      error: null,
    });
    const serviceClient = {
      from: jest.fn()
        .mockReturnValueOnce(revision)
        .mockReturnValueOnce(actor)
        .mockReturnValueOnce(tasks),
    };
    verifyProjectAccessMock.mockResolvedValue({
      membership: { personId: "person-electric", projectId: 43 },
      serviceClient,
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/projects/43/scheduling/reports?view=trade-activities",
      ),
      context,
    );

    expect(response.status).toBe(200);
    expect(tasks.in).toHaveBeenCalledWith("assignee_person_id", [
      "person-electric",
    ]);
    await expect(response.json()).resolves.toMatchObject({
      visibility: {
        type: "person",
        companyId: null,
        label: "Your assignments",
      },
    });
  });

  it("fails loudly when the caller's company identity cannot be verified", async () => {
    const revision = revisionQuery({
      data: { id: "revision-2", status: "published" },
      error: null,
    });
    const actor = revisionQuery({
      data: null,
      error: { code: "XX000", message: "People directory unavailable" },
    });
    const serviceClient = {
      from: jest.fn()
        .mockReturnValueOnce(revision)
        .mockReturnValueOnce(actor),
    };
    verifyProjectAccessMock.mockResolvedValue({
      membership: { personId: "person-electric", projectId: 43 },
      serviceClient,
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/projects/43/scheduling/reports?view=trade-activities",
      ),
      context,
    );

    expect(response.status).toBe(500);
    expect(serviceClient.from).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error_code: "DB_ERROR",
      error_message: "People directory unavailable",
    });
  });
});
