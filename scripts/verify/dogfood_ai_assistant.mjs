#!/usr/bin/env node

/**
 * Dogfood the AI assistant with realistic CEO questions and check answers
 * for content correctness against the actual database. This is what the eval
 * suite couldn't catch — the assistant claiming "no meetings were logged"
 * when meetings exist.
 *
 * For each prompt:
 *   1. Independently query the database to know what TRUE answer should look like
 *   2. POST the prompt to /api/ai-assistant/chat
 *   3. Drain the SSE stream and read tool_trace from chat_history
 *   4. Score: did the answer mention the things the DB says exist? Did it
 *      contain a false-negative phrase like "no X found" when X does exist?
 *
 * Outputs a markdown report with PASS/FAIL/SUSPECT per question.
 */

import fs from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const BASE = "http://localhost:3000";
const ENDPOINT = `${BASE}/api/ai-assistant/chat`;
const AUTH = JSON.parse(
  await fs.readFile(path.join(repoRoot, "frontend/tests/.auth/user.json"), "utf8"),
);
const COOKIE = AUTH.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

const pool = new pg.Pool({
  connectionString: (() => {
    const u = new URL(process.env.DATABASE_URL);
    u.searchParams.delete("sslmode");
    return u.toString();
  })(),
  ssl: { rejectUnauthorized: false },
  max: 2,
});

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(repoRoot, "tmp/ai-evals/dogfood", stamp);
mkdirSync(outDir, { recursive: true });

// ─────────── Ground-truth queries ──────────────────────────────────────────
async function gtRecentMeetings() {
  const r = await pool.query(`
    select id, title, date, project, project_id
    from public.document_metadata
    where (type='meeting' or category='meeting')
      and date >= (now() - interval '4 days')
    order by date desc
    limit 50
  `);
  return r.rows;
}
async function gtOverdueRfis() {
  const r = await pool.query(`
    select id, number, subject, status, project_id, due_date
    from public.rfis
    where status in ('open','draft','submitted') and due_date is not null and due_date < now()
    order by due_date asc
    limit 25
  `);
  return r.rows;
}
async function gtPendingChangeOrders() {
  const r = await pool.query(`
    select id, number, title, status, amount, project_id
    from public.change_orders
    where status in ('pending','pending_owner','pending_approval','open','submitted','draft')
    order by id desc
    limit 25
  `);
  return r.rows;
}
async function gtRecentEmails() {
  const r = await pool.query(`
    select id, subject, from_email, from_name, received_at, project_id
    from public.project_emails
    where received_at >= (now() - interval '7 days')
    order by received_at desc
    limit 25
  `);
  return r.rows;
}
async function gtActiveProjects() {
  const r = await pool.query(`
    select id, name, phase, address
    from public.projects
    where (archived is null or archived = false)
    order by name
    limit 100
  `);
  return r.rows;
}

