"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubmittalSummary {
  id: string;
  project_id: number;
  submittal_number: string;
  revision: number;
  title: string;
  status: "Draft" | "Open" | "Distributed" | "Closed" | string;
  priority: string | null;
  specification_section: string | null;
  /** Raw text field on the submittals table (type name string) */
  submittal_type: string | { id: string; name: string } | null;
  division: string | null;
  ball_in_court: string | null;
  is_private: boolean;
  final_due_date: string | null;
  sent_date: string | null;
  received_from?: string | null; // resolved display name (not UUID)
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  submittal_package?: { id: string; name: string } | null;
}

export interface SubmittalDetail extends SubmittalSummary {
  description: string | null;
  received_from_id: string | null;
  responsible_contractor_id: string | null;
  responsible_contractor: { id: string; name: string } | null;
  submittal_manager_id: string | null;
  lead_time: number | null;
  required_on_site_date: string | null;
  cost_code_id: number | null;
  location_id: number | null;
  submittal_workflow_steps: Array<{
    id: string;
    step_order: number;
    step_type: string;
    submittal_responses: Array<{
      id: string;
      responder_id: string;
      response_status: string;
      comments: string | null;
      responded_at: string | null;
    }>;
  }>;
  submittal_distributions: Array<{
    id: string;
    from_id: string;
    message: string | null;
    distributed_at: string | null;
    submittal_distribution_recipients: Array<{
      id: string;
      recipient_id: string;
    }>;
  }>;
  attachments: SubmittalAttachment[];
  submittal_linked_drawings: Array<{
    id: string;
    drawing_id: string;
  }>;
  submittal_history: Array<{
    id: string;
    action: string | null;
    actor_id: string | null;
    new_status: string | null;
    changes: unknown;
    metadata: unknown;
    occurred_at: string | null;
  }>;
  linked_rfis: Array<{
    link_id: string;
    link_type: string;
    note: string | null;
    linked_at: string;
    linked_by: string | null;
    id: string;
    number: number;
    subject: string;
    question: string;
    status: string;
    rfi_stage: string | null;
    date_initiated: string | null;
    due_date: string | null;
    ball_in_court: string | null;
    created_by: string | null;
    created_at: string;
  }>;
}

export type SubmittalAttachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  content_type: string | null;
  is_current: boolean | null;
  uploaded_by: string | null;
  created_at: string | null;
};

export interface LinkedDrawing {
  id: string;
  submittalId: string;
  drawingId: string;
  drawingNumber: string;
  title: string;
  discipline: string | null;
  revision: string | null;
  readiness: {
    state: "ready" | "partial" | "not_ready" | "failed";
    reasons: string[];
    ocrTextReady: boolean;
    visionReady: boolean;
    embeddedReady: boolean;
  };
}

export interface AIReviewResult {
  runId: string;
  projectId: number;
  submittalId: string;
  status: "queued" | "running" | "ready" | "partial" | "not_ready" | "failed";
  focusArea: string | null;
  summary: string | null;
  recommendation: string | null;
  startedAt: string;
  completedAt: string | null;
  readiness: {
    state: "ready" | "partial" | "not_ready" | "failed";
    summary: string;
    layers: Array<{
      key: string;
      label: string;
      state: "ready" | "partial" | "not_ready" | "failed";
      reasons: string[];
      availableCount: number | null;
      totalCount: number | null;
    }>;
  };
  sourceCoverage: {
    submittalDocumentCount: number;
    linkedDrawingCount: number;
    ragChunkCount: number;
    specSourceCount: number;
  };
  linkedDrawings: LinkedDrawing[];
  checks: Array<{
    id?: string;
    checkType: string;
    status:
      | "pass"
      | "fail"
      | "warning"
      | "missing_information"
      | "unable_to_determine"
      | "needs_human_review";
    severity: "critical" | "high" | "medium" | "low" | "informational";
    title: string;
    finding: string;
    expectedValue: string | null;
    submittedValue: string | null;
    recommendation: string | null;
    sourceReferences: Array<{
      sourceKey: string;
      sourceType: string;
      sourceId: string;
      documentMetadataId: string | null;
      drawingId: string | null;
      drawingNumber: string | null;
      pageNumber: number | null;
      chunkIndex: number | null;
      label: string;
      excerpt: string | null;
      confidence: number | null;
    }>;
    confidence: number | null;
    missingData: string[];
    reviewerDisposition: "pending" | "accepted" | "dismissed" | "edited";
    reviewerNotes: string | null;
  }>;
  error: { code: string; message: string } | null;
}

