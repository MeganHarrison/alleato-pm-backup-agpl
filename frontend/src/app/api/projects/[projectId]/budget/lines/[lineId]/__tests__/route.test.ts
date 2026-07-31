import { NextRequest } from "next/server";
import { PATCH, DELETE } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    "http://localhost/api/projects/42/budget/lines/line-1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeDeleteRequest(): NextRequest {
  return new NextRequest(
    "http://localhost/api/projects/42/budget/lines/line-1",
    { method: "DELETE" },
  );
}

describe("budget line PATCH route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
    requirePermissionMock.mockResolvedValue({
      denied: false,
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("returns 401 instead of throwing when no authenticated user exists", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await PATCH(
      makePatchRequest({ quantity: 10, unit_cost: 25, original_amount: 250 }),
      {
        params: Promise.resolve({ projectId: "42", lineId: "line-1" }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error_code: "AUTH_EXPIRED" }),
    );
  });

  it("persists unit_of_measure when the client submits it", async () => {
    const updateSpy = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: "line-1",
              quantity: 3,
              unit_cost: 3921,
              unit_of_measure: "ea",
              description: "Line item",
              original_amount: 11763,
              updated_at: "2026-07-03T22:00:00.000Z",
              updated_by: "user-1",
            },
            error: null,
          }),
        }),
      }),
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "projects") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { budget_locked: false },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "budget_lines") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest
                  .fn()
                  .mockResolvedValueOnce({
                    data: {
                      id: "line-1",
                      project_id: 42,
                      quantity: null,
                      unit_cost: null,
                      unit_of_measure: null,
                      description: "Line item",
                      original_amount: 11763,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await PATCH(
      makePatchRequest({
        quantity: 3,
        unit_of_measure: "ea",
        unit_cost: 3921,
        original_amount: 11763,
      }),
      {
        params: Promise.resolve({ projectId: "42", lineId: "line-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 3,
        unit_cost: 3921,
        unit_of_measure: "ea",
        original_amount: 11763,
      }),
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        lineItem: expect.objectContaining({
          unit_of_measure: "ea",
        }),
      }),
    );
  });
});

// ─── DELETE route guards ────────────────────────────────────────────────────
// Procore-parity rules (parity-audit tests 1.3.1–1.3.4):
//   • Block delete when the budget is locked        (BUDGET_LOCKED, 403)
//   • Block delete when original_amount > 0         (LINE_HAS_BUDGET, 409)
//   • Block delete when active modifications exist  (LINE_HAS_ACTIVE_MODIFICATIONS, 409)
//   • Allow delete when budget unlocked + amount $0 + no active mods
//
// These tests are the regression guard required by the Bug Fix Completion
// Gate — without them, a future refactor could silently re-allow deletes
// that flow around Procore's rules.

type SupabaseFromMock = jest.Mock & { mockReturnThis: () => SupabaseFromMock };

interface QueryBuilderShape {
  select: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  single: jest.Mock;
  delete: jest.Mock;
  insert?: jest.Mock;
  update?: jest.Mock;
}

/**
 * Build a Supabase mock whose `from(table)` dispatch is driven by a per-table
 * map. Each table maps to an array of "single()" results consumed in order so
 * a single test can describe a multi-step query sequence (project -> line ->
 * modifications -> delete) without the test reading like a tower of mocks.
 */
function buildSupabaseMock(
  steps: Record<
    string,
    Array<
      | { single: { data: unknown; error: null | { message: string; code?: string } } }
      | { delete: { error: null | { message: string } } }
      | { listResult: { data: unknown; error: null | { message: string } } }
    >
  >,
) {
  const cursors: Record<string, number> = {};

  const fromMock: SupabaseFromMock = jest.fn((table: string) => {
    const tableSteps = steps[table];
    if (!tableSteps) {
      throw new Error(`Unexpected supabase.from("${table}") call in test`);
    }
    const idx = cursors[table] ?? 0;
    cursors[table] = idx + 1;
    const step = tableSteps[idx];
    if (!step) {
      throw new Error(
        `No more queued responses for supabase.from("${table}") (call #${idx + 1})`,
      );
    }

    const builder: QueryBuilderShape = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      delete: jest.fn().mockReturnThis(),
    };

    if ("single" in step) {
      builder.single.mockResolvedValue(step.single);
    } else if ("delete" in step) {
      // For .delete().eq() chains the awaited value is { error }.
      // We model this by having the final `.eq()` resolve directly.
      builder.delete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue(step.delete),
      });
    } else if ("listResult" in step) {
      // Support both list chains that resolve immediately after `.eq()` and
      // longer chains like `.eq().neq().eq()`.
      const resolved = Promise.resolve(step.listResult);
      const terminal = jest.fn().mockResolvedValue(step.listResult);
      builder.eq = jest.fn().mockImplementation(function chain(this: unknown) {
        return {
          eq: terminal,
          neq: jest.fn().mockReturnValue({
            eq: terminal,
          }),
          then: resolved.then.bind(resolved),
          catch: resolved.catch.bind(resolved),
          finally: resolved.finally.bind(resolved),
        };
      });
    }
    return builder as unknown;
  }) as SupabaseFromMock;
  fromMock.mockReturnThis = () => fromMock;

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: fromMock,
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

