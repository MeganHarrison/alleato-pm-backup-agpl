/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Static Next.js adaptation of Plane v1.3.1 Stickies endpoints.
 */

import { NextResponse } from "next/server";

import {
  CreatePlaneStickyRequestSchema,
  DeletePlaneStickySchema,
  isPlaneStickyMigrationMissing,
  ListPlaneStickiesQuerySchema,
  UpdatePlaneStickySchema,
} from "@/features/plane-stickies/plane-stickies-contract";
import { assertPlaneStickyProjectAccess } from "@/features/plane-stickies/plane-stickies-permissions";
import {
  createPlaneStickiesRepository,
  type PlaneStickiesQueryError,
} from "@/features/plane-stickies/plane-stickies-repository";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const ROUTE = "/api/plane-stickies";

function requireUser(
  user: Awaited<ReturnType<typeof getApiRouteUser>>,
  where: string,
) {
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in to manage your stickies.",
      status: 401,
    });
  }
  return user;
}

function throwRepositoryFailure(
  where: string,
  action: string,
  error: PlaneStickiesQueryError | null,
): never {
  if (isPlaneStickyMigrationMissing(error)) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message:
        "Stickies are unavailable until the Plane Stickies database migration is applied.",
      status: 503,
      details: {
        operation: action,
        migration: "20260731231400_create_plane_stickies.sql",
      },
      cause: error,
    });
  }
  throw new GuardrailError({
    code: "INTERNAL_ERROR",
    where,
    message: `Could not ${action}.`,
    details: { operation: action },
    cause: error,
  });
}

async function authorizeProject(
  projectId: number | null | undefined,
  mode: "read" | "write",
  where: string,
) {
  if (typeof projectId === "number") {
    await assertPlaneStickyProjectAccess(projectId, mode, where);
  }
}

export const GET = withApiGuardrails(`${ROUTE}#GET`, async ({ request }) => {
  const where = `${ROUTE}#GET`;
  const user = requireUser(await getApiRouteUser(), where);
  const parsed = ListPlaneStickiesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where,
      message: "Invalid Stickies query.",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  await authorizeProject(parsed.data.project_id, "read", where);
  const repository = createPlaneStickiesRepository(await createClient());
  const result = await repository.list({
    ownerId: user.id,
    workspaceKey: parsed.data.workspace_key,
    scope: parsed.data.scope,
    projectId: parsed.data.project_id,
    archived: parsed.data.archived,
    limit: parsed.data.limit,
  });
  if (result.error || !result.data) {
    throwRepositoryFailure(where, "load stickies", result.error);
  }
  return NextResponse.json({ stickies: result.data });
});

export const POST = withApiGuardrails(`${ROUTE}#POST`, async ({ request }) => {
  const where = `${ROUTE}#POST`;
  const user = requireUser(await getApiRouteUser(), where);
  const input = await parseJsonBody(
    request,
    CreatePlaneStickyRequestSchema,
    where,
  );
  await authorizeProject(input.project_id, "write", where);

  const repository = createPlaneStickiesRepository(await createClient());
  const result = await repository.create({
    owner_id: user.id,
    workspace_key: input.workspace_key,
    scope: input.scope,
    project_id: input.project_id,
    content: input.content,
    background_color: input.background_color,
    sort_order: input.sort_order,
  });
  if (result.error || !result.data) {
    throwRepositoryFailure(where, "create the sticky", result.error);
  }
  return NextResponse.json({ sticky: result.data }, { status: 201 });
});

export const PATCH = withApiGuardrails(
  `${ROUTE}#PATCH`,
  async ({ request }) => {
    const where = `${ROUTE}#PATCH`;
    const user = requireUser(await getApiRouteUser(), where);
    const input = await parseJsonBody(request, UpdatePlaneStickySchema, where);
    const serviceRepository = createPlaneStickiesRepository(
      createServiceClient(),
    );
    const existing = await serviceRepository.findOwnedById(input.id, user.id);
    if (existing.error) {
      throwRepositoryFailure(where, "verify sticky ownership", existing.error);
    }
    if (!existing.data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "The sticky no longer exists.",
        status: 404,
      });
    }
    await authorizeProject(existing.data.project_id, "write", where);

    const { id, archived, ...changes } = input;
    const repository = createPlaneStickiesRepository(await createClient());
    const result = await repository.updateOwned(id, user.id, {
      ...changes,
      ...(typeof archived === "boolean"
        ? { archived_at: archived ? new Date().toISOString() : null }
        : {}),
    });
    if (result.error || !result.data) {
      throwRepositoryFailure(where, "update the sticky", result.error);
    }
    return NextResponse.json({ sticky: result.data });
  },
);

export const DELETE = withApiGuardrails(
  `${ROUTE}#DELETE`,
  async ({ request }) => {
    const where = `${ROUTE}#DELETE`;
    const user = requireUser(await getApiRouteUser(), where);
    const input = await parseJsonBody(request, DeletePlaneStickySchema, where);
    const serviceRepository = createPlaneStickiesRepository(
      createServiceClient(),
    );
    const existing = await serviceRepository.findOwnedById(input.id, user.id);
    if (existing.error) {
      throwRepositoryFailure(where, "verify sticky ownership", existing.error);
    }
    if (!existing.data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "The sticky no longer exists.",
        status: 404,
      });
    }
    await authorizeProject(existing.data.project_id, "write", where);

    const repository = createPlaneStickiesRepository(await createClient());
    const result = await repository.deleteOwned(input.id, user.id);
    if (result.error) {
      throwRepositoryFailure(where, "delete the sticky", result.error);
    }
    return new NextResponse(null, { status: 204 });
  },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
