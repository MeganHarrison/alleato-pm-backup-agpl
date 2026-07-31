export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { requireAppAdmin } from "@/lib/auth/require-app-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { createTemplateSchema } from "@/lib/meetings/template-schemas";
import type { Database } from "@/types/database.types";

import { insertTemplateCategoriesAndItems } from "../route";

const WHERE_GET = "admin/meeting-templates/[templateId]#GET";
const WHERE_PATCH = "admin/meeting-templates/[templateId]#PATCH";
const WHERE_DELETE = "admin/meeting-templates/[templateId]#DELETE";

async function loadFullTemplate(
  service: SupabaseClient<Database>,
  templateId: string,
  where: string,
) {
  const { data: templateRow, error: templateError } = await service
    .from("meeting_templates")
    .select("id, name, overview, is_private")
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle();

  if (templateError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: `Failed to load meeting template: ${templateError.message}`,
      details: templateError,
    });
  }

  if (!templateRow) {
    return null;
  }

  const { data: categoryRows, error: categoriesError } = await service
    .from("meeting_template_categories")
    .select("id, name, position")
    .eq("template_id", templateId)
    .order("position", { ascending: true });

  if (categoriesError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: `Failed to load template categories: ${categoriesError.message}`,
      details: categoriesError,
    });
  }

  const categories = (categoryRows ?? []) as Array<{ id: string; name: string; position: number }>;
  const categoryIds = categories.map((category) => category.id);

  const itemsByCategoryId = new Map<
    string,
    Array<{ id: string; position: number; title: string; description: string | null; priority: string | null }>
  >();

  if (categoryIds.length > 0) {
    const { data: itemRows, error: itemsError } = await service
      .from("meeting_template_items")
      .select("id, template_category_id, position, title, description, priority")
      .in("template_category_id", categoryIds)
      .order("position", { ascending: true });

    if (itemsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load template items: ${itemsError.message}`,
        details: itemsError,
      });
    }

    for (const item of (itemRows ?? []) as Array<{
      id: string;
      template_category_id: string;
      position: number;
      title: string;
      description: string | null;
      priority: string | null;
    }>) {
      const current = itemsByCategoryId.get(item.template_category_id) ?? [];
      current.push({
        id: item.id,
        position: item.position,
        title: item.title,
        description: item.description,
        priority: item.priority,
      });
      itemsByCategoryId.set(item.template_category_id, current);
    }
  }

  return {
    id: templateRow.id,
    name: templateRow.name,
    overview: templateRow.overview,
    is_private: templateRow.is_private,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      position: category.position,
      items: itemsByCategoryId.get(category.id) ?? [],
    })),
  };
}

// GET: Full nested template detail.
export const GET = withApiGuardrails<{ templateId: string }>(WHERE_GET, async ({ params }) => {
  await requireAppAdmin(WHERE_GET);
  const { templateId } = params;
  assertNonNilUuid(templateId, "templateId", WHERE_GET);

  const service = createServiceClient();
  const template = await loadFullTemplate(service, templateId, WHERE_GET);

  if (!template) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE_GET,
      message: "Meeting template not found.",
      status: 404,
    });
  }

  return NextResponse.json(template);
});

// PATCH: Full-replace update — updates template fields, deletes all existing
// categories (cascades to items), and re-inserts from the payload.
export const PATCH = withApiGuardrails<{ templateId: string }>(WHERE_PATCH, async ({ request, params }) => {
  await requireAppAdmin(WHERE_PATCH);
  const { templateId } = params;
  assertNonNilUuid(templateId, "templateId", WHERE_PATCH);

  const payload = await parseJsonBody(request, createTemplateSchema, WHERE_PATCH);
  const service = createServiceClient();

  const { data: existingTemplate, error: existingTemplateError } = await service
    .from("meeting_templates")
    .select("id")
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingTemplateError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_PATCH,
      message: `Failed to look up meeting template: ${existingTemplateError.message}`,
      details: existingTemplateError,
    });
  }

  if (!existingTemplate) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE_PATCH,
      message: "Meeting template not found.",
      status: 404,
    });
  }

  const { error: updateError } = await service
    .from("meeting_templates")
    .update({
      name: payload.name,
      overview: payload.overview ?? null,
      is_private: payload.is_private ?? false,
    })
    .eq("id", templateId);

  if (updateError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_PATCH,
      message: `Failed to update meeting template: ${updateError.message}`,
      details: updateError,
    });
  }

  const { error: deleteCategoriesError } = await service
    .from("meeting_template_categories")
    .delete()
    .eq("template_id", templateId);

  if (deleteCategoriesError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_PATCH,
      message: `Failed to clear existing template categories: ${deleteCategoriesError.message}`,
      details: deleteCategoriesError,
    });
  }

  await insertTemplateCategoriesAndItems(service, templateId, payload.categories, WHERE_PATCH);

  const template = await loadFullTemplate(service, templateId, WHERE_PATCH);

  if (!template) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_PATCH,
      message: "Meeting template was updated but could not be reloaded.",
    });
  }

  return NextResponse.json(template);
});

// DELETE: Soft delete.
export const DELETE = withApiGuardrails<{ templateId: string }>(WHERE_DELETE, async ({ params }) => {
  await requireAppAdmin(WHERE_DELETE);
  const { templateId } = params;
  assertNonNilUuid(templateId, "templateId", WHERE_DELETE);

  const service = createServiceClient();

  const { error } = await service
    .from("meeting_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", templateId);

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_DELETE,
      message: `Failed to delete meeting template: ${error.message}`,
      details: error,
    });
  }

  return NextResponse.json({ success: true });
});
