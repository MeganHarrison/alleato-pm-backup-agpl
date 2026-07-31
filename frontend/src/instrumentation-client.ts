import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

function parseSampleRate(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: process.env.NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII === "true",
    enableLogs: true,
    tracesSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    ),
    tracePropagationTargets: [
      /^\//,
      "localhost",
      /^https:\/\/alleato-backend[-a-z0-9]*\.onrender\.com/i,
    ],
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
      process.env.NODE_ENV === "production" ? 0.1 : 0,
    ),
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        unmask: [".sentry-unmask", "[data-sentry-unmask]"],
        unblock: [".sentry-unblock", "[data-sentry-unblock]"],
        mask: ["[data-sentry-mask]", "[data-sensitive]", 'input[type="password"]'],
      }),
    ],
    ignoreErrors: [
      "ChunkLoadError",
      "Failed to fetch dynamically imported module",
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
