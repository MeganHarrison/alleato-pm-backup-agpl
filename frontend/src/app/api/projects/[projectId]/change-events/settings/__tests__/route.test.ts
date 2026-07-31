import { NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { GET, PUT } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const requirePermissionMock = requirePermission as jest.MockedFunction<typeof requirePermission>;

function buildSelectQuery(response: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(response),
  };
}

function buildUpsertQuery(response: { data: unknown; error: unknown }) {
  return {
    upsert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
  };
}

describe("/api/projects/[projectId]/change-events/settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "auth-user-1" } as never);
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "user-1",
      personId: "person-1",
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("returns defaults when no settings row exists", async () => {
    const query = buildSelectQuery({ data: null, error: null });
    createClientMock.mockResolvedValue({
      from: jest.fn(() => query),
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/projects/876/change-events/settings"),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      project_id: 876,
      maintain_budget_codes_in_sync: false,
      display_revenue_rom_columns: true,
      display_unit_columns: false,
      allow_line_item_autopopulation: true,
      always_create_commitment_cos_using_latest_cost: false,
      copy_attachments_to_prime_pcos: false,
      copy_attachments_to_commitment_cos: false,
      budget_rom_in_scope: "none",
      budget_rom_out_of_scope: "none",
      budget_rom_tbd_scope: "none",
      prevent_budget_changes_and_prime_pcos_on_same_line_item: false,
      updated_at: null,
    });
    expect(requirePermissionMock).toHaveBeenCalledWith(876, "change_events", "read");
  });

  it("persists settings through the project settings table", async () => {
    const savedRow = {
      project_id: 876,
      maintain_budget_codes_in_sync: true,
      display_revenue_rom_columns: true,
      display_unit_columns: true,
      allow_line_item_autopopulation: true,
      always_create_commitment_cos_using_latest_cost: true,
      copy_attachments_to_prime_pcos: true,
      copy_attachments_to_commitment_cos: false,
      budget_rom_in_scope: "latest_cost",
      budget_rom_out_of_scope: "latest_price",
      budget_rom_tbd_scope: "none",
      prevent_budget_changes_and_prime_pcos_on_same_line_item: true,
      updated_at: "2026-07-04T10:30:00.000Z",
    };
    const query = buildUpsertQuery({ data: savedRow, error: null });
    const fromMock = jest.fn(() => query);
    createClientMock.mockResolvedValue({
      from: fromMock,
    } as never);

    const response = await PUT(
      new NextRequest("http://localhost/api/projects/876/change-events/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maintain_budget_codes_in_sync: true,
          display_unit_columns: true,
          always_create_commitment_cos_using_latest_cost: true,
          copy_attachments_to_prime_pcos: true,
          budget_rom_in_scope: "latest_cost",
          budget_rom_out_of_scope: "latest_price",
          prevent_budget_changes_and_prime_pcos_on_same_line_item: true,
        }),
      }),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("change_event_project_settings");
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 876,
        maintain_budget_codes_in_sync: true,
        updated_by: "auth-user-1",
      }),
      { onConflict: "project_id" },
    );
    expect(await response.json()).toEqual(savedRow);
    expect(requirePermissionMock).toHaveBeenCalledWith(876, "change_events", "admin");
  });

  it("fails loudly when the settings migration has not been applied", async () => {
    const query = buildSelectQuery({
      data: null,
      error: { code: "PGRST205", message: "change_event_project_settings missing" },
    });
    createClientMock.mockResolvedValue({
      from: jest.fn(() => query),
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/projects/876/change-events/settings"),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error_code: "INTERNAL_ERROR",
      error_message:
        "Change event settings table is missing. Apply the latest Supabase migrations before loading change event settings.",
    });
  });
});
