import path from "node:path";
import { createRequire } from "node:module";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { withWorkflow } from "workflow/next";

const require = createRequire(import.meta.url);

const sentryConfig = {
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

const hasSentrySourceMapConfig = Boolean(
  sentryConfig.org && sentryConfig.project && sentryConfig.authToken,
);

if (sentryConfig.dsn && process.env.CI && !hasSentrySourceMapConfig) {
  const missing = [
    ["SENTRY_ORG", sentryConfig.org],
    ["SENTRY_PROJECT", sentryConfig.project],
    ["SENTRY_AUTH_TOKEN", sentryConfig.authToken],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)
    .join(", ");

  throw new Error(
    `Sentry DSN is configured, but source-map upload is incomplete. Missing: ${missing}.`,
  );
}

if (sentryConfig.dsn && !hasSentrySourceMapConfig) {
  console.warn(
    "[sentry] DSN is configured, but source-map upload is disabled because SENTRY_ORG, SENTRY_PROJECT, or SENTRY_AUTH_TOKEN is missing.",
  );
}

function resolvePdfjsDistPath(filePath: string) {
  const reactPdfPackageDir = path.dirname(require.resolve("react-pdf/package.json"));
  const pdfjsPackagePath = require.resolve("pdfjs-dist/package.json", {
    paths: [reactPdfPackageDir],
  });

  return path.join(path.dirname(pdfjsPackagePath), filePath);
}

const pdfjsBrowserEntry = resolvePdfjsDistPath("build/pdf.min.mjs");

// Brotli-compressed Chromium blobs read at runtime by @sparticuz/chromium's
// executablePath(). Force-traced into every PDF-rendering route (see
// outputFileTracingIncludes below). The version glob survives package bumps;
// trace the real pnpm store path rather than the hoisted @sparticuz/chromium
// symlink (Vercel rejects serverless packages that include symlinked dirs).
//
// outputFileTracingIncludes globs resolve relative to outputFileTracingRoot,
// which here is the repo root (../) — but pnpm installs the package under
// frontend/node_modules. The bare "./node_modules/..." glob therefore resolved
// to <repo-root>/node_modules (nonexistent) and silently traced nothing, so the
// binary was missing at runtime and every PDF route 500'd with
// "input directory .../bin does not exist". Include BOTH the frontend-relative
// and repo-root-relative paths so the glob is correct regardless of how Next
// resolves the base; a glob that matches nothing is ignored. This is the fast
// path — renderPdfFromHtml() falls back to a remote Chromium pack if tracing
// still misses (see lib/documents/pdf.ts), so a regression here degrades to a
// slower cold start instead of a hard failure.
const CHROMIUM_TRACE_GLOBS = [
  "./frontend/node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
  "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
];

const isDevelopment = process.env.NODE_ENV === "development";
if (
  isDevelopment &&
  process.env.NEXT_DIST_DIR &&
  !process.env.NEXT_TSCONFIG_PATH
) {
  throw new Error(
    `[next-config] NEXT_DIST_DIR=${process.env.NEXT_DIST_DIR} requires ` +
      "NEXT_TSCONFIG_PATH. Use scripts/dev/start-frontend-clean.sh so generated route types cannot mutate frontend/tsconfig.json.",
  );
}
const nextDistDir = isDevelopment
  ? process.env.NEXT_DIST_DIR || ".next"
  : ".next";
const nextTsconfigPath = isDevelopment
  ? process.env.NEXT_TSCONFIG_PATH || "tsconfig.json"
  : "tsconfig.json";

const nextConfig: NextConfig = {
  // Allow session/port-scoped dev dist dirs so concurrent local verification
  // does not corrupt a shared `.next` tree.
  // Next's production trace engine hard-codes its generated-chunk ignore to
  // `.next`. A port-scoped dev dist used during `next build` bypasses that
  // ignore and can make NFT consume generated chunks recursively. Custom dist
  // directories are therefore a development-only concurrency feature.
  distDir: nextDistDir,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    tsconfigPath: nextTsconfigPath,
    // Type checking is handled by pre-commit hooks and CI (tsc --noEmit).
    // Skipping during build saves significant memory on Vercel's 8GB machines.
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  devIndicators: false,
  experimental: {
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
    // Prevent webpack/turbopack from barrel-importing entire icon/component libraries.
    // Without this, lucide-react (511 icons), @tabler/icons-react (3000+ icons),
    // and react-icons cause the webpack worker to OOM on Vercel's 8 GB build machines.
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "react-icons",
      "@radix-ui/react-icons",
      "framer-motion",
      "motion",
      "recharts",
      "date-fns",
      "lodash",
      "@lexical/react",
      "@lexical/rich-text",
      "@lexical/link",
      "@lexical/list",
      "@lexical/markdown",
      "@lexical/code",
      "@lexical/selection",
      "@lexical/utils",
      "@lexical/yjs",
      "@lexical/headless",
      "@codemirror/view",
      "@codemirror/state",
      "@codemirror/lang-python",
      "@codemirror/theme-one-dark",
    ],
  },
  turbopack: {
    // Turbopack equivalent of the webpack pdfjs-dist alias below.
    // react-pdf's non-minified 5.x ESM entry redeclares webpack's internal export
    // variable; the minified build avoids this.
    // NOTE: Turbopack does not support absolute filesystem paths in resolveAlias -
    // use a bare module specifier instead (pnpm hoists pdfjs-dist to the top level).
    resolveAlias: {
      "pdfjs-dist": "pdfjs-dist/build/pdf.min.mjs",
    },
  },
  serverExternalPackages: [
    // AI/ML packages — large module graphs, server-only, never in client bundles.
    // Webpack bundling these causes OOM on Vercel's 8 GB build machines.
    "openai",
    "ai",
    "@ai-sdk/openai",
    "@ai-sdk/anthropic",
    "@ai-sdk/mcp",
    // Mermaid diagram packages — complex dependency trees
    "@mermaid-js/parser",
    "mermaid",
    "@streamdown/mermaid",
    // Headless browser — binary path breaks when webpack bundles these
    "puppeteer",
    "puppeteer-core",
    "@sparticuz/chromium",
    // Microsoft Teams Bot Framework — native Node.js modules, heavy dep graph
    "@chat-adapter/teams",
    "botbuilder",
    "botframework-connector",
    "@azure/identity",
    "chat",
    "@chat-adapter/state-memory",
    // Heavy doc/API packages only used in specific admin routes
    "redoc",
    "swagger-ui-dist",
    "xlsx",
    // OpenTelemetry + tracing — native Node.js modules, never in client bundles
    // @opentelemetry/api must also be external: its ESM build uses `self` (browser/worker global)
    // which crashes middleware when webpack bundles it for Node.js runtime.
    "@opentelemetry/api",
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@arizeai/openinference-instrumentation-openai",
    "@langfuse/otel",
    "@langfuse/tracing",
    "langfuse",
  ],
  webpack: (config) => {
    // react-pdf imports bare `pdfjs-dist`, whose non-minified 5.x ESM entry redeclares
    // webpack's internal export variable and crashes the drawing viewer in dev.
    // Production builds use Turbopack (--turbopack flag); this alias applies to local
    // dev and any non-Turbopack builds. Turbopack equivalent: experimental.turbo.resolveAlias.
    config.resolve.alias = {
      ...config.resolve.alias,
      "pdfjs-dist$": pdfjsBrowserEntry,
    };

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lgveqfnpkxvzbnnwuled.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "www.gravatar.com",
        pathname: "/avatar/**",
      },
    ],
  },
  // Set the workspace root to silence Next.js warning about multiple lockfiles
  outputFileTracingRoot: path.join(__dirname, "../"),
  // Explicitly include help articles — the dynamic fs.readdir path can't be
  // statically traced by Next.js, so without this the docs page sees an empty
  // directory in the Vercel deployment and returns "No documentation found".
  //
  // @sparticuz/chromium ships its headless Chromium as brotli-compressed blobs
  // in its `bin/` dir, which `executablePath()` reads at runtime via a
  // constructed path — NOT a static `require`. Next.js output file tracing
  // therefore drops `bin/*.br` even though the package is in
  // serverExternalPackages, and the serverless function crashes with
  // "input directory ... /@sparticuz/chromium/bin does not exist". Force-include
  // the binary into exactly the routes that render PDFs (every caller of
  // renderPdfFromHtml). Scoped per-route so the 64 MB blob is not duplicated
  // into every API function. The pnpm version glob keeps this working across
  // @sparticuz/chromium upgrades.
  //
  // Adding a new PDF/email route here is now an OPTIMIZATION, not a requirement:
  // renderPdfFromHtml() falls back to downloading the Chromium pack at runtime
  // if the bundled binary is missing (see lib/documents/pdf.ts). Listing a route
  // keeps its first cold start fast (no ~50 MB download); forgetting one only
  // makes that route's first render slower, it no longer 500s. Prefer the shared
  // /api/document-center/[recordType]/[recordId]/pdf route for new documents so
  // there is nothing to add here at all.
  outputFileTracingIncludes: {
    // The site-map (Page Access) page is force-dynamic and reads this CSV via a
    // dynamically-constructed readFileSync path that Next.js cannot statically
    // trace, so without this the route inventory is empty on Vercel and the
    // "pages" tab shows no routes. Scoped to /site-map so the CSV isn't bundled
    // into every function. If route-audit.mjs output moves, update this path.
    "/site-map": ["../docs/reports/route-inventory.csv"],
    "/api/commitments/[commitmentId]/email": CHROMIUM_TRACE_GLOBS,
    "/api/commitments/[commitmentId]/export": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/email": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/estimates/[estimateId]/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/change-events/[changeEventId]/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/change-events/[changeEventId]/email": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/progress-reports/[reportId]/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/progress-reports/[reportId]/email": CHROMIUM_TRACE_GLOBS,
    "/api/document-center/[recordType]/[recordId]/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/document-center/[recordType]/[recordId]/email": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/budget/export": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/budget/export/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/drawings/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/rfis/[rfiId]/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/rfis/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/submittals/[submittalId]/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/projects/[projectId]/submittals/pdf": CHROMIUM_TRACE_GLOBS,
    "/api/executive/daily-brief/[briefId]/pdf": CHROMIUM_TRACE_GLOBS,
  },
  outputFileTracingExcludes: {
    // Exclude ALL non-runtime artifact directories from every serverless function.
    // Keys are route globs; use /**/* so nested routes such as
    // /api/admin/rag-eval/run do not accidentally trace repo evidence output.
    "/**/*": [
      "../_bmad/**",
      "../_bmad-output/**",
      "../backend/**",
      "../docs-ai/**",
      "../dogfood-output/**",
      "../e2e-screenshots/**",
      "../logs/**",
      "../memories/**",
      "../output/**",
      "../procore-crawls/**",
      "../procore-templates/**",
      "../scripts/**",
      "../supabase/**",
      "../tests/**",
      "../tools/**",
      "../tmp/**",
      "../verify-output/**",
      "../vermillian/**",
      "../docs/.archive/**",
      "../docs/BMAD/**",
      "../docs/ops/evidence/**",
      "../docs/reports/**",
      "../scripts/adversarial-harness/**",
      "../scripts/change-events-crawl/**",
      "../scripts/feature-tracker/**",
      "../scripts/mcp-servers/**",
      "../scripts/playwright-crawl/**",
      "../scripts/screenshot-capture/**",
      "../scripts/visual-audit/**",
      "./coverage/**",
      "./config/playwright/**",
      "./e2e-screenshots/**",
      "./playwright-report/**",
      "./storybook-static/**",
      "./tests/**",
      "./tsconfig*.tsbuildinfo",
    ],
  },
  // Security headers (OWASP best practices)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
  // Proxy chatkit requests to the Alleato RAG backend (port 8051)
  async rewrites() {
    return [
      {
        source: "/:projectId/plane",
        destination: "/:projectId/tasks?planeSurface=home",
      },
      {
        source: "/:projectId/plane/:planeSurface",
        destination: "/:projectId/tasks?planeSurface=:planeSurface",
      },
      {
        source: "/rag-chatkit",
        destination: "http://127.0.0.1:8051/rag-chatkit",
      },
      {
        source: "/rag-chatkit/:path*",
        destination: "http://127.0.0.1:8051/rag-chatkit/:path*",
      },
      {
        source: "/chatkit",
        destination: "http://127.0.0.1:8051/rag-chatkit",
      },
      {
        source: "/chatkit/:path*",
        destination: "http://127.0.0.1:8051/rag-chatkit/:path*",
      },
    ];
  },
};

const sentryWrappedConfig = withSentryConfig(nextConfig, {
  org: sentryConfig.org,
  project: sentryConfig.project,
  authToken: sentryConfig.authToken,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});

// Eve is deployed as its own Vercel service. The frontend reaches it through
// the authenticated /api/ai-assistant/eve/proxy boundary and ALLEATO_EVE_URL.
// Embedding it in this Next.js build would resolve an agent directory outside
// the configured frontend project root, which Vercel correctly rejects.
export default withWorkflow(sentryWrappedConfig);
