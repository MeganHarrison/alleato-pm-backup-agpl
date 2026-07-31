"use server";

import { revalidatePath } from "next/cache";

import {
  asrsEstimatorRequestSchema,
  getAsrsEvaluationStatus,
  PUBLIC_FMDS_EVALUATOR_KEY,
  type AsrsEstimatorRequest,
  type AsrsEstimatorResponse,
} from "@/lib/fmds/asrs-estimator";
import { evaluateAsrsConfiguration } from "@/lib/fmds/asrs-estimator.server";
import { fmGlobalSpecInputSchema } from "@/lib/schemas/fm-global-schemas";
import { createAsrsServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";
import type {
  FmGlobalSpecInput,
  FmGlobalSubmissionResponse,
} from "@/types/fm-global";

/** Public contact and project context captured with an anonymous submission. */
export interface FmPublicSubmissionMetadata {
  contact_name: string;
  contact_email: string;
  project_name: string;
  project_location?: string;
}

function normalizeMetadata(
  metadata: FmPublicSubmissionMetadata | undefined,
): FmPublicSubmissionMetadata | undefined {
  if (!metadata) return undefined;
  const contact_name = metadata.contact_name.trim();
  const contact_email = metadata.contact_email.trim();
  const project_name = metadata.project_name.trim();
  const project_location = metadata.project_location?.trim();
  if (!contact_name || !contact_email || !project_name) {
    throw new Error("Name, email, and project name are required.");
  }
  return {
    contact_name,
    contact_email,
    project_name,
    project_location: project_location || undefined,
  };
}

async function persistSubmission(
  input: FmGlobalSpecInput,
  evaluatorInput: AsrsEstimatorRequest,
  evaluation: AsrsEstimatorResponse,
  metadata?: FmPublicSubmissionMetadata,
): Promise<string> {
  const supabase = createAsrsServiceClient();
  const contactInfo = metadata
    ? { name: metadata.contact_name, email: metadata.contact_email }
    : null;
  const projectDetails = metadata
    ? {
        project_name: metadata.project_name,
        project_location: metadata.project_location ?? null,
      }
    : null;

  const { data, error } = await supabase
    .from("fm_form_submissions")
    .insert({
      user_input: input as unknown as Json,
      parsed_requirements: evaluation as unknown as Json,
      contact_info: contactInfo as unknown as Json,
      project_details: projectDetails as unknown as Json,
      corpus_revision_id: evaluation.corpus.revisionId,
      evaluator_key: PUBLIC_FMDS_EVALUATOR_KEY,
      evaluator_inputs: evaluatorInput as unknown as Json,
      evaluation_result: evaluation as unknown as Json,
      evaluation_status: getAsrsEvaluationStatus(evaluation),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`FM Global submission could not be saved: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error(
      "FM Global submission could not be saved: the ASRS database returned no submission ID.",
    );
  }
  return data.id;
}

/**
 * Evaluate a public FM Global submission through the canonical 2026 Batch 1
 * owner and persist the exact request/result trace. There is intentionally no
 * legacy lookup fallback.
 */
export async function submitFmGlobalSpecs(
  rawInput: FmGlobalSpecInput,
  rawEvaluatorInput: AsrsEstimatorRequest,
  rawMetadata?: FmPublicSubmissionMetadata,
): Promise<FmGlobalSubmissionResponse> {
  const input = fmGlobalSpecInputSchema.parse(rawInput);
  const parsedEvaluatorInput = asrsEstimatorRequestSchema.safeParse(rawEvaluatorInput);
  if (!parsedEvaluatorInput.success) {
    throw new Error(
      `Sprinkler specification needs correction: ${parsedEvaluatorInput.error.issues[0]?.message ?? "Check the entered values."}`,
    );
  }
  const evaluatorInput = parsedEvaluatorInput.data;
  const metadata = normalizeMetadata(rawMetadata);
  const evaluation = await evaluateAsrsConfiguration(evaluatorInput);
  const submissionId = await persistSubmission(
    input,
    evaluatorInput,
    evaluation,
    metadata,
  );

  revalidatePath("/fm-global/form");
  revalidatePath(`/fm-global/form/submitted/${submissionId}`);

  return { submissionId, evaluation };
}
