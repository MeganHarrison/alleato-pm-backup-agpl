"use client";

import * as React from "react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { createDocumentsTableDefinition } from "@/features/documents/documents-table-definition";
import type { PipelineDoc } from "@/features/documents/documents-table-config";
import {
  DocumentGridCard,
  type MoveTarget,
} from "@/features/documents/document-grid-card";
import { DocumentsBrowserTemplate } from "@/features/documents/documents-browser-template";
import {
  SmartGroupRail,
  SmartGroupPills,
} from "@/features/documents/smart-group-rail";
import {
  SMART_GROUPS,
  type SmartGroupCounts,
} from "@/features/documents/smart-groups";

// Category groups a document can be re-filed into (search/type groups like
// Commitments, Meetings, Emails are not move targets).
const MOVE_TARGETS: MoveTarget[] = SMART_GROUPS.filter(
  (g) => g.reclassifyTo,
).map((g) => ({ label: g.label, category: g.reclassifyTo as string }));

export function ProjectDocumentsBrowser({
  projectId,
  projectName,
}: {
  projectId?: number;
  projectName?: string;
}): React.ReactElement {
  const [activeGroupId, setActiveGroupId] = React.useState("all");
  const [counts, setCounts] = React.useState<SmartGroupCounts>({});
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const loadCounts = React.useCallback(() => {
    const endpoint =
      typeof projectId === "number"
        ? `/api/projects/${projectId}/documents/group-counts`
        : "/api/documents/status";
    const request =
      typeof projectId === "number"
        ? apiFetch<{ counts: SmartGroupCounts }>(endpoint)
        : Promise.all(
            SMART_GROUPS.map(async (group) => {
              const params = new URLSearchParams({ page: "1", per_page: "1" });
              const filter = group.filter;
              if (typeof filter.category === "string") {
                params.set("category", filter.category);
              }
              if (typeof filter.type === "string") {
                params.set("type", filter.type);
              }
              if (group.search) params.set("search", group.search);
              const result = await apiFetch<{ total?: number }>(
                `${endpoint}?${params.toString()}`,
              );
              return [group.id, result.total ?? 0] as const;
            }),
          ).then((entries) => ({ counts: Object.fromEntries(entries) }));

    request
      .then((r) => setCounts(r.counts))
      .catch(() => setCounts({}));
  }, [projectId]);

  React.useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const activeGroup =
    SMART_GROUPS.find((g) => g.id === activeGroupId) ?? SMART_GROUPS[0];

  const definition = React.useMemo(
    () =>
      createDocumentsTableDefinition({
        entityKey:
          typeof projectId === "number"
            ? "project-documents-unified"
            : "documents-unified",
        forcedProjectId: projectId,
        forcedFilters: activeGroup.filter,
        forcedSearch: activeGroup.search,
        defaultView: "card",
      }),
    [projectId, activeGroup],
  );

  const handleMove = React.useCallback(
    async (doc: PipelineDoc, category: string, label: string) => {
      try {
        const scopeProjectId = projectId ?? doc.project_id;
        if (typeof scopeProjectId !== "number") {
          throw new Error("Document must belong to a project before it can be refiled.");
        }
        await apiFetch(`/api/documents/${doc.id}/reclassify`, {
          method: "PATCH",
          body: JSON.stringify({ category, projectId: scopeProjectId }),
        });
        toast.success(`Moved to ${label}`);
        loadCounts();
        setRefreshNonce((n) => n + 1);
      } catch (error) {
        console.error("Document reclassify failed", error);
        toast.error(
          "Could not move the document. You may not have permission, or it may no longer exist.",
        );
      }
    },
    [projectId, loadCounts],
  );

  const renderCard = React.useCallback(
    (item: PipelineDoc, onView: (item: PipelineDoc) => void) => (
      <DocumentGridCard
        item={item}
        onView={onView}
        onMove={handleMove}
        moveTargets={MOVE_TARGETS}
      />
    ),
    [handleMove],
  );

  return (
    <DocumentsBrowserTemplate
      title="Documents"
      eyebrow={projectName}
      definition={definition}
      pageArea="project-documents-browser"
      splitStorageKey="documents-browser-split"
      uploadProjectId={projectId}
      projectAssignmentEnabled={true}
      sidebar={
        <SmartGroupRail
          counts={counts}
          activeGroupId={activeGroupId}
          onSelect={(id) => setActiveGroupId(id)}
        />
      }
      mobileSidebar={
        <SmartGroupPills
          counts={counts}
          activeGroupId={activeGroupId}
          onSelect={(id) => setActiveGroupId(id)}
        />
      }
      renderCard={renderCard}
      cardGridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"
      headerTitleClassName="pt-0"
      contentKey={`${activeGroupId}:${refreshNonce}`}
    />
  );
}
