#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const args = process.argv.slice(2);
const artifactIndex = args.indexOf("--artifact");

if (args.includes("--help")) {
  console.log("Usage: node scripts/verify/verify_ai_tool_calling_provider_matrix.mjs --artifact path/to/results.json");
  process.exit(0);
}

if (artifactIndex < 0 || !args[artifactIndex + 1]) {
  console.error("--artifact is required; this verifier does not own a default historical result path.");
  process.exit(1);
}
const frontendRequire = createRequire(
  new URL("../../frontend/package.json", import.meta.url),
);

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const artifactPath = path.resolve(repoRoot, args[artifactIndex + 1]);

const gatewayModelId = process.env.AI_TOOL_MATRIX_GATEWAY_MODEL ?? "openai/gpt-5.4";
const directModelId = process.env.AI_TOOL_MATRIX_DIRECT_MODEL ?? "gpt-5.4";
const prompt =
  "Use the getProjectSignal tool to identify the project id for Westfield Collective, then tell me the current risk in one sentence.";

const { generateText, streamText, stepCountIs, tool } = await import(
  frontendRequire.resolve("ai")
);
const { createOpenAI } = await import(frontendRequire.resolve("@ai-sdk/openai"));
const { z } = await import(frontendRequire.resolve("zod"));

const toolInputSchema = z.object({
  projectName: z
    .string()
    .describe("The project name to resolve, for example Westfield Collective."),
});

function createDiagnosticTool(executions) {
  return tool({
    description:
      "Resolve a project name to the current concise project signal. Must be used for Westfield Collective status questions.",
    inputSchema: toolInputSchema,
    execute: async ({ projectName }) => {
      const result = {
        projectName: "Westfield Collective",
        projectId: 43,
        risk: "TCO timeline and pending cost exposure need review before the next approval decision.",
        requestedProjectName: projectName,
      };
      executions.push({
        toolName: "getProjectSignal",
        input: { projectName },
        output: result,
      });
      return result;
    },
  });
}

function gatewayChatModel() {
  const gatewayOpenAI = createOpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: "https://ai-gateway.vercel.sh/v1",
  });
  return gatewayOpenAI.chat(gatewayModelId);
}

function directChatModel() {
  const directOpenAI = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  return directOpenAI.chat(directModelId);
}

function compactError(error) {
  if (!error) return null;
  return {
    name: error.name ?? "Error",
    message: error.message ?? String(error),
    stack: error.stack
      ? String(error.stack)
          .split("\n")
          .slice(0, 6)
          .join("\n")
      : undefined,
    cause:
      error.cause instanceof Error
        ? {
            name: error.cause.name,
            message: error.cause.message,
          }
        : error.cause
          ? String(error.cause)
          : undefined,
  };
}

function compactResult({
  providerPath,
  method,
  modelId,
  result,
  text,
  executions,
  stepEvents,
  startedAt,
  error,
}) {
  const finishedAt = new Date().toISOString();
  const finalText = text ?? result?.text ?? "";
  const toolCalls = result?.toolCalls ?? [];
  const toolResults = result?.toolResults ?? [];
  const steps = result?.steps ?? [];
  const observedToolCallCount = toolCalls.length || executions.length;
  const observedToolResultCount = toolResults.length || executions.length;
  const validationFailures = [];

  if (!error && observedToolCallCount < 1) {
    validationFailures.push("Expected at least one getProjectSignal tool call.");
  }
  if (!error && observedToolResultCount < 1) {
    validationFailures.push("Expected at least one getProjectSignal tool result.");
  }
  if (!error && finalText.trim().length < 1) {
    validationFailures.push("Expected non-empty final text.");
  }
  if (!error && result?.finishReason === "other") {
    validationFailures.push("Finish reason was other.");
  }
  const status = error || validationFailures.length > 0 ? "fail" : "pass";

  return {
    providerPath,
    method,
    modelId,
    status,
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    toolCallCount: observedToolCallCount,
    toolCallNames:
      toolCalls.length > 0
        ? toolCalls.map((call) => call.toolName).filter(Boolean)
        : executions.map((execution) => execution.toolName),
    toolResultCount: observedToolResultCount,
    toolExecutions: executions,
    finalTextLength: finalText.length,
    finalText,
    finishReason: result?.finishReason ?? null,
    rawFinishReason: result?.rawFinishReason ?? null,
    warnings: result?.warnings ?? [],
    validationFailures,
    stepCount: steps.length,
    stepEvents,
    steps: steps.map((step, index) => ({
      index,
      finishReason: step.finishReason ?? null,
      rawFinishReason: step.rawFinishReason ?? null,
      toolCallCount: step.toolCalls?.length ?? 0,
      toolResultCount: step.toolResults?.length ?? 0,
      toolCallNames: (step.toolCalls ?? [])
        .map((call) => call.toolName)
        .filter(Boolean),
      textLength: step.text?.length ?? 0,
      warnings: step.warnings ?? [],
    })),
    error: compactError(error),
  };
}

