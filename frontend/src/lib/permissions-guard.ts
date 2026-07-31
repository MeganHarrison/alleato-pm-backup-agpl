/**
 * Permission Guard — API route middleware for enforcing tool-level permissions.
 *
 * Usage in an API route:
 *
 *   import { requirePermission } from "@/lib/permissions-guard";
 *
 *   export async function POST(request: NextRequest, { params }: RouteParams) {
 *     const guard = await requirePermission(projectId, "budget", "write");
 *     if (guard.denied) return guard.response;
 *     // ... proceed with the mutation
 *   }
 *
 * For read-only routes you can use "read" level. For destructive actions use "admin".
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserPermissions, hasPermission } from "@/lib/permissions";
import type { PermissionModule, PermissionLevel, GranularFlag } from "@/lib/permissions-shared";
import { hasGranular } from "@/lib/permissions-shared";

interface PermissionGranted {
  denied: false;
  userId: string;
  personId: string;
}

interface PermissionDenied {
  denied: true;
  response: NextResponse;
}

type PermissionGuardResult = PermissionGranted | PermissionDenied;

/**
 * Check that the current user has the required permission level for a module.
 * Returns a discriminated union — check `result.denied` before proceeding.
 */
export async function requirePermission(
  projectId: number,
  module: PermissionModule,
  level: PermissionLevel,
): Promise<PermissionGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      denied: true,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const permissions = await loadUserPermissions(projectId, user.id);

  if (!permissions) {
    return {
      denied: true,
      response: NextResponse.json(
        { error: "No project membership found" },
        { status: 403 },
      ),
    };
  }

  if (!hasPermission(permissions, module, level)) {
    return {
      denied: true,
      response: NextResponse.json(
        {
          error: `Insufficient permissions: requires ${level} access to ${module}`,
          required: { module, level },
        },
        { status: 403 },
      ),
    };
  }

  return {
    denied: false,
    userId: permissions.userId,
    personId: permissions.personId,
  };
}

/**
 * Check that the current user has a specific granular permission flag.
 */
export async function requireGranular(
  projectId: number,
  flag: GranularFlag,
): Promise<PermissionGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      denied: true,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const permissions = await loadUserPermissions(projectId, user.id);

  if (!permissions) {
    return {
      denied: true,
      response: NextResponse.json(
        { error: "No project membership found" },
        { status: 403 },
      ),
    };
  }

  if (!hasGranular(permissions, flag)) {
    return {
      denied: true,
      response: NextResponse.json(
        {
          error: `Insufficient permissions: requires granular flag "${flag}"`,
          required: { granularFlag: flag },
        },
        { status: 403 },
      ),
    };
  }

  return {
    denied: false,
    userId: permissions.userId,
    personId: permissions.personId,
  };
}
