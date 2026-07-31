export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireAppAdmin } from "@/lib/auth/require-app-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createTemplateSchema } from "@/lib/meetings/template-schemas";
import type { Database } from "@/types/database.types";

const WHERE_GET = "admin/meeting-templates#GET";
const WHERE_POST = "admin/meeting-templates#POST";

// GET: List company-level meeting templates with batched category/item counts.
export const GET = withApiGuardrails(WHERE_GET, async () => {
  await requireAppAdmin(WHERE_GET);
  const service = createServiceClient();

  const { data: templateRows, error: templatesError } = await service
    .from("meeting_templates")
    .select("id, name, overview, is_private, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (templatesError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_GET,
      message: `Failed to load meeting templates: ${templatesError.message}`,
      details: templatesError,
    });
  }

  const templates = templateRows ?? [];
  const templateIds = templates.map((template) => template.id);

  const categoryCountByTemplateId = new Map<string, number>();
  const categoryIdsByTemplateId = new Map<string, string[]>();

  if (templateIds.length > 0) {
    const { data: categoryRows, error: categoriesError } = await service
      .from("meeting_template_categories")
      .select("id, template_id")
      .in("template_id", templateIds);

    if (categoriesError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE_GET,
        message: `Failed to load template category counts: ${categoriesError.message}`,
        details: categoriesError,
      });
    }

    for (const row of (categoryRows ?? []) as Array<{ id: string; template_id: string }>) {
      categoryCountByTemplateId.set(
        row.template_id,
        (categoryCountByTemplateId.get(row.template_id) ?? 0) + 1,
      );
      const current = categoryIdsByTemplateId.get(row.template_id) ?? [];
      current.push(row.id);
      categoryIdsByTemplateId.set(row.template_id, current);
    }
  }

  const allCategoryIds = Array.from(categoryIdsByTemplateId.values()).flat();
  const itemCountByCategoryId = new Map<string, number>();

  if (allCategoryIds.length > 0) {
    const { data: itemRows, error: itemsError } = await service
      .from("meeting_template_items")
      .select("template_category_id")
      .in("template_category_id", allCategoryIds);

    if (itemsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE_GET,
        message: `Failed to load template item counts: ${itemsError.message}`,
        details: itemsError,
      });
    }

    for (const row of (itemRows ?? []) as Array<{ template_category_id: string }>) {
      itemCountByCategoryId.set(
        row.template_category_id,
        (itemCountByCategoryId.get(row.template_category_id) ?? 0) + 1,
      );
    }
  }

  const responseTemplates = templates.map((template) => {
    const categoryIds = categoryIdsByTemplateId.get(template.id) ?? [];
    const itemCount = categoryIds.reduce(
      (sum, categoryId) => sum + (itemCountByCategoryId.get(categoryId) ?? 0),
      0,
    );
    return {
      id: template.id,
      name: template.name,
      overview: template.overview,
      is_private: template.is_private,
      updated_at: template.updated_at,
      category_count: categoryCountByTemplateId.get(template.id) ?? 0,
      item_count: itemCount,
    };
  });

  return NextResponse.json({ templates: responseTemplates });
});

// POST: Create a company-level meeting template with nested categories/items.
export const POST = withApiGuardrails(WHERE_POST, async ({ request }) => {
  await requireAppAdmin(WHERE_POST);

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE_POST,
      message: "Sign in before managing meeting templates.",
      status: 401,
    });
  }

  const payload = await parseJsonBody(request, createTemplateSchema, WHERE_POST);
  const service = createServiceClient();

  const { data: newTemplate, error: templateError } = await service
    .from("meeting_templates")
    .insert({
      name: payload.name,
      overview: payload.overview ?? null,
      is_private: payload.is_private ?? false,
      created_by: user.id,
    })
    .select("id, name, overview, is_private")
    .single();

  if (templateError || !newTemplate) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_POST,
      message: `Failed to create meeting template: ${templateError?.message ?? "Unknown insert failure"}`,
      details: templateError,
    });
  }

  const templateId = newTemplate.id as string;

  try {
    const categories = await insertTemplateCategoriesAndItems(service, templateId, payload.categories);

    return NextResponse.json(
      {
        id: newTemplate.id,
        name: newTemplate.name,
        overview: newTemplate.overview,
        is_private: newTemplate.is_private,
        categories,
      },
      { status: 201 },
    );
  } catch (postInsertError) {
    try {
      await service.from("meeting_templates").delete().eq("id", templateId);
    } catch (cleanupError) {
      // Best-effort only — the original error is what matters to the caller.
      console.error(
        `[${WHERE_POST}] Failed to clean up orphaned template ${templateId} after partial create failure:`,
        cleanupError,
      );
    }
    throw postInsertError;
  }
});

// Shared helper: insert nested categories + items for a template, positions
// derived from array order. Used by POST (create) and PATCH (full replace).
export async function insertTemplateCategoriesAndItems(
  service: SupabaseClient<Database>,
  templateId: string,
  categories: Array<{
    name: string;
    items: Array<{ title: string; description?: string; priority?: string }>;
  }>,
  where: string = "admin/meeting-templates#insertTemplateCategoriesAndItems",
) {
  if (categories.length === 0) {
    return [];
  }

  const { data: insertedCategories, error: categoriesError } = await service
    .from("meeting_template_categories")
    .insert(
      categories.map((category, index) => ({
        template_id: templateId,
        name: category.name,
        position: index,
      })),
    )
    .select("id, name, position");

  if (categoriesError || !insertedCategories) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: `Failed to create template categories: ${categoriesError?.message ?? "Unknown insert failure"}`,
      details: categoriesError,
    });
  }

  const sortedInsertedCategories = [...insertedCategories].sort(
    (a: { position: number }, b: { position: number }) => a.position - b.position,
  );

  const itemInserts: Array<{
    template_category_id: string;
    title: string;
    description: string | null;
    priority: string | null;
    position: number;
  }> = [];

  const categoriesWithItems = sortedInsertedCategories.map(
    (insertedCategory: { id: string; name: string; position: number }, categoryIndex: number) => {
      const sourceItems = categories[categoryIndex]?.items ?? [];
      const items = sourceItems.map((item, itemIndex) => {
        itemInserts.push({
          template_category_id: insertedCategory.id,
          title: item.title,
          description: item.description ?? null,
          priority: item.priority ?? null,
          position: itemIndex,
        });
        return {
          title: item.title,
          description: item.description ?? null,
          priority: item.priority ?? null,
          position: itemIndex,
        };
      });
      return {
        id: insertedCategory.id,
        name: insertedCategory.name,
        position: insertedCategory.position,
        items,
      };
    },
  );

  if (itemInserts.length > 0) {
    const { error: itemsError } = await service.from("meeting_template_items").insert(itemInserts);

    if (itemsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to create template items: ${itemsError.message}`,
        details: itemsError,
      });
    }
  }

  return categoriesWithItems;
}
