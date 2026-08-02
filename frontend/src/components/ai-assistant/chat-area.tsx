"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiFetch, apiFetchBlob, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  AI_ASSISTANT_MODELS,
  DEFAULT_AI_ASSISTANT_MODEL,
  type AiAssistantModelId,
} from "@/lib/ai/assistant-models";
import { InfoAlert } from "@/components/ds/InfoAlert";
import type { UIMessage } from "ai";
import { useProjects } from "@/hooks/use-projects";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool as ToolDisplay,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
  type ConfirmationProps,
} from "@/components/ai-elements/confirmation";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputAction,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputSubmit,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CopyIcon,
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
  CheckIcon,
  XIcon,
  LinkIcon,
  ClipboardPasteIcon,
  MicIcon,
  MicOffIcon,
  PaperclipIcon,
  UsersRoundIcon,
  Volume2Icon,
  VolumeXIcon,
  SparklesIcon,
  ArrowUpIcon,
  CircleSlash2Icon,
  ShieldCheckIcon,
} from "lucide-react";
import type { DynamicToolUIPart, FileUIPart } from "ai";
import {
  formatEstimateWorkbookPreviewForChat,
  isSpreadsheetFile,
  spreadsheetBytesToCsv,
  truncateInlineText,
  type EstimateWorkbookChatPreview,
} from "@/lib/chat/attachment-text";
import { appToast as toast } from "@/lib/toast/app-toast";
import {
  estimateBase64DataUrlBytes,
  isSupportedChatImageMediaType,
  MAX_CHAT_FILE_PARTS,
  MAX_CHAT_IMAGE_PARTS,
  MAX_CHAT_INLINE_FILE_BYTES,
} from "@/lib/ai/chat-attachment-limits";
import { copyTextWithFallback } from "@/lib/browser/clipboard";
import {
  DEFAULT_ASSISTANT_SURFACE,
  type AssistantSurface,
} from "@/lib/ai/chat-surface";
import { WelcomeScreen } from "./welcome-screen";
import {
  type AssistantTraceDiagnostics,
  type ToolTraceItem,
} from "./trace-panel";
import { TraceMenu } from "./trace-menu";
import { CrossSourceTimeline } from "./cross-source-timeline";
import {
  formatStructuredMeetingList,
  stripMarkdownForSpeech,
} from "./chat-formatting";
import { AudioWaveform } from "./audio-waveform";
import { BrandonDailyUpdateWidgetCard } from "./brandon-daily-update-widget-card";
import type { BrandonDailyUpdatePacket } from "@/lib/executive/brandon-daily-update";
import {
  AssistantDynamicToolRenderer,
  AssistantSourceEvidenceWidget,
  AssistantWidgetRenderer,
  hasAssistantDynamicToolComponent,
  shouldRenderAssistantDynamicToolComponent,
} from "./assistant-widget-renderer";
import { getPersistedActionToolParts } from "./persisted-action-tool-parts";
import {
  isAssistantWidgetPayload,
  type AssistantWidgetPayload,
} from "@/lib/ai/assistant-widgets";
import type {
  ChangeEventWorkflowDraft,
  ChangeEventWorkflowDraftEdits,
} from "@/lib/ai/change-event-workflow";
import {
  scoreResponseQuality,
  type ResponseQuality as ScoredResponseQuality,
} from "@/lib/ai/score-response-quality";
import { TaskFeedbackButtons } from "@/components/ai/TaskFeedbackButtons";
import { AiResponseFeedback } from "@/components/ai/AiResponseFeedback";
import {
  AssistantMemoryTrace,
  type MemoryUsage,
} from "./memory-usage-disclosure";
import { AssistantSkillTrace, type SkillUsage } from "./skill-usage-disclosure";
import { AssistantChangeEventFormCardV2 } from "./assistant-change-event-form-card-v2";
import { AssistantPreviewReviewCard } from "./assistant-preview-review-card";
import { isStandalonePreviewCardPart } from "./preview-review-card";
import {
  ChangeEventDraftArtifact,
  type ChangeEventDraftProjectOption,
} from "./change-event-draft-artifact";

// ─── Part extraction helpers ───────────────────────────────────────

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function getReasoningText(msg: UIMessage): string {
  return msg.parts
    .filter(
      (p): p is { type: "reasoning"; text: string } => p.type === "reasoning",
    )
    .map((p) => p.text)
    .join("");
}

function getImageParts(
  msg: UIMessage,
): Array<{ url: string; filename?: string }> {
  return msg.parts.reduce<Array<{ url: string; filename?: string }>>(
    (images, part) => {
      if (part.type !== "file") return images;
      const filePart = part as {
        type: "file";
        mediaType?: string;
        url?: string;
        filename?: string;
      };
      if (filePart.mediaType?.startsWith("image/") && filePart.url) {
        images.push({
          url: filePart.url,
          filename: filePart.filename,
        });
      }
      return images;
    },
    [],
  );
}

// AI SDK 7 tool parts use type: "tool-{toolName}" with toolCallId, input, output, state
interface ToolPart {
  type: string;
  toolCallId: string;
  input: unknown;
  state: string;
  output?: unknown;
  errorText?: string;
  title?: string;
  approval?: {
    id: string;
    approved?: boolean;
    reason?: string;
  };
}

type ToolPartCandidate = {
  type: string;
  toolCallId?: unknown;
  input?: unknown;
  state?: unknown;
  output?: unknown;
  errorText?: unknown;
  title?: unknown;
  approval?: unknown;
};

type ToolApprovalResponseHandler = (response: {
  id: string;
  approved: boolean;
  reason?: string;
}) => void;

type WindowWithSpeechRecognition = {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type ResponseQuality = Omit<
  ScoredResponseQuality,
  "hasMetaCommentary"
> & {
  hasMetaCommentary?: boolean;
};

export interface StrategistLiveStatus {
  stage: string;
  message: string;
  status: "loading" | "success" | "warning" | "error";
  timestamp?: string;
}

function toToolPart(part: UIMessage["parts"][number]): ToolPart | null {
  const candidate: ToolPartCandidate = part;
  if (!candidate.type.startsWith("tool-")) return null;
  if (typeof candidate.toolCallId !== "string") return null;
  if (typeof candidate.state !== "string") return null;

  const approval =
    candidate.approval && typeof candidate.approval === "object"
      ? candidate.approval
      : null;
  const normalizedApproval =
    approval && typeof (approval as { id?: unknown }).id === "string"
      ? {
          id: (approval as { id: string }).id,
          approved:
            typeof (approval as { approved?: unknown }).approved === "boolean"
              ? (approval as { approved: boolean }).approved
              : undefined,
          reason:
            typeof (approval as { reason?: unknown }).reason === "string"
              ? (approval as { reason: string }).reason
              : undefined,
        }
      : undefined;

  return {
    type: candidate.type,
    toolCallId: candidate.toolCallId,
    input: candidate.input,
    state: candidate.state,
    output: candidate.output,
    errorText:
      typeof candidate.errorText === "string" ? candidate.errorText : undefined,
    title: typeof candidate.title === "string" ? candidate.title : undefined,
    approval: normalizedApproval,
  };
}

function getToolParts(msg: UIMessage): ToolPart[] {
  return msg.parts.reduce<ToolPart[]>((parts, part) => {
    const toolPart = toToolPart(part);
    if (toolPart) parts.push(toolPart);
    return parts;
  }, []);
}

function getArtifactParts(msg: UIMessage): ToolPart[] {
  return getToolParts(msg).filter(
    (part) => part.type === "tool-saveWorkspaceArtifact",
  );
}

function getBrandonDailyUpdateWidgetParts(
  msg: UIMessage,
): Array<{ packet: BrandonDailyUpdatePacket }> {
  return msg.parts.reduce<Array<{ packet: BrandonDailyUpdatePacket }>>(
    (widgets, part) => {
      if (part.type !== "data-brandon-daily-update-widget") return widgets;
      const data = (part as { data?: unknown }).data;
      if (!data || typeof data !== "object") return widgets;
      const packet = (data as { packet?: BrandonDailyUpdatePacket }).packet;
      if (!packet || typeof packet !== "object") return widgets;
      widgets.push({ packet });
      return widgets;
    },
    [],
  );
}

function getAssistantWidgetParts(msg: UIMessage): AssistantWidgetPayload[] {
  return msg.parts.reduce<AssistantWidgetPayload[]>((widgets, part) => {
    if (part.type !== "data-assistant-widget") return widgets;
    const data = (part as { data?: unknown }).data;
    if (!data || typeof data !== "object") return widgets;
    const widget = (data as { widget?: unknown }).widget;
    if (!isAssistantWidgetPayload(widget)) return widgets;
    // Evidence/source-coverage cards disabled in chat UI per 2026-05-19 —
    // backend still emits them; re-enable by removing this filter.
    if (widget.type === "source_evidence_drawer") return widgets;
    // Meeting-intelligence aggregate card deactivated in chat UI per 2026-06-26 —
    // it produced meta-commentary noise ("2 meeting records matched this window",
    // "Opportunity tracking is not available", "Open the meeting cards with risk
    // badges first"), crowded out the conversational answer, and its links didn't
    // open. The agent now answers meeting questions in prose. Backend still emits
    // the part; re-enable by removing this filter. See docs/design/noise-gate-log.md.
    if (widget.type === "meeting_intelligence") return widgets;
    widgets.push(widget);
    return widgets;
  }, []);
}

function getLatestChangeEventWorkflowDraft(
  messages: UIMessage[],
): ChangeEventWorkflowDraft | null {
  for (const msg of [...messages].reverse()) {
    if (msg.role !== "assistant") continue;
    const widget = getAssistantWidgetParts(msg)
      .reverse()
      .find((part) => part.type === "change_event_workflow");
    if (widget?.type === "change_event_workflow") {
      return widget.draft;
    }
  }
  return null;
}

type WorkspaceArtifactListResponse = {
  artifacts?: Array<{
    content?: unknown;
  }>;
};

type ChangeEventDraftSaveResponse = {
  draft: ChangeEventWorkflowDraft;
};

function changeEventDraftFromArtifactContent(
  content: unknown,
): ChangeEventWorkflowDraft | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const record = content as Record<string, unknown>;
  const workflow = record.workflow;
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    return null;
  }
  const draft = (workflow as Record<string, unknown>).draft;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return null;
  }
  return draft as ChangeEventWorkflowDraft;
}

