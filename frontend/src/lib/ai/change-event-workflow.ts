import {
  CHANGE_REQUEST_SCOPE_OPTIONS,
  CHANGE_REQUEST_TYPE_OPTIONS,
} from "@/lib/ai/workflow-registry";
import type { RetrievalContext } from "@/lib/ai/retrieval/types";

export type ChangeEventWorkflowChecklistKey =
  | "project"
  | "event_understood"
  | "cause_identified"
  | "cost_impact"
  | "schedule_impact"
  | "supporting_docs"
  | "related_records"
  | "review_create";

export type ChangeEventWorkflowStatus = "complete" | "active" | "missing";

export type ChangeEventWorkflowChecklistItem = {
  key: ChangeEventWorkflowChecklistKey;
  label: string;
  status: ChangeEventWorkflowStatus;
  helper: string;
};

export type ChangeEventWorkflowEvidenceSuggestion = {
  id: string;
  title: string;
  sourceType: "meeting" | "email" | "teams" | "document" | "project_record" | "knowledge";
  sourceLabel: string;
  snippet: string;
  date: string | null;
  confidence: "low" | "medium" | "high";
  recordId: string | null;
};

export type ChangeEventWorkflowDraft = {
  projectId: number | null;
  projectName: string | null;
  title: string | null;
  narrative: string | null;
  cause: (typeof CHANGE_REQUEST_TYPE_OPTIONS)[number] | null;
  scope: (typeof CHANGE_REQUEST_SCOPE_OPTIONS)[number];
  costImpact: string | null;
  scheduleImpact: string | null;
  ownerNotified: "yes" | "no" | "unknown";
  supportingDocs: string[];
  relatedRecordHints: string[];
  relatedEvidence: ChangeEventWorkflowEvidenceSuggestion[];
  recommendedImpacts: string[];
  missingRisks: string[];
  nextQuestion: string;
  readyForPreview: boolean;
  confirmPrompt: string;
  checklist: ChangeEventWorkflowChecklistItem[];
};

type BuildChangeEventWorkflowDraftParams = {
  prompt: string;
  selectedProjectId?: number | null;
  selectedProjectName?: string | null;
  previousDraft?: unknown;
  relatedEvidence?: ChangeEventWorkflowEvidenceSuggestion[];
};

const DEFAULT_TITLE = "New change event";
export const CHANGE_EVENT_WORKFLOW_METADATA_VERSION = 1;

export type ChangeEventWorkflowMetadata = {
  version: typeof CHANGE_EVENT_WORKFLOW_METADATA_VERSION;
  workflowKey: "change_event";
  widgetType: "change_event_workflow";
  expectedNativeTool: "createChangeEvent";
  writeOwner: "createChangeEvent";
  updatedAt: string;
  source: "ai_assistant_chat";
  draft: ChangeEventWorkflowDraft;
  readiness: {
    readyForPreview: boolean;
    missingChecklistKeys: ChangeEventWorkflowChecklistKey[];
    activeChecklistKey: ChangeEventWorkflowChecklistKey | null;
    evidenceCount: number;
    evidenceSourcePath: "semantic_vector_search" | "none";
  };
};

export type ChangeEventWorkflowDraftEdits = {
  projectId?: number | null;
  projectName?: string | null;
  title?: string | null;
  narrative?: string | null;
  cause?: ChangeEventWorkflowDraft["cause"];
  scope?: ChangeEventWorkflowDraft["scope"];
  costImpact?: string | null;
  scheduleImpact?: string | null;
  ownerNotified?: ChangeEventWorkflowDraft["ownerNotified"];
  supportingDocs?: string[];
  relatedRecordHints?: string[];
};

