/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane project intake page at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 */

import { loadAppCapabilityAccessForUser } from "@/lib/app-capabilities";
import { getErrorDetail } from "@/lib/format-error";
import { getApiRouteUser } from "@/lib/supabase/server";
import { resolvePlaneIntakeAccess } from "./intake-access";
import { PlaneIntakeClient } from "./plane-intake-client";

export interface PlaneIntakeSurfaceProps {
  projectId: string;
}

export async function PlaneIntakeSurface({
  projectId,
}: PlaneIntakeSurfaceProps) {
  const user = await getApiRouteUser();
  let access = resolvePlaneIntakeAccess(false);
  let accessError: string | null = null;

  if (!user) {
    accessError = "Sign in again to verify Intake permissions.";
  } else {
    try {
      const capabilityAccess = await loadAppCapabilityAccessForUser(user.id);
      access = resolvePlaneIntakeAccess(capabilityAccess?.isAdmin === true);
    } catch (error) {
      accessError = `Outlook access could not be verified: ${getErrorDetail(error)}`;
    }
  }

  return (
    <PlaneIntakeClient
      projectId={projectId}
      access={access}
      accessError={accessError}
    />
  );
}
