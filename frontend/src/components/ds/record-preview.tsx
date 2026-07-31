"use client";

import Link from "next/link";
import type * as React from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";

interface RecordPreviewProps {
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function RecordPreview({
  href,
  title,
  subtitle,
  status,
  children,
  footer,
  className,
}: RecordPreviewProps) {
  return (
    <Link href={href} className="group block">
      <div
        className={cn(
          "rounded-lg bg-primary/5 p-4 transition-colors group-hover:bg-primary/10",
          className,
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-snug text-foreground">
              {title}
            </p>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {status}
        </div>
        {children}
        {footer ? (
          <div className="mt-3 flex items-center justify-between">
            {footer}
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

interface RecordPreviewGridProps {
  children: React.ReactNode;
  className?: string;
}

export function RecordPreviewGrid({ children, className }: RecordPreviewGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-4 gap-y-3", className)}>
      {children}
    </div>
  );
}

interface RecordPreviewFieldProps {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  valueClassName?: string;
}

export function RecordPreviewField({
  label,
  value,
  detail,
  valueClassName,
}: RecordPreviewFieldProps) {
  return (
    <div>
      <Eyebrow className="text-[10px]">{label}</Eyebrow>
      <p className={cn("mt-0.5 text-sm font-medium text-foreground", valueClassName)}>
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

interface RecordPreviewStateProps {
  children: React.ReactNode;
  tone?: "success" | "neutral";
  icon?: React.ReactNode;
}

export function RecordPreviewState({
  children,
  tone = "neutral",
  icon,
}: RecordPreviewStateProps) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] font-medium",
        tone === "success" ? "text-status-success" : "text-muted-foreground",
      )}
    >
      {icon}
      {children}
    </span>
  );
}