describe("budget line DELETE route — Procore-parity guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
    requirePermissionMock.mockResolvedValue({
      denied: false,
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("blocks delete with 403 BUDGET_LOCKED when the budget is locked", async () => {
    createClientMock.mockResolvedValue(
      buildSupabaseMock({
        projects: [
          { single: { data: { budget_locked: true }, error: null } },
        ],
      }),
    );

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ projectId: "42", lineId: "line-1" }),
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error_code?: string; error_message?: string; details?: { code?: string } };
    // The route throws GuardrailError(AUTH_FORBIDDEN) with details.code="BUDGET_LOCKED"
    expect(body.details?.code).toBe("BUDGET_LOCKED");
    expect(body.error_message).toMatch(/locked/i);
  });

  it("blocks delete with 409 LINE_HAS_BUDGET when original_amount > 0", async () => {
    createClientMock.mockResolvedValue(
      buildSupabaseMock({
        projects: [
          { single: { data: { budget_locked: false }, error: null } },
        ],
        budget_lines: [
          {
            single: {
              data: {
                id: "line-1",
                project_id: 42,
                original_amount: 1500,
                cost_code_id: "cc-1",
                cost_type_id: "ct-1",
              },
              error: null,
            },
          },
        ],
      }),
    );

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ projectId: "42", lineId: "line-1" }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      details?: { code?: string; originalAmount?: number };
    };
    // The route throws GuardrailError(INVALID_PAYLOAD) with details.code="LINE_HAS_BUDGET"
    expect(body.details?.code).toBe("LINE_HAS_BUDGET");
    expect(body.details?.originalAmount).toBe(1500);
  });

  it("blocks delete with 409 LINE_HAS_ACTIVE_MODIFICATIONS when an active mod references the cost code", async () => {
    createClientMock.mockResolvedValue(
      buildSupabaseMock({
        projects: [
          { single: { data: { budget_locked: false }, error: null } },
        ],
        budget_lines: [
          {
            single: {
              data: {
                id: "line-1",
                project_id: 42,
                original_amount: 0,
                cost_code_id: "cc-1",
                cost_type_id: "ct-1",
              },
              error: null,
            },
          },
        ],
        budget_modifications: [
          {
            listResult: {
              data: [
                { id: "mod-1", number: "BM-0001", status: "draft" },
              ],
              error: null,
            },
          },
        ],
      }),
    );

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ projectId: "42", lineId: "line-1" }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      details?: { code?: string; modifications?: Array<{ id: string; status: string }> };
    };
    // The route throws GuardrailError(INVALID_PAYLOAD) with details.code="LINE_HAS_ACTIVE_MODIFICATIONS"
    expect(body.details?.code).toBe("LINE_HAS_ACTIVE_MODIFICATIONS");
    expect(body.details?.modifications?.[0]?.status).toBe("draft");
  });

  it("blocks delete with 409 LINE_HAS_CHANGE_EVENT_REFERENCES when change-event lines still reference the budget line", async () => {
    createClientMock.mockResolvedValue(
      buildSupabaseMock({
        projects: [
          { single: { data: { budget_locked: false }, error: null } },
        ],
        budget_lines: [
          {
            single: {
              data: {
                id: "line-1",
                project_id: 42,
                original_amount: 0,
                cost_code_id: "cc-1",
                cost_type_id: "ct-1",
              },
              error: null,
            },
          },
        ],
        budget_modifications: [
          { listResult: { data: [], error: null } },
        ],
        change_event_line_items: [
          {
            listResult: {
              data: [
                {
                  id: "ce-line-1",
                  change_event_id: "ce-1",
                  budget_line_id: "line-1",
                  budget_code_id: "line-1",
                },
              ],
              error: null,
            },
          },
        ],
      }),
    );

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ projectId: "42", lineId: "line-1" }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      details?: {
        code?: string;
        references?: Array<{ id: string; change_event_id: string }>;
      };
      error_message?: string;
    };
    expect(body.details?.code).toBe("LINE_HAS_CHANGE_EVENT_REFERENCES");
    expect(body.details?.references?.[0]).toEqual({
      id: "ce-line-1",
      change_event_id: "ce-1",
    });
    expect(body.error_message).toMatch(/change event line item/i);
  });

  it("allows delete when unlocked, $0 original budget, and no active mods", async () => {
    createClientMock.mockResolvedValue(
      buildSupabaseMock({
        projects: [
          { single: { data: { budget_locked: false }, error: null } },
        ],
        budget_lines: [
          {
            single: {
              data: {
                id: "line-1",
                project_id: 42,
                original_amount: 0,
                cost_code_id: "cc-1",
                cost_type_id: "ct-1",
              },
              error: null,
            },
          },
          // Second from("budget_lines") call is the .delete().eq()
          { delete: { error: null } },
        ],
        budget_modifications: [
          { listResult: { data: [], error: null } },
        ],
        change_event_line_items: [
          { listResult: { data: [], error: null } },
        ],
      }),
    );

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ projectId: "42", lineId: "line-1" }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success?: boolean };
    expect(body.success).toBe(true);
  });
});