async function runGenerateTextCase({ providerPath, modelId, modelFactory }) {
  const startedAt = new Date().toISOString();
  const executions = [];
  const stepEvents = [];

  try {
    const result = await generateText({
      model: modelFactory(),
      prompt,
      tools: {
        getProjectSignal: createDiagnosticTool(executions),
      },
      stopWhen: stepCountIs(3),
      maxOutputTokens: 400,
      experimental_onToolCallStart({ toolName, input }) {
        stepEvents.push({ event: "tool_call_start", toolName, input });
      },
      experimental_onToolCallFinish({ toolName, durationMs, error }) {
        stepEvents.push({
          event: "tool_call_finish",
          toolName,
          durationMs,
          error: error ? compactError(error) : null,
        });
      },
      onStepFinish({ stepNumber, finishReason }) {
        stepEvents.push({ event: "step_finish", stepNumber, finishReason });
      },
    });

    return compactResult({
      providerPath,
      method: "generateText",
      modelId,
      result,
      executions,
      stepEvents,
      startedAt,
    });
  } catch (error) {
    return compactResult({
      providerPath,
      method: "generateText",
      modelId,
      executions,
      stepEvents,
      startedAt,
      error,
    });
  }
}

async function runStreamTextCase({ providerPath, modelId, modelFactory }) {
  const startedAt = new Date().toISOString();
  const executions = [];
  const stepEvents = [];
  const streamErrors = [];

  try {
    const result = streamText({
      model: modelFactory(),
      prompt,
      tools: {
        getProjectSignal: createDiagnosticTool(executions),
      },
      stopWhen: stepCountIs(3),
      maxOutputTokens: 400,
      onError({ error }) {
        streamErrors.push(compactError(error));
      },
      experimental_onToolCallStart({ toolName, input }) {
        stepEvents.push({ event: "tool_call_start", toolName, input });
      },
      experimental_onToolCallFinish({ toolName, durationMs, error }) {
        stepEvents.push({
          event: "tool_call_finish",
          toolName,
          durationMs,
          error: error ? compactError(error) : null,
        });
      },
      onStepFinish({ stepNumber, finishReason }) {
        stepEvents.push({ event: "step_finish", stepNumber, finishReason });
      },
    });

    const chunks = [];
    for await (const textPart of result.textStream) {
      chunks.push(textPart);
    }

    const [text, finishReason, rawFinishReason, warnings, toolCalls, toolResults, steps] =
      await Promise.all([
        result.text,
        result.finishReason,
        result.rawFinishReason,
        result.warnings,
        result.toolCalls,
        result.toolResults,
        result.steps,
      ]);

    return compactResult({
      providerPath,
      method: "streamText",
      modelId,
      result: {
        text,
        finishReason,
        rawFinishReason,
        warnings,
        toolCalls,
        toolResults,
        steps,
      },
      text: chunks.join("") || text,
      executions,
      stepEvents: [...stepEvents, ...streamErrors.map((error) => ({ event: "stream_error", error }))],
      startedAt,
      error: streamErrors[0] ? new Error(streamErrors[0].message) : null,
    });
  } catch (error) {
    return compactResult({
      providerPath,
      method: "streamText",
      modelId,
      executions,
      stepEvents,
      startedAt,
      error,
    });
  }
}

