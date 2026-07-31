"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocument } from "@/hooks/use-documents";
import { inferProjectDocumentFormat } from "@/features/documents/project-documents-table-config";
import {
  ProjectDocumentPreviewActions,
  ProjectDocumentPreviewBody,
  ProjectDocumentPreviewMeta,
  projectDocumentFileHref,
} from "@/features/documents/project-document-preview";

type ProjectDocumentPreviewClientProps = {
  projectId: string;
  documentId: string;
};

export function ProjectDocumentPreviewClient({
  projectId,
  documentId,
}: ProjectDocumentPreviewClientProps) {
  const {
    data: document,
    isLoading,
    error,
  } = useDocument(Number(projectId), documentId);

  const backHref = `/${projectId}/documents?view=card`;
  const inlineHref = projectDocumentFileHref(projectId, documentId, true);

  if (isLoading) {
    return (
      <PageShell
        variant="content"
        title="Document preview"
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Documents
            </Link>
          </Button>
        }
        contentClassName="space-y-4"
      >
        <Skeleton className="h-10 w-80" />
        <Skeleton className="w-full" style={{ height: "72vh" }} />
      </PageShell>
    );
  }

  if (error || !document) {
    return (
      <PageShell
        variant="content"
        title="Document not found"
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Documents
            </Link>
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          This document could not be loaded.
        </p>
      </PageShell>
    );
  }

  const format = inferProjectDocumentFormat(document).label;

  return (
    <PageShell
      variant="content"
      title={document.title}
      description={[document.file_name, document.folder ?? "Root", format]
        .filter(Boolean)
        .join(" - ")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ProjectDocumentPreviewActions document={document} projectId={projectId} />
          <Button asChild size="sm" variant="ghost">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Documents
            </Link>
          </Button>
        </div>
      }
      contentClassName="space-y-6"
    >
      <section>
        <ProjectDocumentPreviewMeta document={document} />
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-background">
        <ProjectDocumentPreviewBody document={document} inlineHref={inlineHref} />
      </section>
    </PageShell>
  );
}
