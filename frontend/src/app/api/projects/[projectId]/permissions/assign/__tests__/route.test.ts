import { NextRequest } from "next/server";
import { POST } from "../route";
import { assignPermissionTemplate } from "@/lib/permissions";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: jest.fn(),
}));

jest.mock("@/lib/permissions", () => ({
  assignPermissionTemplate: jest.fn(),
}));

const verifyProjectAccessMock = verifyProjectAccess as jest.Mock;
const isAuthErrorMock = isAuthError as jest.Mock;
const assignPermissionTemplateMock = assignPermissionTemplate as jest.Mock;

function createRequest(body: unknown) {
  return new NextRequest("http://localhost/api/projects/67/permissions/assign", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("project permission assignment route", () => {
  const params = { params: Promise.resolve({ projectId: "67" }) };

  beforeEach(() => {
    jest.clearAllMocks();
    verifyProjectAccessMock.mockResolvedValue({ userId: "admin-1" });
    isAuthErrorMock.mockReturnValue(false);
  });

  it("returns 400 when a company template is assigned to project access", async () => {
    assignPermissionTemplateMock.mockResolvedValue({
      success: false,
      error: "Project access requires a project permission template.",
    });

    const response = await POST(
      createRequest({ person_id: "person-1", template_id: "company-template-1" }),
      params,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Project access requires a project permission template.",
    });
  });

  it("assigns a project template when the payload is valid", async () => {
    assignPermissionTemplateMock.mockResolvedValue({ success: true });

    const response = await POST(
      createRequest({ person_id: "person-1", template_id: "project-template-1" }),
      params,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(assignPermissionTemplateMock).toHaveBeenCalledWith(
      67,
      "person-1",
      "project-template-1",
    );
  });
});
