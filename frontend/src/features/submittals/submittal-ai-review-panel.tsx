"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileWarning,
  XCircle,
} from "lucide-react";

import { InfoAlert } from "@/components/ds/InfoAlert";
import { SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AIReviewDisposition,
  type AIReviewResult,
  type SubmittalWorkflowResponseStatus,
  useRecordSubmittalAIReviewWorkflowResponse,
  useRunSubmittalAIReview,
  useSubmittalAIReview,
  useUpdateSubmittalAIReviewCheck,
} from "@/hooks/use-submittals";
import {
  buildAIReviewResponseComment,
  recommendedAIReviewWorkflowResponseStatus,
} from "@/lib/submittals/ai-review/response-comment";

interface Props {
  projectId: number;
  submittalId: string;
  workflowResponseStep?: {
    stepId: string;
    stepType: string;
  } | null;
  onOpenDetails?: () => void;
  onWorkflowResponseRecorded?: () => void;
}

type ReviewCheck = AIReviewResult["checks"][number];

const DISPOSITION_OPTIONS: Array<{
  value: AIReviewDisposition;
  label: string;
}> = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "dismissed", label: "Dismissed" },
  { value: "edited", label: "Edited" },
];

const RESPONSE_OPTIONS: SubmittalWorkflowResponseStatus[] = [
  "Approved",
  "Approved as Noted",
  "Revise and Resubmit",
  "Rejected",
  "Reviewed - No Exception",
];

