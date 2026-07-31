#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const requireFromFrontend = createRequire(resolve(repoRoot, "frontend/package.json"));
const { createClient } = requireFromFrontend("@supabase/supabase-js");

function loadEnv(relativePath) {
  const file = resolve(repoRoot, relativePath);
  if (!existsSync(file)) return;

  for (const line of readFileSync(file, "utf8").split(/\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] ||= value;
  }
}

loadEnv(".env");
loadEnv("frontend/.env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase env for latest briefing verification.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const { data, error } = await supabase
  .from("chat_history")
  .select("id, created_at, content, metadata")
  .eq("role", "assistant")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

if (error) {
  console.error(`Failed to load latest assistant message: ${error.message}`);
  process.exit(1);
}

const content = String(data.content ?? "");
const trace = Array.isArray(data.metadata?.tool_trace)
  ? data.metadata.tool_trace
  : [];
const toolNames = trace.map((entry) => String(entry.tool ?? ""));
const isPacketBriefing = toolNames.includes("clientProjectIntelligencePacket");
const requiredSections = isPacketBriefing
  ? [
      "Current read",
      "What changed recently",
      "Financial/change-management exposure",
      "Schedule/operational risk",
      "Recommended next action",
      "Evidence basis and confidence",
      "Packet status",
      "Resolved target",
    ]
  : [
      "Hard Facts",
      "Sources Checked",
      "Recent Communication Signals",
      "What Changed",
      "Insider Analysis",
      "Recommended Actions",
      "Next Step",
    ];
const requiredTools = isPacketBriefing
  ? ["clientProjectIntelligencePacket"]
  : [
      "serverBusinessContextPreflight",
      "sourceHealthPreflight",
      "getProjectBriefingSnapshot",
      "semanticSearch",
      "searchMeetingsByTopic",
      "searchTeamsMessages",
      "searchEmails",
      "searchExternalDocuments",
    ];
const forbiddenToolErrors = trace
  .filter((entry) => entry.error)
  .map((entry) => `${entry.tool ?? "unknown"}: ${entry.error}`);

const failures = [
  ...requiredSections
    .filter((section) => !content.includes(section))
    .map((section) => `missing section: ${section}`),
  ...requiredTools
    .filter((tool) => !toolNames.includes(tool))
    .map((tool) => `missing tool trace: ${tool}`),
  ...forbiddenToolErrors.map((error) => `tool error present: ${error}`),
];

if (content.length < 800) {
  failures.push(`briefing too short: ${content.length} characters`);
}

if (isPacketBriefing && !content.includes("[Source:")) {
  failures.push("packet briefing missing source citations");
}

const responseQualityScore = Number(data.metadata?.response_quality?.score ?? 0);
if (!Number.isFinite(responseQualityScore) || responseQualityScore < 80) {
  failures.push(`response quality score below 80: ${responseQualityScore || "missing"}`);
}

if (failures.length > 0) {
  console.error(`Latest briefing ${data.id} (${data.created_at}) failed shape verification:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Latest briefing shape verification passed for ${data.id}.`);
