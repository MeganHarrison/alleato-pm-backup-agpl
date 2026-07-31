"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireTrainingReviewer } from "@/lib/training/reviewer-access";

const courseSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary: z.string().trim().max(500),
  outcome: z.string().trim().min(8).max(500),
  difficulty: z.string().trim().max(80),
  estimatedMinutes: z.coerce.number().int().min(1).max(2400),
});

const resourceSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(1000),
  url: z.string().url(),
  topicId: z.string().uuid(),
  roleIds: z.array(z.string().uuid()).max(30),
  resourceType: z.enum(["video", "course", "doc"]),
  level: z.enum(["intro", "deep-dive"]),
  track: z.string().trim().min(2).max(80),
  provider: z.string().trim().max(120),
  durationMinutes: z.coerce.number().int().min(1).max(2400).optional(),
});

const displayAreaSchema = z.enum([
  "training",
  "resources",
  "sops",
  "documentation",
]);

const bulkGovernanceFieldSchema = z.enum([
  "display_area",
  "owner_user_id",
  "reviewer_user_id",
  "next_review_at",
]);

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "The submitted content is invalid.";
}

export async function createCourseAction(formData: FormData) {
  await requireTrainingReviewer("content.createCourse");
  const request = courseSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    summary: formData.get("summary") ?? "",
    outcome: formData.get("outcome"),
    difficulty: formData.get("difficulty") ?? "",
    estimatedMinutes: formData.get("estimatedMinutes"),
  });
  if (!request.success) {
    redirect(
      `/content/courses/new?error=${encodeURIComponent(firstIssue(request.error))}`,
    );
  }

  const supabase = await createClient();
  const { data: courseId, error } = await supabase.rpc(
    "create_learning_course",
    {
      p_title: request.data.title,
      p_slug: request.data.slug,
      p_summary: request.data.summary || undefined,
      p_outcome: request.data.outcome,
      p_difficulty: request.data.difficulty || undefined,
      p_estimated_minutes: request.data.estimatedMinutes,
      p_visibility: "internal",
      p_completion_rule: "all_required",
    },
  );
  if (error || !courseId) {
    redirect(
      `/content/courses/new?error=${encodeURIComponent(
        error?.message ?? "The course could not be created.",
      )}`,
    );
  }
  revalidatePath("/content");
  redirect(`/content/courses/${courseId}`);
}

export async function createResourceAction(formData: FormData) {
  await requireTrainingReviewer("content.createResource");
  const request = resourceSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    url: formData.get("url"),
    topicId: formData.get("topicId"),
    roleIds: formData.getAll("roleIds"),
    resourceType: formData.get("resourceType"),
    level: formData.get("level"),
    track: formData.get("track"),
    provider: formData.get("provider") ?? "",
    durationMinutes: formData.get("durationMinutes") || undefined,
  });
  if (!request.success) {
    redirect(
      `/content/resources/new?error=${encodeURIComponent(firstIssue(request.error))}`,
    );
  }

  const { data: resourceId, error } = await (
    await createClient()
  ).rpc("create_training_resource_with_roles", {
    p_title: request.data.title,
    p_description: request.data.description,
    p_url: request.data.url,
    p_topic_id: request.data.topicId,
    p_resource_type: request.data.resourceType,
    p_level: request.data.level,
    p_track: request.data.track,
    p_provider: request.data.provider || undefined,
    p_duration_minutes: request.data.durationMinutes,
    p_role_ids: request.data.roleIds,
  });
  if (error || !resourceId) {
    redirect(
      `/content/resources/new?error=${encodeURIComponent(
        error?.message ?? "The resource could not be submitted.",
      )}`,
    );
  }
  revalidatePath("/content");
  revalidatePath("/training/review");
  redirect(
    "/training/review?reviewStatus=success&reviewMessage=Resource%20submitted%20for%20review.",
  );
}

export async function updateContentDisplayAreaAction(
  contentItemId: string,
  displayArea: string,
) {
  await requireTrainingReviewer("content.updateDisplayArea");
  const request = z
    .object({
      contentItemId: z.string().uuid(),
      displayArea: displayAreaSchema,
    })
    .safeParse({ contentItemId, displayArea });
  if (!request.success) {
    throw new Error(
      `Content placement was not updated: ${firstIssue(request.error)}`,
    );
  }

  const { data, error } = await (
    await createClient()
  ).rpc("update_knowledge_content_display_area", {
    p_content_item_id: request.data.contentItemId,
    p_display_area: request.data.displayArea,
  });
  if (error || !data) {
    throw new Error(
      `Content placement for ${request.data.contentItemId} could not be updated: ${
        error?.message ?? "No catalog row was returned."
      }`,
    );
  }

  revalidatePath("/content");
  revalidatePath("/training");
  revalidatePath("/training/library");
  return {
    contentItemId: data,
    displayArea: request.data.displayArea,
  };
}

