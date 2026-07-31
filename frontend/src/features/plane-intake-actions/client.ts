/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { apiFetch } from "@/lib/api-client";
import type {
  PlaneIntakeActionRequest,
  PlaneIntakeActionResponse,
} from "./contracts";

export async function performPlaneIntakeAction(
  request: PlaneIntakeActionRequest,
  signal?: AbortSignal,
): Promise<PlaneIntakeActionResponse> {
  return apiFetch<PlaneIntakeActionResponse>("/api/plane-intake-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
}
