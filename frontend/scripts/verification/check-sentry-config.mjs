const requiredSourceMapVars = [
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_AUTH_TOKEN",
];

const allowMissingDsn = process.argv.includes("--allow-missing-dsn");

const dsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  process.env.SENTRY_DSN ||
  process.env.SENTRY_BACKEND_DSN;

if (!dsn) {
  if (allowMissingDsn) {
    console.log("[sentry] No DSN is configured; skipping optional Sentry verification.");
    process.exit(0);
  }

  console.error(
    "[sentry] No DSN is configured. Browser/server errors will not be reported.",
  );
  process.exit(1);
}

const missingSourceMapVars = requiredSourceMapVars.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingSourceMapVars.length > 0) {
  console.error(
    `[sentry] DSN is configured, but production source maps cannot upload. Missing: ${missingSourceMapVars.join(", ")}.`,
  );
  process.exit(1);
}

console.log("[sentry] DSN and source-map upload env are configured.");
