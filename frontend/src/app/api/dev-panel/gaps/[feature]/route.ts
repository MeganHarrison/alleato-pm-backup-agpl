import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";

interface Finding {
  gap_id: string;
  layer: string;
  severity: string;
  status: string;
  title?: string;
  description?: string;
  spec_ref?: string;
  code_ref?: string;
  evidence?: string;
  acceptance_criteria?: string;
}

interface VerificationReport {
  findings?: Finding[];
  summary?: { total: number; open: number; resolved: number };
  feature?: string;
  run_id?: string;
  generated_at?: string;
}

interface TaskItem {
  task_id?: string;
  gap_id: string;
  layer?: string;
  severity?: string;
  status?: string;
  title?: string;
  description?: string;
  acceptance_criteria?: string;
  file?: string;
  effort?: string;
}

interface TaskList {
  tasks?: TaskItem[];
}

/** Parse "- GAP-001 (high, ui): Some description text" lines from the markdown report. */
function parseMarkdownDescriptions(markdown: string): Record<string, string> {
  const map: Record<string, string> = {};
  // Matches: "- GAPID (severity, layer): description"
  const re = /^[-*]\s+([\w-]+)\s+\([^)]+\):\s+(.+)$/gm;
  for (;;) {
    const m = re.exec(markdown);
    if (!m) break;
    map[m[1]] = m[2].trim();
  }
  return map;
}

/** Build the base dir for a feature's verification artifacts. */
function verificationBase(feature: string) {
  return path.join(
    process.cwd(),
    "..",
    "_bmad-output",
    "planning-artifacts",
    feature,
    "verification",
  );
}

/** Try a path at root level, then under each runs/ subdir (most recent first). */
async function readArtifact(feature: string, filename: string): Promise<string | null> {
  const base = verificationBase(feature);

  // Direct
  try {
    return await readFile(path.join(base, filename), "utf-8");
	  } catch (error) {
	    console.debug("[dev-panel/gaps] Artifact not found at feature root.", { feature, filename, error });
	  }

  // Runs — most recent first
  try {
    const runsDir = path.join(base, "runs");
    const entries = (await readdir(runsDir)).sort().reverse();
    for (const entry of entries) {
      try {
        return await readFile(path.join(runsDir, entry, filename), "utf-8");
	      } catch (error) {
	        console.debug("[dev-panel/gaps] Artifact not found in verification run.", { feature, filename, entry, error });
	        continue;
	      }
	    }
	  } catch (error) {
	    console.debug("[dev-panel/gaps] Verification runs directory not available.", { feature, error });
	  }

  return null;
}

export const GET = withApiGuardrails<{ feature: string }>(
  "dev-panel/gaps/[feature]#GET",
  async ({ request, params }) => {
  const { feature } = await params;

  if (!/^[\w-]+$/.test(feature)) {
    return NextResponse.json({ error: "Invalid feature" }, { status: 400 });
  }

  // Read all three artifacts in parallel
  const [verificationRaw, markdownRaw, taskListRaw] = await Promise.all([
    readArtifact(feature, "05-verification-report.json"),
    readArtifact(feature, "04-gap-analysis-report.md"),
    readArtifact(feature, "06-task-list.json"),
  ]);

  if (!verificationRaw && !markdownRaw && !taskListRaw) {
    return NextResponse.json({ feature, findings: [], summary: null });
  }

  // Parse each source
  let report: VerificationReport = {};
  try {
    if (verificationRaw) report = JSON.parse(verificationRaw) as VerificationReport;
	  } catch (error) {
	    console.warn("[dev-panel/gaps] Failed to parse verification report.", { feature, error });
	  }

  const mdDescriptions = markdownRaw ? parseMarkdownDescriptions(markdownRaw) : {};

  const tasksByGapId: Record<string, TaskItem> = {};
  try {
    if (taskListRaw) {
      const tl = JSON.parse(taskListRaw) as TaskList;
      for (const t of tl.tasks ?? []) {
        tasksByGapId[t.gap_id] = t;
      }
    }
	  } catch (error) {
	    console.warn("[dev-panel/gaps] Failed to parse verification task list.", { feature, error });
	  }

  // If we have no findings from the JSON report but we have markdown descriptions,
  // synthesize minimal findings from the markdown so something always shows.
  let findings: Finding[] = report.findings ?? [];

  if (findings.length === 0 && Object.keys(mdDescriptions).length > 0) {
    // Parse fuller detail from task list or markdown header lines
    findings = Object.entries(mdDescriptions).map(([gap_id, description]) => {
      const task = tasksByGapId[gap_id];
      return {
        gap_id,
        layer: task?.layer ?? "ui",
        severity: task?.severity ?? "medium",
        status: task?.status ?? "open",
        description,
        title: task?.title,
        acceptance_criteria: task?.acceptance_criteria,
      };
    });
  } else {
    // Enrich existing findings with markdown descriptions + task list data
    findings = findings.map((f) => {
      const task = tasksByGapId[f.gap_id];
      return {
        ...f,
        title: f.title ?? task?.title,
        description: f.description ?? mdDescriptions[f.gap_id] ?? task?.description,
        acceptance_criteria: task?.acceptance_criteria,
        // Task list status is more up-to-date if present
        status: task?.status ?? f.status,
      };
    });
  }

  // Compute summary if missing
  const summary = report.summary ?? {
    total: findings.length,
    open: findings.filter((f) => f.status === "open").length,
    resolved: findings.filter((f) => f.status === "resolved").length,
  };

  return NextResponse.json({
    feature,
    findings,
    summary,
    generated_at: report.generated_at ?? null,
  });
  },
);
