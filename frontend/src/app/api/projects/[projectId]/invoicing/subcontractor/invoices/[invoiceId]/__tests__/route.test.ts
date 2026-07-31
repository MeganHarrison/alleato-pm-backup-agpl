import { NextRequest } from "next/server";

import { PATCH } from "../route";
import {
  createClient,
  getApiRouteUser,
} from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const createClientMock = createClient as jest.Mock;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const requirePermissionMock =
  requirePermission as jest.MockedFunction<typeof requirePermission>;

type QueryResult = {
  data: unknown;
  error: null | { code?: string; message: string };
};

function createQuery(
  result: QueryResult,
  hooks?: { update?: jest.Mock; insert?: jest.Mock },
) {
  const query: Record<string, jest.Mock> &
    PromiseLike<QueryResult> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    update: jest.fn((payload: unknown) => {
      hooks?.update?.(payload);
      return query;
    }),
    insert: jest.fn((payload: unknown) => {
      hooks?.insert?.(payload);
      return query;
    }),
    single: jest.fn().mockResolvedValue(result),
    then: (resolve, reject) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function makePatch(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/projects/1149/invoicing/subcontractor/invoices/8268",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function arrangeInvoicePatch(
  existing: Record<string, unknown>,
  updated: Record<string, unknown>,
  updateError: QueryResult["error"] = null,
) {
  const update = jest.fn();
  const updateQuery = createQuery(
    {
      data: updateError ? null : updated,
      error: updateError,
    },
    { update },
  );
  const queues = new Map<string, ReturnType<typeof createQuery>[]>([
    [
      "subcontractor_invoices",
      [
        createQuery({ data: existing, error: null }),
        updateQuery,
      ],
    ],
    [
      "subcontractor_invoice_audit_log",
      [createQuery({ data: null, error: null })],
    ],
  ]);

  createClientMock.mockResolvedValue({
    from: jest.fn((table: string) => {
      const queue = queues.get(table);
      if (!queue?.length) {
        throw new Error(`Unexpected table call: ${table}`);
      }
      return queue.shift();
    }),
  });

  return { update, updateQuery };
}

describe("subcontractor invoice PATCH", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
    getApiRouteUserMock.mockResolvedValue({
      id: "pm-user",
      email: "pm@example.com",
    });
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "pm-user",
      personId: "pm-person",
    });
  });

  it("denies users without commitments write permission", async () => {
    const { update } = arrangeInvoicePatch(
      {
        id: 8268,
        status: "under_review",
        acumatica_ref_nbr: null,
        acumatica_doc_type: null,
        acumatica_sync_at: null,
        acumatica_ap_bill_id: null,
      },
      { id: 8268, status: "draft" },
    );
    requirePermissionMock.mockResolvedValue({
      denied: true,
      response: new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403 },
      ) as never,
    });

    const response = await PATCH(makePatch({ status: "draft" }), {
      params: { projectId: "1149", invoiceId: "8268" },
    });

    expect(response.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns an unsynced under-review invoice to draft", async () => {
    const { update, updateQuery } = arrangeInvoicePatch(
      {
        id: 8268,
        status: "under_review",
        acumatica_ref_nbr: null,
        acumatica_doc_type: null,
        acumatica_sync_at: null,
        acumatica_ap_bill_id: null,
      },
      { id: 8268, status: "draft" },
    );

    const response = await PATCH(makePatch({ status: "draft" }), {
      params: { projectId: "1149", invoiceId: "8268" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: 8268, status: "draft" },
    });
    expect(update).toHaveBeenCalledWith({ status: "draft" });
    expect(updateQuery.eq).toHaveBeenCalledWith("project_id", 1149);
    expect(updateQuery.eq).toHaveBeenCalledWith(
      "status",
      "under_review",
    );
    expect(updateQuery.is).toHaveBeenCalledWith(
      "acumatica_ref_nbr",
      null,
    );
    expect(updateQuery.is).toHaveBeenCalledWith(
      "acumatica_doc_type",
      null,
    );
    expect(updateQuery.is).toHaveBeenCalledWith(
      "acumatica_sync_at",
      null,
    );
    expect(updateQuery.is).toHaveBeenCalledWith(
      "acumatica_ap_bill_id",
      null,
    );
  });

  it("blocks returning an accounting-synced invoice to draft", async () => {
    const { update } = arrangeInvoicePatch(
      {
        id: 8268,
        status: "under_review",
        acumatica_ref_nbr: "AP000123",
        acumatica_doc_type: "Bill",
        acumatica_sync_at: "2026-07-30T20:00:00.000Z",
        acumatica_ap_bill_id: 123,
      },
      { id: 8268, status: "draft" },
    );

    const response = await PATCH(makePatch({ status: "draft" }), {
      params: { projectId: "1149", invoiceId: "8268" },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Cannot return invoice to Draft",
      message: expect.stringContaining("accounting"),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("requires returning to draft before changing invoice fields", async () => {
    const { update } = arrangeInvoicePatch(
      {
        id: 8268,
        status: "under_review",
        acumatica_ref_nbr: null,
        acumatica_doc_type: null,
        acumatica_sync_at: null,
        acumatica_ap_bill_id: null,
      },
      { id: 8268, status: "draft", notes: "Corrected" },
    );

    const response = await PATCH(
      makePatch({ status: "draft", notes: "Corrected" }),
      {
        params: { projectId: "1149", invoiceId: "8268" },
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Return the invoice to Draft first, then save invoice edits.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("preserves the existing draft edit path", async () => {
    const { update } = arrangeInvoicePatch(
      {
        id: 8268,
        status: "draft",
        acumatica_ref_nbr: null,
        acumatica_doc_type: null,
        acumatica_sync_at: null,
        acumatica_ap_bill_id: null,
      },
      { id: 8268, status: "draft", notes: "Corrected" },
    );

    const response = await PATCH(makePatch({ notes: "Corrected" }), {
      params: { projectId: "1149", invoiceId: "8268" },
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ notes: "Corrected" });
    expect(requirePermissionMock).not.toHaveBeenCalled();
  });

  it("preserves invoice-contact edits without project-wide write", async () => {
    const { update } = arrangeInvoicePatch(
      {
        id: 8268,
        status: "draft",
        acumatica_ref_nbr: null,
        acumatica_doc_type: null,
        acumatica_sync_at: null,
        acumatica_ap_bill_id: null,
      },
      { id: 8268, status: "draft", notes: "Subcontractor correction" },
    );
    requirePermissionMock.mockResolvedValue({
      denied: true,
      response: new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403 },
      ) as never,
    });

    const response = await PATCH(
      makePatch({ notes: "Subcontractor correction" }),
      {
        params: { projectId: "1149", invoiceId: "8268" },
      },
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      notes: "Subcontractor correction",
    });
    expect(requirePermissionMock).not.toHaveBeenCalled();
  });

  it("blocks edits to an accounting-synced draft invoice", async () => {
    const { update } = arrangeInvoicePatch(
      {
        id: 8268,
        status: "draft",
        acumatica_ref_nbr: "AP000123",
        acumatica_doc_type: null,
        acumatica_sync_at: null,
        acumatica_ap_bill_id: null,
      },
      { id: 8268, status: "draft", notes: "Corrected" },
    );

    const response = await PATCH(makePatch({ notes: "Corrected" }), {
      params: { projectId: "1149", invoiceId: "8268" },
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects status jumps that bypass workflow actions", async () => {
    const { update } = arrangeInvoicePatch(
      {
        id: 8268,
        status: "draft",
        acumatica_ref_nbr: null,
        acumatica_doc_type: null,
        acumatica_sync_at: null,
        acumatica_ap_bill_id: null,
      },
      { id: 8268, status: "approved" },
    );

    const response = await PATCH(makePatch({ status: "approved" }), {
      params: { projectId: "1149", invoiceId: "8268" },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid status transition",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("reports a conflict when the invoice changes during an edit", async () => {
    const { update } = arrangeInvoicePatch(
      {
        id: 8268,
        status: "draft",
        acumatica_ref_nbr: null,
        acumatica_doc_type: null,
        acumatica_sync_at: null,
        acumatica_ap_bill_id: null,
      },
      {},
      { code: "PGRST116", message: "No rows" },
    );

    const response = await PATCH(makePatch({ notes: "Corrected" }), {
      params: { projectId: "1149", invoiceId: "8268" },
    });

    expect(response.status).toBe(409);
    expect(update).toHaveBeenCalledWith({ notes: "Corrected" });
  });
});
