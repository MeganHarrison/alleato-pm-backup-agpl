import fs from "node:fs";
import path from "node:path";

function readSource(file: string) {
  return fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
}

describe("findProject communication search scope", () => {
  it("passes the resolved project ID to every RAG category search", () => {
    const source = readSource(
      "src/lib/ai/tools/read/project-data-tools.ts",
    );
    const findProjectBlock = source.slice(
      source.indexOf("findProject: tool("),
      source.indexOf("getPortfolioOverview: tool("),
    );

    expect(findProjectBlock).toContain(
      "const resolvedProjectId =",
    );
    expect(
      findProjectBlock.match(/filterProjectId: resolvedProjectId/g),
    ).toHaveLength(3);
  });

  it("does not label generic Microsoft Graph documents as Teams messages", () => {
    const source = readSource(
      "src/lib/ai/tools/read/shared-search-helpers.ts",
    );
    const teamsCase = source.slice(
      source.indexOf('case "teams_message":'),
      source.indexOf('case "document":'),
    );

    expect(teamsCase).toContain('["teams_channel", "teams_dm"]');
    expect(teamsCase).not.toContain("microsoft_graph");
  });
});
