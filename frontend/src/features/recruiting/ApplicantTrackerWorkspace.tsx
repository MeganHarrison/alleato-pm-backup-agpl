"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  Users,
} from "lucide-react";

import { PageShell, SectionRuleHeading } from "@/components/layout";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDeleteDialog,
  DetailField,
  DetailFieldGrid,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  InfoAlert,
  Input,
  KanbanCardShell,
  KanbanColumnShell,
  Label,
  NumberInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusText,
  Textarea,
} from "@/components/ds";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProductionRecruitingWorkspace } from "@/hooks/use-recruiting";
import {
  allowedProductionStageTransitions,
  requisitionAcceptsActiveWorkflow,
  testApplicationAllowsStage,
  type ProductionRecruitingStage,
  type RecruitingFeatureAvailability,
  type RecruitingUatFeatureAction,
  type RecruitingUatFeatureResult,
} from "@/lib/recruiting/production-contracts";
import { MicrosoftConnectionSettings } from "./MicrosoftConnectionSettings";
import { RecruitingResumeInbox } from "./RecruitingResumeInbox";

const stageOrder: ProductionRecruitingStage[] = [
  "new",
  "review",
  "qualified",
  "interview",
  "offer",
  "hired",
  "closed",
];

const stageLabels: Record<ProductionRecruitingStage, string> = {
  new: "New",
  review: "Review",
  qualified: "Qualified",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  closed: "Closed",
};

function OperationalMetric({
  label,
  value,
  subtitle,
  format,
}: {
  label: string;
  value: number | string;
  subtitle: string;
  format?: "percent";
}) {
  const displayValue =
    format === "percent" && typeof value === "number"
      ? `${Math.round(value)}%`
      : value;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <p className="text-lg font-semibold">{displayValue}</p>
    </div>
  );
}

type ReadinessStatus =
  | "Available"
  | "Test enabled"
  | "Connect account"
  | "Preview only"
  | "Human review"
  | "Guarded";

type ReadinessItem = {
  label: string;
  status: ReadinessStatus;
  reason?: string;
  action?: RecruitingUatFeatureAction;
};

function ReadinessRow({
  label,
  status,
  reason,
  action,
  busy,
  disabled,
  canRun,
  onRunTest,
}: {
  label: string;
  status: ReadinessStatus;
  reason?: string;
  action?: RecruitingUatFeatureAction;
  busy?: boolean;
  disabled?: boolean;
  canRun?: boolean;
  onRunTest?: (action: RecruitingUatFeatureAction) => Promise<boolean>;
}) {
  const available = status === "Available";
  const testable = available || status === "Test enabled";
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      {testable ? (
        <CheckCircle2
          className={`mt-0.5 size-4 shrink-0 ${available ? "text-success" : "text-primary"}`}
          aria-hidden="true"
        />
      ) : (
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-warning"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          <Badge variant={testable ? "secondary" : "outline"}>
            {status}
          </Badge>
        </div>
        {reason ? (
          <p className="mt-1 text-xs text-muted-foreground">{reason}</p>
        ) : null}
      </div>
      {action && onRunTest ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !canRun}
          aria-label={`Run ${label} no-send preview`}
          onClick={() => void onRunTest(action)}
        >
          {busy ? "Running..." : "Run no-send preview"}
        </Button>
      ) : null}
    </div>
  );
}