export type AIReviewDisposition = AIReviewResult["checks"][number]["reviewerDisposition"];

export type SubmittalWorkflowResponseStatus =
  | "Approved"
  | "Approved as Noted"
  | "Revise and Resubmit"
  | "Rejected"
  | "Reviewed - No Exception";

export async function uploadSubmittalAttachments(
  projectId: number,
  submittalId: string,
  files: File[],
): Promise<SubmittalAttachment[]> {
  const uploaded: SubmittalAttachment[] = [];

  for (const file of files) {
    const body = new FormData();
    body.append("file", file);

    const attachment = await apiFetch<SubmittalAttachment>(
      `/api/projects/${projectId}/submittals/${submittalId}/attachments`,
      {
        method: "POST",
        body,
      },
    );

    uploaded.push(attachment);
  }

  return uploaded;
}

export interface CreateSubmittalInput {
  title: string;
  submittal_number: string;
  revision?: number;
  status?: "Draft" | "Open" | "Distributed" | "Closed";
  specification_section?: string | null;
  submittal_type?: string | null;
  submittal_type_id?: string | null;
  division?: string | null;
  submittal_package_id?: string | null;
  responsible_contractor_id?: string | null;
  received_from_id?: string | null;
  submittal_manager_id?: string | null;
  final_due_date?: string | null;
  lead_time?: number | null;
  required_on_site_date?: string | null;
  cost_code_id?: number | null;
  location_id?: number | null;
  is_private?: boolean;
  description?: string | null;
  priority?: string | null;
  ball_in_court?: string | null;
  required_approval_date?: string | null;
  submission_date?: string | null;
  initial_workflow_steps?: Array<{
    user_id: string;
    step_type: string;
  }>;
}

export type UpdateSubmittalInput = Partial<CreateSubmittalInput>;

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const submittalKeys = {
  all: (projectId: number) => ["submittals", projectId] as const,
  list: (projectId: number, tab?: string) =>
    ["submittals", projectId, "list", tab] as const,
  detail: (projectId: number, submittalId: string) =>
    ["submittals", projectId, "detail", submittalId] as const,
  linkedDrawings: (projectId: number, submittalId: string) =>
    [
      ...submittalKeys.detail(projectId, submittalId),
      "linked-drawings",
    ] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSubmittals(projectId: number, tab?: string) {
  return useQuery({
    queryKey: submittalKeys.list(projectId, tab),
    queryFn: ({ signal }): Promise<SubmittalSummary[]> => {
      const params = new URLSearchParams();
      if (tab) params.set("tab", tab);
      return apiFetch<SubmittalSummary[]>(
        `/api/projects/${projectId}/submittals?${params.toString()}`,
        { signal },
      );
    },
    enabled: Boolean(projectId),
  });
}

export function useSubmittal(projectId: number, submittalId: string) {
  return useQuery({
    queryKey: submittalKeys.detail(projectId, submittalId),
    queryFn: ({ signal }): Promise<SubmittalDetail> =>
      apiFetch<SubmittalDetail>(
        `/api/projects/${projectId}/submittals/${submittalId}`,
        { signal },
      ),
    enabled: Boolean(projectId) && Boolean(submittalId),
  });
}

export function useCreateSubmittal(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubmittalInput): Promise<SubmittalSummary> =>
      apiFetch<SubmittalSummary>(`/api/projects/${projectId}/submittals`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      toast.success("Submittal created");
    },
    onError: (err: Error) => {
      toast.error("Could not create submittal", { description: err.message });
    },
  });
}