function isOutlookInboxSummaryWidget(widget: AssistantWidgetPayload): boolean {
  return widget.type === "outlook_inbox_summary";
}

function isTrailingAssistantWidget(widget: AssistantWidgetPayload): boolean {
  return (
    isOutlookInboxSummaryWidget(widget) || widget.type === "project_picker"
  );
}

function getLatestStatusPart(msg: UIMessage): StrategistLiveStatus | null {
  for (const part of [...msg.parts].reverse()) {
    if (part.type !== "data-status") continue;
    const data = (part as { data?: unknown }).data;
    if (!data || typeof data !== "object") continue;
    const record = data as Record<string, unknown>;
    if (typeof record.message !== "string" || typeof record.stage !== "string")
      continue;
    return {
      stage: record.stage,
      message: record.message,
      status:
        record.status === "success" ||
        record.status === "warning" ||
        record.status === "error"
          ? record.status
          : "loading",
      timestamp:
        typeof record.timestamp === "string" ? record.timestamp : undefined,
    };
  }

  return null;
}

function hasToolInvocations(msg: UIMessage): boolean {
  return msg.parts.some((p) => p.type.startsWith("tool-"));
}

function getToolNameFromType(type: string): string {
  return type.replace(/^tool-/, "");
}

// ─── Formatting helpers ────────────────────────────────────────────

/**
 * Parse an ISO date string into "Mar 16, 2026" format.
 * Returns null if unparseable.
 */
function formatSourceDate(str: string): string | null {
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/**
 * Turn a raw [Source: ...] body into a human-readable label.
 * Handles:
 *   Meeting - "Title" - ISO-DATE
 *   Meeting - Title - ISO-DATE
 *   Project Directory - Name
 *   Action Items & Insights
 *   anything else → returned as-is
 */
function formatSourceLabel(raw: string): string {
  const meetingMatch = raw.match(
    /^Meeting\s*[-–]\s*"?([^"-]+?)"?\s*[-–]\s*(.+)$/,
  );
  if (meetingMatch) {
    const title = meetingMatch[1].trim();
    const dateStr = meetingMatch[2].trim();
    const date = formatSourceDate(dateStr);
    return date ? `${title} · ${date}` : title;
  }
  return raw;
}

/**
 * Extract all [Source: ...] patterns from text, returning the cleaned text
 * (with citations removed) and a deduplicated array of formatted source labels.
 */
function extractSources(text: string): {
  cleanText: string;
  sources: string[];
} {
  const seen = new Set<string>();
  const sources: string[] = [];
  const cleanText = text.replace(/\[Source:\s*([^\]]+)\]/g, (_, content) => {
    const label = formatSourceLabel(content.trim());
    if (!seen.has(label)) {
      seen.add(label);
      sources.push(label);
    }
    return "";
  });
  return { cleanText: cleanText.replace(/\n{3,}/g, "\n\n").trim(), sources };
}

function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function getToolPreview(part: ToolPart): Record<string, unknown> | null {
  const output = asObject(part.output);
  if (output.action !== "preview") return null;
  const preview = asObject(output.preview);
  return Object.keys(preview).length > 0 ? preview : null;
}

function getToolOutputRecord(part: ToolPart): Record<string, unknown> | null {
  const output = asObject(part.output);
  const result = asObject(output.result);
  const directRecord = asObject(output.record);
  const record =
    Object.keys(directRecord).length > 0
      ? directRecord
      : asObject(result.record);
  return Object.keys(record).length > 0 ? record : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function getRecordDeepLinks(
  part: ToolPart,
): Array<{ label: string; href: string }> {
  const input = asObject(part.input);
  const record = getToolOutputRecord(part);
  const output = asObject(part.output);
  const links: Array<{ label: string; href: string }> = [];

  const projectId =
    toNumber(input.projectId) ??
    toNumber(input.selectedProjectId) ??
    toNumber((record as Record<string, unknown>)?.project_id);
  const recordId =
    toStringValue((record as Record<string, unknown>)?.id) ??
    toStringValue(output.documentId);

  const toolName = getToolNameFromType(part.type);

  if (toolName === "createRFI" && projectId && recordId) {
    links.push({ label: "Open RFI", href: `/${projectId}/rfis/${recordId}` });
  }

  if (toolName === "createSubmittal" && projectId && recordId) {
    links.push({
      label: "Open Submittal",
      href: `/${projectId}/submittals/${recordId}`,
    });
  }

  if (toolName === "createChangeOrder" && projectId && recordId) {
    links.push({
      label: "Open Change Order",
      href: `/${projectId}/change-orders/prime/${recordId}`,
    });
  }

  if (toolName === "createChangeEvent" && projectId && recordId) {
    links.push({
      label: "Open Change Event",
      href: `/${projectId}/change-events/${recordId}`,
    });
  }

  if (toolName === "createMeetingNote" && projectId && recordId) {
    links.push({
      label: "Open Meeting",
      href: `/${projectId}/meetings/${recordId}`,
    });
  }

  if (
    [
      "createGeneratedTask",
      "updateGeneratedTask",
      "deleteGeneratedTask",
    ].includes(toolName) &&
    recordId
  ) {
    links.push({
      label: "Open Task",
      href: projectId
        ? `/${projectId}/tasks?task=${recordId}`
        : `/tasks?task=${recordId}`,
    });
  }

  if (toolName === "updateProjectStatus" && projectId) {
    links.push({ label: "Open Project", href: `/${projectId}/home` });
  }

  if (typeof output.reportUrl === "string") {
    links.push({ label: "Open Report", href: output.reportUrl });
  }

  if (typeof output.previewUrl === "string") {
    links.push({ label: "Preview PDF", href: output.previewUrl });
  }

  if (typeof output.downloadUrl === "string") {
    links.push({ label: "Download PDF", href: output.downloadUrl });
  }

  if (recordId && output.boardUrl && typeof output.boardUrl === "string") {
    links.push({
      label: "Open Board Card",
      href: String(output.boardUrl),
    });
  }

  return links;
}

function isTextReadableFileUIPart(file: FileUIPart): boolean {
  const mediaType = file.mediaType ?? "";
  const name = (file.filename ?? "").toLowerCase();
  return (
    mediaType.startsWith("text/") ||
    mediaType === "application/json" ||
    mediaType === "application/xml" ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".csv") ||
    name.endsWith(".json") ||
    name.endsWith(".xml") ||
    name.endsWith(".txt") ||
    // Spreadsheet exports (xlsx/xls) are parsed to CSV and inlined too, so
    // migration exports from another system actually reach the model.
    isSpreadsheetFile(file.filename, file.mediaType)
  );
}

// Locally parsed text/workbooks are reduced before transport, but still need a
// bounded browser read. Vision and unsupported binary inputs use the tighter
// inline limit immediately so they cannot be base64-expanded before rejection.
const MAX_LOCAL_ATTACHMENT_PREPROCESS_BYTES = 25_000_000;

function getComposerFileSizeLimit(file: File): number {
  const filePart: FileUIPart = {
    type: "file",
    url: "",
    filename: file.name,
    mediaType: file.type,
  };
  return isTextReadableFileUIPart(filePart)
    ? MAX_LOCAL_ATTACHMENT_PREPROCESS_BYTES
    : MAX_CHAT_INLINE_FILE_BYTES;
}

async function bytesFromFileUIPart(file: FileUIPart): Promise<Uint8Array> {
  const url = file.url;
  if (url.startsWith("data:")) {
    const base64Match = url.match(/^data:[^;]+;base64,(.+)$/);
    if (base64Match) {
      const binary = atob(base64Match[1]);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }
    const commaIndex = url.indexOf(",");
    return new TextEncoder().encode(
      decodeURIComponent(url.slice(commaIndex + 1)),
    );
  }
  const response = await fetch(url);
  return new Uint8Array(await response.arrayBuffer());
}

