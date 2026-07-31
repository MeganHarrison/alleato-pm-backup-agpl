/**
 * Council Mode Data Coverage Audit
 *
 * Run this before enabling sequential party mode to understand
 * which projects have enough data for agents to form strong opinions.
 *
 * Usage:
 *   npx tsx scripts/audit-council-data-coverage.ts
 *
 * Outputs:
 *   - Per-project coverage table
 *   - Per-agent readiness score
 *   - Recommended actions before shipping Council Mode
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../frontend/.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const FOURTEEN_DAYS_AGO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

interface ProjectCoverage {
  id: number;
  name: string;
  // Meeting data
  meetingCount30d: number;
  segmentCount: number;
  enrichedSegments: number;
  // Risk data
  openRisks: number;
  criticalRisks: number;
  hasRiskSnapshot: boolean;
  // Operational
  openRFIs: number;
  agingRFIs: number;
  openTasks: number;
  overdueTasks: number;
  // Financial
  hasBudget: boolean;
  hasContracts: boolean;
  // Agent readiness (0–100)
  cfoScore: number;
  cooScore: number;
  croScore: number;
  chroScore: number;
  vpbdScore: number;
  overallScore: number;
}

async function auditProject(projectId: number, projectName: string): Promise<ProjectCoverage> {
  // Get metadata IDs for documents belonging to this project (for segment joins).
  // `document_metadata.id` replaced the legacy `documents.file_id`.
  const { data: projectDocs } = await supabase
    .from("document_metadata")
    .select("id")
    .eq("project_id", projectId);

  const fileIds = (projectDocs ?? []).map((d) => d.id).filter(Boolean);

  const [
    meetingsResult,
    segmentsResult,
    enrichedResult,
    risksResult,
    rfiResult,
    agingRfiResult,
    tasksResult,
    overdueResult,
    budgetResult,
    contractResult,
    snapshotResult,
  ] = await Promise.all([
    // Meetings in last 30 days (stored in document_metadata with .date column)
    supabase
      .from("document_metadata")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("type", "meeting")
      .gte("date", THIRTY_DAYS_AGO),

    // Total meeting segments (via document file_ids)
    fileIds.length > 0
      ? supabase
          .from("meeting_segments")
          .select("id", { count: "exact", head: true })
          .in("metadata_id", fileIds)
      : Promise.resolve({ count: 0, data: null, error: null }),

    // Enriched segments
    fileIds.length > 0
      ? supabase
          .from("meeting_segments")
          .select("id", { count: "exact", head: true })
          .in("metadata_id", fileIds)
          .not("enriched_at", "is", null)
      : Promise.resolve({ count: 0, data: null, error: null }),

    // Risks
    supabase
      .from("project_insights")
      .select("severity", { count: "exact" })
      .eq("project_id", projectId),

    // Open RFIs
    supabase
      .from("rfis")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "open"),

    // Aging RFIs
    supabase
      .from("rfis")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "open")
      .lt("created_at", FOURTEEN_DAYS_AGO),

    // Open tasks
    supabase
      .from("schedule_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "in_progress"),

    // Overdue tasks
    supabase
      .from("schedule_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "in_progress")
      .lt("end_date", new Date().toISOString()),

    // Budget existence
    supabase
      .from("budget_lines")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),

    // Contract existence
    supabase
      .from("prime_contracts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),

  ]);

  const meetingCount30d = meetingsResult.count ?? 0;
  const segmentCount = segmentsResult.count ?? 0;
  const enrichedSegments = enrichedResult.count ?? 0;
  const risks = risksResult.data ?? [];
  const openRisks = risks.length;
  const criticalRisks = risks.filter((r) => r.severity === "critical" || r.severity === "high").length;
  const openRFIs = rfiResult.count ?? 0;
  const agingRFIs = agingRfiResult.count ?? 0;
  const openTasks = tasksResult.count ?? 0;
  const overdueTasks = overdueResult.count ?? 0;
  const hasBudget = (budgetResult.count ?? 0) > 0;
  const hasContracts = (contractResult.count ?? 0) > 0;

  // ── Agent readiness scores (0–100) ──────────────────────────
  // CFO: needs budget + contracts
  const cfoScore = Math.min(100,
    (hasBudget ? 50 : 0) +
    (hasContracts ? 30 : 0) +
    (meetingCount30d > 0 ? 20 : 0),
  );

  // COO: needs tasks + RFIs + recent meetings
  const cooScore = Math.min(100,
    (openTasks > 0 ? 30 : 0) +
    (meetingCount30d >= 2 ? 30 : meetingCount30d === 1 ? 15 : 0) +
    (segmentCount > 5 ? 20 : segmentCount > 0 ? 10 : 0) +
    (openRFIs > 0 ? 20 : 0),
  );

  // CRO: needs live risks and operational drag signals
  const croScore = Math.min(100,
    (openRisks > 0 ? 40 : 0) +
    (criticalRisks > 0 ? 20 : 0) +
    (agingRFIs > 0 ? 20 : 0) +
    (overdueTasks > 0 ? 20 : 0),
  );

  // CHRO: needs enriched segments (for people extraction) + tasks
  const chroScore = Math.min(100,
    (enrichedSegments > 3 ? 40 : enrichedSegments > 0 ? 20 : 0) +
    (openTasks > 0 ? 30 : 0) +
    (meetingCount30d > 0 ? 30 : 0),
  );

  // VP BD: needs recent meetings + project phase data
  const vpbdScore = Math.min(100,
    (meetingCount30d >= 2 ? 40 : meetingCount30d === 1 ? 20 : 0) +
    (enrichedSegments > 0 ? 30 : 0) +
    (hasContracts ? 30 : 0),
  );

  const overallScore = Math.round(
    (cfoScore + cooScore + croScore + chroScore + vpbdScore) / 5,
  );

  return {
    id: projectId,
    name: projectName,
    meetingCount30d,
    segmentCount,
    enrichedSegments,
    openRisks,
    criticalRisks,
    openRFIs,
    agingRFIs,
    openTasks,
    overdueTasks,
    hasBudget,
    hasContracts,
    cfoScore,
    cooScore,
    croScore,
    chroScore,
    vpbdScore,
    overallScore,
  };
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${score}%`;
}

function coverageLabel(score: number): string {
  if (score >= 70) return "✅ Ready";
  if (score >= 40) return "⚠️  Partial";
  return "❌ Sparse";
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║       Council Mode — Data Coverage Audit             ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name")
    .not("phase", "eq", "closed")
    .order("name");

  if (error || !projects?.length) {
    console.error("Failed to load projects:", error?.message);
    process.exit(1);
  }

  console.log(`Auditing ${projects.length} active projects...\n`);

  const results: ProjectCoverage[] = [];
  for (const project of projects) {
    process.stdout.write(`  ${project.name}...`);
    const coverage = await auditProject(project.id, project.name);
    results.push(coverage);
    console.log(` ${coverageLabel(coverage.overallScore)}`);
  }

  console.log("\n\n══════════════════════════════════════════════════════");
  console.log("  PER-PROJECT AGENT READINESS");
  console.log("══════════════════════════════════════════════════════\n");

  // Sort by overall score descending
  results.sort((a, b) => b.overallScore - a.overallScore);

  for (const r of results) {
    console.log(`📁 ${r.name} ${coverageLabel(r.overallScore)}`);
    console.log(`   💰 CFO   ${scoreBar(r.cfoScore)}`);
    console.log(`   🏗️  COO   ${scoreBar(r.cooScore)}`);
    console.log(`   🛡️  CRO   ${scoreBar(r.croScore)}`);
    console.log(`   👥 CHRO  ${scoreBar(r.chroScore)}`);
    console.log(`   🤝 VPBD  ${scoreBar(r.vpbdScore)}`);
    console.log(`   Meetings(30d): ${r.meetingCount30d} | Segments: ${r.segmentCount} (${r.enrichedSegments} enriched) | Tasks: ${r.openTasks} (${r.overdueTasks} overdue)`);
    console.log();
  }

  console.log("══════════════════════════════════════════════════════");
  console.log("  PORTFOLIO SUMMARY");
  console.log("══════════════════════════════════════════════════════\n");

  const ready = results.filter((r) => r.overallScore >= 70);
  const partial = results.filter((r) => r.overallScore >= 40 && r.overallScore < 70);
  const sparse = results.filter((r) => r.overallScore < 40);
  const enrichmentBacklog = results.reduce((sum, r) => sum + (r.segmentCount - r.enrichedSegments), 0);
  const noMeetings = results.filter((r) => r.meetingCount30d === 0);
  const noRiskSnapshot = results.filter((r) => !r.hasRiskSnapshot);

  console.log(`  ✅ Council-ready (≥70%):     ${ready.length}/${results.length} projects`);
  console.log(`  ⚠️  Partial coverage (40–69%): ${partial.length}/${results.length} projects`);
  console.log(`  ❌ Sparse (<40%):             ${sparse.length}/${results.length} projects`);
  console.log();
  console.log(`  📋 Segment enrichment backlog: ${enrichmentBacklog} segments`);
  console.log(`  🔇 No meetings in 30 days:     ${noMeetings.length} projects`);
  console.log(`  📸 Missing risk snapshots:     ${noRiskSnapshot.length} projects`);

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  RECOMMENDED ACTIONS");
  console.log("══════════════════════════════════════════════════════\n");

  if (enrichmentBacklog > 0) {
    console.log(`  1. Run enrichment worker: POST /enrich-segments`);
    console.log(`     → Will classify ${enrichmentBacklog} unenriched segments`);
  }
  if (noRiskSnapshot.length > 0) {
    console.log(`  2. Run risk snapshot job: POST /snapshot-risks`);
    console.log(`     → Will create initial snapshots for ${noRiskSnapshot.length} projects`);
  }
  if (noMeetings.length > 0) {
    console.log(`  3. Projects with no recent meetings (CRO/COO will hedge):`);
    noMeetings.forEach((p) => console.log(`     - ${p.name}`));
  }
  if (sparse.length > 0) {
    console.log(`  4. Low-coverage projects (consider excluding from Council Mode for now):`);
    sparse.forEach((p) => console.log(`     - ${p.name} (${p.overallScore}% overall)`));
  }

  console.log("\n  ℹ️  Re-run this audit after enrichment worker completes.\n");
}

main().catch(console.error);
