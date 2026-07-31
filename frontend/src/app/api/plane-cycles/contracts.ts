import { z } from "zod";

export const ProjectIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);

export const CycleIdSchema = z.string().uuid();

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function validDateRange(input: {
  start_date?: string | null;
  end_date?: string | null;
}) {
  const start = input.start_date ?? null;
  const end = input.end_date ?? null;
  return (
    (start === null && end === null) ||
    (start !== null && end !== null && start <= end)
  );
}

const CycleFieldsSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10_000).optional(),
  start_date: DateSchema.nullable().optional(),
  end_date: DateSchema.nullable().optional(),
  owned_by: z.string().uuid().nullable().optional(),
  timezone: z.string().trim().min(1).max(255).optional(),
  external_source: z.string().trim().min(1).max(255).nullable().optional(),
  external_id: z.string().trim().min(1).max(255).nullable().optional(),
});

export const CreateCycleSchema = CycleFieldsSchema.extend({
  project_id: ProjectIdSchema,
}).refine(validDateRange, {
  message: "Start and end dates must both be set, and start cannot exceed end.",
  path: ["start_date"],
});

export const UpdateCycleSchema = CycleFieldsSchema.partial()
  .extend({
    project_id: ProjectIdSchema,
    cycle_id: CycleIdSchema,
    archived_at: z.string().datetime().nullable().optional(),
    sort_order: z.number().finite().optional(),
  })
  .refine(
    (body) =>
      Object.keys(body).some(
        (key) => !["project_id", "cycle_id"].includes(key),
      ),
    { message: "At least one cycle field is required." },
  );

export const CycleQuerySchema = z.object({
  projectId: ProjectIdSchema,
  cycleId: CycleIdSchema.optional(),
  cycleView: z
    .enum(["all", "draft", "upcoming", "current", "completed", "archived"])
    .default("all"),
});

export const MembershipBodySchema = z.object({
  project_id: ProjectIdSchema,
  cycle_id: CycleIdSchema,
  task_ids: z.array(z.string().uuid()).min(1).max(500).transform((ids) => [
    ...new Set(ids),
  ]),
});

export const MembershipQuerySchema = z.object({
  projectId: ProjectIdSchema,
  cycleId: CycleIdSchema,
});

export function isValidCycleDateRange(
  startDate: string | null,
  endDate: string | null,
) {
  return validDateRange({ start_date: startDate, end_date: endDate });
}
