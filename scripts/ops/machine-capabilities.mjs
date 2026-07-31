#!/usr/bin/env node

import fs from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULTS = {
  supabaseProjectRef: "lgveqfnpkxvzbnnwuled",
  vercelTeam: "the-alleato-group",
  vercelProject: "project-management-agent",
  vercelProjectId: "prj_OBcz68Ow6KmEcPMwknxfa6NHM6uZ",
  vercelOrgId: "team_KXDgilmKdWqFZsRC5NRAI0Ux",
  cacheTtlMs: 6 * 60 * 60 * 1000,
};

const MACHINE_ENV_KEYS = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_MANAGEMENT_API_TOKEN",
  "ALLEATO_SUPABASE_PROJECT_REF",
  "ALLEATO_VERCEL_TEAM",
  "ALLEATO_VERCEL_PROJECT",
  "ALLEATO_VERCEL_PROJECT_ID",
  "ALLEATO_VERCEL_ORG_ID",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "RENDER_API_KEY",
  "RENDER_TOKEN",
  "AI_GATEWAY_API_KEY",
  "OPENAI_API_KEY",
  "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT",
  "AZURE_DOCUMENT_INTELLIGENCE_KEY",
  "LINEAR_API_KEY",
  "SENTRY_AUTH_TOKEN",
  "NEXT_PUBLIC_POSTHOG_KEY",
];

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const [command = "check", ...rest] = argv;
  const options = { command, profile: "core", fresh: false, workspace: "" };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--") {
      options.child = rest.slice(index + 1);
      break;
    }
    if (token === "--fresh") {
      options.fresh = true;
      continue;
    }
    if (token === "--profile" || token === "--workspace") {
      options[token.slice(2)] = rest[++index] ?? "";
      continue;
    }
    fail(`Unknown argument '${token}'.`);
  }
  return options;
}

function windowsUserEnvironmentValue(name) {
  if (process.platform !== "win32") return "";
  const result = spawnSync(
    "reg.exe",
    ["query", "HKCU\\Environment", "/v", name],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) return "";
  const line = String(result.stdout)
    .split(/\r?\n/)
    .find((candidate) => candidate.trimStart().startsWith(name));
  return line?.match(/\s+REG_\w+\s+(.*)$/)?.[1]?.trim() ?? "";
}

export function machineEnvironment(overrides = {}) {
  const ignoreProcess =
    overrides.CODEX_MACHINE_ENV_IGNORE_PROCESS === "1" ||
    process.env.CODEX_MACHINE_ENV_IGNORE_PROCESS === "1";
  const isolatedProcess = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key.startsWith("CODEX_") || key.startsWith("ALLEATO_"),
    ),
  );
  const initial = {
    ...(ignoreProcess ? isolatedProcess : process.env),
    ...overrides,
  };
  const sharedFile = path.resolve(
    initial.ALLEATO_MACHINE_ENV_FILE ||
      path.join(os.homedir(), ".codex", "capabilities", "alleato-project-management.env"),
  );
  const shared = {};
  if (fs.existsSync(sharedFile)) {
    for (const rawLine of fs.readFileSync(sharedFile, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key) shared[key] = value;
    }
  }
  const env = { ...shared, ...initial, ALLEATO_MACHINE_ENV_FILE: sharedFile };
  for (const key of MACHINE_ENV_KEYS) {
    if (!env[key] && env.CODEX_MACHINE_ENV_DISABLE_USER_LOOKUP !== "1") {
      env[key] = windowsUserEnvironmentValue(key);
    }
  }
  env.ALLEATO_SUPABASE_PROJECT_REF ||= DEFAULTS.supabaseProjectRef;
  env.ALLEATO_VERCEL_TEAM ||= DEFAULTS.vercelTeam;
  env.ALLEATO_VERCEL_PROJECT ||= DEFAULTS.vercelProject;
  env.ALLEATO_VERCEL_PROJECT_ID ||= DEFAULTS.vercelProjectId;
  env.ALLEATO_VERCEL_ORG_ID ||= DEFAULTS.vercelOrgId;
  if (!env.SUPABASE_ACCESS_TOKEN && env.SUPABASE_MANAGEMENT_API_TOKEN) {
    env.SUPABASE_ACCESS_TOKEN = env.SUPABASE_MANAGEMENT_API_TOKEN;
  }
  if (!env.SUPABASE_MANAGEMENT_API_TOKEN && env.SUPABASE_ACCESS_TOKEN) {
    env.SUPABASE_MANAGEMENT_API_TOKEN = env.SUPABASE_ACCESS_TOKEN;
  }
  if (!env.GITHUB_TOKEN && env.GH_TOKEN) env.GITHUB_TOKEN = env.GH_TOKEN;
  if (!env.GH_TOKEN && env.GITHUB_TOKEN) env.GH_TOKEN = env.GITHUB_TOKEN;
  if (!env.RENDER_API_KEY && env.RENDER_TOKEN) {
    env.RENDER_API_KEY = env.RENDER_TOKEN;
  }
  if (!env.RENDER_TOKEN && env.RENDER_API_KEY) {
    env.RENDER_TOKEN = env.RENDER_API_KEY;
  }
  return env;
}

