"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileStack,
  FileText,
  Link2,
  MapPin,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { useForm } from "react-hook-form";

import { RelatedItemsPanel } from "@/components/domain/related-items/RelatedItemsPanel";
import {
  EditModeActions,
  EntityAttachments,
  EmptyState,
  Form,
  Heading,
  InspectorRail,
  InspectorSection,
  PropertyList,
  PropertyRow,
  StatusBadge,
} from "@/components/ds";
import {
  ContentSectionStack,
  DetailLayout,
  SectionRuleHeading,
} from "@/components/layout";
import { FormSection } from "@/components/forms";
import { apiFetch } from "@/lib/api-client";
import { RfiResponses } from "@/components/rfis/rfi-responses";
import { RfiFormalResponses } from "@/components/rfis/rfi-formal-responses";
import { RfiFormFields } from "@/components/rfis/rfi-form-fields";
import { InlineEditField } from "@/components/ds/InlineEditField";
import { useUpdateRfi } from "@/hooks/use-rfis";
import {
  RFI_IMPACT_OPTIONS,
  rfiBaseSchema,
  type RfiFormValues,
} from "@/lib/schemas/rfi-schema";
import type { RFI } from "@/types/database-extensions";
import { formatDate } from "@/lib/format";

const toDateInputValue = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

const impactLabel = (value: string | null | undefined) =>
  RFI_IMPACT_OPTIONS.find((opt) => opt.value === value)?.label ?? value ?? undefined;

const formatStatusLabel = (status: string | null | undefined) => {
  if (!status) return "Open";
  if (status === "closed-draft") return "Closed (Draft)";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

function parseRfiNumber(value: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error("RFI number must be a positive whole number.");
  }
  return number;
}

type ImportedRfiDocument = {
  project_document_id?: number | null;
  file_name?: string | null;
};

type ImportedRfiMetadata = {
  question_document?: ImportedRfiDocument | null;
  response_document?: ImportedRfiDocument | null;
};

function getImportedRfiMetadata(value: RFI["source_metadata"]): ImportedRfiMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ImportedRfiMetadata;
}

