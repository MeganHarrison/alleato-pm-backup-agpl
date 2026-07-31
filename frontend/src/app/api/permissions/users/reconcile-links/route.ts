import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireUserManagementAccess } from "@/lib/auth/user-management-access";
import { reconcilePermissionUserLinks } from "@/lib/permissions/user-link-reconciliation";
import { createServiceClient } from "@/lib/supabase/service";

async function requireAdmin(where: string) {
  return requireUserManagementAccess(where);
}

export const POST = withApiGuardrails(
  "permissions/users/reconcile-links#POST",
  async () => {
    await requireAdmin("permissions/users/reconcile-links#POST");

    const result = await reconcilePermissionUserLinks(createServiceClient());

    if (result.unresolved.length > 0) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users/reconcile-links#POST",
        message: "Some user auth links need manual review before they can be repaired.",
        details: result,
      });
    }

    return NextResponse.json({ success: true, data: result });
  },
);
