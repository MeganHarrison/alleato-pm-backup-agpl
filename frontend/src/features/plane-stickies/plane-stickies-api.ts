/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
  PlaneStickySchema,
  type CreatePlaneStickyInput,
  type PlaneSticky,
  type PlaneStickyScope,
  type UpdatePlaneStickyInput,
} from "./plane-stickies-contract";
import { apiFetch } from "@/lib/api-client";

export interface PlaneStickiesApi {
  list(input: {
    workspaceKey: string;
    scope: PlaneStickyScope;
    projectId?: number;
    archived: boolean;
  }): Promise<PlaneSticky[]>;
  create(input: CreatePlaneStickyInput): Promise<PlaneSticky>;
  update(input: UpdatePlaneStickyInput): Promise<PlaneSticky>;
  remove(id: string): Promise<void>;
}

export const planeStickiesApi: PlaneStickiesApi = {
  async list(input) {
    const query = new URLSearchParams({
      workspace_key: input.workspaceKey,
      scope: input.scope,
      archived: String(input.archived),
    });
    if (typeof input.projectId === "number") {
      query.set("project_id", String(input.projectId));
    }
    const payload = await apiFetch<{ stickies?: unknown }>(
      `/api/plane-stickies?${query.toString()}`,
      { cache: "no-store" },
    );
    return PlaneStickySchema.array().parse(payload.stickies);
  },

  async create(input) {
    const payload = await apiFetch<{ sticky?: unknown }>(
      "/api/plane-stickies",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return PlaneStickySchema.parse(payload.sticky);
  },

  async update(input) {
    const payload = await apiFetch<{ sticky?: unknown }>(
      "/api/plane-stickies",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return PlaneStickySchema.parse(payload.sticky);
  },

  async remove(id) {
    await apiFetch("/api/plane-stickies", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
  },
};
