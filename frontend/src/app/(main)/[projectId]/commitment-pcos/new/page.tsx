"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { FormContainer, PageShell } from "@/components/layout";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FormActions,
  FormGrid,
  FormSection,
  FormServerError,
} from "@/components/forms";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { apiFetch } from "@/lib/api-client";
import {
  buildPrimePcoSourceTitle,
  parseChangeEventIdsParam,
  resolveSourceChangeReason,
  type PrimePcoSourceChangeEvent,
} from "@/lib/change-events/prime-pco-source";

const CHANGE_REASONS = [
  "Allowance",
  "Backcharge",
  "Client Request",
  "Design Development",
  "Design Error",
  "Design Omission",
  "Existing Condition",
  "Field Condition",
  "Owner Request",
  "Regulatory Requirement",
  "Scope Change",
  "Unforeseen Condition",
  "Value Engineering",
  "Other",
];

const schema = z.object({
  commitment_id: z.string().uuid("Commitment is required"),
  title: z.string().trim().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional().nullable(),
  change_reason: z.string().optional().nullable(),
  schedule_impact: z.number().int().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;
type ChangeEventSummary = PrimePcoSourceChangeEvent;

interface CommitmentOption {
  id: string;
  contract_number: string | null;
  title: string | null;
  commitment_type: "subcontract" | "purchase_order" | null;
  company_name: string | null;
}

function formatCommitmentLabel(option: CommitmentOption): string {
  const number = option.contract_number?.trim() || "No number";
  const title = option.title?.trim() || "Untitled";
  return `${number} - ${title}`;
}

function buildCommitmentPcoTitle(events: ChangeEventSummary[]): string {
  return buildPrimePcoSourceTitle(events).replace(/^PCO for /, "PCO for ");
}

export default function NewCommitmentPcoPage() {
  const router = useRouter();
  const params = useParams()!;
  const searchParams = useSearchParams()!;
  const projectId = params.projectId as string;

  const commitmentIdParam =
    searchParams.get("commitmentId") ?? searchParams.get("contractId");
  const changeEventIdsParam = searchParams.get("changeEventIds");
  const changeEventIds = useMemo(
    () => parseChangeEventIdsParam(changeEventIdsParam),
    [changeEventIdsParam],
  );
  const hasSourceChangeEvents = changeEventIds.length > 0;

  const [commitments, setCommitments] = useState<CommitmentOption[]>([]);
  const [changeEvents, setChangeEvents] = useState<ChangeEventSummary[]>([]);
  const [isLoadingCommitments, setIsLoadingCommitments] = useState(true);
  const [isLoadingChangeEvents, setIsLoadingChangeEvents] = useState(false);
  const [sourceChangeEventError, setSourceChangeEventError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      commitment_id: "",
      title: hasSourceChangeEvents
        ? changeEventIds.length === 1
          ? "PCO for change event"
          : `PCO for ${changeEventIds.length} change events`
        : "",
      description: "",
      change_reason: null,
      schedule_impact: null,
      due_date: null,
    },
  });

  const selectedCommitmentId = form.watch("commitment_id");
  const selectedCommitment = commitments.find(
    (commitment) => commitment.id === selectedCommitmentId,
  );

  const commitmentOptions = useMemo(
    () =>
      commitments.map((commitment) => ({
        value: commitment.id,
        label: formatCommitmentLabel(commitment),
        keywords: [commitment.company_name, commitment.commitment_type].filter(
          Boolean,
        ) as string[],
      })),
    [commitments],
  );

  useEffect(() => {
    const fetchCommitments = async () => {
      setIsLoadingCommitments(true);
      try {
        const data = await apiFetch<CommitmentOption[]>(
          `/api/projects/${projectId}/commitment-options`,
        );
        setCommitments(data);
      } catch {
        toast.error("Could not load commitments.");
      } finally {
        setIsLoadingCommitments(false);
      }
    };

    void fetchCommitments();
  }, [projectId]);

  useEffect(() => {
    if (!commitmentIdParam || commitments.length === 0) return;
    const matchingCommitment = commitments.find(
      (commitment) => commitment.id === commitmentIdParam,
    );
    if (!matchingCommitment) return;

    form.setValue("commitment_id", matchingCommitment.id, {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });
  }, [commitmentIdParam, commitments, form]);

  useEffect(() => {
    if (isLoadingCommitments) return;
    if (selectedCommitmentId) return;
    if (commitments.length !== 1) return;

    form.setValue("commitment_id", commitments[0].id, {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });
  }, [commitments, form, isLoadingCommitments, selectedCommitmentId]);

  const applySourceDefaults = useCallback(
    (events: ChangeEventSummary[]) => {
      if (events.length === 0) return;

      form.setValue("title", buildCommitmentPcoTitle(events), {
        shouldValidate: true,
      });

      const sourceReason = resolveSourceChangeReason(events, CHANGE_REASONS);
      if (sourceReason) {
        form.setValue("change_reason", sourceReason, {
          shouldValidate: true,
        });
      }
    },
    [form],
  );

  useEffect(() => {
    if (!hasSourceChangeEvents) return;

    const fetchChangeEvents = async () => {
      setIsLoadingChangeEvents(true);
      setSourceChangeEventError(null);
      try {
        const results = await Promise.all(
          changeEventIds.map(async (id) => {
            try {
              const data = await apiFetch<Record<string, unknown>>(
                `/api/projects/${projectId}/change-events/${id}`,
              );
              return {
                id: String(data.id),
                number: data.number ? String(data.number) : null,
                title: String(data.title ?? ""),
                reason: data.reason ? String(data.reason) : null,
                prime_contract_id: null,
              } satisfies ChangeEventSummary;
            } catch {
              return null;
            }
          }),
        );
        const resolvedEvents = results.filter(Boolean) as ChangeEventSummary[];
        setChangeEvents(resolvedEvents);
        if (resolvedEvents.length !== changeEventIds.length) {
          setSourceChangeEventError(
            `Loaded ${resolvedEvents.length} of ${changeEventIds.length} source change events.`,
          );
        } else {
          applySourceDefaults(resolvedEvents);
        }
      } catch {
        setSourceChangeEventError("Could not load source change events.");
        toast.error("Could not load source change events.");
      } finally {
        setIsLoadingChangeEvents(false);
      }
    };

    void fetchChangeEvents();
  }, [
    applySourceDefaults,
    changeEventIds,
    hasSourceChangeEvents,
    projectId,
  ]);

  const handleSubmit: SubmitHandler<FormData> = async (data) => {
    if (!selectedCommitment?.commitment_type) {
      toast.error("Selected commitment is missing its type.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (hasSourceChangeEvents) {
        const result = await apiFetch<{ pco?: { id?: string } }>(
          `/api/projects/${projectId}/change-events/add-to-pco`,
          {
            method: "POST",
            body: JSON.stringify({
              change_event_ids: changeEventIds,
              pco_type: "commitment",
              create_new: {
                title: data.title,
                commitment_id: data.commitment_id,
                commitment_type: selectedCommitment.commitment_type,
                description: data.description || null,
                change_reason: data.change_reason || null,
                schedule_impact: data.schedule_impact ?? null,
              },
            }),
          },
        );

        toast.success("Commitment PCO created");
        const pcoId = result.pco?.id;
        router.push(pcoId ? `/${projectId}/commitment-pcos/${pcoId}` : `/${projectId}/commitment-pcos`);
        return;
      }

      const created = await apiFetch<{ id: string }>(
        `/api/projects/${projectId}/commitment-pcos`,
        {
          method: "POST",
          body: JSON.stringify({
            commitment_id: data.commitment_id,
            commitment_type: selectedCommitment.commitment_type,
            title: data.title,
            description: data.description || null,
            schedule_impact: data.schedule_impact ?? null,
            due_date: data.due_date || null,
          }),
        },
      );

      toast.success("Commitment PCO created");
      router.push(`/${projectId}/commitment-pcos/${created.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      form.setError("root", { type: "server", message });
      toast.error("Failed to create Commitment PCO", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isLoadingCommitments || isLoadingChangeEvents;
  const hasMissingSourceChangeEvents =
    hasSourceChangeEvents &&
    !isLoadingChangeEvents &&
    changeEvents.length !== changeEventIds.length;

  if (!hasSourceChangeEvents) {
    return (
      <PageShell
        variant="form"
        title="Create Commitment PCO"
        description="Commitment PCOs must start from a linked change event."
        onBack={() => router.back()}
        actions={
          <Button
            size="sm"
            onClick={() => router.push(`/${projectId}/change-events/new`)}
          >
            New Change Event
          </Button>
        }
      >
        <InfoAlert variant="info" className="text-sm">
          Start with a change event, then use Add to or Add to Commitment
          PCO from the selected event. Direct PCO creation is disabled for the
          standard workflow.
        </InfoAlert>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="form"
      title="Create Commitment PCO"
      onBack={() => router.back()}
    >
      <FormContainer maxWidth="lg" withCard={false}>
        {isLoading ? (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form
              noValidate
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-8"
            >
              <FormSection
                title={`Source Change Event${changeEventIds.length === 1 ? "" : "s"} (${changeEventIds.length})`}
              >
                {sourceChangeEventError ? (
                  <InfoAlert variant="error" className="text-sm">
                    {sourceChangeEventError} The PCO cannot be created until every selected source event is loaded.
                  </InfoAlert>
                ) : (
                  <div className="divide-y divide-border/60">
                    {changeEvents.map((changeEvent) => (
                      <div
                        key={changeEvent.id}
                        className="flex items-center gap-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {changeEvent.number ? `CE ${changeEvent.number}` : "CE"}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {changeEvent.title}
                        </span>
                        {changeEvent.reason ? (
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {changeEvent.reason}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>

              <FormSection title="General Information">
                <FormGrid columns={2}>
                  <RHFComboboxField
                    control={form.control}
                    name="commitment_id"
                    label="Commitment *"
                    placeholder="Select a commitment"
                    searchPlaceholder="Search commitments..."
                    emptyMessage="No commitments found."
                    options={commitmentOptions}
                    disabled={isLoadingCommitments}
                  />

                  <div className="grid gap-2">
                    <Label>Contract Company</Label>
                    <Input
                      value={selectedCommitment?.company_name ?? ""}
                      disabled
                      placeholder="Determined by selected commitment"
                    />
                  </div>
                </FormGrid>

                <RHFTextField
                  control={form.control}
                  name="title"
                  label="Title *"
                  placeholder="Potential change order title"
                />

                <FormGrid columns={2}>
                  <RHFTextField
                    control={form.control}
                    name="change_reason"
                    label="Change Reason"
                    placeholder="Optional"
                  />

                  <RHFNumberField
                    control={form.control}
                    name="schedule_impact"
                    label="Schedule Impact (days)"
                    step={1}
                  />

                  <RHFDateField
                    control={form.control}
                    name="due_date"
                    label="Due Date"
                    nullable
                  />
                </FormGrid>

                <RHFTextareaField
                  control={form.control}
                  name="description"
                  label="Description"
                  placeholder="Describe the potential change..."
                  rows={4}
                />
              </FormSection>

              {commitments.length === 0 ? (
                <InfoAlert variant="warning">
                  No commitments were found for this project. Create a subcontract or purchase order before creating a Commitment PCO.
                </InfoAlert>
              ) : null}

              <FormServerError message={form.formState.errors.root?.message} />

              <FormActions
                onCancel={() => router.push(`/${projectId}/commitment-pcos`)}
                isSubmitting={isSubmitting}
                submitDisabled={isLoading || hasMissingSourceChangeEvents}
                submitLabel="Create"
                stickyOnMobile
              />
            </form>
          </Form>
        )}
      </FormContainer>
    </PageShell>
  );
}
