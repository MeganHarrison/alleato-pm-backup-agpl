import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createSubmittalAIReviewService } from "@/lib/submittals/ai-review/review-run-service";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { z } from "zod";

const ROUTE_BASE =
  "projects/[projectId]/submittals/[submittalId]/linked-drawings";

/**
 * GET /api/projects/[projectId]/submittals/[submittalId]/linked-drawings
 * Returns all drawings linked to this submittal, enriched with drawing metadata
 * and a flag indicating whether the drawing has been vectorized into the RAG store.
 */
export const GET = withApiGuardrails<{
  projectId: string;
  submittalId: string;
}>(`${ROUTE_BASE}#GET`, async ({ params }) => {
  const { projectId, submittalId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "UNAUTHORIZED",
      where: `${ROUTE_BASE}#GET`,
      message: "Not authenticated",
    });
  }

  const reviewService = createSubmittalAIReviewService(user.id);
  const linkedDrawings = await reviewService.listLinkedDrawings(
    reviewService.parseProjectId(projectId),
    submittalId,
  );

  return Response.json({ linkedDrawings });
});

const PostBody = z.object({ drawingId: z.string().uuid() });

/**
 * POST /api/projects/[projectId]/submittals/[submittalId]/linked-drawings
 * Body: { drawingId: string (UUID) }
 * Links a drawing to the submittal. Returns { alreadyLinked: true } if the
 * drawing is already linked (idempotent — not an error).
 */
export const POST = withApiGuardrails<{
  projectId: string;
  submittalId: string;
}>(`${ROUTE_BASE}#POST`, async ({ request, params }) => {
  const { projectId, submittalId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "UNAUTHORIZED",
      where: `${ROUTE_BASE}#POST`,
      message: "Not authenticated",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new GuardrailError({
      code: "BAD_REQUEST",
      where: `${ROUTE_BASE}#POST`,
      message: "Request body must be valid JSON.",
    });
  }

  let parsed: z.infer<typeof PostBody>;
  try {
    parsed = PostBody.parse(body);
  } catch {
    throw new GuardrailError({
      code: "BAD_REQUEST",
      where: `${ROUTE_BASE}#POST`,
      message: "Body must be { drawingId: string (UUID) }.",
    });
  }

  const reviewService = createSubmittalAIReviewService(user.id);
  const projectIdNumber = reviewService.parseProjectId(projectId);
  await reviewService.getScopedSubmittal(projectIdNumber, submittalId);
  await reviewService.getDrawingByScope(projectIdNumber, parsed.drawingId);

  const { data, error } = await supabase
    .from("submittal_linked_drawings")
    .insert({ submittal_id: submittalId, drawing_id: parsed.drawingId })
    .select(
      `
        id,
        submittal_id,
        drawing_id,
        drawings!submittal_linked_drawings_drawing_id_fkey (
          drawing_number,
          title,
          discipline
        )
      `,
    )
    .single();

  if (error) {
    // Postgres unique violation code — drawing is already linked
    if (error.code === "23505") {
      return Response.json({ alreadyLinked: true }, { status: 200 });
    }
    throw new GuardrailError({
      code: "DB_ERROR",
      where: `${ROUTE_BASE}#POST`,
      message: error.message,
    });
  }

  const d = data.drawings as {
    drawing_number: string;
    title: string;
    discipline: string | null;
  } | null;

  return Response.json(
    {
      linkedDrawing: {
        id: data.id,
        submittalId: data.submittal_id,
        drawingId: data.drawing_id,
        drawingNumber: d?.drawing_number ?? "",
        title: d?.title ?? "",
        discipline: d?.discipline ?? null,
        revision: null,
        readiness: {
          state: "not_ready",
          reasons: ["Refresh linked drawings to load current readiness."],
          ocrTextReady: false,
          visionReady: false,
          embeddedReady: false,
        },
      },
    },
    { status: 201 },
  );
});
