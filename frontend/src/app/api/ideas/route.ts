import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  createIdea,
  createIdeaSchema,
  listIdeas,
  updateIdea,
  updateIdeaSchema,
} from "@/lib/ideas/server";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const patchIdeaSchema = z.object({
  id: z.string().uuid(),
  patch: updateIdeaSchema,
});

async function requireUser(where: string) {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "UNAUTHORIZED",
      where,
      message: "Authentication required to manage ideas.",
      status: 401,
    });
  }
  return user;
}

export const GET = withApiGuardrails("/api/ideas#GET", async ({ request }) => {
  await requireUser("/api/ideas#GET");
  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid idea list query.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ideas = await listIdeas(parsed.data.limit);
  return NextResponse.json({ ideas });
});

export const POST = withApiGuardrails("/api/ideas#POST", async ({ request }) => {
  const user = await requireUser("/api/ideas#POST");
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/ideas#POST",
      message: "Request body is not valid JSON.",
      status: 400,
    });
  }

  const parsed = createIdeaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid idea payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const idea = await createIdea(parsed.data, user.id);
  return NextResponse.json({ idea }, { status: 201 });
});

export const PATCH = withApiGuardrails("/api/ideas#PATCH", async ({ request }) => {
  await requireUser("/api/ideas#PATCH");
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/ideas#PATCH",
      message: "Request body is not valid JSON.",
      status: 400,
    });
  }

  const parsed = patchIdeaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid idea update payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const idea = await updateIdea(parsed.data.id, parsed.data.patch);
  return NextResponse.json({ idea });
});
