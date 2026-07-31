import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export interface RequiredSubmittalItem {
  drawingId: string;
  drawingNumber: string;
  drawingTitle: string;
  discipline: string | null;
  impliedSubmittal: string;
  /** null = no existing submittal found for this item */
  existingSubmittal: {
    id: string;
    number: string;
    title: string;
    status: string | null;
  } | null;
}

export interface RequiredSubmittalsResponse {
  items: RequiredSubmittalItem[];
  summary: {
    totalImplied: number;
    covered: number;
    missing: number;
  };
}

/**
 * GET /api/projects/[projectId]/submittals/required
 *
 * Scans document_page_intelligence for all drawings in this project,
 * aggregates implied_submittals from Vision AI analysis, and cross-references
 * against existing submittals to show what's covered vs. missing.
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/submittals/required#GET",
  async ({ params }) => {
    const { projectId } = params;
    const pid = parseInt(projectId, 10);
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "projects/[projectId]/submittals/required#GET",
        message: "Not authenticated",
      });
    }

    // 1. Get all drawings for this project that have vision-processed pages
    const { data: drawings } = await supabase
      .from("drawings")
      .select("id, drawing_number, title, discipline, document_metadata_id")
      .eq("project_id", pid)
      .is("deleted_at", null)
      .is("is_obsolete", false)
      .not("document_metadata_id", "is", null);

    if (!drawings || drawings.length === 0) {
      return Response.json({
        items: [],
        summary: { totalImplied: 0, covered: 0, missing: 0 },
      } satisfies RequiredSubmittalsResponse);
    }

    const metadataIds = drawings.map((d) => d.document_metadata_id!);

    // 2. Pull implied_submittals from vision analysis pages
    const { data: pages } = await supabase
      .from("document_page_intelligence")
      .select("document_metadata_id, implied_submittals")
      .in("document_metadata_id", metadataIds)
      .not("implied_submittals", "is", null);

    // 3. Aggregate: map document_metadata_id → list of implied submittal strings
    const impliedByMetadataId = new Map<string, string[]>();
    for (const page of pages ?? []) {
      if (!page.implied_submittals?.length) continue;
      const existing = impliedByMetadataId.get(page.document_metadata_id) ?? [];
      for (const s of page.implied_submittals) {
        if (!existing.includes(s)) existing.push(s);
      }
      impliedByMetadataId.set(page.document_metadata_id, existing);
    }

    // Build lookup: metadataId → drawing
    const drawingByMetadataId = new Map(
      drawings.map((d) => [d.document_metadata_id!, d]),
    );

    // 4. Get all existing submittals for this project (title lookup for fuzzy match)
    const { data: existingSubmittals } = await supabase
      .from("submittals")
      .select("id, submittal_number, title, status")
      .eq("project_id", pid)
      .is("deleted_at", null);

    const submittalList = existingSubmittals ?? [];

    // 5. Build result items — one per (drawing, implied submittal) pair
    const items: RequiredSubmittalItem[] = [];

    for (const [metadataId, implied] of impliedByMetadataId) {
      const drawing = drawingByMetadataId.get(metadataId);
      if (!drawing) continue;

      for (const impliedTitle of implied) {
        // Fuzzy match: find an existing submittal whose title contains key words
        const words = impliedTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const match = submittalList.find((s) => {
          const t = (s.title ?? "").toLowerCase();
          return words.length > 0 && words.filter((w) => t.includes(w)).length >= Math.ceil(words.length * 0.5);
        }) ?? null;

        items.push({
          drawingId: drawing.id,
          drawingNumber: drawing.drawing_number ?? "",
          drawingTitle: drawing.title ?? "",
          discipline: drawing.discipline,
          impliedSubmittal: impliedTitle,
          existingSubmittal: match
            ? {
                id: match.id,
                number: match.submittal_number ?? "",
                title: match.title ?? "",
                status: match.status,
              }
            : null,
        });
      }
    }

    // Sort: missing first, then by drawing number
    items.sort((a, b) => {
      if (!a.existingSubmittal && b.existingSubmittal) return -1;
      if (a.existingSubmittal && !b.existingSubmittal) return 1;
      return (a.drawingNumber ?? "").localeCompare(b.drawingNumber ?? "");
    });

    const covered = items.filter((i) => i.existingSubmittal).length;

    return Response.json({
      items,
      summary: {
        totalImplied: items.length,
        covered,
        missing: items.length - covered,
      },
    } satisfies RequiredSubmittalsResponse);
  },
);
