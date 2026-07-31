import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkCapabilities,
  dependencyProvisionPlans,
  linkWorkspace,
  machineEnvironment,
  packageCommand,
} from "../machine-capabilities.mjs";

function isolatedEnvironment(extra = {}) {
  return {
    CODEX_MACHINE_ENV_DISABLE_USER_LOOKUP: "1",
    CODEX_MACHINE_ENV_IGNORE_PROCESS: "1",
    ALLEATO_MACHINE_ENV_FILE: path.join(os.tmpdir(), "missing-alleato-machine.env"),
    ALLEATO_SUPABASE_PROJECT_REF: "lgveqfnpkxvzbnnwuled",
    ALLEATO_VERCEL_TEAM: "the-alleato-group",
    ALLEATO_VERCEL_PROJECT: "project-management-agent",
    ...extra,
  };
}

test("normalizes the management-token alias without exposing values", () => {
  const env = machineEnvironment(
    isolatedEnvironment({ SUPABASE_MANAGEMENT_API_TOKEN: "test-token" }),
  );
  assert.equal(env.SUPABASE_ACCESS_TOKEN, "test-token");
  assert.equal(env.ALLEATO_SUPABASE_PROJECT_REF, "lgveqfnpkxvzbnnwuled");
});

test("core checks are local and do not require provider network access", async () => {
  const result = await checkCapabilities({ profile: "core", env: isolatedEnvironment() });
  assert.deepEqual(result.profiles, ["core"]);
  assert.deepEqual(result.remoteChecked, []);
  assert.equal(result.cached, true);
});

test("render checks fail loudly before network access when the credential is absent", async () => {
  await assert.rejects(
    checkCapabilities({ profile: "render", env: isolatedEnvironment() }),
    /RENDER_API_KEY or RENDER_TOKEN/,
  );
});

test("render checks prove access to the canonical backend without caching secrets", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "machine-render-test-"));
  const cache = path.join(root, "cache.json");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, "https://api.render.com/v1/services?limit=100");
    return new Response(
      JSON.stringify([{ service: { name: "alleato-backend" } }]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const result = await checkCapabilities({
      profile: "render",
      fresh: true,
      env: isolatedEnvironment({
        RENDER_API_KEY: "render-machine-token",
        CODEX_MACHINE_CAPABILITY_CACHE: cache,
      }),
    });
    assert.deepEqual(result.remoteChecked, ["render"]);
    assert.doesNotMatch(fs.readFileSync(cache, "utf8"), /render-machine-token/);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("AI readiness requires both provider paths and drawing OCR", async () => {
  await assert.rejects(
    checkCapabilities({
      profile: "ai",
      env: isolatedEnvironment({
        AI_GATEWAY_API_KEY: "gateway-token",
        OPENAI_API_KEY: "openai-token",
      }),
    }),
    /AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT.*AZURE_DOCUMENT_INTELLIGENCE_KEY/,
  );
  const originalFetch = globalThis.fetch;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "machine-ai-test-"));
  globalThis.fetch = async () =>
    new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    const result = await checkCapabilities({
      profile: "ai",
      fresh: true,
      env: isolatedEnvironment({
        AI_GATEWAY_API_KEY: "gateway-token",
        OPENAI_API_KEY: "openai-token",
        AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "https://example.cognitiveservices.azure.com",
        AZURE_DOCUMENT_INTELLIGENCE_KEY: "azure-token",
        CODEX_MACHINE_CAPABILITY_CACHE: path.join(root, "cache.json"),
      }),
    });
    assert.deepEqual(result.profiles, ["ai", "core"]);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Windows package managers use concrete JavaScript entrypoints", () => {
  const invocation = packageCommand("pnpm", ["--version"]);
  if (process.platform === "win32") {
    assert.equal(invocation.command, process.execPath);
    assert.match(invocation.args[0], /pnpm(?:\.cjs|\.js)$/i);
  } else {
    assert.deepEqual(invocation, { command: "pnpm", args: ["--version"] });
  }
});