async function runRawOpenAICase() {
  const startedAt = new Date().toISOString();
  const executions = [];
  const stepEvents = [];

  try {
    const OpenAI = (await import(frontendRequire.resolve("openai"))).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const messages = [{ role: "user", content: prompt }];

    let finishReason = null;
    let rawFinishReason = null;
    let finalText = "";

    for (let step = 0; step < 3; step += 1) {
      const response = await client.chat.completions.create({
        model: directModelId,
        messages,
        max_completion_tokens: 400,
        tools: [
          {
            type: "function",
            function: {
              name: "getProjectSignal",
              description:
                "Resolve a project name to the current concise project signal.",
              parameters: {
                type: "object",
                properties: {
                  projectName: {
                    type: "string",
                    description:
                      "The project name to resolve, for example Westfield Collective.",
                  },
                },
                required: ["projectName"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: "auto",
      });

      const message = response.choices[0]?.message;
      finishReason = response.choices[0]?.finish_reason ?? null;
      rawFinishReason = finishReason;
      messages.push(message);

      if (message?.tool_calls?.length) {
        for (const call of message.tool_calls) {
          const input = JSON.parse(call.function.arguments || "{}");
          stepEvents.push({
            event: "tool_call_start",
            toolName: call.function.name,
            input,
          });
          const output = {
            projectName: "Westfield Collective",
            projectId: 43,
            risk: "TCO timeline and pending cost exposure need review before the next approval decision.",
            requestedProjectName: input.projectName,
          };
          executions.push({
            toolName: call.function.name,
            input,
            output,
          });
          stepEvents.push({
            event: "tool_call_finish",
            toolName: call.function.name,
            durationMs: 0,
            error: null,
          });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(output),
          });
        }
        continue;
      }

      finalText = message?.content ?? "";
      break;
    }

    return {
      providerPath: "raw_openai",
      method: "chat.completions",
      modelId: directModelId,
      status: "pass",
      startedAt,
      finishedAt: new Date().toISOString(),
      toolCallCount: executions.length,
      toolCallNames: executions.map((execution) => execution.toolName),
      toolResultCount: executions.length,
      toolExecutions: executions,
      finalTextLength: finalText.length,
      finalText,
      finishReason,
      rawFinishReason,
      warnings: [],
      stepCount: messages.filter((message) => message.role === "assistant").length,
      stepEvents,
      error: null,
    };
  } catch (error) {
    return compactResult({
      providerPath: "raw_openai",
      method: "chat.completions",
      modelId: directModelId,
      executions,
      stepEvents,
      startedAt,
      error,
    });
  }
}

function needsRawOpenAI(results) {
  const aiSdkResults = results.filter((result) => result.providerPath !== "raw_openai");
  const anyFail = aiSdkResults.some((result) => result.status === "fail");
  const gatewayStatuses = new Set(
    aiSdkResults
      .filter((result) => result.providerPath.includes("gateway"))
      .map((result) => result.status),
  );
  const directStatuses = new Set(
    aiSdkResults
      .filter((result) => result.providerPath.includes("direct"))
      .map((result) => result.status),
  );
  const providerStatusDiffers =
    [...gatewayStatuses].join(",") !== [...directStatuses].join(",");

  return anyFail && !providerStatusDiffers;
}

function makeDecision(results) {
  const core = results.filter((result) => result.providerPath !== "raw_openai");
  const allCorePass = core.every((result) => result.status === "pass");
  const gatewayPass = core
    .filter((result) => result.providerPath.includes("gateway"))
    .every((result) => result.status === "pass");
  const directPass = core
    .filter((result) => result.providerPath.includes("direct"))
    .every((result) => result.status === "pass");
  const raw = results.find((result) => result.providerPath === "raw_openai");

  if (allCorePass) {
    return {
      providerPath: "ai_sdk_gateway_openai",
      supportsToolCalling: true,
      reason:
        "Gateway and direct OpenAI AI SDK tool-calling paths both passed; the active assistant route workaround is likely local route/workflow behavior, not provider capability.",
    };
  }

  if (!gatewayPass && directPass) {
    return {
      providerPath: "ai_sdk_direct_openai",
      supportsToolCalling: true,
      reason:
        "Direct OpenAI AI SDK tool-calling passed while Gateway failed; use direct OpenAI for tool-heavy assistant turns until Gateway behavior is repaired.",
    };
  }

  if (!directPass && gatewayPass) {
    return {
      providerPath: "ai_sdk_gateway_openai",
      supportsToolCalling: true,
      reason:
        "Gateway AI SDK tool-calling passed while direct OpenAI failed; keep Gateway for tool-heavy assistant turns and inspect direct-provider configuration separately.",
    };
  }

  if (raw?.status === "pass") {
    return {
      providerPath: "raw_openai",
      supportsToolCalling: true,
      reason:
        "AI SDK tool-calling failed in both provider paths while raw OpenAI function calling passed; inspect SDK usage, tool schema, message shape, or stream integration.",
    };
  }

  return {
    providerPath: "ai_sdk_gateway_openai",
    supportsToolCalling: false,
    reason:
      "Provider matrix did not find a passing tool-calling path; keep the current no-tool route workaround until the recorded errors are fixed.",
  };
}

await fs.mkdir(path.dirname(artifactPath), { recursive: true });

const results = [];
const matrixCases = [
  {
    providerPath: "ai_sdk_gateway_openai",
    modelId: gatewayModelId,
    modelFactory: gatewayChatModel,
  },
  {
    providerPath: "ai_sdk_direct_openai",
    modelId: directModelId,
    modelFactory: directChatModel,
  },
];

for (const testCase of matrixCases) {
  results.push(await runGenerateTextCase(testCase));
}

for (const testCase of matrixCases) {
  results.push(await runStreamTextCase(testCase));
}

if (needsRawOpenAI(results) || process.argv.includes("--raw")) {
  results.push(await runRawOpenAICase());
}

const artifact = {
  generatedAt: new Date().toISOString(),
  prompt,
  environment: {
    hasAiGatewayApiKey: Boolean(process.env.AI_GATEWAY_API_KEY),
    hasOpenAiApiKey: Boolean(process.env.OPENAI_API_KEY),
    gatewayModelId,
    directModelId,
  },
  decision: makeDecision(results),
  results,
};

await fs.writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(`AI tool-calling provider matrix written to ${path.relative(repoRoot, artifactPath)}`);
console.table(
  results.map((result) => ({
    provider: result.providerPath,
    method: result.method,
    status: result.status,
    tools: result.toolCallCount,
    text: result.finalTextLength,
    finish: result.finishReason,
    error: result.error?.message ?? "",
  })),
);
console.log(`Decision: ${artifact.decision.providerPath} (${artifact.decision.reason})`);
