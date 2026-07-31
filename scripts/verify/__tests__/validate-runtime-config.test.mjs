import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const validatorPath = fileURLToPath(
  new URL("../../validate-runtime-config.mjs", import.meta.url),
);
const canonicalProjectRef = "lgveqfnpkxvzbnnwuled";

function makeSupabaseAnonKey(projectRef) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({ ref: projectRef, role: "anon" }),
  ).toString("base64url");
  return `${header}.${payload}.test-signature`;
}

function runValidator(overrides = {}, args = []) {
  return spawnSync(process.execPath, [validatorPath, ...args], {
    encoding: "utf8",
    env: {
      ADMIN_API_KEY: "test-admin-key",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: makeSupabaseAnonKey(canonicalProjectRef),
      NEXT_PUBLIC_SUPABASE_URL: `https://${canonicalProjectRef}.supabase.co`,
      RAG_SUPABASE_SERVICE_ROLE_KEY: "test-rag-service-key",
      RAG_SUPABASE_URL: "https://nrcsbmggcdtothvqnifr.supabase.co",
      VERCEL_ENV: "production",
      ...overrides,
    },
  });
}

test("accepts the canonical Alleato PM Supabase project in production", () => {
  const result = runValidator({
    NEXT_PUBLIC_PROJ_REF: canonicalProjectRef,
    PROJ_REF: canonicalProjectRef,
    SUPABASE_URL: `https://${canonicalProjectRef}.supabase.co`,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Runtime config validation passed/);
});

test("fails loudly when a production deployment targets a stale Supabase project", () => {
  const staleProjectRef = "lnnalnbmftuhiokyogsu";
  const result = runValidator({
    NEXT_PUBLIC_PROJ_REF: staleProjectRef,
    NEXT_PUBLIC_SUPABASE_URL: `https://${staleProjectRef}.supabase.co`,
    PROJ_REF: staleProjectRef,
    SUPABASE_URL: `https://${staleProjectRef}.supabase.co`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid production Supabase binding/);
  assert.match(result.stderr, new RegExp(canonicalProjectRef));
  assert.match(result.stderr, new RegExp(staleProjectRef));
  assert.match(result.stderr, /Align the deployment's main Supabase URL, key, and project-ref variables/);
});

test("fails loudly when the anon key belongs to another Supabase project", () => {
  const staleProjectRef = "lnnalnbmftuhiokyogsu";
  const result = runValidator({
    NEXT_PUBLIC_SUPABASE_ANON_KEY: makeSupabaseAnonKey(staleProjectRef),
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEXT_PUBLIC_SUPABASE_ANON_KEY targets/);
  assert.match(result.stderr, new RegExp(staleProjectRef));
  assert.doesNotMatch(result.stderr, new RegExp(makeSupabaseAnonKey(staleProjectRef)));
});

test("cannot redefine the canonical project through deployment environment", () => {
  const staleProjectRef = "lnnalnbmftuhiokyogsu";
  const result = runValidator(
    {
      ALLEATO_SUPABASE_PROJECT_REF: staleProjectRef,
      NEXT_PUBLIC_PROJ_REF: staleProjectRef,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: makeSupabaseAnonKey(staleProjectRef),
      NEXT_PUBLIC_SUPABASE_URL: `https://${staleProjectRef}.supabase.co`,
      PROJ_REF: staleProjectRef,
      SUPABASE_URL: `https://${staleProjectRef}.supabase.co`,
    },
    ["--supabase-binding-only"],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(canonicalProjectRef));
  assert.match(result.stderr, new RegExp(staleProjectRef));
});

test("rejects byte-order marks or whitespace hidden in Supabase env values", () => {
  const result = runValidator({
    NEXT_PUBLIC_SUPABASE_ANON_KEY: `\uFEFF${makeSupabaseAnonKey(canonicalProjectRef)}`,
    NEXT_PUBLIC_SUPABASE_URL: `\uFEFFhttps://${canonicalProjectRef}.supabase.co`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contains leading or trailing hidden characters/);
});

test("the prebuild binding-only gate ignores unrelated runtime debt", () => {
  const result = runValidator(
    {
      ADMIN_API_KEY: "",
      DATABASE_URL:
        "postgresql://postgres:secret@db.lgveqfnpkxvzbnnwuled.supabase.co:5432/postgres",
    },
    ["--supabase-binding-only"],
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Canonical Supabase binding validation passed/);
});

test("the prebuild binding-only gate does not require Vercel env during local builds", () => {
  const result = runValidator(
    {
      NEXT_PUBLIC_SUPABASE_URL: "",
      VERCEL_ENV: "",
    },
    ["--supabase-binding-only"],
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /validation skipped outside production deployment/);
});

test("the Vercel production build command invokes the binding guardrail", () => {
  const packageJsonPath = fileURLToPath(
    new URL("../../../frontend/package.json", import.meta.url),
  );
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.match(
    packageJson.scripts["build:production"],
    /^node \.\.\/scripts\/validate-runtime-config\.mjs --supabase-binding-only && /,
  );
});