test("database checks verify production visibility and reuse the machine cache", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "machine-capability-test-"));
  const cache = path.join(root, "cache.json");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify([{ id: "lgveqfnpkxvzbnnwuled" }]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const env = isolatedEnvironment({
      SUPABASE_ACCESS_TOKEN: "machine-token",
      CODEX_MACHINE_CAPABILITY_CACHE: cache,
    });
    const first = await checkCapabilities({ profile: "database", fresh: true, env });
    const second = await checkCapabilities({ profile: "database", env });
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(calls, 1);
    assert.doesNotMatch(fs.readFileSync(cache, "utf8"), /machine-token/);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("provider cache is scoped to target identity and credential fingerprint", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "machine-capability-target-test-"));
  const cache = path.join(root, "cache.json");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify([{ id: "project-a" }, { id: "project-b" }]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const base = isolatedEnvironment({
      SUPABASE_ACCESS_TOKEN: "machine-token-a",
      CODEX_MACHINE_CAPABILITY_CACHE: cache,
      ALLEATO_SUPABASE_PROJECT_REF: "project-a",
    });
    await checkCapabilities({ profile: "database", env: base });
    await checkCapabilities({
      profile: "database",
      env: { ...base, ALLEATO_SUPABASE_PROJECT_REF: "project-b" },
    });
    await checkCapabilities({
      profile: "database",
      env: { ...base, SUPABASE_ACCESS_TOKEN: "machine-token-b" },
    });
    assert.equal(calls, 3);
    const written = fs.readFileSync(cache, "utf8");
    assert.doesNotMatch(written, /machine-token-[ab]/);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("workspace linkage writes only the non-secret Supabase project reference", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "machine-link-test-"));
  fs.mkdirSync(path.join(root, "supabase"), { recursive: true });
  fs.mkdirSync(path.join(root, "frontend"), { recursive: true });
  fs.writeFileSync(path.join(root, "supabase", "config.toml"), 'project_id = "fixture"\n');
  const sharedEnvironment = path.join(root, "machine.env");
  fs.writeFileSync(sharedEnvironment, "DATABASE_URL=machine-secret\n");
  try {
    const result = linkWorkspace(
      root,
      isolatedEnvironment({
        ALLEATO_MACHINE_ENV_FILE: sharedEnvironment,
        SUPABASE_ACCESS_TOKEN: "must-not-be-written",
      }),
      ["core", "database", "vercel", "browser", "full"],
    );
    assert.equal(result.linked, true);
    const linked = fs.readFileSync(path.join(root, "supabase", ".temp", "project-ref"), "utf8");
    assert.equal(linked.trim(), "lgveqfnpkxvzbnnwuled");
    assert.doesNotMatch(linked, /must-not-be-written/);
    assert.equal(
      fs.readFileSync(path.join(root, "frontend", ".env.local"), "utf8"),
      "DATABASE_URL=machine-secret\n",
    );
    assert.equal(fs.statSync(path.join(root, "frontend", ".env.local")).nlink, 1);
    if (process.platform !== "win32") {
      assert.equal(
        fs.statSync(path.join(root, "frontend", ".env.local")).mode & 0o777,
        0o400,
      );
    }
    const vercel = JSON.parse(
      fs.readFileSync(path.join(root, "frontend", ".vercel", "project.json"), "utf8"),
    );
    assert.equal(vercel.projectName, "project-management-agent");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("database-only linkage does not materialize frontend runtime secrets", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "machine-db-link-test-"));
  fs.mkdirSync(path.join(root, "supabase"), { recursive: true });
  fs.mkdirSync(path.join(root, "frontend"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "supabase", "config.toml"),
    'project_id = "fixture"\n',
  );
  const sharedEnvironment = path.join(root, "machine.env");
  fs.writeFileSync(sharedEnvironment, "DATABASE_URL=machine-secret\n");
  try {
    const result = linkWorkspace(
      root,
      isolatedEnvironment({
        ALLEATO_MACHINE_ENV_FILE: sharedEnvironment,
      }),
      ["core", "database"],
    );
    assert.equal(result.linked, true);
    assert.equal(result.environmentLink, "not-applicable");
    assert.equal(
      fs.existsSync(path.join(root, "frontend", ".env.local")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(root, "frontend", ".vercel", "project.json")),
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("dependency provisioning is scoped to the requested runtime profile", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "machine-dependency-test-"));
  const frontend = path.join(root, "frontend");
  fs.mkdirSync(frontend, { recursive: true });
  for (const directory of [root, frontend]) {
    fs.writeFileSync(path.join(directory, "package.json"), "{}\n");
    fs.writeFileSync(
      path.join(directory, "pnpm-lock.yaml"),
      "lockfileVersion: '9.0'\n",
    );
  }
  try {
    assert.deepEqual(dependencyProvisionPlans(root, ["core"]), []);
    assert.deepEqual(
      dependencyProvisionPlans(root, ["database"]).map(
        (plan) => plan.directory,
      ),
      [root],
    );
    assert.deepEqual(
      dependencyProvisionPlans(root, ["browser"]).map(
        (plan) => plan.directory,
      ),
      [frontend],
    );
    assert.deepEqual(
      dependencyProvisionPlans(root, ["full"]).map((plan) => plan.directory),
      [root, frontend],
    );
    fs.mkdirSync(path.join(root, "node_modules", ".bin"), { recursive: true });
    fs.mkdirSync(path.join(frontend, "node_modules", ".bin"), {
      recursive: true,
    });
    fs.writeFileSync(path.join(root, "node_modules", ".bin", "tsx.cmd"), "");
    fs.writeFileSync(
      path.join(frontend, "node_modules", ".bin", "next.cmd"),
      "",
    );
    assert.deepEqual(
      dependencyProvisionPlans(root, ["browser"]).map(
        (plan) => plan.directory,
      ),
      [frontend],
    );
    fs.writeFileSync(
      path.join(frontend, "node_modules", ".bin", "playwright.cmd"),
      "",
    );
    assert.deepEqual(dependencyProvisionPlans(root, ["full"]), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
