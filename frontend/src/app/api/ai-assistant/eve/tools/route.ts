import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  createProductionEveRequestCatalog,
  type AiSdkStyleTool,
  type EveToolSurface,
  type RequestScopedToolCatalog,
} from "@/lib/ai/eve-runtime";
import { createRFIInputSchema } from "@/lib/ai/tool-descriptors";
import {
  hasPermission,
  loadUserPermissionsWithClient,
} from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";

const WHERE_GET = "ai-assistant/eve/tools#GET";
const WHERE_POST = "ai-assistant/eve/tools#POST";
const PROJECT_HEADER = "x-alleato-project-id";
const ASSISTANT_TURN_HEADER = "x-assistant-turn-id";
const EVE_SIGNATURE_HEADER = "x-alleato-eve-signature";
const EVE_TIMESTAMP_HEADER = "x-alleato-eve-timestamp";
const EVE_USER_HEADER = "x-alleato-eve-user-id";
const EVE_PROVIDER = "eve";
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const SIGNATURE_MAX_FUTURE_SKEW_MS = 30 * 1000;
const EveRuntimeId = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:/-]+$/);

const GovernedCreateRfiInput = createRFIInputSchema
  .omit({ confirmed: true, idempotencyKey: true })
  .extend({
    projectId: z.number().int().positive(),
    subject: z
      .string()
      .min(1)
      .max(500)
      .refine((value) => value.trim().length > 0),
    question: z
      .string()
      .min(1)
      .max(10_000)
      .refine((value) => value.trim().length > 0),
    ballInCourt: z
      .string()
      .min(1)
      .max(500)
      .refine((value) => value.trim().length > 0)
      .optional(),
    dueDate: z.iso.date().optional(),
    costImpact: z.enum(["yes", "no", "tbd"]),
    scheduleImpact: z.enum(["yes", "no", "tbd"]),
  })
  .strict();

const ExecuteToolBody = z
  .object({
    eveSessionId: EveRuntimeId,
    eveTurnId: EveRuntimeId,
    surface: z.enum(["ai_assistant", "ask_alleato"]),
    toolCallId: EveRuntimeId,
    toolName: z.string().trim().min(1).max(160),
    input: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

interface VerifiedEveRequestContext {
  userId: string;
  projectId: number | null;
  serviceClient: ReturnType<typeof createServiceClient>;
}

interface EveToolDescription {
  approvalRequirement: "none" | "user";
  name: string;
  description: string;
  effect: "read" | "write";
  inputSchema: unknown;
}

interface EveExecutionReceipt {
  assistantTurnId: string;
  eveSessionId: string;
  eveTurnId: string;
  idempotencyKey: string;
  payloadHash: string;
  toolCallId: string;
}

function requiredBridgeSecret(where: string): string {
  const secret = process.env.ALLEATO_EVE_PROXY_SECRET?.trim();
  if (!secret) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where,
      message:
        "The Eve tool bridge signing secret is not configured.",
      status: 500,
      severity: "high",
    });
  }
  return secret;
}

function requireBridgeSignature(
  request: Request,
  rawBody: string,
  where: string,
): void {
  const timestampRaw = request.headers
    .get(EVE_TIMESTAMP_HEADER)
    ?.trim();
  const signature = request.headers
    .get(EVE_SIGNATURE_HEADER)
    ?.trim()
    .toLowerCase();
  const timestamp = Number(timestampRaw);
  const age = Date.now() - timestamp;

  if (
    !timestampRaw ||
    !Number.isSafeInteger(timestamp) ||
    age > SIGNATURE_MAX_AGE_MS ||
    age < -SIGNATURE_MAX_FUTURE_SKEW_MS ||
    !signature ||
    !/^[0-9a-f]{64}$/.test(signature)
  ) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where,
      message:
        "The Eve tool bridge request has an invalid or expired runtime signature.",
      status: 403,
      severity: "high",
    });
  }

  const assistantTurnId = requireAssistantTurnId(request, where);
  const userId = requireEveUserId(request, where);
  const projectId = request.headers.get(PROJECT_HEADER)?.trim() ?? "";
  const expected = createHmac(
    "sha256",
    requiredBridgeSecret(where),
  )
    .update(
      [
        timestampRaw,
        assistantTurnId,
        userId,
        projectId,
        rawBody,
      ].join("\n"),
    )
    .digest("hex");
  if (
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    )
  ) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where,
      message:
        "The Eve tool bridge runtime signature did not match the request.",
      status: 403,
      severity: "high",
    });
  }
}

