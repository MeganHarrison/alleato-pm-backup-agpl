import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createSubmittalAIReviewService } from "@/lib/submittals/ai-review/review-run-service";
import { submittalReviewDispositionSchema } from "@/lib/submittals/ai-review/schemas";
import { getApiRouteUser } from "@/lib/supabase/server";

const WHERE =
  "projects/[projectId]/submittals/[submittalId]/ai-review/checks/[checkId]";

const patchBodySchema = z.object({
  reviewerDisposition: submittalReviewDispositionSchema,
  reviewerNotes: z.string().trim().max(2000).nullable().optional(),
});

async function requireUser() {
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "UNAUTHORIZED",
      where: WHERE,
      message: "You must be signed in to update an AI review finding.",
    });
  }

  return user;
}

export const PATCH = withApiGuardrails<{
  projectId: string;
  submittalId: string;
  checkId: string;
}>(`${WHERE}#PATCH`, async ({ request, params }) => {
  const { projectId, submittalId, checkId } = await params;
  const user = await requireUser();
  const reviewService = createSubmittalAIReviewService(user.id);
  const projectIdNumber = reviewService.parseProjectId(projectId);
  const body = await parseJsonBody(request, patchBodySchema, `${WHERE}#PATCH`);

  const result = await reviewService.updateCheckDisposition(
    projectIdNumber,
    submittalId,
    checkId,
    body.reviewerDisposition,
    body.reviewerNotes ?? null,
  );

  return Response.json(result);
});
