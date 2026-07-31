import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import { GET, PUT } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const requirePermissionMock = requirePermission as jest.MockedFunction<typeof requirePermission>;

const buildQuery = (response: { data: unknown; error: unknown }) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue(response),
});

describe("/api/projects/[projectId]/contracts/settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    // Grant permission by default for all PUT tests
    requirePermissionMock.mockResolvedValue({ denied: false, userId: "user-1", personId: "person-1" } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("returns retainage defaults when no settings row exists", async () => {
    const query = buildQuery({ data: null, error: { code: "PGRST116" } });
    createClientMock.mockResolvedValue({
      from: jest.fn(() => query),
    } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/42/contracts/settings"), {
      params: Promise.resolve({ projectId: "42" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      project_id: 42,
      co_tier_count: 2,
      allow_standard_users_create_pcco: false,
      allow_standard_users_create_pco: false,
      sov_always_editable: false,
      enable_completed_work_retainage: false,
      enable_stored_materials_retainage: false,
      default_retainage_percent: 0,
      show_markup_on_co_pdf: true,
      show_markup_on_invoice_pdf: true,
      default_distribution_prime_contract: null,
      default_distribution_pcco: null,
      default_distribution_pco: null,
    });
  });

  it("accepts explicit retainage fields on save", async () => {
    const upsertQuery = buildQuery({
      data: {
        project_id: 42,
        co_tier_count: 2,
        allow_standard_users_create_pcco: true,
        allow_standard_users_create_pco: false,
        sov_always_editable: true,
        enable_completed_work_retainage: false,
        enable_stored_materials_retainage: true,
        default_retainage_percent: 7.5,
        show_markup_on_co_pdf: true,
        show_markup_on_invoice_pdf: false,
        default_distribution_prime_contract: null,
        default_distribution_pcco: null,
        default_distribution_pco: null,
      },
      error: null,
    });
    const fromMock = jest.fn(() => upsertQuery);
    createClientMock.mockResolvedValue({ from: fromMock } as never);

    const response = await PUT(
      new NextRequest("http://localhost/api/projects/42/contracts/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          co_tier_count: 2,
          allow_standard_users_create_pcco: true,
          sov_always_editable: true,
          enable_completed_work_retainage: false,
          enable_stored_materials_retainage: true,
          default_retainage_percent: 7.5,
        }),
      }),
      {
        params: Promise.resolve({ projectId: "42" }),
      },
    );

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("prime_contract_project_settings");
    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 42,
        co_tier_count: 2,
        allow_standard_users_create_pcco: true,
        sov_always_editable: true,
        enable_completed_work_retainage: false,
        enable_stored_materials_retainage: true,
        default_retainage_percent: 7.5,
      }),
      { onConflict: "project_id" },
    );
  });
});
