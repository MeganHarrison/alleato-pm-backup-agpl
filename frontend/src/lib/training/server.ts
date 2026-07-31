import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createTrainingDataAccess } from "./data-access";
import { requireTrainingReviewer } from "./reviewer-access";
import { resolveViewerRole } from "./role-resolution";
import type {
  TrainingFreshnessReviewInput,
  TrainingResourceFilters,
  TrainingResourceReviewInput,
} from "./types";

export { resolveViewerRole };
export type {
  TrainingResource,
  TrainingFreshnessDecision,
  TrainingFreshnessOutcome,
  TrainingFreshnessReviewItem,
  TrainingResourceFilters,
  TrainingResourceLevel,
  TrainingResourceStatus,
  TrainingResourceType,
  TrainingReviewDecision,
  TrainingRole,
  TrainingTopic,
} from "./types";

async function getAccess() {
  return createTrainingDataAccess(
    await createClient(),
    requireTrainingReviewer,
  );
}

export async function getResources(filters: TrainingResourceFilters = {}) {
  return (await getAccess()).getResources(filters);
}

export async function getRoles() {
  return (await getAccess()).getRoles();
}

export async function getTopics() {
  return (await getAccess()).getTopics();
}

export async function getPendingFreshnessReviews() {
  return (await getAccess()).getPendingFreshnessReviews();
}

export async function getDiscoveryMetrics() {
  return (await getAccess()).getDiscoveryMetrics();
}

export async function reviewResource(input: TrainingResourceReviewInput) {
  return (await getAccess()).reviewResource(input);
}

export async function reviewFreshnessCheck(
  input: TrainingFreshnessReviewInput,
) {
  return (await getAccess()).reviewFreshnessCheck(input);
}
