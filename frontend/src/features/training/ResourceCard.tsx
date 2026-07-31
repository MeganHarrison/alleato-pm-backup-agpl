"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FileText,
  GraduationCap,
  Video as VideoIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/ds";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { resolveTrainingEmbed } from "./embed-policy";
import type { TrainingResource } from "./types";

interface ResourceCardProps {
  resource: TrainingResource;
  className?: string;
  details?: string[];
  actions?: ReactNode;
  showStatus?: boolean;
  showEmbed?: boolean;
  variant?: "row" | "tile";
  topicName?: string;
}

const TYPE_LABEL: Record<TrainingResource["type"], string> = {
  video: "Video",
  course: "Course",
  doc: "Document",
};

const LEVEL_LABEL: Record<TrainingResource["level"], string> = {
  intro: "Intro",
  "deep-dive": "Deep dive",
};

function formatTrackLabel(track: string) {
  if (track.toLowerCase() === "pm") return "Project Management";
  return track
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTypeIcon(type: TrainingResource["type"]) {
  if (type === "video") return VideoIcon;
  if (type === "course") return GraduationCap;
  return FileText;
}

export function ResourceCard({
  resource,
  className,
  details = [],
  actions,
  showStatus = true,
  showEmbed = true,
  variant = "row",
  topicName,
}: ResourceCardProps) {
  const embed =
    showEmbed && resource.type === "video" && resource.embed?.canEmbed
      ? resolveTrainingEmbed(resource.embed.embedUrl)
      : null;
  const metadata = [
    resource.provider,
    TYPE_LABEL[resource.type],
    LEVEL_LABEL[resource.level],
    ...details,
  ].filter(Boolean);
  const TypeIcon = getTypeIcon(resource.type);

  if (variant === "tile") {
    const href =
      resource.status === "published"
        ? `/training/resources/${resource.id}`
        : resource.url;
    return (
      <Card
        className={cn(
          "group gap-0 overflow-hidden border-border/80 bg-card py-0 shadow-[0_4px_10px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted/20",
          className,
        )}
      >
        <Link
          href={href}
          target={resource.status === "published" ? undefined : "_blank"}
          rel={resource.status === "published" ? undefined : "noreferrer"}
          aria-label={`${resource.title}. ${topicName ?? "Training resource"}`}
          className="flex h-full min-h-[14.75rem] flex-col p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-emerald-700">
              {formatTrackLabel(resource.track)}
            </span>
            {showStatus && resource.status !== "published" ? (
              <StatusBadge status={resource.status} />
            ) : null}
          </div>

          <div className="mt-4 flex-1">
            <h3 className="text-base font-semibold uppercase leading-6 text-foreground">
              {resource.title}
            </h3>
            {resource.description ? (
              <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                {resource.description}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-border/80 pt-3 text-xs text-muted-foreground">
            <span
              aria-label={`Format: ${TYPE_LABEL[resource.type]}`}
              title={TYPE_LABEL[resource.type]}
              className="inline-flex shrink-0 items-center"
            >
              <TypeIcon aria-hidden="true" className="size-3.5" />
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-border" />
            <BookOpen aria-hidden="true" className="size-3.5 shrink-0" />
            <span>Field Ready</span>
          </div>

          <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            {resource.status === "published"
              ? "View Training"
              : "Review source"}
            <ArrowRight
              aria-hidden="true"
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      </Card>
    );
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {resource.title}
          </p>
          {resource.description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {resource.description}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {metadata.join(" \u00b7 ")}
          </p>
        </div>
        {showStatus && resource.status !== "published" ? (
          <StatusBadge status={resource.status} />
        ) : null}
      </div>

      {embed && resource.status !== "published" ? (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded-md">
          <iframe
            src={embed.url}
            title={resource.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        {resource.status === "published" ? (
          <Link
            href={`/training/resources/${resource.id}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-9"
          >
            Open lesson
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : (
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-9"
          >
            Review source
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        )}
        {actions}
      </div>
    </>
  );

  return (
    <div
      className={cn("border-b border-border py-4 last:border-b-0", className)}
    >
      {content}
    </div>
  );
}
