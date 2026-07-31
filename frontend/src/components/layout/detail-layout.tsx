import * as React from "react";
import { cn } from "@/lib/utils";

export interface DetailLayoutProps {
  /** Main column content — always rendered. */
  children: React.ReactNode;
  /**
   * Optional right sidebar. When omitted the layout renders single-column
   * (children fill the full width). When provided the layout switches to
   * a two-column responsive grid at the xl breakpoint.
  */
  sidebar?: React.ReactNode;
  /** Optional full-width content rendered below the main/sidebar row. */
  footer?: React.ReactNode;
  /**
   * When true, the sidebar only renders inside the desktop two-column grid.
   * Use this when mobile/tablet should place the same information elsewhere in
   * the main content flow instead of stacking an inspector below the content.
   */
  sidebarDesktopOnly?: boolean;
  /**
   * `sidebar` keeps the canonical detail-page main + narrow inspector layout.
   * `equal` is for peer content columns where neither side is an inspector.
   */
  variant?: "sidebar" | "equal";
  /** Breakpoint where the sidebar moves beside the main content. */
  sidebarAt?: "lg" | "xl";
  /** Horizontal gutter between peer columns once the two-column layout is active. */
  columnGap?: "standard" | "wide";
  className?: string;
}

/**
 * Two-column responsive layout for detail pages.
 *
 * Below xl: single column, main then sidebar stacked.
 * At xl+: main column (flex-1) beside a fixed-width sidebar (300px–380px).
 *
 * Use inside <ContentSectionStack> as the direct child of a tab's content area.
 * Do NOT hand-roll `grid-cols-1 xl:grid-cols-[...]` — use this component instead.
 */
export function DetailLayout({
  children,
  sidebar,
  footer,
  sidebarDesktopOnly = false,
  variant = "sidebar",
  sidebarAt = "xl",
  columnGap = "standard",
  className,
}: DetailLayoutProps) {
  if (!sidebar && !footer) {
    return <div className={cn("min-w-0", className)}>{children}</div>;
  }

  return (
    <div className={cn("space-y-8 md:space-y-10", className)}>
      {sidebar ? (
        <div
          className={cn(
            "grid grid-cols-1 gap-6 md:gap-8",
            columnGap === "wide"
              ? sidebarAt === "lg"
                ? "lg:gap-16"
                : "xl:gap-16"
              : sidebarAt === "lg"
                ? "lg:gap-10"
                : "xl:gap-10",
            variant === "equal" && sidebarAt === "lg" ? "lg:grid-cols-2" : null,
            variant === "equal" && sidebarAt === "xl" ? "xl:grid-cols-2" : null,
            variant === "equal" ? "items-start" : null,
            variant === "sidebar" && sidebarAt === "lg"
              ? "lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"
              : null,
            variant === "sidebar" && sidebarAt === "xl"
              ? "xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"
              : null,
          )}
        >
          <div className="min-w-0 space-y-10">{children}</div>
          {sidebarDesktopOnly ? (
            <aside
              className={cn(
                "hidden min-w-0 space-y-8",
                sidebarAt === "lg" ? "lg:block" : "xl:block",
              )}
            >
              {sidebar}
            </aside>
          ) : (
            <aside className="min-w-0 space-y-8">{sidebar}</aside>
          )}
        </div>
      ) : (
        <div className="min-w-0">{children}</div>
      )}

      {footer ? <div className="min-w-0">{footer}</div> : null}
    </div>
  );
}
