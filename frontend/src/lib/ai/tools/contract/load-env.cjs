/**
 * Jest setupFiles entry for AI tool contract tests.
 *
 * Runs BEFORE the test module (and therefore before `createServiceClient` and
 * the AI tool factory) is imported, so SUPABASE_* / TEST_USER_* env vars from
 * frontend/.env.local are present in process.env when the service client is
 * constructed. Default unit tests do NOT use this file — they mock the client.
 */
const path = require("node:path");
const fs = require("node:fs");

const envPath = path.resolve(__dirname, "../../../../../.env.local");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}
