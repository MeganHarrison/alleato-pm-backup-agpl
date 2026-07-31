import { defineAgent } from "eve";
import { mockModel, type MockModelRequest, type MockModelResponse } from "eve/evals";

const useMockModel = process.env.EVE_PROJECT_INTELLIGENCE_MOCK_MODEL === "true";

export default defineAgent({
  model: useMockModel
    ? mockModel({
        modelId: "project-intelligence-maintainer-eval",
        respond: respondForEval,
      })
    : process.env.EVE_PROJECT_INTELLIGENCE_MODEL ?? "openai/gpt-5.4-mini",
  modelContextWindowTokens: useMockModel ? 128000 : undefined,
  reasoning: "low",
});

function respondForEval(request: MockModelRequest): MockModelResponse | string {
  if (request.toolResults.length > 0) {
    return summarizeToolResult(request);
  }

  const prompt = (request.lastUserMessage ?? "").toLowerCase();
  if (prompt.includes("refresh_stale_project_packets") || prompt.includes("refresh")) {
    return {
      toolCalls: [
        {
          name: "refresh_stale_project_packets",
          input: { maxPacketAgeHours: 36, limit: 3, dryRun: false },
        },
      ],
    };
  }
  if (prompt.includes("read proof") || prompt.includes("read-proof") || prompt.includes("prove")) {
    return { toolCalls: [{ name: "prove_packet_evidence", input: { days: 1, family: "fireflies" } }] };
  }
  if (prompt.includes("source coverage") || prompt.includes("healthy")) {
    return { toolCalls: [{ name: "check_source_coverage", input: { days: 2, maxPacketAgeHours: 36 } }] };
  }
  if (prompt.includes("summarize_maintainer_findings") || prompt.includes("compact")) {
    return { toolCalls: [{ name: "summarize_maintainer_findings", input: { projectId: 67 } }] };
  }
  return { toolCalls: [{ name: "check_stale_project_data", input: { maxPacketAgeHours: 36, limit: 5 } }] };
}

function summarizeToolResult(request: MockModelRequest): string {
  const latest = request.toolResults.at(-1);
  switch (latest?.name) {
    case "check_stale_project_data":
      return "Maintainer warning: generated_at is older than the 36h threshold while last_signal_at is newer, so packet data is stale relative to source signal time.";
    case "check_source_coverage":
      return "Source lifecycle coverage is not fully healthy; rerun the source lifecycle verifier and keep packet refresh blocked until coverage is proved.";
    case "prove_packet_evidence":
      return "Packet evidence read-proof is present for recent Fireflies-backed Project Intelligence cards.";
    case "summarize_maintainer_findings":
      return "Compact maintainer report: stale packet warning, source lifecycle check, and read-proof evidence were reviewed. No secrets printed.";
    default:
      return "Project Intelligence maintainer check completed.";
  }
}