function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, " ");
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readEvidenceSuggestion(value: unknown): ChangeEventWorkflowEvidenceSuggestion | null {
  const record = readRecord(value);
  if (!record) return null;
  const id = readString(record.id);
  const title = readString(record.title);
  const snippet = readString(record.snippet);
  const sourceLabel = readString(record.sourceLabel);
  const sourceType = record.sourceType;
  const confidence = record.confidence;
  if (!id || !title || !snippet || !sourceLabel) return null;
  if (
    sourceType !== "meeting" &&
    sourceType !== "email" &&
    sourceType !== "teams" &&
    sourceType !== "document" &&
    sourceType !== "project_record" &&
    sourceType !== "knowledge"
  ) {
    return null;
  }
  return {
    id,
    title,
    sourceType,
    sourceLabel,
    snippet,
    date: readString(record.date),
    confidence:
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : "medium",
    recordId: readString(record.recordId),
  };
}

function readEvidenceSuggestions(value: unknown): ChangeEventWorkflowEvidenceSuggestion[] {
  return Array.isArray(value)
    ? value.map(readEvidenceSuggestion).filter((item): item is ChangeEventWorkflowEvidenceSuggestion => Boolean(item))
    : [];
}

function readExistingDraft(value: unknown): Partial<ChangeEventWorkflowDraft> {
  const draft = readRecord(value);
  if (!draft) return {};
  return {
    projectId: readNumber(draft.projectId),
    projectName: readString(draft.projectName),
    title: readString(draft.title),
    narrative: readString(draft.narrative),
    cause: CHANGE_REQUEST_TYPE_OPTIONS.includes(draft.cause as never)
      ? (draft.cause as ChangeEventWorkflowDraft["cause"])
      : null,
    scope: CHANGE_REQUEST_SCOPE_OPTIONS.includes(draft.scope as never)
      ? (draft.scope as ChangeEventWorkflowDraft["scope"])
      : undefined,
    costImpact: readString(draft.costImpact),
    scheduleImpact: readString(draft.scheduleImpact),
    ownerNotified:
      draft.ownerNotified === "yes" || draft.ownerNotified === "no"
        ? draft.ownerNotified
        : draft.ownerNotified === "unknown"
          ? "unknown"
          : undefined,
    supportingDocs: readStringArray(draft.supportingDocs),
    relatedRecordHints: readStringArray(draft.relatedRecordHints),
    relatedEvidence: readEvidenceSuggestions(draft.relatedEvidence),
  };
}

