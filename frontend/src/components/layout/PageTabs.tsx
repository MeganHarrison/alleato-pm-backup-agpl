"use client";

import React, { type ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  href: string;
  count?: number;
  isActive?: boolean;
  testId?: string;
  countTestId?: string;
}

interface PageTabsProps {
  tabs: Tab[];
  className?: string;
  variant?: "default" | "inline";
  /** When provided, called instead of router.push — enables local-state tab switching */
  onTabClick?: (href: string) => void;
}

/**
 * PageTabs owns page-level or top-of-tool navigation.
 * Use this for the primary view switcher on a page or workspace, whether the
 * tab changes the route or swaps top-level local state via `onTabClick`.
 *
 * Use `Tabs` from `@/components/ui/tabs` for section-level content tabs inside
 * a page instead of styling section tabs into a page-navigation look.
 */
export function PageTabs({
  tabs,
  className,
  variant = "default",
  onTabClick,
}: PageTabsProps): ReactElement {
  const pathname = usePathname()! ?? "";
  const router = useRouter();
  const searchParams = useSearchParams()! ?? new URLSearchParams();

  // Find the active tab based on pathname
  const searchString = searchParams.toString();
  const currentPath = searchString ? `${pathname}?${searchString}` : pathname;
  const hasExactHrefMatch = tabs.some((tab) => tab.href === currentPath);
  const wrapperClasses =
    variant === "inline"
      ? "relative flex h-11 min-w-0 w-full items-center"
      : "px-1";
  const navClasses =
    variant === "inline"
      ? "-mb-px flex h-full flex-1 min-w-0 items-center overflow-x-auto overscroll-x-contain scrollbar-hide"
      : "-mb-px flex overflow-x-auto overscroll-x-contain pb-1 scrollbar-hide";
  const buttonClasses =
    variant === "inline"
      ? "group relative inline-flex h-full min-h-11 snap-start items-center gap-2 whitespace-nowrap px-2 py-0 text-sm transition-colors"
      : "group relative inline-flex min-h-11 snap-start items-center gap-2 whitespace-nowrap px-3 py-3 text-sm transition-colors";
  const spacingClasses = variant === "inline" ? "mb-4 md:mb-5" : "mb-6 md:mb-8";

  return (
    <div className={cn(wrapperClasses, spacingClasses, className, "border-0")}>
      {variant === "inline" && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-[calc(100%-0.25rem)] w-4 bg-gradient-to-l from-background to-transparent md:hidden" />
      )}
      <nav className={navClasses} aria-label="Tabs">
        <div
          className={cn(
            "flex snap-x snap-mandatory md:space-x-6",
            "min-w-max space-x-2",
          )}
        >
          {tabs.map((tab) => {
            const isActive =
              tab.isActive ??
              (hasExactHrefMatch
                ? tab.href === currentPath
                : pathname === tab.href);

            return (
              <React.Fragment key={tab.href}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    onTabClick ? onTabClick(tab.href) : router.push(tab.href)
                  }
                  aria-label={tab.label}
                  data-testid={tab.testId}
                  className={cn(
                    buttonClasses,
                    "rounded-none hover:bg-transparent",
                    isActive
                      ? "text-primary font-medium"
                      : "text-foreground/70 font-medium hover:text-foreground/90",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-colors",
                      isActive ? "bg-primary" : "bg-transparent",
                    )}
                  />
                </Button>
              </React.Fragment>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