export function useUpdateSubmittal(projectId: number, submittalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSubmittalInput): Promise<SubmittalSummary> =>
      apiFetch<SubmittalSummary>(
        `/api/projects/${projectId}/submittals/${submittalId}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      toast.success("Submittal updated");
    },
    onError: (err: Error) => {
      toast.error("Could not update submittal", { description: err.message });
    },
  });
}

export function useDeleteSubmittal(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submittalId: string): Promise<unknown> =>
      apiFetch(`/api/projects/${projectId}/submittals/${submittalId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      toast.success("Submittal moved to Recycle Bin");
    },
    onError: (err: Error) => {
      toast.error("Could not delete submittal", { description: err.message });
    },
  });
}

export function useRestoreSubmittal(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submittalId: string): Promise<SubmittalSummary> =>
      apiFetch<SubmittalSummary>(
        `/api/projects/${projectId}/submittals/${submittalId}/restore`,
        { method: "PATCH" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      toast.success("Submittal restored");
    },
    onError: (err: Error) => {
      toast.error("Could not restore submittal", { description: err.message });
    },
  });
}

export function useDuplicateSubmittal(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submittalId: string): Promise<SubmittalSummary> =>
      apiFetch<SubmittalSummary>(
        `/api/projects/${projectId}/submittals/${submittalId}/duplicate`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      toast.success("Submittal duplicated");
    },
    onError: (err: Error) => {
      toast.error("Could not duplicate submittal", {
        description: err.message,
      });
    },
  });
}

/**
 * Uploads a file and creates a submittal attachment record.
 */
export function useUploadSubmittalAttachment(
  projectId: number,
  submittalId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File): Promise<SubmittalAttachment> => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<SubmittalAttachment>(
        `/api/projects/${projectId}/submittals/${submittalId}/attachments`,
        {
          method: "POST",
          body: formData,
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: submittalKeys.detail(projectId, submittalId),
      });
      toast.success("Attachment uploaded");
    },
    onError: (err: Error) => {
      toast.error("Could not upload attachment", { description: err.message });
    },
  });
}

export function useAddWorkflowStep(projectId: number, submittalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      user_id: string;
      step_type: string;
    }): Promise<{ id: string; step_order: number; step_type: string }> =>
      apiFetch<{ id: string; step_order: number; step_type: string }>(
        `/api/projects/${projectId}/submittals/${submittalId}/workflow-steps`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      qc.invalidateQueries({
        queryKey: submittalKeys.detail(projectId, submittalId),
      });
      toast.success("Workflow step added");
    },
    onError: (err: Error) => {
      toast.error("Could not add workflow step", { description: err.message });
    },
  });
}

export function useRespondToWorkflowStep(
  projectId: number,
  submittalId: string,
  stepId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      response_status: string;
      comments?: string | null;
    }): Promise<{ id: string; response_status: string }> =>
      apiFetch<{ id: string; response_status: string }>(
        `/api/projects/${projectId}/submittals/${submittalId}/workflow-steps/${stepId}/respond`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      qc.invalidateQueries({
        queryKey: submittalKeys.detail(projectId, submittalId),
      });
      toast.success("Response recorded");
    },
    onError: (err: Error) => {
      toast.error("Could not record response", { description: err.message });
    },
  });
}

// ─── Package types & hooks ────────────────────────────────────────────────────

export interface PackageRow {
  id: string;
  name: string;
  description: string | null;
}

export function usePackages(projectId: number) {
  return useQuery({
    queryKey: ["submittals", projectId, "packages"] as const,
    queryFn: ({ signal }): Promise<PackageRow[]> =>
      apiFetch<PackageRow[]>(`/api/projects/${projectId}/submittals/packages`, {
        signal,
      }),
    enabled: Boolean(projectId),
  });
}

export function useCreatePackage(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string | null;
    }): Promise<PackageRow> =>
      apiFetch<PackageRow>(`/api/projects/${projectId}/submittals/packages`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      qc.invalidateQueries({ queryKey: ["submittals", projectId, "packages"] });
      toast.success("Package created");
    },
    onError: (err: Error) => {
      toast.error("Could not create package", { description: err.message });
    },
  });
}

