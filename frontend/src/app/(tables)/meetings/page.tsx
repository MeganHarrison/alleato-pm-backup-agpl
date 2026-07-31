import { createClient } from "@/lib/supabase/server";
import { createRagServiceClient } from "@/lib/supabase/service";
import { MeetingsTablePage } from "@/features/meetings/meetings-table-page";
import { meetingsSchema } from "@/lib/validation/meetings";
import { TablePageWrapper } from "@/components/tables/table-page-wrapper";

const PAGE_TITLE = "Meetings";
const PAGE_DESCRIPTION = "View and manage all your meetings";

export default async function MeetingsPage() {
  const supabase = await createClient();

  const { data: meetings, error } = await supabase
    .from("document_metadata")
    .select("id,title,date,project,project_id,description,type,category,status,source,fireflies_link,url,participants,participants_array,notes,summary,overview,action_items,bullet_points,keywords,sentiment,duration_minutes,audio,video,created_at")
    .eq("type", "meeting")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (error) {
    console.error("[MeetingsPage] Supabase query error:", error.message);
    return (
      <TablePageWrapper title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <div className="text-center text-destructive p-6">
          Error loading meetings. Please try again later.
        </div>
      </TablePageWrapper>
    );
  }

  const parsed = meetingsSchema.safeParse(meetings ?? []);
  if (!parsed.success) {
    console.error("[MeetingsPage] Zod parse error:", parsed.error.issues.slice(0, 3));
    return (
      <TablePageWrapper title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <div className="text-center text-destructive p-6">
          Error loading meetings. Please try again later.
        </div>
      </TablePageWrapper>
    );
  }

  const meetingIds = parsed.data.map((meeting) => meeting.id);
  let embeddingRows: Array<{
    app_document_id: string;
    embedding_status: string | null;
  }> = [];
  let embeddingError: { message: string } | null = null;

  if (meetingIds.length) {
    try {
      const ragSupabase = createRagServiceClient();
      const result = await ragSupabase
        .from("rag_document_metadata")
        .select("app_document_id,embedding_status")
        .in("app_document_id", meetingIds);
      embeddingRows = result.data ?? [];
      embeddingError = result.error;
    } catch (error) {
      embeddingError = {
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (embeddingError) {
    console.error(
      "[MeetingsPage] RAG embedding status query error:",
      embeddingError.message,
    );
  }

  const embeddingStatusByMeetingId = new Map(
    (embeddingRows ?? []).map((row) => [row.app_document_id, row.embedding_status]),
  );

  const meetingsWithEmbeddingStatus = parsed.data.map((meeting) => ({
    ...meeting,
    embedding_status: embeddingError
      ? "unavailable"
      : embeddingStatusByMeetingId.get(meeting.id) ?? null,
  }));

  return <MeetingsTablePage initialMeetings={meetingsWithEmbeddingStatus} />;
}
