"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CircleDot,
  Clock3,
  Copy,
  Eye,
  ArrowRight,
  Mail,
  MoreVertical,
  Pencil,
  Trash2,
  UserCircle2,
  Users,
} from "lucide-react";

import {
  ContentSectionStack,
  DetailLayout,
  DetailPanel,
  PageShell,
  PageTabs,
  SectionAction,
  SectionRuleHeading,
  SummaryPanel,
  SummaryValueRow,
} from "@/components/layout";
import {
  DetailField,
  EditableDetailField,
  EmptyState,
  EntityAttachments,
  InlineEditField,
  StatusBadge,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  DetailPropertyBar,
  DetailPropertyItem,
} from "@/components/ui/detail-property-bar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUsers, type AuthUser } from "@/hooks/use-auth-users";
import { useProjectCompanies } from "@/hooks/use-project-companies";
import { useCompanyContacts } from "@/hooks/use-company-contacts";
import { createClient } from "@/lib/supabase/client";
import {
  useAddLinkedDrawing,
  useAddWorkflowStep,
  useCreateWorkflowTemplate,
  useDeleteSubmittal,
  useDuplicateSubmittal,
  useRespondToWorkflowStep,
  useSubmittalLinkedDrawings,
  useWorkflowTemplates,
  submittalKeys,
  type SubmittalDetail,
  type WorkflowTemplateStep,
} from "@/hooks/use-submittals";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { appToast as toast } from "@/lib/toast/app-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import { SubmittalDistributeDialog } from "./submittal-distribute-dialog";
import { SubmittalAIReviewPanel } from "./submittal-ai-review-panel";
import { SubmittalExportPopover } from "./submittal-export-popover";
import { parseAIReviewResponseComment } from "@/lib/submittals/ai-review/response-comment";
import {
  normalizeSubmittalDetailTab,
  type SubmittalDetailTab,
} from "@/lib/submittals/detail-tabs";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESPONSE_STATUSES = [
  "Approved",
  "Approved as Noted",
  "Revise and Resubmit",
  "Rejected",
  "Reviewed - No Exception",
] as const;