export function useUpdatePackage(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      description?: string | null;
    }): Promise<PackageRow> =>
      apiFetch<PackageRow>(
        `/api/projects/${projectId}/submittals/packages/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      qc.invalidateQueries({ queryKey: ["submittals", projectId, "packages"] });
      toast.success("Package updated");
    },
    onError: (err: Error) => {
      toast.error("Could not update package", { description: err.message });
    },
  });
}

export function useDeletePackage(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string): Promise<void> =>
      apiFetch(`/api/projects/${projectId}/submittals/packages/${packageId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      qc.invalidateQueries({ queryKey: ["submittals", projectId, "packages"] });
      toast.success("Package deleted");
    },
    onError: (err: Error) => {
      toast.error("Could not delete package", { description: err.message });
    },
  });
}

// ─── Workflow template hooks ──────────────────────────────────────────────────

export interface WorkflowTemplateStep {
  step_type: string;
  required?: boolean;
  user_id?: string | null;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  steps: WorkflowTemplateStep[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useWorkflowTemplates(projectId: number) {
  return useQuery({
    queryKey: ["submittals", projectId, "workflow-templates"] as const,
    queryFn: ({ signal }): Promise<WorkflowTemplate[]> =>
      apiFetch<WorkflowTemplate[]>(
        `/api/projects/${projectId}/submittals/workflow-templates`,
        { signal },
      ),
    enabled: Boolean(projectId),
  });
}

export function useCreateWorkflowTemplate(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string | null;
      steps: WorkflowTemplateStep[];
    }): Promise<WorkflowTemplate> =>
      apiFetch<WorkflowTemplate>(
        `/api/projects/${projectId}/submittals/workflow-templates`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["submittals", projectId, "workflow-templates"],
      });
      toast.success("Template saved");
    },
    onError: (err: Error) => {
      toast.error("Could not save template", { description: err.message });
    },
  });
}

export function useUpdateWorkflowTemplate(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      description?: string | null;
      steps?: WorkflowTemplateStep[];
    }): Promise<WorkflowTemplate> =>
      apiFetch<WorkflowTemplate>(
        `/api/projects/${projectId}/submittals/workflow-templates/${id}`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["submittals", projectId, "workflow-templates"],
      });
      toast.success("Template updated");
    },
    onError: (err: Error) => {
      toast.error("Could not update template", { description: err.message });
    },
  });
}

export function useDeleteWorkflowTemplate(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string): Promise<void> =>
      apiFetch(
        `/api/projects/${projectId}/submittals/workflow-templates/${templateId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["submittals", projectId, "workflow-templates"],
      });
      toast.success("Template deleted");
    },
    onError: (err: Error) => {
      toast.error("Could not delete template", { description: err.message });
    },
  });
}

// ─── Distribution hooks ───────────────────────────────────────────────────────

export function useDistributeSubmittal(projectId: number, submittalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      recipient_ids: string[];
      message?: string | null;
    }): Promise<{ id: string }> =>
      apiFetch<{ id: string }>(
        `/api/projects/${projectId}/submittals/${submittalId}/distribute`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: submittalKeys.detail(projectId, submittalId),
      });
      qc.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      toast.success("Submittal distributed");
    },
    onError: (err: Error) => {
      toast.error("Could not distribute submittal", {
        description: err.message,
      });
    },
  });
}

// ─── Linked Drawings & AI Review hooks ───────────────────────────────────────

export function useSubmittalLinkedDrawings(
  projectId: number,
  submittalId: string,
) {
  return useQuery({
    queryKey: submittalKeys.linkedDrawings(projectId, submittalId),
    queryFn: async (): Promise<LinkedDrawing[]> => {
      const res = await apiFetch<{ linkedDrawings: LinkedDrawing[] }>(
        `/api/projects/${projectId}/submittals/${submittalId}/linked-drawings`,
      );
      return res.linkedDrawings;
    },
    enabled: !!submittalId,
  });
}

export function useAddLinkedDrawing(projectId: number, submittalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ drawingId }: { drawingId: string }) => {
      return apiFetch<
        { linkedDrawing: LinkedDrawing } | { alreadyLinked: true }
      >(
        `/api/projects/${projectId}/submittals/${submittalId}/linked-drawings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drawingId }),
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: submittalKeys.linkedDrawings(projectId, submittalId),
      });
    },
  });
}

