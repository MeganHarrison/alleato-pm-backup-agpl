import type {
  GenericToolApprovalFunction,
  ToolApprovalStatus,
  ToolSet,
} from "ai";
import {
  GLOBAL_ASSISTANT_TOOL_REGISTRY,
  type AssistantToolRegistryEntry,
} from "@/lib/ai/tool-registry";

export const TOOL_APPROVAL_SECRET_ENV = "TOOL_APPROVAL_SECRET";
const MINIMUM_TOOL_APPROVAL_SECRET_BYTES = 32;

export class ToolApprovalConfigurationError extends Error {
  readonly code = "AI_TOOL_APPROVAL_SECRET_MISSING";

  constructor(message: string) {
    super(message);
    this.name = "ToolApprovalConfigurationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPreviewOnlyCall(input: unknown): boolean {
  return isRecord(input) && input.confirmed === false;
}

export function resolveAssistantToolApproval(input: {
  toolName: string;
  toolInput: unknown;
  registry?: readonly AssistantToolRegistryEntry[];
  additionalApprovalRequiredToolNames?: readonly string[];
}): ToolApprovalStatus {
  const registry = input.registry ?? GLOBAL_ASSISTANT_TOOL_REGISTRY;
  const entry = registry.find((candidate) => candidate.name === input.toolName);
  const additionalApprovalRequiredToolNames = new Set(
    input.additionalApprovalRequiredToolNames ?? [],
  );

  if (additionalApprovalRequiredToolNames.has(input.toolName)) {
    return "user-approval";
  }

  if (!entry?.requiresWritePermission && !entry?.requiresDeliveryPermission) {
    return undefined;
  }

  // Legacy confirmed:false calls are side-effect-free preview generation. The
  // exact subsequent confirmed write is what the signed SDK approval binds.
  // Do not mutate the signed input after approval: tool name, call ID, and the
  // complete executor payload must remain identical to what the user approved.
  if (isPreviewOnlyCall(input.toolInput)) return undefined;

  return "user-approval";
}

export function createAssistantToolApprovalPolicy(
  registry: readonly AssistantToolRegistryEntry[] = GLOBAL_ASSISTANT_TOOL_REGISTRY,
  additionalApprovalRequiredToolNames: readonly string[] = [],
): GenericToolApprovalFunction<ToolSet, never> {
  return ({ toolCall }) =>
    resolveAssistantToolApproval({
      toolName: toolCall.toolName,
      toolInput: toolCall.input,
      registry,
      additionalApprovalRequiredToolNames,
    });
}

export function resolveToolApprovalSecret(input: {
  actionToolsEnabled: boolean;
  env?: Readonly<Record<string, string | undefined>>;
}): string | undefined {
  if (!input.actionToolsEnabled) return undefined;

  const value = (input.env ?? process.env)[TOOL_APPROVAL_SECRET_ENV]?.trim();
  const byteLength = value ? new TextEncoder().encode(value).byteLength : 0;

  if (!value || byteLength < MINIMUM_TOOL_APPROVAL_SECRET_BYTES) {
    throw new ToolApprovalConfigurationError(
      `${TOOL_APPROVAL_SECRET_ENV} must contain at least ${MINIMUM_TOOL_APPROVAL_SECRET_BYTES} bytes whenever AI assistant action tools are enabled.`,
    );
  }

  return value;
}