async function readTextFromFileUIPart(
  file: FileUIPart,
  projectId: number | null,
): Promise<string> {
  const bytes = await bytesFromFileUIPart(file);
  if (isSpreadsheetFile(file.filename, file.mediaType)) {
    if (projectId && /\.(xlsx|xlsm)$/i.test(file.filename ?? "")) {
      const formData = new FormData();
      formData.append(
        "file",
        new File([bytes], file.filename ?? "estimate.xlsx", {
          type:
            file.mediaType ??
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      try {
        const preview = await apiFetch<EstimateWorkbookChatPreview>(
          `/api/projects/${projectId}/contracts/estimate-import/preview`,
          { method: "POST", body: formData },
        );
        if (preview.kind === "alleato_estimate_workbook") {
          return formatEstimateWorkbookPreviewForChat(preview);
        }
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          return "(estimate workbook preview blocked: Contracts read access is required for the selected project)";
        }
        return `(estimate workbook preview blocked: ${error instanceof Error ? error.message : "the server rejected this workbook"})`;
      }
    }
    return spreadsheetBytesToCsv(bytes);
  }
  return truncateInlineText(new TextDecoder("utf-8").decode(bytes));
}

async function prepareMessageWithFileUIParts(
  message: string,
  files: FileUIPart[],
  projectId: number | null,
): Promise<{ message: string; files: FileUIPart[] }> {
  if (!files.length) return { message, files };

  const textFiles = files.filter(isTextReadableFileUIPart);
  const nonTextFiles = files.filter((f) => !isTextReadableFileUIPart(f));

  if (textFiles.length === 0) return { message, files };

  const attachmentText = await Promise.all(
    textFiles.map(async (file) => {
      const text = await readTextFromFileUIPart(file, projectId);
      const name = file.filename ?? "attachment";
      return [
        `--- ${name} (${file.mediaType ?? "text/plain"}) ---`,
        text,
        `--- end ${name} ---`,
      ].join("\n");
    }),
  );

  return {
    message: [message, ATTACHMENT_SECTION_MARKER, ...attachmentText]
      .filter(Boolean)
      .join("\n\n"),
    files: nonTextFiles,
  };
}

/**
 * Marker prepended to inlined readable-file content so the model receives the
 * full text. `parseUserMessageAttachments` strips this section back out for
 * display so the user sees a file chip instead of the raw dump.
 */
const ATTACHMENT_SECTION_MARKER = "Attached readable files:";

type ParsedMessageAttachment = { filename: string; mediaType: string };

/**
 * Splits a stored user message into its visible text and the inlined readable
 * file attachments. The raw file content (wrapped in `--- name (mime) --- ...
 * --- end name ---` blocks) is kept out of the visible bubble — only the
 * filename + type are surfaced as chips.
 */
function parseUserMessageAttachments(text: string): {
  visibleText: string;
  attachments: ParsedMessageAttachment[];
} {
  const markerIndex = text.indexOf(ATTACHMENT_SECTION_MARKER);
  if (markerIndex === -1) return { visibleText: text, attachments: [] };

  const body = text.slice(markerIndex + ATTACHMENT_SECTION_MARKER.length);
  const headerRegex = /--- (.+?) \(([^)]+)\) ---/g;
  const attachments: ParsedMessageAttachment[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(body)) !== null) {
    attachments.push({ filename: match[1], mediaType: match[2] });
  }

  // Only treat this as an attachment section if we actually found file blocks —
  // otherwise the user just happened to type the marker text themselves.
  if (attachments.length === 0) return { visibleText: text, attachments: [] };

  return { visibleText: text.slice(0, markerIndex).trim(), attachments };
}