function normalizeProfiles(raw) {
  const requested = String(raw || "core")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const valid = new Set([
    "core",
    "database",
    "vercel",
    "browser",
    "github",
    "render",
    "ai",
    "integrations",
    "full",
  ]);
  for (const profile of requested) {
    if (!valid.has(profile)) fail(`Unknown capability profile '${profile}'.`);
  }
  const expanded = new Set(["core"]);
  for (const profile of requested) {
    expanded.add(profile);
    if (profile === "browser") expanded.add("vercel");
    if (profile === "full") {
      expanded.add("database");
      expanded.add("vercel");
      expanded.add("browser");
      expanded.add("github");
      expanded.add("render");
      expanded.add("ai");
      expanded.add("integrations");
    }
  }
  return [...expanded].sort();
}

function assertLocalCapabilities(env, profiles) {
  const missing = [];
  if (
    env.CODEX_MACHINE_ENV_DISABLE_USER_LOOKUP !== "1" &&
    !fs.existsSync(env.ALLEATO_MACHINE_ENV_FILE)
  ) {
    missing.push(`shared machine environment (${env.ALLEATO_MACHINE_ENV_FILE})`);
  }
  if (!env.ALLEATO_SUPABASE_PROJECT_REF) missing.push("ALLEATO_SUPABASE_PROJECT_REF");
  if (!env.ALLEATO_VERCEL_TEAM) missing.push("ALLEATO_VERCEL_TEAM");
  if (!env.ALLEATO_VERCEL_PROJECT) missing.push("ALLEATO_VERCEL_PROJECT");
  if (
    profiles.includes("database") &&
    !env.SUPABASE_ACCESS_TOKEN &&
    !env.DATABASE_URL
  ) {
    missing.push("SUPABASE_ACCESS_TOKEN or DATABASE_URL");
  }
  if (profiles.includes("browser")) {
    if (!env.NEXT_PUBLIC_SUPABASE_URL) {
      missing.push("NEXT_PUBLIC_SUPABASE_URL");
    }
    if (
      !env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
    ) {
      missing.push(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
      );
    }
  }
  if (profiles.includes("github") && !env.GITHUB_TOKEN && !env.GH_TOKEN) {
    missing.push("GITHUB_TOKEN or GH_TOKEN");
  }
  if (profiles.includes("render") && !env.RENDER_API_KEY && !env.RENDER_TOKEN) {
    missing.push("RENDER_API_KEY or RENDER_TOKEN");
  }
  if (profiles.includes("ai")) {
    for (const key of [
      "AI_GATEWAY_API_KEY",
      "OPENAI_API_KEY",
      "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT",
      "AZURE_DOCUMENT_INTELLIGENCE_KEY",
    ]) {
      if (!env[key]) missing.push(key);
    }
  }
  if (profiles.includes("integrations")) {
    for (const key of [
      "LINEAR_API_KEY",
      "NEXT_PUBLIC_POSTHOG_KEY",
      "SLACK_WEBHOOK_URL",
      "FIREFLIES_API_KEY",
      "LANGFUSE_PUBLIC_KEY",
      "LANGFUSE_SECRET_KEY",
      "NOTION_API_KEY",
      "RESEND_API_KEY",
      "TEAMS_APP_ID",
      "TEAMS_APP_PASSWORD",
      "TEAMS_APP_TENANT_ID",
    ]) {
      if (!env[key]) missing.push(key);
    }
  }
  if (missing.length > 0) {
    fail(
      [
        `Machine capability unavailable: ${missing.join(", ")}.`,
        "Cause: required provider state is not configured for the current OS user.",
        "Prevention: configure it once at user scope; do not copy checkout-local .env files into worktrees.",
      ].join(" "),
    );
  }
}

