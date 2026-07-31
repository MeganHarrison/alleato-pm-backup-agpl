"use client";

import { Download, ArrowRight, FileText } from "lucide-react";

import { EmptyState, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { ProjectDocument } from "@/hooks/use-documents";
import { inferProjectDocumentFormat } from "@/features/documents/project-documents-table-config";

export function projectDocumentFileHref(
  projectId: string,
  documentId: string | number,
  inline: boolean,
): string {
  const base = `/api/projects/${projectId}/documents/${documentId}/download`;
  return inline ? `${base}?disposition=inline` : base;
}

export function projectDocumentOriginalSourceHref(
  document: ProjectDocument,
): string | null {
  if (document.source_web_url) return document.source_web_url;
  if (
    document.file_url?.startsWith("http://") ||
    document.file_url?.startsWith("https://")
  ) {
    return document.file_url;
  }
  return null;
}

export function ProjectDocumentPreviewBody({
  document,
  inlineHref,
}: {
  document: ProjectDocument;
  inlineHref: string;
}) {
  const format = inferProjectDocumentFormat(document).label;

  if (format === "Image") {
    return (
      <div className="flex min-h-96 items-start justify-center bg-muted/30 p-4">
        <img
          src={inlineHref}
          alt={document.title}
          className="max-w-full object-contain"
          style={{ maxHeight: "72vh" }}
        />
      </div>
    );
  }

  if (format === "PDF") {
    return (
      <iframe
        src={inlineHref}
        title={`${document.title} preview`}
        className="w-full bg-background"
        style={{ height: "72vh" }}
      />
    );
  }

  return (
    <div className="min-h-96 bg-muted/30 p-8">
      <EmptyState
        icon={<FileText />}
        title="Preview is not available for this file type"
        description="Download the file or open the original source to view it."
      />
    </div>
  );
}

export function ProjectDocumentPreviewMeta({
  document,
}: {
  document: ProjectDocument;
}) {
  const format = inferProjectDocumentFormat(document).label;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
      <span>{format}</span>
      <span>
        {document.file_size
          ? `${Math.round(document.file_size / 1024).toLocaleString()} KB`
          : "Size unavailable"}
      </span>
      <span>Uploaded {formatDate(document.created_at)}</span>
      <StatusBadge status={document.status} />
    </div>
  );
}

export function ProjectDocumentPreviewActions({
  document,
  projectId,
}: {
  document: ProjectDocument;
  projectId: string;
}) {
  const sourceHref = projectDocumentOriginalSourceHref(document);
  const downloadHref = projectDocumentFileHref(projectId, document.id, false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sourceHref ? (
        <Button asChild size="sm" variant="outline">
          <a href={sourceHref} target="_blank" rel="noopener noreferrer">
            Original
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      ) : null}
      <Button asChild size="sm" variant="outline">
        <a href={downloadHref} download={document.file_name}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </a>
      </Button>
    </div>
  );
}
