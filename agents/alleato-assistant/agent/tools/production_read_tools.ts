import { createHmac } from "node:crypto";

import {
  defineDynamic,
  defineTool,
  type DynamicResolveContext,
} from "eve/tools";
import { always } from "eve/tools/approval";

type JsonValue =
  | boolean
  | JsonObject
  | JsonValue[]
  | null
  | number
  | string;
type JsonObject = { [key: string]: JsonValue };

type BridgeTool = {
  approvalRequirement: "none" | "user";
  description: string;
  effect: "read" | "write";
  inputSchema: JsonObject;
  name: string;
};

type AssistantSurface = "ai_assistant" | "ask_alleato";

const RESERVED_TOOL_NAMES = new Set([
  "agent",
  "ask_question",
  "bash",
  "glob",
  "grep",
  "load_skill",
  "read_file",
  "todo",
  "web_fetch",
  "web_search",
  "write_file",
]);

function requiredAppUrl(): string {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const configured =
    process.env.ALLEATO_APP_URL?.trim() ??
    process.env.APP_BASE_URL?.trim() ??
    process.env.BASE_URL?.trim() ??
    (vercelUrl ? `https://${vercelUrl}` : undefined);
  if (!configured) {
    throw new Error(
      "Eve production tools are missing ALLEATO_APP_URL, APP_BASE_URL, BASE_URL, or VERCEL_URL.",
    );
  }

  const url = new URL(configured);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("ALLEATO_APP_URL must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("ALLEATO_APP_URL must not contain credentials.");
  }
  return url.toString().replace(/\/$/, "");
}

function requiredBridgeSecret(): string {
  const secret = process.env.ALLEATO_EVE_PROXY_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Eve production tools are missing ALLEATO_EVE_PROXY_SECRET.",
    );
  }
  return secret;
}

function signedBridgeHeaders({
  assistantTurnId,
  body,
  projectId,
  userId,
}: {
  assistantTurnId: string;
  body: string;
  projectId?: string;
  userId: string;
}): Headers {
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", requiredBridgeSecret())
    .update(
      [
        timestamp,
        assistantTurnId,
        userId,
        projectId ?? "",
        body,
      ].join("\n"),
    )
    .digest("hex");
  const headers = new Headers({
    accept: "application/json",
    "x-alleato-eve-signature": signature,
    "x-alleato-eve-timestamp": timestamp,
    "x-alleato-eve-user-id": userId,
    "x-assistant-turn-id": assistantTurnId,
  });
  if (projectId !== undefined) {
    headers.set("x-alleato-project-id", projectId);
  }
  return headers;
}

function parseCatalog(
  payload: unknown,
  expected: {
    projectId: number | null;
    surface: AssistantSurface;
  },
): BridgeTool[] {
  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as { surface?: unknown }).surface !== expected.surface ||
    (payload as { projectId?: unknown }).projectId !== expected.projectId ||
    !Array.isArray((payload as { tools?: unknown }).tools)
  ) {
    throw new Error("Alleato Eve tool bridge returned an invalid catalog.");
  }

  const names = new Set<string>();
  return (payload as { tools: unknown[] }).tools.map((value) => {
    if (
      typeof value !== "object" ||
      value === null ||
      typeof (value as { name?: unknown }).name !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(
        (value as { name: string }).name,
      ) ||
      typeof (value as { description?: unknown }).description !== "string" ||
      !(value as { description: string }).description.trim() ||
      !["read", "write"].includes(
        String((value as { effect?: unknown }).effect),
      ) ||
      !["none", "user"].includes(
        String(
          (value as { approvalRequirement?: unknown })
            .approvalRequirement,
        ),
      ) ||
      typeof (value as { inputSchema?: unknown }).inputSchema !== "object" ||
      (value as { inputSchema?: unknown }).inputSchema === null ||
      Array.isArray((value as { inputSchema?: unknown }).inputSchema)
    ) {
      throw new Error(
        "Alleato Eve tool bridge advertised an invalid tool.",
      );
    }

    const tool = value as BridgeTool;
    if (
      (tool.effect === "read" &&
        tool.approvalRequirement !== "none") ||
      (tool.effect === "write" &&
        tool.approvalRequirement !== "user")
    ) {
      throw new Error(
        `Alleato Eve tool bridge advertised inconsistent approval metadata for ${tool.name}.`,
      );
    }
    if (RESERVED_TOOL_NAMES.has(tool.name)) {
      throw new Error(
        `Alleato Eve tool bridge advertised reserved tool ${tool.name}.`,
      );
    }
    if (names.has(tool.name)) {
      throw new Error(
        `Alleato Eve tool bridge advertised duplicate tool ${tool.name}.`,
      );
    }
    names.add(tool.name);
    return tool;
  });
}

