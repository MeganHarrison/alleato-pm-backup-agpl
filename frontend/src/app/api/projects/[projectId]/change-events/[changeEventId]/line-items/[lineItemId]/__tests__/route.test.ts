import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DELETE } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const requirePermissionMock = requirePermission as jest.MockedFunction<typeof requirePermission>;

function buildSingleQuery<T>(result: { data: T; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
}

function buildDeleteQuery(result: { error: unknown }) {
  return {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result),
  };
}

function buildUpdateQuery(result: { error?: unknown }) {
  return {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result),
  };
}

function buildInsertQuery(result: { error?: unknown }) {
  return {
    insert: jest.fn().mockResolvedValue(result),
  };
}

describe("/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId] DELETE", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "auth-user-1" } as never);
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "user-1",
      personId: "person-1",
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("allows writers to delete persisted change-event line items", async () => {
    const changeEventQuery = buildSingleQuery({
      data: { id: "ce-1", status: "open" },
      error: null,
    });
    const lineItemLookupQuery = buildSingleQuery({
      data: { description: "Line item to delete" },
      error: null,
    });
    const lineItemDeleteQuery = buildDeleteQuery({ error: null });
    const changeEventUpdateQuery = buildUpdateQuery({ error: null });
    const historyInsertQuery = buildInsertQuery({ error: null });

    const fromMock = jest.fn((table: string) => {
      switch (table) {
        case "change_events":
          return fromMock.mock.calls.filter(([name]) => name === "change_events").length === 1
            ? changeEventQuery
            : changeEventUpdateQuery;
        case "change_event_line_items":
          return fromMock.mock.calls.filter(([name]) => name === "change_event_line_items").length === 1
            ? lineItemLookupQuery
            : lineItemDeleteQuery;
        case "change_event_history":
          return historyInsertQuery;
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    });

    createClientMock.mockResolvedValue({ from: fromMock } as never);

    const response = await DELETE(
      new NextRequest("http://localhost/api/projects/876/change-events/ce-1/line-items/li-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          projectId: "876",
          changeEventId: "ce-1",
          lineItemId: "li-1",
        }),
      },
    );

    expect(requirePermissionMock).toHaveBeenCalledWith(876, "change_orders", "write");
    expect(response.status).toBe(204);
    expect(changeEventUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updated_by: "auth-user-1",
      }),
    );
    expect(historyInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        field_name: "line_item_removed",
        old_value: "Line item to delete",
      }),
    );
  });

  it("returns the guard response when write permission is denied", async () => {
    requirePermissionMock.mockResolvedValue({
      denied: true,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as Awaited<ReturnType<typeof requirePermission>>);

    const response = await DELETE(
      new NextRequest("http://localhost/api/projects/876/change-events/ce-1/line-items/li-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          projectId: "876",
          changeEventId: "ce-1",
          lineItemId: "li-1",
        }),
      },
    );

    expect(requirePermissionMock).toHaveBeenCalledWith(876, "change_orders", "write");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
