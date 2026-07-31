import { z } from "zod";

export const DOCS_TRAINING_EVENT_VERSION = 1 as const;
export const DOCS_TRAINING_EVENT_NAME = "training.video.progress" as const;
export const DOCS_TRAINING_AUDIENCE = "docs.alleatogroup.com" as const;
export const DOCS_TRAINING_ISSUER = "projects.alleatogroup.com" as const;
export const DOCS_TRAINING_ASSERTION_TTL_SECONDS = 30 * 60;

export const DOCS_TRAINING_ORIGINS = new Set(["https://docs.alleatogroup.com"]);

export const DocsTrainingSourceIdSchema = z
  .string()
  .min(3)
  .max(200)
  .regex(
    /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*$/,
    "sourceId must be a canonical lowercase docs path without a leading slash.",
  );

export const DocsTrainingProgressSchema = z
  .object({
    schemaVersion: z.literal(DOCS_TRAINING_EVENT_VERSION),
    event: z.literal(DOCS_TRAINING_EVENT_NAME),
    sourceId: DocsTrainingSourceIdSchema,
    checkpoint: z.union([
      z.literal(0),
      z.literal(25),
      z.literal(50),
      z.literal(75),
      z.literal(90),
    ]),
    positionSeconds: z.number().finite().min(0).max(86_400),
    watchedSeconds: z.number().finite().min(0).max(120),
  })
  .strict();

export type DocsTrainingProgressEvent = z.infer<
  typeof DocsTrainingProgressSchema
>;

export function isAllowedDocsTrainingOrigin(origin: string | null): origin is string {
  return origin !== null && DOCS_TRAINING_ORIGINS.has(origin);
}
