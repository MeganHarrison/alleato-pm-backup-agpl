#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildAppDatabaseConnectionString, getAppDatabaseUrl } from "./app-db-connection.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");

const files = {
  aiMemoryService: "frontend/src/lib/ai/services/ai-memory-service.ts",
  conversationMemory: "frontend/src/lib/ai/services/conversation-memory.ts",
  memoryExtraction: "frontend/src/lib/ai/services/memory-extraction.ts",
  botCore: "frontend/src/lib/ai/bot-core.ts",
  operationalTools: "frontend/src/lib/ai/tools/operational.ts",
};

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function loadEnv() {
  const env = {};
  for (const name of [".env", ".env.local"]) {
    const path = resolve(repoRoot, name);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+?)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[match[1].trim()] = value;
    }
  }
  return env;
}

function runPsql(databaseUrl, sql) {
  return execFileSync("psql", [databaseUrl, "-qAt", "-v", "ON_ERROR_STOP=1", "-c", `set statement_timeout='30s';\n${sql}`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const failures = [];
const warnings = [];

const staticChecks = [
  {
    file: files.aiMemoryService,
    description: "memory service reports retrieval errors instead of silently returning empty arrays",
    test: (content) =>
      content.includes("Promise.allSettled") &&
      content.includes("errors: string[]") &&
      content.includes("failureLabel: \"AI memory search\"") &&
      content.includes("Team memory search failed") &&
      content.includes("User preference memory lookup failed") &&
      !content.includes("catch {\n    return [];"),
  },
  {
    file: files.aiMemoryService,
    description: "memory writes fail loudly when dedupe or update fails",
    test: (content) =>
      content.includes("Duplicate memory check failed") &&
      content.includes("if (updateError) return { error: updateError.message };") &&
      content.includes("Memory vector sync failed") &&
      content.includes("Memory vector delete failed") &&
      content.includes("Failed to check commitment insight duplicate") &&
      content.includes("Failed to create commitment insight from memory"),
  },
  {
    file: files.aiMemoryService,
    description: "memory chunk hydration enforces lifecycle and visibility filters",
    test: (content) =>
      content.includes("filter_source_types: [\"ai_memory\"]") &&
      content.includes(".eq(\"is_active\", true)") &&
      content.includes("user_id.eq.${params.userId},visibility.eq.team") &&
      content.includes(".eq(\"visibility\", \"team\")") &&
      !content.includes("supabase.rpc(\"search_team_memories\""),
  },
  {
    file: files.botCore,
    description: "prompt assembly surfaces partial memory load failures",
    test: (content) =>
      content.includes("Memory context partially unavailable") &&
      content.includes("Runtime Context Health"),
  },
  {
    file: files.conversationMemory,
    description: "conversation memory persistence reports insert/update failures",
    test: (content) =>
      content.includes("Failed to update conversation memory") &&
      content.includes("Failed to insert conversation memory") &&
      content.includes("Failed to fetch messages for conversation memory") &&
      content.includes("Failed to fetch recent conversation summaries"),
  },
  {
    file: files.memoryExtraction,
    description: "memory extraction uses structured output and reports fetch failures",
    test: (content) =>
      content.includes("Output.object") &&
      content.includes("extractedMemorySchema") &&
      content.includes("result.output.memories") &&
      content.includes("order(\"created_at\", { ascending: false })") &&
      content.includes("[...messages].reverse()") &&
      !content.includes("JSON.parse") &&
      content.includes("Failed to fetch chat history for memory extraction") &&
      content.includes("Failed to store extracted") &&
      content.includes("Extracted memory write failures"),
  },
  {
    file: "frontend/src/app/api/ai-assistant/chat/handler-v2.ts",
    description: "main chat persists memory/source debug metadata and schedules post-response memory extraction",
    test: (content) =>
      content.includes("runPostResponseTasks") &&
      content.includes("type MemoryUsageSummary") &&
      content.includes("onMemoryUsage") &&
      content.includes("metadata.memory_usage = memoryUsage") &&
      content.includes("source_debug") &&
      content.includes("buildAnswerDebugMetadata") &&
      content.includes("waitUntil(runPostResponseTasks(args.sessionId, args.user.id))"),
  },
  {
    file: "frontend/src/app/api/ai-assistant/chat/handler-v2.ts",
    description: "chat synthesis uses a bounded high-output token policy instead of a 4000-token hard cap",
    test: (content) =>
      content.includes("AI_ASSISTANT_MAX_OUTPUT_TOKENS") &&
      content.includes("12_000") &&
      content.includes("maxOutputTokens: assistantMaxOutputTokens(plan.reason)") &&
      !content.includes("maxOutputTokens: 4000"),
  },
  {
    file: files.botCore,
    description: "prompt assembly passes selected project into memory recall and exposes memory debugger ranking metadata",
    test: (content) =>
      content.includes("projectId: selectedProjectId") &&
      content.includes("rankingReason: memory.ranking_reason") &&
      content.includes("retrieved: {") &&
      content.includes("preferencesUsed: usedPreferenceIds.size"),
  },
  {
    file: files.operationalTools,
    description: "memory tools expose structured search/write operations",
    test: (content) =>
      content.includes("searchMemories: tool({") &&
      content.includes("writeMemory: tool({") &&
      content.includes("recallPastConversations: tool({"),
  },
  {
    file: files.aiMemoryService,
    description: "memory recall ranks recent/project-matched records and caps semantic recall to the default lookback",
    test: (content) =>
      content.includes("MEMORY_RECALL_LOOKBACK_DAYS = 183") &&
      content.includes(".gte(\"created_at\", recallCutoff)") &&
      content.includes("scoreMemoryForRecall") &&
      content.includes("rankMemoriesForRecall") &&
      content.includes("freshness * 10") &&
      content.includes("projectId: params.projectId") &&
      content.includes("ranking_reason"),
  },
];

for (const check of staticChecks) {
  const content = read(check.file);
  if (!check.test(content)) {
    failures.push(`${check.file}: ${check.description}`);
  }
}

const env = { ...loadEnv(), ...process.env };
// AI memory is still an application-database contract. Do not point this check
// at RAG_DATABASE_URL; RAG owns heavy retrieval/chunk tables, while
// ai_memories/memories and their RPCs remain in the original app DB.
const databaseUrl = getAppDatabaseUrl(env);

if (!databaseUrl) {
  failures.push(
    "DATABASE_URL or SUPABASE_DB_URL is required for live AI memory contract verification against the original app DB",
  );
} else {
  try {
    const psqlDatabaseUrl = await buildAppDatabaseConnectionString(databaseUrl, { warnings });
    const embeddingTypes = runPsql(
      psqlDatabaseUrl,
      `
        select table_name || '.' || column_name || '=' || udt_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name in ('ai_memories', 'memories')
          and column_name = 'embedding'
        order by table_name;
      `,
    )
      .split("\n")
      .filter(Boolean);

    for (const expected of ["ai_memories.embedding=halfvec", "memories.embedding=halfvec"]) {
      if (!embeddingTypes.includes(expected)) {
        failures.push(`Live DB missing expected memory embedding type: ${expected}`);
      }
    }

    const functions = runPsql(
      psqlDatabaseUrl,
      `
        select p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'search_ai_memories',
            'find_duplicate_memory',
            'search_team_memories',
            'search_conversation_memories',
            'touch_ai_memories',
            'expire_ai_memories',
            'decay_memory_confidence'
          )
        order by p.proname;
      `,
    )
      .split("\n")
      .filter(Boolean);

    for (const expected of [
      "decay_memory_confidence",
      "expire_ai_memories",
      "find_duplicate_memory",
      "search_ai_memories",
      "search_conversation_memories",
      "search_team_memories",
      "touch_ai_memories",
    ]) {
      if (!functions.includes(expected)) {
        failures.push(`Live DB missing expected memory function: ${expected}`);
      }
    }

    const signatureRows = runPsql(
      psqlDatabaseUrl,
      `
        select p.proname || '(' || pg_get_function_arguments(p.oid) || ')'
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('search_ai_memories', 'find_duplicate_memory', 'search_team_memories')
        order by p.proname;
      `,
    );
    if (signatureRows.includes("query_embedding vector")) {
      failures.push(
        "ai_memories RPCs still accept vector query embeddings while storage is halfvec.",
      );
    }
    if (!signatureRows.includes("query_embedding halfvec")) {
      failures.push("ai_memories RPCs do not expose the expected halfvec query_embedding signature.");
    }

    const smoke = runPsql(
      psqlDatabaseUrl,
      `
        with sample as (
          select embedding::text as emb, user_id
          from public.ai_memories
          where embedding is not null
          order by created_at desc
          limit 1
        )
        select case
          when exists (select 1 from sample) then (
            select count(*)::text
            from sample, public.search_ai_memories(sample.emb::halfvec, sample.user_id, 1, 0.0, null, null)
          )
          else 'skipped:no-ai-memory-rows'
        end;
      `,
    );

    if (!smoke || smoke.startsWith("ERROR")) {
      failures.push("Live search_ai_memories smoke query did not return a result");
    } else if (smoke.startsWith("skipped:")) {
      warnings.push("Live search_ai_memories smoke query skipped because no embedded ai_memories rows exist.");
    }
  } catch (error) {
    failures.push(`Live DB AI memory contract check failed: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error("AI memory contract verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  if (warnings.length > 0) {
    console.error("\nWarnings:");
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }
  process.exit(1);
}

console.log("AI memory contract verification passed.");
for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}
