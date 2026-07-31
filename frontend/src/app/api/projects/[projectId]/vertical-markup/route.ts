import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const ALLOWED_MARKUP_TYPES = ["insurance", "bond", "fee", "overhead", "custom"] as const;

function normalizeMarkupType(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isAllowedMarkupType(value: string): boolean {
  return ALLOWED_MARKUP_TYPES.includes(value as (typeof ALLOWED_MARKUP_TYPES)[number]);
}

export interface VerticalMarkupItem {
  id: string;
  projectId: string;
  markup_type: string;
  percentage: number;
  compound: boolean;
  calculation_order: number;
  project_id: number;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_MARKUPS = [
  { markup_type: "insurance", percentage: 1.35, compound: false, calculation_order: 1 },
  { markup_type: "fee", percentage: 10, compound: false, calculation_order: 2 },
] as const;

// GET /api/projects/[id]/vertical-markup - Fetch vertical markup settings
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/vertical-markup#GET",
  async ({ request, params }) => {

    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/vertical-markup#GET", message: "Authentication required." });
    }

    const { data, error } = await supabase
      .from("vertical_markup")
      .select("*")
      .eq("project_id", projectIdNum)
      .order("calculation_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch vertical markup settings" },
        { status: 500 },
      );
    }

    // Seed standard defaults on first access so PMs don't start from a blank slate.
    if (!data || data.length === 0) {
      const { data: seeded, error: seedError } = await supabase
        .from("vertical_markup")
        .insert(
          DEFAULT_MARKUPS.map((m) => ({ ...m, project_id: projectIdNum })),
        )
        .select();

      if (seedError) {
        logger.error({ msg: "Failed to seed default vertical markups", error: seedError.message });
      }

      return NextResponse.json({ markups: seeded || [] });
    }

    return NextResponse.json({
      markups: data || [],
    });
    },
);

// POST /api/projects/[id]/vertical-markup - Create a new vertical markup
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/vertical-markup#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { markup_type, percentage, compound = false } = body;
    const normalizedMarkupType = normalizeMarkupType(markup_type);
    const normalizedPercentage = Number(percentage);

    if (!markup_type || percentage === undefined) {
      return NextResponse.json(
        { error: "markup_type and percentage are required" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(normalizedPercentage) || normalizedPercentage < 0 || normalizedPercentage > 100) {
      return NextResponse.json(
        { error: "percentage must be a number between 0 and 100" },
        { status: 400 },
      );
    }
    if (!isAllowedMarkupType(normalizedMarkupType)) {
      return NextResponse.json(
        {
          error: `markup_type must be one of: ${ALLOWED_MARKUP_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/vertical-markup#POST", message: "Authentication required." });
    }

    // Get the next calculation order
    const { data: existingMarkups } = await supabase
      .from("vertical_markup")
      .select("calculation_order")
      .eq("project_id", projectIdNum)
      .order("calculation_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existingMarkups && existingMarkups.length > 0
        ? existingMarkups[0].calculation_order + 1
        : 1;

    const { data, error } = await supabase
      .from("vertical_markup")
      .insert({
        project_id: projectIdNum,
        markup_type: normalizedMarkupType,
        percentage: normalizedPercentage,
        compound: Boolean(compound),
        calculation_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Markup name must be unique for this project. Please rename duplicate markup types and try again.",
          },
          { status: 409 },
        );
      }
      logger.error({ msg: "Vertical markup insert error", error: error.message });
      return apiErrorResponse(error);
    }

    return NextResponse.json({
      success: true,
      data,
    });
    },
);

// PUT /api/projects/[id]/vertical-markup - Update vertical markup (bulk update for reordering)
export const PUT = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/vertical-markup#PUT",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { markups } = body;

    if (!markups || !Array.isArray(markups)) {
      return NextResponse.json(
        { error: "markups array is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/vertical-markup#PUT", message: "Authentication required." });
    }

    // Validate payload first so we do not partially update rows.
    const normalizedMarkupTypes = new Set<string>();
    for (const [index, markup] of markups.entries()) {
      const markupType = normalizeMarkupType(markup?.markup_type);
      const percentage = Number(markup?.percentage);
      if (!markup?.id || !markupType) {
        return NextResponse.json(
          { error: `Invalid markup row at index ${index}: id and markup_type are required` },
          { status: 400 },
        );
      }
      if (!isAllowedMarkupType(markupType)) {
        return NextResponse.json(
          {
            error: `Invalid markup row at index ${index}: markup_type must be one of ${ALLOWED_MARKUP_TYPES.join(", ")}`,
          },
          { status: 400 },
        );
      }
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        return NextResponse.json(
          { error: `Invalid markup row at index ${index}: percentage must be between 0 and 100` },
          { status: 400 },
        );
      }
      const normalizedTypeKey = markupType.toLowerCase();
      if (normalizedMarkupTypes.has(normalizedTypeKey)) {
        return NextResponse.json(
          {
            error:
              "Markup name must be unique for this project. Please rename duplicate markup types and try again.",
          },
          { status: 409 },
        );
      }
      normalizedMarkupTypes.add(normalizedTypeKey);
    }

    // Update each markup row.
    for (const [index, markup] of markups.entries()) {
      const normalizedMarkupType = normalizeMarkupType(markup.markup_type);
      const { error: updateError } = await supabase
        .from("vertical_markup")
        .update({
          markup_type: normalizedMarkupType,
          percentage: Number(markup.percentage),
          compound: Boolean(markup.compound),
          calculation_order: index + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", markup.id)
        .eq("project_id", projectIdNum);

      if (updateError) {
        if (updateError.code === "23505") {
          return NextResponse.json(
            {
              error:
                "Markup name must be unique for this project. Please rename duplicate markup types and try again.",
            },
            { status: 409 },
          );
        }
        return NextResponse.json(
          {
            error: "Failed to update vertical markups",
            details: `Row ${index + 1}: ${updateError.message}`,
          },
          { status: 500 },
        );
      }
    }

    // Fetch updated markups
    const { data, error } = await supabase
      .from("vertical_markup")
      .select("*")
      .eq("project_id", projectIdNum)
      .order("calculation_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to update vertical markups" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      markups: data,
    });
    },
);

// DELETE /api/projects/[id]/vertical-markup - Delete a vertical markup
export const DELETE = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/vertical-markup#DELETE",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const markupId = searchParams.get("markupId");

    if (!markupId) {
      return NextResponse.json(
        { error: "markupId is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/vertical-markup#DELETE", message: "Authentication required." });
    }

    const { error } = await supabase
      .from("vertical_markup")
      .delete()
      .eq("id", markupId)
      .eq("project_id", projectIdNum);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete vertical markup" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Vertical markup deleted successfully",
    });
    },
);
