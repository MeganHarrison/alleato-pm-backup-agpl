import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  parseJsonBody,
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";

const CardParamsSchema = z.object({
  cardId: z.string().min(1),
});

const InitiativeCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.string().nullable().optional(),
  sort_order: z.number().nullable().optional(),
});

const UpdateCardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  sort_order: z.number().nullable().optional(),
  linked_record_type: z.string().nullable().optional(),
  linked_record_id: z.string().nullable().optional(),
  assignee: z.string().nullable().optional(),
  assignee_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  github_issue_url: z.string().nullable().optional(),
  dispatch_status: z.string().nullable().optional(),
});

export const GET = withApiGuardrails<Promise<{ cardId: string }>>(
  "/api/initiative-cards/[cardId]#GET",
  async ({ params }) => {
    const parsedParams = CardParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/initiative-cards/[cardId]#GET",
        message: "Invalid initiative card id.",
        details: parsedParams.error.issues.map((issue) => issue.message),
      });
    }

    const { cardId } = parsedParams.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("initiative_cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/initiative-cards/[cardId]#GET",
        message: "Failed to fetch initiative card.",
        details: { reason: error.message, cardId },
        cause: error,
      });
    }

    validateResponseContract(
      InitiativeCardSchema.passthrough(),
      data,
      "/api/initiative-cards/[cardId]#GET",
    );

    return NextResponse.json(data);
  },
);

export const PATCH = withApiGuardrails<Promise<{ cardId: string }>>(
  "/api/initiative-cards/[cardId]#PATCH",
  async ({ request, params }) => {
    const parsedParams = CardParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/initiative-cards/[cardId]#PATCH",
        message: "Invalid initiative card id.",
        details: parsedParams.error.issues.map((issue) => issue.message),
      });
    }

    const { cardId } = parsedParams.data;
    const supabase = await createClient();
    const updates = await parseJsonBody(
      request,
      UpdateCardSchema,
      "/api/initiative-cards/[cardId]#PATCH",
    );

    if (Object.keys(updates).length === 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/initiative-cards/[cardId]#PATCH",
        message: "No updatable fields were provided.",
      });
    }

    // initiative_cards.Update expects priority/sort_order to be non-null (DB
    // defaults apply), so strip null overrides before writing.
    const {
      priority: priorityOverride,
      sort_order: sortOrderOverride,
      ...restUpdates
    } = updates;
    const normalizedUpdates: typeof restUpdates & {
      priority?: string;
      sort_order?: number;
    } = { ...restUpdates };
    if (priorityOverride != null) normalizedUpdates.priority = priorityOverride;
    if (sortOrderOverride != null) normalizedUpdates.sort_order = sortOrderOverride;

    const { data, error } = await supabase
      .from("initiative_cards")
      .update(normalizedUpdates)
      .eq("id", cardId)
      .select()
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/initiative-cards/[cardId]#PATCH",
        message: "Failed to update initiative card.",
        details: { reason: error.message, cardId },
        cause: error,
      });
    }

    validateResponseContract(
      InitiativeCardSchema.passthrough(),
      data,
      "/api/initiative-cards/[cardId]#PATCH",
    );

    return NextResponse.json(data);
  },
);

export const DELETE = withApiGuardrails<Promise<{ cardId: string }>>(
  "/api/initiative-cards/[cardId]#DELETE",
  async ({ params }) => {
    const parsedParams = CardParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/initiative-cards/[cardId]#DELETE",
        message: "Invalid initiative card id.",
        details: parsedParams.error.issues.map((issue) => issue.message),
      });
    }

    const { cardId } = parsedParams.data;
    const supabase = await createClient();
    const { error } = await supabase
      .from("initiative_cards")
      .delete()
      .eq("id", cardId);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/initiative-cards/[cardId]#DELETE",
        message: "Failed to delete initiative card.",
        details: { reason: error.message, cardId },
        cause: error,
      });
    }

    return NextResponse.json({ success: true });
  },
);
