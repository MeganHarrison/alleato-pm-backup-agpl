#!/usr/bin/env node
/**
 * Backfill tasks assigned by Brandon from the last 14 days of meetings, emails, and Teams messages.
 *
 * Usage (from repo root):
 *   node scripts/backfill-brandon-tasks.mjs
 *   node scripts/backfill-brandon-tasks.mjs --days 30
 *   node scripts/backfill-brandon-tasks.mjs --dry-run
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load env from frontend/.env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../frontend/.env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) continue;
    const eqIdx = stripped.indexOf("=");
    if (eqIdx < 0) continue;
    const key = stripped.slice(0, eqIdx).trim();
    let val = stripped.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // env already set via export
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const AI_GATEWAY_KEY = process.env.AI_GATEWAY_API_KEY ?? "";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY || (!AI_GATEWAY_KEY && !OPENAI_KEY)) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and AI_GATEWAY_API_KEY or OPENAI_API_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DAYS = parseInt(args.find((a) => a.startsWith("--days"))?.split("=")[1] ?? "14", 10) || 14;
const BRANDON_EMAIL = "bclymer@alleatogroup.com";
const BRANDON_NAME = "Brandon Clymer";
const TASK_EXTRACTION_MODEL = "gpt-5.5";
const TASK_EXTRACTION_PROMPT_VERSION = "brandon_backfill.v2.gpt-5.5";

const LLM_PROVIDER = AI_GATEWAY_KEY
  ? {
      name: "AI Gateway",
      apiKey: AI_GATEWAY_KEY,
      baseUrl: "https://ai-gateway.vercel.sh/v1",
      model: `openai/${TASK_EXTRACTION_MODEL}`,
    }
  : {
      name: "OpenAI direct",
      apiKey: OPENAI_KEY,
      baseUrl: "https://api.openai.com/v1",
      model: TASK_EXTRACTION_MODEL,
    };

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function sbGet(path, query = "") {
  const url = `${SUPABASE_URL}/rest/v1/${path}${query ? "?" + query : ""}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbGetAll(path, query = "", pageSize = 1000) {
  const rows = [];
  for (let start = 0; ; start += pageSize) {
    const url = `${SUPABASE_URL}/rest/v1/${path}${query ? "?" + query : ""}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        Range: `${start}-${start + pageSize - 1}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function sbPost(table, payload) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Supabase POST ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || ["null", "none", "unknown", "n/a"].includes(text.toLowerCase())) return null;
  return text;
}

function normalizeEmail(value) {
  const text = cleanText(value);
  return text && text.includes("@") ? text.toLowerCase() : null;
}

function normalizeName(value) {
  const text = cleanText(value);
  if (!text) return null;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s@._+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function canonicalName(person) {
  return [person.first_name, person.last_name].map(cleanText).filter(Boolean).join(" ") || null;
}

function buildAssigneeResolver(people) {
  const byEmail = new Map();
  const byName = new Map();
  const byToken = new Map();

  for (const person of people) {
    const email = normalizeEmail(person.email);
    if (email) byEmail.set(email, person);

    const name = normalizeName(canonicalName(person));
    if (!name) continue;
    byName.set(name, [...(byName.get(name) ?? []), person]);
    for (const token of name.split(" ")) {
      if (token.length >= 3) byToken.set(token, [...(byToken.get(token) ?? []), person]);
    }
  }

  return (nameValue, emailValue) => {
    const sourceName = cleanText(nameValue);
    const sourceEmail = normalizeEmail(emailValue);
    if (sourceEmail && byEmail.has(sourceEmail)) {
      return resolvedAssignee(byEmail.get(sourceEmail), "email_exact", 1, sourceName, sourceEmail);
    }

    const normalizedName = normalizeName(sourceName);
    if (normalizedName) {
      const exact = byName.get(normalizedName) ?? [];
      if (exact.length === 1) return resolvedAssignee(exact[0], "name_exact", 0.95, sourceName, sourceEmail);

      const token = byToken.get(normalizedName) ?? [];
      if (token.length === 1) return resolvedAssignee(token[0], "unique_name_token", 0.82, sourceName, sourceEmail);
    }

    return {
      values: {
        assignee_person_id: null,
        assignee_name: sourceName,
        assignee_email: sourceEmail,
      },
      metadata: {
        assignee_resolution_method: "unresolved",
        assignee_resolution_confidence: 0,
      },
    };
  };
}

function resolvedAssignee(person, method, confidence, fallbackName, fallbackEmail) {
  return {
    values: {
      assignee_person_id: person.id,
      assignee_name: canonicalName(person) ?? fallbackName,
      assignee_email: normalizeEmail(person.email) ?? fallbackEmail,
    },
    metadata: {
      assignee_resolution_method: method,
      assignee_resolution_confidence: confidence,
    },
  };
}

// ─── OpenAI helper ───────────────────────────────────────────────────────────

async function extractTasks(doc) {
  const text = [doc.summary ?? "", doc.content ? doc.content.slice(0, 3000) : ""]
    .join("\n\n")
    .trim();

  if (!text || text.length < 80) return [];

  const typeLabel =
    doc.type === "meeting"
      ? `meeting titled "${doc.title}"`
      : doc.type === "email"
        ? `email titled "${doc.title}"`
        : `Teams message "${doc.title}"`;

  const prompt = `You are extracting action items that Brandon (bclymer@alleatogroup.com) explicitly assigned to specific people from this ${typeLabel}.

Rules:
- Only extract tasks where Brandon is clearly the one directing/assigning the work
- Only extract tasks assigned to a specific named person (not "the team" vaguely)
- Do NOT extract tasks where Brandon himself is doing the work
- Do NOT invent tasks — only extract what is clearly stated in the text
- Each task must have a clear action verb and a clear named owner
- If no qualifying tasks exist, return an empty array

Respond ONLY with a JSON array (no markdown fences, no explanation):
[
  {
    "title": "Short action-oriented title (max 10 words)",
    "description": "Full description including context and any deadline",
    "assignee_name": "First Last name of person assigned, or null",
    "assignee_email": "email if mentioned, otherwise null",
    "due_date": "YYYY-MM-DD if deadline mentioned, otherwise null",
    "priority": "high | medium | low | null"
  }
]

Source text:
${text}`;

  const res = await fetch(`${LLM_PROVIDER.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LLM_PROVIDER.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_PROVIDER.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    console.error(`   OpenAI error: ${res.status}`);
    return [];
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "[]";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nullableText(value) {
  const text = llmText(value);
  if (text == null) return null;
  const normalized = text.trim();
  if (
    !normalized ||
    ["null", "none"].includes(normalized.toLowerCase()) ||
    normalized.startsWith("{") ||
    normalized.startsWith("[")
  ) {
    return null;
  }
  return normalized;
}

function llmText(value) {
  if (value == null) return null;
  if (typeof value === "object") {
    for (const key of ["name", "display_name", "email", "value", "text"]) {
      if (typeof value[key] === "string") return value[key];
    }
    return null;
  }
  return String(value);
}

function exactTaskKey(metadataId, description) {
  return `${metadataId ?? ""}|${(description ?? "").toLowerCase().trim()}`;
}

const DUPLICATE_STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "you", "your",
  "brandon", "please", "need", "needs", "should", "send", "provide",
  "review", "confirm", "status", "update", "attached", "email", "thread",
]);

function stemToken(token) {
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  return token;
}

function textTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(stemToken)
    .filter((token) => token.length > 2 && !DUPLICATE_STOP_WORDS.has(token));
}

function taskFingerprint(task) {
  const description = nullableText(task.description) ?? nullableText(task.title);
  if (!description) return null;
  const assignee = normalizeEmail(task.assignee_email) ?? normalizeName(task.assignee_name) ?? "unassigned";
  const tokens = [...new Set(textTokens(description))].sort();
  if (tokens.length < 2) return null;
  return { assignee, tokens };
}

function similarity(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size);
}

function isDuplicateTask(candidate, existing) {
  if (existing.exact.has(exactTaskKey(candidate.metadata_id, candidate.description ?? candidate.title))) {
    return true;
  }
  const fingerprint = taskFingerprint(candidate);
  if (!fingerprint) return false;
  return existing.fingerprints.some(
    (seen) => seen.assignee === fingerprint.assignee && similarity(seen.tokens, fingerprint.tokens) >= 0.6,
  );
}

function rememberTask(candidate, existing) {
  existing.exact.add(exactTaskKey(candidate.metadata_id, candidate.description ?? candidate.title));
  const fingerprint = taskFingerprint(candidate);
  if (fingerprint) existing.fingerprints.push(fingerprint);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function fetchDocs() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const enc = encodeURIComponent;
  const filter =
    `organizer_email.ilike.*${BRANDON_EMAIL}*,` +
    `host_email.ilike.*${BRANDON_EMAIL}*,` +
    `participants.ilike.*${BRANDON_EMAIL}*`;

  return sbGet(
    "document_metadata",
    `select=id,title,date,content,summary,type,category,source_system,project_id,source_web_url,fireflies_link,meeting_link` +
      `&created_at=gte.${enc(since)}` +
      `&or=(${enc(filter)})` +
      `&type=in.(meeting,email,teams_dm_conversation)` +
      `&order=date.desc` +
      `&limit=300`
  );
}

async function getExistingKeys() {
  const rows = await sbGet(
    "tasks",
    `select=metadata_id,description,title,assignee_name,assignee_email&limit=10000`
  );
  return {
    exact: new Set(rows.map((r) => exactTaskKey(r.metadata_id, r.description ?? r.title))),
    fingerprints: rows.map(taskFingerprint).filter(Boolean),
  };
}

async function main() {
  console.log(
    `\n${DRY_RUN ? "[DRY RUN] " : ""}Fetching documents from the last ${DAYS} days involving Brandon...`
  );

  const docs = await fetchDocs();
  console.log(`   Found ${docs.length} documents\n`);

  if (!docs.length) {
    console.log("No documents found. Exiting.");
    return;
  }

  const existing = await getExistingKeys();
  const people = await sbGetAll("people", "select=id,first_name,last_name,email");
  const resolveAssignee = buildAssigneeResolver(people);
  console.log(`   ${existing.exact.size} existing task keys already in DB (duplicates will be skipped)\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const doc of docs) {
    process.stdout.write(`   ${doc.title?.slice(0, 55) ?? doc.id}... `);
    const tasks = await extractTasks(doc);

    if (!tasks.length) {
      console.log("no tasks found");
      continue;
    }

    console.log(`${tasks.length} task(s)`);

    for (const task of tasks) {
      const candidate = {
        ...task,
        metadata_id: doc.id,
        title: nullableText(task.title),
        description: nullableText(task.description),
        assignee_name: nullableText(task.assignee_name),
        assignee_email: nullableText(task.assignee_email),
      };
      if (isDuplicateTask(candidate, existing)) {
        console.log(`     ⊘ Duplicate: ${task.title}`);
        totalSkipped++;
        continue;
      }

      console.log(`     ✓ "${candidate.title}" → ${candidate.assignee_name ?? "unassigned"}`);
      const assignee = resolveAssignee(candidate.assignee_name, candidate.assignee_email);

      if (!DRY_RUN) {
        await sbPost("tasks", {
          title: candidate.title,
          description: candidate.description,
          ...assignee.values,
          due_date: nullableText(task.due_date),
          priority: nullableText(task.priority),
          status: "open",
          assigned_by: BRANDON_NAME,
          source_system: doc.source_system ?? doc.type ?? "meeting",
          metadata_id: doc.id,
          project_id: doc.project_id ?? null,
          extraction_source: "brandon_backfill",
          extraction_model: TASK_EXTRACTION_MODEL,
          extraction_prompt_version: TASK_EXTRACTION_PROMPT_VERSION,
          extraction_metadata: {
            provider: LLM_PROVIDER.name,
            model_id: LLM_PROVIDER.model,
            source_type: doc.type ?? null,
            source_title: doc.title ?? null,
            window_days: DAYS,
            dry_run: DRY_RUN,
            ...assignee.metadata,
          },
        });
        rememberTask(candidate, existing);
      }
      totalInserted++;
    }
  }

  const verb = DRY_RUN ? "Would insert" : "Inserted";
  console.log(`\n✅ Done. ${verb} ${totalInserted} tasks, skipped ${totalSkipped} duplicates.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
