"use client";

import * as React from "react";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  History,
  PauseCircle,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/ds/empty-state";
import { SectionRuleHeading } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  firstSourceEvent,
  isSkillLibraryPromotion,
  isTeachAlleatoPromotion,
  jsonObject,
  readLearning,
  type AiFeedbackEventRow,
  type AiLearningPromotionRow,
  type PromotionKind,
  type PromotionLearning,
} from "@/lib/ai/learning-promotion-view-model";
import { apiFetch } from "@/lib/api-client";
import { formatNumber } from "@/lib/table-config/formatters";
import type { Database, Json } from "@/types/database.types";

type AiRetrievalWeightRow =
  Database["public"]["Tables"]["ai_retrieval_weights"]["Row"];
type AiLearningPromotionWithWeight = AiLearningPromotionRow & {
  retrievalWeight?: AiRetrievalWeightRow | null;
  sourceEvents?: AiFeedbackEventRow[] | null;
};
type PromotionStatus =
  | "candidate"
  | "approved"
  | "applied"
  | "rejected"
  | "superseded";
type PromotionAction =
  | "approve"
  | "reject"
  | "apply"
  | "pause"
  | "resume"
  | "supersede";

type RetrievalWeightImpactPreviewRow = {
  retrievalFeedbackId: string;
  sourceDocumentId: string | null;
  sourceChunkId: string | null;
  outcome: string;
  cited: boolean;
  usedInAnswer: boolean;
  originalScore: number;
  adjustedScore: number;
  originalRank: number;
  adjustedRank: number;
  matchedPromotionSource: boolean;
};

type RetrievalWeightImpactPreview = {
  multiplier: number;
  inspectedRows: number;
  matchingRows: number;
  beforeTop: RetrievalWeightImpactPreviewRow[];
  afterTop: RetrievalWeightImpactPreviewRow[];
  matchedRankChange: {
    beforeBestRank: number | null;
    afterBestRank: number | null;
  };
};

function formatDate(value: string | null) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function actionLabel(action?: string) {
  if (action === "boost") return "Boost";
  if (action === "downrank_review") return "Review down-rank";
  return action ?? "Review";
}

function canApplyPromotion(promotion: AiLearningPromotionRow) {
  if (isSkillLibraryPromotion(promotion)) return true;
  return (
    promotion.promotion_type === "retrieval_weight" ||
    promotion.promotion_type === "agent_prevention_prompt" ||
    promotion.promotion_type === "positive_task_example" ||
    promotion.promotion_type === "user_preference" ||
    promotion.promotion_type === "project_lesson" ||
    promotion.promotion_type === "attribution_rule"
  );
}

function isReviewMemoryLearning(learning: PromotionLearning) {
  return learning.action === "review_memory";
}

function applyPromotionLabel(promotion: AiLearningPromotionRow) {
  if (isSkillLibraryPromotion(promotion)) return "Apply skill";
  if (promotion.promotion_type === "retrieval_weight")
    return "Apply retrieval weight";
  if (promotion.promotion_type === "agent_prevention_prompt") {
    return "Apply prevention learning";
  }
  if (promotion.promotion_type === "positive_task_example") {
    return "Apply task example";
  }
  if (promotion.promotion_type === "user_preference") return "Apply preference";
  if (promotion.promotion_type === "project_lesson") return "Apply lesson";
  if (promotion.promotion_type === "attribution_rule")
    return "Apply attribution";
  return "Apply";
}

function promotionHelpText(promotion: AiLearningPromotionRow) {
  if (isSkillLibraryPromotion(promotion)) {
    return "Approved skill candidates can be applied into the Skill Library as active reviewed skills.";
  }
  if (promotion.promotion_type === "retrieval_weight") {
    return "Approved retrieval-weight promotions can be applied into active retrieval ranking hints.";
  }
  if (promotion.promotion_type === "agent_prevention_prompt") {
    return "Approved prevention prompts can be applied into active agent learnings used by the AI assistant.";
  }
  if (promotion.promotion_type === "positive_task_example") {
    return "Approved task examples can be applied into the promoted examples used by task generation.";
  }
  if (promotion.promotion_type === "user_preference") {
    return "Approved preferences can be applied into scoped AI memory for future assistant context.";
  }
  if (promotion.promotion_type === "project_lesson") {
    return "Approved project lessons can be applied into team-visible AI memory for future assistant context.";
  }
  if (promotion.promotion_type === "attribution_rule") {
    return "Approved attribution rules assign the linked source document to the reviewed project and audit the correction.";
  }
  return "This promotion type can be reviewed now and applied after its destination writer exists.";
}

