import { NextRequest } from "next/server";

import { GET, PATCH, DELETE } from "../route";
import { requireAppAdmin } from "@/lib/auth/require-app-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/auth/require-app-admin", () => ({
  requireAppAdmin: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

const requireAdminMock = requireAppAdmin as jest.Mock;
const createServiceClientMock = createServiceClient as jest.Mock;
const getUserMock = getApiRouteUser as jest.Mock;

const TEMPLATE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_USER = { id: "11111111-1111-4111-8111-111111111111", email: "megan@megankharrison.com" };

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/admin/meeting-templates/${TEMPLATE_ID}`);
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/meeting-templates/${TEMPLATE_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/admin/meeting-templates/${TEMPLATE_ID}`, {
    method: "DELETE",
  });
}

function callParams(templateId = TEMPLATE_ID) {
  return { params: Promise.resolve({ templateId }) };
}

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq", "in", "is", "order", "or", "limit"];
  for (const method of methods) {
    chain[method] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(async () => result);
  chain.single = jest.fn(async () => result);
  chain.then = (resolve: (value: typeof result) => unknown) => resolve(result);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue(undefined);
  getUserMock.mockResolvedValue(ADMIN_USER);
});

describe("GET /api/admin/meeting-templates/[templateId]", () => {
  it("returns a 403-shaped GuardrailError for a non-is_admin user", async () => {
    const { GuardrailError } = await import("@/lib/guardrails/errors");
    requireAdminMock.mockRejectedValueOnce(
      new GuardrailError({
        code: "FORBIDDEN",
        where: "admin/meeting-templates/[templateId]#GET",
        message: "Admin access required.",
        status: 403,
      }),
    );
    createServiceClientMock.mockReturnValue({ from: jest.fn() });

    const response = await GET(makeGetRequest(), callParams());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns 404 when the template is missing or soft-deleted", async () => {
    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return makeChain({ data: null, error: null });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    createServiceClientMock.mockReturnValue({ from });

    const response = await GET(makeGetRequest(), callParams());

    expect(response.status).toBe(404);
  });

  it("returns the full nested template ordered by position", async () => {
    const categoryId1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const categoryId2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const itemId1 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    const templateRow = {
      id: TEMPLATE_ID,
      name: "Weekly Standup",
      overview: "Standard weekly sync",
      is_private: false,
    };

    const categoryRows = [
      { id: categoryId1, name: "Old Business", position: 0 },
      { id: categoryId2, name: "New Business", position: 1 },
    ];

    const itemRows = [
      {
        id: itemId1,
        template_category_id: categoryId1,
        title: "Review budget",
        description: null,
        priority: "medium",
        position: 0,
      },
    ];

    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return makeChain({ data: templateRow, error: null });
      }
      if (table === "meeting_template_categories") {
        return makeChain({ data: categoryRows, error: null });
      }
      if (table === "meeting_template_items") {
        return makeChain({ data: itemRows, error: null });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    createServiceClientMock.mockReturnValue({ from });

    const response = await GET(makeGetRequest(), callParams());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(TEMPLATE_ID);
    expect(body.categories).toHaveLength(2);
    expect(body.categories[0].id).toBe(categoryId1);
    expect(body.categories[0].items).toHaveLength(1);
    expect(body.categories[0].items[0].id).toBe(itemId1);
    expect(body.categories[1].items).toHaveLength(0);
  });
});

