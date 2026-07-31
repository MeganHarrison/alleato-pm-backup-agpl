import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { assertPlaneWorkspaceProjectAccess } from "../plane-workspace-items-permissions";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const mockedCreateClient = jest.mocked(createClient);
const userId = "11111111-1111-4111-8111-111111111111";

describe("Plane workspace item project permission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the same authenticated project-access function as RLS", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    await expect(
      assertPlaneWorkspaceProjectAccess(31, "rfi", userId, "test"),
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith(
      "current_has_plane_workspace_entity_access",
      { p_project_id: 31, p_entity_type: "rfi" },
    );
  });

  it("fails with a specific forbidden error when project access is denied", async () => {
    mockedCreateClient.mockResolvedValue({
      rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
    } as never);

    await expect(
      assertPlaneWorkspaceProjectAccess(31, "rfi", userId, "test"),
    ).rejects.toMatchObject<Partial<GuardrailError>>({
      code: "FORBIDDEN",
      message:
        "You do not have access to save workspace items for this project.",
    });
  });

  it("fails loudly when the project-access function cannot be evaluated", async () => {
    mockedCreateClient.mockResolvedValue({
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "database unavailable", code: "08006" },
      }),
    } as never);

    await expect(
      assertPlaneWorkspaceProjectAccess(31, "rfi", userId, "test"),
    ).rejects.toMatchObject<Partial<GuardrailError>>({
      code: "INTERNAL_ERROR",
      message: "Failed to verify project access for Favorites and Recents.",
      details: {
        projectId: 31,
        entityType: "rfi",
      },
    });
  });
});