function ReviewCheckRow({
  icon,
  color,
  check,
  isUpdating,
  onDispositionChange,
}: {
  icon: React.ReactNode;
  color: string;
  check: ReviewCheck;
  isUpdating: boolean;
  onDispositionChange: (
    check: ReviewCheck,
    disposition: AIReviewDisposition,
  ) => void;
}) {
  return (
    <div className={`flex gap-2.5 rounded-md border px-3 py-2.5 ${color}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="min-w-0 text-xs font-medium text-foreground">
            {check.title}
          </span>
          {check.id ? (
            <Select
              value={check.reviewerDisposition}
              onValueChange={(value) =>
                onDispositionChange(check, value as AIReviewDisposition)
              }
              disabled={isUpdating}
            >
              <SelectTrigger
                size="sm"
                className="h-7 w-32 px-2 text-xs"
                aria-label={`Reviewer disposition for ${check.title}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {DISPOSITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground">
              {check.reviewerDisposition.replace("_", " ")}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {check.finding}
        </p>
        {check.recommendation && (
          <p className="mt-1 text-xs text-foreground">{check.recommendation}</p>
        )}
        {check.sourceReferences.length > 0 && (
          <div className="mt-2 space-y-1">
            {check.sourceReferences.slice(0, 2).map((source) => (
              <div
                key={`${check.title}-${source.sourceKey}`}
                className="text-xs text-muted-foreground"
              >
                <span className="font-medium text-foreground">
                  {source.label}
                </span>
                {source.excerpt ? `: ${source.excerpt}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewFindings({
  result,
  updatingCheckId,
  onDispositionChange,
}: {
  result: AIReviewResult;
  updatingCheckId: string | null;
  onDispositionChange: (
    check: ReviewCheck,
    disposition: AIReviewDisposition,
  ) => void;
}) {
  const failingChecks = result.checks.filter(
    (check) => check.status === "fail",
  );
  const warningChecks = result.checks.filter((check) =>
    [
      "warning",
      "missing_information",
      "unable_to_determine",
      "needs_human_review",
    ].includes(check.status),
  );
  const passingChecks = result.checks.filter(
    (check) => check.status === "pass",
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Readiness
          </p>
          <span className="text-xs text-muted-foreground">
            {result.readiness.state.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {result.readiness.summary}
        </p>
        <div className="space-y-2">
          {result.readiness.layers.map((layer) => (
            <div
              key={layer.key}
              className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {layer.label}
                </p>
                {layer.reasons[0] && (
                  <p className="text-xs text-muted-foreground">
                    {layer.reasons[0]}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {layer.availableCount ?? 0}/{layer.totalCount ?? 0}{" "}
                {layer.state.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {result.summary && (
          <p className="text-sm leading-relaxed text-foreground">
            {result.summary}
          </p>
        )}
        {result.recommendation && (
          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {result.recommendation}
          </span>
        )}
      </div>

      {failingChecks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Conflicts ({failingChecks.length})
          </p>
          <div className="space-y-1.5">
            {failingChecks.map((check, index) => (
              <ReviewCheckRow
                key={`${check.title}-${index}`}
                check={check}
                icon={<XCircle className="h-3.5 w-3.5 text-destructive" />}
                color="border-destructive/20 bg-destructive/5"
                isUpdating={updatingCheckId === check.id}
                onDispositionChange={onDispositionChange}
              />
            ))}
          </div>
        </div>
      )}

      {warningChecks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Needs Review ({warningChecks.length})
          </p>
          <div className="space-y-1.5">
            {warningChecks.map((check, index) => (
              <ReviewCheckRow
                key={`${check.title}-${index}`}
                check={check}
                icon={<CircleHelp className="h-3.5 w-3.5 text-warning" />}
                color="border-warning/20 bg-warning/5"
                isUpdating={updatingCheckId === check.id}
                onDispositionChange={onDispositionChange}
              />
            ))}
          </div>
        </div>
      )}

      {passingChecks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Confirmed ({passingChecks.length})
          </p>
          <div className="space-y-1.5">
            {passingChecks.map((check, index) => (
              <ReviewCheckRow
                key={`${check.title}-${index}`}
                check={check}
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                color="border-primary/20 bg-primary/5"
                isUpdating={updatingCheckId === check.id}
                onDispositionChange={onDispositionChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowResponseAction({
  result,
  workflowResponseStep,
  onWorkflowResponseRecorded,
  projectId,
  submittalId,
}: {
  result: AIReviewResult;
  workflowResponseStep: NonNullable<Props["workflowResponseStep"]>;
  onWorkflowResponseRecorded?: () => void;
  projectId: number;
  submittalId: string;
}) {
  const [responseStatus, setResponseStatus] =
    React.useState<SubmittalWorkflowResponseStatus>(() =>
      recommendedAIReviewWorkflowResponseStatus(result),
    );
  const recordResponse = useRecordSubmittalAIReviewWorkflowResponse(
    projectId,
    submittalId,
  );

  React.useEffect(() => {
    setResponseStatus(recommendedAIReviewWorkflowResponseStatus(result));
  }, [result]);

  async function handleRecordResponse() {
    await recordResponse.mutateAsync({
      stepId: workflowResponseStep.stepId,
      responseStatus,
      comments: buildAIReviewResponseComment(result),
    });
    onWorkflowResponseRecorded?.();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workflow response
        </p>
        <p className="text-sm text-muted-foreground">
          {workflowResponseStep.stepType} step assigned to you
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={responseStatus}
          onValueChange={(value) =>
            setResponseStatus(value as SubmittalWorkflowResponseStatus)
          }
        >
          <SelectTrigger className="h-8 w-48 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {RESPONSE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleRecordResponse}
          disabled={recordResponse.isPending}
        >
          {recordResponse.isPending ? "Recording..." : "Record Response"}
        </Button>
      </div>
    </div>
  );
}

export function SubmittalAIReviewPanel({
  projectId,
  submittalId,
  workflowResponseStep,
  onOpenDetails,
  onWorkflowResponseRecorded,
}: Props) {
  const { data, isLoading } = useSubmittalAIReview(projectId, submittalId);
  const {
    mutate: runReview,
    isPending,
    error,
  } = useRunSubmittalAIReview(projectId, submittalId);
  const updateDisposition = useUpdateSubmittalAIReviewCheck(
    projectId,
    submittalId,
  );

  const updatingCheckId = updateDisposition.isPending
    ? (updateDisposition.variables?.checkId ?? null)
    : null;
  const notReadyLayerKeys = new Set(
    data?.readiness.layers
      .filter((layer) => layer.state === "not_ready")
      .map((layer) => layer.key) ?? [],
  );
  const detailsRecoveryLabel = notReadyLayerKeys.has("linked_drawings")
    ? "Link drawings in Details"
    : notReadyLayerKeys.has("submittal_text")
      ? "Add source documents in Details"
      : null;

  function handleDispositionChange(
    check: ReviewCheck,
    reviewerDisposition: AIReviewDisposition,
  ) {
    if (!check.id || check.reviewerDisposition === reviewerDisposition) return;
    updateDisposition.mutate({
      checkId: check.id,
      reviewerDisposition,
      reviewerNotes: check.reviewerNotes,
    });
  }

  return (
    <div className="space-y-4">
      <SectionRuleHeading label="AI Review" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data
              ? "Review results are stored per run and update when source coverage changes."
              : "Compare this submittal against linked project drawings."}
          </p>
          <Button
            size="sm"
            onClick={() => runReview()}
            disabled={isPending || isLoading}
          >
            {isPending
              ? "Running..."
              : data
                ? "Re-run Review"
                : "Run AI Review"}
          </Button>
        </div>

        {error && !isPending && (
          <InfoAlert variant="error">
            Review failed loudly. Fix the missing source or provider issue, then
            run the review again.
          </InfoAlert>
        )}

        {isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <span>Building the review run and validating source coverage.</span>
          </div>
        )}

        {data?.error && !isPending && (
          <InfoAlert variant="error">{data.error.message}</InfoAlert>
        )}

        {data &&
          data.readiness.state !== "not_ready" &&
          workflowResponseStep && (
            <WorkflowResponseAction
              result={data}
              workflowResponseStep={workflowResponseStep}
              onWorkflowResponseRecorded={onWorkflowResponseRecorded}
              projectId={projectId}
              submittalId={submittalId}
            />
          )}

        {!data && !isLoading && !isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileWarning className="h-4 w-4" />
            <span>No review has been run yet.</span>
          </div>
        )}

        {data && data.readiness.state === "not_ready" && (
          <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div>{data.readiness.summary}</div>
                {detailsRecoveryLabel && onOpenDetails && (
                  <Button
                    type="button"
                    variant="link"
                    className="mt-2 h-auto p-0 text-sm font-medium text-warning underline-offset-4 hover:text-warning"
                    onClick={onOpenDetails}
                  >
                    {detailsRecoveryLabel}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {data && (
          <ReviewFindings
            result={data}
            updatingCheckId={updatingCheckId}
            onDispositionChange={handleDispositionChange}
          />
        )}
      </div>
    </div>
  );
}
