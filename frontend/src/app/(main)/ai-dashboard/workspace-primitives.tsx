import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Heading } from "@/components/ds";
import { cn } from "@/lib/utils";

export function WorkspacePageIntro({
  eyebrow,
  title,
  compact = false,
  statusLabel,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  compact?: boolean;
  statusLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "max-w-3xl font-semibold tracking-tight text-foreground",
            compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl",
          )}
        >
          {title}
        </h1>
        {children ? (
          <div className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : statusLabel ? (
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {statusLabel}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceSection({
  eyebrow,
  title,
  action,
  showHeader = true,
  showTopDivider = false,
  className,
  children,
}: {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  showHeader?: boolean;
  showTopDivider?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const hasHeader = showHeader && Boolean(eyebrow || title || action);

  return (
    <section
      className={cn(
        "pt-8",
        showTopDivider && "border-t border-border",
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <Heading
                level={5}
                as="h2"
                className={cn(
                  "text-lg font-semibold tracking-tight text-foreground",
                  eyebrow && "mt-2",
                )}
              >
                {title}
              </Heading>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn(hasHeader && "mt-5")}>{children}</div>
    </section>
  );
}

export function WorkspaceSectionTitle({
  children,
  caption,
}: {
  children: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-baseline justify-between gap-4">
      <Heading
        level={5}
        as="h2"
        className="capitalize text-lg font-semibold tracking-tight text-foreground sm:text-xl"
      >
        {children}
      </Heading>
      {caption ? <span className="shrink-0 text-xs text-muted-foreground">{caption}</span> : null}
    </div>
  );
}

export function CanonicalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/75",
        className,
      )}
    >
      {children}
      <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

export function WorkspaceSourceState({
  source,
  state,
  detail,
}: {
  source: string;
  state: "loading" | "error" | "empty";
  detail?: string;
}) {
  const message =
    state === "loading"
      ? `Loading ${source}…`
      : state === "empty"
        ? `${source} returned no current records.`
        : detail ?? `${source} could not be loaded.`;

  return (
    <div
      role={state === "error" ? "alert" : "status"}
      className="py-8 text-sm leading-relaxed text-muted-foreground"
    >
      <p className={state === "error" ? "text-destructive" : undefined}>
        {message}
      </p>
      {state === "error" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Refresh this page. If the source remains unavailable, use the linked
          canonical report rather than acting on an incomplete view.
        </p>
      ) : null}
    </div>
  );
}
