import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { serviceDb } from "@/lib/supabase/service-db";
import { withApiGuardrails } from "@/lib/guardrails/api";

export interface ToolPrpStatus {
  tool: string;
  label: string;
  apiRoutes: number;
  hasPrp: boolean;
  hasAudit: boolean;
  hasTasks: boolean;
  hasTestScenarios: boolean;
  hasValidationReport: boolean;
  validationPassed: boolean | null; // null = no report
  // Test scenario audit (`/test-scenario-audit <tool>`): smoke + feature suites seeded in Supabase.
  smokeCases: number;     // 0 if no smoke suite seeded
  featureCases: number;   // 0 if no feature suite seeded
  hasTestAudit: boolean;  // true only when BOTH smoke and feature suites exist with >0 cases
  prpDir: string | null;
}

// All known tools in the app
const TOOLS: { slug: string; label: string; apiPath?: string }[] = [
  { slug: "budget", label: "Budget", apiPath: "budget" },
  { slug: "change-events", label: "Change Events", apiPath: "change-events" },
  { slug: "change-management", label: "Change Management", apiPath: "change-management" },
  { slug: "commitments", label: "Commitments", apiPath: "commitments" },
  { slug: "direct-costs", label: "Direct Costs", apiPath: "direct-costs" },
  { slug: "drawings", label: "Drawings", apiPath: "drawings" },
  { slug: "estimates", label: "Estimates", apiPath: "estimates" },
  { slug: "invoicing", label: "Invoicing", apiPath: "invoicing" },
  { slug: "prime-contracts", label: "Prime Contracts", apiPath: "contracts" },
  { slug: "rfis", label: "RFIs", apiPath: "rfis" },
  { slug: "submittals", label: "Submittals", apiPath: "submittals" },
  { slug: "rag", label: "RAG / AI" },
  { slug: "integrations", label: "Integrations" },
];

function countRoutes(apiPath: string): number {
  const base = path.join(
    process.cwd(),
    "..",
    "frontend",
    "src",
    "app",
    "api",
    "projects",
    "[projectId]",
    apiPath
  );

  function countInDir(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name === "route.ts") count++;
      if (e.isDirectory()) count += countInDir(path.join(dir, e.name));
    }
    return count;
  }

  return countInDir(base);
}

function checkValidationPassed(reportPath: string): boolean | null {
  if (!fs.existsSync(reportPath)) return null;
  const content = fs.readFileSync(reportPath, "utf-8");
  return content.includes("PASS");
}

async function loadTestSuiteCounts(): Promise<Map<string, { smoke: number; feature: number }>> {
  const counts = new Map<string, { smoke: number; feature: number }>();
  try {
        const { data, error } = await serviceDb.from("test_suites")
      .select("tool_name, suite_type, total_cases");
    if (error || !data) return counts;
    for (const row of data as Array<{ tool_name: string; suite_type: string; total_cases: number | null }>) {
      const current = counts.get(row.tool_name) ?? { smoke: 0, feature: 0 };
      if (row.suite_type === "smoke") current.smoke = row.total_cases ?? 0;
      if (row.suite_type === "feature") current.feature = row.total_cases ?? 0;
      counts.set(row.tool_name, current);
    }
  } catch (error) {
    console.warn("[admin/prp-status] Unable to load test suite counts; reporting zero counts.", error);
  }
  return counts;
}

export const GET = withApiGuardrails(
  "admin/prp-status#GET",
  async () => {
    const prpBase = path.join(process.cwd(), "..", "docs", "PRPs");
    const testSuiteCounts = await loadTestSuiteCounts();

    const results: ToolPrpStatus[] = TOOLS.map(({ slug, label, apiPath }) => {
      const prpDir = path.join(prpBase, slug);
      const dirExists = fs.existsSync(prpDir);

      // Detect PRP doc (prp-*.md or any *-PRP.md or PRP-*.md)
      let hasPrp = false;
      if (dirExists) {
        const files = fs.readdirSync(prpDir);
        hasPrp = files.some(
          (f) =>
            (f.startsWith("prp-") || f.toLowerCase().includes("prp")) &&
            f.endsWith(".md") &&
            !f.includes("VALIDATION") &&
            !f.includes("TASKS") &&
            !f.includes("AUDIT") &&
            !f.includes("TEST-SCENARIOS")
        );
      }

      const auditPath = path.join(prpDir, "AUDIT.md");
      const tasksPath = path.join(prpDir, "TASKS.md");
      const scenariosPath = path.join(prpDir, "TEST-SCENARIOS.md");
      const reportPath = path.join(prpDir, "VALIDATION-REPORT.md");

      const apiRoutes = apiPath ? countRoutes(apiPath) : 0;
      const suiteCounts = testSuiteCounts.get(slug) ?? { smoke: 0, feature: 0 };
      const hasTestAudit = suiteCounts.smoke > 0 && suiteCounts.feature > 0;

      return {
        tool: slug,
        label,
        apiRoutes,
        hasPrp,
        hasAudit: dirExists && fs.existsSync(auditPath),
        hasTasks: dirExists && fs.existsSync(tasksPath),
        hasTestScenarios: dirExists && fs.existsSync(scenariosPath),
        hasValidationReport: dirExists && fs.existsSync(reportPath),
        validationPassed: dirExists ? checkValidationPassed(reportPath) : null,
        smokeCases: suiteCounts.smoke,
        featureCases: suiteCounts.feature,
        hasTestAudit,
        prpDir: dirExists ? slug : null,
      };
    });

    return NextResponse.json(results);
  },
);