export async function bulkUpdateContentGovernanceAction(
  contentItemIds: string[],
  field: string,
  value: string,
) {
  await requireTrainingReviewer("content.bulkUpdateGovernance");
  const request = z
    .object({
      contentItemIds: z.array(z.string().uuid()).min(1).max(200),
      field: bulkGovernanceFieldSchema,
      value: z.string().max(200),
    })
    .safeParse({ contentItemIds, field, value });
  if (!request.success) {
    throw new Error(
      `Content governance was not updated: ${firstIssue(request.error)}`,
    );
  }

  const uniqueIds = [...new Set(request.data.contentItemIds)];
  const normalizedValue =
    request.data.value === "__none__" ? "" : request.data.value.trim();

  if (
    request.data.field === "display_area" &&
    !displayAreaSchema.safeParse(normalizedValue).success
  ) {
    throw new Error(
      `Content governance was not updated: ${normalizedValue || "an empty value"} is not a valid display area.`,
    );
  }
  if (
    (request.data.field === "owner_user_id" ||
      request.data.field === "reviewer_user_id") &&
    normalizedValue &&
    !z.string().uuid().safeParse(normalizedValue).success
  ) {
    throw new Error(
      "Content governance was not updated: the selected person is invalid.",
    );
  }
  if (
    request.data.field === "next_review_at" &&
    normalizedValue &&
    !/^\d{4}-\d{2}-\d{2}$/u.test(normalizedValue)
  ) {
    throw new Error(
      "Content governance was not updated: use a valid review date.",
    );
  }

  const { data, error } = await (
    await createClient()
  ).rpc("bulk_update_knowledge_content_governance", {
    p_content_item_ids: uniqueIds,
    p_field: request.data.field,
    p_value: normalizedValue,
  });
  if (error) {
    throw new Error(`Content governance update failed: ${error.message}`);
  }
  if (!data || data.length !== uniqueIds.length) {
    throw new Error(
      `Content governance update returned ${data?.length ?? 0} of ${uniqueIds.length} expected catalog items.`,
    );
  }

  revalidatePath("/content");
  revalidatePath("/training");
  revalidatePath("/training/library");
  return { updatedCount: data.length };
}

export async function addCourseSectionAction(formData: FormData) {
  await requireTrainingReviewer("content.addCourseSection");
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const title = z.string().trim().min(2).max(160).parse(formData.get("title"));
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("learning_course_section")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  if (countError)
    throw new Error(`Course section count failed: ${countError.message}`);
  const { error } = await supabase.from("learning_course_section").insert({
    course_id: courseId,
    title,
    sort_order: count ?? 0,
  });
  if (error)
    throw new Error(`Course section creation failed: ${error.message}`);
  revalidatePath(`/content/courses/${courseId}`);
}

export async function addCourseItemAction(formData: FormData) {
  await requireTrainingReviewer("content.addCourseItem");
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const sectionId = z.string().uuid().parse(formData.get("sectionId"));
  const contentItemId = z.string().uuid().parse(formData.get("contentItemId"));
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("learning_course_item")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId);
  if (countError)
    throw new Error(`Course item count failed: ${countError.message}`);
  const { error } = await supabase.from("learning_course_item").insert({
    section_id: sectionId,
    content_item_id: contentItemId,
    sort_order: count ?? 0,
    required: true,
  });
  if (error) throw new Error(`Course item creation failed: ${error.message}`);
  revalidatePath(`/content/courses/${courseId}`);
}

export async function removeCourseItemAction(formData: FormData) {
  await requireTrainingReviewer("content.removeCourseItem");
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const itemId = z.string().uuid().parse(formData.get("itemId"));
  const { error } = await (await createClient())
    .from("learning_course_item")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(`Course item removal failed: ${error.message}`);
  revalidatePath(`/content/courses/${courseId}`);
}

export async function publishCourseAction(formData: FormData) {
  await requireTrainingReviewer("content.publishCourse");
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const { error } = await (
    await createClient()
  ).rpc("publish_learning_course", {
    p_course_id: courseId,
  });
  if (error) {
    redirect(
      `/content/courses/${courseId}?error=${encodeURIComponent(error.message)}`,
    );
  }
  revalidatePath(`/content/courses/${courseId}`);
  revalidatePath("/content");
  revalidatePath("/training");
  revalidatePath("/training/library");
  redirect(`/content/courses/${courseId}?published=1`);
}
