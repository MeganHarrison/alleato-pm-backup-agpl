"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCurrentUserName } from "@/hooks/use-current-user-name";
import { AnimatedOrb } from "./animated-orb";
import {
  DEFAULT_ASSISTANT_SURFACE,
  type AssistantSurface,
} from "@/lib/ai/chat-surface";

interface WelcomeScreenProps {
  children?: ReactNode;
  beforeComposer?: ReactNode;
  afterComposer?: ReactNode;
  composer?: ReactNode;
  error?: ReactNode;
  /** Omit the decorative animated orb (used by the compact floating widget). */
  hideOrb?: boolean;
  variant?: "full" | "widget";
  assistantSurface?: AssistantSurface;
}

export function WelcomeScreen({
  children,
  beforeComposer,
  afterComposer,
  composer,
  error,
  hideOrb = false,
  variant = "full",
  assistantSurface = DEFAULT_ASSISTANT_SURFACE,
}: WelcomeScreenProps) {
  const isAsrsSurface = assistantSurface === "asrs";
  const fullName = useCurrentUserName();
  const rawFirstName = fullName.split(" ")[0] ?? "";
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1)
    : rawFirstName;

  if (variant === "widget") {
    return (
      <div className="flex min-h-0 flex-1 items-end overflow-y-auto px-4 pb-3 pt-3">
        <div className="w-full space-y-3">
          {error}
          {beforeComposer}
          {composer}
          {children ? <div>{children}</div> : null}
        </div>
      </div>
    );
  }

  return (
    // Mobile bottom-anchors the block so the composer lands in the same
    // thumb-reachable spot it occupies once a conversation is open; the large
    // pb-40 that biases the block upward is desktop-only. md+ keeps the
    // classic centered welcome.
    <div className="flex flex-1 items-end justify-center overflow-y-auto px-4 pb-4 pt-16 sm:px-6 md:items-center md:pb-40">
      <div className="w-full max-w-5xl">
        <div className="space-y-3 text-center">
          {!hideOrb && (
            <div className="orb-intro mx-auto flex h-24 w-24 items-center justify-center">
              <AnimatedOrb size={96} />
            </div>
          )}
          <h1 className="text-blur-intro text-xl font-semibold text-muted-foreground sm:text-2xl">
            {isAsrsSurface ? "Ask about FMDS 8-34" : `Hello, ${firstName}`}
          </h1>
          {isAsrsSurface ? (
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
              Answers stay within one ASRS corpus revision and show the tables,
              figures, pages, and review status used.
            </p>
          ) : null}
        </div>

        {(composer || children) && (
          <div className="mx-auto mt-8 max-w-3xl">
            {error && <div className="mb-2">{error}</div>}
            {beforeComposer}
            {composer}
            {afterComposer ? <div className="mt-7">{afterComposer}</div> : null}
            {/* Only the ASRS surface carries links here — browsing the corpus
                is that surface's primary job. The general assistant's empty
                state is the composer alone; secondary destinations (AI Profile,
                Teach Alleato) are reached from Home, Settings → Memory, and the
                skill library, not from the one screen whose job is "ask". */}
            {isAsrsSurface && (
              <div className="mt-3 flex items-center justify-center gap-4 text-center">
                <Link
                  href="/asrs/tables"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Browse tables
                </Link>
                <Link
                  href="/asrs/figures"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Browse figures
                </Link>
              </div>
            )}
          </div>
        )}
        {children ? <div className="mx-auto max-w-5xl">{children}</div> : null}
      </div>
    </div>
  );
}
