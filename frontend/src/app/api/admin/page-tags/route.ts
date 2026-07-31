import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  slugifyTagLabel,
  type PageTag,
  type PageTagAssignment,
} from "@/lib/page-tags";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const CreateTagSchema = z.object({
  action: z.literal("create-tag"),
  label: z.string().trim().min(1).max(60),
  color: z.string().trim().max(40).nullable().optional(),
});

const BulkAssignTagsSchema = z.object({
  action: z.literal("bulk-assign-tags"),
  routes: z
    .array(z.string().trim().min(1).max(500).startsWith("/"))
    .min(1)
    .max(500),
  tagSlugs: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
});

const PostSchema = z.discriminatedUnion("action", [
  CreateTagSchema,
  BulkAssignTagsSchema,
]);

const SetAssignmentsSchema = z.object({
  route: z.string().trim().min(1).max(500).startsWith("/"),
  tagSlugs: z.array(z.string().trim().min(1).max(80)).max(50),
});

async function requireAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
      status: 401,
    });
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where,
      message: `Could not verify admin access: ${error.message}`,
      details: error,
    });
  }

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Page tag management requires app admin access.",
      status: 403,
    });
  }

  return user;
}

function toTag(row: {
  slug: string;
  label: string;
  color: string | null;
  updated_at: string | null;
}): PageTag {
  return {
    slug: row.slug,
    label: row.label,
    color: row.color,
    updatedAt: row.updated_at,
  };
}

function toAssignment(row: {
  route: string;
  tag_slug: string;
}): PageTagAssignment {
  return { route: row.route, tagSlug: row.tag_slug };
}

export const GET = withApiGuardrails("admin/page-tags#GET", async () => {
  await requireAdmin("admin/page-tags#GET");

  const [tagsResult, assignmentsResult] = await Promise.all([
    serviceDb.from("app_page_tags")
      .select("slug, label, color, updated_at")
      .order("label", { ascending: true }),
    serviceDb.from("app_page_tag_assignments")
      .select("route, tag_slug"),
  ]);

  if (tagsResult.error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "admin/page-tags#GET",
      message: `Failed to load page tags: ${tagsResult.error.message}`,
      details: tagsResult.error,
    });
  }

  if (assignmentsResult.error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "admin/page-tags#GET",
      message: `Failed to load page tag assignments: ${assignmentsResult.error.message}`,
      details: assignmentsResult.error,
    });
  }

  return NextResponse.json({
    tags: (tagsResult.data ?? []).map(toTag),
    assignments: (assignmentsResult.data ?? []).map(toAssignment),
  });
});

/**
 * Catalog + bulk actions:
 * - `create-tag` creates a new tag (slug derived from the label).
 * - `bulk-assign-tags` adds the given tags to every listed route, preserving
 *   each route's existing tags (duplicates are ignored, nothing is removed).
 */