function requireEveUserId(
  request: Request,
  where: string,
): string {
  const userId = request.headers.get(EVE_USER_HEADER)?.trim();
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where,
      message:
        "A valid signed Eve user identity is required for the tool bridge.",
      status: 403,
      severity: "high",
    });
  }
  return userId;
}

function optionalProjectId(request: Request, where: string): number | null {
  const rawProjectId = request.headers.get(PROJECT_HEADER)?.trim();
  if (!rawProjectId) return null;
  if (rawProjectId.includes(",")) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where,
      message:
        "Project scope is ambiguous. Send exactly one x-alleato-project-id value.",
      status: 409,
    });
  }
  if (!/^[1-9]\d*$/.test(rawProjectId)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: `${PROJECT_HEADER} must be a positive integer.`,
      status: 400,
    });
  }

  const projectId = Number(rawProjectId);
  if (!Number.isSafeInteger(projectId)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: `${PROJECT_HEADER} must be a safe positive integer.`,
      status: 400,
    });
  }
  return projectId;
}

function requireAssistantTurnId(request: Request, where: string): string {
  const turnId = request.headers.get(ASSISTANT_TURN_HEADER)?.trim();
  if (!turnId || !z.string().uuid().safeParse(turnId).success) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where,
      message:
        "A valid durable AssistantTurn ID is required for the Eve tool bridge.",
      status: 403,
      severity: "high",
    });
  }
  return turnId;
}

async function verifyRequestContext(
  request: Request,
  where: string,
): Promise<VerifiedEveRequestContext> {
  const userId = requireEveUserId(request, where);
  const projectId = optionalProjectId(request, where);
  const serviceClient = createServiceClient();

  if (projectId !== null) {
    const projectPermissions =
      await loadUserPermissionsWithClient(
        serviceClient,
        projectId,
        userId,
      );
    if (!projectPermissions) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where,
        message:
          "The selected project does not exist or is not accessible to this user.",
        status: 403,
      });
    }
  }

  return {
    userId,
    projectId,
    serviceClient,
  };
}

function requireSurface(request: Request, where: string): EveToolSurface {
  const surface = new URL(request.url).searchParams.get("surface");
  if (surface === "ai_assistant" || surface === "ask_alleato") {
    return surface;
  }
  throw new GuardrailError({
    code: "INVALID_PAYLOAD",
    where,
    message: "surface must be ai_assistant or ask_alleato.",
    status: 400,
  });
}

function surfaceFromDurablePayload(payload: unknown): EveToolSurface | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const surface = (payload as Record<string, unknown>).surface;
  if (surface === "alleato_ai" || surface === "ai_assistant") {
    return "ai_assistant";
  }
  return surface === "ask_alleato" ? surface : null;
}