// ─────────── Prompt sweep ──────────────────────────────────────────────────
const cases = [
  {
    id: "01-recent-meeting-issues",
    prompt: "Were there any issues from the meetings in the last couple days?",
    groundTruth: gtRecentMeetings,
    checkAnswer: (text, gt) => {
      const failures = [];
      const lower = text.toLowerCase();
      if (gt.length > 0) {
        const liedAboutEmpty = [
          "no meetings were logged",
          "zero meeting records",
          "no meetings in the last",
          "did not find any meetings",
          "i do not see any meetings",
        ].some((p) => lower.includes(p));
        if (liedAboutEmpty) failures.push(`FALSE NEGATIVE: ${gt.length} meetings exist in DB`);
        const titleMentions = gt.filter((m) => {
          const firstWord = (m.title || "").split(/\s+/)[0]?.toLowerCase();
          return firstWord && firstWord.length > 3 && lower.includes(firstWord);
        }).length;
        if (titleMentions === 0)
          failures.push(`Answer didn't reference any of the ${gt.length} actual meeting titles`);
      }
      return failures;
    },
  },
  {
    id: "02-overdue-rfis",
    prompt: "Which RFIs are overdue right now? Who owes us a response?",
    groundTruth: gtOverdueRfis,
    checkAnswer: (text, gt) => {
      const failures = [];
      const lower = text.toLowerCase();
      if (gt.length > 0) {
        if (
          /no (overdue )?rfis|zero rfis|did not find any rfis|i don'?t see any (open|overdue) rfis/.test(
            lower,
          )
        ) {
          failures.push(`FALSE NEGATIVE: ${gt.length} overdue RFIs in DB`);
        }
      } else {
        // gt empty is fine; assistant should say so honestly
      }
      return failures;
    },
  },
  {
    id: "03-pending-change-orders",
    prompt: "What change orders are pending approval right now? What's the total exposure?",
    groundTruth: gtPendingChangeOrders,
    checkAnswer: (text, gt) => {
      const failures = [];
      const lower = text.toLowerCase();
      if (gt.length > 0) {
        if (
          /no (pending )?change orders|zero change orders|did not find any change orders/.test(
            lower,
          )
        ) {
          failures.push(`FALSE NEGATIVE: ${gt.length} pending COs in DB`);
        }
      }
      return failures;
    },
  },
  {
    id: "04-yesterday-meetings",
    prompt: "Summarize yesterday's meetings.",
    groundTruth: async () => {
      const r = await pool.query(`
        select id, title, date, project_id
        from public.document_metadata
        where (type='meeting' or category='meeting')
          and date::date = (current_date - interval '1 day')::date
        limit 25
      `);
      return r.rows;
    },
    checkAnswer: (text, gt) => {
      const failures = [];
      const lower = text.toLowerCase();
      if (gt.length > 0) {
        if (/no meetings (yesterday|on)/.test(lower) || /didn'?t find.{0,40}meetings/.test(lower))
          failures.push(`FALSE NEGATIVE: ${gt.length} meetings yesterday`);
      }
      return failures;
    },
  },
  {
    id: "05-recent-emails",
    prompt: "What did we hear about in emails this past week? Any commitments or issues?",
    groundTruth: gtRecentEmails,
    checkAnswer: (text, gt) => {
      const failures = [];
      const lower = text.toLowerCase();
      if (gt.length > 0) {
        if (/no (recent )?emails|zero emails|did not find any emails/.test(lower)) {
          failures.push(`FALSE NEGATIVE: ${gt.length} emails in last 7d`);
        }
      }
      return failures;
    },
  },
  {
    id: "06-active-projects",
    prompt: "How many active projects do we have right now? Quick summary.",
    groundTruth: gtActiveProjects,
    checkAnswer: (text, gt) => {
      const failures = [];
      if (gt.length === 0) return failures;
      // Look for any number that's plausibly the count, ±20% tolerance
      const nums = [...text.matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1]));
      const close = nums.some((n) => Math.abs(n - gt.length) <= Math.max(2, gt.length * 0.2));
      if (!close && nums.length > 0)
        failures.push(`Answer mentioned numbers ${nums.slice(0, 5)}, expected ~${gt.length}`);
      if (nums.length === 0) failures.push("Answer never mentioned a count");
      return failures;
    },
  },
  {
    id: "07-portfolio-risks",
    prompt: "What should I worry about across all my active projects right now? Top 3 risks.",
    groundTruth: async () => ({}),
    checkAnswer: (text) => {
      const failures = [];
      const lower = text.toLowerCase();
      // This is a strategic question, hard to check correctness — but at minimum,
      // shouldn't punt with "I don't have access" or "no data"
      if (
        /i (cannot|can'?t|don'?t have) (access|enough)/.test(lower) ||
        /no projects (found|available)/.test(lower)
      )
        failures.push("Strategic question got punted");
      // Should mention at least 3 specific things (project names, risk types)
      if (text.length < 300) failures.push(`Answer too short: ${text.length} chars`);
      return failures;
    },
  },
  {
    id: "08-cash-position",
    prompt: "How does our cash position look right now?",
    groundTruth: async () => ({}),
    checkAnswer: (text) => {
      const failures = [];
      const lower = text.toLowerCase();
      // Has to either give a real cash number or honestly explain the data isn't available
      const hasMoney = /\$[\d,]+|\d+\s*(million|m|k|thousand)/i.test(text);
      const honestUnavailable =
        /(don'?t have access|not (yet )?(connected|available)|cannot pull|do not currently)/.test(
          lower,
        );
      if (!hasMoney && !honestUnavailable)
        failures.push("Neither gave a cash figure nor honestly said data unavailable");
      return failures;
    },
  },
];

// ─────────── Runner ──────────────────────────────────────────────────────
async function postPrompt(prompt) {
  const sessionId = randomUUID();
  const messageId = randomUUID();
  const body = {
    id: sessionId,
    messages: [{ id: messageId, role: "user", parts: [{ type: "text", text: prompt }] }],
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120_000);
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: COOKIE },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    return { sessionId, status: 0, text: "", error: e.message, ms: Date.now() - startedAt };
  }
  if (!response.ok) {
    clearTimeout(timer);
    const txt = await response.text().catch(() => "");
    return {
      sessionId,
      status: response.status,
      text: "",
      error: `HTTP ${response.status}: ${txt.slice(0, 300)}`,
      ms: Date.now() - startedAt,
    };
  }
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  try {
    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (e) {
        return { sessionId, status: 200, text, error: `stream: ${e.message}`, ms: Date.now() - startedAt };
      }
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (p === "[DONE]") continue;
        try {
          const e = JSON.parse(p);
          if (e.type === "text-delta" && typeof e.delta === "string") text += e.delta;
          else if (e.type === "text" && typeof e.text === "string") text += e.text;
        } catch {}
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return { sessionId, status: 200, text, error: null, ms: Date.now() - startedAt };
}

