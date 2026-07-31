import * as React from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  headerDivider?: boolean;
  /** @deprecated — use a gap wrapper around sections instead */
  showDivider?: boolean;
  /** @deprecated — use a gap wrapper around sections instead */
  spacing?: "default" | "compact";
}

export function FormSection({
  title,
  description,
  children,
  actions,
  className,
}: FormSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:justify-between",
          description ? "sm:items-start" : "sm:items-center",
        )}
      >
        <div className="space-y-0.5">
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {title}
          </h2>
          {description ? (
            <div className="text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {children}
    </section>
  );
}
