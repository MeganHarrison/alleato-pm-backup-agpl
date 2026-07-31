import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createSubmittalAIReviewService } from "@/lib/submittals/ai-review/review-run-service";
import { getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "projects/[projectId]/submittals/[submittalId]/ai-review";

const postBodySchema = z.object({
  focusArea: z.string().trim().min(1).nullable().optional(),
});

async function requireUser() {
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "UNAUTHORIZED",
      where: WHERE,
      message: "You must be signed in to review a submittal.",
    });
  }

  return user;
}

export const GET = withApiGuardrails<{
  projectId: string;
  submittalId: string;
}>(`${WHERE}#GET`, async ({ params }) => {
  const { projectId, submittalId } = await params;
  const user = await requireUser();
  const reviewService = createSubmittalAIReviewService(user.id);
  const projectIdNumber = reviewService.parseProjectId(projectId);
  const result = await reviewService.getLatestReview(
    projectIdNumber,
    submittalId,
  );
  return Response.json(result);
});

export const POST = withApiGuardrails<{
  projectId: string;
  submittalId: string;
}>(`${WHERE}#POST`, async ({ request, params }) => {
  const { projectId, submittalId } = await params;
  const user = await requireUser();
  const reviewService = createSubmittalAIReviewService(user.id);
  const projectIdNumber = reviewService.parseProjectId(projectId);
  const body = await parseJsonBody(request, postBodySchema, `${WHERE}#POST`);
  const result = await reviewService.runReview(
    projectIdNumber,
    submittalId,
    body.focusArea ?? undefined,
  );
  return Response.json(result);
});
