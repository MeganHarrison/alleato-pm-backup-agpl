#!/usr/bin/env node

/**
 * Validates critical runtime configuration.
 * Fails fast before deploy/startup if required env vars are missing or malformed.
 */

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const OPTIONAL_URLS = [
  "BACKEND_URL",
  "PYTHON_BACKEND_URL",
  "SUPABASE_URL",
];

const CANONICAL_SUPABASE_PROJECT_REF = "lgveqfnpkxvzbnnwuled";

function validateCanonicalSupabaseBinding() {
  const supabaseProjectMismatches = [];
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) {
    const rawValue = process.env[key];
    const value = rawValue?.trim();
    if (!value) {
      if (key === "NEXT_PUBLIC_SUPABASE_URL") {
        supabaseProjectMismatches.push(`${key} is missing`);
      }
      continue;
    }
    if (rawValue !== value) {
      supabaseProjectMismatches.push(
        `${key} contains leading or trailing hidden characters`,
      );
    }

    let actualProjectRef = null;
    try {
      const hostname = new URL(value).hostname;
      actualProjectRef = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1] ?? null;
    } catch {
      supabaseProjectMismatches.push(`${key} is not a valid URL`);
      continue;
    }

    if (actualProjectRef !== CANONICAL_SUPABASE_PROJECT_REF) {
      supabaseProjectMismatches.push(
        `${key} targets ${actualProjectRef ?? "an unrecognized Supabase host"}`,
      );
    }
  }

  for (const key of ["NEXT_PUBLIC_PROJ_REF", "PROJ_REF"]) {
    const value = process.env[key]?.trim();
    if (value && value !== CANONICAL_SUPABASE_PROJECT_REF) {
      supabaseProjectMismatches.push(`${key} targets ${value}`);
    }
  }

  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anonKey = rawAnonKey?.trim();
  if (!anonKey) {
    supabaseProjectMismatches.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
  } else {
    if (rawAnonKey !== anonKey) {
      supabaseProjectMismatches.push(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY contains leading or trailing hidden characters",
      );
    }
    let keyProjectRef = null;
    try {
      const [, encodedPayload] = anonKey.split(".");
      if (!encodedPayload) {
        throw new Error("missing JWT payload");
      }
      const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      );
      keyProjectRef = typeof payload.ref === "string" ? payload.ref : null;
    } catch {
      // The application currently requires the legacy anon JWT. If this moves
      // to a publishable-key format, the guard must gain a provider-backed
      // identity check before accepting that format.
    }

    if (keyProjectRef !== CANONICAL_SUPABASE_PROJECT_REF) {
      supabaseProjectMismatches.push(
        `NEXT_PUBLIC_SUPABASE_ANON_KEY targets ${
          keyProjectRef ?? "an unverifiable Supabase project"
        }`,
      );
    }
  }

  if (supabaseProjectMismatches.length > 0) {
    console.error(
      `Invalid production Supabase binding: expected project ${CANONICAL_SUPABASE_PROJECT_REF}; ` +
        `${supabaseProjectMismatches.join(", ")}. ` +
        "Align the deployment's main Supabase URL, key, and project-ref variables with the canonical Alleato PM project before rebuilding.",
    );
    return false;
  }

  return true;
}

if (process.argv.includes("--supabase-binding-only")) {
  const isProductionDeployment =
    process.env.ALLEATO_RUNTIME_ENV === "production" ||
    process.env.VERCEL_ENV === "production";
  if (!isProductionDeployment) {
    console.log("Canonical Supabase binding validation skipped outside production deployment.");
    process.exit(0);
  }
  if (!validateCanonicalSupabaseBinding()) {
    process.exit(1);
  }
  console.log("Canonical Supabase binding validation passed.");
  process.exit(0);
}

const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// Vars that are catastrophic when *declared but empty* — they pass a naive
// "is the key set?" check yet fail only at runtime on a narrow code path.
//
// ADMIN_API_KEY: the schedule PDF import (frontend route
// projects/[projectId]/scheduling/tasks/preview -> backend
// /api/scheduling/schedule-pdf/extract) requires this. It was once set to ""
// in every Vercel env AND missing from the Render backend, so render.yaml's
// `sync: false` declaration provided zero enforcement and the only symptom was
// a runtime-only 503 "ADMIN_API_KEY is not configured" on PDF upload.
//
// An *empty* value is always a misconfiguration: it means someone declared the
// var (so it looks set) but never gave it a value. We reject that in every
// environment. A *missing* value is only required at production runtime, where
// the feature must work — local dev / CI can legitimately leave it unset.
const NON_EMPTY_IF_DECLARED = ["ADMIN_API_KEY"];

const declaredButEmpty = NON_EMPTY_IF_DECLARED.filter(
  (key) => key in process.env && !process.env[key]?.trim(),
);
if (declaredButEmpty.length > 0) {
  console.error(
    `Env vars declared but empty (set a real value or remove the declaration): ${declaredButEmpty.join(", ")}`,
  );
  process.exit(1);
}

const malformed = [];
for (const key of OPTIONAL_URLS) {
  const value = process.env[key];
  if (!value) continue;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    malformed.push(`${key}=${value}`);
  }
}

if (malformed.length > 0) {
  console.error(`Malformed URL env vars: ${malformed.join(", ")}`);
  process.exit(1);
}

if (
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.SUPABASE_ANON_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.SUPABASE_ANON_KEY
) {
  console.error("Invalid config: service role key must not equal anon key.");
  process.exit(1);
}

const isProductionRuntime =
  process.env.ALLEATO_RUNTIME_ENV === "production" ||
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

if (isProductionRuntime) {
  const productionRequired = [
    "ADMIN_API_KEY",
    "RAG_SUPABASE_URL",
    "RAG_SUPABASE_SERVICE_ROLE_KEY",
  ].filter((key) => !process.env[key]?.trim());
  if (productionRequired.length > 0) {
    console.error(
      `Missing required production env vars: ${productionRequired.join(", ")}. ` +
        `These power runtime-only code paths (e.g. schedule PDF import and Outlook intake reads) and must be set in production.`,
    );
    process.exit(1);
  }

  const directDatabaseUrls = ["DATABASE_URL", "SUPABASE_DB_URL", "BOT_STATE_DATABASE_URL"]
    .map((key) => [key, process.env[key]])
    .filter(([, value]) => value?.trim())
    .filter(([, value]) => {
      try {
        const url = new URL(value);
        return /^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname);
      } catch {
        return false;
      }
    })
    .map(([key]) => key);

  if (directDatabaseUrls.length > 0) {
    console.error(
      `Invalid production database config: ${directDatabaseUrls.join(", ")} must use the Supabase pooler host, not the direct db.<project-ref>.supabase.co host.`,
    );
    process.exit(1);
  }

  if (!validateCanonicalSupabaseBinding()) {
    process.exit(1);
  }
}

console.log("Runtime config validation passed.");
