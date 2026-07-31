import type { ReactNode } from "react";

import type { PageShellProps } from "@/components/layout";

/**
 * Temporary shared reset for the training theme's malformed `--card: #fff`
 * override. Tailwind's semantic `bg-card` expects HSL channels, so the scoped
 * value must be corrected here until training-theme.module.css can be updated
 * by its active owner. Keep this centralized so training pages cannot drift.
 */
export const TRAINING_PAGE_SURFACE_CLASS = "[--card:0_0%_100%] bg-card";

export interface TrainingPageMetaItem {
  label: string;
  value: string;
}

interface TrainingPageConfig {
  title: string;
  description?: string | null;
  eyebrow?: string;
  layout?: "article" | "media";
}

interface TrainingPageContentProps {
  metadata?: TrainingPageMetaItem[];
  children: ReactNode;
}

/**
 * Canonical PageShell configuration and content frame for an individual lesson.
 *
 * Browse, assessment, and chat routes keep their workflow-specific layouts;
 * every article, guide, and resource detail route uses this owner so training
 * hierarchy and navigation cannot drift page by page.
 */
export function getTrainingPageShellProps({
  title,
  description,
  eyebrow = "Alleato Training Library",
  layout = "article",
}: TrainingPageConfig): Omit<PageShellProps, "children"> {
  return {
    variant: layout === "media" ? "detailWide" : "content",
    eyebrow,
    title,
    description: description ?? undefined,
    className: TRAINING_PAGE_SURFACE_CLASS,
  };
}

export function TrainingPageContent({
  metadata = [],
  children,
}: TrainingPageContentProps) {
  return (
    <>
      {metadata.length ? (
        <div
          aria-label="Lesson details"
          className="flex flex-wrap gap-x-8 gap-y-3 border-b border-border pb-6 text-sm"
        >
          {metadata.map((item) => (
            <div key={item.label} className="space-y-1">
              <span className="block text-muted-foreground">{item.label}</span>
              <span className="block font-medium text-foreground">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <article className="space-y-8">{children}</article>
    </>
  );
}
