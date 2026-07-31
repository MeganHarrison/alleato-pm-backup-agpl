import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  parseJsonBody,
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";

const InitiativeCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.string().nullable().optional(),
  sort_order: z.number().nullable().optional(),
});

const CreateCardSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  labels: z.array(z.string()).optional(),
  linked_record_type: z.string().nullable().optional(),
  linked_record_id: z.string().nullable().optional(),
  source: z.string().optional(),
  external_id: z.string().nullable().optional(),
  github_issue_url: z.string().nullable().optional(),
  assignee: z.string().nullable().optional(),
  assignee_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

const ReorderSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      sort_order: z.number(),
    }),
  ),
});

export const GET = withApiGuardrails("/api/initiative-cards#GET", async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("initiative_cards")
    .select("*")
    .order("status")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/initiative-cards#GET",
      message: "Failed to fetch initiative cards.",
      details: { reason: error.message },
      cause: error,
    });
  }

  validateResponseContract(
    z.array(InitiativeCardSchema.passthrough()),
    data ?? [],
    "/api/initiative-cards#GET",
  );

  return NextResponse.json(data);
});

export const POST = withApiGuardrails("/api/initiative-cards#POST", async ({ request }) => {
  const supabase = await createClient();
  const body = await parseJsonBody(
    request,
    CreateCardSchema,
    "/api/initiative-cards#POST",
  );

  const status = body.status || "idea";

  const { data: maxRow } = await supabase
    .from("initiative_cards")
    .select("sort_order")
    .eq("status", status)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("initiative_cards")
    .insert({
      title: body.title,
      description: body.description || null,
      status,
      priority: body.priority || "medium",
      labels: body.labels || [],
      sort_order: nextOrder,
      linked_record_type: body.linked_record_type || null,
      linked_record_id: body.linked_record_id || null,
      source: body.source || "manual",
      external_id: body.external_id || null,
      github_issue_url: body.github_issue_url || null,
      assignee: body.assignee || null,
      assignee_id: body.assignee_id || null,
      due_date: body.due_date || null,
    })
    .select()
    .single();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/initiative-cards#POST",
      message: "Failed to create initiative card.",
      details: { reason: error.message },
      cause: error,
    });
  }

  return NextResponse.json(data, { status: 201 });
});

export const PATCH = withApiGuardrails("/api/initiative-cards#PATCH", async ({ request }) => {
  const supabase = await createClient();

  const reorder = await parseJsonBody(
    request,
    ReorderSchema,
    "/api/initiative-cards#PATCH",
  );

  const updates = reorder.cards.map((card) =>
    supabase
      .from("initiative_cards")
      .update({ status: card.status, sort_order: card.sort_order })
      .eq("id", card.id),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/initiative-cards#PATCH",
      message: "Failed to reorder initiative cards.",
      details: { reason: failed.error.message },
      cause: failed.error,
    });
  }

  return NextResponse.json({ success: true });
});
