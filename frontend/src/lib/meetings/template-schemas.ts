import { z } from "zod";

/**
 * Request-body Zod schemas for company-level meeting templates
 * (admin/meeting-templates API). Pure validation only — no I/O.
 */

const ITEM_PRIORITY_VALUES = ["low", "medium", "high"] as const;

const templateItemSchema = z.object({
  title: z.string().min(1, "Item title is required."),
  description: z.string().optional(),
  priority: z.enum(ITEM_PRIORITY_VALUES).optional(),
});

const templateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required."),
  items: z.array(templateItemSchema).default([]),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required."),
  overview: z.string().optional(),
  is_private: z.boolean().optional(),
  categories: z.array(templateCategorySchema).default([]),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