/** Renders thumbnails for files attached via PromptInput's internal attachment state. */
function AttachmentPreviews() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto px-1 pb-2">
      {attachments.files.map((file) => (
        <div
          key={file.id}
          className="image-bounce relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
        >
          {file.mediaType?.startsWith("image/") && file.url ? (
            <Image
              src={file.url}
              alt={file.filename ?? "attachment"}
              fill
              className="object-cover"
              sizes="48px"
              unoptimized
            />
          ) : (
            <FileTextIcon
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute right-0 top-0 h-4 w-4 rounded-bl-md rounded-tr-lg bg-destructive/80 p-0 text-destructive-foreground hover:bg-destructive"
            onClick={() => attachments.remove(file.id)}
            aria-label={`Remove ${file.filename ?? "file"}`}
          >
            <XIcon className="h-2.5 w-2.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function AssistantPromptSubmit({
  className,
  input,
  isStreaming,
  onStop,
}: {
  className?: string;
  input: string;
  isStreaming: boolean;
  onStop?: () => void;
}) {
  const attachments = usePromptInputAttachments();

  return (
    <PromptInputSubmit
      status={isStreaming ? "streaming" : "ready"}
      onStop={onStop}
      variant="ghost"
      size="icon-sm"
      disabled={!input.trim() && attachments.files.length === 0 && !isStreaming}
      className={className}
    >
      {isStreaming ? undefined : (
        <ArrowUpIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
      )}
    </PromptInputSubmit>
  );
}

// ─── Tool call display ─────────────────────────────────────────────

function ToolCallItem({
  part,
  onApprove,
  onEdit,
  onRun,
  onApprovalResponse,
  sessionId,
  selectedProjectId,
}: {
  part: ToolPart;
  onApprove: (part: ToolPart) => void;
  onEdit: (part: ToolPart) => void;
  onRun: (part: ToolPart) => void;
  onApprovalResponse?: ToolApprovalResponseHandler;
  sessionId?: string | null;
  selectedProjectId?: number | null;
}) {
  const preview = getToolPreview(part);
  const previewFields = asObject(preview?.fields);
  const links = getRecordDeepLinks(part);
  const approvalId = part.approval?.id;

  const toolName = getToolNameFromType(part.type);
  const isCreateRFI = toolName === "createRFI";
  const approvalObjectLabel = isCreateRFI ? "RFI" : "action";
  const approvalActionLabel = isCreateRFI ? "Create RFI" : "Run action";
  const isCreateTask =
    toolName === "createTask" || toolName === "createGeneratedTask";
  const previewTable = toStringValue(preview?.table);
  const isTaskPreview =
    isCreateTask &&
    (previewTable === "schedule_tasks" || previewTable === "tasks");

  const output = asObject(part.output);
  const isConfirmedTask =
    isCreateTask &&
    output.success === true &&
    part.state === "output-available";
  const confirmedRecord = asObject(output.record);
  const confirmedTaskId = toStringValue(confirmedRecord.id);

  const taskProjectId =
    toNumber(previewFields.project_id) ??
    toNumber(confirmedRecord.project_id) ??
    selectedProjectId ??
    null;
  const taskName =
    toStringValue(previewFields.name) ??
    toStringValue(previewFields.title) ??
    toStringValue(confirmedRecord.name) ??
    toStringValue(confirmedRecord.title) ??
    toStringValue(confirmedRecord.description) ??
    "";
  const taskAssignee =
    toStringValue(previewFields.assignee) ??
    toStringValue(previewFields.assignee_name) ??
    toStringValue(confirmedRecord.assignee) ??
    toStringValue(confirmedRecord.assignee_name);
  const taskDueDate =
    toStringValue(previewFields.finish_date) ??
    toStringValue(previewFields.due_date) ??
    toStringValue(confirmedRecord.finish_date) ??
    toStringValue(confirmedRecord.due_date);

  return (
    <ToolDisplay className="mb-1.5 w-full sm:min-w-xl">
      <ToolHeader
        type={part.type as DynamicToolUIPart["type"]}
        state={part.state as DynamicToolUIPart["state"]}
        toolName={getToolNameFromType(part.type)}
        title={formatToolName(getToolNameFromType(part.type))}
      />
      <ToolContent>
        {part.input != null && !part.approval && <ToolInput input={part.input} />}
        <Confirmation
          approval={part.approval as ConfirmationProps["approval"]}
          state={part.state as DynamicToolUIPart["state"]}
        >
          <ConfirmationRequest>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Review before creating
              </p>
              <p className="text-base font-semibold text-foreground">
                Create this {approvalObjectLabel}?
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Eve will create one project record using the exact details
                below. Nothing is written until you approve.
              </p>
            </div>
            {part.input != null && (
              <ToolInput input={part.input} />
            )}
            <ConfirmationActions>
              <ConfirmationAction
                variant="outline"
                disabled={!approvalId}
                onClick={() => {
                  if (!approvalId) return;
                  onApprovalResponse?.({
                    id: approvalId,
                    approved: false,
                    reason: "User denied tool execution",
                  });
                }}
              >
                Don&apos;t create
              </ConfirmationAction>
              <ConfirmationAction
                disabled={!approvalId}
                onClick={() => {
                  if (!approvalId) return;
                  onApprovalResponse?.({
                    id: approvalId,
                    approved: true,
                    reason: "User approved tool execution",
                  });
                }}
              >
                {approvalActionLabel}
              </ConfirmationAction>
            </ConfirmationActions>
          </ConfirmationRequest>
          <ConfirmationAccepted>
            <div className="flex items-start gap-3">
              <ShieldCheckIcon
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-success"
              />
              <div className="space-y-1">
                <ConfirmationTitle className="font-medium">
                  Approval recorded
                </ConfirmationTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Eve is creating the {approvalObjectLabel} now.
                </p>
              </div>
            </div>
          </ConfirmationAccepted>
          <ConfirmationRejected>
            <div className="flex items-start gap-3">
              <CircleSlash2Icon
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              />
              <div className="space-y-1">
                <ConfirmationTitle className="font-medium">
                  {isCreateRFI ? "RFI" : "Action"} not created
                </ConfirmationTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  You declined this proposal. No project data changed. Tell Eve
                  what to revise when you are ready.
                </p>
              </div>
            </div>
          </ConfirmationRejected>
        </Confirmation>
        {preview && toolName === "createChangeEvent" ? (
          <AssistantChangeEventFormCardV2
            preview={preview}
            onConfirm={() => onApprove(part)}
            onCancel={() => onEdit(part)}
            cancelLabel="Edit"
          />
        ) : preview ? (
          <AssistantPreviewReviewCard
            preview={preview}
            onApprove={() => onApprove(part)}
            onEdit={() => onEdit(part)}
            onRun={() => onRun(part)}
          />
        ) : null}
        {preview &&
          isTaskPreview &&
          taskProjectId != null &&
          part.state !== "output-available" && (
            <div className="mt-2 flex items-center justify-end">
              <TaskFeedbackButtons
                projectId={taskProjectId}
                taskSnapshot={{
                  name: taskName,
                  assignee: taskAssignee,
                  dueDate: taskDueDate,
                  priority: toStringValue(previewFields.priority) ?? "normal",
                  notes: null,
                  projectId: taskProjectId,
                }}
                sessionId={sessionId ?? null}
              />
            </div>
          )}
        {(part.state === "output-available" ||
          part.state === "output-error") && (
          <ToolOutput
            output={part.output}
            errorText={part.errorText}
          />
        )}
        {isConfirmedTask && taskProjectId != null && (
          <div className="mt-2 flex items-center justify-end">
            <TaskFeedbackButtons
              projectId={taskProjectId}
              taskId={confirmedTaskId ?? undefined}
              taskSnapshot={{
                name: taskName,
                assignee: taskAssignee,
                dueDate: taskDueDate,
                priority: toStringValue(confirmedRecord.priority) ?? "normal",
                notes: null,
                projectId: taskProjectId,
              }}
              sessionId={sessionId ?? null}
            />
          </div>
        )}
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {links.map((link, index) => (
              <Button
                asChild
                key={`${link.label}-${link.href}`}
                size="sm"
                variant={index === 0 ? "default" : "outline"}
              >
                <Link href={link.href}>
                  <LinkIcon className="size-3.5 shrink-0" />
                  {link.label}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </ToolContent>
    </ToolDisplay>
  );
}

// ─── Tool step status helper ──────────────────────────────────────

function getToolStepStatus(state: string): "complete" | "active" | "pending" {
  if (state === "output-available" || state === "output-error")
    return "complete";
  if (state === "input-available" || state === "input-streaming")
    return "active";
  return "pending";
}

// ─── Streaming indicator ────────────────────────────────────────────

function StreamingIndicator({
  hasToolCalls,
  councilMode,
  liveStatus,
}: {
  hasToolCalls: boolean;
  councilMode?: boolean;
  liveStatus?: StrategistLiveStatus | null;
}) {
  const statusMessage = liveStatus?.message;
  const isWarning = liveStatus?.status === "warning";
  const isSuccess = liveStatus?.status === "success";

  return (
    <div className="flex items-start">
      <Message from="assistant">
        <MessageContent>
          <div className="flex items-center gap-2.5 py-1 text-sm text-muted-foreground">
            {statusMessage ? (
              <>
                <DatabaseIcon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isWarning
                      ? "text-amber-600"
                      : isSuccess
                        ? "text-primary"
                        : "animate-pulse text-muted-foreground",
                  )}
                />
                <span>{statusMessage}</span>
              </>
            ) : hasToolCalls ? (
              <>
                <DatabaseIcon className="h-4 w-4 animate-pulse text-muted-foreground" />
                <Shimmer as="span" duration={1.5} className="text-sm">
                  {councilMode
                    ? "Convening the council…"
                    : "Analyzing your project data..."}
                </Shimmer>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            )}
          </div>
        </MessageContent>
      </Message>
    </div>
  );
}

const qualityRank: Record<ResponseQuality["sourceQuality"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function bestSourceQuality(
  ...values: Array<ResponseQuality["sourceQuality"] | undefined>
): ResponseQuality["sourceQuality"] {
  return values.reduce<ResponseQuality["sourceQuality"]>((best, value) => {
    if (!value) return best;
    return qualityRank[value] > qualityRank[best] ? value : best;
  }, "low");
}

function sourceQualityFromPersistedSources(
  sources: unknown[],
): ResponseQuality["sourceQuality"] | undefined {
  if (sources.length >= 2) return "high";
  if (sources.length === 1) return "medium";
  return undefined;
}

function deriveDisplayResponseQuality(params: {
  stored: ResponseQuality | undefined;
  traces: ToolTraceItem[];
  sources: unknown[];
  content: string;
}): ResponseQuality | undefined {
  if (!params.stored) return undefined;

  const rescored =
    params.traces.length > 0
      ? scoreResponseQuality({
          toolTrace: params.traces.map((trace) => ({ ...trace })),
          content: params.content,
        })
      : null;

  const sourceQuality = bestSourceQuality(
    params.stored.sourceQuality,
    rescored?.sourceQuality,
    sourceQualityFromPersistedSources(params.sources),
  );

  if (!rescored && sourceQuality === params.stored.sourceQuality) {
    return params.stored;
  }

  return {
    ...params.stored,
    sourceQuality,
    reasons: Array.from(
      new Set([...(params.stored.reasons ?? []), ...(rescored?.reasons ?? [])]),
    ),
  };
}

// ─── Main ChatArea component ────────────────────────────────────────

interface ChatAreaProps {
  messages: UIMessage[];
  toolTracesByMessageId?: Record<string, ToolTraceItem[]>;
  sourcesByMessageId?: Record<string, unknown[]>;
  memoryUsageByMessageId?: Record<string, MemoryUsage>;
  skillUsageByMessageId?: Record<string, SkillUsage>;
  responseQualityByMessageId?: Record<string, ResponseQuality>;
  traceDiagnosticsByMessageId?: Record<string, AssistantTraceDiagnostics>;
  langfuseTraceIdByMessageId?: Record<string, string>;
  liveStatus?: StrategistLiveStatus | null;
  chatError?: string | null;
  isLoadingMessages: boolean;
  isStreaming: boolean;
  input: string;
  sessionId?: string;
  councilMode?: boolean;
  onCouncilModeChange?: (val: boolean) => void;
  selectedProjectId?: number | null;
  onProjectChange?: (id: number | null) => void;
  selectedModel?: AiAssistantModelId;
  onModelChange?: (model: AiAssistantModelId) => void;
  onInputChange: (value: string) => void;
  onSubmit: (message: string, files?: FileUIPart[]) => void;
  onToolApprovalResponse?: ToolApprovalResponseHandler;
  onStop: () => void;
  /** Omit the decorative orb on the welcome screen (compact floating widget). */
  welcomeHideOrb?: boolean;
  showWidgetWelcomePrompt?: boolean;
  onWidgetWelcomeDismiss?: () => void;
  assistantSurface?: AssistantSurface;
}

export function ChatArea({
  messages,
  toolTracesByMessageId = {},
  sourcesByMessageId = {},
  memoryUsageByMessageId = {},
  skillUsageByMessageId = {},
  responseQualityByMessageId = {},
  traceDiagnosticsByMessageId = {},
  langfuseTraceIdByMessageId = {},
  liveStatus,
  chatError,
  isLoadingMessages,
  isStreaming,
  input,
  sessionId,
  councilMode: councilModeProp,
  onCouncilModeChange,
  selectedProjectId: selectedProjectIdProp,
  onProjectChange,
  selectedModel = DEFAULT_AI_ASSISTANT_MODEL,
  onModelChange,
  onInputChange,
  onSubmit,
  onToolApprovalResponse,
  onStop,
  welcomeHideOrb = false,
  assistantSurface = DEFAULT_ASSISTANT_SURFACE,
}: ChatAreaProps) {
  const isAsrsSurface = assistantSurface === "asrs";
  // Council mode can be controlled externally (via prop) or internally
  const [councilModeInternal, setCouncilModeInternal] = useState(false);

  // Project selector
  const [projectOpen, setProjectOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMicrophoneBlocked, setIsMicrophoneBlocked] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const baseTextRef = useRef("");
  const finalTranscriptsRef = useRef("");
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null,
  );
  const [loadingSpeechMessageId, setLoadingSpeechMessageId] = useState<
    string | null
  >(null);
  // Load the full active project list (≈112) so the composer's project picker
  // can reach and filter every project. With limit:50 the cmdk search only ran
  // over the first 50 alphabetical projects, so most projects (e.g. "Union
  // Collective") returned "No projects found".
  const { projects, isLoading: projectsLoading } = useProjects({
    limit: 500,
    enabled: !isAsrsSurface,
  });
  const selectedProject =
    projects.find((p) => p.id === selectedProjectIdProp) ?? null;
  const changeEventDraftProjectOptions = useMemo<
    ChangeEventDraftProjectOption[]
  >(
    () =>
      projects.map((project) => ({
        id: project.id,
        name: project.name ?? `Project #${project.id}`,
        meta: [project.project_number, project.phase, project.state]
          .filter(Boolean)
          .join(" - "),
      })),
    [projects],
  );
  const selectedModelOption =
    AI_ASSISTANT_MODELS.find((model) => model.id === selectedModel) ??
    AI_ASSISTANT_MODELS[0];
  const councilMode = councilModeProp ?? councilModeInternal;
  const latestMessageChangeEventDraft = useMemo(
    () => getLatestChangeEventWorkflowDraft(messages),
    [messages],
  );
  const [persistedChangeEventDraft, setPersistedChangeEventDraft] =
    useState<ChangeEventWorkflowDraft | null>(null);
  const activeChangeEventDraft =
    persistedChangeEventDraft ?? latestMessageChangeEventDraft;

  useEffect(() => {
    if (latestMessageChangeEventDraft) {
      setPersistedChangeEventDraft(latestMessageChangeEventDraft);
    }
  }, [latestMessageChangeEventDraft]);

  const loadChangeEventDraftArtifact = useCallback(async () => {
    if (isAsrsSurface) return null;
    if (!sessionId) {
      return null;
    }

    const params = new URLSearchParams({
      type: "change_event_draft",
      status: "draft",
      sessionId,
      limit: "1",
    });

    const data = await apiFetch<WorkspaceArtifactListResponse>(
      `/api/ai-assistant/workspace?${params.toString()}`,
    );
    return changeEventDraftFromArtifactContent(data.artifacts?.[0]?.content);
  }, [isAsrsSurface, sessionId]);

  useEffect(() => {
    let cancelled = false;

    loadChangeEventDraftArtifact()
      .then((draft) => {
        if (cancelled) return;
        setPersistedChangeEventDraft(draft);
      })
      .catch(() => {
        if (cancelled) return;
        console.warn(
          "[ai-assistant] Failed to hydrate change-event draft artifact for session.",
        );
        setPersistedChangeEventDraft(null);
      });

    return () => {
      cancelled = true;
    };
  }, [loadChangeEventDraftArtifact]);

  const saveChangeEventDraftArtifact = useCallback(
    async (edits: ChangeEventWorkflowDraftEdits) => {
      if (!sessionId) {
        throw new Error("No active AI session is available for this draft.");
      }

      const data = await apiFetch<ChangeEventDraftSaveResponse>(
        "/api/ai-assistant/workspace",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_change_event_draft",
            sessionId,
            edits,
          }),
        },
      );
      setPersistedChangeEventDraft(data.draft);
    },
    [sessionId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const speechWindow = window as unknown as WindowWithSpeechRecognition;
    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let newFinalText = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        if (result.isFinal) {
          newFinalText += `${result[0].transcript} `;
        }
      }

      if (newFinalText) {
        finalTranscriptsRef.current += newFinalText;
        onInputChange(baseTextRef.current + finalTranscriptsRef.current);
      }
    };
    recognition.onerror = (event) => {
      // "aborted" fires when recognition.stop() is called deliberately — not a real error
      // Regression: GH#281 — this was shown as "Voice input failed: aborted" to users
      if (event.error === "aborted") return;

      setIsRecording(false);

      if (event.error === "not-allowed") {
        setIsMicrophoneBlocked(true);
        toast.error("Microphone access is blocked", {
          id: "ai-assistant-microphone-blocked",
          description:
            "Enable microphone access for this site in browser site settings, then try voice input again.",
        });
        return;
      }

      if (event.error === "audio-capture") {
        toast.error("No microphone found", {
          id: "ai-assistant-audio-capture",
          description:
            "Make sure a microphone is connected and enabled in your system settings.",
        });
        return;
      }

      toast.error(
        event.error
          ? `Voice input failed: ${event.error}`
          : "Voice input failed",
      );
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [onInputChange]);

  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((track) => track.stop());
    };
  }, [mediaStream]);

  const stopSpeech = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeakingMessageId(null);
    setLoadingSpeechMessageId(null);
  }, []);

  useEffect(() => stopSpeech, [stopSpeech]);

  const handleCouncilToggle = useCallback(() => {
    const next = !councilMode;
    setCouncilModeInternal(next);
    onCouncilModeChange?.(next);
  }, [councilMode, onCouncilModeChange]);
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const trimmed = message.text.trim();
      if ((!trimmed && !message.files.length) || isStreaming) return;

      try {
        const prepared = await prepareMessageWithFileUIParts(
          trimmed || "Review these attachments",
          message.files,
          selectedProjectIdProp ?? null,
        );
        const historyFiles = messages.flatMap((historyMessage) =>
          historyMessage.parts.filter((part) => part.type === "file"),
        );
        const requestFiles = [...historyFiles, ...prepared.files];
        if (requestFiles.length > MAX_CHAT_FILE_PARTS) {
          toast.error("Too many attachments", {
            description: `Keep the conversation to ${MAX_CHAT_FILE_PARTS} file attachments or fewer.`,
          });
          return;
        }

        const imageCount = requestFiles.filter((file) =>
          isSupportedChatImageMediaType(file.mediaType),
        ).length;
        if (imageCount > MAX_CHAT_IMAGE_PARTS) {
          toast.error("Too many images", {
            description: `Keep the conversation to ${MAX_CHAT_IMAGE_PARTS} image attachments or fewer.`,
          });
          return;
        }

        const inlineFileBytes = requestFiles.reduce(
          (total, file) => total + estimateBase64DataUrlBytes(file.url),
          0,
        );
        if (inlineFileBytes > MAX_CHAT_INLINE_FILE_BYTES) {
          toast.error("Attachments are too large", {
            description:
              "Keep the combined attachments in this conversation to 3 MB or less.",
          });
          return;
        }

        onSubmit(prepared.message, prepared.files);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Attachment read failed: ${error.message}`
            : "Attachment read failed.",
        );
        return;
      }
      onInputChange("");
    },
    [isStreaming, messages, onInputChange, onSubmit, selectedProjectIdProp],
  );

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      mediaStream?.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(
        "Voice input is not available because this browser does not expose microphone permissions to the app.",
      );
      return;
    }

    baseTextRef.current = input;
    finalTranscriptsRef.current = "";
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        setIsMicrophoneBlocked(false);
        setMediaStream(stream);
        try {
          recognitionRef.current?.start();
          setIsRecording(true);
        } catch (error) {
          stream.getTracks().forEach((track) => track.stop());
          setMediaStream(null);
          toast.error(
            error instanceof Error
              ? `Voice input failed: ${error.message}`
              : "Voice input failed.",
          );
        }
      })
      .catch((error: unknown) => {
        setIsRecording(false);
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          setIsMicrophoneBlocked(true);
          toast.error("Microphone access is blocked", {
            id: "ai-assistant-microphone-blocked",
            description:
              "Enable microphone access for this site in browser site settings, then try voice input again.",
          });
          return;
        }

        setIsMicrophoneBlocked(false);
        toast.error(
          error instanceof Error
            ? `Microphone access failed: ${error.message}`
            : "Microphone access failed.",
        );
      });
  }, [input, isRecording, mediaStream]);

  const handleCopy = useCallback(async (content: string) => {
    try {
      await copyTextWithFallback(content);
      toast.success("Copied to clipboard");
      return;
    } catch (error) {
      console.warn("Clipboard copy failed", error);
      toast.error("Copy failed", {
        description:
          error instanceof Error
            ? error.message
            : "The browser denied clipboard access. Select the response text manually and copy it.",
      });
    }
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      toast.error("Clipboard paste is not available in this browser.");
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        toast.message("Clipboard is empty");
        return;
      }

      const separator = input.trim() ? (input.endsWith("\n") ? "" : "\n") : "";
      onInputChange(`${input}${separator}${clipboardText}`);
      toast.success("Pasted from clipboard");
    } catch (error) {
      console.warn("Clipboard read failed", error);
      toast.error("Paste failed", {
        description:
          "The browser denied clipboard access. Use the normal paste shortcut instead.",
      });
    }
  }, [input, onInputChange]);

  const handleSpeakResponse = useCallback(
    async (messageId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      if (speakingMessageId === messageId) {
        stopSpeech();
        return;
      }

      stopSpeech();
      setLoadingSpeechMessageId(messageId);

      const stripped = stripMarkdownForSpeech(trimmed);
      if (!stripped) {
        setLoadingSpeechMessageId(null);
        return;
      }
      const speechText =
        stripped.length > 4000 ? stripped.slice(0, 4000) : stripped;

      try {
        const audioBlob = await apiFetchBlob("/api/ai-assistant/speech", {
          method: "POST",
          body: JSON.stringify({ text: speechText }),
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audioUrlRef.current = audioUrl;
        audio.onended = stopSpeech;
        audio.onerror = () => {
          stopSpeech();
          toast.error(
            "Voice playback failed. Check your browser audio settings.",
          );
        };
        await audio.play();
        setSpeakingMessageId(messageId);
      } catch (error) {
        stopSpeech();
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          toast.error(
            "Browser blocked audio playback. Click the page first, then try again.",
          );
        } else {
          toast.error(
            error instanceof Error && error.message
              ? error.message
              : "Voice playback failed.",
          );
        }
      } finally {
        setLoadingSpeechMessageId(null);
      }
    },
    [speakingMessageId, stopSpeech],
  );

  // handleFeedback removed — replaced by <AiResponseFeedback> component
  // which owns API submission + toast + reason picker. See AiResponseFeedback.tsx.

  const handleToolApprove = useCallback(
    (part: ToolPart) => {
      const toolName = getToolNameFromType(part.type);
      const preview = getToolPreview(part);
      const fields = asObject(preview?.fields);
      onSubmit(
        [
          `Run ${toolName} now with confirmed=true using exactly these preview values.`,
          "Do not rebuild the intake draft. Do not ask another preview question.",
          "",
          JSON.stringify(fields, null, 2),
        ].join("\n"),
      );
    },
    [onSubmit],
  );

  const handleToolEdit = useCallback(
    (part: ToolPart) => {
      const preview = getToolPreview(part);
      const fields = asObject(preview?.fields);
      const toolName = formatToolName(getToolNameFromType(part.type));
      onInputChange(
        `Edit this ${toolName} before running:\n${JSON.stringify(fields, null, 2)}`,
      );
    },
    [onInputChange],
  );

  const handleToolRun = useCallback(
    (part: ToolPart) => {
      const toolName = formatToolName(getToolNameFromType(part.type));
      onSubmit(
        `Run ${toolName} now with confirmed=true using the same preview values.`,
      );
    },
    [onSubmit],
  );

  const hasMessages = messages.length > 0;
  const showWelcome =
    !hasMessages && !isLoadingMessages && !activeChangeEventDraft;

  // Determine streaming indicator visibility
  const lastMessage = messages[messages.length - 1];
  const lastMessageText = lastMessage ? getMessageText(lastMessage) : "";
  const lastMessageStatus = lastMessage
    ? getLatestStatusPart(lastMessage)
    : null;
  const lastIsAssistantWithToolCalls =
    lastMessage?.role === "assistant" && hasToolInvocations(lastMessage);
  const showStreamingIndicator =
    isStreaming &&
    messages.length > 0 &&
    (lastMessage?.role === "user" ||
      Boolean(lastMessageStatus) ||
      (lastIsAssistantWithToolCalls && !lastMessageText.trim()));

  // Mobile needs real 44px touch targets with legible ~20px icons; desktop
  // stays compact (32px / 16px). The [&_svg] selector sizes the glyph without
  // editing every icon call-site.
  const composerIconButtonClass =
    "h-11 w-11 rounded-full bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground [&_svg]:size-5 sm:h-8 sm:w-8 sm:[&_svg]:size-4";

  // Shared prompt input element
  const promptInputEl = (
    <PromptInput
      multiple
      maxFiles={MAX_CHAT_FILE_PARTS}
      maxFileSize={getComposerFileSizeLimit}
      maxTotalFileSize={MAX_LOCAL_ATTACHMENT_PREPROCESS_BYTES}
      onError={(error) =>
        toast.error("Attachment not added", { description: error.message })
      }
      onSubmit={handleSubmit}
      data-1p-ignore="true"
      data-dev-autofill-disabled="true"
      data-form-type="other"
      data-lpignore="true"
      className={cn(
        "overflow-hidden rounded-2xl border-0 transition-all",
        welcomeHideOrb
          ? "bg-background shadow-none ring-1 ring-border/35 focus-within:ring-border/60"
          : "bg-transparent shadow-[0_8px_24px_-22px_rgb(15_23_42/0.25)] ring-1 ring-border/70 focus-within:ring-2 focus-within:ring-border",
        welcomeHideOrb
          ? hasMessages
            ? "px-3 py-2"
            : "px-4 pb-2.5 pt-3"
          : hasMessages
            ? "px-3 py-2 sm:px-4"
            : "px-4 pb-2 pt-4 sm:px-5",
      )}
    >
      <AttachmentPreviews />
      <PromptInputTextarea
        value={input}
        onChange={(event) => onInputChange(event.currentTarget.value)}
        autoComplete="off"
        data-1p-ignore="true"
        data-form-type="other"
        data-lpignore="true"
        placeholder={
          isRecording
            ? "Listening..."
            : isAsrsSurface
              ? "Ask about FMDS 8-34 requirements…"
              : councilMode
                ? "Ask the council…"
                : "Ask anything…"
        }
        className={cn(
          "px-2 placeholder:text-muted-foreground/40",
          welcomeHideOrb
            ? "text-sm leading-5"
            : "text-base leading-6 sm:text-lg",
          welcomeHideOrb
            ? hasMessages
              ? "min-h-8 pb-1.5 pt-0.5"
              : "min-h-16 pb-2 pt-1"
            : hasMessages
              ? "min-h-8 pb-2 pt-0.5"
              : "min-h-12 pb-3 pt-1",
        )}
      />
      <PromptInputFooter className="flex items-center justify-between gap-2 px-0 pb-0">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger
              tooltip="Attach files or take screenshot"
              className={composerIconButtonClass}
            >
              <PaperclipIcon className="h-3.5 w-3.5" />
            </PromptInputActionMenuTrigger>
            <PromptInputActionMenuContent side="top">
              <PromptInputActionAddAttachments label="Attach files" />
              <PromptInputActionAddScreenshot label="Take screenshot" />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <PromptInputAction
            tooltip="Paste from clipboard"
            className={composerIconButtonClass}
            onClick={handlePasteFromClipboard}
            aria-label="Paste from clipboard"
          >
            <ClipboardPasteIcon className="h-3.5 w-3.5" />
          </PromptInputAction>
          <PromptInputAction
            tooltip={isRecording ? "Stop voice input" : "Voice input"}
            className={cn(
              composerIconButtonClass,
              isRecording && "text-primary hover:text-primary",
            )}
            onClick={toggleRecording}
            aria-label={isRecording ? "Stop voice input" : "Start voice input"}
          >
            {isRecording ? (
              <MicOffIcon className="h-3.5 w-3.5" />
            ) : (
              <MicIcon className="h-3.5 w-3.5" />
            )}
          </PromptInputAction>
          {isRecording && (
            <div className="w-24 shrink-0">
              <AudioWaveform isRecording={isRecording} stream={mediaStream} />
            </div>
          )}
          {isMicrophoneBlocked && !isRecording && (
            <div className="flex min-w-44 items-center gap-1.5 whitespace-nowrap px-1 text-xs text-muted-foreground">
              <MicOffIcon className="h-3.5 w-3.5 shrink-0 text-destructive" />
              <span>Enable mic access in site settings.</span>
            </div>
          )}
          {!isAsrsSurface ? (
            <>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className={cn(
                            composerIconButtonClass,
                            selectedProject &&
                              "text-primary hover:text-primary",
                          )}
                          aria-label={
                            selectedProject
                              ? `Project context: ${selectedProject.name ?? "Selected project"}`
                              : "Select project context"
                          }
                          aria-pressed={Boolean(selectedProject)}
                        >
                          <FolderIcon className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <PopoverContent
                      className="w-64 p-0"
                      align="start"
                      side="top"
                    >
                      <Command>
                        <CommandInput
                          placeholder="Search projects…"
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>
                            {projectsLoading ? "Loading…" : "No projects found"}
                          </CommandEmpty>
                          <CommandGroup>
                            {selectedProject && (
                              <CommandItem
                                value="clear selected project"
                                onSelect={() => {
                                  onProjectChange?.(null);
                                  setProjectOpen(false);
                                }}
                              >
                                <span className="flex-1 truncate text-muted-foreground">
                                  Clear project selection
                                </span>
                                <XIcon className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              </CommandItem>
                            )}
                            {projects.map((project) => (
                              <CommandItem
                                key={project.id}
                                value={`${project.name ?? ""} ${project.project_number ?? ""}`}
                                onSelect={() => {
                                  onProjectChange?.(
                                    project.id === selectedProjectIdProp
                                      ? null
                                      : project.id,
                                  );
                                  setProjectOpen(false);
                                }}
                              >
                                <span className="flex-1 truncate">
                                  {project.name}
                                </span>
                                {project.project_number && (
                                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                                    #{project.project_number}
                                  </span>
                                )}
                                {project.id === selectedProjectIdProp && (
                                  <CheckIcon className="ml-2 h-3.5 w-3.5 shrink-0 text-primary" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <TooltipContent side="top">
                    {selectedProject
                      ? `Project context: ${selectedProject.name ?? "Selected project"}`
                      : "Select a project"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <PromptInputAction
                tooltip={councilMode ? "Council mode on" : "Council mode"}
                role="switch"
                aria-checked={councilMode}
                onClick={handleCouncilToggle}
                className={cn(
                  composerIconButtonClass,
                  councilMode && "text-primary hover:text-primary",
                )}
                aria-label={
                  councilMode ? "Turn off council mode" : "Turn on council mode"
                }
              >
                <UsersRoundIcon className="h-3.5 w-3.5" />
              </PromptInputAction>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <Popover open={modelOpen} onOpenChange={setModelOpen}>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className={composerIconButtonClass}
                          aria-label="Select model"
                        >
                          <SparklesIcon className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <PopoverContent className="w-64 p-0" align="end" side="top">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {AI_ASSISTANT_MODELS.map((model) => (
                              <CommandItem
                                key={model.id}
                                value={model.id}
                                onSelect={() => {
                                  onModelChange?.(model.id);
                                  setModelOpen(false);
                                }}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">
                                    {model.label}
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {model.description}
                                  </span>
                                </span>
                                {model.id === selectedModel && (
                                  <CheckIcon className="ml-2 h-3.5 w-3.5 shrink-0 text-primary" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <TooltipContent side="top">
                    Model: {selectedModelOption.label}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <AssistantPromptSubmit
            input={input}
            isStreaming={isStreaming}
            onStop={onStop}
            className={cn(
              "relative h-7 w-7 rounded-full bg-transparent text-muted-foreground/40 shadow-none hover:bg-transparent hover:text-foreground sm:h-8 sm:w-8",
              input.trim() && "text-foreground",
              isStreaming && "text-foreground/60 hover:text-foreground/60",
            )}
          />
        </div>
      </PromptInputFooter>
    </PromptInput>
  );

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {showWelcome ? (
        <div
          className={cn(
            "flex min-h-0 flex-1",
            welcomeHideOrb ? "pb-0" : "pb-6 md:pb-8",
          )}
        >
          <WelcomeScreen
            hideOrb={welcomeHideOrb || isAsrsSurface}
            variant={welcomeHideOrb ? "widget" : "full"}
            assistantSurface={assistantSurface}
            composer={promptInputEl}
            error={
              chatError ? (
                <InfoAlert variant="error" className="py-2">
                  {chatError}
                </InfoAlert>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <Conversation className="min-h-0">
                <ConversationContent className="mx-auto w-full max-w-3xl px-4 pb-6 pt-6 sm:px-6 md:pb-8 md:pt-8">
                  {messages.map((msg, msgIndex) => {
                    const text = getMessageText(msg);
                    const isAssistant = msg.role === "assistant";
                    const imageParts = isAssistant ? [] : getImageParts(msg);
                    const {
                      cleanText: textWithoutSources,
                      sources: inlineSources,
                    } = isAssistant
                      ? extractSources(text)
                      : { cleanText: text, sources: [] };
                    const formattedAssistantText = isAssistant
                      ? formatStructuredMeetingList(textWithoutSources)
                      : text;
                    const reasoningText = isAssistant
                      ? getReasoningText(msg)
                      : "";
                    const allToolParts = isAssistant ? getToolParts(msg) : [];
                    const artifactParts = isAssistant
                      ? getArtifactParts(msg)
                      : [];
                    // saveWorkspaceArtifact is rendered as a dedicated artifact card,
                    // so exclude it from the generic tool display.
                    const toolParts = allToolParts.filter(
                      (p) => p.type !== "tool-saveWorkspaceArtifact",
                    );
                    const brandonWidgetParts = isAssistant
                      ? getBrandonDailyUpdateWidgetParts(msg)
                      : [];
                    const assistantWidgetParts = isAssistant
                      ? getAssistantWidgetParts(msg)
                      : [];
                    const inlineAssistantWidgetParts =
                      assistantWidgetParts.filter(
                        (widget) => widget.type !== "change_event_workflow",
                      );
                    const leadingAssistantWidgetParts =
                      inlineAssistantWidgetParts.filter(
                        (widget) => !isTrailingAssistantWidget(widget),
                      );
                    // Widgets that fully replace the text response — suppress duplicate text
                    const textSuppressingTypes = new Set(["task_summary"]);
                    const widgetSuppressesText =
                      leadingAssistantWidgetParts.some((w) =>
                        textSuppressingTypes.has(w.type),
                      );
                    const trailingAssistantWidgetParts =
                      inlineAssistantWidgetParts.filter(
                        isTrailingAssistantWidget,
                      );
                    const persistedTraces = toolTracesByMessageId[msg.id] ?? [];
                    const persistedActionToolParts =
                      toolParts.length === 0
                        ? getPersistedActionToolParts(persistedTraces)
                        : [];
                    const persistedSources = sourcesByMessageId[msg.id] ?? [];
                    const memoryUsage = memoryUsageByMessageId[msg.id];
                    const skillUsage = skillUsageByMessageId[msg.id];
                    const responseQuality = deriveDisplayResponseQuality({
                      stored: responseQualityByMessageId[msg.id],
                      traces: persistedTraces,
                      sources: persistedSources,
                      content: text,
                    });
                    const traceDiagnostics =
                      traceDiagnosticsByMessageId[msg.id];
                    const langfuseTraceId = langfuseTraceIdByMessageId[msg.id];
                    const isLastMessage = msgIndex === messages.length - 1;
                    const assistantTextIsAnimating =
                      isStreaming &&
                      isLastMessage &&
                      trailingAssistantWidgetParts.length === 0;

                    // Show tool-only assistant messages with live tool call display.
                    // Falls through when the only tool call is an artifact (which has
                    // its own dedicated renderer below).
                    if (isAssistant && !text.trim() && toolParts.length > 0) {
                      if (toolParts.length > 0) {
                        return (
                          <div key={msg.id} className="flex items-start">
                            <Message from="assistant">
                              <MessageContent>
                                {toolParts.length > 1 ? (
                                  <>
                                    <ChainOfThought defaultOpen>
                                      <ChainOfThoughtHeader>
                                        Analysis Steps
                                      </ChainOfThoughtHeader>
                                      <ChainOfThoughtContent>
                                        {toolParts.map((part) => (
                                          <ChainOfThoughtStep
                                            key={part.toolCallId}
                                            label={formatToolName(
                                              getToolNameFromType(part.type),
                                            )}
                                            status={getToolStepStatus(
                                              part.state,
                                            )}
                                          />
                                        ))}
                                      </ChainOfThoughtContent>
                                    </ChainOfThought>
                                    {toolParts.some(
                                      (part) => part.approval,
                                    ) && (
                                      <div className="mt-2 space-y-2">
                                        {toolParts
                                          .filter(
                                            (part) =>
                                              part.approval &&
                                              !shouldRenderAssistantDynamicToolComponent(
                                                part,
                                              ),
                                          )
                                          .map((part) => (
                                            <ToolCallItem
                                              key={part.toolCallId}
                                              part={part}
                                              onApprove={handleToolApprove}
                                              onEdit={handleToolEdit}
                                              onRun={handleToolRun}
                                              onApprovalResponse={
                                                onToolApprovalResponse
                                              }
                                              sessionId={sessionId}
                                              selectedProjectId={
                                                selectedProjectIdProp
                                              }
                                            />
                                          ))}
                                      </div>
                                    )}
                                    {toolParts
                                      .filter((part) =>
                                        shouldRenderAssistantDynamicToolComponent(
                                          part,
                                        ),
                                      )
                                      .map((part) => (
                                        <AssistantDynamicToolRenderer
                                          key={`${part.toolCallId}-dynamic`}
                                          part={part}
                                          selectedProjectId={
                                            selectedProjectIdProp
                                          }
                                          onSubmit={onSubmit}
                                          onEditDraft={onInputChange}
                                        />
                                      ))}
                                  </>
                                ) : toolParts[0].approval &&
                                  !shouldRenderAssistantDynamicToolComponent(
                                    toolParts[0],
                                  ) ? (
                                  <ToolCallItem
                                    part={toolParts[0]}
                                    onApprove={handleToolApprove}
                                    onEdit={handleToolEdit}
                                    onRun={handleToolRun}
                                    onApprovalResponse={onToolApprovalResponse}
                                    sessionId={sessionId}
                                    selectedProjectId={selectedProjectIdProp}
                                  />
                                ) : shouldRenderAssistantDynamicToolComponent(
                                    toolParts[0],
                                  ) ? (
                                  <AssistantDynamicToolRenderer
                                    part={toolParts[0]}
                                    selectedProjectId={selectedProjectIdProp}
                                    onSubmit={onSubmit}
                                    onEditDraft={onInputChange}
                                  />
                                ) : (
                                  <ToolCallItem
                                    part={toolParts[0]}
                                    onApprove={handleToolApprove}
                                    onEdit={handleToolEdit}
                                    onRun={handleToolRun}
                                    onApprovalResponse={onToolApprovalResponse}
                                    sessionId={sessionId}
                                    selectedProjectId={selectedProjectIdProp}
                                  />
                                )}
                              </MessageContent>
                            </Message>
                          </div>
                        );
                      }
                      return null;
                    }

                    // Skip empty assistant messages
                    if (
                      isAssistant &&
                      !text.trim() &&
                      assistantWidgetParts.length === 0 &&
                      brandonWidgetParts.length === 0 &&
                      artifactParts.length === 0
                    ) {
                      return null;
                    }

                    // User messages — right-aligned bubble
                    if (!isAssistant) {
                      return (
                        <Message key={msg.id} from="user">
                          <MessageContent className="user-message-enter rounded-full bg-muted px-3 py-1 text-foreground">
                            {imageParts.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-2">
                                {imageParts.map((image) => (
                                  <div
                                    key={image.url}
                                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted"
                                  >
                                    <Image
                                      src={image.url}
                                      alt={image.filename ?? "Uploaded image"}
                                      fill
                                      className="object-cover"
                                      sizes="80px"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            {(() => {
                              const { visibleText, attachments } =
                                parseUserMessageAttachments(text);
                              return (
                                <>
                                  {attachments.length > 0 && (
                                    <div className="mb-1 flex flex-wrap gap-1.5">
                                      {attachments.map((file, fileIndex) => (
                                        <span
                                          key={`${file.filename}-${fileIndex}`}
                                          className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs text-foreground"
                                          title={file.filename}
                                        >
                                          <FileTextIcon
                                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                            aria-hidden="true"
                                          />
                                          <span className="max-w-48 truncate">
                                            {file.filename}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {visibleText.trim() && (
                                    <MessageResponse>
                                      {visibleText}
                                    </MessageResponse>
                                  )}
                                </>
                              );
                            })()}
                          </MessageContent>
                        </Message>
                      );
                    }

                    // Assistant messages — left-aligned with avatar
                    return (
                      <div key={msg.id} className="flex items-start">
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <Message from="assistant">
                            <MessageContent className="px-1 py-1 sm:px-2">
                              {/* Reasoning / Thinking display */}
                              {reasoningText && (
                                <Reasoning
                                  isStreaming={isStreaming && isLastMessage}
                                >
                                  <ReasoningTrigger />
                                  <ReasoningContent>
                                    {reasoningText}
                                  </ReasoningContent>
                                </Reasoning>
                              )}

                              {/* Live tool call display (during streaming) */}
                              {toolParts.length > 1 ? (
                                <div className="mb-3">
                                  <ChainOfThought
                                    defaultOpen={isStreaming && isLastMessage}
                                  >
                                    <ChainOfThoughtHeader>
                                      Analysis Steps
                                    </ChainOfThoughtHeader>
                                    <ChainOfThoughtContent>
                                      {toolParts.map((part) => (
                                        <ChainOfThoughtStep
                                          key={part.toolCallId}
                                          label={formatToolName(
                                            getToolNameFromType(part.type),
                                          )}
                                          status={getToolStepStatus(part.state)}
                                        />
                                      ))}
                                    </ChainOfThoughtContent>
                                  </ChainOfThought>
                                  {toolParts.some((part) => part.approval) && (
                                    <div className="mt-2 space-y-2">
                                      {toolParts
                                        .filter(
                                          (part) =>
                                            part.approval &&
                                            !shouldRenderAssistantDynamicToolComponent(
                                              part,
                                            ),
                                        )
                                        .map((part) => (
                                          <ToolCallItem
                                            key={part.toolCallId}
                                            part={part}
                                            onApprove={handleToolApprove}
                                            onEdit={handleToolEdit}
                                            onRun={handleToolRun}
                                            onApprovalResponse={
                                              onToolApprovalResponse
                                            }
                                            sessionId={sessionId}
                                            selectedProjectId={
                                              selectedProjectIdProp
                                            }
                                          />
                                        ))}
                                    </div>
                                  )}
                                  {toolParts
                                    .filter((part) =>
                                      shouldRenderAssistantDynamicToolComponent(
                                        part,
                                      ),
                                    )
                                    .map((part) => (
                                      <AssistantDynamicToolRenderer
                                        key={`${part.toolCallId}-dynamic`}
                                        part={part}
                                        selectedProjectId={
                                          selectedProjectIdProp
                                        }
                                        onSubmit={onSubmit}
                                        onEditDraft={onInputChange}
                                      />
                                    ))}
                                  {/*
                                Preview cards (e.g. createChangeEvent confirmed:false)
                                carry NO approval — the AI SDK only gates approval on
                                confirmed:true. Without this, a preview that rides alongside
                                other tool calls (findProject/semanticSearch) is shown only
                                as an "Analysis Step" label and the generative-UI form card
                                is dropped. Render those preview parts here so the card shows
                                even when the assistant also emits text.
                              */}
                                  {toolParts
                                    .filter(
                                      (part) =>
                                        !hasAssistantDynamicToolComponent(
                                          part,
                                        ) && isStandalonePreviewCardPart(part),
                                    )
                                    .map((part) => (
                                      <ToolCallItem
                                        key={`${part.toolCallId}-preview`}
                                        part={part}
                                        onApprove={handleToolApprove}
                                        onEdit={handleToolEdit}
                                        onRun={handleToolRun}
                                        onApprovalResponse={
                                          onToolApprovalResponse
                                        }
                                        sessionId={sessionId}
                                        selectedProjectId={
                                          selectedProjectIdProp
                                        }
                                      />
                                    ))}
                                </div>
                              ) : toolParts.length === 1 ? (
                                <div className="mb-3">
                                  {toolParts[0].approval &&
                                  !shouldRenderAssistantDynamicToolComponent(
                                    toolParts[0],
                                  ) ? (
                                    <ToolCallItem
                                      part={toolParts[0]}
                                      onApprove={handleToolApprove}
                                      onEdit={handleToolEdit}
                                      onRun={handleToolRun}
                                      onApprovalResponse={
                                        onToolApprovalResponse
                                      }
                                      sessionId={sessionId}
                                      selectedProjectId={selectedProjectIdProp}
                                    />
                                  ) : shouldRenderAssistantDynamicToolComponent(
                                      toolParts[0],
                                    ) ? (
                                    <AssistantDynamicToolRenderer
                                      part={toolParts[0]}
                                      selectedProjectId={selectedProjectIdProp}
                                      onSubmit={onSubmit}
                                      onEditDraft={onInputChange}
                                    />
                                  ) : (
                                    <ToolCallItem
                                      part={toolParts[0]}
                                      onApprove={handleToolApprove}
                                      onEdit={handleToolEdit}
                                      onRun={handleToolRun}
                                      onApprovalResponse={
                                        onToolApprovalResponse
                                      }
                                      sessionId={sessionId}
                                      selectedProjectId={selectedProjectIdProp}
                                    />
                                  )}
                                </div>
                              ) : null}

                              {leadingAssistantWidgetParts.map((widget) => (
                                <AssistantWidgetRenderer
                                  key={`${msg.id}-${widget.id}`}
                                  widget={widget}
                                  selectedProjectId={selectedProjectIdProp}
                                  onSubmit={onSubmit}
                                  onEditDraft={onInputChange}
                                />
                              ))}

                              {brandonWidgetParts.map((widget, index) => (
                                <BrandonDailyUpdateWidgetCard
                                  key={`${msg.id}-brandon-widget-${index}`}
                                  packet={widget.packet}
                                />
                              ))}

                              {/* Main text response — hidden when a widget fully replaces it */}
                              {!widgetSuppressesText && (
                                <MessageResponse
                                  className="text-sm leading-6"
                                  isAnimating={assistantTextIsAnimating}
                                  caret={
                                    assistantTextIsAnimating
                                      ? "block"
                                      : undefined
                                  }
                                >
                                  {formattedAssistantText}
                                </MessageResponse>
                              )}

                              {persistedActionToolParts.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {persistedActionToolParts.map((part) => (
                                    <AssistantDynamicToolRenderer
                                      key={part.toolCallId}
                                      part={part}
                                      selectedProjectId={selectedProjectIdProp}
                                      onSubmit={onSubmit}
                                      onEditDraft={onInputChange}
                                    />
                                  ))}
                                </div>
                              )}

                              {trailingAssistantWidgetParts.map((widget) => (
                                <AssistantWidgetRenderer
                                  key={`${msg.id}-${widget.id}`}
                                  widget={widget}
                                  selectedProjectId={selectedProjectIdProp}
                                  onSubmit={onSubmit}
                                  onEditDraft={onInputChange}
                                />
                              ))}

                              {responseQuality && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                                    {responseQuality.confidence} confidence
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                                    {responseQuality.sourceQuality} sources
                                  </span>
                                </div>
                              )}

                              {/* Source citations — rendered as subtle chips */}
                              {inlineSources.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {inlineSources.map((src) => (
                                    <span
                                      key={src}
                                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                                    >
                                      <FileTextIcon className="h-3 w-3 shrink-0 opacity-50" />
                                      {src}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Execution trace is no longer dumped inline — it is
                              tucked behind the Trace icon in the message actions
                              row below (see TraceMenu). */}

                              {/* Source citations. Re-enabled 2026-07-09: originally
                              disabled 2026-05-19 because the sources column was
                              always empty (nothing to show). #827 now persists
                              real citations, and getSourceHref links each to the
                              in-app record (meeting page / email), so the
                              evidence drawer shows grounded, clickable sources. */}
                              {persistedSources.length > 0 && (
                                <AssistantSourceEvidenceWidget
                                  sources={persistedSources}
                                />
                              )}

                              <AssistantMemoryTrace
                                usage={memoryUsage}
                                messageId={msg.id}
                                sessionId={sessionId}
                              />
                              <AssistantSkillTrace
                                usage={skillUsage}
                                messageId={msg.id}
                                sessionId={sessionId}
                              />
                            </MessageContent>

                            {/* Message actions: copy, thumbs up/down (hover-only) */}
                            {text && (
                              <MessageActions className="opacity-100">
                                <MessageAction
                                  tooltip={
                                    speakingMessageId === msg.id
                                      ? "Stop voice"
                                      : "Read aloud"
                                  }
                                  onClick={() =>
                                    handleSpeakResponse(
                                      msg.id,
                                      formattedAssistantText,
                                    )
                                  }
                                  disabled={
                                    isStreaming ||
                                    (loadingSpeechMessageId !== null &&
                                      loadingSpeechMessageId !== msg.id)
                                  }
                                >
                                  {speakingMessageId === msg.id ? (
                                    <VolumeXIcon className="h-3.5 w-3.5" />
                                  ) : (
                                    <Volume2Icon
                                      className={cn(
                                        "h-3.5 w-3.5",
                                        loadingSpeechMessageId === msg.id &&
                                          "animate-pulse",
                                      )}
                                    />
                                  )}
                                </MessageAction>
                                <MessageAction
                                  tooltip="Copy"
                                  onClick={() => handleCopy(text)}
                                >
                                  <CopyIcon className="h-3.5 w-3.5" />
                                </MessageAction>
                                {(persistedTraces.length > 0 ||
                                  traceDiagnostics) && (
                                  <TraceMenu
                                    traces={persistedTraces}
                                    diagnostics={traceDiagnostics}
                                  />
                                )}
                                <AiResponseFeedback
                                  className="ml-1"
                                  subject={{
                                    surface: "ai_assistant",
                                    subjectType: "assistant_message",
                                    subjectId: msg.id,
                                    messageId: msg.id,
                                    traceId: langfuseTraceId ?? null,
                                    projectId: selectedProjectIdProp ?? null,
                                    sessionId: sessionId ?? null,
                                    contentSnapshot: {
                                      text,
                                      model: null,
                                      generatedAt: new Date().toISOString(),
                                    },
                                  }}
                                />
                              </MessageActions>
                            )}
                          </Message>
                        </div>
                      </div>
                    );
                  })}

                  {/* Streaming indicator */}
                  {showStreamingIndicator && (
                    <StreamingIndicator
                      hasToolCalls={lastIsAssistantWithToolCalls}
                      councilMode={councilMode}
                      liveStatus={liveStatus ?? lastMessageStatus}
                    />
                  )}

                  {/* Cross-source timeline hidden from chat UI per 2026-05-02 —
                  keep the component + API so it can be reintroduced elsewhere. */}
                  {false && !isStreaming && hasMessages && (
                    <div className="pl-11">
                      <CrossSourceTimeline projectId={selectedProjectIdProp} />
                    </div>
                  )}
                </ConversationContent>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-background/80 via-background/35 to-transparent" />
                <ConversationScrollButton className="bottom-4 z-20 md:bottom-6" />
              </Conversation>
            </div>
            {activeChangeEventDraft ? (
              <div className="hidden w-96 shrink-0 border-l border-border/60 lg:block">
                <ChangeEventDraftArtifact
                  draft={activeChangeEventDraft}
                  projectOptions={changeEventDraftProjectOptions}
                  projectsLoading={projectsLoading}
                  onSubmit={onSubmit}
                  onSaveDraft={saveChangeEventDraftArtifact}
                />
              </div>
            ) : null}
          </div>
        </>
      )}

      {!showWelcome && activeChangeEventDraft ? (
        <div className="max-h-80 shrink-0 overflow-hidden border-t border-border/60 lg:hidden">
          <ChangeEventDraftArtifact
            draft={activeChangeEventDraft}
            projectOptions={changeEventDraftProjectOptions}
            projectsLoading={projectsLoading}
            onSubmit={onSubmit}
            onSaveDraft={saveChangeEventDraftArtifact}
          />
        </div>
      ) : null}

      {!showWelcome && (
        <div
          className={cn(
            "z-20 shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-0 sm:px-6",
            activeChangeEventDraft && "lg:pr-96",
          )}
        >
          <div className="mx-auto w-full max-w-3xl">
            {chatError && (
              <InfoAlert variant="error" className="mb-2 py-2">
                {chatError}
              </InfoAlert>
            )}
            {promptInputEl}
          </div>
        </div>
      )}
    </div>
  );
}
