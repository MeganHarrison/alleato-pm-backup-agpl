"use client";

import * as React from "react";

import { PageShell } from "@/components/layout";
import { DocumentsTablePage } from "@/features/documents/documents-table-page";
import type { ServerTableDefinition } from "@/features/tables/server-table";
import type { DocumentFilterState } from "@/features/documents/documents-table-definition";
import type { PipelineDoc } from "@/features/documents/documents-table-config";
import { DocumentBrowserShell } from "@/features/documents/document-browser-shell";
import { PreviewPane } from "@/features/documents/preview-pane";

export interface DocumentsBrowserTemplateProps {
  definition: ServerTableDefinition<PipelineDoc, DocumentFilterState>;
  title: string;
  description: string;
  pageArea: string;
  splitStorageKey: string;
  sidebar?: React.ReactNode;
  mobileSidebar?: React.ReactNode;
  eyebrow?: React.ReactNode;
  uploadProjectId?: number | null;
  projectAssignmentEnabled?: boolean;
  renderCard?: (
    item: PipelineDoc,
    onView: (item: PipelineDoc) => void,
  ) => React.ReactElement;
  cardGridClassName?: string;
  headerTitleClassName?: string;
  contentKey?: string;
}

/**
 * Canonical page template for both project-scoped and global document
 * libraries. Data scope, rail, and card behavior are configuration; the
 * browser shell, selection, preview, header, toolbar, and overflow contract
 * stay identical across both routes.
 */
export function DocumentsBrowserTemplate({
  definition,
  title,
  description,
  pageArea,
  splitStorageKey,
  sidebar,
  mobileSidebar,
  eyebrow,
  uploadProjectId,
  projectAssignmentEnabled = true,
  renderCard,
  cardGridClassName,
  headerTitleClassName,
  contentKey,
}: DocumentsBrowserTemplateProps): React.ReactElement {
  const [selectedDoc, setSelectedDoc] = React.useState<PipelineDoc | null>(
    null,
  );

  const handleDocumentsChange = React.useCallback(
    (documents: PipelineDoc[]) => {
      setSelectedDoc((current) => {
        if (current && documents.some((document) => document.id === current.id)) {
          return current;
        }
        return documents[0] ?? null;
      });
    },
    [],
  );

  return (
    <PageShell
      variant="table"
      title={title}
      eyebrow={eyebrow}
      showHeader={false}
      contentClassName="p-0"
      containerPaddingClassName="p-0"
      fillHeight
    >
      <DocumentBrowserShell
        sidebar={sidebar}
        mobileSidebar={mobileSidebar}
        previewOpen={Boolean(selectedDoc)}
        onClosePreview={() => setSelectedDoc(null)}
        splitStorageKey={splitStorageKey}
        preview={<PreviewPane doc={selectedDoc} />}
      >
        <DocumentsTablePage
          key={contentKey}
          definition={definition}
          title={title}
          description={description}
          uploadEnabled
          uploadProjectId={uploadProjectId}
          inlineEditingEnabled
          projectAssignmentEnabled={projectAssignmentEnabled}
          deleteEnabled
          pageArea={pageArea}
          selectedDocId={selectedDoc?.id}
          onSelectDoc={setSelectedDoc}
          renderCard={renderCard}
          cardGridClassName={cardGridClassName}
          headerTitleClassName={headerTitleClassName}
          onDocumentsChange={handleDocumentsChange}
        />
      </DocumentBrowserShell>
    </PageShell>
  );
}
