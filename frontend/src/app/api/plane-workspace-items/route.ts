/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Static Next.js adaptation of Plane v1.3.1's workspace UserFavorite
 * collection/detail endpoints.
 */

import { NextResponse } from "next/server";

import {
  DeletePlaneWorkspaceItemSchema,
  ListPlaneWorkspaceItemsQuerySchema,
  UpdatePlaneWorkspaceItemSchema,
  UpsertPlaneWorkspaceItemSchema,
  requiresPlaneWorkspaceProject,
} from "@/features/plane-workspace-items/plane-workspace-items-contract";
import { assertPlaneWorkspaceProjectAccess } from "@/features/plane-workspace-items/plane-workspace-items-permissions";
import { createPlaneWorkspaceItemsRepository } from "@/features/plane-workspace-items/plane-workspace-items-repository";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const ROUTE = "/api/plane-workspace-items";

function requireAuthenticatedUser(
  user: Awaited<ReturnType<typeof getApiRouteUser>>,
  where: string,
) {
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in to manage Favorites and Recents.",
      details: { reason: "No valid session cookie" },
    });
  }
  return user;
}

function throwQueryFailure(
  where: string,
  action: string,
  error: { message: string; code?: string } | null,
): never {
  throw new GuardrailError({
    code: "INTERNAL_ERROR",
    where,
    message: `Failed to ${action}.`,
    details: { operation: action },
    cause: error,
  });
}

async function assertOptionalProjectAccess(
  projectId: number | null | undefined,
  entityType: string,
  userId: string,
  where: string,
): Promise<void> {
  if (typeof projectId === "number") {
    await assertPlaneWorkspaceProjectAccess(
      projectId,
      entityType,
      userId,
      where,
    );
  }
}

export const GET = withApiGuardrails(`${ROUTE}#GET`, async ({ request }) => {
  const where = `${ROUTE}#GET`;
  const user = requireAuthenticatedUser(await getApiRouteUser(), where);
  const parsed = ListPlaneWorkspaceItemsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where,
      message: "Invalid Favorites or Recents query.",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  await assertOptionalProjectAccess(
    parsed.data.project_id,
    "project",
    user.id,
    where,
  );

  const repository = createPlaneWorkspaceItemsRepository(await createClient());
  const result = await repository.list({
    userId: user.id,
    workspaceKey: parsed.data.workspace_key,
    projectId: parsed.data.project_id,
    itemKind: parsed.data.item_kind,
    limit: parsed.data.limit,
  });

  if (result.error || !result.data) {
    throwQueryFailure(where, "load Favorites and Recents", result.error);
  }

  return NextResponse.json({ items: result.data });
});

export const POST = withApiGuardrails(`${ROUTE}#POST`, async ({ request }) => {
  const where = `${ROUTE}#POST`;
  const user = requireAuthenticatedUser(await getApiRouteUser(), where);
  const input = await parseJsonBody(
    request,
    UpsertPlaneWorkspaceItemSchema,
    where,
  );

  if (
    requiresPlaneWorkspaceProject(input.entity_type) &&
    input.project_id === null
  ) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where,
      message: "This workspace item requires a project.",
      status: 400,
      details: { entityType: input.entity_type },
    });
  }

  await assertOptionalProjectAccess(
    input.project_id,
    input.entity_type,
    user.id,
    where,
  );

  const repository = createPlaneWorkspaceItemsRepository(await createClient());
  const result = await repository.upsert({
    user_id: user.id,
    workspace_key: input.workspace_key,
    project_id: input.project_id,
    item_kind: input.item_kind,
    entity_type: input.entity_type,
    entity_identifier: input.entity_identifier,
    name: input.name,
    href: input.href,
    sort_order: input.sort_order,
    metadata: input.metadata,
    last_accessed_at: new Date().toISOString(),
  });

  if (result.error || !result.data) {
    throwQueryFailure(where, "save the workspace item", result.error);
  }

  return NextResponse.json({ item: result.data }, { status: 200 });
});

export const PATCH = withApiGuardrails(
  `${ROUTE}#PATCH`,
  async ({ request }) => {
    const where = `${ROUTE}#PATCH`;
    const user = requireAuthenticatedUser(await getApiRouteUser(), where);
    const input = await parseJsonBody(
      request,
      UpdatePlaneWorkspaceItemSchema,
      where,
    );

    const serviceRepository = createPlaneWorkspaceItemsRepository(
      createServiceClient(),
    );
    const existing = await serviceRepository.findOwnedById(input.id, user.id);
    if (existing.error) {
      throwQueryFailure(
        where,
        "verify workspace item ownership",
        existing.error,
      );
    }
    if (!existing.data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "The workspace item no longer exists.",
        status: 404,
        details: { id: input.id },
      });
    }

    await assertOptionalProjectAccess(
      existing.data.project_id,
      existing.data.entity_type,
      user.id,
      where,
    );

    const { id, touch, ...changes } = input;
    const serverOwnedChanges = {
      ...changes,
      ...(touch ? { last_accessed_at: new Date().toISOString() } : {}),
    };
    const repository = createPlaneWorkspaceItemsRepository(
      await createClient(),
    );
    const result = await repository.updateOwned(
      id,
      user.id,
      serverOwnedChanges,
    );
    if (result.error || !result.data) {
      throwQueryFailure(where, "update the workspace item", result.error);
    }

    return NextResponse.json({ item: result.data });
  },
);

export const DELETE = withApiGuardrails(
  `${ROUTE}#DELETE`,
  async ({ request }) => {
    const where = `${ROUTE}#DELETE`;
    const user = requireAuthenticatedUser(await getApiRouteUser(), where);
    const input = await parseJsonBody(
      request,
      DeletePlaneWorkspaceItemSchema,
      where,
    );

    const serviceRepository = createPlaneWorkspaceItemsRepository(
      createServiceClient(),
    );
    const existing = await serviceRepository.findOwnedById(input.id, user.id);
    if (existing.error) {
      throwQueryFailure(
        where,
        "verify workspace item ownership",
        existing.error,
      );
    }
    if (!existing.data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "The workspace item no longer exists.",
        status: 404,
        details: { id: input.id },
      });
    }

    await assertOptionalProjectAccess(
      existing.data.project_id,
      existing.data.entity_type,
      user.id,
      where,
    );

    const repository = createPlaneWorkspaceItemsRepository(
      await createClient(),
    );
    const result = await repository.deleteOwned(input.id, user.id);
    if (result.error) {
      throwQueryFailure(where, "remove the workspace item", result.error);
    }

    return new NextResponse(null, { status: 204 });
  },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
