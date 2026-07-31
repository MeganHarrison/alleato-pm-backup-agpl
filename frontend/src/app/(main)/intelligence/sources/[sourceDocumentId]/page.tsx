export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout";
import {
  SourceDocumentDetailPage,
  loadSourceDocumentDetail,
} from "@/features/documents/source-document-detail";

type PageProps = {
  params: Promise<{ sourceDocumentId: string }>;
};

/**
 * Global (project-agnostic) intelligence source detail — the in-app home for a
 * source that a brief cites when the source has no resolved project (e.g. an
 * unassigned email or Teams thread). Mirrors the project-scoped
 * `/[projectId]/intelligence/sources/[sourceDocumentId]` route but loads the
 * record by `document_metadata.id` alone (the loader treats `projectId` as an
 * optional filter). This is what lets a Daily Brief email/Teams/document
 * citation link to the source *in the app* instead of the raw Outlook/file URL.
 */
export default async function GlobalIntelligenceSourcePage({ params }: PageProps) {
  const { sourceDocumentId } = await params;

  const record = await loadSourceDocumentDetail({ sourceDocumentId });

  if (!record) {
    notFound();
  }

  return (
    <PageShell variant="content" title="Intelligence source" showHeader={false}>
      <SourceDocumentDetailPage
        record={record}
        backHref="/daily-brief"
        backLabel="Daily brief"
        description={
          record.source.type === "email" || record.source.category === "email"
            ? "Full email source content used by the executive brief."
            : "Original source context used by the executive brief."
        }
      />
    </PageShell>
  );
}