function inferTitle(prompt: string): string | null {
  const normalized = normalizePrompt(prompt)
    .replace(/^(please\s+)?(help me\s+)?(create|draft|log|add|make)\s+/i, "")
    .replace(/^a\s+new\s+/i, "")
    .replace(/^change\s+(event|request)\s*(for|about|to|:)?\s*/i, "")
    .replace(/\?+$/, "")
    .trim();

  if (!normalized || normalized.length < 12) return null;
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function inferProjectIdFromPrompt(prompt: string): number | null {
  const match = prompt.match(/\bproject\s+id\s*[:#-]?\s*(\d+)\b/i);
  if (!match?.[1]) return null;
  const projectId = Number(match[1]);
  return Number.isFinite(projectId) ? projectId : null;
}

function inferProjectNameFromPrompt(prompt: string): string | null {
  const explicit = prompt.match(/\bproject\s+name\s*:\s*([^.\n]+?)(?:\s+for\s+this\b|[.\n]|$)/i)?.[1]?.trim();
  if (explicit) return explicit;
  return prompt.match(/\buse\s+project\s+\d+\s*-\s*([^.\n]+?)(?:\s+for\s+this\b|[.\n]|$)/i)?.[1]?.trim() ?? null;
}

function isProjectSelectionResponse(prompt: string): boolean {
  return (
    /\buse\s+project\s+\d+\s*-/i.test(prompt) ||
    (/\bproject\s+id\s*[:#-]?\s*\d+\b/i.test(prompt) &&
      /\bproject\s+name\s*:/i.test(prompt))
  );
}

function isGenericChangeEventStart(prompt: string): boolean {
  const normalized = normalizePrompt(prompt).toLowerCase();
  return (
    /^(can you\s+)?(please\s+)?(help me\s+)?(create|make|start|draft|log|document)\s+(a\s+new\s+|a\s+|new\s+)?change\s+(event|request)[?.!]*$/.test(
      normalized,
    ) ||
    /^(can you\s+)?help me\s+(create|make|start|draft|log|document)\s+(a\s+new\s+|a\s+|new\s+)?change\s+(event|request)[?.!]*$/.test(
      normalized,
    )
  );
}

function inferCause(lower: string): ChangeEventWorkflowDraft["cause"] {
  if (containsAny(lower, ["owner request", "owner requested", "owner wants", "client request", "client requested"])) {
    return "Owner Requested";
  }
  if (containsAny(lower, ["design", "drawing", "drawings", "spec", "specification", "architect"])) {
    return "Design Change";
  }
  if (containsAny(lower, ["unforeseen", "existing condition", "hidden condition", "discovered", "found"])) {
    return "Unforeseen Condition";
  }
  if (containsAny(lower, ["field issue", "field condition", "constructability"])) {
    return "Constructability Issue";
  }
  if (containsAny(lower, ["code", "inspector", "inspection", "permit"])) {
    return "Constructability Issue";
  }
  if (containsAny(lower, ["value engineer", "value engineering", "ve "])) {
    return "Value Engineering";
  }
  if (containsAny(lower, ["allowance"])) {
    return "Allowance";
  }
  if (containsAny(lower, ["scope gap", "missed scope"])) {
    return "Scope Gap";
  }
  return null;
}

function inferScope(lower: string, cause: ChangeEventWorkflowDraft["cause"]): ChangeEventWorkflowDraft["scope"] {
  if (containsAny(lower, ["out of scope", "outside scope", "not in scope", "owner cost", "billable"])) {
    return "Out of Scope";
  }
  if (containsAny(lower, ["in scope", "included in scope"])) {
    return "In Scope";
  }
  if (containsAny(lower, ["allowance"])) {
    return "Allowance";
  }
  if (cause === "Owner Requested") {
    return "Out of Scope";
  }
  return "TBD";
}

function inferCostImpact(lower: string): string | null {
  const moneyMatch = lower.match(/\$[\d,]+(?:\.\d{2})?/);
  if (moneyMatch) return moneyMatch[0];
  if (containsAny(lower, ["no cost", "no added cost", "zero cost"])) return "No cost impact expected";
  if (containsAny(lower, ["cost impact", "pricing", "price", "estimate", "budget"])) return "Cost impact needs estimate";
  return null;
}

function inferScheduleImpact(lower: string): string | null {
  if (containsAny(lower, ["no schedule", "no time impact", "no delay"])) return "No schedule impact expected";
  const scheduleMatch = lower.match(/(\d+\s+(?:day|days|week|weeks)\s+(?:delay|impact|extension))/);
  if (scheduleMatch) return scheduleMatch[1];
  if (containsAny(lower, ["schedule", "delay", "critical path", "time impact"])) return "Schedule impact needs confirmation";
  return null;
}

function inferOwnerNotified(lower: string): ChangeEventWorkflowDraft["ownerNotified"] {
  if (
    containsAny(lower, [
      "owner approved",
      "owner notified",
      "owner was notified",
      "told the owner",
      "sent to owner",
      "client approved",
      "client was notified",
    ])
  ) {
    return "yes";
  }
  if (containsAny(lower, ["owner not notified", "not told owner", "client not notified"])) {
    return "no";
  }
  return "unknown";
}

function inferSupportingDocs(lower: string): string[] {
  const docs: string[] = [];
  if (containsAny(lower, ["photo", "photos", "picture", "pictures"])) docs.push("Photos");
  if (containsAny(lower, ["drawing", "drawings", "plan", "plans"])) docs.push("Drawings");
  if (containsAny(lower, ["rfi"])) docs.push("RFI");
  if (containsAny(lower, ["email", "owner email", "client email"])) docs.push("Email");
  if (containsAny(lower, ["meeting", "minutes"])) docs.push("Meeting notes");
  if (containsAny(lower, ["daily log", "daily report"])) docs.push("Daily log");
  return Array.from(new Set(docs));
}

function buildRelatedRecordHints(lower: string): string[] {
  const hints: string[] = [];
  if (containsAny(lower, ["drawing", "drawings", "plan", "plans", "spec"])) hints.push("Check drawings/specifications");
  if (containsAny(lower, ["rfi"])) hints.push("Check related RFIs");
  if (containsAny(lower, ["meeting", "minutes"])) hints.push("Check meeting notes");
  if (containsAny(lower, ["daily log", "daily report", "field"])) hints.push("Check daily logs");
  if (containsAny(lower, ["email", "owner", "client"])) hints.push("Check owner/client emails");
  return hints;
}

function buildRecommendedImpacts(draft: Pick<ChangeEventWorkflowDraft, "cause" | "scope" | "costImpact" | "scheduleImpact">): string[] {
  const impacts: string[] = [];
  if (draft.cause) impacts.push(`Classify as ${draft.cause} unless project evidence points elsewhere.`);
  if (draft.scope === "TBD") impacts.push("Keep scope as TBD until PM confirms whether this is billable.");
  if (!draft.costImpact) impacts.push("Ask for rough cost exposure before final preview.");
  if (!draft.scheduleImpact) impacts.push("Ask whether schedule or critical path is affected.");
  return impacts;
}

function buildMissingRisks(draft: Pick<ChangeEventWorkflowDraft, "costImpact" | "scheduleImpact" | "ownerNotified" | "supportingDocs">): string[] {
  const risks: string[] = [];
  if (!draft.costImpact) risks.push("Cost exposure is not documented.");
  if (!draft.scheduleImpact) risks.push("Schedule impact is not documented.");
  if (draft.ownerNotified === "unknown") risks.push("Owner/client notification is unclear.");
  if (draft.supportingDocs.length === 0) risks.push("No supporting documents are referenced yet.");
  return risks;
}

function status(complete: boolean, active: boolean): ChangeEventWorkflowStatus {
  if (complete) return "complete";
  return active ? "active" : "missing";
}

function buildChecklist(draft: Omit<ChangeEventWorkflowDraft, "checklist">): ChangeEventWorkflowChecklistItem[] {
  const hasProject = Boolean(draft.projectId);
  const hasNarrative = Boolean(draft.narrative && draft.narrative.length >= 24);
  const hasTitle = Boolean(draft.title);
  const hasCause = Boolean(draft.cause);
  const hasCreateRequiredFields = hasProject && hasTitle && hasCause && Boolean(draft.scope);
  const hasCost = Boolean(draft.costImpact);
  const hasSchedule = Boolean(draft.scheduleImpact);
  const hasDocs = draft.supportingDocs.length > 0;
  const hasRelatedRecords = draft.relatedRecordHints.length > 0 || draft.relatedEvidence.length > 0;
  const readyForReview = hasCreateRequiredFields;

  return [
    {
      key: "project",
      label: "Project selected",
      status: status(hasProject, !hasProject),
      helper: hasProject ? "Project context is available." : "Select or name the project first.",
    },
    {
      key: "event_understood",
      label: "Event understood",
      status: status(hasNarrative, hasProject && !hasNarrative),
      helper: hasNarrative ? "The event narrative is usable." : "Capture what changed and why it matters.",
    },
    {
      key: "cause_identified",
      label: "Cause identified",
      status: status(hasCause, hasNarrative && !hasCause),
      helper: hasCause ? `Suggested cause: ${draft.cause}.` : "Choose owner request, design change, field issue, or another cause.",
    },
    {
      key: "cost_impact",
      label: "Cost impact",
      status: status(hasCost, hasCause && !hasCost),
      helper: hasCost ? draft.costImpact ?? "" : "Ask for a rough estimate or confirm no cost impact.",
    },
    {
      key: "schedule_impact",
      label: "Schedule impact",
      status: status(hasSchedule, hasCause && !hasSchedule),
      helper: hasSchedule ? draft.scheduleImpact ?? "" : "Ask whether this affects dates, sequencing, or critical path.",
    },
    {
      key: "supporting_docs",
      label: "Supporting docs",
      status: status(hasDocs, hasCause && !hasDocs),
      helper: hasDocs ? draft.supportingDocs.join(", ") : "Look for photos, drawings, RFIs, emails, meeting notes, or daily logs.",
    },
    {
      key: "related_records",
      label: "Related records",
      status: status(hasRelatedRecords, hasCause && !hasRelatedRecords),
      helper: hasRelatedRecords
        ? draft.relatedEvidence.length > 0
          ? `${draft.relatedEvidence.length} related source${draft.relatedEvidence.length === 1 ? "" : "s"} found.`
          : draft.relatedRecordHints.join(", ")
        : "No related record hints yet.",
    },
    {
      key: "review_create",
      label: "Review and create",
      status: status(readyForReview, readyForReview),
      helper: readyForReview
        ? "Ready to prepare the final create preview."
        : "Needs project, title, type, and scope before final review.",
    },
  ];
}

function nextQuestionFor(draft: Omit<ChangeEventWorkflowDraft, "checklist" | "nextQuestion" | "confirmPrompt">): string {
  if (!draft.projectId) return "What project is this change event for?";
  if (!draft.narrative || draft.narrative.length < 24) {
    return "Tell me what happened. Do not worry about organizing it, I will structure it into a clean change event draft.";
  }
  if (!draft.cause) {
    return "What caused this change: owner request, design change, unforeseen condition, field issue, code requirement, value engineering, allowance, or something else?";
  }
  if (!draft.costImpact) {
    return "Do you have a rough cost impact yet, or should I mark cost as TBD for now?";
  }
  if (!draft.scheduleImpact) {
    return "Do you expect any schedule impact, sequencing issue, or critical-path delay?";
  }
  if (draft.ownerNotified === "unknown") {
    return "Has the owner or client already been notified about this?";
  }
  return "There is enough information to prepare the final change-event preview. Review it before creating it?";
}

function buildConfirmPrompt(draft: Omit<ChangeEventWorkflowDraft, "checklist" | "confirmPrompt">): string {
  return [
    "Prepare the final createChangeEvent preview from this live intake draft.",
    "Do not create the record yet. Call createChangeEvent with confirmed=false when required fields are present, then wait for my confirmation.",
    "",
    `Project ID: ${draft.projectId ?? "missing"}`,
    `Title: ${draft.title ?? DEFAULT_TITLE}`,
    `Description: ${draft.narrative ?? "missing"}`,
    `Type: ${draft.cause ?? "missing"}`,
    `Scope: ${draft.scope}`,
    `Cost impact: ${draft.costImpact ?? "missing"}`,
    `Schedule impact: ${draft.scheduleImpact ?? "missing"}`,
    `Owner/client notified: ${draft.ownerNotified}`,
    `Supporting docs: ${draft.supportingDocs.length > 0 ? draft.supportingDocs.join(", ") : "missing"}`,
    `Related evidence: ${
      draft.relatedEvidence.length > 0
        ? draft.relatedEvidence.map((item) => `${item.sourceLabel}: ${item.title}`).join("; ")
        : "none attached"
    }`,
  ].join("\n");
}

function mergeUnique(...values: Array<string[] | undefined>): string[] {
  return Array.from(
    new Set(values.flatMap((items) => items ?? []).filter((item) => item.trim())),
  );
}

function mergeEvidenceSuggestions(
  ...values: Array<ChangeEventWorkflowEvidenceSuggestion[] | undefined>
): ChangeEventWorkflowEvidenceSuggestion[] {
  const merged = new Map<string, ChangeEventWorkflowEvidenceSuggestion>();
  for (const item of values.flatMap((items) => items ?? [])) {
    const key = `${item.sourceType}:${item.recordId ?? item.title}:${item.snippet.slice(0, 80)}`.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }
  return Array.from(merged.values()).slice(0, 5);
}

function combineNarrative(previous: string | null | undefined, current: string | null): string | null {
  if (!previous) return current;
  if (!current) return previous;
  if (previous.includes(current)) return previous;
  return `${previous}\n\nFollow-up: ${current}`;
}

function finalizeDraft(
  draftBase: Omit<
    ChangeEventWorkflowDraft,
    "recommendedImpacts" | "missingRisks" | "nextQuestion" | "readyForPreview" | "confirmPrompt" | "checklist"
  >,
): ChangeEventWorkflowDraft {
  const draft = {
    ...draftBase,
    recommendedImpacts: [] as string[],
    missingRisks: [] as string[],
    nextQuestion: "",
    readyForPreview: false,
    confirmPrompt: "",
    checklist: [] as ChangeEventWorkflowChecklistItem[],
  };

  draft.recommendedImpacts = buildRecommendedImpacts(draft);
  draft.missingRisks = buildMissingRisks(draft);
  draft.readyForPreview = Boolean(
    draft.projectId && draft.title && draft.cause && draft.scope,
  );
  draft.nextQuestion = nextQuestionFor(draft);
  draft.confirmPrompt = buildConfirmPrompt(draft);
  draft.checklist = buildChecklist(draft);
  return draft;
}

function optionalEditedString(
  edits: ChangeEventWorkflowDraftEdits,
  key: "projectName" | "title" | "narrative" | "costImpact" | "scheduleImpact",
  fallback: string | null,
): string | null {
  if (!Object.prototype.hasOwnProperty.call(edits, key)) return fallback;
  const value = edits[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function applyChangeEventWorkflowDraftEdits({
  workflow,
  edits,
  updatedAt,
}: {
  workflow: ChangeEventWorkflowMetadata;
  edits: ChangeEventWorkflowDraftEdits;
  updatedAt?: string;
}): ChangeEventWorkflowMetadata {
  const current = workflow.draft;
  const draft = finalizeDraft({
    projectId: Object.prototype.hasOwnProperty.call(edits, "projectId")
      ? edits.projectId ?? null
      : current.projectId,
    projectName: optionalEditedString(edits, "projectName", current.projectName),
    title: optionalEditedString(edits, "title", current.title),
    narrative: optionalEditedString(edits, "narrative", current.narrative),
    cause: Object.prototype.hasOwnProperty.call(edits, "cause")
      ? edits.cause ?? null
      : current.cause,
    scope: edits.scope ?? current.scope,
    costImpact: optionalEditedString(edits, "costImpact", current.costImpact),
    scheduleImpact: optionalEditedString(
      edits,
      "scheduleImpact",
      current.scheduleImpact,
    ),
    ownerNotified: edits.ownerNotified ?? current.ownerNotified,
    supportingDocs: edits.supportingDocs ?? current.supportingDocs,
    relatedRecordHints: edits.relatedRecordHints ?? current.relatedRecordHints,
    relatedEvidence: current.relatedEvidence,
  });
  const missingChecklistKeys = draft.checklist
    .filter((item) => item.status !== "complete")
    .map((item) => item.key);
  const activeChecklistKey =
    draft.checklist.find((item) => item.status === "active")?.key ?? null;

  return {
    ...workflow,
    updatedAt: updatedAt ?? new Date().toISOString(),
    draft,
    readiness: {
      readyForPreview: draft.readyForPreview,
      missingChecklistKeys,
      activeChecklistKey,
      evidenceCount: draft.relatedEvidence.length,
      evidenceSourcePath:
        draft.relatedEvidence.length > 0 ? "semantic_vector_search" : "none",
    },
  };
}

export function buildChangeEventWorkflowDraft({
  prompt,
  selectedProjectId = null,
  selectedProjectName = null,
  previousDraft,
  relatedEvidence,
}: BuildChangeEventWorkflowDraftParams): ChangeEventWorkflowDraft {
  const normalizedPrompt = normalizePrompt(prompt);
  const lower = normalizedPrompt.toLowerCase();
  const previous = readExistingDraft(previousDraft);
  const promptProjectId = inferProjectIdFromPrompt(normalizedPrompt);
  const promptProjectName = inferProjectNameFromPrompt(normalizedPrompt);
  const workflowControlOnly =
    isProjectSelectionResponse(normalizedPrompt) ||
    isGenericChangeEventStart(normalizedPrompt);
  const title = workflowControlOnly ? null : inferTitle(normalizedPrompt);
  const cause = workflowControlOnly ? null : inferCause(lower);
  const scope = workflowControlOnly ? "TBD" : inferScope(lower, cause);
  const costImpact = workflowControlOnly ? null : inferCostImpact(lower);
  const scheduleImpact = workflowControlOnly ? null : inferScheduleImpact(lower);
  const ownerNotified = workflowControlOnly ? "unknown" : inferOwnerNotified(lower);
  const supportingDocs = workflowControlOnly ? [] : inferSupportingDocs(lower);
  const relatedRecordHints = workflowControlOnly ? [] : buildRelatedRecordHints(lower);
  const narrative =
    !workflowControlOnly && normalizedPrompt.length >= 24 ? normalizedPrompt : null;
  const previousNarrative =
    previous.narrative && !isGenericChangeEventStart(previous.narrative)
      ? previous.narrative
      : null;
  const looksLikeNewChangeEventRequest = containsAny(lower, [
    "change event",
    "change request",
    "potential change",
  ]);

  return finalizeDraft({
    projectId: selectedProjectId ?? promptProjectId ?? previous.projectId ?? null,
    projectName: selectedProjectName ?? promptProjectName ?? previous.projectName ?? null,
    title:
      looksLikeNewChangeEventRequest || !previous.title
        ? title ?? previous.title ?? (narrative ? DEFAULT_TITLE : null)
        : previous.title,
    narrative: combineNarrative(previousNarrative, narrative),
    cause: cause ?? previous.cause ?? null,
    scope: scope !== "TBD" ? scope : previous.scope ?? scope,
    costImpact: costImpact ?? previous.costImpact ?? null,
    scheduleImpact: scheduleImpact ?? previous.scheduleImpact ?? null,
    ownerNotified:
      ownerNotified !== "unknown" ? ownerNotified : previous.ownerNotified ?? ownerNotified,
    supportingDocs: mergeUnique(previous.supportingDocs, supportingDocs),
    relatedRecordHints: mergeUnique(previous.relatedRecordHints, relatedRecordHints),
    relatedEvidence: mergeEvidenceSuggestions(relatedEvidence, previous.relatedEvidence),
  });
}

export function buildChangeEventWorkflowMetadata(params: {
  prompt: string;
  selectedProjectId?: number | null;
  selectedProjectName?: string | null;
  previousDraft?: unknown;
  relatedEvidence?: ChangeEventWorkflowEvidenceSuggestion[];
  updatedAt?: string;
}): ChangeEventWorkflowMetadata {
  const draft = buildChangeEventWorkflowDraft(params);
  const missingChecklistKeys = draft.checklist
    .filter((item) => item.status !== "complete")
    .map((item) => item.key);
  const activeChecklistKey =
    draft.checklist.find((item) => item.status === "active")?.key ?? null;

  return {
    version: CHANGE_EVENT_WORKFLOW_METADATA_VERSION,
    workflowKey: "change_event",
    widgetType: "change_event_workflow",
    expectedNativeTool: "createChangeEvent",
    writeOwner: "createChangeEvent",
    updatedAt: params.updatedAt ?? new Date().toISOString(),
    source: "ai_assistant_chat",
    draft,
    readiness: {
      readyForPreview: draft.readyForPreview,
      missingChecklistKeys,
      activeChecklistKey,
      evidenceCount: draft.relatedEvidence.length,
      evidenceSourcePath: draft.relatedEvidence.length > 0 ? "semantic_vector_search" : "none",
    },
  };
}

type SemanticResult = {
  content?: string;
  sourceTable?: string;
  recordId?: string | number;
  similarity?: number;
  finalScore?: number;
  createdAt?: string | null;
  metadata?: Record<string, unknown>;
};

function normalizeEvidenceText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function confidenceFromScore(score: unknown): ChangeEventWorkflowEvidenceSuggestion["confidence"] {
  if (typeof score !== "number" || !Number.isFinite(score)) return "medium";
  if (score >= 0.72) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function sourceTypeFromResult(result: SemanticResult): ChangeEventWorkflowEvidenceSuggestion["sourceType"] {
  const source = `${result.sourceTable ?? ""} ${String(result.metadata?.type ?? "")} ${String(result.metadata?.source ?? "")}`.toLowerCase();
  if (source.includes("meeting") || source.includes("fireflies")) return "meeting";
  if (source.includes("email") || source.includes("outlook")) return "email";
  if (source.includes("teams")) return "teams";
  if (source.includes("project")) return "project_record";
  if (source.includes("document") || source.includes("drawing") || source.includes("spec")) return "document";
  return "knowledge";
}

function sourceLabelFor(sourceType: ChangeEventWorkflowEvidenceSuggestion["sourceType"]): string {
  switch (sourceType) {
    case "meeting":
      return "Meeting";
    case "email":
      return "Email";
    case "teams":
      return "Teams";
    case "document":
      return "Document";
    case "project_record":
      return "Project record";
    case "knowledge":
      return "Knowledge";
  }
}

function evidenceTitleFromResult(result: SemanticResult, index: number): string {
  const metadata = result.metadata ?? {};
  return (
    readString(metadata.subject) ??
    readString(metadata.title) ??
    readString(metadata.meeting_title) ??
    readString(metadata.file_name) ??
    readString(metadata.name) ??
    result.sourceTable ??
    `Related source ${index + 1}`
  );
}

function evidenceDateFromResult(result: SemanticResult): string | null {
  const metadata = result.metadata ?? {};
  return (
    readString(result.createdAt) ??
    readString(metadata.date) ??
    readString(metadata.sent_at) ??
    readString(metadata.meeting_date) ??
    readString(metadata.created_at)
  );
}

export function buildChangeEventRelatedEvidence(
  retrievalCtx: Pick<RetrievalContext, "semanticVectorResults"> | null | undefined,
): ChangeEventWorkflowEvidenceSuggestion[] {
  const wrapper = readRecord(retrievalCtx?.semanticVectorResults);
  const results = Array.isArray(wrapper?.results) ? (wrapper.results as SemanticResult[]) : [];
  return mergeEvidenceSuggestions(
    results
      .map((result, index) => {
        const snippet = normalizeEvidenceText(result.content ?? "").slice(0, 240);
        if (!snippet) return null;
        const sourceType = sourceTypeFromResult(result);
        const recordId =
          result.recordId === undefined || result.recordId === null ? null : String(result.recordId);
        return {
          id: `retrieval-${sourceType}-${recordId ?? index}`,
          title: evidenceTitleFromResult(result, index),
          sourceType,
          sourceLabel: sourceLabelFor(sourceType),
          snippet,
          date: evidenceDateFromResult(result),
          confidence: confidenceFromScore(result.finalScore ?? result.similarity),
          recordId,
        } satisfies ChangeEventWorkflowEvidenceSuggestion;
      })
      .filter((item): item is ChangeEventWorkflowEvidenceSuggestion => Boolean(item)),
  );
}

export function isChangeEventFinalPreviewRequest(prompt: string): boolean {
  const normalized = normalizePrompt(prompt).toLowerCase();
  return (
    normalized.includes("prepare the final createchangeevent preview") ||
    normalized.includes("prepare the final change event create preview") ||
    normalized.includes("call createchangeevent with confirmed=false") ||
    normalized.includes("run createchangeevent now with confirmed=true") ||
    normalized.includes("confirmed=true") ||
    normalized.includes("confirmed=false")
  );
}