async function resolveProductionReadTools(ctx: DynamicResolveContext) {
  const current = ctx.session.auth.current;
  if (
    current?.principalType !== "user" ||
    typeof current.principalId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      current.principalId,
    )
  ) {
    return null;
  }
  const userId = current.principalId;

  const selectedProjectId = current.attributes?.selectedProjectId;
  if (
    selectedProjectId !== undefined &&
    (typeof selectedProjectId !== "string" ||
      !/^[1-9]\d*$/.test(selectedProjectId))
  ) {
    throw new Error(
      "Eve session contains invalid verified project context.",
    );
  }
  const projectId =
    selectedProjectId === undefined ? null : Number(selectedProjectId);
  if (projectId !== null && !Number.isSafeInteger(projectId)) {
    throw new Error(
      "Eve session contains invalid verified project context.",
    );
  }

  const assistantSurface = current.attributes?.assistantSurface;
  if (
    assistantSurface !== "ai_assistant" &&
    assistantSurface !== "ask_alleato"
  ) {
    throw new Error(
      "Eve session is missing valid verified assistant surface.",
    );
  }
  const assistantTurnId = current.attributes?.assistantTurnId;
  if (
    typeof assistantTurnId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      assistantTurnId,
    )
  ) {
    throw new Error(
      "Eve session is missing a valid verified durable turn.",
    );
  }

  const appUrl = requiredAppUrl();
  const bridgeUrl = `${appUrl}/api/ai-assistant/eve/tools`;
  const catalogUrl =
    `${bridgeUrl}?surface=${encodeURIComponent(assistantSurface)}`;
  const headers = signedBridgeHeaders({
    assistantTurnId,
    body: "",
    projectId: selectedProjectId,
    userId,
  });

  const response = await fetch(catalogUrl, {
    headers,
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(
      `Alleato Eve tool catalog request failed with HTTP ${response.status}.`,
    );
  }

  const tools = parseCatalog(await response.json(), {
    projectId,
    surface: assistantSurface,
  });
  return Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      defineTool({
        ...(tool.approvalRequirement === "user"
          ? { approval: always() }
          : {}),
        description: tool.description,
        // Eve natively accepts a JSON Schema object here. Keeping the
        // bridge schema in that supported form avoids translating it into
        // a second validation dialect before the model sees it.
        inputSchema: tool.inputSchema,
        async execute(input, eveContext) {
          const executionBody = JSON.stringify({
            eveSessionId: eveContext.session.id,
            eveTurnId: eveContext.session.turn.id,
            input,
            surface: assistantSurface,
            toolCallId: eveContext.callId,
            toolName: tool.name,
          });
          const executionHeaders = signedBridgeHeaders({
            assistantTurnId,
            body: executionBody,
            projectId: selectedProjectId,
            userId,
          });
          executionHeaders.set("content-type", "application/json");

          const execution = await fetch(bridgeUrl, {
            body: executionBody,
            headers: executionHeaders,
            method: "POST",
          });
          if (!execution.ok) {
            const detail = (await execution.text()).slice(0, 500);
            throw new Error(
              `Alleato Eve tool ${tool.name} failed with HTTP ${execution.status}: ${detail}`,
            );
          }

          const payload = (await execution.json()) as unknown;
          if (
            typeof payload !== "object" ||
            payload === null ||
            (payload as { toolName?: unknown }).toolName !== tool.name ||
            (payload as { projectId?: unknown }).projectId !== projectId ||
            !Object.hasOwn(payload, "result")
          ) {
            throw new Error(
              `Alleato Eve tool ${tool.name} returned an invalid execution result.`,
            );
          }
          const result = (payload as { result: unknown }).result;
          if (tool.effect === "read") return result;

          const receipt = (payload as { receipt?: unknown }).receipt;
          if (
            !receipt ||
            typeof receipt !== "object" ||
            typeof (receipt as { idempotencyKey?: unknown })
              .idempotencyKey !== "string" ||
            typeof (receipt as { payloadHash?: unknown })
              .payloadHash !== "string"
          ) {
            throw new Error(
              `Alleato Eve write tool ${tool.name} returned no execution receipt.`,
            );
          }
          return {
            ...(result &&
            typeof result === "object" &&
            !Array.isArray(result)
              ? result
              : { result }),
            governedApproval: {
              message:
                "The user approved this exact tool call before execution. Describe the write as completed after approval, never as created before approval.",
              status: "approved",
            },
            executionReceipt: receipt,
          };
        },
      }),
    ]),
  );
}

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) =>
      resolveProductionReadTools(ctx),
    "turn.started": async (_event, ctx) =>
      resolveProductionReadTools(ctx),
  },
});
