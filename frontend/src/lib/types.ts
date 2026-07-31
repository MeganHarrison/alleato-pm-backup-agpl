import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/ai-chat/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";

// AI SDK types

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

// Agent & project types

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  agent?: string;
  timestamp: Date;
}

export interface Agent {
  name: string;
  description: string;
  handoffs: string[];
  tools: string[];
  /** List of input guardrail identifiers for this agent */
  input_guardrails: string[];
}

export type EventType =
  | "message"
  | "handoff"
  | "tool_call"
  | "tool_output"
  | "context_update"
  | "progress_update"
  | "rag_query_start"
  | "rag_retrieval_complete"
  | "guardrail_check"
  | "guardrail_passed"
  | "guardrail_blocked"
  | "classification_start"
  | "classification_result"
  | "agent_start"
  | "agent_complete"
  | "error";

export interface AgentEvent {
  id: string;
  type: EventType;
  agent: string;
  content: string;
  timestamp: Date;
  metadata?: {
    source_agent?: string;
    target_agent?: string;
    tool_name?: string;
    tool_args?: Record<string, any>;
    tool_result?: any;
    context_key?: string;
    context_value?: any;
    changes?: Record<string, any>;
    query?: string;
    chunks_retrieved?: number;
    avg_score?: number;
    [key: string]: any; // Allow additional properties
  };
}

export interface GuardrailCheck {
  id: string;
  name: string;
  input: string;
  reasoning: string;
  passed: boolean;
  timestamp: Date;
}

export interface ProjectSummary {
  project_id: number;
  name: string;
  meeting_count: number;
  open_tasks: number;
  last_meeting_at?: string | null;
  last_task_update?: string | null;
  phase?: string | null;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  due_date?: string | null;
  project_id?: number | null;
  source_document_id?: string | null;
}

export interface InsightItem {
  id?: string;
  project_id: number;
  summary: string;
  detail?: Record<string, any>;
  severity?: string | null;
  captured_at?: string | null;
}

export interface ChatSourceSnippet {
  document_id: string;
  chunk_index: number;
  snippet: string;
  metadata?: Record<string, any>;
}

export interface ChatAnswer {
  reply: string;
  sources: ChatSourceSnippet[];
  tasks: TaskItem[];
  insights: InsightItem[];
}