function SettingsReadiness({
  availability,
  busyAction,
  result,
  canRunTests,
  onRunTest,
}: {
  availability: RecruitingFeatureAvailability;
  busyAction: RecruitingUatFeatureAction | null;
  result: RecruitingUatFeatureResult | null;
  canRunTests: boolean;
  onRunTest: (action: RecruitingUatFeatureAction) => Promise<boolean>;
}) {
  const testMode = availability.testMode;
  const testStatus = (live: boolean) =>
    live ? ("Available" as const) : testMode ? "Test enabled" : "Guarded";
  const rows: ReadinessItem[] = [
    { label: "Shared Supabase data", status: "Available" as const },
    {
      label: "Public candidate intake",
      status: testStatus(availability.publicIntake),
      reason: availability.publicIntake
        ? undefined
        : testMode
          ? "Recruiter-only synthetic intake is active. Public anonymous intake remains off."
          : availability.unavailableReasons.publicIntake,
    },
    {
      label: "Secure resume upload",
      status: testStatus(availability.resumeUpload),
      reason: availability.resumeUpload
        ? undefined
        : testMode
          ? "The approved synthetic PDF is accepted into private quarantine and purged after 24 hours."
          : availability.unavailableReasons.resumeUpload,
    },
    {
      label: "Resume evidence extraction",
      status: testStatus(availability.resumeExtraction),
      action: testMode ? ("resume_evidence_extraction" as const) : undefined,
      reason: availability.resumeExtraction
        ? undefined
        : testMode
          ? "Run the metadata-linked extraction workflow preview; real parsing, ranking, and decisions remain disabled."
          : availability.unavailableReasons.resumeUpload,
    },
    {
      label: "Outlook recruiting mail",
      status: availability.outlookMail
        ? ("Available" as const)
        : ("Connect account" as const),
      reason: availability.unavailableReasons.outlookMail,
    },
    {
      label: "Outlook and Teams scheduling",
      status: availability.outlookCalendar
        ? ("Available" as const)
        : ("Connect account" as const),
      reason: availability.unavailableReasons.outlookCalendar,
    },
    {
      label: "SMS",
      status: testStatus(availability.sms),
      action: testMode ? ("sms_preview" as const) : undefined,
      reason: availability.sms
        ? undefined
        : testMode
          ? "Create a no-send preview with consent, quiet-hours, and opt-out controls visible."
          : availability.unavailableReasons.sms,
    },
    {
      label: "Offer e-signature",
      status: testStatus(availability.eSignature),
      action: testMode ? ("offer_esignature_preview" as const) : undefined,
      reason: availability.eSignature
        ? undefined
        : testMode
          ? "Prepare an auditable synthetic envelope preview without delivering an offer."
          : availability.unavailableReasons.eSignature,
    },
    {
      label: "Workflow automation",
      status: testStatus(availability.automation),
      action: testMode ? ("workflow_automation_preview" as const) : undefined,
      reason:
        "Test workflows stop at human approval and never change an employment outcome automatically.",
    },
    {
      label: "Evidence-linked AI assistance",
      status: testStatus(availability.aiAssistance),
      action: testMode ? ("ai_evidence_summary" as const) : undefined,
      reason: availability.aiAssistance
        ? undefined
        : testMode
          ? "Generate a neutral, metadata-linked synthetic summary for human review without a recommendation."
          : availability.unavailableReasons.aiAssistance,
    },
    {
      label: "Retention execution",
      status: testStatus(availability.retentionExecution),
      reason: availability.retentionExecution
        ? undefined
        : testMode
          ? "Synthetic intake records are automatically eligible for purge after 24 hours."
          : availability.unavailableReasons.retentionExecution,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <ReadinessRow
            key={row.label}
            label={row.label}
            status={row.status}
            reason={row.reason}
            action={row.action}
            busy={row.action === busyAction}
            disabled={Boolean(busyAction)}
            canRun={canRunTests}
            onRunTest={onRunTest}
          />
        ))}
      </div>
      {result ? (
        <InfoAlert role="status" aria-label="Latest feature test result">
          <p className="font-medium">Latest test result</p>
          <p className="mt-1 text-sm">{result.summary}</p>
          <DetailFieldGrid columns={1} className="mt-3 gap-y-3">
            {result.evidence.map((item) => (
              <DetailField
                key={`${item.label}-${item.source}`}
                label={item.label}
              >
                <span className="block">{item.value}</span>
                <span className="block text-xs text-muted-foreground">
                  Source: {item.source}
                </span>
              </DetailField>
            ))}
          </DetailFieldGrid>
          <p className="mt-3 text-xs text-muted-foreground">
            Safety result: nothing sent; synthetic data only; every employment
            decision still requires a person.
          </p>
        </InfoAlert>
      ) : null}
    </div>
  );
}

