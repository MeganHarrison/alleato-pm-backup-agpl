export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout";
import {
  SourceDocumentDetailPage,
  loadSourceDocumentDetail,
} from "@/features/documents/source-document-detail";

type PageProps = {
  params: Promise<{ projectId: string; sourceDocumentId: string }>;
};

export default async function IntelligenceSourcePage({ params }: PageProps) {
  const { projectId, sourceDocumentId } = await params;
  const numericProjectId = Number.parseInt(projectId, 10);

  if (Number.isNaN(numericProjectId)) {
    notFound();
  }

  const record = await loadSourceDocumentDetail({
    sourceDocumentId,
    projectId: numericProjectId,
  });

  if (!record) {
    notFound();
  }

  return (
    <PageShell variant="content" title="Intelligence source" showHeader={false}>
      <SourceDocumentDetailPage
        record={record}
        backHref={`/${numericProjectId}/intelligence`}
        backLabel="Intelligence"
        description={
          record.source.type === "email" || record.source.category === "email"
            ? "Full email source content used by the project intelligence packet."
            : "Original source context used by the project intelligence packet."
        }
      />
    </PageShell>
  );
}
