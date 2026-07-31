/* eslint-disable design-system/require-page-shell -- Layout provided by UnifiedTablePage in documents-client.tsx */
import { DocumentsClient } from "./documents-client";

export const metadata = {
  title: "Documents",
};

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <DocumentsClient projectId={projectId} />
    </div>
  );
}
