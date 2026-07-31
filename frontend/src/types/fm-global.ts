import type { z } from "zod";

import type { AsrsEstimatorResponse } from "@/lib/fmds/asrs-estimator";
import type { fmGlobalSpecInputSchema } from "@/lib/schemas/fm-global-schemas";

/** Project and storage context retained with the public FM Global submission. */
export type FmGlobalSpecInput = z.infer<typeof fmGlobalSpecInputSchema>;

/** Stored submission summary for the FM Global form. */
export interface FmGlobalSubmissionSummary {
  id: string;
  created_at: string | null;
  user_input: FmGlobalSpecInput | null;
  matched_table_ids: string[] | null;
  selected_configuration: Record<string, unknown> | null;
}

/** Result returned after evaluation and atomic submission persistence. */
export interface FmGlobalSubmissionResponse {
  submissionId: string;
  evaluation: AsrsEstimatorResponse;
}
