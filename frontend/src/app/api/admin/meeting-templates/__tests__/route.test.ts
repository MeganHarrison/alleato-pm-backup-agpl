import { NextRequest } from "next/server";

import { GET, POST } from "../route";
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

// Typed accessor for the insert mock returned by a recorded from("<table>")
// call — throws loudly (failing the test) instead of casting through unknown.
function insertMockForTable(from: jest.Mock, table: string): jest.Mock {
  const idx = from.mock.calls.findIndex((call) => call[0] === table);
  if (idx === -1) throw new Error(`no from("${table}") call was recorded`);
  const insert = from.mock.results[idx]?.value?.insert;
  if (typeof insert !== "function") {
    throw new Error(`from("${table}") result exposes no insert mock`);
  }
  return insert as jest.Mock;
}

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/meeting-templates");
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/meeting-templates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callParams() {
  return { params: Promise.resolve({}) };
}

/**
 * Chainable query-builder mock. Every chain method returns `this` so calls
 * can be composed in any order; the chain is also thenable so `await query`
 * resolves with the configured result.
 */
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

const ADMIN_USER = { id: "11111111-1111-4111-8111-111111111111", email: "megan@megankharrison.com" };

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue(undefined);
  getUserMock.mockResolvedValue(ADMIN_USER);
});