async function requireDurableSurface({
  claimedSurface,
  context,
  request,
  where,
}: {
  claimedSurface: EveToolSurface;
  context: VerifiedEveRequestContext;
  request: Request;
  where: string;
}): Promise<EveToolSurface> {
  const assistantTurnId = requireAssistantTurnId(request, where);
  const { data: durableTurn, error: durableTurnError } =
    await context.serviceClient
      .from("durable_ai_turns")
      .select("command_payload")
      .eq("id", assistantTurnId)
      .eq("user_id", context.userId)
      .maybeSingle();

  if (durableTurnError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: "Durable Eve turn surface verification failed.",
      status: 500,
      severity: "high",
      cause: durableTurnError,
    });
  }
  if (!durableTurn) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where,
      message:
        "The Eve tool bridge request is not bound to an authenticated durable turn.",
      status: 403,
      severity: "high",
    });
  }

  const durableSurface = surfaceFromDurablePayload(
    durableTurn.command_payload,
  );
  if (!durableSurface) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where,
      message:
        "The durable Eve turn is missing a valid server-owned assistant surface.",
      status: 500,
      severity: "high",
    });
  }
  if (claimedSurface !== durableSurface) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where,
      message: `The requested ${claimedSurface} tool surface does not match the durable Eve turn surface ${durableSurface}.`,
      status: 403,
      severity: "high",
    });
  }
  return durableSurface;
}

async function canCreateRfi(
  context: VerifiedEveRequestContext,
  surface: EveToolSurface,
): Promise<boolean> {
  if (surface !== "ai_assistant" || context.projectId === null) {
    return false;
  }
  const permissions = await loadUserPermissionsWithClient(
    context.serviceClient,
    context.projectId,
    context.userId,
  );
  return permissions !== null &&
    hasPermission(permissions, "rfis", "write");
}

async function canUseAllGovernedTools(
  context: VerifiedEveRequestContext,
  surface: EveToolSurface,
): Promise<boolean> {
  if (surface !== "ai_assistant") return false;

  const { data, error } = await context.serviceClient
    .from("user_profiles")
    .select("is_admin")
    .eq("id", context.userId)
    .maybeSingle();

  return !error && data?.is_admin === true;
}

async function createGovernedCatalog({
  context,
  userId,
  projectId,
  surface,
}: {
  context: VerifiedEveRequestContext;
  userId: string;
  projectId: number | null;
  surface: EveToolSurface;
}): Promise<RequestScopedToolCatalog> {
  const [rfiWriteAllowed, allGovernedToolsAllowed] = await Promise.all([
    canCreateRfi(context, surface),
    canUseAllGovernedTools(context, surface),
  ]);
  const writeAllowed = rfiWriteAllowed || allGovernedToolsAllowed;
  const deliveryAllowed = allGovernedToolsAllowed;
  const { catalog } = createProductionEveRequestCatalog({
    actorPermissions: [
      "ai_assistant.tools.read",
      ...(writeAllowed
        ? ["ai_assistant.tools.write"]
        : []),
      ...(deliveryAllowed
        ? ["ai_assistant.tools.deliver"]
        : []),
    ],
    allowWrites: writeAllowed,
    allowDelivery: deliveryAllowed,
    userId,
    project:
      projectId === null
        ? { status: "not_found" }
        : { status: "resolved", projectId },
    provider: EVE_PROVIDER,
    surface,
  });

  const unsafeEntry = catalog.entries.find(
    (entry) =>
      (entry.effect === "read" &&
        entry.approvalRequirement !== "none") ||
      (entry.effect !== "read" &&
        entry.approvalRequirement !== "user"),
  );
  if (unsafeEntry) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where: "ai-assistant/eve/tools#createGovernedCatalog",
      message: `Tool "${unsafeEntry.name}" crossed the governed Eve bridge with invalid effect or approval metadata.`,
      status: 500,
      severity: "high",
    });
  }

  const entries = catalog.entries.filter(
    (entry) =>
      entry.effect === "read" ||
      allGovernedToolsAllowed ||
      (rfiWriteAllowed && entry.name === "createRFI"),
  );
  return {
    entries,
    advertisedNames: entries.map((entry) => entry.name),
    executableNames: entries.map((entry) => entry.name),
  };
}

