import fs from "node:fs";
import path from "node:path";

describe("mixed-source research seam", () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

  it("keeps source recognition and tool mapping in one module", () => {
    const planner = read("src/lib/ai/retrieval/planner.ts");
    const orchestrator = read("src/lib/ai/orchestrator.ts");
    const handler = read("src/app/api/ai-assistant/chat/handler-v2.ts");
    const prompt = read("src/lib/ai/retrieval/system-prompt.ts");
    const contract = read("src/lib/ai/retrieval/research-contract.ts");

    const retiredNames = [
      ["FMDS", "COMMUNICATION", "TOOL", "NAMES"].join("_"),
      ["includeMicrosoft", "SourceReadTools"].join(""),
      ["detectCommunication", "ResearchSources"].join(""),
    ];
    for (const source of [planner, orchestrator, handler, prompt]) {
      for (const retiredName of retiredNames) {
        expect(source).not.toContain(retiredName);
      }
    }
    expect(contract).toContain("RESEARCH_SOURCE_DEFINITIONS");
    expect(contract).toContain("selectToolsForResearchContract");
    expect(contract).toContain("researchReceiptCitations");
  });
});
