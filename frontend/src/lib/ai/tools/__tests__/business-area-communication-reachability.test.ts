import { readFileSync } from "node:fs";
import { join } from "node:path";

function readToolSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function namedToolBlock(source: string, start: string, end?: string): string {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : -1;
  return source.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

describe("Business Area communication search reachability", () => {
  it("keeps live recent email admin-only while routing indexed email through exact scope", () => {
    const source = readToolSource(
      "src/lib/ai/tools/read/email-search-tools.ts",
    );
    const recentEmailBlock = namedToolBlock(
      source,
      "getRecentEmails: tool(",
      "searchEmails: tool(",
    );
    const searchEmailBlock = namedToolBlock(source, "searchEmails: tool(");

    expect(recentEmailBlock).toContain(
      'requireAdminForCommunications("Email")',
    );
    expect(searchEmailBlock).not.toContain(
      'requireAdminForCommunications("Email")',
    );
    expect(searchEmailBlock).toContain("guardrails.getScope()");
    expect(searchEmailBlock).toContain("searchDocumentChunksByCategory({");
  });

  it("routes indexed Teams search through exact scope without a blanket admin gate", () => {
    const source = readToolSource(
      "src/lib/ai/tools/read/communication-search-tools.ts",
    );
    const teamsBlock = namedToolBlock(
      source,
      "searchTeamsMessages: tool(",
      "searchExternalDocuments: tool(",
    );

    expect(teamsBlock).not.toContain("requireAdminForCommunications");
    expect(teamsBlock).toContain("guardrails.getScope()");
    expect(teamsBlock).toContain("searchDocumentChunksByCategory({");
  });
});