function serializableSchema(schema: unknown, toolName: string): unknown {
  try {
    if (
      schema &&
      typeof schema === "object" &&
      ("_zod" in schema || "_def" in schema)
    ) {
      return z.toJSONSchema(schema as z.ZodType);
    }
    const serialized = JSON.stringify(schema);
    if (serialized === undefined) {
      throw new Error("Schema did not produce JSON.");
    }
    return JSON.parse(serialized);
  } catch (error) {
    throw new GuardrailError({
      code: "SCHEMA_MISMATCH",
      where: "ai-assistant/eve/tools#serializableSchema",
      message: `Tool "${toolName}" does not expose a serializable input schema.`,
      status: 500,
      cause: error,
    });
  }
}

function describeCatalog(
  catalog: RequestScopedToolCatalog,
): EveToolDescription[] {
  return catalog.entries.map((entry) => {
    const governedTool = governedToolSchema(entry);
    return {
      approvalRequirement: entry.approvalRequirement,
      name: entry.name,
      description: entry.description,
      effect: entry.effect === "read" ? "read" : "write",
      inputSchema: serializableSchema(
        governedTool.inputSchema ?? governedTool.parameters ?? entry.inputSchema,
        entry.name,
      ),
    };
  });
}

async function validateToolInput(
  tool: AiSdkStyleTool,
  input: Record<string, unknown>,
  toolName: string,
): Promise<unknown> {
  const schema = tool.inputSchema ?? tool.parameters;
  if (
    schema &&
    typeof schema === "object" &&
    "safeParseAsync" in schema &&
    typeof schema.safeParseAsync === "function"
  ) {
    const parsed = await schema.safeParseAsync(input);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE_POST,
        message: `Input for tool "${toolName}" failed schema validation.`,
        status: 400,
        details: parsed.error?.issues,
      });
    }
    return parsed.data;
  }
  return input;
}

function governedToolSchema(
  entry: RequestScopedToolCatalog["entries"][number],
): AiSdkStyleTool {
  if (entry.effect === "read") {
    return entry.tool;
  }
  const schema = entry.tool.inputSchema ?? entry.tool.parameters;
  if (!(schema instanceof z.ZodObject)) return entry.tool;

  const omitMask: Record<string, true> = {};
  if ("confirmed" in schema.shape) omitMask.confirmed = true;
  if ("idempotencyKey" in schema.shape) omitMask.idempotencyKey = true;

  const governedShape = Object.fromEntries(
    Object.entries(schema.shape).filter(([key]) => !(key in omitMask)),
  );

  return {
    ...entry.tool,
    inputSchema:
      entry.name === "createRFI"
        ? GovernedCreateRfiInput
        : Object.keys(omitMask).length > 0
          ? z.object(governedShape).strict()
          : schema,
  };
}

function requireScopedProjectMatch(
  context: VerifiedEveRequestContext,
  input: unknown,
  toolName: string,
  enforceProjectScope: boolean,
): void {
  if (
    !enforceProjectScope ||
    context.projectId === null ||
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !Object.prototype.hasOwnProperty.call(input, "projectId")
  ) {
    return;
  }

  const scopedProjectId = (input as { projectId?: unknown }).projectId;
  if (typeof scopedProjectId !== "number") {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE_POST,
      message: `Tool "${toolName}" requires a numeric projectId in the governed payload.`,
      status: 400,
    });
  }
  if (scopedProjectId !== context.projectId) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where: WHERE_POST,
      message: `Tool "${toolName}" is bound to project ${context.projectId} and cannot execute against project ${scopedProjectId}.`,
      status: 403,
      severity: "high",
    });
  }
}

function normalizeReadProjectSentinel(
  context: VerifiedEveRequestContext,
  input: unknown,
  effect: RequestScopedToolCatalog["entries"][number]["effect"],
): unknown {
  if (
    effect !== "read" ||
    context.projectId === null ||
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    (input as { projectId?: unknown }).projectId !== 0
  ) {
    return input;
  }

  return {
    ...(input as Record<string, unknown>),
    projectId: context.projectId,
  };
}

