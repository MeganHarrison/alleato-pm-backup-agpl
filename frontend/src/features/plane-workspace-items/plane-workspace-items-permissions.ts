/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";

interface PlaneWorkspaceAccessRpcClient {
  rpc(
    name: "current_has_plane_workspace_entity_access",
    args: { p_project_id: number; p_entity_type: string },
  ): Promise<{
    data: boolean | null;
    error: { message: string; code?: string } | null;
  }>;
}

export async function assertPlaneWorkspaceProjectAccess(
  projectId: number,
  entityType: string,
  _userId: string,
  where: string,
): Promise<void> {
  const client =
    (await createClient()) as unknown as PlaneWorkspaceAccessRpcClient;
  const { data: hasAccess, error } = await client.rpc(
    "current_has_plane_workspace_entity_access",
    { p_project_id: projectId, p_entity_type: entityType },
  );

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: "Failed to verify project access for Favorites and Recents.",
      details: { projectId, entityType },
      cause: error,
    });
  }

  if (hasAccess !== true) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message:
        "You do not have access to save workspace items for this project.",
      details: { projectId },
    });
  }
}