export function useRemoveLinkedDrawing(projectId: number, submittalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ drawingId }: { drawingId: string }) => {
      return apiFetch<{ success: true }>(
        `/api/projects/${projectId}/submittals/${submittalId}/linked-drawings/${drawingId}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: submittalKeys.linkedDrawings(projectId, submittalId),
      });
    },
  });
}

/** Auto-fetches the last saved AI review result from the database. */
export function useSubmittalAIReview(projectId: number, submittalId: string) {
  return useQuery({
    queryKey: ["submittal-ai-review", projectId, submittalId],
    queryFn: () =>
      apiFetch<AIReviewResult | null>(
        `/api/projects/${projectId}/submittals/${submittalId}/ai-review`,
      ),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: false,
  });
}

/** Runs a new AI review, saves it to DB, and updates the cached result. */
export function useRunSubmittalAIReview(
  projectId: number,
  submittalId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<AIReviewResult>(
        `/api/projects/${projectId}/submittals/${submittalId}/ai-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["submittal-ai-review", projectId, submittalId],
        data,
      );
      queryClient.invalidateQueries({
        queryKey: ["submittal-ai-review", projectId, submittalId],
      });
      queryClient.invalidateQueries({
        queryKey: submittalKeys.linkedDrawings(projectId, submittalId),
      });
    },
  });
}

/** Persists a reviewer disposition for one normalized AI review check. */
export function useUpdateSubmittalAIReviewCheck(
  projectId: number,
  submittalId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      checkId,
      reviewerDisposition,
      reviewerNotes,
    }: {
      checkId: string;
      reviewerDisposition: AIReviewDisposition;
      reviewerNotes?: string | null;
    }) =>
      apiFetch<AIReviewResult>(
        `/api/projects/${projectId}/submittals/${submittalId}/ai-review/checks/${checkId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewerDisposition,
            reviewerNotes: reviewerNotes ?? null,
          }),
        },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["submittal-ai-review", projectId, submittalId],
        data,
      );
    },
    onError: (err: Error) => {
      toast.error("Could not update AI review finding", {
        description: err.message,
      });
    },
  });
}

/** Records a workflow response using the AI Review result as the decision context. */
export function useRecordSubmittalAIReviewWorkflowResponse(
  projectId: number,
  submittalId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      stepId,
      responseStatus,
      comments,
    }: {
      stepId: string;
      responseStatus: SubmittalWorkflowResponseStatus;
      comments?: string | null;
    }) =>
      apiFetch<{ id: string; response_status: string }>(
        `/api/projects/${projectId}/submittals/${submittalId}/ai-review/workflow-response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepId,
            responseStatus,
            comments: comments ?? null,
          }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: submittalKeys.all(projectId) });
      queryClient.invalidateQueries({
        queryKey: submittalKeys.detail(projectId, submittalId),
      });
      toast.success("Workflow response recorded");
    },
    onError: (err: Error) => {
      toast.error("Could not record workflow response", {
        description: err.message,
      });
    },
  });
}

// ─── Required Submittals (from drawing vision analysis) ────────────────────────

export interface RequiredSubmittalItem {
  drawingId: string;
  drawingNumber: string;
  drawingTitle: string;
  discipline: string | null;
  impliedSubmittal: string;
  existingSubmittal: {
    id: string;
    number: string;
    title: string;
    status: string | null;
  } | null;
}

export interface RequiredSubmittalsResponse {
  items: RequiredSubmittalItem[];
  summary: { totalImplied: number; covered: number; missing: number };
}

/** Fetches submittals implied by drawing vision analysis, cross-referenced against existing submittals. */
export function useRequiredSubmittals(projectId: number) {
  return useQuery({
    queryKey: ["required-submittals", projectId],
    queryFn: () =>
      apiFetch<RequiredSubmittalsResponse>(
        `/api/projects/${projectId}/submittals/required`,
      ),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });
}