function ImportedDocumentLink({
  label,
  documentId,
  fileName,
  projectId,
}: {
  label: string;
  documentId?: number | null;
  fileName?: string | null;
  projectId: number;
}) {
  if (!documentId) return null;

  return (
    <a
      href={`/api/projects/${projectId}/documents/${documentId}/download`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted/60"
    >
      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block break-words text-muted-foreground">
          {fileName || `Document ${documentId}`}
        </span>
      </span>
      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RfiDetailProps {
  rfi: RFI | null;
  projectId: number;
  isEditing?: boolean;
}

export function RfiDetail({ rfi, projectId, isEditing = false }: RfiDetailProps) {
  const router = useRouter();
  const updateRfi = useUpdateRfi(projectId);

  const form = useForm<RfiFormValues>({
    defaultValues: {
      number: rfi?.number,
      subject: rfi?.subject ?? "",
      question: rfi?.question ?? "",
      due_date: rfi?.due_date ?? null,
      assignees: rfi?.assignees ?? [],
      rfi_manager: rfi?.rfi_manager ?? null,
      received_from: rfi?.received_from ?? null,
      responsible_contractor: rfi?.responsible_contractor ?? null,
      distribution_list: rfi?.distribution_list ?? [],
      location: rfi?.location ?? null,
      specification: rfi?.specification ?? null,
      cost_code: rfi?.cost_code ?? null,
      schedule_impact: rfi?.schedule_impact ?? null,
      cost_impact: rfi?.cost_impact ?? null,
      reference: rfi?.reference ?? null,
      is_private: rfi?.is_private ?? false,
      rfi_stage: rfi?.rfi_stage ?? null,
      drawing_number: rfi?.drawing_number ?? null,
    },
  });

  if (!rfi) {
    return (
      <EmptyState
        title="RFI not found"
        description="This RFI could not be found or may have been deleted."
      />
    );
  }

  const cancelUrl = `/${projectId}/rfis/${rfi.id}`;
  const importedMetadata = getImportedRfiMetadata(rfi.source_metadata);
  const hasImportedDocuments =
    Boolean(rfi.source_project_document_id) ||
    Boolean(rfi.response_project_document_id);

  const inspectorContent = (
    <InspectorRail className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <InspectorSection title="Assignment">
        <PropertyList className="divide-y-0">
          <PropertyRow label="RFI Manager" icon={<UserRound className="h-3.5 w-3.5" />}>
            {rfi.rfi_manager}
          </PropertyRow>
          <PropertyRow label="Received From" icon={<UserRound className="h-3.5 w-3.5" />}>
            {rfi.received_from}
          </PropertyRow>
          <PropertyRow label="Contractor" icon={<UserRound className="h-3.5 w-3.5" />}>
            {rfi.responsible_contractor}
          </PropertyRow>
          <PropertyRow label="Assignees" icon={<Users className="h-3.5 w-3.5" />}>
            {rfi.assignees?.length ? rfi.assignees.join(", ") : null}
          </PropertyRow>
        </PropertyList>
      </InspectorSection>

      <InspectorSection title="Details" showContentDivider={false}>
        <PropertyList className="divide-y-0">
          <PropertyRow label="RFI Number" icon={<ClipboardList className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="RFI Number"
              value={String(rfi.number)}
              display={`#${rfi.number}`}
              className="-mx-1.5 px-0 tabular-nums"
              onSave={(value) => saveField("number", parseRfiNumber(value))}
            />
          </PropertyRow>
          <PropertyRow label="Status" icon={<ClipboardList className="h-3.5 w-3.5" />}>
            <StatusBadge status={formatStatusLabel(rfi.status)} />
          </PropertyRow>
          <PropertyRow label="Stage" icon={<ClipboardList className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="Stage"
              value={rfi.rfi_stage ?? ""}
              emptyLabel="—"
              className="-mx-1.5 px-0"
              onSave={(v) => saveField("rfi_stage", v || null)}
            />
          </PropertyRow>
          <PropertyRow label="Location" icon={<MapPin className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="Location"
              value={rfi.location ?? ""}
              emptyLabel="—"
              className="-mx-1.5 px-0"
              onSave={(v) => saveField("location", v || null)}
            />
          </PropertyRow>
          <PropertyRow label="Drawing #" icon={<FileStack className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="Drawing Number"
              value={rfi.drawing_number ?? ""}
              emptyLabel="—"
              className="-mx-1.5 px-0"
              onSave={(v) => saveField("drawing_number", v || null)}
            />
          </PropertyRow>
          <PropertyRow label="Specification" icon={<ClipboardList className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="Specification"
              value={rfi.specification ?? ""}
              emptyLabel="—"
              className="-mx-1.5 px-0"
              onSave={(v) => saveField("specification", v || null)}
            />
          </PropertyRow>
          <PropertyRow label="Reference" icon={<Link2 className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="Reference"
              value={rfi.reference ?? ""}
              emptyLabel="—"
              className="-mx-1.5 px-0"
              onSave={(v) => saveField("reference", v || null)}
            />
          </PropertyRow>
          <PropertyRow label="Cost Impact" icon={<CircleDollarSign className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="Cost Impact"
              type="select"
              options={[...RFI_IMPACT_OPTIONS]}
              value={rfi.cost_impact ?? ""}
              display={impactLabel(rfi.cost_impact)}
              className="-mx-1.5 px-0"
              onSave={(v) => saveField("cost_impact", v || null)}
            />
          </PropertyRow>
          <PropertyRow label="Schedule Impact" icon={<CalendarDays className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="Schedule Impact"
              type="select"
              options={[...RFI_IMPACT_OPTIONS]}
              value={rfi.schedule_impact ?? ""}
              display={impactLabel(rfi.schedule_impact)}
              className="-mx-1.5 px-0"
              onSave={(v) => saveField("schedule_impact", v || null)}
            />
          </PropertyRow>
          <PropertyRow label="Cost Code" icon={<CircleDollarSign className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="Cost Code"
              value={rfi.cost_code ?? ""}
              emptyLabel="—"
              className="-mx-1.5 px-0"
              onSave={(v) => saveField("cost_code", v || null)}
            />
          </PropertyRow>
          <PropertyRow label="Private" icon={<Shield className="h-3.5 w-3.5" />}>
            {rfi.is_private ? "Yes" : "No"}
          </PropertyRow>
        </PropertyList>
      </InspectorSection>

      <InspectorSection title="Dates">
        <PropertyList className="divide-y-0">
          <PropertyRow label="Due Date" icon={<CalendarDays className="h-3.5 w-3.5" />}>
            <InlineEditField
              label="Due Date"
              type="date"
              value={toDateInputValue(rfi.due_date)}
              display={rfi.due_date ? formatDate(rfi.due_date) : undefined}
              className="-mx-1.5 px-0"
              onSave={(v) => saveField("due_date", v || null)}
            />
          </PropertyRow>
          <PropertyRow label="Initiated" icon={<CalendarDays className="h-3.5 w-3.5" />}>
            {formatDate(rfi.date_initiated)}
          </PropertyRow>
          <PropertyRow label="Closed" icon={<CalendarDays className="h-3.5 w-3.5" />}>
            {formatDate(rfi.closed_date)}
          </PropertyRow>
          <PropertyRow label="Created" icon={<CalendarDays className="h-3.5 w-3.5" />}>
            {formatDate(rfi.created_at)}
          </PropertyRow>
          <PropertyRow label="Created By" icon={<UserRound className="h-3.5 w-3.5" />}>
            {rfi.created_by}
          </PropertyRow>
        </PropertyList>
      </InspectorSection>

      {hasImportedDocuments ? (
        <InspectorSection title="Source Documents">
          <div className="space-y-1">
            <ImportedDocumentLink
              label="Question PDF"
              documentId={rfi.source_project_document_id}
              fileName={importedMetadata.question_document?.file_name}
              projectId={projectId}
            />
            <ImportedDocumentLink
              label="Response PDF"
              documentId={rfi.response_project_document_id}
              fileName={importedMetadata.response_document?.file_name}
              projectId={projectId}
            />
          </div>
        </InspectorSection>
      ) : null}

      <InspectorSection title="Related Items">
        <RelatedItemsPanel
          entityType="rfi"
          entityId={rfi.id}
          projectId={projectId}
          flat
        />
      </InspectorSection>
    </InspectorRail>
  );

  // Validate manually (no resolver) so the form's value type stays aligned with
  // the shared RfiFormFields component — matches the create page's pattern.
  const submitEdit = async () => {
    const data = form.getValues();
    const result = rfiBaseSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof RfiFormValues;
        if (path) form.setError(path, { message: issue.message });
      }
      return;
    }
    await updateRfi.mutateAsync({ rfiId: rfi.id, data: result.data });
    router.push(cancelUrl);
    router.refresh();
  };

  // Single-field inline save for the detail page (click-to-edit, like the
  // commitment/prime-contract detail pages). Throws on failure so InlineEditField
  // reverts + toasts.
  const saveField = async (field: string, value: string | number | null) => {
    await apiFetch(`/api/projects/${projectId}/rfis/${rfi.id}`, {
      method: "PATCH",
      body: JSON.stringify({ [field]: value }),
    });
    router.refresh();
  };

  // ── Edit mode — shared RFI form components ─────────────────────────────────

  if (isEditing) {
    return (
      <Form {...form}>
        <form className="space-y-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              Editing RFI #{rfi.number}
            </p>
            <EditModeActions
              isEditing
              onEdit={() => {}}
              onSave={submitEdit}
              onCancel={() => {
                form.reset();
                router.push(cancelUrl);
              }}
              isSaving={updateRfi.isPending}
            />
          </div>

          <RfiFormFields form={form} projectId={projectId} withFormProvider={false} />

          <FormSection title="Attachments">
            <EntityAttachments
              entityType="rfi"
              entityId={rfi.id}
              projectId={String(projectId)}
              showLabel={false}
            />
          </FormSection>
        </form>
      </Form>
    );
  }

  // ── View mode — matches the commitment/contract detail layout ──────────────

  return (
    <ContentSectionStack className="pb-20">
      <DetailLayout
        sidebar={<div className="lg:block">{inspectorContent}</div>}
        sidebarDesktopOnly
        sidebarAt="lg"
      >
          <section className="space-y-8">
            <div className="space-y-2">
              <SectionRuleHeading label="Subject" className="mb-0 pb-0" />
              <InlineEditField
                label="Subject"
                value={rfi.subject ?? ""}
                display={
                  <Heading
                    as="h2"
                    level={2}
                    className="text-2xl sm:text-[1.75rem]"
                  >
                    {rfi.subject || "Untitled RFI"}
                  </Heading>
                }
                className="-mx-2 px-2"
                onSave={(v) => saveField("subject", v)}
              />
            </div>

            <div className="space-y-3">
              <SectionRuleHeading label="Question" className="mb-0 pb-0" />
              <InlineEditField
                label="Question"
                type="textarea"
                value={rfi.question ?? ""}
                display={
                  <p className="max-w-4xl whitespace-pre-wrap text-base leading-8 text-foreground">
                    {rfi.question || "No question provided."}
                  </p>
                }
                className="-mx-2 px-2"
                onSave={(v) => saveField("question", v)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <SectionRuleHeading label="Attachments" className="mb-0 pb-0" />
            <EntityAttachments
              entityType="rfi"
              entityId={rfi.id}
              projectId={String(projectId)}
              showLabel={false}
            />
          </section>

          <section className="lg:hidden">
            {inspectorContent}
          </section>

          <section className="space-y-4">
            <SectionRuleHeading label="Responses" className="mb-0 pb-0" />
            <div className="space-y-4">
              <RfiFormalResponses
                projectId={projectId}
                rfiId={rfi.id}
                hideHeading
              />
              <RfiResponses
                rfiId={rfi.id}
                projectId={projectId}
                title=""
                className="rfi-detail-comments"
              />
            </div>
          </section>
      </DetailLayout>
    </ContentSectionStack>
  );
}