export function ApplicantTrackerWorkspace() {
  const controller = useProductionRecruitingWorkspace();
  const workspace = controller.workspace;
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const [microsoftResult, setMicrosoftResult] = useState<
    "connected" | "disconnected" | "denied" | "error" | null
  >(null);
  const [createForm, setCreateForm] = useState({
    requisitionNumber: "",
    title: "",
    department: "",
    location: "",
    jobsite: "",
    headcount: "1",
    isConfidential: false,
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("microsoft");
    if (
      result === "connected" ||
      result === "disconnected" ||
      result === "denied" ||
      result === "error"
    ) {
      setMicrosoftResult(result);
      setActiveTab("settings");
      url.searchParams.delete("microsoft");
      url.searchParams.delete("capability");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, []);

  useEffect(() => {
    const requestedTab = new URL(window.location.href).searchParams.get("tab");
    if (
      requestedTab &&
      [
        "inbox",
        "pipeline",
        "requisitions",
        "interviews",
        "offers",
        "talent",
        "reports",
        "settings",
      ].includes(requestedTab)
    ) {
      setActiveTab(requestedTab);
    }
  }, []);

  useEffect(() => {
    if (!workspace) return;
    const url = new URL(window.location.href);
    const applicationId = url.searchParams.get("applicationId");
    if (
      applicationId &&
      workspace.applications.some(
        (application) => application.id === applicationId,
      )
    ) {
      setSelectedApplicationId(applicationId);
      setActiveTab("pipeline");
      url.searchParams.delete("applicationId");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [workspace]);
  const [lifecycleAction, setLifecycleAction] = useState<{
    requisitionId: string;
    title: string;
    nextStatus: "closed" | "canceled";
  } | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    requisitionId: string;
    title: string;
  } | null>(null);
  const [notQualifiedTarget, setNotQualifiedTarget] = useState<{
    applicationId: string;
    candidateName: string;
  } | null>(null);
  const [notQualifiedReason, setNotQualifiedReason] = useState("");

  const candidateById = useMemo(
    () =>
      new Map(
        (workspace?.candidates ?? []).map((candidate) => [
          candidate.id,
          candidate,
        ]),
      ),
    [workspace?.candidates],
  );
  const selectedApplication =
    workspace?.applications.find(
      (application) => application.id === selectedApplicationId,
    ) ?? null;
  const selectedCandidate = selectedApplication
    ? (candidateById.get(selectedApplication.candidateId) ?? null)
    : null;
  const activeRequisitions = useMemo(
    () =>
      (workspace?.requisitions ?? []).filter((requisition) =>
        requisitionAcceptsActiveWorkflow(requisition.status),
      ),
    [workspace?.requisitions],
  );

  function openCreatePosition() {
    controller.clearError();
    setCreateOpen(true);
  }

  function openLifecycleAction(action: NonNullable<typeof lifecycleAction>) {
    controller.clearError();
    setLifecycleReason("");
    setLifecycleAction(action);
  }

  function openDeleteDraft(target: NonNullable<typeof deleteTarget>) {
    controller.clearError();
    setDeleteTarget(target);
  }

  async function handleCreatePosition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const created = await controller.createRequisition({
      requisitionNumber: createForm.requisitionNumber.trim(),
      title: createForm.title.trim(),
      department: createForm.department.trim() || null,
      location: createForm.location.trim() || null,
      jobsite: createForm.jobsite.trim() || null,
      headcount: Number(createForm.headcount),
      isConfidential: createForm.isConfidential,
    });
    setSubmitting(false);
    if (!created) return;
    setCreateOpen(false);
    setCreateForm({
      requisitionNumber: "",
      title: "",
      department: "",
      location: "",
      jobsite: "",
      headcount: "1",
      isConfidential: false,
    });
  }

  async function handleLifecycleChange() {
    if (!lifecycleAction) return;
    setSubmitting(true);
    const changed = await controller.setRequisitionLifecycle(
      lifecycleAction.requisitionId,
      lifecycleAction.nextStatus,
      lifecycleReason,
    );
    setSubmitting(false);
    if (!changed) return;
    setLifecycleAction(null);
    setLifecycleReason("");
  }

  if (!workspace) {
    return (
      <PageShell
        variant="table"
        title="Applicant Tracker"
        description="Loading the shared recruiting workspace."
      >
        <div className="space-y-4">
          {controller.error ? (
            <InfoAlert variant="error" role="alert">
              <p>{controller.error}</p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={controller.reload}
              >
                <RefreshCw aria-hidden="true" />
                Retry
              </Button>
            </InfoAlert>
          ) : (
            <StatusText status="Loading requisitions, candidates, and recruiter tasks…" />
          )}
        </div>
      </PageShell>
    );
  }

  const selectedRequisition =
    activeRequisitions.find(
      (requisition) => requisition.id === controller.selectedRequisitionId,
    ) ??
    activeRequisitions[0] ??
    null;

  return (
    <>
      <PageShell
        variant="table"
        title="Applicant Tracker"
        description={
          controller.preview
            ? "Local production preview with synthetic identities. Shared-data contracts are implemented; external providers remain guarded."
            : "Shared recruiting workspace. Employment decisions remain human-controlled and auditable."
        }
        actions={
          <div className="flex items-center gap-2">
            {workspace.viewer.canWrite ? (
              <Button type="button" onClick={openCreatePosition}>
                <Plus aria-hidden="true" />
                Add position
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={controller.reload}
              disabled={controller.loading}
            >
              <RefreshCw aria-hidden="true" />
              Refresh
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {controller.preview ? (
            <InfoAlert>
              This is the local all-phases preview. Candidate identities are
              synthetic, and no email, calendar, SMS, e-signature, retention, or
              AI provider action will run.
            </InfoAlert>
          ) : null}
          {controller.error ? (
            <InfoAlert variant="error" role="alert">
              {controller.error}
            </InfoAlert>
          ) : (
            <StatusText status={controller.notice} />
          )}
          {workspace.featureAvailability.testMode ? (
            <InfoAlert>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Recruiter test mode is active</p>
                  <p className="mt-1 text-sm">
                    Synthetic résumé intake and review/interview stage testing
                    are enabled. Recruiters can assign resumes and use the Not
                    Qualified outcome; offers, hiring, and external delivery
                    remain blocked.
                  </p>
                </div>
                {workspace.viewer.canWrite ? (
                  <Button asChild variant="outline">
                    <Link href="/recruiting/intake-test">
                      Upload test résumé
                    </Link>
                  </Button>
                ) : null}
              </div>
            </InfoAlert>
          ) : null}
          {microsoftResult ? (
            <InfoAlert
              variant={
                microsoftResult === "connected" ||
                microsoftResult === "disconnected"
                  ? "success"
                  : "error"
              }
              role="status"
            >
              {microsoftResult === "connected"
                ? "Microsoft 365 connected successfully."
                : microsoftResult === "disconnected"
                  ? "Microsoft 365 disconnected."
                  : microsoftResult === "denied"
                    ? "Microsoft permission was not granted. No connection was saved."
                    : "Microsoft 365 could not be connected. Review the provider configuration and try again."}
            </InfoAlert>
          ) : null}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <div className="overflow-x-auto">
              <TabsList className="min-w-max">
                <TabsTrigger value="inbox">Inbox</TabsTrigger>
                <TabsTrigger value="resume-inbox">
                  Resume inbox
                  {workspace.unassignedResumes.length ? (
                    <Badge className="ml-2" variant="secondary">
                      {workspace.unassignedResumes.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                <TabsTrigger value="requisitions">Requisitions</TabsTrigger>
                <TabsTrigger value="interviews">Interviews</TabsTrigger>
                <TabsTrigger value="offers">Offers</TabsTrigger>
                <TabsTrigger value="talent">Talent CRM</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="inbox" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <OperationalMetric
                  label="Open tasks"
                  value={workspace.inbox.openTasks}
                  subtitle={`${workspace.inbox.overdueTasks} overdue`}
                />
                <OperationalMetric
                  label="Pending approvals"
                  value={workspace.inbox.pendingApprovals}
                  subtitle="Requisitions and offers"
                />
                <OperationalMetric
                  label="Scheduling"
                  value={workspace.inbox.unscheduledInterviews}
                  subtitle="Interviews need a time"
                />
                <OperationalMetric
                  label="Missing scorecards"
                  value={workspace.inbox.missingScorecards}
                  subtitle="Independent feedback due"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-4" aria-hidden="true" />
                    <SectionRuleHeading
                      label="Needs attention"
                      className="mb-0 pb-0"
                    />
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span>Applications stale in their current stage</span>
                      <Badge variant="outline">
                        {workspace.inbox.staleApplications}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Provider attempts needing recovery</span>
                      <Badge variant="outline">
                        {workspace.inbox.failedProviderAttempts}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Tasks past their due date</span>
                      <Badge variant="outline">
                        {workspace.inbox.overdueTasks}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    <SectionRuleHeading
                      label="Decision controls"
                      className="mb-0 pb-0"
                    />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Stage changes, dispositions, scorecards, approvals, and
                    offers retain the human actor and row version. AI cannot
                    reject, rank, advance, offer to, or hire a candidate.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="resume-inbox">
              <RecruitingResumeInbox
                resumes={workspace.unassignedResumes}
                requisitions={workspace.requisitions}
                canWrite={workspace.viewer.canWrite}
                testMode={workspace.featureAvailability.testMode}
                onAssign={controller.assignResume}
                onReload={controller.reload}
              />
            </TabsContent>

            <TabsContent value="pipeline" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {activeRequisitions.length ? (
                  <Select
                    value={selectedRequisition?.id}
                    onValueChange={controller.selectRequisition}
                  >
                    <SelectTrigger
                      className="w-full sm:w-96"
                      aria-label="Choose requisition"
                    >
                      <BriefcaseBusiness aria-hidden="true" />
                      <SelectValue placeholder="Choose requisition" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeRequisitions.map((requisition) => (
                        <SelectItem key={requisition.id} value={requisition.id}>
                          {requisition.requisitionNumber} - {requisition.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <StatusText status="No active positions. Add a position to begin recruiting." />
                )}
                {selectedRequisition ? (
                  <StatusText
                    status={`${selectedRequisition.status} - ${selectedRequisition.location ?? "No location"}`}
                  />
                ) : null}
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="grid min-w-max grid-cols-8 gap-3">
                  {stageOrder.map((stage) => {
                    const applications = workspace.applications.filter(
                      (application) =>
                        application.stage === stage &&
                        application.dispositionCode !== "not_qualified",
                    );
                    return (
                      <KanbanColumnShell
                        key={stage}
                        title={stageLabels[stage]}
                        count={applications.length}
                        className="min-h-80"
                      >
                        {applications.length ? (
                          applications.map((application) => {
                            const candidate = candidateById.get(
                              application.candidateId,
                            );
                            return (
                              <KanbanCardShell
                                key={application.id}
                                density="default"
                                interactive
                                ariaLabel={`Open ${candidate?.displayName ?? "restricted candidate"}`}
                                onClick={() =>
                                  setSelectedApplicationId(application.id)
                                }
                              >
                                <div className="space-y-3 text-xs text-muted-foreground">
                                  <p className="text-sm font-semibold text-foreground">
                                    {candidate?.displayName ??
                                      "Restricted candidate"}
                                  </p>
                                  <p>
                                    {candidate?.currentTitle ??
                                      "Role unavailable"}
                                    {candidate?.currentCompany
                                      ? ` - ${candidate.currentCompany}`
                                      : ""}
                                  </p>
                                  <Select
                                    value={application.stage}
                                    disabled={!workspace.viewer.canWrite}
                                    onValueChange={(value) => {
                                      if (value === "not_qualified") {
                                        setNotQualifiedReason("");
                                        setNotQualifiedTarget({
                                          applicationId: application.id,
                                          candidateName:
                                            candidate?.displayName ??
                                            "Candidate",
                                        });
                                      } else {
                                        void controller.moveApplication(
                                          application.id,
                                          value as ProductionRecruitingStage,
                                        );
                                      }
                                    }}
                                  >
                                    <SelectTrigger
                                      aria-label={`Move ${candidate?.displayName ?? "candidate"}`}
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {allowedProductionStageTransitions(
                                        application.stage,
                                      )
                                        .filter(
                                          (target) =>
                                            !application.isTestApplication ||
                                            testApplicationAllowsStage(target),
                                        )
                                        .map((target) => (
                                        <SelectItem key={target} value={target}>
                                          {stageLabels[target]}
                                        </SelectItem>
                                        ))}
                                      <SelectItem value="not_qualified">
                                        Not Qualified
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </KanbanCardShell>
                            );
                          })
                        ) : (
                          <p className="py-8 text-center text-xs text-muted-foreground">
                            No candidates
                          </p>
                        )}
                      </KanbanColumnShell>
                    );
                  })}
                  <KanbanColumnShell
                    title="Not Qualified"
                    count={
                      workspace.applications.filter(
                        (application) =>
                          application.dispositionCode === "not_qualified",
                      ).length
                    }
                    className="min-h-80"
                  >
                    {workspace.applications
                      .filter(
                        (application) =>
                          application.dispositionCode === "not_qualified",
                      )
                      .map((application) => {
                        const candidate = candidateById.get(
                          application.candidateId,
                        );
                        return (
                          <KanbanCardShell
                            key={application.id}
                            density="default"
                            interactive
                            ariaLabel={`Open ${candidate?.displayName ?? "candidate"}`}
                            onClick={() =>
                              setSelectedApplicationId(application.id)
                            }
                          >
                            <p className="font-semibold">
                              {candidate?.displayName ?? "Restricted candidate"}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {application.dispositionReason}
                            </p>
                          </KanbanCardShell>
                        );
                      })}
                  </KanbanColumnShell>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="requisitions">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {workspace.requisitions.map((requisition) => (
                  <div
                    key={requisition.id}
                    className="border-b border-border py-5 last:border-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {requisition.requisitionNumber}
                        </p>
                        <p className="mt-1 font-semibold">
                          {requisition.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{requisition.status}</Badge>
                        {workspace.viewer.canWrite &&
                        !["filled", "closed", "canceled"].includes(
                          requisition.status,
                        ) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={`Actions for ${requisition.title}`}
                              >
                                <MoreHorizontal aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() =>
                                  openLifecycleAction({
                                    requisitionId: requisition.id,
                                    title: requisition.title,
                                    nextStatus: "closed",
                                  })
                                }
                              >
                                Close position
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  openLifecycleAction({
                                    requisitionId: requisition.id,
                                    title: requisition.title,
                                    nextStatus: "canceled",
                                  })
                                }
                              >
                                Cancel position
                              </DropdownMenuItem>
                              {workspace.viewer.canAdmin &&
                              requisition.status === "draft" ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={() =>
                                      openDeleteDraft({
                                        requisitionId: requisition.id,
                                        title: requisition.title,
                                      })
                                    }
                                  >
                                    Delete draft
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </div>
                    <DetailFieldGrid columns={2} className="mt-5">
                      <DetailField label="Department">
                        {requisition.department ?? "Not set"}
                      </DetailField>
                      <DetailField label="Headcount">
                        {requisition.headcount}
                      </DetailField>
                      <DetailField label="Location / jobsite" span={2}>
                        {[requisition.location, requisition.jobsite]
                          .filter(Boolean)
                          .join(" - ") || "Not set"}
                      </DetailField>
                    </DetailFieldGrid>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="interviews" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <OperationalMetric
                  label="Interviews"
                  value={workspace.operations.interviews}
                  subtitle="Across accessible requisitions"
                />
                <OperationalMetric
                  label="Needs scheduling"
                  value={workspace.inbox.unscheduledInterviews}
                  subtitle="Self-scheduling guarded until Graph approval"
                />
                <OperationalMetric
                  label="Scorecards due"
                  value={workspace.inbox.missingScorecards}
                  subtitle="Peer answers remain hidden until submission"
                />
              </div>
              <InfoAlert>
                Interview plans, participants, structured criteria, independent
                scorecards, and evidence-led debriefs are represented in the
                shared schema. Outlook and Teams delivery remain gated
                separately.
              </InfoAlert>
            </TabsContent>

            <TabsContent value="offers" className="space-y-4">
              <OperationalMetric
                label="Active offers"
                value={workspace.operations.offers}
                subtitle="Versioned approval and lifecycle records"
              />
              <InfoAlert>
                Offer authoring and approval are isolated from e-signature
                delivery. Compensation changes require a new version; external
                send remains guarded until callback verification is configured.
              </InfoAlert>
            </TabsContent>

            <TabsContent value="talent" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <OperationalMetric
                  label="Talent pools"
                  value={workspace.operations.talentPools}
                  subtitle="Prospects remain distinct from applicants"
                />
                <OperationalMetric
                  label="Active campaigns"
                  value={0}
                  subtitle="Delivery requires consent and suppression"
                />
                <OperationalMetric
                  label="Construction fields"
                  value="Ready"
                  subtitle="Certifications, jobsites, referrals, and sources"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4" aria-hidden="true" />
                  <SectionRuleHeading
                    label="Construction recruiting profile"
                    className="mb-0 pb-0"
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  The data model supports certification expiration, jobsite
                  context, referrals, QR intake, and kiosk source tracking.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <OperationalMetric
                  label="Pipeline candidates"
                  value={workspace.applications.length}
                  subtitle="Current selected requisition"
                />
                <OperationalMetric
                  label="Interview conversion"
                  value={
                    workspace.applications.length
                      ? (workspace.applications.filter((item) =>
                          ["interview", "offer", "hired"].includes(item.stage),
                        ).length /
                          workspace.applications.length) *
                        100
                      : 0
                  }
                  format="percent"
                  subtitle="Reached interview or later"
                />
                <OperationalMetric
                  label="Offer conversion"
                  value={
                    workspace.applications.length
                      ? (workspace.applications.filter((item) =>
                          ["offer", "hired"].includes(item.stage),
                        ).length /
                          workspace.applications.length) *
                        100
                      : 0
                  }
                  format="percent"
                  subtitle="Reached offer or hired"
                />
                <OperationalMetric
                  label="Provider failures"
                  value={workspace.inbox.failedProviderAttempts}
                  subtitle="Visible operational recovery queue"
                />
              </div>
              <InfoAlert>
                Production metric snapshots retain their definition version,
                numerator, denominator, and dimensions. Candidate survey answers
                remain separate from selection decisions.
              </InfoAlert>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <MicrosoftConnectionSettings
                connection={workspace.microsoftConnection}
                canManage={workspace.viewer.canWrite}
              />
              {workspace.viewer.canWrite ? (
                <InfoAlert>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Candidate intake UAT</p>
                      <p className="mt-1 text-sm">
                        Test application intake and private resume quarantine
                        with synthetic records.
                      </p>
                    </div>
                    <Button asChild variant="outline">
                      <Link href="/recruiting/intake-test">
                        Open intake test
                      </Link>
                    </Button>
                  </div>
                </InfoAlert>
              ) : null}
              <div className="flex items-center gap-2">
                <Settings2 className="size-4" aria-hidden="true" />
                <SectionRuleHeading
                  label="Feature readiness and kill switches"
                  className="mb-0 pb-0"
                />
              </div>
              <SettingsReadiness
                availability={workspace.featureAvailability}
                busyAction={controller.uatFeatureBusy}
                result={controller.uatFeatureResult}
                canRunTests={workspace.viewer.canWrite}
                onRunTest={controller.runUatFeatureTest}
              />
            </TabsContent>
          </Tabs>
        </div>
      </PageShell>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleCreatePosition}>
            <DialogHeader>
              <DialogTitle>Add position</DialogTitle>
              <DialogDescription>
                New positions begin as drafts with the standard hiring stages.
              </DialogDescription>
            </DialogHeader>
            {controller.error ? (
              <InfoAlert variant="error" role="alert">
                {controller.error}
              </InfoAlert>
            ) : null}
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requisition-number">Requisition number</Label>
                <Input
                  id="requisition-number"
                  required
                  maxLength={50}
                  value={createForm.requisitionNumber}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      requisitionNumber: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position-title">Position title</Label>
                <Input
                  id="position-title"
                  required
                  maxLength={200}
                  value={createForm.title}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position-department">Department</Label>
                <Input
                  id="position-department"
                  maxLength={160}
                  value={createForm.department}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position-headcount">Headcount</Label>
                <NumberInput
                  id="position-headcount"
                  required
                  min={1}
                  max={500}
                  decimals={0}
                  formatOnBlur={false}
                  value={createForm.headcount}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      headcount: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position-location">Location</Label>
                <Input
                  id="position-location"
                  maxLength={200}
                  value={createForm.location}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position-jobsite">Jobsite</Label>
                <Input
                  id="position-jobsite"
                  maxLength={200}
                  value={createForm.jobsite}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      jobsite: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  id="position-confidential"
                  checked={createForm.isConfidential}
                  onCheckedChange={(checked) =>
                    setCreateForm((current) => ({
                      ...current,
                      isConfidential: checked === true,
                    }))
                  }
                />
                <Label htmlFor="position-confidential">
                  Limit this confidential position to assigned recruiting staff
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create position"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(lifecycleAction)}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setLifecycleAction(null);
            setLifecycleReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lifecycleAction?.nextStatus === "closed" ? "Close" : "Cancel"}{" "}
              {lifecycleAction?.title}?
            </DialogTitle>
            <DialogDescription>
              The position leaves the active hiring workflow. Candidate and
              recruiting history remains available.
            </DialogDescription>
          </DialogHeader>
          {controller.error ? (
            <InfoAlert variant="error" role="alert">
              {controller.error}
            </InfoAlert>
          ) : null}
          <div className="space-y-2 py-4">
            <Label htmlFor="position-lifecycle-reason">Reason</Label>
            <Textarea
              id="position-lifecycle-reason"
              required
              minLength={5}
              maxLength={2000}
              value={lifecycleReason}
              onChange={(event) => setLifecycleReason(event.target.value)}
              placeholder="Explain why this position is no longer active."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLifecycleAction(null);
                setLifecycleReason("");
                controller.clearError();
              }}
              disabled={submitting}
            >
              Keep position
            </Button>
            <Button
              type="button"
              onClick={handleLifecycleChange}
              disabled={submitting || lifecycleReason.trim().length < 5}
            >
              {submitting
                ? "Saving..."
                : lifecycleAction?.nextStatus === "closed"
                  ? "Close position"
                  : "Cancel position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(notQualifiedTarget)}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setNotQualifiedTarget(null);
            setNotQualifiedReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Mark {notQualifiedTarget?.candidateName} Not Qualified?
            </DialogTitle>
            <DialogDescription>
              This closes the application with a human-recorded outcome. The
              reason is retained in the audit history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="not-qualified-reason">Reason</Label>
            <Textarea
              id="not-qualified-reason"
              value={notQualifiedReason}
              minLength={5}
              maxLength={2000}
              onChange={(event) => setNotQualifiedReason(event.target.value)}
              placeholder="Describe the job-related reason."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setNotQualifiedTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                submitting ||
                !workspace.viewer.canWrite ||
                notQualifiedReason.trim().length < 5
              }
              onClick={async () => {
                if (!notQualifiedTarget) return;
                setSubmitting(true);
                const saved = await controller.markNotQualified(
                  notQualifiedTarget.applicationId,
                  notQualifiedReason,
                );
                setSubmitting(false);
                if (saved) {
                  setNotQualifiedTarget(null);
                  setNotQualifiedReason("");
                }
              }}
            >
              {submitting ? "Saving..." : "Mark Not Qualified"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.title ?? "draft"}?`}
        description="Only an unused draft can be deleted. If recruiting activity exists, the draft will remain and the app will tell you to close or cancel it instead."
        confirmLabel="Delete position"
        isDeleting={submitting}
        error={controller.error}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setSubmitting(true);
          const deleted = await controller.deleteDraftRequisition(
            deleteTarget.requisitionId,
          );
          setSubmitting(false);
          if (deleted) setDeleteTarget(null);
        }}
      />

      <Sheet
        open={Boolean(selectedApplication)}
        onOpenChange={(open) => {
          if (!open) setSelectedApplicationId(null);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {selectedCandidate?.displayName ?? "Candidate"}
            </SheetTitle>
            <SheetDescription>
              Candidate identity is separate from this job-specific application.
            </SheetDescription>
          </SheetHeader>
          {selectedApplication && selectedCandidate ? (
            <div className="space-y-6 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p>{selectedCandidate.email ?? "Not available"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p>{selectedCandidate.phone ?? "Not available"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current role</p>
                  <p>{selectedCandidate.currentTitle ?? "Not available"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Company</p>
                  <p>{selectedCandidate.currentCompany ?? "Not available"}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <p className="font-medium">Application controls</p>
                <DetailFieldGrid columns={2}>
                  <DetailField label="Stage">
                    {stageLabels[selectedApplication.stage]}
                  </DetailField>
                  <DetailField label="Row version">
                    {selectedApplication.rowVersion}
                  </DetailField>
                  <DetailField label="Disposition">
                    {selectedApplication.dispositionCode ?? "Not set"}
                  </DetailField>
                  <DetailField label="Status">
                    {selectedApplication.status}
                  </DetailField>
                </DetailFieldGrid>
              </div>
              {selectedApplication.resume ? (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={`/api/recruiting/resumes?documentId=${encodeURIComponent(selectedApplication.resume.documentId)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open original resume
                  </a>
                </Button>
              ) : (
                <StatusText status="No original resume is linked to this application." />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  disabled
                  title="Message drafting is guarded until the recruiting mailbox workflow is implemented and verified."
                >
                  <Mail aria-hidden="true" />
                  Draft message
                </Button>
                <Button
                  variant="outline"
                  disabled
                  title="Scheduling is guarded until the recruiting calendar workflow is implemented and verified."
                >
                  <CalendarDays aria-hidden="true" />
                  Schedule interview
                </Button>
                <Button
                  variant="outline"
                  disabled
                  title="Scorecard navigation is not enabled in this release."
                >
                  <UserRoundSearch aria-hidden="true" />
                  Open scorecards
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !workspace.viewer.canWrite ||
                    !workspace.featureAvailability.testMode ||
                    (!controller.preview &&
                      !selectedApplication.isTestApplication) ||
                    Boolean(controller.uatFeatureBusy)
                  }
                  title={
                    workspace.featureAvailability.testMode &&
                    (controller.preview || selectedApplication.isTestApplication)
                      ? "Preview a synthetic metadata summary and review its sources in Settings."
                      : "Test summaries require a synthetic UAT application; live employment AI remains guarded."
                  }
                  onClick={async () => {
                    const completed = await controller.runUatFeatureTest(
                      "ai_evidence_summary",
                      selectedApplication.id,
                    );
                    if (completed) {
                      setSelectedApplicationId(null);
                      setActiveTab("settings");
                    }
                  }}
                >
                  <Sparkles aria-hidden="true" />
                  {controller.uatFeatureBusy === "ai_evidence_summary"
                    ? "Summarizing..."
                    : "Preview metadata summary"}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
