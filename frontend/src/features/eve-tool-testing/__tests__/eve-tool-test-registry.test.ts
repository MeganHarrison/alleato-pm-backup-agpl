jest.mock("@/lib/ai/tools/action-tools", () => ({
  createActionTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/document-intelligence", () => ({
  createDocumentIntelligenceTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/executive-brief-tools", () => ({
  createExecutiveBriefTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/feature-request-tools", () => ({
  createFeatureRequestTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/intelligence-tools", () => ({
  createIntelligenceTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/marketing", () => ({
  createMarketingTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/progress-report-tools", () => ({
  createProgressReportTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/project-tools", () => ({
  createProjectTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/structured-output", () => ({
  createStructuredOutputTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/tool-context", () => ({
  createToolContext: jest.fn(),
}));
jest.mock("@/lib/ai/tools/web-search", () => ({
  createWebSearchTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/workspace-tools", () => ({
  createWorkspaceTools: jest.fn(),
}));

import { EVE_TOOL_MANIFEST } from "@/lib/ai/eve-runtime/production-tool-registry";

import {
  buildEveToolTestRows,
  KNOWN_EVE_TOOL_SCREENSHOTS,
  KNOWN_EVE_TOOL_TEST_RESULTS,
} from "../eve-tool-test-registry";

describe("Eve tool test registry", () => {
  it("creates exactly one row for every canonical Eve tool", () => {
    const rows = buildEveToolTestRows();

    expect(rows).toHaveLength(EVE_TOOL_MANIFEST.length);
    expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length);
    expect(rows.map((row) => row.name).sort()).toEqual(
      EVE_TOOL_MANIFEST.map((entry) => entry.name).sort(),
    );
  });

  it("keeps all recorded live-test results attached to real Eve tools", () => {
    const manifestNames = new Set(EVE_TOOL_MANIFEST.map((entry) => entry.name));

    expect(
      Object.keys(KNOWN_EVE_TOOL_TEST_RESULTS).filter(
        (name) => !manifestNames.has(name),
      ),
    ).toEqual([]);
  });

  it("provides an actionable prompt and explicit status for every row", () => {
    for (const row of buildEveToolTestRows()) {
      expect(row.testPrompt).not.toHaveLength(0);
      expect([
        "passed",
        "needs_retest",
        "blocked",
        "not_tested",
      ]).toContain(row.status);
      expect(["verified", "not_verified"]).toContain(row.screenshotStatus);
      expect(row.screenshotStatus === "verified").toBe(
        Boolean(row.screenshotPath),
      );
    }
  });

  it("keeps screenshot evidence attached to real Eve tools", () => {
    const manifestNames = new Set(EVE_TOOL_MANIFEST.map((entry) => entry.name));

    expect(
      Object.keys(KNOWN_EVE_TOOL_SCREENSHOTS).filter(
        (name) => !manifestNames.has(name),
      ),
    ).toEqual([]);
  });
});