function createExecutionReceipt({
  assistantTurnId,
  body,
  businessInput,
  userId,
}: {
  assistantTurnId: string;
  body: z.infer<typeof ExecuteToolBody>;
  businessInput: unknown;
  userId: string;
}): EveExecutionReceipt {
  const payloadJson = JSON.stringify(businessInput);
  const payloadHash = createHash("sha256")
    .update(payloadJson)
    .digest("hex");
  const idempotencyKey = createHash("sha256")
    .update(
      [
        "eve-governed-action-v1",
        userId,
        assistantTurnId,
        body.eveSessionId,
        body.eveTurnId,
        body.toolCallId,
        body.toolName,
        payloadHash,
      ].join(":"),
    )
    .digest("hex");
  return {
    assistantTurnId,
    eveSessionId: body.eveSessionId,
    eveTurnId: body.eveTurnId,
    idempotencyKey,
    payloadHash,
    toolCallId: body.toolCallId,
  };
}

export const GET = withApiGuardrails(
  WHERE_GET,
  async ({ request }) => {
    requireBridgeSignature(request, "", WHERE_GET);
    const context = await verifyRequestContext(request, WHERE_GET);
    const surface = await requireDurableSurface({
      claimedSurface: requireSurface(request, WHERE_GET),
      context,
      request,
      where: WHERE_GET,
    });
    const catalog = await createGovernedCatalog({
      context,
      userId: context.userId,
      projectId: context.projectId,
      surface,
    });

    return Response.json(
      {
        surface,
        projectId: context.projectId,
        tools: describeCatalog(catalog),
      },
      { headers: { "cache-control": "no-store" } },
    );
  },
);

export const POST = withApiGuardrails(
  WHERE_POST,
  async ({ request }) => {
    const rawBody = await request.clone().text();
    requireBridgeSignature(request, rawBody, WHERE_POST);
    const context = await verifyRequestContext(request, WHERE_POST);
    const body = await parseJsonBody(request, ExecuteToolBody, WHERE_POST);
    const surface = await requireDurableSurface({
      claimedSurface: body.surface,
      context,
      request,
      where: WHERE_POST,
    });
    const catalog = await createGovernedCatalog({
      context,
      userId: context.userId,
      projectId: context.projectId,
      surface,
    });

    const entry = catalog.entries.find(
      (candidate) => candidate.name === body.toolName,
    );
    if (!entry) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where: WHERE_POST,
        message: `Tool "${body.toolName}" is not available in this request-scoped catalog.`,
        status: 403,
      });
    }

    const execute = entry.tool.execute;
    if (typeof execute !== "function") {
      throw new GuardrailError({
        code: "CONFIGURATION_ERROR",
        where: WHERE_POST,
        message: `Tool "${body.toolName}" has no executable implementation.`,
        status: 500,
        severity: "high",
      });
    }

    const normalizedInput = normalizeReadProjectSentinel(
      context,
      body.input,
      entry.effect,
    );
    const validatedInput = await validateToolInput(
      governedToolSchema(entry),
      normalizedInput,
      body.toolName,
    );
    requireScopedProjectMatch(
      context,
      validatedInput,
      body.toolName,
      entry.requiresProjectScope || entry.effect !== "read",
    );
    const receipt =
      entry.effect !== "read"
        ? createExecutionReceipt({
            assistantTurnId: requireAssistantTurnId(
              request,
              WHERE_POST,
            ),
            body,
            businessInput: validatedInput,
            userId: context.userId,
          })
        : null;
    const executionInput =
      receipt
        ? {
            ...(validatedInput as Record<string, unknown>),
            confirmed: true,
            idempotencyKey: receipt.idempotencyKey,
          }
        : validatedInput;
    const finalExecutionInput = receipt
      ? await validateToolInput(
          entry.tool,
          executionInput,
          body.toolName,
        )
      : executionInput;
    const result = await execute(finalExecutionInput, {
      toolCallId: body.toolCallId,
      messages: [],
      abortSignal: request.signal,
    });

    return Response.json({
      toolName: body.toolName,
      projectId: context.projectId,
      ...(receipt ? { receipt } : {}),
      result,
    });
  },
);
