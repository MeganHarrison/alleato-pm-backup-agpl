import { z } from "zod";

import { GuardrailError } from "@/lib/guardrails/errors";
import type { TrainingAdminTableKey } from "./types";

const uuid = z.string().uuid();
const nullableText = z.string().trim().nullable().optional();
const jsonObject = z.record(z.string(), z.unknown()).default({});
const slug = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/);
const httpUrl = z.string().url().refine(
  (value) => value.startsWith("http://") || value.startsWith("https://"),
  "URL must use http or https.",
);
const nullableHttpUrl = z
  .union([httpUrl, z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);

const schemas = {
  training_resource: z.object({
    topic_id: uuid,
    title: z.string().trim().min(1),
    description: nullableText,
    url: httpUrl,
    embed_url: nullableHttpUrl,
    thumbnail_url: nullableHttpUrl,
    provider: nullableText,
    resource_type: z.enum(["video", "course", "doc"]),
    level: z.enum(["intro", "deep-dive"]),
    track: slug,
    status: z.enum(["review", "published", "archived"]),
    duration_minutes: z.number().int().positive().nullable().optional(),
    source_attribution: nullableText,
    metadata: jsonObject,
  }),
  training_role: z.object({
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: nullableText,
    aliases: z.array(z.string().trim().min(1)).default([]),
    sort_order: z.number().int().min(0),
    active: z.boolean(),
  }),
  training_topic: z.object({
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: nullableText,
    sort_order: z.number().int().min(0),
    active: z.boolean(),
  }),
  training_resource_role: z.object({
    resource_id: uuid,
    role_id: uuid,
  }),
  training_role_skill: z
    .object({
      role_id: uuid.nullable().optional(),
      is_core: z.boolean(),
      name: z.string().trim().min(1).max(120),
      slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      description: z.string().trim().min(1).max(500),
      importance: z.number().int().min(1).max(5),
      sort_order: z.number().int().min(0),
      active: z.boolean(),
    })
    .superRefine((value, context) => {
      if (value.is_core && value.role_id) {
        context.addIssue({
          code: "custom",
          path: ["role_id"],
          message: "Alleato Core skills cannot belong to a role.",
        });
      }
      if (!value.is_core && !value.role_id) {
        context.addIssue({
          code: "custom",
          path: ["role_id"],
          message: "Role-specific skills require a role.",
        });
      }
    }),
  training_skill_checkin: z.object({
    user_id: uuid,
    role_id: uuid.nullable().optional(),
    role_name: z.string().trim().min(1).max(120),
    checkin_date: z.iso.date(),
    scores: z.array(z.unknown()).min(1).max(20),
    quarter_label: nullableText,
    feedback_person: nullableText,
    feedback_frequency: nullableText,
    rescore_days: z.union([z.literal(30), z.literal(60), z.literal(90)]),
    next_checkin_date: z.iso.date(),
    make_time_by: nullableText,
    skill_plans: z.array(z.unknown()).min(1).max(20),
  }),
  training_docs: z.object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    summary: nullableText,
    body_markdown: z.string(),
    audience: z.enum(["internal", "client", "subcontractor", "admin"]),
    status: z.enum([
      "planned",
      "draft",
      "in_review",
      "approved",
      "published",
      "archived",
    ]),
    source_route: nullableText,
    tool_category: nullableText,
    tool_module: nullableText,
    task_key: nullableText,
    qa_status: z.enum([
      "not_tested",
      "passing",
      "failing",
      "needs_update",
    ]),
    qa_notes: nullableText,
    review_notes: nullableText,
    target_collection: z.string().trim().min(1),
    metadata: jsonObject,
  }),
  training_doc_assets: z.object({
    training_doc_id: uuid,
    file_name: z.string().trim().min(1),
    mime_type: z.string().trim().min(1),
    asset_type: z.enum(["screenshot", "image", "video"]),
    storage_bucket: z.string().trim().min(1),
    storage_path: z.string().trim().min(1),
    caption: nullableText,
    alt_text: nullableText,
    step_order: z.number().int().min(0),
    metadata: jsonObject,
  }),
  training_doc_steps: z.object({
    training_doc_id: uuid,
    title: z.string().trim().min(1),
    instruction_markdown: z.string(),
    expected_result: nullableText,
    source_url: nullableHttpUrl,
    screenshot_asset_id: uuid.nullable().optional(),
    step_order: z.number().int().min(0),
    action_metadata: jsonObject,
  }),
  training_doc_relations: z
    .object({
      source_doc_id: uuid,
      target_doc_id: uuid,
      relation_type: z.enum(["related", "prerequisite", "next"]),
      sort_order: z.number().int().min(0),
    })
    .refine((value) => value.source_doc_id !== value.target_doc_id, {
      path: ["target_doc_id"],
      message: "A training doc cannot relate to itself.",
    }),
} satisfies Record<TrainingAdminTableKey, z.ZodType>;

export function parseTrainingAdminPayload(
  tableKey: TrainingAdminTableKey,
  payload: unknown,
  _mode: "create" | "update",
) {
  const result = schemas[tableKey].safeParse(payload);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path.join(".");
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: `training-data/${tableKey}#payload`,
      status: 400,
      message: `${field ? `${field}: ` : ""}${first?.message ?? "Invalid payload."}`,
    });
  }
  return result.data as Record<string, unknown>;
}