const STEP_TYPES = ["Submitter", "Approver", "Reviewer"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveUserName(users: AuthUser[], id: string): string {
  // Match by auth_user_id OR people.id (submittal fields store people.id)
  const u = users.find((u) => u.id === id || u.person_id === id);
  if (!u) return "";
  const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return name || u.email;
}

function userMatchesResponder({
  authUserId,
  personId,
  responderId,
}: {
  authUserId: string | null;
  personId: string | null;
  responderId: string;
}): boolean {
  if (!authUserId) return false;
  return responderId === authUserId || Boolean(personId && responderId === personId);
}

function AIReviewResponseSummary({ comment }: { comment: string }) {
  const parsed = parseAIReviewResponseComment(comment);

  if (!parsed) {
    return <p className="text-sm leading-relaxed text-foreground">{comment}</p>;
  }

  return (
    <div className="space-y-2">
      {parsed.summary && (
        <p className="text-sm leading-relaxed text-foreground">
          {parsed.summary}
        </p>
      )}
      {parsed.recommendation && (
        <p className="text-sm font-medium leading-relaxed text-foreground">
          {parsed.recommendation}
        </p>
      )}
      {parsed.findings.length > 0 && (
        <ul className="space-y-1 text-sm leading-relaxed text-muted-foreground">
          {parsed.findings.map((finding) => (
            <li key={finding} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{finding}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

type StepState = "done" | "in-progress" | "rejected" | "not-started";
type WorkflowResponseSource = "ai_review" | "workflow";

function getStepState(
  step: SubmittalDetail["submittal_workflow_steps"][number],
): StepState {
  const responses = step.submittal_responses ?? [];
  if (responses.length === 0) return "not-started";
  const hasRejected = responses.some(
    (r) =>
      r.response_status === "Rejected" ||
      r.response_status === "Revise and Resubmit",
  );
  if (hasRejected) return "rejected";
  const hasPending = responses.some((r) => r.response_status === "Pending");
  if (hasPending) return "in-progress";
  return "done";
}

/**
 * A step can only be actionable once every earlier step is done — workflow
 * steps get a Pending response row as soon as they're added (see
 * workflow-steps#POST), so an approver's own state is "in-progress" the
 * moment they're added even if a submitter/reviewer ahead of them hasn't
 * responded yet. This folds in step order so only the current step shows
 * as active; later steps are forced back to "not-started" (greyed out)
 * until their turn.
 */
function getEffectiveStepState(
  steps: SubmittalDetail["submittal_workflow_steps"],
  index: number,
): StepState {
  const ownState = getStepState(steps[index]);
  if (ownState !== "in-progress") return ownState;
  const priorStepsDone = steps
    .slice(0, index)
    .every((step) => getStepState(step) === "done");
  return priorStepsDone ? "in-progress" : "not-started";
}

function getHistoryRecordMetadata(
  metadata: unknown,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  return metadata as Record<string, unknown>;
}

type WorkflowStep = SubmittalDetail["submittal_workflow_steps"][number];

// ─── Respond form ─────────────────────────────────────────────────────────────

interface RespondFormProps {
  projectId: number;
  submittalId: string;
  stepId: string;
  onDone: (didSubmit?: boolean) => void;
}

function RespondForm({
  projectId,
  submittalId,
  stepId,
  onDone,
}: RespondFormProps) {
  const [status, setStatus] = React.useState<string>("");
  const [comments, setComments] = React.useState("");
  const mutation = useRespondToWorkflowStep(projectId, submittalId, stepId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return;
    await mutation.mutateAsync({
      response_status: status,
      comments: comments || null,
    });
    onDone(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-muted/50 p-5 space-y-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        Your Response
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Decision</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select response…" />
            </SelectTrigger>
            <SelectContent>
              {RESPONSE_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Comments (optional)</Label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
            className="text-xs resize-none"
            placeholder="Add a note…"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!status || mutation.isPending}
        >
          Submit Response
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDone(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Workflow Builder ─────────────────────────────────────────────────────────

interface WorkflowBuilderProps {
  projectId: number;
  submittalId: string;
  users: AuthUser[];
  currentSteps: {
    step_type: string;
    submittal_responses?: Array<{ responder_id: string; response_status: string }>;
  }[];
}

function WorkflowBuilder({
  projectId,
  submittalId,
  users,
  currentSteps,
}: WorkflowBuilderProps) {
  const router = useRouter();
  const [userId, setUserId] = React.useState("");
  // The first step in a workflow is the submitter; every step after that
  // defaults to an approver.
  const [stepType, setStepType] = React.useState<string>(
    currentSteps.length === 0 ? "Submitter" : "Approver",
  );
  const [templateName, setTemplateName] = React.useState("");
  const [savingTemplate, setSavingTemplate] = React.useState(false);
  const mutation = useAddWorkflowStep(projectId, submittalId);
  const { data: templates = [] } = useWorkflowTemplates(projectId);
  const createTemplate = useCreateWorkflowTemplate(projectId);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    await mutation.mutateAsync({ user_id: userId, step_type: stepType });
    setUserId("");
    setStepType("Approver");
    router.refresh();
  }

  async function handleApplyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const assignableSteps = tpl.steps.filter((s) => s.user_id);
    if (assignableSteps.length === 0) return;
    for (const step of assignableSteps) {
      await mutation.mutateAsync({
        user_id: step.user_id ?? "",
        step_type: step.step_type,
      });
    }
    router.refresh();
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!templateName.trim() || currentSteps.length === 0) return;
    const steps: WorkflowTemplateStep[] = currentSteps.map((s) => {
      const assignedUserId =
        s.submittal_responses?.[0]?.responder_id ?? null;
      return {
        step_type: s.step_type,
        user_id: assignedUserId,
      };
    });

    const stepsWithUsers = steps.filter((s) => s.user_id !== null);
    if (stepsWithUsers.length === 0) {
      toast.error("Cannot save template", {
        description:
          "No workflow steps have an assigned user. Add at least one step with a user before saving a template.",
      });
      return;
    }

    await createTemplate.mutateAsync({ name: templateName.trim(), steps });
    setTemplateName("");
    setSavingTemplate(false);
  }

  return (
    <div className="space-y-4 pt-2">
      {templates.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Apply Template
          </p>
          <Select onValueChange={handleApplyTemplate}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select a template to apply…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.name}
                  {t.description ? ` — ${t.description}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Add Workflow Step
        </p>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">User</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {resolveUserName(users, u.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Step Type</Label>
              <Select value={stepType} onValueChange={setStepType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!userId || mutation.isPending}
            >
              Add Step
            </Button>
            {currentSteps.length > 0 && !savingTemplate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSavingTemplate(true)}
              >
                Save as Template
              </Button>
            )}
          </div>
        </form>

        {savingTemplate && (
          <form
            onSubmit={handleSaveTemplate}
            className="mt-4 flex gap-2 items-end"
          >
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Template Name</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g. Standard Approval"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!templateName.trim() || createTemplate.isPending}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSavingTemplate(false);
                setTemplateName("");
              }}
            >
              Cancel
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function getSubmittalTypeName(submittal: SubmittalDetail): string | null {
  if (typeof submittal.submittal_type === "object") {
    return submittal.submittal_type?.name ?? null;
  }
  return submittal.submittal_type ?? null;
}

function getPackageName(submittal: SubmittalDetail): string | null {
  if (typeof submittal.submittal_package === "object") {
    return submittal.submittal_package?.name ?? null;
  }
  return submittal.submittal_package ?? null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubmittalDetailClientProps {
  submittal: SubmittalDetail;
  projectId: number;
  projectName: string | null;
}

interface DetailDrawingOption {
  id: string;
  drawing_number: string;
  title: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubmittalDetailClient({
  submittal,
  projectId,
  projectName,
}: SubmittalDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { confirm, ConfirmDialog } = useConfirm();
  const addLinkedDrawingMutation = useAddLinkedDrawing(projectId, submittal.id);
  const deleteMutation = useDeleteSubmittal(projectId);
  const duplicateMutation = useDuplicateSubmittal(projectId);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [distributeOpen, setDistributeOpen] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const { profile: currentUserProfile } = useCurrentUserProfile();

  const { users, allUsers } = useAuthUsers(String(projectId));
  const { companies } = useProjectCompanies(String(projectId), { per_page: 200 });
  const { contacts: contractorContacts } = useCompanyContacts({
    companyId: submittal.responsible_contractor_id ?? undefined,
    enabled: Boolean(submittal.responsible_contractor_id),
  });

  // Company options for the Contractor select. companies dropdown returns
  // companies.id which is exactly what responsible_contractor_id (FK → companies.id)
  // expects — no resolution needed. Inject the saved contractor so it pre-fills
  // even if it isn't in the project-companies page.
  const companyOptions = React.useMemo(() => {
    const opts = companies
      .filter((c) => c.company_id)
      .map((c) => ({ value: c.company_id, label: c.company?.name ?? c.company_id }));
    const saved = submittal.responsible_contractor;
    if (saved?.id && !opts.some((o) => o.value === saved.id)) {
      opts.unshift({ value: saved.id, label: saved.name });
    }
    return [{ value: "", label: "None" }, ...opts];
  }, [companies, submittal.responsible_contractor]);

  // Contact options for the Submitted By select, scoped to the selected
  // contractor. Inject the saved contact (received_from name) so it pre-fills.
  const receivedFromOptions = React.useMemo(() => {
    const opts = contractorContacts
      .filter((c) => c.id)
      .map((c) => ({
        value: c.id,
        label: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || c.id,
      }));
    const savedId = submittal.received_from_id;
    if (savedId && !opts.some((o) => o.value === savedId)) {
      opts.unshift({ value: savedId, label: submittal.received_from ?? savedId });
    }
    return [{ value: "", label: "None" }, ...opts];
  }, [contractorContacts, submittal.received_from_id, submittal.received_from]);
  const { data: submittalTypes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["submittal-types", projectId],
    queryFn: ({ signal }) => apiFetch(`/api/projects/${projectId}/submittal-types`, { signal }),
  });
  const { data: submittalPackages = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["submittal-packages", projectId],
    queryFn: () => apiFetch(`/api/projects/${projectId}/submittals/packages`),
  });
  const { data: linkedDrawings = [] } = useSubmittalLinkedDrawings(
    projectId,
    submittal.id,
  );
  const { data: drawingOptions = [], isLoading: isDrawingOptionsLoading } =
    useQuery<DetailDrawingOption[]>({
      queryKey: ["submittal-drawing-options", projectId],
      queryFn: async () => {
        const params = new URLSearchParams({ page_size: "100" });
        const response = await apiFetch<{ drawings?: DetailDrawingOption[] }>(
          `/api/projects/${projectId}/drawings?${params.toString()}`,
        );
        return response.drawings ?? [];
      },
      staleTime: 1000 * 60 * 5,
    });

  async function handleSaveField(field: string, value: string | number | boolean | null) {
    await apiFetch(`/api/projects/${projectId}/submittals/${submittal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    await queryClient.invalidateQueries({
      queryKey: submittalKeys.detail(projectId, submittal.id),
    });
    router.refresh();
  }

  const tabFromUrl = normalizeSubmittalDetailTab(
    searchParams?.get("tab") ?? searchParams?.get("view") ?? null,
  );
  const [activeTab, setActiveTab] =
    React.useState<SubmittalDetailTab>(tabFromUrl);
  const [showAddStep, setShowAddStep] = React.useState(false);

  const workflowSteps = submittal.submittal_workflow_steps ?? [];
  const distributions = submittal.submittal_distributions ?? [];
  const history = submittal.submittal_history ?? [];
  const linkedRfis = submittal.linked_rfis ?? [];
  const linkedDrawingIds = new Set(
    linkedDrawings.map((drawing) => drawing.drawingId),
  );
  const currentUser = allUsers.find((user) => user.id === currentUserId) ?? null;
  const currentUserPersonId =
    currentUser?.person_id ?? currentUserProfile?.personId ?? null;
  const aiReviewWorkflowResponseStep = workflowSteps.find((step, index) => {
    const isActive = getEffectiveStepState(workflowSteps, index) === "in-progress";
    return (
      isActive &&
      currentUserId &&
      step.submittal_responses?.some(
        (response) =>
          userMatchesResponder({
            authUserId: currentUserId,
            personId: currentUserPersonId,
            responderId: response.responder_id,
          }) &&
          response.response_status === "Pending",
      )
    );
  });

  React.useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  function handleTabChange(tab: string) {
    const nextTab = normalizeSubmittalDetailTab(tab);
    setActiveTab(nextTab);

    const nextParams = new URLSearchParams(
      typeof window === "undefined"
        ? (searchParams?.toString() ?? "")
        : window.location.search,
    );
    if (nextTab === "details") {
      nextParams.delete("tab");
      nextParams.delete("view");
    } else {
      nextParams.set("tab", nextTab);
      nextParams.delete("view");
    }

    const query = nextParams.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
  }

  React.useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      isMounted = false;
    };
  }, [supabase.auth]);

  async function handleDelete() {
    const ok = await confirm({
      title: "Move to Recycle Bin?",
      description: "This submittal will be moved to the Recycle Bin. You can restore it later.",
      confirmLabel: "Move to Bin",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(submittal.id);
    router.push(`/${projectId}/submittals`);
  }

  async function handleDuplicate() {
    const newRecord = await duplicateMutation.mutateAsync(submittal.id);
    router.push(`/${projectId}/submittals/${newRecord.id}`);
  }

  async function handleLinkDrawing(drawing: DetailDrawingOption) {
    try {
      const result = await addLinkedDrawingMutation.mutateAsync({
        drawingId: drawing.id,
      });
      if ("alreadyLinked" in result && result.alreadyLinked) {
        toast.info(`${drawing.drawing_number} is already linked`);
      } else {
        toast.success(`${drawing.drawing_number} linked`);
      }
    } catch {
      toast.error("Failed to link drawing");
    }
  }

  // Build unified comms feed
  const responseHistorySources = new Map<string, WorkflowResponseSource>();
  for (const item of history) {
    if (item.action !== "workflow_response_recorded") continue;
    const metadata = getHistoryRecordMetadata(item.metadata);
    const responseId = metadata?.response_id;
    const source = metadata?.source;
    if (
      typeof responseId === "string" &&
      (source === "ai_review" || source === "workflow")
    ) {
      responseHistorySources.set(responseId, source);
    }
  }

  type CommEvent =
    | { kind: "rfi"; date: string; rfi: (typeof linkedRfis)[number] }
    | {
        kind: "response";
        date: string;
        stepType: string;
        responder: string;
        status: string;
        comment: string | null;
        source: WorkflowResponseSource | null;
      }
    | { kind: "distribution"; date: string; fromId: string; recipientCount: number; message: string | null };

  const commEvents: CommEvent[] = [
    ...linkedRfis.map((rfi) => ({
      kind: "rfi" as const,
      date: rfi.date_initiated ?? rfi.created_at,
      rfi,
    })),
    ...workflowSteps.flatMap((step) =>
      (step.submittal_responses ?? [])
        .filter((r) => r.responded_at || r.response_status !== "Pending")
        .map((r) => ({
          kind: "response" as const,
          date: r.responded_at ?? "",
          stepType: step.step_type,
          responder: r.responder_id,
          status: r.response_status,
          comment: r.comments,
          source:
            responseHistorySources.get(r.id) ??
            (parseAIReviewResponseComment(r.comments) ? "ai_review" : null),
        })),
    ),
    ...distributions.map((d) => ({
      kind: "distribution" as const,
      date: d.distributed_at ?? "",
      fromId: d.from_id,
      recipientCount: d.submittal_distribution_recipients?.length ?? 0,
      message: d.message,
    })),
  ]
    .filter((e) => !!e.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const eyebrow = projectName ?? undefined;

  const numberPrefix = submittal.submittal_number
    ? `${String(submittal.submittal_number).padStart(2, "0")}: `
    : "";
  const pageTitle = `${numberPrefix}${submittal.title}`;
  const responsibleContractorLabel =
    submittal.responsible_contractor?.name ??
    companyOptions.find((option) => option.value === submittal.responsible_contractor_id)?.label ??
    (submittal.responsible_contractor_id ? "Unknown contractor" : null);
  const submittedByLabel =
    submittal.received_from ??
    receivedFromOptions.find((option) => option.value === submittal.received_from_id)?.label ??
    (submittal.received_from_id ? "Unknown contact" : null);
  const managerLabel = submittal.submittal_manager_id
    ? resolveUserName(allUsers, submittal.submittal_manager_id) || "Unknown manager"
    : null;
  const ballInCourtLabel = submittal.ball_in_court
    ? resolveUserName(allUsers, submittal.ball_in_court) || "Unknown assignee"
    : null;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {ConfirmDialog}
      <SubmittalDistributeDialog
        projectId={projectId}
        submittalId={submittal.id}
        open={distributeOpen}
        onOpenChange={setDistributeOpen}
      />
      <PageShell
        variant="detail"
        eyebrow={eyebrow}
        title={pageTitle}
        onBack={() => router.push(`/${projectId}/submittals`)}
        actions={
          <div className="flex items-center gap-2">
            <SubmittalExportPopover
              projectId={projectId}
              submittalId={submittal.id}
              submittalNumber={submittal.submittal_number}
              submittalTitle={submittal.title}
              attachments={submittal.attachments}
            />
            {!submittal.deleted_at && (
              <Button
                variant={isEditMode ? "default" : "outline"}
                size="sm"
                aria-label={isEditMode ? "Switch to view mode" : "Switch to edit mode"}
                onClick={() => setIsEditMode((v) => !v)}
              >
                {isEditMode ? (
                  <>
                    <Eye className="h-4 w-4" />
                    View
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </>
                )}
              </Button>
            )}
            {submittal.status !== "Closed" && !submittal.deleted_at && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Email submittal"
                onClick={() => setDistributeOpen(true)}
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleDuplicate}
                  disabled={duplicateMutation.isPending}
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      >
        <div>
            <PageTabs
              variant="inline"
              tabs={[
                { label: "Details", href: "details", isActive: activeTab === "details" },
                { label: "AI Review", href: "ai-review", isActive: activeTab === "ai-review" },
              ]}
              onTabClick={handleTabChange}
            />

            <DetailPropertyBar className="mb-0 pb-0 pt-6">
              <DetailPropertyItem icon={CircleDot}>
                {submittal.status}
              </DetailPropertyItem>
              <DetailPropertyItem
                icon={Building2}
                muted={!submittal.responsible_contractor_id}
                title={responsibleContractorLabel ?? undefined}
              >
                <InlineEditField
                  label="Responsible contractor"
                  type="select"
                  value={submittal.responsible_contractor_id ?? ""}
                  display={responsibleContractorLabel ?? undefined}
                  emptyLabel="Assign contractor"
                  options={companyOptions}
                  onSave={(value) =>
                    handleSaveField("responsible_contractor_id", value || null)
                  }
                  disabled={!isEditMode}
                  className="min-w-44"
                />
              </DetailPropertyItem>
              <DetailPropertyItem
                icon={UserCircle2}
                muted={!submittal.received_from_id}
                title={submittedByLabel ?? undefined}
              >
                <InlineEditField
                  label="Submitted by"
                  type="select"
                  value={submittal.received_from_id ?? ""}
                  display={submittedByLabel ?? undefined}
                  emptyLabel={
                    submittal.responsible_contractor_id
                      ? "Assign submitter"
                      : "Select contractor first"
                  }
                  options={receivedFromOptions}
                  onSave={(value) =>
                    handleSaveField("received_from_id", value || null)
                  }
                  disabled={!isEditMode}
                  className="min-w-44"
                />
              </DetailPropertyItem>
              <DetailPropertyItem
                icon={Users}
                muted={!submittal.submittal_manager_id}
                title={managerLabel ?? undefined}
              >
                <InlineEditField
                  label="Manager"
                  type="select"
                  value={submittal.submittal_manager_id ?? ""}
                  display={managerLabel ?? undefined}
                  emptyLabel="Assign manager"
                  options={[
                    { value: "", label: "None" },
                    ...users.map((user) => ({
                      value: user.id,
                      label:
                        `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
                        user.email,
                    })),
                  ]}
                  onSave={(value) =>
                    handleSaveField("submittal_manager_id", value || null)
                  }
                  disabled={!isEditMode}
                  className="min-w-40"
                />
              </DetailPropertyItem>
              <DetailPropertyItem
                icon={Users}
                muted={!submittal.ball_in_court}
                title={ballInCourtLabel ?? undefined}
              >
                <InlineEditField
                  label="Ball in court"
                  type="select"
                  value={submittal.ball_in_court ?? ""}
                  display={ballInCourtLabel ?? undefined}
                  emptyLabel="Assign owner"
                  options={[
                    { value: "", label: "None" },
                    ...users.map((user) => ({
                      value: user.id,
                      label:
                        `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
                        user.email,
                    })),
                  ]}
                  onSave={(value) => handleSaveField("ball_in_court", value || null)}
                  disabled={!isEditMode}
                  className="min-w-40"
                />
              </DetailPropertyItem>
              <DetailPropertyItem icon={CalendarDays} muted={!submittal.sent_date}>
                <InlineEditField
                  label="Issue date"
                  type="date"
                  value={submittal.sent_date ?? ""}
                  display={submittal.sent_date ? formatDate(submittal.sent_date) : undefined}
                  emptyLabel="Set issue date"
                  onSave={(value) => handleSaveField("sent_date", value || null)}
                  disabled={!isEditMode}
                  className="min-w-36"
                />
              </DetailPropertyItem>
              <DetailPropertyItem icon={CalendarDays} muted={!submittal.final_due_date}>
                <InlineEditField
                  label="Final due date"
                  type="date"
                  value={submittal.final_due_date ?? ""}
                  display={
                    submittal.final_due_date
                      ? formatDate(submittal.final_due_date)
                      : undefined
                  }
                  emptyLabel="Set final due date"
                  onSave={(value) =>
                    handleSaveField("final_due_date", value || null)
                  }
                  disabled={!isEditMode}
                  className="min-w-36"
                />
              </DetailPropertyItem>
              <DetailPropertyItem
                icon={CalendarDays}
                muted={!submittal.required_on_site_date}
              >
                <InlineEditField
                  label="Required on site date"
                  type="date"
                  value={submittal.required_on_site_date ?? ""}
                  display={
                    submittal.required_on_site_date
                      ? formatDate(submittal.required_on_site_date)
                      : undefined
                  }
                  emptyLabel="Set required on site date"
                  onSave={(value) =>
                    handleSaveField("required_on_site_date", value || null)
                  }
                  disabled={!isEditMode}
                  className="min-w-36"
                />
              </DetailPropertyItem>
              <DetailPropertyItem icon={Clock3} muted={submittal.lead_time == null}>
                <InlineEditField
                  label="Lead time"
                  type="number"
                  value={submittal.lead_time != null ? String(submittal.lead_time) : ""}
                  display={
                    submittal.lead_time != null
                      ? `${submittal.lead_time} day${submittal.lead_time === 1 ? "" : "s"}`
                      : undefined
                  }
                  emptyLabel="Set lead time"
                  onSave={(value) =>
                    handleSaveField("lead_time", value ? parseInt(value, 10) : null)
                  }
                  disabled={!isEditMode}
                  className="min-w-28"
                />
              </DetailPropertyItem>
            </DetailPropertyBar>

            {activeTab === "details" && (
          <ContentSectionStack className="pt-6">
            <DetailLayout
              sidebarAt="lg"
              sidebar={
                workflowSteps.length > 0 ? (() => {
                  const completed = workflowSteps.filter(
                    (step) => getStepState(step) === "done",
                  ).length;
                  return (
                    <SummaryPanel>
                      <SectionRuleHeading label="Workflow Progress" />
                      <div className="space-y-3 text-sm">
                        {workflowSteps.map((step, index) => {
                          const state = getEffectiveStepState(workflowSteps, index);
                          return (
                            <SummaryValueRow
                              key={step.id}
                              label={`${index + 1}. ${step.step_type} Review`}
                              value={
                                state === "done"
                                  ? "Done"
                                  : state === "in-progress"
                                    ? "Active"
                                    : state === "rejected"
                                      ? "Rejected"
                                      : "Waiting"
                              }
                            />
                          );
                        })}
                        <SummaryValueRow
                          label="Total"
                          value={`${completed} of ${workflowSteps.length} complete`}
                          bold
                          border
                        />
                      </div>
                    </SummaryPanel>
                  );
                })() : undefined
              }
              footer={
                <DetailPanel>
                  <SectionRuleHeading
                    label="Workflow"
                    actions={
                      <SectionAction
                        onClick={() => setShowAddStep((s) => !s)}
                        disabled={!isEditMode}
                      >
                        {showAddStep ? "Cancel" : "+ Add Step"}
                      </SectionAction>
                    }
                  />
                  {workflowSteps.length > 0 ? (
                    <div className="mt-1 overflow-hidden rounded-md border border-border">
                      {workflowSteps.map((step, idx) => {
                        const state = getEffectiveStepState(workflowSteps, idx);
                        const responder = step.submittal_responses?.[0]?.responder_id;
                        const responderName = responder ? resolveUserName(allUsers, responder) : null;
                        const isActive = state === "in-progress";
                        const canRespond = isActive && currentUserId && step.submittal_responses?.some(r => userMatchesResponder({
                          authUserId: currentUserId,
                          personId: currentUserPersonId,
                          responderId: r.responder_id,
                        }) && r.response_status === "Pending");
                        const stepResponseEntry = step.submittal_responses?.find(r => userMatchesResponder({
                          authUserId: currentUserId,
                          personId: currentUserPersonId,
                          responderId: r.responder_id,
                        }) && r.response_status === "Pending");
                        return (
                          <div key={step.id} className="border-b border-border last:border-b-0">
                            <div className={cn(
                              "flex items-center gap-4 px-4 py-3",
                              isActive && "bg-muted/40",
                            )}>
                              <div className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                state === "done" ? "bg-primary text-primary-foreground" :
                                state === "in-progress" ? "bg-primary/15 text-primary" :
                                state === "rejected" ? "bg-destructive/15 text-destructive" :
                                "bg-muted text-muted-foreground",
                              )}>
                                {state === "done" ? "✓" : idx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{step.step_type} Review</p>
                                {responderName && (
                                  <p className="text-xs text-muted-foreground">{responderName}</p>
                                )}
                              </div>
                              <StatusBadge status={
                                state === "done" ? "Completed" :
                                state === "in-progress" ? "In Progress" :
                                state === "rejected" ? "Rejected" : "Pending"
                              } />
                            </div>
                            {canRespond && stepResponseEntry && (
                              <div className="border-t border-border px-4 pb-4 pt-3">
                                <RespondForm
                                  projectId={projectId}
                                  submittalId={submittal.id}
                                  stepId={step.id}
                                  onDone={(didSubmit) => {
                                    if (didSubmit) router.refresh();
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !showAddStep && (
                      <EmptyState
                        icon={<Users />}
                        title="No workflow steps"
                        description="Add steps to define the review process."
                      />
                    )
                  )}
                  {showAddStep && (
                    <div className="mt-4" id="workflow-builder">
                      <WorkflowBuilder
                        projectId={projectId}
                        submittalId={submittal.id}
                        users={users}
                        currentSteps={workflowSteps}
                      />
                    </div>
                  )}
                  <div className="mt-6 border-t border-border pt-6">
                    <SectionRuleHeading label="Attachments" />
                    <EntityAttachments
                      entityType="submittal"
                      entityId={String(submittal.id)}
                      projectId={projectId}
                      showLabel={false}
                      displayMode="table"
                    />
                  </div>
                </DetailPanel>
              }
            >

                  {/* General Information */}
                  <DetailPanel>
                    <SectionRuleHeading label="General Information" />
                    <div className="space-y-6">
                      <EditableDetailField
                        label="Number"
                        value={submittal.submittal_number ?? ""}
                        onSave={(v) => handleSaveField("submittal_number", v)}
                        disabled={!isEditMode}
                      />
                      <EditableDetailField
                        label="Spec Section"
                        value={submittal.specification_section ?? ""}
                        emptyPlaceholder="e.g. 08-1113"
                        onSave={(v) => handleSaveField("specification_section", v || null)}
                        disabled={!isEditMode}
                      />
                      <EditableDetailField
                        label="Package"
                        type="select"
                        value={submittal.submittal_package?.id ?? ""}
                        display={getPackageName(submittal) ?? undefined}
                        emptyPlaceholder="Select package"
                        options={[
                          { value: "", label: "None" },
                          ...submittalPackages.map((p) => ({ value: p.id, label: p.name })),
                        ]}
                        onSave={(v) => handleSaveField("submittal_package_id", v || null)}
                        disabled={!isEditMode}
                      />
                      <EditableDetailField
                        label="Revision"
                        type="number"
                        value={submittal.revision != null ? String(submittal.revision) : ""}
                        display={submittal.revision != null ? `Rev ${submittal.revision}` : undefined}
                        onSave={(v) => handleSaveField("revision", v ? parseInt(v, 10) : 0)}
                        disabled={!isEditMode}
                      />
                      <DetailField label="Linked Drawings">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="link"
                              disabled={!isEditMode}
                              className="h-auto px-0 text-sm text-primary decoration-primary/30 underline-offset-2 hover:decoration-primary"
                            >
                              Drawing
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-80">
                            {drawingOptions.length > 0 ? (
                              drawingOptions.map((drawing) => {
                                const isLinked = linkedDrawingIds.has(drawing.id);
                                return (
                                  <DropdownMenuItem
                                    key={drawing.id}
                                    disabled={
                                      isLinked || addLinkedDrawingMutation.isPending
                                    }
                                    onClick={() => handleLinkDrawing(drawing)}
                                    className="flex items-center justify-between gap-4"
                                  >
                                    <span className="truncate">
                                      {drawing.drawing_number} - {drawing.title}
                                    </span>
                                    {isLinked ? (
                                      <span className="shrink-0 text-xs text-muted-foreground">
                                        Linked
                                      </span>
                                    ) : null}
                                  </DropdownMenuItem>
                                );
                              })
                            ) : (
                              <DropdownMenuItem disabled>
                                {isDrawingOptionsLoading
                                  ? "Loading drawings..."
                                  : "No drawings available"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </DetailField>
                      <EditableDetailField
                        label="Description"
                        type="textarea"
                        value={submittal.description ?? ""}
                        emptyPlaceholder="Add a description"
                        onSave={(v) => handleSaveField("description", v || null)}
                        disabled={!isEditMode}
                      />
                    </div>
                  </DetailPanel>

                  {/* Activity */}
                  <section>
                    <SectionRuleHeading label="Activity" />
                    <div className="mt-4">
                      {commEvents.length > 0 ? (
                        <ol className="space-y-0">
                          {commEvents.map((event, i) => {
                            const isLast = i === commEvents.length - 1;

                            if (event.kind === "response") {
                              const name = resolveUserName(allUsers, event.responder);
                              const initials = getInitials(name);
                              return (
                                <li key={`resp-${i}`} className="relative flex gap-5">
                                  <div className="relative flex w-6 shrink-0 flex-col items-center">
                                    <span className="relative z-10 mt-1 flex h-2.5 w-2.5 rounded-full bg-border ring-2 ring-background" />
                                    {!isLast && <span className="absolute top-3.5 bottom-0 w-px bg-border" />}
                                  </div>
                                  <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-6")}>
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-center gap-2">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                                          {initials}
                                        </span>
                                        <div>
                                          <p className="text-sm font-medium text-foreground leading-tight">{name}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {event.source === "ai_review"
                                              ? `${event.stepType} via AI Review`
                                              : event.stepType}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(event.date)}</span>
                                    </div>
                                    {event.comment ? (
                                      <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                                        <p className="mb-1 text-xs font-semibold text-muted-foreground">{event.status}</p>
                                        <AIReviewResponseSummary comment={event.comment} />
                                      </div>
                                    ) : (
                                      <p className="mt-2 text-sm text-muted-foreground">
                                        responded <span className="font-medium text-foreground">{event.status}</span>
                                      </p>
                                    )}
                                  </div>
                                </li>
                              );
                            }

                            if (event.kind === "distribution") {
                              const name = resolveUserName(allUsers, event.fromId);
                              const initials = getInitials(name);
                              return (
                                <li key={`dist-${i}`} className="relative flex gap-5">
                                  <div className="relative flex w-6 shrink-0 flex-col items-center">
                                    <span className="relative z-10 mt-1 flex h-2.5 w-2.5 rounded-full bg-border ring-2 ring-background" />
                                    {!isLast && <span className="absolute top-3.5 bottom-0 w-px bg-border" />}
                                  </div>
                                  <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-6")}>
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-center gap-2">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                                          {initials}
                                        </span>
                                        <p className="text-sm font-medium text-foreground">{name}</p>
                                      </div>
                                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(event.date)}</span>
                                    </div>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                      distributed to{" "}
                                      <span className="font-medium text-foreground">
                                        {event.recipientCount} recipient{event.recipientCount !== 1 ? "s" : ""}
                                      </span>
                                    </p>
                                    {event.message && (
                                      <div className="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                                        <p className="text-sm text-muted-foreground italic">{event.message}</p>
                                      </div>
                                    )}
                                  </div>
                                </li>
                              );
                            }

                            if (event.kind === "rfi") {
                              const rfi = event.rfi;
                              return (
                                <li key={`rfi-${rfi.link_id}`} className="relative flex gap-5">
                                  <div className="relative flex w-6 shrink-0 flex-col items-center">
                                    <span className="relative z-10 mt-1 flex h-2.5 w-2.5 rounded-full bg-border ring-2 ring-background" />
                                    {!isLast && <span className="absolute top-3.5 bottom-0 w-px bg-border" />}
                                  </div>
                                  <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-6")}>
                                    <div className="flex items-start justify-between gap-4">
                                      <p className="text-sm font-medium text-foreground">{rfi.subject}</p>
                                      <div className="flex shrink-0 items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{formatDate(event.date)}</span>
                                        <Link href={`/${projectId}/rfis/${rfi.id}`} className="text-xs text-muted-foreground hover:text-foreground">
                                          <ArrowRight className="h-3 w-3" />
                                        </Link>
                                      </div>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">RFI #{rfi.number} · {rfi.status}</p>
                                  </div>
                                </li>
                              );
                            }

                            return null;
                          })}
                        </ol>
                      ) : (
                        <EmptyState title="No activity yet" description="No workflow responses, distributions, or linked RFIs have been recorded." />
                      )}
                    </div>
                  </section>
            </DetailLayout>
          </ContentSectionStack>
            )}

            {activeTab === "ai-review" && (
              <SubmittalAIReviewPanel
                projectId={projectId}
                submittalId={submittal.id}
                workflowResponseStep={
                  aiReviewWorkflowResponseStep
                    ? {
                        stepId: aiReviewWorkflowResponseStep.id,
                        stepType: aiReviewWorkflowResponseStep.step_type,
                      }
                    : null
                }
                onOpenDetails={() => handleTabChange("details")}
                onWorkflowResponseRecorded={() => router.refresh()}
              />
            )}
        </div>
      </PageShell>
    </>
  );
}
