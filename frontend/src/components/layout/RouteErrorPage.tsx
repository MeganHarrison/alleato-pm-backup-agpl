"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ds/heading";
import { reportErrorObject } from "@/lib/app-error-reporter";
import { isChunkLoadError, markReload, shouldAutoReload } from "@/lib/chunk-error";

interface RouteErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function RouteErrorPage({ error, reset }: RouteErrorPageProps) {
  // A route-level error.tsx boundary sits below the top-level
  // ChunkLoadErrorRecovery boundary, so it catches render-time chunk-load
  // errors first. Handle them here too: a stale chunk (404 after a deploy)
  // is fixed by a full reload, not by reset() — reset() would re-render
  // against the same missing chunk.
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError) {
      if (shouldAutoReload()) {
        reportErrorObject(error, {
          severity: "medium",
          action: "route_chunk_error_reload",
          route: window.location.pathname,
        });
        markReload();
        window.location.reload();
      }
      // If the cooldown is active we've already reloaded once — don't loop;
      // show the manual "Refresh" prompt below instead.
      return;
    }

    console.error(error);
    reportErrorObject(error, {
      severity: "high",
      action: "route_error_boundary",
      route: window.location.pathname,
    });
  }, [error, chunkError]);

  if (chunkError) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <RefreshCw className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-2">
          <Heading level={5} as="h2">
            Loading the latest version…
          </Heading>
          <p className="text-sm text-muted-foreground max-w-md">
            The app was updated. It should refresh automatically — if it
            doesn&apos;t, use the button below.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            markReload();
            window.location.reload();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh now
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-96 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-2">
        <Heading level={5} as="h2">
          Something went wrong
        </Heading>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">Error ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Go back
        </Button>
        <Button size="sm" onClick={reset}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    </div>
  );
}
