"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportErrorObject } from "@/lib/app-error-reporter";

function isChunkLoadError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("loading chunk") ||
    msg.includes("failed to load chunk") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("loading css chunk") ||
    msg.includes("_next/static")
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        action: "global_error_boundary",
        route: window.location.pathname,
        severity: isChunkLoadError(error) ? "medium" : "critical",
      },
      contexts: {
        nextjs: {
          digest: error.digest,
        },
      },
    });

    reportErrorObject(error, {
      severity: isChunkLoadError(error) ? "medium" : "critical",
      action: "global_error_boundary",
      route: window.location.pathname,
    });

    // Auto-reload on chunk errors (deployment cache mismatch)
    if (isChunkLoadError(error)) {
      try {
        const last = sessionStorage.getItem("chunk-error-reload");
        if (!last || Date.now() - Number(last) > 10_000) {
          sessionStorage.setItem("chunk-error-reload", String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // sessionStorage blocked — reload once anyway
        window.location.reload();
        return;
      }
    }
  }, [error]);

  const isChunk = isChunkLoadError(error);

  return (
    <html>
      <body>
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 font-sans">
          <div className={isChunk
            ? "flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
            : "flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"}
          >
            {isChunk ? (
              <RefreshCw className="h-7 w-7 text-primary" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
            )}
          </div>
          <h2 className="m-0 text-xl font-semibold text-foreground">
            {isChunk ? "New version available" : "Something went wrong"}
          </h2>
          <p className="max-w-md text-center text-muted-foreground">
            {isChunk
              ? "The app has been updated. Click refresh to load the latest version."
              : error.message || "A critical error occurred. Please try again."}
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => isChunk ? window.location.reload() : reset()}
            >
              {isChunk ? "Refresh Now" : "Try Again"}
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/")}
            >
              Go Home
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
