export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import {
  SourceDocumentDetailPage,
  loadSourceDocumentDetail,
} from "@/features/documents/source-document-detail";
import { TeamsConversationReviewActions } from "@/features/documents/teams-conversation-review-actions";

type PageProps = {
  params: Promise<{ sourceDocumentId: string }>;
};

export default async function TeamsConversationDetailPage({ params }: PageProps) {
  const { sourceDocumentId } = await params;

  const record = await loadSourceDocumentDetail({
    sourceDocumentId,
    requiredType: "teams_dm_conversation",
  });

  if (!record) {
    notFound();
  }

  const projectSourceHref =
    typeof record.source.project_id === "number"
      ? `/${record.source.project_id}/intelligence/sources/${encodeURIComponent(record.source.id)}`
      : null;

  return (
    <SourceDocumentDetailPage
      record={record}
      backHref="/teams-conversations"
      backLabel="Teams Conversations"
      description="Compiled Microsoft Teams conversation thread detail for review, attribution, and downstream intelligence workflows."
      projectSourceHref={projectSourceHref}
      reviewActions={
        <TeamsConversationReviewActions
          sourceDocumentId={record.source.id}
          sourceTitle={record.source.title ?? "Untitled conversation"}
          sourceSummary={record.source.overview ?? record.source.summary}
          projectId={record.source.project_id}
          projectName={record.source.project ?? null}
          relatedTaskCount={record.relatedTaskCount}
        />
      }
    />
  );
}
