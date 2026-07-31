import { PageShell } from "@/components/layout";
import { ProjectDocumentPreviewClient } from "@/features/documents/project-document-preview-client";

export const metadata = {
  title: "Document preview",
};

export default async function ProjectDocumentPreviewPage({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) {
  const { projectId, documentId } = await params;

  return (
    <PageShell variant="content" title="Document preview" showHeader={false}>
      <ProjectDocumentPreviewClient
        projectId={projectId}
        documentId={documentId}
      />
    </PageShell>
  );
}
