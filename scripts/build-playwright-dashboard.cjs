#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    args[key] = value;
    if (value !== "true") i += 1;
  }
  return args;
}

function walkFiles(rootDir, fileList = []) {
  if (!fs.existsSync(rootDir)) return fileList;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeStatus(status) {
  const s = String(status || "").toLowerCase();
  if (["pass", "passed", "ok", "expected"].includes(s)) return "pass";
  if (["partial", "not-testable", "not_testable"].includes(s)) return "partial";
  if (["fail", "failed", "error", "unexpected", "timedout"].includes(s)) return "fail";
  return "unknown";
}

function classifyWorkflowReport(report) {
  if (!report || typeof report !== "object") return null;
  const hasWorkflowShape = Array.isArray(report.steps) || Array.isArray(report.assertions) || report.status;
  if (!hasWorkflowShape) return null;

  const statuses = [];
  if (Array.isArray(report.steps)) statuses.push(...report.steps.map((s) => normalizeStatus(s.status)));
  if (Array.isArray(report.assertions)) statuses.push(...report.assertions.map((s) => normalizeStatus(s.status)));
  if (report.status) statuses.push(normalizeStatus(report.status));

  const failCount = statuses.filter((s) => s === "fail").length;
  const partialCount = statuses.filter((s) => s === "partial").length;
  const passCount = statuses.filter((s) => s === "pass").length;
  const total = statuses.length || 1;
  const finalStatus = failCount > 0 ? "FAIL" : partialCount > 0 ? "PARTIAL" : "PASS";

  return {
    kind: "workflow",
    status: finalStatus,
    passCount,
    partialCount,
    failCount,
    total,
    startedAt: report.runTimestamp || report.timestamp || null,
    durationMs: null,
    label: report.runLabel || report.selectedProjectId || report.projectId || "",
    sourceSummary: report.baseUrl || "",
  };
}

function flattenPlaywrightTests(suites) {
  const out = [];
  if (!Array.isArray(suites)) return out;
  for (const suite of suites) {
    if (Array.isArray(suite.specs)) out.push(...suite.specs);
    if (Array.isArray(suite.suites)) out.push(...flattenPlaywrightTests(suite.suites));
  }
  return out;
}

function classifyNativePlaywrightReport(report) {
  if (!report || !report.config || !report.stats) return null;
  const tests = flattenPlaywrightTests(report.suites || []);
  let passCount = 0;
  let failCount = 0;
  let partialCount = 0;

  for (const spec of tests) {
    const testEntries = Array.isArray(spec.tests) ? spec.tests : [];
    for (const test of testEntries) {
      const results = Array.isArray(test.results) ? test.results : [];
      if (results.some((r) => normalizeStatus(r.status) === "fail")) {
        failCount += 1;
      } else if (test.status === "expected" || results.some((r) => normalizeStatus(r.status) === "pass")) {
        passCount += 1;
      } else if (results.some((r) => normalizeStatus(r.status) === "partial")) {
        partialCount += 1;
      } else {
        partialCount += 1;
      }
    }
  }

  const expected = Number(report.stats.expected || 0);
  const fallbackTotal = expected || passCount + failCount + partialCount || 1;
  const finalStatus = failCount > 0 ? "FAIL" : "PASS";

  return {
    kind: "native-playwright",
    status: finalStatus,
    passCount,
    partialCount,
    failCount: failCount + Number(report.stats.unexpected || 0),
    total: fallbackTotal,
    startedAt: report.stats.startTime || null,
    durationMs: Number(report.stats.duration || 0),
    label: report.config.configFile ? path.basename(report.config.configFile) : "playwright",
    sourceSummary: report.config.rootDir || "",
  };
}

function toRelativePath(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).split(path.sep).join("/");
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pickToolName(filePath) {
  const lower = filePath.toLowerCase();
  const match = lower.match(/output\/playwright\/([^/]+)-workflow\/runs/);
  if (match) return match[1];
  if (lower.includes("frontend/playwright-report")) return "frontend-suite";
  return "unknown";
}

function buildHtml(summary, reports) {
  const rows = reports
    .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")))
    .map((r) => {
      const statusClass =
        r.status === "PASS" ? "status-pass" : r.status === "PARTIAL" ? "status-partial" : "status-fail";
      return `<tr>
  <td>${htmlEscape(r.tool)}</td>
  <td><span class="pill ${statusClass}">${htmlEscape(r.status)}</span></td>
  <td>${htmlEscape(r.kind)}</td>
  <td>${r.passCount}/${r.total}</td>
  <td>${r.partialCount}</td>
  <td>${r.failCount}</td>
  <td>${htmlEscape(r.startedAt || "-")}</td>
      <td><a href="${htmlEscape(r.linkPath)}" target="_blank" rel="noreferrer">open report</a></td>
</tr>`;
    })
    .join("\n");

  const bannerClass =
    summary.overall === "PASS" ? "banner-pass" : summary.overall === "PARTIAL" ? "banner-partial" : "banner-fail";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Playwright Dashboard</title>
  <style>
    :root { --bg:#0b1020; --panel:#121a33; --text:#f3f6ff; --muted:#9aa6c8; --green:#14b86a; --amber:#ffb020; --red:#ff4d4f; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: linear-gradient(180deg,#070c19,#0f1530); color:var(--text); }
    .wrap { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .banner { border-radius: 14px; padding: 20px 22px; font-size: 32px; font-weight: 800; letter-spacing: 0.4px; margin-bottom: 18px; }
    .banner-pass { background: rgba(20,184,106,0.18); border: 2px solid var(--green); color: #7dffbe; }
    .banner-partial { background: rgba(255,176,32,0.18); border: 2px solid var(--amber); color: #ffd889; }
    .banner-fail { background: rgba(255,77,79,0.2); border: 2px solid var(--red); color: #ffc2c2; }
    .grid { display:grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; margin-bottom: 16px; }
    .card { background: var(--panel); border: 1px solid #243056; border-radius: 12px; padding: 14px; }
    .k { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; }
    .v { font-size: 28px; font-weight: 800; margin-top: 4px; }
    table { width:100%; border-collapse: collapse; background: var(--panel); border: 1px solid #243056; border-radius: 12px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #202a4c; text-align: left; font-size: 13px; }
    th { color: #c7d2f2; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
    tr:hover td { background: rgba(255,255,255,.02); }
    .pill { display:inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .status-pass { background: rgba(20,184,106,.2); color:#8cffc2; border:1px solid rgba(20,184,106,.5); }
    .status-partial { background: rgba(255,176,32,.2); color:#ffd889; border:1px solid rgba(255,176,32,.5); }
    .status-fail { background: rgba(255,77,79,.2); color:#ffc2c2; border:1px solid rgba(255,77,79,.55); }
    a { color:#8db3ff; text-decoration:none; } a:hover { text-decoration:underline; }
    .ts { color: var(--muted); font-size: 12px; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="banner ${bannerClass}">OVERALL: ${summary.overall}</div>
    <div class="grid">
      <div class="card"><div class="k">Reports Scanned</div><div class="v">${summary.reportCount}</div></div>
      <div class="card"><div class="k">Passing Reports</div><div class="v">${summary.passReports}</div></div>
      <div class="card"><div class="k">Partial Reports</div><div class="v">${summary.partialReports}</div></div>
      <div class="card"><div class="k">Failing Reports</div><div class="v">${summary.failReports}</div></div>
    </div>
    <table>
      <thead>
        <tr><th>Tool</th><th>Status</th><th>Type</th><th>Pass</th><th>Partial</th><th>Fail</th><th>Started</th><th>Report</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="ts">Generated at ${htmlEscape(summary.generatedAt)}</div>
  </div>
</body>
</html>`;
}

function reportTime(report) {
  const t = Date.parse(report.startedAt || "");
  if (!Number.isNaN(t)) return t;
  const fallback = Date.parse(report.discoveredAt || "");
  if (!Number.isNaN(fallback)) return fallback;
  return 0;
}

function selectLatestPerTool(reports) {
  const byKey = new Map();
  for (const report of reports) {
    const key = `${report.tool}:${report.kind}`;
    const current = byKey.get(key);
    if (!current || reportTime(report) > reportTime(current)) {
      byKey.set(key, report);
    }
  }
  return [...byKey.values()];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const outDir = path.join(cwd, "output", "playwright", "dashboard");
  const candidates = walkFiles(cwd).filter((f) => /report\.json$/i.test(f) && f.includes("playwright"));
  const reports = [];

  for (const filePath of candidates) {
    const data = safeReadJson(filePath);
    if (!data) continue;
    const parsed = classifyNativePlaywrightReport(data) || classifyWorkflowReport(data);
    if (!parsed) continue;
    reports.push({
      ...parsed,
      tool: pickToolName(filePath),
      path: toRelativePath(cwd, filePath),
      linkPath: toRelativePath(outDir, filePath),
      discoveredAt: new Date(fs.statSync(filePath).mtimeMs).toISOString(),
    });
  }

  const reportSet = args.all === "true" ? reports : selectLatestPerTool(reports);
  const reportCount = reportSet.length;
  const failReports = reportSet.filter((r) => r.status === "FAIL").length;
  const partialReports = reportSet.filter((r) => r.status === "PARTIAL").length;
  const passReports = reportSet.filter((r) => r.status === "PASS").length;
  const overall = failReports > 0 ? "FAIL" : partialReports > 0 ? "PARTIAL" : "PASS";

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: args.all === "true" ? "all-reports" : "latest-per-tool",
    overall,
    reportCount,
    passReports,
    partialReports,
    failReports,
  };

  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "dashboard-data.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, reports: reportSet }, null, 2));

  const htmlPath = path.join(outDir, "index.html");
  fs.writeFileSync(htmlPath, buildHtml(summary, reportSet), "utf8");

  console.log(
    JSON.stringify(
      {
        summary,
        htmlPath,
        dataPath: jsonPath,
      },
      null,
      2,
    ),
  );
}

main();
