"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState, EmptyState } from "@/components/ds";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";
import type {
  GranularFlag,
  PermissionLevel,
  PermissionModule,
  PermissionTemplate,
} from "@/lib/permissions-shared";

import { PermissionTemplateForm } from "./permission-template-form";
import { PermissionTemplateMatrix } from "./permission-template-matrix";

async function fetchTemplateById(templateId: string): Promise<PermissionTemplate> {
  const { data } = await apiFetch<{ data: PermissionTemplate }>(
    `/api/permissions/templates/${templateId}`,
  );
  return data;
}

function normalizeTemplate(template: PermissionTemplate | null): string {
  if (!template) return "";

  const sortedRules = Object.fromEntries(
    Object.entries(template.rules_json)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([moduleKey, levels]) => [moduleKey, [...levels].sort()]),
  );

  return JSON.stringify({
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    scope: template.scope ?? null,
    is_system: template.is_system,
    rules_json: sortedRules,
    granular_flags: [...(template.granular_flags ?? [])].sort(),
  });
}

function getBackHref(scope: PermissionTemplate["scope"]) {
  return scope === "company"
    ? "/user-management?tab=company-templates"
    : "/user-management?tab=project-templates";
}

export function PermissionTemplateDetailPageClient({
  templateId,
}: {
  templateId: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [showEditDetails, setShowEditDetails] = useState(false);
  const templateQuery = useQuery({
    queryKey: ["permission-template", templateId],
    queryFn: () => fetchTemplateById(templateId),
  });
  const [draftTemplate, setDraftTemplate] = useState<PermissionTemplate | null>(
    () => null,
  );
  const persistedTemplate = templateQuery.data ?? null;
  const pageTemplate = draftTemplate ?? persistedTemplate;

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      rules_json,
      granular_flags,
    }: {
      id: string;
      name: string;
      description: string;
      rules_json: Record<PermissionModule, PermissionLevel[]>;
      granular_flags?: GranularFlag[];
    }) => {
      const { data } = await apiFetch<{ data: PermissionTemplate }>(
        `/api/permissions/templates/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name,
            description,
            rules_json,
            granular_flags,
          }),
        },
      );
      return data;
    },
    onSuccess: (updatedTemplate) => {
      qc.setQueryData(["permission-template", templateId], updatedTemplate);
      qc.invalidateQueries({ queryKey: ["permission-templates"] });
      setDraftTemplate(updatedTemplate);
      toast.success("Template updated");
      setShowEditDetails(false);
    },
    onError: (error) => {
      toast.error("Failed to update template", {
        description:
          error instanceof Error ? error.message : "The template could not be saved.",
      });
      qc.invalidateQueries({ queryKey: ["permission-template", templateId] });
      qc.invalidateQueries({ queryKey: ["permission-templates"] });
    },
  });

  const backHref = useMemo(
    () => getBackHref(pageTemplate?.scope),
    [pageTemplate?.scope],
  );
  const hasUnsavedChanges = useMemo(() => {
    return normalizeTemplate(draftTemplate) !== normalizeTemplate(persistedTemplate);
  }, [draftTemplate, persistedTemplate]);
  const pageTitle = templateQuery.isError
    ? "Unable to load template"
    : pageTemplate?.name ?? (templateQuery.isLoading ? "Loading template..." : "Template not found");

  const ensureDraftTemplate = () => {
    if (!draftTemplate && persistedTemplate) {
      setDraftTemplate(persistedTemplate);
      return persistedTemplate;
    }

    return draftTemplate;
  };

  const handleSaveTemplate = async () => {
    const nextTemplate = ensureDraftTemplate();
    if (!nextTemplate) return;

    await updateMutation.mutateAsync({
      id: nextTemplate.id,
      name: nextTemplate.name,
      description: nextTemplate.description ?? "",
      rules_json: nextTemplate.rules_json,
      granular_flags: nextTemplate.granular_flags ?? [],
    });
  };

  const handleResetTemplate = () => {
    setDraftTemplate(persistedTemplate);
    setShowEditDetails(false);
  };

  return (
    <PageShell
      variant="detail"
      title={pageTitle}
      eyebrow={undefined}
      titleContent={
        pageTemplate ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-heading-label">
              {pageTemplate.scope === "company" ? "Company template" : "Project template"}
            </p>
            <div className="space-y-1">
              <h1 className="text-3xl font-medium tracking-tight text-foreground/90">
                {pageTitle}
              </h1>
              {pageTemplate.description ? (
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {pageTemplate.description}
                </p>
              ) : null}
            </div>
          </div>
        ) : undefined
      }
      description={undefined}
      actions={
        <div className="flex flex-wrap gap-2">
          {pageTemplate && hasUnsavedChanges ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleResetTemplate}
                disabled={updateMutation.isPending}
              >
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSaveTemplate()}
                disabled={updateMutation.isPending}
              >
                Save changes
              </Button>
            </>
          ) : null}
          {pageTemplate ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowEditDetails(true)}
            >
              Edit details
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      }
    >
      {templateQuery.isLoading && !pageTemplate ? (
        <div className="space-y-4">
          <div className="h-10 animate-pulse bg-muted" />
          <div className="h-64 animate-pulse bg-muted" />
          <div className="h-64 animate-pulse bg-muted" />
        </div>
      ) : templateQuery.isError ? (
        <ErrorState
          title="Unable to load permission template"
          description="User Management rejected this request. Admin permission is required before this template can load."
          error={templateQuery.error}
          onRetry={() => templateQuery.refetch()}
          className="border-y border-border py-14"
        />
      ) : pageTemplate ? (
        <PermissionTemplateMatrix
          template={pageTemplate}
          isSaving={updateMutation.isPending}
          onChange={(nextTemplate) => {
            setDraftTemplate(nextTemplate);
          }}
        />
      ) : (
        <EmptyState
          title="Template not found"
          description="Return to User Management and open a current permission template."
          action={
            <Button type="button" variant="outline" onClick={() => router.push("/user-management")}>
              Back
            </Button>
          }
          className="border-y border-border py-14"
        />
      )}

      <Modal open={showEditDetails} onOpenChange={setShowEditDetails}>
        <ModalContent
          size="form"
          className="max-h-[calc(100svh-2rem)] overflow-y-auto"
        >
          <ModalHeader>
            <ModalTitle>Edit template details</ModalTitle>
          </ModalHeader>
          {pageTemplate ? (
            <PermissionTemplateForm
              template={pageTemplate}
              includeAccessControls={false}
              onSave={async (data) => {
                setDraftTemplate({
                  ...pageTemplate,
                  name: data.name,
                  description: data.description,
                  rules_json: data.rules_json,
                  granular_flags: data.granular_flags,
                });
                setShowEditDetails(false);
              }}
              onCancel={() => setShowEditDetails(false)}
            />
          ) : null}
        </ModalContent>
      </Modal>
    </PageShell>
  );
}