async function fetchPersistedTools(sessionId) {
  // Poll up to 12s for the persisted assistant message
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const r = await pool.query(
      `select metadata from public.chat_history where session_id=$1 and role='assistant' order by created_at desc limit 1`,
      [sessionId],
    );
    if (r.rows.length > 0) {
      const trace = r.rows[0].metadata?.tool_trace ?? [];
      return trace.map((t) => t?.tool ?? t?.toolName).filter(Boolean);
    }
    await new Promise((res) => setTimeout(res, 750));
  }
  return [];
}

// ─────────── Drive ─────────────────────────────────────────────────────────
import { spawn } from "node:child_process";

async function ensureServerHealthy() {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${BASE}/`, { method: "HEAD" });
      if (r.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function restartDevServer() {
  // Kill anything on port 3000
  try {
    await new Promise((resolve) => {
      const p = spawn("bash", ["-c", "lsof -ti:3000 | xargs kill -9 2>/dev/null; true"], { stdio: "ignore" });
      p.on("exit", resolve);
    });
  } catch {}
  await new Promise((r) => setTimeout(r, 1500));
  // Start fresh
  const log = await fs.open(path.join(outDir, "dev-server.log"), "a");
  const child = spawn("npm", ["run", "dev:frontend"], {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", log.fd, log.fd],
  });
  child.unref();
  await log.close();
  // Wait for ready
  for (let i = 0; i < 90; i++) {
    if (await ensureServerHealthy()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

console.log(`Dogfooding ${cases.length} CEO questions against ${ENDPOINT}`);
console.log(`Out: ${path.relative(repoRoot, outDir)}\n`);

const results = [];
for (const [idx, c] of cases.entries()) {
  // Verify the server is alive; if not, restart.
  if (!(await ensureServerHealthy())) {
    process.stdout.write(`  (server down — restarting…) `);
    const ok = await restartDevServer();
    if (!ok) {
      console.log("FAILED to restart server, aborting.");
      break;
    }
    process.stdout.write(`(ready) `);
  }
  process.stdout.write(`[${idx + 1}/${cases.length}] ${c.id} … `);
  const gt = await c.groundTruth();
  const gtCount = Array.isArray(gt) ? gt.length : "n/a";
  const r = await postPrompt(c.prompt);
  const tools = await fetchPersistedTools(r.sessionId);
  const failures = c.checkAnswer(r.text, gt);
  if (r.error) failures.unshift(`STREAM ERROR: ${r.error}`);
  const status = failures.length === 0 ? "PASS" : "FAIL";
  console.log(`${status} (${(r.ms / 1000).toFixed(1)}s, ${tools.length}t, gt=${gtCount})`);
  for (const f of failures) console.log(`    ! ${f}`);

  await fs.writeFile(
    path.join(outDir, `${c.id}.json`),
    JSON.stringify(
      { id: c.id, prompt: c.prompt, status, failures, tools, ms: r.ms, error: r.error, gtCount, answer: r.text, groundTruthSample: Array.isArray(gt) ? gt.slice(0, 5) : gt },
      null,
      2,
    ),
  );
  results.push({ id: c.id, status, failures, tools, ms: r.ms, gtCount, prompt: c.prompt, answerPreview: r.text.slice(0, 400) });
}

const md = [
  `# Dogfood Run — ${stamp}`,
  "",
  `- Endpoint: ${ENDPOINT}`,
  `- Total: ${results.length}`,
  `- Pass: ${results.filter((r) => r.status === "PASS").length}`,
  `- Fail: ${results.filter((r) => r.status === "FAIL").length}`,
  "",
  "## Results",
  "",
  "| # | Case | Status | Tools | Duration | Ground truth | Failures |",
  "|---|---|---|---|---|---|---|",
  ...results.map((r, i) => `| ${i + 1} | ${r.id} | ${r.status === "PASS" ? "✅" : "❌"} | ${r.tools.length} | ${(r.ms / 1000).toFixed(1)}s | ${r.gtCount} | ${r.failures.join("; ") || "—"} |`),
  "",
  "## Per-case answer previews",
  "",
  ...results.flatMap((r) => [
    `### ${r.id} — ${r.status === "PASS" ? "✅" : "❌"}`,
    `**Prompt:** ${r.prompt}`,
    "",
    `**Tools fired (${r.tools.length}):** ${r.tools.join(", ") || "(none)"}`,
    "",
    `**Answer preview:**`,
    "```",
    r.answerPreview,
    "```",
    "",
  ]),
];

await fs.writeFile(path.join(outDir, "report.md"), md.join("\n"));
await pool.end();

const failed = results.filter((r) => r.status === "FAIL");
console.log(`\nReport: ${path.relative(repoRoot, outDir)}/report.md`);
console.log(`Pass: ${results.length - failed.length}/${results.length}`);
process.exit(failed.length === 0 ? 0 : 1);
