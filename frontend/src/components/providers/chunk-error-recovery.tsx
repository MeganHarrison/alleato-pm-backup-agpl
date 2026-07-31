"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { reportBrowserError } from "@/lib/app-error-reporter";
import {
  isChunkLoadError,
  markReload,
  shouldAutoReload,
} from "@/lib/chunk-error";

/**
 * ChunkLoadErrorRecovery
 *
 * Catches "Failed to load chunk" / "Loading chunk failed" errors that happen
 * after a new deployment invalidates old static assets, and auto-reloads the
 * page once. If the reload already happened (tracked via sessionStorage), it
 * falls through to the normal Next.js error boundary so the user isn't stuck
 * in a reload loop.
 *
 * Also installs a global window error handler for chunk errors that slip past
 * React error boundaries (e.g., dynamic imports in event handlers).
 *
 * NOTE: This boundary is mounted at the top of the tree (app/layout.tsx), so
 * React's per-route error.tsx boundaries catch render-time chunk errors first.
 * RouteErrorPage therefore shares the same recovery helpers so those routes
 * auto-recover too — see {@link @/lib/chunk-error}.
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasChunkError: boolean;
}

export class ChunkLoadErrorRecovery extends Component<Props, State> {
  state: State = { hasChunkError: false };

  private globalHandler = (event: ErrorEvent) => {
    if (isChunkLoadError(event.error) && shouldAutoReload()) {
      event.preventDefault();
      reportBrowserError({
        severity: "medium",
        action: "chunk_error_global",
        errorCode: "CHUNK_LOAD_ERROR",
        errorMessage: event.error instanceof Error ? event.error.message : event.message,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
      markReload();
      window.location.reload();
    }
  };

  private rejectionHandler = (event: PromiseRejectionEvent) => {
    if (isChunkLoadError(event.reason) && shouldAutoReload()) {
      event.preventDefault();
      reportBrowserError({
        severity: "medium",
        action: "chunk_error_rejection",
        errorCode: "CHUNK_LOAD_ERROR",
        errorMessage: event.reason instanceof Error ? event.reason.message : String(event.reason),
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
      });
      markReload();
      window.location.reload();
    }
  };

  componentDidMount() {
    window.addEventListener("error", this.globalHandler);
    window.addEventListener("unhandledrejection", this.rejectionHandler);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.globalHandler);
    window.removeEventListener("unhandledrejection", this.rejectionHandler);
  }

  static getDerivedStateFromError(error: Error): State | null {
    if (isChunkLoadError(error)) {
      return { hasChunkError: true };
    }
    // Not a chunk error — let Next.js error boundary handle it
    return null;
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error) && shouldAutoReload()) {
      reportBrowserError({
        severity: "medium",
        action: "chunk_error_boundary",
        errorCode: "CHUNK_LOAD_ERROR",
        errorMessage: error.message,
        stack: error.stack,
      });
      markReload();
      window.location.reload();
      return;
    }
    // Re-throw non-chunk errors so Next.js error.tsx picks them up
    throw error;
  }

  render() {
    if (this.state.hasChunkError) {
      // This only shows if auto-reload already happened (cooldown active)
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
          <div className="rounded-full bg-primary/10 p-4">
            <svg
              className="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
              />
            </svg>
          </div>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h2 className="text-xl font-semibold text-foreground">
            New version available
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            The app has been updated. Please refresh to load the latest version.
          </p>
          <Button
            onClick={() => {
              markReload();
              window.location.reload();
            }}
          >
            Refresh Now
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
