import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createSubmittalAIReviewService } from "@/lib/submittals/ai-review/review-run-service";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const ROUTE_BASE =
  "projects/[projectId]/submittals/[submittalId]/linked-drawings/[drawingId]";

/**
 * DELETE /api/projects/[projectId]/submittals/[submittalId]/linked-drawings/[drawingId]
 * Removes the link between a drawing and a submittal.
 * Uses drawing_id (not the link row id) so callers don't need to track
 * the junction-table row id — just the drawing they want to unlink.
 */
export const DELETE = withApiGuardrails<{
  projectId: string;
  submittalId: string;
  drawingId: string;
}>(`${ROUTE_BASE}#DELETE`, async ({ params }) => {
  const { projectId, submittalId, drawingId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "UNAUTHORIZED",
      where: `${ROUTE_BASE}#DELETE`,
      message: "Not authenticated",
    });
  }

  const reviewService = createSubmittalAIReviewService(user.id);
  const projectIdNumber = reviewService.parseProjectId(projectId);
  await reviewService.getScopedSubmittal(projectIdNumber, submittalId);
  await reviewService.getDrawingByScope(projectIdNumber, drawingId);

  const { error } = await supabase
    .from("submittal_linked_drawings")
    .delete()
    .eq("submittal_id", submittalId)
    .eq("drawing_id", drawingId);

  if (error) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: `${ROUTE_BASE}#DELETE`,
      message: error.message,
    });
  }

  return Response.json({ success: true });
});
