"use client";

import * as React from "react";
import { Download, FileText, Info, ZoomIn, ZoomOut } from "lucide-react";

import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  documentSourceLabel,
  type PipelineDoc,
} from "@/features/documents/documents-table-config";
import {
  pipelineDocInlineHref,
  pipelineDocIsGraphSourced,
  pipelineDocPreviewKind,
} from "@/features/documents/pipeline-doc-preview";
import { documentTypeLabel } from "@/features/documents/document-types";
import { PdfPreview } from "@/features/documents/pdf-preview";
import { formatDate } from "@/lib/format";

export function PreviewPane({
  doc,
}: {
  doc: PipelineDoc | null;
}): React.ReactElement {
  const [scale, setScale] = React.useState(1);
  const [showInfo, setShowInfo] = React.useState(false);
  const [officeUrl, setOfficeUrl] = React.useState<string | null>(null);
  const [officeError, setOfficeError] = React.useState(false);

  const kind = doc ? pipelineDocPreviewKind(doc) : "none";
  const inlineHref = doc ? pipelineDocInlineHref(doc) : "";
  const downloadHref = doc ? `/api/files/${doc.id}/download` : "";

  React.useEffect(() => {
    setOfficeUrl(null);
    setOfficeError(false);
    setScale(1);
    if (doc && kind === "office" && pipelineDocIsGraphSourced(doc)) {
      apiFetch<{ url: string }>(`/api/files/${doc.id}/office-preview`)
        .then((r) => setOfficeUrl(r.url))
        .catch(() => setOfficeError(true));
    }
  }, [doc, kind]);

  if (!doc) {
    return (
      <div className="flex h-full items-start justify-start bg-background p-8">
        <EmptyState
          icon={<FileText />}
          title="Select a document"
          description="Choose a document to preview it here."
          className="w-full items-start py-8 text-left"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {doc.title ?? "Untitled"}
        </p>

        {kind === "pdf" && (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Zoom out"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Zoom in"
              onClick={() => setScale((s) => Math.min(3, s + 0.1))}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </>
        )}

        <a
          href={downloadHref}
          download
          className="text-muted-foreground hover:text-foreground"
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
        </a>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle info"
          onClick={() => setShowInfo((v) => !v)}
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>

      {/* Metadata strip (toggled by info button) */}
      {showInfo && (
        <div className="border-b border-border bg-muted/30 px-4 py-3 text-sm">
          <div className="flex items-center gap-4 py-1">
            <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
              Type
            </span>
            <span className="text-foreground">
              {documentTypeLabel(doc.document_type)}
            </span>
          </div>
          {documentSourceLabel(doc.source ?? doc.source_system) && (
            <div className="flex items-center gap-4 py-1">
              <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                Source
              </span>
              <span className="text-foreground">
                {documentSourceLabel(doc.source ?? doc.source_system)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-4 py-1">
            <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
              Added
            </span>
            <span className="text-foreground">
              {formatDate(doc.created_at ?? doc.date)}
            </span>
          </div>
        </div>
      )}

      {/* Preview body */}
      <div className="min-h-0 flex-1">
        {kind === "pdf" && <PdfPreview src={inlineHref} scale={scale} />}

        {kind === "image" && (
          <div className="flex h-full items-start justify-center overflow-auto bg-background p-4">
            <img
              src={inlineHref}
              alt={doc.title ?? ""}
              className="max-w-full object-contain"
            />
          </div>
        )}

        {kind === "text" && (
          <iframe
            src={inlineHref}
            title={`${doc.title ?? "Document"} preview`}
            className="h-full w-full bg-background"
          />
        )}

        {kind === "office" && officeUrl && (
          <iframe
            src={officeUrl}
            title={`${doc.title ?? "Document"} preview`}
            className="h-full w-full bg-background"
          />
        )}

        {kind === "office" && !officeUrl && (
          <div className="flex h-full items-start justify-start p-8">
            <EmptyState
              icon={<FileText />}
              title={
                officeError || !pipelineDocIsGraphSourced(doc)
                  ? "Preview unavailable"
                  : "Preparing preview…"
              }
              description="Download the file to view it."
              className="w-full items-start py-8 text-left"
              action={
                <Button asChild size="sm" variant="outline">
                  <a href={downloadHref} download>
                    Download
                  </a>
                </Button>
              }
            />
          </div>
        )}

        {kind === "none" && (
          <div className="flex h-full items-start justify-start p-8">
            <EmptyState
              icon={<FileText />}
              title="Preview not available for this file type"
              description="Download the file to view it."
              className="w-full items-start py-8 text-left"
              action={
                <Button asChild size="sm" variant="outline">
                  <a href={downloadHref} download>
                    Download
                  </a>
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
