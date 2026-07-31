import { NextResponse } from "next/server";
import {
  isAuthError,
  verifyProjectAccess,
  verifyProjectPermission,
} from "@/lib/supabase/auth-guard";
import { getApiRouteUser } from "@/lib/supabase/server";

export async function authorizePlaneCycles(
  projectId: number,
  mode: "read" | "write",
) {
  const user = await getApiRouteUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (mode === "write") {
    const access = await verifyProjectPermission(
      projectId,
      "schedule",
      "write",
    );
    return isAuthError(access) ? access : { ...access, user };
  }

  const access = await verifyProjectAccess(projectId, user);
  return isAuthError(access) ? access : { ...access, user };
}