export const POST = withApiGuardrails("admin/page-tags#POST", async ({ request }) => {
  const actor = await requireAdmin("admin/page-tags#POST");
  const parsed = PostSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "admin/page-tags#POST",
      message: "Page-tags action payload is invalid.",
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  if (parsed.data.action === "bulk-assign-tags") {
    const routes = [...new Set(parsed.data.routes)];
    const tagSlugs = [...new Set(parsed.data.tagSlugs)];

    // Reject unknown slugs so a typo can't create a dangling assignment.
    const { data: knownTags, error: knownError } = await serviceDb.from("app_page_tags")
      .select("slug")
      .in("slug", tagSlugs);

    if (knownError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "admin/page-tags#POST",
        message: `Failed to validate tags: ${knownError.message}`,
        details: knownError,
      });
    }

    const knownSlugs = new Set((knownTags ?? []).map((tag) => tag.slug));
    const missing = tagSlugs.filter((slug) => !knownSlugs.has(slug));
    if (missing.length > 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "admin/page-tags#POST",
        message: `Unknown tag(s): ${missing.join(", ")}.`,
        status: 400,
      });
    }

    const { error: upsertError } = await serviceDb.from("app_page_tag_assignments")
      .upsert(
        routes.flatMap((route) =>
          tagSlugs.map((slug) => ({
            route,
            tag_slug: slug,
            created_by: actor.id,
          })),
        ),
        { onConflict: "route,tag_slug", ignoreDuplicates: true },
      );

    if (upsertError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "admin/page-tags#POST",
        message: `Failed to bulk-assign tags: ${upsertError.message}`,
        details: upsertError,
      });
    }

    return NextResponse.json({
      routes,
      tagSlugs,
      assignments: routes.flatMap((route) =>
        tagSlugs.map((slug) => ({ route, tagSlug: slug })),
      ),
    });
  }

  const slug = slugifyTagLabel(parsed.data.label);
  if (!slug) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "admin/page-tags#POST",
      message: "Tag label must contain at least one letter or number.",
      status: 400,
    });
  }


  // Reject a duplicate slug loudly instead of silently overwriting the label.
  const { data: existing, error: existingError } = await serviceDb.from("app_page_tags")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "admin/page-tags#POST",
      message: `Failed to check existing tag: ${existingError.message}`,
      details: existingError,
    });
  }

  if (existing) {
    throw new GuardrailError({
      code: "BAD_REQUEST",
      where: "admin/page-tags#POST",
      message: `A tag named "${parsed.data.label}" already exists.`,
      status: 409,
    });
  }

  const { data, error } = await serviceDb.from("app_page_tags")
    .insert({
      slug,
      label: parsed.data.label,
      color: parsed.data.color ?? null,
      updated_by: actor.id,
    })
    .select("slug, label, color, updated_at")
    .single();

  if (error || !data) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "admin/page-tags#POST",
      message: `Failed to create tag: ${error?.message ?? "no row returned"}`,
      details: error,
    });
  }

  return NextResponse.json({ tag: toTag(data) }, { status: 201 });
});

/** Replace the full set of tags applied to a single route. */
export const PUT = withApiGuardrails("admin/page-tags#PUT", async ({ request }) => {
  const actor = await requireAdmin("admin/page-tags#PUT");
  const parsed = SetAssignmentsSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "admin/page-tags#PUT",
      message: "Tag assignment payload is invalid.",
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { route, tagSlugs } = parsed.data;
  const uniqueSlugs = [...new Set(tagSlugs)];

  // Reject unknown slugs so a typo can't create a dangling assignment.
  if (uniqueSlugs.length > 0) {
    const { data: knownTags, error: knownError } = await serviceDb.from("app_page_tags")
      .select("slug")
      .in("slug", uniqueSlugs);

    if (knownError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "admin/page-tags#PUT",
        message: `Failed to validate tags: ${knownError.message}`,
        details: knownError,
      });
    }

    const knownSlugs = new Set((knownTags ?? []).map((tag) => tag.slug));
    const missing = uniqueSlugs.filter((slug) => !knownSlugs.has(slug));
    if (missing.length > 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "admin/page-tags#PUT",
        message: `Unknown tag(s): ${missing.join(", ")}.`,
        status: 400,
      });
    }
  }

  // Replace the route's assignments: clear then insert the desired set.
  const { error: deleteError } = await serviceDb.from("app_page_tag_assignments")
    .delete()
    .eq("route", route);

  if (deleteError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "admin/page-tags#PUT",
      message: `Failed to clear existing tags: ${deleteError.message}`,
      details: deleteError,
    });
  }

  if (uniqueSlugs.length > 0) {
    const { error: insertError } = await serviceDb.from("app_page_tag_assignments")
      .insert(
        uniqueSlugs.map((slug) => ({
          route,
          tag_slug: slug,
          created_by: actor.id,
        })),
      );

    if (insertError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "admin/page-tags#PUT",
        message: `Failed to save tags: ${insertError.message}`,
        details: insertError,
      });
    }
  }

  return NextResponse.json({
    route,
    assignments: uniqueSlugs.map((slug) => ({ route, tagSlug: slug })),
  });
});