describe("GET /api/admin/meeting-templates", () => {
  it("returns a 403-shaped GuardrailError for a non-is_admin user", async () => {
    const { GuardrailError } = await import("@/lib/guardrails/errors");
    requireAdminMock.mockRejectedValueOnce(
      new GuardrailError({
        code: "FORBIDDEN",
        where: "admin/meeting-templates#GET",
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

  it("returns templates with batched category/item counts, excluding soft-deleted rows", async () => {
    const templateId1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const templateId2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const categoryId1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const categoryId2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const categoryId3 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    const templateRows = [
      {
        id: templateId1,
        name: "Weekly Standup",
        overview: "Standard weekly sync",
        is_private: false,
        updated_at: "2026-06-01T00:00:00Z",
      },
      {
        id: templateId2,
        name: "Kickoff",
        overview: null,
        is_private: true,
        updated_at: "2026-06-15T00:00:00Z",
      },
    ];

    const categoryRows = [
      { id: categoryId1, template_id: templateId1 },
      { id: categoryId2, template_id: templateId1 },
      { id: categoryId3, template_id: templateId2 },
    ];

    const itemRows = [
      { template_category_id: categoryId1 },
      { template_category_id: categoryId1 },
      { template_category_id: categoryId2 },
    ];

    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return makeChain({ data: templateRows, error: null });
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
    expect(body.templates).toHaveLength(2);

    const t1 = body.templates.find((t: { id: string }) => t.id === templateId1);
    expect(t1.category_count).toBe(2);
    expect(t1.item_count).toBe(3);

    const t2 = body.templates.find((t: { id: string }) => t.id === templateId2);
    expect(t2.category_count).toBe(1);
    expect(t2.item_count).toBe(0);

    // No N+1: exactly one query per table.
    expect(from.mock.calls.filter(([t]) => t === "meeting_templates")).toHaveLength(1);
    expect(from.mock.calls.filter(([t]) => t === "meeting_template_categories")).toHaveLength(1);
    expect(from.mock.calls.filter(([t]) => t === "meeting_template_items")).toHaveLength(1);
  });
});

describe("POST /api/admin/meeting-templates", () => {
  it("returns a 403-shaped GuardrailError for a non-is_admin user", async () => {
    const { GuardrailError } = await import("@/lib/guardrails/errors");
    requireAdminMock.mockRejectedValueOnce(
      new GuardrailError({
        code: "FORBIDDEN",
        where: "admin/meeting-templates#POST",
        message: "Admin access required.",
        status: 403,
      }),
    );
    createServiceClientMock.mockReturnValue({ from: jest.fn() });

    const response = await POST(makePostRequest({ name: "New Template", categories: [] }), callParams());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns 400 with Zod details for an invalid body", async () => {
    createServiceClientMock.mockReturnValue({ from: jest.fn() });

    const response = await POST(makePostRequest({ overview: "missing name" }), callParams());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.details).toBeDefined();
  });

  it("allows an is_admin=true user who is NOT on the legacy email allowlist to create a template", async () => {
    // Proves the gate is is_admin (matching meeting_templates RLS
    // `current_is_app_admin()`), not the 2-person admin-dashboard email
    // allowlist. requireAppAdmin resolves without throwing for this user.
    const nonAllowlistedAdminId = "22222222-2222-4222-8222-222222222222";
    getUserMock.mockResolvedValue({
      id: nonAllowlistedAdminId,
      email: "some-other-admin@alleatogroup.com",
    });
    requireAdminMock.mockResolvedValue(undefined);

    const newTemplateId = "99999999-9999-4999-8999-999999999999";

    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValueOnce({
                data: {
                  id: newTemplateId,
                  name: "Non-allowlisted admin template",
                  overview: null,
                  is_private: false,
                  created_by: nonAllowlistedAdminId,
                },
                error: null,
              }),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    createServiceClientMock.mockReturnValue({ from });

    const response = await POST(
      makePostRequest({ name: "Non-allowlisted admin template", categories: [] }),
      callParams(),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe(newTemplateId);
  });

  it("inserts template + nested categories/items with positions from array order, and returns the full nested template", async () => {
    const newTemplateId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const categoryId1 = "11111111-2222-4333-8444-555555555555";
    const categoryId2 = "66666666-7777-4888-8999-aaaaaaaaaaaa";

    const templateInsertSingle = jest.fn().mockResolvedValueOnce({
      data: {
        id: newTemplateId,
        name: "Weekly Standup",
        overview: "Standard weekly sync",
        is_private: false,
        created_by: ADMIN_USER.id,
      },
      error: null,
    });

    const categoriesInsertSelect = jest.fn().mockResolvedValueOnce({
      data: [
        { id: categoryId1, name: "Old Business", position: 0 },
        { id: categoryId2, name: "New Business", position: 1 },
      ],
      error: null,
    });

    const itemsInsert = jest.fn().mockResolvedValueOnce({ error: null });

    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: templateInsertSingle,
            })),
          })),
        };
      }
      if (table === "meeting_template_categories") {
        return {
          insert: jest.fn(() => ({
            select: categoriesInsertSelect,
          })),
        };
      }
      if (table === "meeting_template_items") {
        return { insert: itemsInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createServiceClientMock.mockReturnValue({ from });

    const response = await POST(
      makePostRequest({
        name: "Weekly Standup",
        overview: "Standard weekly sync",
        categories: [
          {
            name: "Old Business",
            items: [{ title: "Review budget", priority: "medium" }],
          },
          {
            name: "New Business",
            items: [{ title: "Plan next steps" }, { title: "Assign owners" }],
          },
        ],
      }),
      callParams(),
    );

    expect(response.status).toBe(201);

    // Template insert includes created_by from the authenticated user.
    const templateInsertCall = insertMockForTable(from, "meeting_templates");
    expect(templateInsertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Weekly Standup",
        overview: "Standard weekly sync",
        created_by: ADMIN_USER.id,
      }),
    );

    // Categories inserted with positions derived from array order.
    const categoriesInsertCall = insertMockForTable(from, "meeting_template_categories");
    expect(categoriesInsertCall).toHaveBeenCalledWith([
      { template_id: newTemplateId, name: "Old Business", position: 0 },
      { template_id: newTemplateId, name: "New Business", position: 1 },
    ]);

    // Items inserted with positions derived from array order and correct category_id mapping.
    expect(itemsInsert).toHaveBeenCalledWith([
      {
        template_category_id: categoryId1,
        title: "Review budget",
        description: null,
        priority: "medium",
        position: 0,
      },
      {
        template_category_id: categoryId2,
        title: "Plan next steps",
        description: null,
        priority: null,
        position: 0,
      },
      {
        template_category_id: categoryId2,
        title: "Assign owners",
        description: null,
        priority: null,
        position: 1,
      },
    ]);

    const body = await response.json();
    expect(body.id).toBe(newTemplateId);
    expect(body.categories).toHaveLength(2);
  });

  it("deletes the just-created template and surfaces the error when a child insert fails partway through", async () => {
    const newTemplateId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

    const templateInsertSingle = jest.fn().mockResolvedValueOnce({
      data: { id: newTemplateId, name: "Weekly Standup", overview: null, is_private: false },
      error: null,
    });

    const categoriesInsertSelect = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "insert failed" } });

    const templateDeleteEq = jest.fn().mockResolvedValueOnce({ error: null });

    const from = jest.fn((table: string) => {
      if (table === "meeting_templates") {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: templateInsertSingle,
            })),
          })),
          delete: jest.fn(() => ({
            eq: templateDeleteEq,
          })),
        };
      }
      if (table === "meeting_template_categories") {
        return {
          insert: jest.fn(() => ({
            select: categoriesInsertSelect,
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    createServiceClientMock.mockReturnValue({ from });

    const response = await POST(
      makePostRequest({
        name: "Weekly Standup",
        categories: [{ name: "Old Business", items: [] }],
      }),
      callParams(),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(templateDeleteEq).toHaveBeenCalledWith("id", newTemplateId);
  });
});
