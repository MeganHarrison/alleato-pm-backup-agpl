/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";

export async function assertPlaneStickyProjectAccess(
  projectId: number,
  mode: "read" | "write",
  where: string,
): Promise<void> {
  if (mode === "write") {
    const permission = await requirePermission(projectId, "documents", "write");
    if (permission.denied) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where,
        message: "You do not have permission to change project stickies.",
        status: 403,
      });
    }
  }

  const access = await verifyProjectAccess(projectId);
  if (isAuthError(access)) {
    throw new GuardrailError({
      code: access.status === 401 ? "AUTH_EXPIRED" : "FORBIDDEN",
      where,
      message:
        access.status === 401
          ? "Sign in to use project stickies."
          : "You do not have access to this project.",
      status: access.status,
    });
  }
}
