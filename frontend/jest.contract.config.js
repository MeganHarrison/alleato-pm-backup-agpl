/**
 * Jest config for AI tool CONTRACT tests (live DB write + read-back).
 *
 * Separate from jest.config.js (the hermetic unit suite) so these never run in
 * `npm run test:unit` / CI without a service-role key. Run explicitly with
 * `npm run ai:contract` (all tools) or `npm run ai:contract -- -t createTask`.
 */
const base = require("./jest.config.js");

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  // ORDER MATTERS: Jest moduleNameMapper is first-match-wins. Specific stubs
  // MUST precede the base `^@/(.*)$` catch-all or they never fire.
  moduleNameMapper: {
    // `server-only` is a bundler guard that throws on import outside an RSC
    // build. Irrelevant in a node test runner — stub it so the real tool graph
    // (which imports Microsoft Graph helpers marked server-only) can load.
    "^server-only$": "<rootDir>/src/lib/ai/tools/contract/empty-module.cjs",
    // Send/notify chains (Teams bot ESM, Graph send, notifications) are not part
    // of a DB write+read-back contract. External tools run preview-only here.
    "^@/services/notificationService$":
      "<rootDir>/src/lib/ai/tools/contract/noop-proxy.cjs",
    ...base.moduleNameMapper,
  },
  setupFilesAfterEnv: [],
  setupFiles: ["<rootDir>/src/lib/ai/tools/contract/load-env.cjs"],
  testMatch: ["**/contract/**/*.contract.test.ts"],
  // Live DB round-trips — give each tool room.
  testTimeout: 60000,
  // These are integration probes, not coverage drivers.
  collectCoverage: false,
  coverageThreshold: undefined,
};
