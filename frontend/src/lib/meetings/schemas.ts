import { z } from "zod";

/**
 * Request-body Zod schemas for the Procore-style Meetings tool.
 * Pure validation only — no I/O, no Supabase imports.
 */

const ITEM_STATUS_VALUES = ["open", "in_progress", "closed"] as const;
const ITEM_PRIORITY_VALUES = ["low", "medium", "high"] as const;

// Shared date/time validators
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD format");

const timeString = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    "Expected HH:MM or HH:MM:SS (24h format)"
  );

export const createMeetingSchema = z.object({
  name: z.string().min(1, "Meeting name is required."),
  series_name: z.string().min(1).optional(),
  meeting_date: dateString.optional(),
  timezone: z.string().optional(),
  start_time: timeString.optional(),
  end_time: timeString.optional(),
  location: z.string().optional(),
  meeting_link: z.string().optional(),
  is_private: z.boolean().optional(),
  is_draft: z.boolean().optional(),
  overview: z.string().optional(),
  attendee_person_ids: z.array(z.string().uuid()).optional(),
  template_id: z.string().uuid().optional(),
  // When set, carry the source meeting's open/in-progress agenda items and its
  // attendees forward into the new meeting (recurring-meeting behavior). The
  // source must belong to the same project or the carry step is skipped.
  carry_from_meeting_id: z.string().uuid().optional(),
});
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const updateMeetingSchema = createMeetingSchema.partial();
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required."),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const reorderSchema = z.object({
  ordered_ids: z.array(z.string().uuid()),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

export const createItemSchema = z.object({
  category_id: z.string().uuid(),
  title: z.string().min(1, "Title is required."),
  description: z.string().optional(),
  assignee_person_id: z.string().uuid().optional(),
  due_date: dateString.optional(),
  status: z.enum(ITEM_STATUS_VALUES).optional(),
  priority: z.enum(ITEM_PRIORITY_VALUES).optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

const updateItemBaseSchema = z.object({
  category_id: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required.").optional(),
  description: z.string().optional(),
  official_minutes: z.string().optional(),
  assignee_person_id: z.string().uuid().nullable().optional(),
  due_date: dateString.nullable().optional(),
  status: z.enum(ITEM_STATUS_VALUES).optional(),
  priority: z.enum(ITEM_PRIORITY_VALUES).nullable().optional(),
});

export const updateItemSchema = updateItemBaseSchema.refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided." },
);
export type UpdateItemInput = z.infer<typeof updateItemBaseSchema>;

export const createItemTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignee_person_id: z.string().uuid().nullable().optional(),
  due_date: dateString.nullable().optional(),
});
export type CreateItemTaskInput = z.infer<typeof createItemTaskSchema>;
