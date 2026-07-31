import { z } from "zod";

export const procurementLifecycleStatuses = [
  "unverified",
  "awaiting_submittal",
  "in_review",
  "approved_to_release",
  "released",
  "vendor_confirmed",
  "fabricating",
  "shipped",
  "partially_received",
  "received",
  "cancelled",
] as const;

export type ProcurementLifecycleStatus = (typeof procurementLifecycleStatuses)[number];

export const procurementItemInputSchema = z.object({
  title: z.string().trim().min(1, "A procurement item title is required.").max(500),
  description: z.string().trim().max(10_000).nullable().optional(),
  lifecycle_status: z.enum(procurementLifecycleStatuses).default("awaiting_submittal"),
  responsible_user_id: z.string().uuid().nullable().optional(),
});

export const procurementItemIdSchema = z.string().uuid();

export function procurementRpcErrorStatus(error: { code?: string } | null): number {
  if (error?.code === "42501") return 403;
  if (error?.code === "P0002") return 404;
  if (error?.code === "22023") return 422;
  return 400;
}
