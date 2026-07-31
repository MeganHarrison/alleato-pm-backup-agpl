#!/usr/bin/env tsx
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "node:path";

import { createServiceClient } from "../src/lib/supabase/service";

const execFileAsync = promisify(execFile);

for (const envPath of [
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.local"),
]) {
  dotenv.config({ path: envPath, override: false });
}

type JsonRecord = Record<string, unknown>;

type RunReadback = {
  id: string;
  status: string | null;
  delivery_status: string | null;
  daily_recap_id: string | null;
  trigger_type: string | null;
  surface: string | null;
  failure_code: string | null;
  failure_message: string | null;
};

type ArtifactReadback = {
  id: string;
  kind: string | null;
  storage_table: string | null;
  storage_id: string | null;
};

type DeliveryAttemptReadback = {
  id: string;
  channel: string | null;
  status: string | null;
  failure_code: string | null;
  provider_message_id: string | null;
};

type PacketEvidenceSummary = {
  itemCount: number;
  sourceRefCount: number;
  familyCounts: Record<string, number>;
  excludedFamilies: string[];
};

const baseUrl = (
  process.env.EXECUTIVE_DAILY_BRIEF_INTEGRATION_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://localhost:3001"
).replace(/\/+$/, "");

const proofId = `codex_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function authCookieDomain() {
  return new URL(baseUrl).hostname;
}

function authCookieSecure() {
  return new URL(baseUrl).protocol === "https:";
}

async function authStorageState() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = process.env.TEST_USER_1 ?? process.env.APP_USERNAME;
  const password = process.env.TEST_PASSWORD_1 ?? process.env.APP_PASSWORD;
  assert(email, "TEST_USER_1 or APP_USERNAME is required.");
  assert(password, "TEST_PASSWORD_1 or APP_PASSWORD is required.");

  const client = createClient(supabaseUrl, anonKey);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    throw new Error(
      `Failed to create Daily Brief integration auth session: ${
        error?.message ?? "no session returned"
      }`,
    );
  }

  const projectRef =
    supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] ??
    "lgveqfnpkxvzbnnwuled";
  const session = data.session;
  const cookieValue = `base64-${Buffer.from(
    JSON.stringify({
      access_token: session.access_token,
      token_type: session.token_type,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      refresh_token: session.refresh_token,
      user: session.user,
      weak_password: null,
    }),
  ).toString("base64")}`;

  return {
    cookies: [
      {
        name: `sb-${projectRef}-auth-token`,
        value: cookieValue,
        domain: authCookieDomain(),
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        httpOnly: false,
        secure: authCookieSecure(),
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function parseLastJsonObject(output: string): JsonRecord {
  const trimmed = output.trim();
  const start = trimmed.lastIndexOf("\n{");
  const jsonText = start >= 0 ? trimmed.slice(start + 1) : trimmed;
  return asRecord(JSON.parse(jsonText));
}

async function loadRun(runId: string): Promise<RunReadback> {
  const { data, error } = await createServiceClient()
    .from("ai_work_runs")
    .select(
      "id,status,delivery_status,daily_recap_id,trigger_type,surface,failure_code,failure_message",
    )
    .eq("id", runId)
    .single();

  if (error) throw new Error(`Failed to load ai_work_runs ${runId}: ${error.message}`);
  return data;
}

async function loadArtifacts(runId: string): Promise<ArtifactReadback[]> {
  const { data, error } = await createServiceClient()
    .from("ai_work_run_artifacts")
    .select("id,kind,storage_table,storage_id")
    .eq("work_run_id", runId);

  if (error) {
    throw new Error(`Failed to load ai_work_run_artifacts ${runId}: ${error.message}`);
  }
  return data ?? [];
}

async function loadDeliveryAttempts(
  runId: string,
): Promise<DeliveryAttemptReadback[]> {
  const { data, error } = await createServiceClient()
    .from("ai_work_run_delivery_attempts")
    .select("id,channel,status,failure_code,provider_message_id")
    .eq("work_run_id", runId);

  if (error) {
    throw new Error(
      `Failed to load ai_work_run_delivery_attempts ${runId}: ${error.message}`,
    );
  }
  return data ?? [];
}

async function countSources(runId: string) {
  const { count, error } = await createServiceClient()
    .from("ai_work_run_sources")
    .select("id", { count: "exact", head: true })
    .eq("work_run_id", runId);

  if (error) {
    throw new Error(`Failed to count ai_work_run_sources ${runId}: ${error.message}`);
  }
  return count ?? 0;
}

async function countSteps(runId: string, stepType: string) {
  const { count, error } = await createServiceClient()
    .from("ai_work_run_steps")
    .select("id", { count: "exact", head: true })
    .eq("work_run_id", runId)
    .eq("step_type", stepType);

  if (error) {
    throw new Error(`Failed to count ai_work_run_steps ${runId}: ${error.message}`);
  }
  return count ?? 0;
}

function sectionItems(packet: JsonRecord): JsonRecord[] {
  const sections = asRecord(packet.sections);
  return [
    ...(Array.isArray(sections.needsBrandon) ? sections.needsBrandon : []),
    ...(Array.isArray(sections.waitingOnOthers)
      ? sections.waitingOnOthers
      : []),
    ...(Array.isArray(sections.importantUpdates)
      ? sections.importantUpdates
      : []),
  ].map(asRecord);
}

async function inspectPacketEvidence(
  dailyRecapId: string,
): Promise<PacketEvidenceSummary> {
  const { data, error } = await createServiceClient()
    .from("daily_recaps")
    .select("briefing_packet")
    .eq("id", dailyRecapId)
    .single();

  if (error) {
    throw new Error(
      `Failed to load daily_recaps packet ${dailyRecapId}: ${error.message}`,
    );
  }

  const packet = asRecord(data.briefing_packet);
  const items = sectionItems(packet);
  const familyCounts: Record<string, number> = {};
  let sourceRefCount = 0;

  for (const item of items) {
    const sourceRefs = Array.isArray(item.sourceRefs) ? item.sourceRefs : [];
    assert(sourceRefs.length > 0, "A surfaced packet item has no sourceRefs.");
    for (const rawRef of sourceRefs) {
      const ref = asRecord(rawRef);
      const family = String(ref.sourceFamily ?? "");
      assert(family, "A sourceRef is missing sourceFamily.");
      assert(ref.sourceId, `A ${family} sourceRef is missing sourceId.`);
      assert(ref.sourceTitle, `A ${family} sourceRef is missing sourceTitle.`);
      assert(ref.excerpt, `A ${family} sourceRef is missing excerpt.`);
      assert(
        ref.sourceUrl || ref.internalHref,
        `A ${family} sourceRef is missing a sourceUrl or internalHref.`,
      );
      familyCounts[family] = (familyCounts[family] ?? 0) + 1;
      sourceRefCount += 1;
    }
  }

  const optionalFamilies = ["meeting", "fireflies", "email", "outlook", "teams"];
  return {
    itemCount: items.length,
    sourceRefCount,
    familyCounts,
    excludedFamilies: optionalFamilies.filter(
      (family) => !Object.prototype.hasOwnProperty.call(familyCounts, family),
    ),
  };
}

async function verifyPreviewAndDryRun() {
  const api = await request.newContext({
    baseURL: baseUrl,
    storageState: await authStorageState(),
  });
  const response = await api.post("/api/executive/daily-brief/preview-teams", {
    data: { fresh: true, windowDays: 3, firstName: "Brandon" },
    timeout: 180_000,
  });
  const text = await response.text();
  await api.dispose();
  assert(response.ok(), `Preview request failed ${response.status()}: ${text.slice(0, 800)}`);

  const body = asRecord(JSON.parse(text));
  const runId = String(body.runId ?? "");
  assert(runId, "Preview response did not include runId.");

  const run = await loadRun(runId);
  const artifacts = await loadArtifacts(runId);
  const attempts = await loadDeliveryAttempts(runId);
  const sourceRows = await countSources(runId);
  const toolCallSteps = await countSteps(runId, "tool_call");

  assert(run.status === "succeeded", `Preview run ${runId} status was ${run.status}.`);
  assert(
    run.delivery_status === "dry_run",
    `Preview run ${runId} delivery_status was ${run.delivery_status}.`,
  );
  assert(run.daily_recap_id, `Preview run ${runId} did not link daily_recap_id.`);
  const packetEvidence = await inspectPacketEvidence(run.daily_recap_id);
  assert(
    artifacts.some((artifact) => artifact.kind === "brief_packet"),
    `Preview run ${runId} did not write a brief_packet artifact.`,
  );
  assert(
    artifacts.some((artifact) => artifact.kind === "teams_payload"),
    `Preview run ${runId} did not write a teams_payload artifact.`,
  );
  assert(
    attempts.some(
      (attempt) => attempt.channel === "teams" && attempt.status === "dry_run",
    ),
    `Preview run ${runId} did not write a Teams dry_run delivery attempt.`,
  );
  assert(sourceRows > 0, `Preview run ${runId} did not write evidence rows.`);
  assert(toolCallSteps > 0, `Preview run ${runId} did not write tool_call steps.`);

  return {
    runId,
    sourceRows,
    artifactCount: artifacts.length,
    attemptCount: attempts.length,
    packetEvidence,
  };
}

async function verifyDisabledDelivery() {
  const response = await fetch(`${baseUrl}/api/executive/daily-brief/send-teams`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const text = await response.text();
  assert(
    response.ok,
    `Disabled delivery request failed ${response.status}: ${text.slice(0, 800)}`,
  );
  const body = asRecord(JSON.parse(text));
  const runId = String(body.runId ?? "");
  assert(runId, "Disabled delivery response did not include runId.");

  const run = await loadRun(runId);
  const attempts = await loadDeliveryAttempts(runId);
  assert(run.status === "skipped", `Disabled run ${runId} status was ${run.status}.`);
  assert(
    run.delivery_status === "disabled",
    `Disabled run ${runId} delivery_status was ${run.delivery_status}.`,
  );
  assert(
    attempts.some(
      (attempt) =>
        attempt.channel === "teams" &&
        attempt.status === "disabled" &&
        attempt.failure_code === "EXECUTIVE_DAILY_BRIEF_DISABLED",
    ),
    `Disabled run ${runId} did not write a disabled Teams attempt.`,
  );

  return { runId, attemptCount: attempts.length };
}

async function verifyScheduledRun() {
  const trigger = `${proofId}_scheduled`;
  const { stdout, stderr } = await execFileAsync(
    "npx",
    ["tsx", "scripts/run-executive-daily-brief.ts", "--now=2026-06-19T12:00:00.000Z"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        EXECUTIVE_DAILY_BRIEF_ENABLED: "true",
        EXECUTIVE_DAILY_BRIEF_FRONTEND_BASE_URL: baseUrl,
        EXECUTIVE_DAILY_BRIEF_TARGET_TIMEZONE: "America/Indiana/Indianapolis",
        EXECUTIVE_DAILY_BRIEF_TARGET_LOCAL_TIME: "08:00",
        EXECUTIVE_DAILY_BRIEF_TARGET_WEEKDAYS: "1,2,3,4,5",
        EXECUTIVE_DAILY_BRIEF_TRIGGER: trigger,
        CRON_SECRET: process.env.CRON_SECRET || "codex-nonsecret-proof",
      },
      maxBuffer: 1024 * 1024,
    },
  );
  assert(!stderr.includes("[executive-daily-brief] failed"), stderr);
  const body = parseLastJsonObject(stdout);
  const runId = String(body.workRunId ?? "");
  assert(runId, "Scheduled runner output did not include workRunId.");

  const run = await loadRun(runId);
  assert(
    run.trigger_type === trigger,
    `Scheduled run ${runId} trigger_type was ${run.trigger_type}, expected ${trigger}.`,
  );
  assert(
    run.status === "skipped" || run.status === "succeeded",
    `Scheduled run ${runId} status was ${run.status}.`,
  );
  assert(
    run.delivery_status === "disabled" || run.delivery_status === "sent",
    `Scheduled run ${runId} delivery_status was ${run.delivery_status}.`,
  );

  return { runId, status: run.status, deliveryStatus: run.delivery_status };
}

async function main() {
  const preview = await verifyPreviewAndDryRun();
  const disabled = await verifyDisabledDelivery();
  const scheduled = await verifyScheduledRun();

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        baseUrl,
        preview,
        dryRun: {
          runId: preview.runId,
          evidence: "Preview path wrote Teams dry_run delivery attempt.",
        },
        disabled,
        scheduled,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Unknown Executive Daily Brief ledger integration verification failure.",
  );
  process.exit(1);
});