function cachePath(env) {
  return path.resolve(
    env.CODEX_MACHINE_CAPABILITY_CACHE ||
      path.join(os.homedir(), ".codex", "capabilities", "alleato-project-management.json"),
  );
}

function readCache(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

async function verifySupabase(env) {
  if (env.SUPABASE_ACCESS_TOKEN) {
    const response = await fetch("https://api.supabase.com/v1/projects", {
      headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) {
      const projects = await response.json();
      if (
        Array.isArray(projects) &&
        projects.some((project) => project.id === env.ALLEATO_SUPABASE_PROJECT_REF)
      ) {
        return "management-api";
      }
    }
  }
  if (env.DATABASE_URL) {
    runChecked(
      "npx",
      ["supabase", "migration", "list", "--db-url", env.DATABASE_URL],
      { env, display: "npx supabase migration list --db-url [machine DATABASE_URL]" },
    );
    return "database-url";
  }
  fail(
    `Supabase machine capability failed: production project ${env.ALLEATO_SUPABASE_PROJECT_REF} is unavailable through both Management API and direct database access.`,
  );
}

export function packageCommand(command, args) {
  if (process.platform !== "win32") return { command, args };
  const normalized = command.toLowerCase();
  if (
    !["npx", "npm", "pnpm", "yarn", "agent-browser"].includes(normalized)
  ) {
    return { command, args };
  }
  if (normalized === "pnpm" || normalized === "yarn") {
    const packageCli =
      normalized === "pnpm"
        ? path.join("node_modules", "pnpm", "bin", "pnpm.cjs")
        : path.join("node_modules", "yarn", "bin", "yarn.js");
    const candidates = [
      process.env.APPDATA
        ? path.join(process.env.APPDATA, "npm", packageCli)
        : "",
      process.env.ProgramFiles
        ? path.join(
            process.env.ProgramFiles,
            "nodejs",
            "node_modules",
            "corepack",
            "dist",
            `${normalized}.js`,
          )
        : "",
    ].filter(Boolean);
    const cli = candidates.find((candidate) => fs.existsSync(candidate));
    if (!cli) {
      fail(
        `Safe ${command} launcher is unavailable. Install ${command} for the current Windows user or repair Corepack.`,
      );
    }
    return { command: process.execPath, args: [cli, ...args] };
  }
  if (normalized === "agent-browser") {
    const cli = process.env.APPDATA
      ? path.join(
          process.env.APPDATA,
          "npm",
          "node_modules",
          "agent-browser",
          "bin",
          "agent-browser-win32-x64.exe",
        )
      : "";
    if (!cli || !fs.existsSync(cli)) {
      fail(
        "Safe agent-browser executable is unavailable. Reinstall agent-browser for the current Windows user.",
      );
    }
    return { command: cli, args };
  }
  const cli = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    normalized === "npx" ? "npx-cli.js" : "npm-cli.js",
  );
  if (!fs.existsSync(cli)) {
    fail(`Safe ${command} launcher is unavailable at ${cli}. Repair the machine Node.js/npm installation.`);
  }
  return { command: process.execPath, args: [cli, ...args] };
}

function runChecked(command, args, options = {}) {
  const executable = packageCommand(command, args);
  const result = spawnSync(executable.command, executable.args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    encoding: "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
    windowsHide: true,
    timeout: options.timeout,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    let detail = [result.stdout, result.stderr]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join("\n");
    for (const [key, value] of Object.entries(options.env || {})) {
      if (
        value?.length >= 8 &&
        /(TOKEN|PASSWORD|SECRET|DATABASE_URL|API_KEY)$/i.test(key)
      ) {
        detail = detail.replaceAll(value, `[redacted ${key}]`);
      }
    }
    fail(`${options.display || `${command} ${args.join(" ")}`} failed.${detail ? `\n${detail}` : ""}`);
  }
  return String(result.stdout || "").trim();
}

function executableExists(directory, name) {
  const bin = path.join(directory, "node_modules", ".bin");
  return (
    fs.existsSync(path.join(bin, name)) ||
    fs.existsSync(path.join(bin, `${name}.cmd`))
  );
}

export function dependencyProvisionPlans(workspace, profiles = ["core"]) {
  const plans = [
    ...(profiles.includes("database") || profiles.includes("full")
      ? [{ directory: workspace, executables: ["tsx"] }]
      : []),
    ...(profiles.includes("browser") || profiles.includes("full")
      ? [
          {
            directory: path.join(workspace, "frontend"),
            executables: ["next", "playwright"],
          },
        ]
      : []),
  ];
  return plans.filter(
    ({ directory, executables }) =>
      fs.existsSync(path.join(directory, "package.json")) &&
      fs.existsSync(path.join(directory, "pnpm-lock.yaml")) &&
      !executables.every((executable) => executableExists(directory, executable)),
  );
}

export function provisionWorkspaceDependencies(
  workspace,
  profiles = ["core"],
  overrides = {},
) {
  const env = machineEnvironment(overrides);
  for (const plan of dependencyProvisionPlans(workspace, profiles)) {
    runChecked(
      "pnpm",
      [
        "install",
        "--offline",
        "--frozen-lockfile",
        "--ignore-scripts",
        "--prod=false",
        "--reporter=silent",
      ],
      {
        cwd: plan.directory,
        env,
        display: `pnpm install in ${path.relative(workspace, plan.directory) || "workspace root"}`,
      },
    );
  }
  const remaining = dependencyProvisionPlans(workspace, profiles);
  if (remaining.length > 0) {
    fail(
      `Workspace dependency provisioning failed: ${remaining
        .map((plan) => path.relative(workspace, plan.directory) || "workspace root")
        .join(", ")} is still missing its locked executables.`,
    );
  }
}

function verifyVercel(env) {
  const who = runChecked("npx", ["vercel", "whoami"], {
    env,
    timeout: 30_000,
  });
  if (!who) fail("Vercel machine capability failed: CLI returned no authenticated user.");
  runChecked(
    "npx",
    ["vercel", "project", "inspect", env.ALLEATO_VERCEL_PROJECT, "--scope", env.ALLEATO_VERCEL_TEAM],
    { env, timeout: 30_000 },
  );
}

async function verifyGitHub(env) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const user = await fetch("https://api.github.com/user", {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!user.ok) {
    fail(`GitHub machine capability failed: authenticated user readback returned HTTP ${user.status}.`);
  }
  const repository = await fetch(
    "https://api.github.com/repos/The-Alleato-Group/project-management",
    { headers, signal: AbortSignal.timeout(20_000) },
  );
  if (!repository.ok) {
    fail(`GitHub machine capability failed: canonical repository readback returned HTTP ${repository.status}.`);
  }
  const payload = await repository.json();
  if (!payload?.permissions?.push) {
    fail("GitHub machine capability failed: the configured identity cannot push to the canonical repository.");
  }
}

async function verifyRender(env) {
  const response = await fetch("https://api.render.com/v1/services?limit=100", {
    headers: {
      Authorization: `Bearer ${env.RENDER_API_KEY || env.RENDER_TOKEN}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    fail(`Render machine capability failed: service readback returned HTTP ${response.status}.`);
  }
  const services = await response.json();
  const hasBackend =
    Array.isArray(services) &&
    services.some((entry) => entry?.service?.name === "alleato-backend");
  if (!hasBackend) {
    fail("Render machine capability failed: alleato-backend is not visible to the configured identity.");
  }
}

async function verifyAiProviders(env) {
  for (const [name, url, token] of [
    ["AI Gateway", "https://ai-gateway.vercel.sh/v1/models", env.AI_GATEWAY_API_KEY],
    ["OpenAI", "https://api.openai.com/v1/models", env.OPENAI_API_KEY],
  ]) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      fail(`${name} machine capability failed: authenticated model readback returned HTTP ${response.status}.`);
    }
  }
}

async function verifyIntegrations(env) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: env.LINEAR_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "query { viewer { id } }" }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    fail(`Linear machine capability failed: authenticated viewer readback returned HTTP ${response.status}.`);
  }
  const payload = await response.json();
  if (!payload?.data?.viewer?.id) {
    fail("Linear machine capability failed: authenticated viewer identity is unavailable.");
  }
}

function verifyBrowser() {
  runChecked("agent-browser", ["--version"], {
    display: "agent-browser --version",
  });
}

export async function checkCapabilities({
  profile = "core",
  fresh = false,
  env: overrides = {},
} = {}) {
  const env = machineEnvironment(overrides);
  const profiles = normalizeProfiles(profile);
  assertLocalCapabilities(env, profiles);
  if (profiles.includes("browser")) verifyBrowser();
  const remoteProfiles = profiles.filter((value) =>
    ["database", "vercel", "github", "render", "ai", "integrations"].includes(
      value,
    ),
  );
  if (remoteProfiles.length === 0) {
    return { profiles, cached: true, remoteChecked: [] };
  }

  const file = cachePath(env);
  const cache = readCache(file);
  const credentialFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        supabaseAccessToken: env.SUPABASE_ACCESS_TOKEN || "",
        databaseUrl: env.DATABASE_URL || "",
        githubToken: env.GITHUB_TOKEN || env.GH_TOKEN || "",
        renderToken: env.RENDER_API_KEY || env.RENDER_TOKEN || "",
        aiGatewayToken: env.AI_GATEWAY_API_KEY || "",
        openAiToken: env.OPENAI_API_KEY || "",
        linearToken: env.LINEAR_API_KEY || "",
      }),
    )
    .digest("hex")
    .slice(0, 16);
  const cacheKey = [
    remoteProfiles.join(","),
    env.ALLEATO_SUPABASE_PROJECT_REF,
    env.ALLEATO_VERCEL_TEAM,
    env.ALLEATO_VERCEL_PROJECT,
    credentialFingerprint,
  ].join("|");
  const cached = cache[cacheKey];
  if (!fresh && cached && Date.now() - Date.parse(cached.checkedAt) < DEFAULTS.cacheTtlMs) {
    if (remoteProfiles.includes("vercel")) verifyVercel(env);
    return { profiles, cached: true, remoteChecked: remoteProfiles };
  }

  let supabaseStrategy = "";
  if (remoteProfiles.includes("database")) supabaseStrategy = await verifySupabase(env);
  if (remoteProfiles.includes("vercel")) verifyVercel(env);
  await Promise.all([
    remoteProfiles.includes("github") ? verifyGitHub(env) : null,
    remoteProfiles.includes("render") ? verifyRender(env) : null,
    remoteProfiles.includes("ai") ? verifyAiProviders(env) : null,
    remoteProfiles.includes("integrations") ? verifyIntegrations(env) : null,
  ]);
  cache[cacheKey] = {
    checkedAt: new Date().toISOString(),
    supabaseProjectRef: env.ALLEATO_SUPABASE_PROJECT_REF,
    vercelTeam: env.ALLEATO_VERCEL_TEAM,
    vercelProject: env.ALLEATO_VERCEL_PROJECT,
    supabaseStrategy,
  };
  writeCache(file, cache);
  return { profiles, cached: false, remoteChecked: remoteProfiles };
}

export function linkWorkspace(
  workspace,
  overrides = {},
  profiles = ["core", "database", "vercel", "browser", "full"],
) {
  const env = machineEnvironment(overrides);
  const root = fs.realpathSync(workspace);
  const needsDatabase = profiles.includes("database") || profiles.includes("full");
  const needsVercel =
    profiles.includes("vercel") ||
    profiles.includes("browser") ||
    profiles.includes("full");
  const needsRuntimeEnvironment = profiles.some((profile) =>
    ["vercel", "browser", "github", "render", "ai", "integrations", "full"].includes(
      profile,
    ),
  );
  let supabaseLinked = false;
  if (
    needsDatabase &&
    fs.existsSync(path.join(root, "supabase", "config.toml"))
  ) {
    const projectRefPath = path.join(root, "supabase", ".temp", "project-ref");
    if (
      !fs.existsSync(projectRefPath) ||
      fs.readFileSync(projectRefPath, "utf8").trim() !== env.ALLEATO_SUPABASE_PROJECT_REF
    ) {
      fs.mkdirSync(path.dirname(projectRefPath), { recursive: true });
      fs.writeFileSync(projectRefPath, env.ALLEATO_SUPABASE_PROJECT_REF, { mode: 0o600 });
    }
    supabaseLinked = true;
  }

  let environmentLink = "not-applicable";
  const frontend = path.join(root, "frontend");
  if (
    needsRuntimeEnvironment &&
    fs.existsSync(frontend) &&
    fs.existsSync(env.ALLEATO_MACHINE_ENV_FILE)
  ) {
    const destination = path.join(frontend, ".env.local");
    if (fs.existsSync(destination)) {
      const current = fs.readFileSync(destination, "utf8");
      const shared = fs.readFileSync(env.ALLEATO_MACHINE_ENV_FILE, "utf8");
      if (current === shared) {
        const linkStat = fs.lstatSync(destination);
        if (linkStat.isSymbolicLink()) {
          environmentLink = "existing-shared";
        } else {
          fs.unlinkSync(destination);
        }
      } else {
        const currentKeys = current
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#") && line.includes("="))
          .map((line) => line.slice(0, line.indexOf("=")).trim());
        const replaceableVercelBootstrap = currentKeys.every((key) =>
          ["VERCEL_OIDC_TOKEN", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"].includes(key),
        );
        if (!replaceableVercelBootstrap) {
          fail(
            `Refusing to replace ${destination}: it is not the shared machine environment or a Vercel bootstrap-only file.`,
          );
        }
        fs.unlinkSync(destination);
      }
    }
    if (!fs.existsSync(destination)) {
      try {
        fs.symlinkSync(env.ALLEATO_MACHINE_ENV_FILE, destination, "file");
        environmentLink = "symbolic-link";
      } catch {
        fs.copyFileSync(env.ALLEATO_MACHINE_ENV_FILE, destination);
        fs.chmodSync(destination, 0o400);
        environmentLink = "read-only-materialization";
      }
    }

    if (needsVercel) {
      const vercelDir = path.join(frontend, ".vercel");
      fs.mkdirSync(vercelDir, { recursive: true });
      fs.writeFileSync(
        path.join(vercelDir, "project.json"),
        `${JSON.stringify({
          projectId: env.ALLEATO_VERCEL_PROJECT_ID,
          orgId: env.ALLEATO_VERCEL_ORG_ID,
          projectName: env.ALLEATO_VERCEL_PROJECT,
        })}\n`,
        { mode: 0o600 },
      );
    }
  }

  return {
    linked: supabaseLinked,
    environmentLink,
    supabaseProjectRef: supabaseLinked
      ? env.ALLEATO_SUPABASE_PROJECT_REF
      : null,
    vercelTeam: needsVercel ? env.ALLEATO_VERCEL_TEAM : null,
    vercelProject: needsVercel ? env.ALLEATO_VERCEL_PROJECT : null,
  };
}

function runChild(child, env) {
  if (!child?.length) fail("run requires a command after --.");
  const [command, ...args] = child;
  const executable = packageCommand(command, args);
  const result = spawnSync(executable.command, executable.args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "check") {
    const result = await checkCapabilities(options);
    console.log(
      `Machine capabilities ready: profiles=${result.profiles.join(",")} remote=${result.remoteChecked.join(",") || "not-needed"} cache=${result.cached ? "hit" : "refreshed"}`,
    );
    return;
  }
  if (options.command === "link") {
    if (!options.workspace) fail("link requires --workspace <path>.");
    const linked = linkWorkspace(
      options.workspace,
      {},
      normalizeProfiles(options.profile),
    );
    console.log(
      `Workspace provider linkage ready: supabase=${linked.linked ? linked.supabaseProjectRef : "not-applicable"} vercel=${linked.vercelTeam}/${linked.vercelProject} env=${linked.environmentLink}`,
    );
    return;
  }
  if (options.command === "run") {
    await checkCapabilities(options);
    process.exitCode = runChild(options.child, machineEnvironment());
    return;
  }
  fail(`Unknown command '${options.command}'.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[machine-capabilities] ${error.message}`);
    process.exitCode = 1;
  });
}
