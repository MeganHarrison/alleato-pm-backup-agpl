import { NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { GET, PUT } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;

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

describe("/api/projects/[projectId]/submittals/settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "user-1",
      personId: "person-1",
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("returns Procore-aligned defaults when no settings row exists", async () => {
    const query = buildSelectQuery({ data: null, error: null });
    createClientMock.mockResolvedValue({
      from: jest.fn(() => query),
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/projects/876/submittals/settings"),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      project_id: 876,
      default_submittal_manager_id: null,
      default_distribution: null,
      package_sort_order: "ascending",
      default_submit_response_days: 14,
      include_spec_section_number: true,
      submittals_private_by_default: false,
      allow_approvers_to_add_reviewers: true,
      approver_responses_required_by_default: true,
      enable_reject_workflow: false,
      enable_dynamic_approver_due_dates: false,
      enable_overdue_email_reminders: true,
      enable_qr_codes: false,
      enable_schedule_calculations: false,
      allow_email_attachment_download_without_login: false,
      email_notify_submittal_created: true,
      email_notify_submittal_updated: true,
      email_notify_submittal_distributed: true,
      email_notify_submittal_closed: true,
      updated_at: null,
    });
    expect(requirePermissionMock).toHaveBeenCalledWith(876, "submittals", "read");
  });

  it("persists settings through the project settings table", async () => {
    const savedRow = {
      project_id: 876,
      default_submittal_manager_id: null,
      default_distribution: "pm@example.com",
      package_sort_order: "descending",
      default_submit_response_days: 21,
      include_spec_section_number: false,
      submittals_private_by_default: true,
      allow_approvers_to_add_reviewers: false,
      approver_responses_required_by_default: true,
      enable_reject_workflow: true,
      enable_dynamic_approver_due_dates: true,
      enable_overdue_email_reminders: false,
      enable_qr_codes: true,
      enable_schedule_calculations: true,
      allow_email_attachment_download_without_login: true,
      email_notify_submittal_created: true,
      email_notify_submittal_updated: false,
      email_notify_submittal_distributed: true,
      email_notify_submittal_closed: false,
      updated_at: "2026-06-22T20:30:00.000Z",
    };
    const query = buildUpsertQuery({ data: savedRow, error: null });
    const fromMock = jest.fn(() => query);
    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "auth-user-1" } },
          error: null,
        }),
      },
      from: fromMock,
    } as never);

    const response = await PUT(
      new NextRequest("http://localhost/api/projects/876/submittals/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          default_distribution: "pm@example.com",
          package_sort_order: "descending",
          default_submit_response_days: 21,
          include_spec_section_number: false,
          submittals_private_by_default: true,
          allow_approvers_to_add_reviewers: false,
          enable_reject_workflow: true,
          enable_dynamic_approver_due_dates: true,
          enable_overdue_email_reminders: false,
          enable_qr_codes: true,
          enable_schedule_calculations: true,
          allow_email_attachment_download_without_login: true,
          email_notify_submittal_updated: false,
          email_notify_submittal_closed: false,
        }),
      }),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("submittal_project_settings");
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 876,
        default_distribution: "pm@example.com",
        package_sort_order: "descending",
        updated_by: "auth-user-1",
      }),
      { onConflict: "project_id" },
    );
    expect(await response.json()).toEqual(savedRow);
    expect(requirePermissionMock).toHaveBeenCalledWith(
      876,
      "submittals",
      "admin",
    );
  });

  it("fails loudly when the settings migration has not been applied", async () => {
    const query = buildSelectQuery({
      data: null,
      error: { code: "PGRST205", message: "submittal_project_settings missing" },
    });
    createClientMock.mockResolvedValue({
      from: jest.fn(() => query),
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/projects/876/submittals/settings"),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error_code: "INTERNAL_ERROR",
      error_message:
        "Submittal settings table is missing. Apply the latest Supabase migrations before loading submittal settings.",
    });
  });
});
