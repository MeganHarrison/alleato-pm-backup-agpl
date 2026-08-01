/**
 * Build-memory guardrail: assert the production webpack config does not emit
 * source maps unless Sentry is actually configured to upload them.
 *
 * WHY THIS EXISTS
 * ---------------
 * `next.config.ts` declares `productionBrowserSourceMaps: false` and
 * `experimental.serverSourceMaps: false`. Those declarations do NOT win.
 * `@sentry/nextjs` (build/cjs/config/webpack.js) sets:
 *
 *     if (!userSentryOptions.sourcemaps?.disable) {
 *       if (!newConfig.devtool) {
 *         newConfig.devtool = isServer ? 'source-map' : 'hidden-source-map';
 *       }
 *     }
 *
 * — gated only on `sourcemaps.disable`, never on whether credentials exist.
 * Declaring the two Next options false is precisely what leaves `devtool`
 * falsy, which is the condition Sentry fills in. So the "off" switch was the
 * thing turning it on.
 *
 * Full source maps across ~1,339 app entrypoints are one of the largest heap
 * costs in a webpack production build, and with no SENTRY_AUTH_TOKEN they are
 * generated and immediately discarded.
 *
 * This probe loads the REAL exported config and runs its webpack hook exactly
 * as Next.js does, so it observes the resolved value rather than the declared
 * one. Run it after touching next.config.ts, the Sentry wrapper, or the
 * @sentry/nextjs version.
 *
 * Usage:  npx tsx scripts/build/probe-webpack-devtool.mts
 * Exit 0 = expected, exit 1 = a source-map regression is back.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = "production";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const configPath = path.join(frontendRoot, "next.config.ts");

const mod: Record<string, unknown> = await import(configPath);
const exported = mod.default;

// next.config may export either a plain object or a (phase, ctx) => config
// function. `withWorkflow` wraps it into the function form.
const resolved: Record<string, unknown> =
  typeof exported === "function"
    ? await (exported as (phase: string, ctx: unknown) => Promise<Record<string, unknown>>)(
        "phase-production-build",
        { defaultConfig: {} },
      )
    : (exported as Record<string, unknown>);

function baseWebpackConfig() {
  return {
    devtool: undefined as unknown,
    plugins: [] as unknown[],
    module: { rules: [] as unknown[] },
    resolve: { alias: {} as Record<string, unknown>, fallback: {} },
    entry: async () => ({}),
    output: {},
    optimization: {},
    ignoreWarnings: [] as unknown[],
  };
}

class FakeDefinePlugin {
  constructor(_definitions: unknown) {}
}

const sentryConfigured = Boolean(
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN,
);

// When Sentry can upload, source maps are the point and are expected.
// When it cannot, any devtool value is pure waste.
const expected = sentryConfigured
  ? { server: "source-map", client: "hidden-source-map" }
  : { server: false as const, client: false as const };

const webpackHook = resolved.webpack as
  | ((config: unknown, ctx: unknown) => Promise<Record<string, unknown>>)
  | undefined;

if (typeof webpackHook !== "function") {
  console.error("[probe] resolved next config has no webpack hook — cannot verify devtool.");
  process.exit(1);
}

console.log(`[probe] Sentry upload configured: ${sentryConfigured}`);
console.log(`[probe] declared productionBrowserSourceMaps: ${resolved.productionBrowserSourceMaps}`);

let failed = false;

for (const isServer of [true, false] as const) {
  const label = isServer ? "server" : "client";
  const out = await webpackHook(baseWebpackConfig(), {
    dev: false,
    isServer,
    buildId: "probe",
    dir: frontendRoot,
    config: resolved,
    totalPages: 1,
    defaultLoaders: { babel: {} },
    nextRuntime: isServer ? "nodejs" : undefined,
    webpack: { DefinePlugin: FakeDefinePlugin, version: "5.0.0" },
  });

  const actual = out.devtool ?? false;
  const want = expected[label];
  const ok = actual === want || (want === false && !actual);

  console.log(
    `[probe] ${label.padEnd(6)} devtool = ${JSON.stringify(actual)}  (expected ${JSON.stringify(want)})  ${ok ? "OK" : "FAIL"}`,
  );

  if (!ok) failed = true;
}

if (failed) {
  console.error(
    "\n[probe] FAIL: webpack is generating source maps that will not be uploaded.\n" +
      "        Check the `sourcemaps` option passed to withSentryConfig() in next.config.ts.\n" +
      "        See the comment there for why productionBrowserSourceMaps:false does not help.",
  );
  process.exit(1);
}

console.log("\n[probe] OK: source-map generation matches upload capability.");