function reviewKindLabel(kind: PromotionKind) {
  if (kind === "all") return "All";
  if (kind === "teach") return "Teach Alleato";
  if (kind === "skill") return "Skill review";
  if (kind === "memory") return "Memory";
  if (kind === "retrieval") return "Retrieval";
  if (kind === "attribution") return "Attribution";
  if (kind === "agent_prevention") return "Agent prevention";
  return "Workflow";
}

function memorySnapshotField(
  sourceEvent: AiFeedbackEventRow | null,
  field: "content" | "type" | "visibility",
) {
  const snapshot = jsonObject(sourceEvent?.before_snapshot);
  const value = snapshot[field];
  return typeof value === "string" && value.trim() ? value : null;
}

function sourceEventRoute(sourceEvent: AiFeedbackEventRow | null) {
  const value = jsonObject(sourceEvent?.source_context).route;
  return typeof value === "string" && value.trim() ? value : null;
}

function sourceEventEvidenceLink(sourceEvent: AiFeedbackEventRow | null) {
  const sourceContext = jsonObject(sourceEvent?.source_context);
  for (const key of [
    "evidenceLink",
    "sourceEvidenceLink",
    "sourceLink",
    "sourceUrl",
  ]) {
    const value = sourceContext[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function taskSnapshotLabel(
  learning: PromotionLearning,
  key: string,
): string | null {
  const value = learning.taskSnapshot?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eventStatus(value: Json, key: "status" | "promotionStatus") {
  const record = jsonObject(value);
  const status = record[key];
  return typeof status === "string" ? status : "unknown";
}

function shortId(value: string | null) {
  if (!value) return "unknown";
  return value.slice(0, 8);
}

function proposedDestinationLabel(
  promotion: AiLearningPromotionRow,
  learning: PromotionLearning,
) {
  const destination =
    learning.proposedDestination ?? promotion.destination_table;
  if (!destination) return "No destination recorded";
  return promotion.destination_record_id
    ? `${destination} · ${shortId(promotion.destination_record_id)}`
    : destination;
}

interface AiLearningPromotionsClientProps {
  initialPromotions: AiLearningPromotionRow[];
}

export function AiLearningPromotionsClient({
  initialPromotions,
}: AiLearningPromotionsClientProps) {
  const [promotions, setPromotions] =
    React.useState<AiLearningPromotionWithWeight[]>(initialPromotions);
  const [status, setStatus] = React.useState<PromotionStatus>("candidate");
  const [reviewKind, setReviewKind] = React.useState<PromotionKind>("all");
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [previewBusyId, setPreviewBusyId] = React.useState<string | null>(null);
  const [previewsById, setPreviewsById] = React.useState<
    Record<string, RetrievalWeightImpactPreview>
  >({});
  const [activityEvents, setActivityEvents] = React.useState<
    AiFeedbackEventRow[]
  >([]);
  const [activityLoading, setActivityLoading] = React.useState(false);

  const loadPromotions = React.useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch<{ promotions?: AiLearningPromotionRow[] }>(
        `/api/admin/ai-learning-promotions?status=${status}&kind=${reviewKind}&limit=100`,
        { cache: "no-store" },
      );
      setPromotions((json.promotions ?? []) as AiLearningPromotionWithWeight[]);
    } catch (error) {
      toast.error("Failed to load learning promotions", {
        description:
          error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setLoading(false);
    }
  }, [reviewKind, status]);

  React.useEffect(() => {
    void loadPromotions();
  }, [loadPromotions, status]);

  const loadActivityEvents = React.useCallback(async () => {
    setActivityLoading(true);
    try {
      const json = await apiFetch<{ events?: AiFeedbackEventRow[] }>(
        "/api/admin/ai-learning-promotions/activity?limit=25",
        { cache: "no-store" },
      );
      setActivityEvents(json.events ?? []);
    } catch (error) {
      toast.error("Failed to load learning activity", {
        description:
          error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setActivityLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadActivityEvents();
  }, [loadActivityEvents]);

  const runGenerator = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{
        candidatesFound: number;
        candidatesCreated: number;
        inspectedRows: number;
      }>("/api/admin/ai-learning-promotions/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      toast.success("Promotion scan complete", {
        description: `${result.candidatesCreated} created from ${result.inspectedRows} retrieval feedback rows.`,
      });
      await loadPromotions();
    } catch (error) {
      toast.error("Promotion scan failed", {
        description:
          error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setLoading(false);
    }
  }, [loadPromotions]);

  const reviewPromotion = React.useCallback(
    async (promotionId: string, action: PromotionAction) => {
      setBusyId(promotionId);
      try {
        await apiFetch("/api/admin/ai-learning-promotions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ promotionId, action }),
        });
        await loadPromotions();
        await loadActivityEvents();
        toast.success(
          action === "approve"
            ? "Promotion approved"
            : action === "apply"
              ? "Promotion applied"
              : action === "pause"
                ? "Retrieval weight paused"
                : action === "resume"
                  ? "Retrieval weight resumed"
                  : action === "supersede"
                    ? "Retrieval weight superseded"
                    : "Promotion rejected",
        );
      } catch (error) {
        toast.error("Review action failed", {
          description:
            error instanceof Error ? error.message : "Unexpected error",
        });
      } finally {
        setBusyId(null);
      }
    },
    [loadActivityEvents, loadPromotions],
  );

  const loadImpactPreview = React.useCallback(async (promotionId: string) => {
    setPreviewBusyId(promotionId);
    try {
      const preview = await apiFetch<RetrievalWeightImpactPreview>(
        "/api/admin/ai-learning-promotions/preview",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ promotionId, limit: 10 }),
        },
      );
      setPreviewsById((prev) => ({ ...prev, [promotionId]: preview }));
      toast.success("Impact preview loaded");
    } catch (error) {
      toast.error("Impact preview failed", {
        description:
          error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setPreviewBusyId(null);
    }
  }, []);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <SectionRuleHeading
              label="Candidate learnings"
              className="mb-0 pb-0"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Loading candidates"
                : `${promotions.length.toLocaleString()} ${reviewKindLabel(reviewKind).toLowerCase()} ${status} promotion${promotions.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status === "candidate" && (
              <Button
                variant="outline"
                size="sm"
                onClick={runGenerator}
                disabled={loading}
              >
                Generate
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadPromotions()}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs
          value={status}
          onValueChange={(value) => setStatus(value as PromotionStatus)}
        >
          <TabsList>
            <TabsTrigger value="candidate">Candidate</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="applied">Applied</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="superseded">Superseded</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs
          value={reviewKind}
          onValueChange={(value) => setReviewKind(value as PromotionKind)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="teach">Teach Alleato</TabsTrigger>
            <TabsTrigger value="skill">Skill review</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="retrieval">Retrieval</TabsTrigger>
            <TabsTrigger value="attribution">Attribution</TabsTrigger>
            <TabsTrigger value="agent_prevention">Agent prevention</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learning</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="w-32 text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && promotions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    Loading learning promotions
                  </TableCell>
                </TableRow>
              ) : promotions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No {status} learning promotions
                  </TableCell>
                </TableRow>
              ) : (
                promotions.map((promotion) => {
                  const learning = readLearning(promotion.proposed_learning);
                  const retrievalWeight = promotion.retrievalWeight ?? null;
                  const sourceEvent = firstSourceEvent(promotion);
                  const isTeachSubmission = isTeachAlleatoPromotion(promotion);
                  const isSkillCandidate = isSkillLibraryPromotion(promotion);
                  const sourceRoute =
                    learning.sourceRoute ??
                    sourceEventRoute(sourceEvent) ??
                    null;
                  const sourceUserId =
                    learning.sourceUserId ?? sourceEvent?.user_id ?? null;
                  const evidenceLink =
                    learning.sourceEvidenceLink ??
                    sourceEventEvidenceLink(sourceEvent);
                  const impactPreview = previewsById[promotion.id];
                  const isExpanded = expandedId === promotion.id;
                  const disabled = busyId === promotion.id;
                  const previewDisabled = previewBusyId === promotion.id;

                  return (
                    <React.Fragment key={promotion.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : promotion.id)
                        }
                      >
                        <TableCell className="max-w-md align-top">
                          <div className="flex items-start gap-2">
                            {isExpanded ? (
                              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">
                                {learning.title ?? promotion.promotion_type}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatDate(promotion.created_at)}</span>
                                {promotion.project_id && (
                                  <Badge variant="outline">
                                    Project {promotion.project_id}
                                  </Badge>
                                )}
                                {isTeachSubmission && (
                                  <Badge variant="outline">Teach Alleato</Badge>
                                )}
                                {isSkillCandidate && (
                                  <Badge variant="outline">Skill</Badge>
                                )}
                                <Badge variant="secondary">
                                  {actionLabel(learning.action)}
                                </Badge>
                                {retrievalWeight && (
                                  <Badge variant="outline">
                                    {retrievalWeight.status}
                                  </Badge>
                                )}
                              </div>
                              {learning.rationale && (
                                <p className="line-clamp-2 text-xs text-muted-foreground">
                                  {learning.rationale}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="font-medium text-foreground">
                            {promotion.promotion_type}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isTeachSubmission
                              ? (learning.workflowCategory ??
                                "No workflow category")
                              : isSkillCandidate
                                ? (learning.workflowCategory ??
                                  "No skill category")
                                : (learning.toolName ?? "No tool scope")}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs align-top">
                          <div className="text-sm text-foreground">
                            {isTeachSubmission
                              ? sourceUserId
                                ? `User ${shortId(sourceUserId)}`
                                : "No source user"
                              : `${promotion.source_event_ids.length} source signal(s)`}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {isTeachSubmission
                              ? (sourceRoute ?? "No source route")
                              : `${learning.signalCounts?.helpful ?? 0} helpful, ${
                                  learning.signalCounts?.problem ?? 0
                                } problem, ${learning.signalCounts?.total ?? 0} total`}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline">
                            {formatConfidence(promotion.confidence)}
                          </Badge>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {promotion.risk_level} risk
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div
                            className="flex justify-end gap-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {promotion.status === "candidate" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  disabled={disabled}
                                  aria-label="Reject promotion"
                                  onClick={() =>
                                    void reviewPromotion(promotion.id, "reject")
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  disabled={disabled}
                                  aria-label="Approve promotion"
                                  onClick={() =>
                                    void reviewPromotion(
                                      promotion.id,
                                      "approve",
                                    )
                                  }
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {promotion.status === "approved" && (
                              <div className="flex flex-col items-end gap-1">
                                <Button
                                  size="sm"
                                  disabled={
                                    disabled || !canApplyPromotion(promotion)
                                  }
                                  onClick={() =>
                                    void reviewPromotion(promotion.id, "apply")
                                  }
                                >
                                  {applyPromotionLabel(promotion)}
                                </Button>
                                {!canApplyPromotion(promotion) && (
                                  <span className="max-w-40 text-right text-xs text-muted-foreground">
                                    Review only
                                  </span>
                                )}
                              </div>
                            )}
                            {promotion.status === "applied" &&
                              retrievalWeight?.status === "active" && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  disabled={disabled}
                                  aria-label="Pause retrieval weight"
                                  onClick={() =>
                                    void reviewPromotion(promotion.id, "pause")
                                  }
                                >
                                  <PauseCircle className="h-4 w-4" />
                                </Button>
                              )}
                            {promotion.status === "applied" &&
                              retrievalWeight?.status === "paused" && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  disabled={disabled}
                                  aria-label="Resume retrieval weight"
                                  onClick={() =>
                                    void reviewPromotion(promotion.id, "resume")
                                  }
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={5} className="px-6 py-4">
                            <div className="space-y-3">
                              <dl className="grid gap-3 text-sm md:grid-cols-2">
                                <div>
                                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    {promotion.promotion_type ===
                                    "retrieval_weight"
                                      ? "Query signature"
                                      : promotion.promotion_type ===
                                          "positive_task_example"
                                        ? "Task example"
                                        : promotion.promotion_type ===
                                              "user_preference" ||
                                            promotion.promotion_type ===
                                              "project_lesson"
                                          ? "Memory"
                                          : promotion.promotion_type ===
                                              "attribution_rule"
                                            ? "Source document"
                                            : "Problem signature"}
                                  </dt>
                                  <dd className="mt-1 text-foreground">
                                    {promotion.promotion_type ===
                                    "retrieval_weight"
                                      ? (learning.querySignature ??
                                        "No query signature")
                                      : promotion.promotion_type ===
                                          "positive_task_example"
                                        ? (taskSnapshotLabel(
                                            learning,
                                            "name",
                                          ) ?? "No task name")
                                        : promotion.promotion_type ===
                                              "user_preference" ||
                                            promotion.promotion_type ===
                                              "project_lesson"
                                          ? (learning.content ??
                                            "No memory content")
                                          : promotion.promotion_type ===
                                              "attribution_rule"
                                            ? (learning.sourceDocumentId ??
                                              "No source document")
                                            : (learning.problemSignature ??
                                              "No problem signature")}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    {promotion.promotion_type ===
                                    "retrieval_weight"
                                      ? "Source"
                                      : promotion.promotion_type ===
                                          "positive_task_example"
                                        ? "Example detail"
                                        : promotion.promotion_type ===
                                              "user_preference" ||
                                            promotion.promotion_type ===
                                              "project_lesson"
                                          ? "Visibility"
                                          : promotion.promotion_type ===
                                              "attribution_rule"
                                            ? "Candidate project"
                                            : "Scope"}
                                  </dt>
                                  <dd className="mt-1 break-all text-foreground">
                                    {promotion.promotion_type ===
                                    "retrieval_weight"
                                      ? (learning.sourceChunkId ??
                                        learning.sourceDocumentId ??
                                        "No source id")
                                      : promotion.promotion_type ===
                                          "positive_task_example"
                                        ? [
                                            taskSnapshotLabel(
                                              learning,
                                              "priority",
                                            ),
                                            taskSnapshotLabel(
                                              learning,
                                              "assignee",
                                            ),
                                            taskSnapshotLabel(
                                              learning,
                                              "dueDate",
                                            ),
                                          ]
                                            .filter(Boolean)
                                            .join(" · ") || "No example detail"
                                        : promotion.promotion_type ===
                                              "user_preference" ||
                                            promotion.promotion_type ===
                                              "project_lesson"
                                          ? (learning.visibility ?? "Default")
                                          : promotion.promotion_type ===
                                              "attribution_rule"
                                            ? (learning.candidateProjectName ??
                                              "No candidate project")
                                            : (learning.pagePath ??
                                              learning.toolName ??
                                              "Global")}
                                  </dd>
                                </div>
                                {promotion.promotion_type ===
                                  "agent_prevention_prompt" && (
                                  <div className="md:col-span-2">
                                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                                      Prevention prompt
                                    </dt>
                                    <dd className="mt-1 text-foreground">
                                      {learning.preventionPrompt ??
                                        "No prevention prompt"}
                                    </dd>
                                  </div>
                                )}
                                {retrievalWeight && (
                                  <>
                                    <div>
                                      <dt className="text-xs font-medium uppercase text-muted-foreground">
                                        Retrieval weight
                                      </dt>
                                      <dd className="mt-1 text-foreground">
                                        {retrievalWeight.weight_multiplier}x,{" "}
                                        {retrievalWeight.status}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs font-medium uppercase text-muted-foreground">
                                        Destination
                                      </dt>
                                      <dd className="mt-1 break-all text-foreground">
                                        {retrievalWeight.id}
                                      </dd>
                                    </div>
                                  </>
                                )}
                              </dl>
                              {isTeachSubmission && (
                                <div className="space-y-3 border-t border-border pt-3">
                                  <div className="grid gap-3 text-sm md:grid-cols-2">
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Source user and route
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {sourceUserId
                                          ? `User ${shortId(sourceUserId)}`
                                          : "No source user"}
                                      </div>
                                      <div className="mt-1 break-all text-xs text-muted-foreground">
                                        {sourceRoute ?? "No source route"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Proposed destination
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {proposedDestinationLabel(
                                          promotion,
                                          learning,
                                        )}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {learning.appliesTo ??
                                          "No scope recorded"}{" "}
                                        ·{" "}
                                        {learning.perceivedRiskLevel ??
                                          promotion.risk_level}{" "}
                                        risk
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Workflow category
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {learning.workflowCategory ??
                                          "No category recorded"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Evidence
                                      </div>
                                      <div className="mt-1 break-all text-foreground">
                                        {isHttpUrl(evidenceLink) ? (
                                          <a
                                            href={evidenceLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-primary underline-offset-4 hover:underline"
                                          >
                                            {evidenceLink}
                                          </a>
                                        ) : (
                                          (evidenceLink ??
                                          "No evidence link recorded")
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Example input
                                      </div>
                                      <div className="mt-1 whitespace-pre-wrap text-foreground">
                                        {learning.exampleInput ??
                                          "No example input recorded"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Example output
                                      </div>
                                      <div className="mt-1 whitespace-pre-wrap text-foreground">
                                        {learning.exampleOutput ??
                                          "No example output recorded"}
                                      </div>
                                    </div>
                                    {learning.whyThisMatters && (
                                      <div className="md:col-span-2">
                                        <div className="text-xs font-medium uppercase text-muted-foreground">
                                          Why this matters
                                        </div>
                                        <div className="mt-1 whitespace-pre-wrap text-foreground">
                                          {learning.whyThisMatters}
                                        </div>
                                      </div>
                                    )}
                                    {learning.suggestedReviewer && (
                                      <div>
                                        <div className="text-xs font-medium uppercase text-muted-foreground">
                                          Suggested reviewer
                                        </div>
                                        <div className="mt-1 text-foreground">
                                          {learning.suggestedReviewer}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {isReviewMemoryLearning(learning) && (
                                <div className="space-y-3 border-t border-border pt-3">
                                  <div className="grid gap-3 text-sm md:grid-cols-2">
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Correction
                                      </div>
                                      <div className="mt-1 whitespace-pre-wrap text-foreground">
                                        {sourceEvent?.free_text ??
                                          learning.reason ??
                                          "No correction text recorded"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Source
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {learning.sourceSurface ??
                                          sourceEvent?.surface ??
                                          "Unknown surface"}
                                      </div>
                                      <div className="mt-1 break-all text-xs text-muted-foreground">
                                        {learning.sourceRoute ??
                                          sourceEventRoute(sourceEvent) ??
                                          "No route recorded"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Before snapshot
                                      </div>
                                      <div className="mt-1 whitespace-pre-wrap text-foreground">
                                        {memorySnapshotField(
                                          sourceEvent,
                                          "content",
                                        ) ??
                                          learning.content ??
                                          "No memory snapshot recorded"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Memory scope
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {memorySnapshotField(
                                          sourceEvent,
                                          "type",
                                        ) ??
                                          learning.memoryType ??
                                          "Unknown type"}{" "}
                                        ·{" "}
                                        {memorySnapshotField(
                                          sourceEvent,
                                          "visibility",
                                        ) ??
                                          learning.visibility ??
                                          "unknown visibility"}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {promotion.project_id
                                          ? `Project ${promotion.project_id}`
                                          : "No project scope"}{" "}
                                        · {promotion.risk_level} risk
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {learning.recommendedResolution ??
                                      "Quick actions are unavailable until review-memory writers can edit or retire the existing memory with an audit event."}
                                  </div>
                                </div>
                              )}
                              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
                                {JSON.stringify(
                                  promotion.proposed_learning,
                                  null,
                                  2,
                                )}
                              </pre>
                              <div className="flex items-center gap-3 pt-1">
                                <span className="text-xs text-muted-foreground">
                                  {promotionHelpText(promotion)}
                                </span>
                                {promotion.promotion_type ===
                                  "retrieval_weight" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={previewDisabled}
                                    onClick={() =>
                                      void loadImpactPreview(promotion.id)
                                    }
                                  >
                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                    Preview impact
                                  </Button>
                                )}
                                {promotion.status === "candidate" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={disabled}
                                      onClick={() =>
                                        void reviewPromotion(
                                          promotion.id,
                                          "reject",
                                        )
                                      }
                                    >
                                      <X className="mr-1.5 h-3.5 w-3.5" />
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={disabled}
                                      onClick={() =>
                                        void reviewPromotion(
                                          promotion.id,
                                          "approve",
                                        )
                                      }
                                    >
                                      <Check className="mr-1.5 h-3.5 w-3.5" />
                                      Approve
                                    </Button>
                                  </>
                                )}
                                {promotion.status === "approved" && (
                                  <div className="flex flex-col items-start gap-1">
                                    <Button
                                      size="sm"
                                      disabled={
                                        disabled ||
                                        !canApplyPromotion(promotion)
                                      }
                                      onClick={() =>
                                        void reviewPromotion(
                                          promotion.id,
                                          "apply",
                                        )
                                      }
                                    >
                                      {applyPromotionLabel(promotion)}
                                    </Button>
                                    {!canApplyPromotion(promotion) && (
                                      <span className="text-xs text-muted-foreground">
                                        Apply is disabled until the Skill
                                        Library approval writer exists.
                                      </span>
                                    )}
                                  </div>
                                )}
                                {promotion.status === "applied" &&
                                  retrievalWeight?.status === "active" && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={disabled}
                                        onClick={() =>
                                          void reviewPromotion(
                                            promotion.id,
                                            "pause",
                                          )
                                        }
                                      >
                                        <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                                        Pause
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={disabled}
                                        onClick={() =>
                                          void reviewPromotion(
                                            promotion.id,
                                            "supersede",
                                          )
                                        }
                                      >
                                        <Ban className="mr-1.5 h-3.5 w-3.5" />
                                        Supersede
                                      </Button>
                                    </>
                                  )}
                                {promotion.status === "applied" &&
                                  retrievalWeight?.status === "paused" && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={disabled}
                                        onClick={() =>
                                          void reviewPromotion(
                                            promotion.id,
                                            "resume",
                                          )
                                        }
                                      >
                                        <Play className="mr-1.5 h-3.5 w-3.5" />
                                        Resume
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={disabled}
                                        onClick={() =>
                                          void reviewPromotion(
                                            promotion.id,
                                            "supersede",
                                          )
                                        }
                                      >
                                        <Ban className="mr-1.5 h-3.5 w-3.5" />
                                        Supersede
                                      </Button>
                                    </>
                                  )}
                              </div>
                              {impactPreview && (
                                <div className="space-y-3 border-t border-border pt-3">
                                  <div className="grid gap-3 text-sm md:grid-cols-4">
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Multiplier
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {impactPreview.multiplier}x
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Matching rows
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {impactPreview.matchingRows} of{" "}
                                        {impactPreview.inspectedRows}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Best before
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {impactPreview.matchedRankChange
                                          .beforeBestRank ?? "No match"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase text-muted-foreground">
                                        Best after
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {impactPreview.matchedRankChange
                                          .afterBestRank ?? "No match"}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="grid gap-4 text-xs md:grid-cols-2">
                                    <div>
                                      <div className="mb-2 font-medium text-foreground">
                                        Before
                                      </div>
                                      <div className="space-y-1">
                                        {impactPreview.beforeTop.map((row) => (
                                          <div
                                            key={`before-${row.retrievalFeedbackId}`}
                                            className="flex items-center justify-between gap-3 border-t border-border/70 py-1.5"
                                          >
                                            <span className="truncate text-muted-foreground">
                                              #{row.originalRank} {row.outcome}
                                              {row.matchedPromotionSource
                                                ? " · matched"
                                                : ""}
                                            </span>
                                            <span className="font-mono text-foreground">
                                              {formatNumber(
                                                row.originalScore,
                                                3,
                                              )}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="mb-2 font-medium text-foreground">
                                        After
                                      </div>
                                      <div className="space-y-1">
                                        {impactPreview.afterTop.map((row) => (
                                          <div
                                            key={`after-${row.retrievalFeedbackId}`}
                                            className="flex items-center justify-between gap-3 border-t border-border/70 py-1.5"
                                          >
                                            <span className="truncate text-muted-foreground">
                                              #{row.adjustedRank} {row.outcome}
                                              {row.matchedPromotionSource
                                                ? " · matched"
                                                : ""}
                                            </span>
                                            <span className="font-mono text-foreground">
                                              {formatNumber(
                                                row.adjustedScore,
                                                3,
                                              )}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <SectionRuleHeading
              label="Learning activity"
              className="mb-0 pb-0"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {activityLoading
                ? "Loading activity"
                : `${activityEvents.length.toLocaleString()} recent learning event${activityEvents.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadActivityEvents()}
            disabled={activityLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="divide-y divide-border rounded-md border border-border">
          {activityEvents.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8" />}
              title="No learning activity yet"
              description="Learning-control changes will appear here after retrieval weights are paused, resumed, or superseded."
            />
          ) : (
            activityEvents.map((event) => {
              const subjectLabel =
                event.subject_type === "ai_retrieval_weight"
                  ? "Retrieval weight"
                  : "Promotion";

              return (
                <div key={event.id} className="flex gap-3 px-4 py-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <History className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {eventStatus(event.before_snapshot, "status")} to{" "}
                        {eventStatus(event.after_snapshot, "status")}
                      </span>
                      <Badge variant="outline">{event.signal}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(event.created_at)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Promotion {shortId(event.source_record_id)} ·{" "}
                      {subjectLabel} {shortId(event.subject_id)} · User{" "}
                      {shortId(event.user_id)}
                    </div>
                    {event.free_text && (
                      <p className="text-sm text-foreground">
                        {event.free_text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
