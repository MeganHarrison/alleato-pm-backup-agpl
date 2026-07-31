"use client";

import { ProjectDocumentsBrowser } from "@/features/documents/project-documents-browser";
import { useOptionalProject } from "@/contexts/project-context";

type DocumentsClientProps = { projectId: string };

export function DocumentsClient({ projectId }: DocumentsClientProps) {
  const numericProjectId = Number.parseInt(projectId, 10);
  const projectName = useOptionalProject()?.selectedProject?.name ?? undefined;
  return (
    <ProjectDocumentsBrowser
      projectId={Number.isFinite(numericProjectId) ? numericProjectId : 0}
      projectName={projectName}
    />
  );
}
