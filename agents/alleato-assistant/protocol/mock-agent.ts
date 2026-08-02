import { defineAgent } from "eve";
import {
  mockModel,
  type MockModelRequest,
  type MockModelResponse,
} from "eve/evals";
import {
  EXECUTIVE_SKILL_CASES,
  toExecutiveSkillEvalPrompt,
} from "../evals/executive-skill-cases.js";

const expectedByPrompt = new Map(
  EXECUTIVE_SKILL_CASES.map((testCase) => [
    toExecutiveSkillEvalPrompt(testCase.prompt),
    testCase.expectedSkills,
  ]),
);

function respond(request: MockModelRequest): MockModelResponse | string {
  const forbiddenTools = new Set([
    "bash",
    "glob",
    "grep",
    "read_file",
    "todo",
    "web_fetch",
    "web_search",
    "write_file",
  ]);
  const exposedForbiddenTool = request.tools.find((tool) =>
    forbiddenTools.has(tool.name),
  );
  if (exposedForbiddenTool) {
    throw new Error(
      `Protocol exposed forbidden tool ${exposedForbiddenTool.name}.`,
    );
  }
  const agentTool = request.tools.find((tool) => tool.name === "agent");
  if (
    !agentTool?.description?.includes("delegation is disabled")
  ) {
    throw new Error(
      "Protocol did not replace Eve's built-in agent tool with the fail-closed override.",
    );
  }

  if (request.toolResults.length > 0) {
    return "Protocol fixture completed the requested skill loads.";
  }

  const expected = expectedByPrompt.get(request.lastUserMessage ?? "");
  if (expected === undefined) {
    throw new Error("Protocol fixture received an unknown eval prompt.");
  }
  if (expected.length === 0) {
    return "This definition does not require an executive analysis skill.";
  }
  return {
    toolCalls: expected.map((skill) => ({
      input: { skill },
      name: "load_skill",
    })),
  };
}

export default defineAgent({
  model: mockModel({
    modelId: "alleato-assistant-protocol",
    respond,
  }),
  modelContextWindowTokens: 128000,
  reasoning: "low",
});
