"use client";

import { type ReactNode } from "react";
import { useUserPermissions } from "@/hooks/use-permissions";
import type { PermissionModule, PermissionLevel, GranularFlag } from "@/lib/permissions-shared";
import { hasGranular } from "@/lib/permissions-shared";

interface PermissionGateProps {
  /** Project ID to check permissions for */
  projectId: string | number;
  /** Module to check */
  module: PermissionModule;
  /** Minimum required level */
  level: PermissionLevel;
  /** Content shown when user has permission */
  children: ReactNode;
  /** Optional content shown when user lacks permission (defaults to nothing) */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on the current user's permission level.
 *
 * Usage:
 *   <PermissionGate projectId={projectId} module="budget" level="write">
 *     <Button>Edit Budget</Button>
 *   </PermissionGate>
 */
export function PermissionGate({
  projectId,
  module,
  level,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, isLoading } = useUserPermissions(projectId);

  if (isLoading) return null;

  return hasPermission(module, level) ? <>{children}</> : <>{fallback}</>;
}

interface GranularGateProps {
  projectId: string | number;
  flag: GranularFlag;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on a granular permission flag.
 *
 * Usage:
 *   <GranularGate projectId={projectId} flag="approve_invoices">
 *     <Button>Approve</Button>
 *   </GranularGate>
 */
export function GranularGate({
  projectId,
  flag,
  children,
  fallback = null,
}: GranularGateProps) {
  const { permissions, isLoading } = useUserPermissions(projectId);

  if (isLoading || !permissions) return null;

  return hasGranular(permissions, flag) ? <>{children}</> : <>{fallback}</>;
}