describe("PATCH /api/admin/meeting-templates/[templateId]", () => {
  it("returns a 403-shaped GuardrailError for a non-is_admin user", async () => {
    const { GuardrailError } = await import("@/lib/guardrails/errors");
    requireAdminMock.mockRejectedValueOnce(
      new GuardrailError({
        code: "FORBIDDEN",
        where: "admin/meeting-templates/[templateId]#PATCH",
        message: "Admin access required.",
        status: 403,
      }),
    );
    createServiceClientMock.mockReturnValue({ from: jest.fn() });

    const response = await PATCH(makePatchRequest({ name: "Updated", categories: [] }), callParams());

    expect(response.status).toBe(403);
  });

  it("returns 404 when the template is missing or soft-deleted", async () => {
    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return makeChain({ data: null, error: null });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    createServiceClientMock.mockReturnValue({ from });

    const response = await PATCH(makePatchRequest({ name: "Updated", categories: [] }), callParams());

    expect(response.status).toBe(404);
  });

  it("full-replaces: updates the template, deletes existing categories, and re-inserts from payload", async () => {
    const existingCategoryId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const newCategoryId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

    const templateSelectChain = makeChain({
      data: { id: TEMPLATE_ID, name: "Old Name", overview: null, is_private: false },
      error: null,
    });

    const templateUpdateEq = jest.fn().mockResolvedValueOnce({ error: null });
    const categoriesDeleteEq = jest.fn().mockResolvedValueOnce({ error: null });

    const categoriesInsertSelect = jest.fn().mockResolvedValueOnce({
      data: [{ id: newCategoryId, name: "Agenda", position: 0 }],
      error: null,
    });

    const itemsInsert = jest.fn().mockResolvedValueOnce({ error: null });

    // loadFullTemplate is called twice: once implicitly is not the case here —
    // it's called once at the end of PATCH to build the response.
    const reloadTemplateChain = makeChain({
      data: { id: TEMPLATE_ID, name: "New Name", overview: "Updated overview", is_private: false },
      error: null,
    });
    const reloadCategoriesChain = makeChain({
      data: [{ id: newCategoryId, name: "Agenda", position: 0 }],
      error: null,
    });
    const reloadItemsChain = makeChain({
      data: [
        {
          id: "item-1",
          template_category_id: newCategoryId,
          position: 0,
          title: "Discuss roadmap",
          description: "Q3 planning",
          priority: "high",
        },
      ],
      error: null,
    });

    let templateCallCount = 0;
    let categoriesCallCount = 0;
    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        templateCallCount += 1;
        if (templateCallCount === 1) {
          return templateSelectChain;
        }
        if (templateCallCount === 2) {
          return {
            update: jest.fn(() => ({
              eq: templateUpdateEq,
            })),
          };
        }
        return reloadTemplateChain;
      }
      if (table === "meeting_template_categories") {
        categoriesCallCount += 1;
        if (categoriesCallCount === 1) {
          return {
            delete: jest.fn(() => ({
              eq: categoriesDeleteEq,
            })),
          };
        }
        if (categoriesCallCount === 2) {
          return {
            insert: jest.fn(() => ({
              select: categoriesInsertSelect,
            })),
          };
        }
        return reloadCategoriesChain;
      }
      if (table === "meeting_template_items") {
        return { insert: itemsInsert, select: reloadItemsChain.select };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    createServiceClientMock.mockReturnValue({ from });

    const response = await PATCH(
      makePatchRequest({
        name: "New Name",
        overview: "Updated overview",
        categories: [
          {
            name: "Agenda",
            items: [{ title: "Discuss roadmap", description: "Q3 planning", priority: "high" }],
          },
        ],
      }),
      callParams(),
    );

    expect(response.status).toBe(200);

    expect(templateUpdateEq).toHaveBeenCalledWith("id", TEMPLATE_ID);
    expect(categoriesDeleteEq).toHaveBeenCalledWith("template_id", TEMPLATE_ID);
    expect(categoriesInsertSelect).toHaveBeenCalled();
    expect(itemsInsert).toHaveBeenCalledWith([
      {
        template_category_id: newCategoryId,
        title: "Discuss roadmap",
        description: "Q3 planning",
        priority: "high",
        position: 0,
      },
    ]);
    void existingCategoryId;
  });
});

describe("DELETE /api/admin/meeting-templates/[templateId]", () => {
  it("returns a 403-shaped GuardrailError for a non-is_admin user", async () => {
    const { GuardrailError } = await import("@/lib/guardrails/errors");
    requireAdminMock.mockRejectedValueOnce(
      new GuardrailError({
        code: "FORBIDDEN",
        where: "admin/meeting-templates/[templateId]#DELETE",
        message: "Admin access required.",
        status: 403,
      }),
    );
    createServiceClientMock.mockReturnValue({ from: jest.fn() });

    const response = await DELETE(makeDeleteRequest(), callParams());

    expect(response.status).toBe(403);
  });

  it("soft deletes by setting deleted_at", async () => {
    const updateEq = jest.fn().mockResolvedValueOnce({ error: null });
    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return {
          update: jest.fn((payload: Record<string, unknown>) => {
            expect(payload).toHaveProperty("deleted_at");
            expect(payload.deleted_at).not.toBeNull();
            return { eq: updateEq };
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    createServiceClientMock.mockReturnValue({ from });

    const response = await DELETE(makeDeleteRequest(), callParams());

    expect(response.status).toBe(200);
    expect(updateEq).toHaveBeenCalledWith("id", TEMPLATE_ID);
  });

  it("allows an is_admin=true user who is NOT on the legacy email allowlist to soft-delete", async () => {
    // Proves the gate is is_admin (matching meeting_templates RLS
    // `current_is_app_admin()`), not the 2-person admin-dashboard email
    // allowlist. requireAppAdmin resolves without throwing for this user.
    getUserMock.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      email: "some-other-admin@alleatogroup.com",
    });
    requireAdminMock.mockResolvedValue(undefined);

    const updateEq = jest.fn().mockResolvedValueOnce({ error: null });
    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return {
          update: jest.fn(() => ({ eq: updateEq })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    createServiceClientMock.mockReturnValue({ from });

    const response = await DELETE(makeDeleteRequest(), callParams());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});

describe("nil UUID guard", () => {
  it("returns 400 for the nil UUID templateId", async () => {
    createServiceClientMock.mockReturnValue({ from: jest.fn() });

    const response = await GET(makeGetRequest(), callParams("00000000-0000-0000-0000-000000000000"));

    expect(response.status).toBe(400);
  });
});
