import { z } from "zod";

const asrsTypes = [
  "Shuttle",
  "Mini-Load",
  "Top-Loading",
  "Vertically-Enclosed",
  "All",
] as const;

const systemTypes = ["wet", "dry", "preaction", "both"] as const;

/** Project and storage context captured by the public intake form. */
export const fmGlobalSpecInputSchema = z.object({
  asrs_type: z.enum(asrsTypes),
  system_type: z.enum(systemTypes),
  ceiling_height_ft: z.number().min(1),
  commodity_class: z.string().min(1).optional(),
  k_factor: z.number().min(0).optional(),
  tolerance_ft: z.number().min(0).default(5),
  container_type: z.string().min(1).optional(),
  storage_height_ft: z.number().min(0).optional(),
  rack_row_depth_ft: z.number().min(0).optional(),
  building_heated: z.boolean().optional(),
});
