import { Output, generateText, tool } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";

type ToolTracePayload = {
  tool: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  timestamp: string;
};

export type CreateStructuredOutputToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
};

const STRUCTURED_OUTPUT_MODEL = "openai/gpt-5.4-mini";

const actionBriefSchema = z.object({
  summary: z.string().describe("Concise synthesis of the source text."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence based on source completeness and specificity."),
  actionItems: z.array(
    z.object({
      title: z.string(),
      owner: z.string().nullable(),
      dueDate: z.string().nullable().describe("ISO date when present, otherwise null."),
      priority: z.enum(["low", "medium", "high", "critical"]),
      projectName: z.string().nullable(),
      sourceEvidence: z.string().nullable(),
    }),
  ),
  risks: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(["low", "medium", "high", "critical"]),
      mitigation: z.string(),
      projectName: z.string().nullable(),
    }),
  ),
  decisions: z.array(
    z.object({
      decision: z.string(),
      owner: z.string().nullable(),
      followUp: z.string().nullable(),
    }),
  ),
  dataGaps: z.array(z.string()),
});

function withTrace<TInput extends Record<string, unknown>, TResult>(
  toolName: string,
  options: CreateStructuredOutputToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return async (input: TInput): Promise<TResult> => {
    const timestamp = new Date().toISOString();
    try {
      const output = await execute(input);
      options.onTrace?.({ tool: toolName, input, output, timestamp });
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.onTrace?.({ tool: toolName, input, error: message, timestamp });
      throw error;
    }
  };
}

export function createStructuredOutputTools(
  options: CreateStructuredOutputToolsOptions = {},
) {
  return {
    extractStructuredActionBrief: tool({
      description:
        "Convert conversation text, meeting notes, emails, or project context into typed " +
        "action items, risks, decisions, and data gaps. Use when the user asks for " +
        "action items, decisions, a checklist, a structured summary, or a handoff-ready output.",
      inputSchema: z.object({
        sourceText: z.string().describe("The source text to structure."),
        projectName: z
          .string()
          .optional()
          .describe("Optional project name to use when the text implies a shared project context."),
        includeRisks: z
          .boolean()
          .default(true)
          .describe("Whether to extract risks and mitigations."),
      }),
      execute: withTrace(
        "extractStructuredActionBrief",
        options,
        async ({ sourceText, projectName, includeRisks }) => {
          const result = await generateText({
            model: getLanguageModel(STRUCTURED_OUTPUT_MODEL),
            output: Output.object({ schema: actionBriefSchema }),
            prompt: [
              "Extract a structured project-management brief from the source text.",
              "Return only validated structured data matching the schema.",
              "Use null when an owner, due date, or project name is not explicit.",
              includeRisks
                ? "Include concrete risks with mitigations."
                : "Leave risks empty unless the source text makes them unavoidable.",
              projectName ? `Shared project context: ${projectName}` : "",
              "",
              "Source text:",
              sourceText,
            ]
              .filter(Boolean)
              .join("\n"),
          });

          return {
            schema: "action_brief_v1",
            model: STRUCTURED_OUTPUT_MODEL,
            ...result.output,
          };
        },
      ),
    }),
  };
}
