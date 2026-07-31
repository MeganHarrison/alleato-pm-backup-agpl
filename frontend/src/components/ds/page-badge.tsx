import * as React from "react";
import { cn } from "@/lib/utils";

interface PageBadgeProps {
  /** Icon rendered before the label — pass a Lucide icon element, e.g. <Sparkles className="h-3.5 w-3.5" /> */
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * PageBadge — pill-shaped preheading badge.
 *
 * Renders above a page title to label the context or feature area.
 *
 * @example
 * ```tsx
 * import { Sparkles } from "lucide-react";
 * import { PageBadge } from "@/components/ds";
 *
 * <PageBadge icon={<Sparkles className="h-3.5 w-3.5" />}>
 *   AI-powered documentation
 * </PageBadge>
 * ```
 */
export function PageBadge({ icon, children, className }: PageBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary",
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
