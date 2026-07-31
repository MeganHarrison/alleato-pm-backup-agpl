import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "../route";
import { authorizePlaneCycles } from "../../access";
import { asPlaneCyclesDb } from "@/features/plane-cycles-domain/server-db";

jest.mock("../../access", () => ({
  authorizePlaneCycles: jest.fn(),
}));

jest.mock("@/features/plane-cycles-domain/server-db", () => ({
  asPlaneCyclesDb: jest.fn(),
}));

const authorizeMock = authorizePlaneCycles as jest.MockedFunction<
  typeof authorizePlaneCycles
>;
const asDbMock = asPlaneCyclesDb as jest.MockedFunction<
  typeof asPlaneCyclesDb
>;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CYCLE_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";

function request() {
  return new NextRequest(
    "http://localhost/api/plane-cycles/memberships",
    {
      method: "POST",
      body: JSON.stringify({
        project_id: 31,
        cycle_id: CYCLE_ID,
        task_ids: [TASK_ID],
      }),
    },
  );
}

function setup(taskAssociation: {
  project_id: number | null;
  project_ids: number[] | null;
  document_metadata: { project_id: number | null } | null;
}) {
  const taskBuilder = {
    select: jest.fn(),
    in: jest.fn().mockResolvedValue({
      data: [{ id: TASK_ID, ...taskAssociation }],
      error: null,
    }),
  };
  taskBuilder.select.mockReturnValue(taskBuilder);

  const serviceClient = {
    from: jest.fn().mockReturnValue(taskBuilder),
  };
  authorizeMock.mockResolvedValue({
    user: { id: USER_ID, email: "member@example.com" },
    serviceClient,
    membership: {},
    userProfile: null,
  } as never);

  const cycleBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { id: CYCLE_ID },
      error: null,
    }),
  };
  cycleBuilder.select.mockReturnValue(cycleBuilder);
  cycleBuilder.eq.mockReturnValue(cycleBuilder);
  const membershipBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  membershipBuilder.select.mockReturnValue(membershipBuilder);
  membershipBuilder.eq.mockReturnValue(membershipBuilder);
  const rpc = jest.fn();
  asDbMock.mockReturnValue({
    from: jest.fn((table: string) =>
      table === "project_cycles" ? cycleBuilder : membershipBuilder,
    ),
    rpc,
  } as never);

  return { rpc };
}

describe("Plane cycle task memberships API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a cross-project task before atomic transfer", async () => {
    const { rpc } = setup({
      project_id: 32,
      project_ids: [32],
      document_metadata: { project_id: 32 },
    });

    const response = await POST(request(), { params: Promise.resolve({}) });

    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects ambiguous legacy ownership before atomic transfer", async () => {
    const { rpc } = setup({
      project_id: null,
      project_ids: [31],
      document_metadata: { project_id: 32 },
    });

    const response = await POST(request(), { params: Promise.resolve({}) });

    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts the canonical legacy fallback and invokes one atomic RPC", async () => {
    const { rpc } = setup({
      project_id: null,
      project_ids: [31],
      document_metadata: { project_id: 31 },
    });
    rpc.mockResolvedValue({ data: [{ task_id: TASK_ID }], error: null });

    const response = await POST(request(), { params: Promise.resolve({}) });

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("set_cycle_task_memberships", {
      p_project_id: 31,
      p_cycle_id: CYCLE_ID,
      p_task_ids: [TASK_ID],
      p_created_by: USER_ID,
    });
  });

  it.each([
    ["GET", GET],
    ["DELETE", DELETE],
  ] as const)(
    "returns 404 for %s when the project-scoped cycle does not exist",
    async (method, handler) => {
      const serviceClient = { from: jest.fn() };
      authorizeMock.mockResolvedValue({
        user: { id: USER_ID, email: "member@example.com" },
        serviceClient,
        membership: {},
        userProfile: null,
      } as never);

      const cycleBuilder = {
        select: jest.fn(),
        eq: jest.fn(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      cycleBuilder.select.mockReturnValue(cycleBuilder);
      cycleBuilder.eq.mockReturnValue(cycleBuilder);
      const membershipBuilder = {
        delete: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
      };
      membershipBuilder.delete.mockReturnValue(membershipBuilder);
      membershipBuilder.eq.mockReturnValue(membershipBuilder);
      membershipBuilder.in.mockReturnValue(membershipBuilder);
      asDbMock.mockReturnValue({
        from: jest.fn((table: string) =>
          table === "project_cycles" ? cycleBuilder : membershipBuilder,
        ),
      } as never);

      const response =
        method === "GET"
          ? await handler(
              new NextRequest(
                `http://localhost/api/plane-cycles/memberships?projectId=31&cycleId=${CYCLE_ID}`,
              ),
              { params: Promise.resolve({}) },
            )
          : await handler(
              new NextRequest(
                "http://localhost/api/plane-cycles/memberships",
                {
                  method: "DELETE",
                  body: JSON.stringify({
                    project_id: 31,
                    cycle_id: CYCLE_ID,
                    task_ids: [TASK_ID],
                  }),
                },
              ),
              { params: Promise.resolve({}) },
            );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: "Cycle not found.",
      });
      expect(membershipBuilder.delete).not.toHaveBeenCalled();
    },
  );
});
