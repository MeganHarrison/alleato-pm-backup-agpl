"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DetailPropertyBarProps = React.HTMLAttributes<HTMLDivElement>;

export function DetailPropertyBar({
  children,
  className,
  ...props
}: DetailPropertyBarProps) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 pb-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type DetailPropertyItemProps = {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  muted?: boolean;
  title?: string;
  "aria-label"?: string;
};

export function DetailPropertyItem({
  icon: Icon,
  children,
  className,
  contentClassName,
  href,
  external,
  onClick,
  disabled,
  muted,
  title,
  "aria-label": ariaLabel,
}: DetailPropertyItemProps) {
  const isInteractive = Boolean(href || onClick);
  const itemClassName = cn(
    "inline-flex min-w-0 items-center gap-2 text-xs font-medium transition-colors",
    muted ? "text-muted-foreground/60" : "text-muted-foreground",
    isInteractive &&
      (muted ? "hover:text-muted-foreground" : "hover:text-foreground"),
    disabled && "pointer-events-none opacity-60",
    className,
  );
  const content = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div className={cn("min-w-0 truncate", contentClassName)}>{children}</div>
    </>
  );

  if (href) {
    const linkProps = external
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};

    if (external) {
      return (
        <a
          href={href}
          className={itemClassName}
          title={title}
          aria-label={ariaLabel}
          {...linkProps}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        href={href}
        className={itemClassName}
        title={title}
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-auto px-0 py-0 hover:bg-transparent", itemClassName)}
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
      >
        {content}
      </Button>
    );
  }

  return (
    <div className={itemClassName} title={title} aria-label={ariaLabel}>
      {content}
    </div>
  );
}
