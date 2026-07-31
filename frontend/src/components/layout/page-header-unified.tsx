"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalProject } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Container } from "@/components/layout/container";
import { Stack } from "@/components/layout/stack";
import { Inline } from "@/components/layout/inline";
import { Eyebrow } from "@/components/ds/eyebrow";
import { Heading } from "@/components/ds/heading";
import { Text } from "@/components/ds/text";
import {
  BreadcrumbTrail,
  type BreadcrumbTrailItem,
} from "@/components/ui/breadcrumb-trail";
import { PageTabs } from "@/components/layout/PageTabs";

interface BreadcrumbItem extends BreadcrumbTrailItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  // Content
  title: string;
  titleContent?: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;

  // Layout options
  variant?: "default" | "executive" | "compact" | "budget";
  headerLayout?: "default" | "balanced";
  actions?: React.ReactNode;
  mobileActionsInline?: boolean;
  className?: string;
  titleClassName?: string;

  // Navigation
  breadcrumbs?: BreadcrumbItem[];
  tabs?: { label: string; href: string; count?: number; isActive?: boolean }[];

  // Project context
  showProjectName?: boolean;
  preHeading?: {
    project?: string;
    client?: string;
  };

  // Status
  statusBadge?: React.ReactNode;

  // Export functionality
  showExportButton?: boolean;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  exportLabel?: string;
}

/**
 * Unified PageHeader component that consolidates all page header variations
 *
 * @example Default usage
 * ```tsx
 * <PageHeader title="Budget" description="Manage your project budget" />
 * ```
 *
 * @example Executive variant with pre-heading
 * ```tsx
 * <PageHeader
 *   variant="executive"
 *   preHeading={{ project: "Project Name", client: "Client Name" }}
 *   title="Financial Overview"
 * />
 * ```
 *
 * @example With custom title content and status
 * ```tsx
 * <PageHeader
 *   titleContent={
 *     <Inline>
 *       <Heading>Budget</Heading>
 *       <StatusBadge status="locked" />
 *     </Inline>
 *   }
 * />
 * ```
 */
export function PageHeader({
  title,
  titleContent,
  eyebrow,
  description,
  variant = "default",
  headerLayout = "default",
  actions,
  mobileActionsInline = false,
  className,
  titleClassName,
  breadcrumbs,
  showProjectName = false,
  preHeading,
  statusBadge,
  showExportButton = false,
  onExportCSV,
  onExportPDF,
  exportLabel = "Export",
  tabs,
}: PageHeaderProps) {
  const projectContext = useOptionalProject();
  const selectedProject = projectContext?.selectedProject ?? null;
  const isLoading = projectContext?.isLoading ?? false;
  const useBudgetLayout = variant === "budget";
  const useBalancedLayout = headerLayout === "balanced" && !useBudgetLayout;

  // Only show project name when explicitly requested
  const shouldShowProjectName = showProjectName && selectedProject;

  if (variant === "executive") {
    return (
      <div className={cn("bg-slate-50", className)}>
        <Container size="xl">
          <Stack gap="md" className="py-12">
            {preHeading && (preHeading.project || preHeading.client) && (
              <Text
                size="sm"
                tone="muted"
                transform="uppercase"
                className="tracking-wider"
              >
                {[preHeading.project, preHeading.client]
                  .filter(Boolean)
                  .join(" / ")}
              </Text>
            )}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-light tracking-tight">
              {title}
            </h1>
            {actions && (
              <Inline gap="sm" className="pt-2">
                {actions}
              </Inline>
            )}
          </Stack>
        </Container>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("border-b", className)}>
        <div className="py-4">
          <div className="flex items-center justify-between">
            <Inline gap="md" align="center">
              {titleContent || <Eyebrow className="text-primary">{title}</Eyebrow>}
              {statusBadge}
            </Inline>
            {actions && <Inline gap="sm">{actions}</Inline>}
          </div>
        </div>
      </div>
    );
  }

  // Default variant (includes budget variant behavior)
  return (
    <div className={cn(className)}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <BreadcrumbTrail
            items={breadcrumbs}
            className="pb-2"
            listClassName="text-sm"
            linkClassName="max-w-[16rem]"
            currentClassName="max-w-[18rem]"
            maxVisibleItems={6}
            leadingItems={2}
            trailingItems={2}
          />
        ) : null}

        {/* Title and Actions */}
        <div
          className={cn(
            cn(
              titleClassName ? "min-w-0 pb-1" : "min-w-0 pt-4 pb-1",
              titleClassName,
            ),
            mobileActionsInline
              ? "flex items-center justify-between gap-3"
              : useBudgetLayout
                ? "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4"
                : useBalancedLayout
                  ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  : "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
          )}
        >
          {/* Left: title + badges (desktop only) */}
          <div
            className={cn(
              "min-w-0 flex-1",
              useBalancedLayout && "sm:flex-[0_1_72%] lg:max-w-[760px] xl:max-w-[880px]",
            )}
          >
            {/* Project Name */}
            {shouldShowProjectName && (
              <div className="mb-1">
                {isLoading ? (
                  <div className="h-5 w-48 bg-muted animate-pulse rounded" />
                ) : selectedProject ? (
                  <div className="text-sm font-medium text-muted-foreground">
                    {selectedProject.number && (
                      <span>{selectedProject.number} · </span>
                    )}
                    <span>{selectedProject.name}</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Page Title */}
            {eyebrow ? (
              <div className="mb-2">
                {typeof eyebrow === "string" ? (
                  <Eyebrow>{eyebrow}</Eyebrow>
                ) : (
                  eyebrow
                )}
              </div>
            ) : null}
            {titleContent ? (
              titleContent
            ) : (
              <h1 className="text-3xl sm:text-3xl lg:text-[2rem] font-medium text-foreground/90 break-words">
                {title}
              </h1>
            )}
            {description ? (
              <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {description}
              </div>
            ) : null}

            {/* Status badges — desktop: below title */}
            {statusBadge && (
              <div
                className={cn(
                  "mt-2 flex-wrap items-center gap-2",
                  useBudgetLayout ? "hidden lg:flex" : "hidden sm:flex",
                )}
              >
                {statusBadge}
              </div>
            )}
          </div>

          {/* Right: actions + badges below (mobile) */}
          {(actions || showExportButton || statusBadge) && (
            <div
                className={cn(
                "min-w-0 shrink-0",
                mobileActionsInline
                  ? "flex min-w-0 flex-1 items-start justify-end"
                  : useBudgetLayout
                    ? "flex w-full flex-col gap-2 lg:w-auto lg:items-end"
                    : "flex w-full flex-col gap-2 sm:w-auto sm:items-end",
              )}
            >
              {(actions || showExportButton) && (
                <div
                  className={cn(
                    "flex items-center gap-2 max-sm:[&_button]:min-h-11",
                    mobileActionsInline
                      ? "justify-end"
                      : useBudgetLayout
                        ? "w-full flex-wrap lg:w-auto"
                        : "w-full flex-wrap sm:w-auto",
                  )}
                >
                  {showExportButton && (onExportCSV || onExportPDF) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Download />
                          {exportLabel}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onExportCSV && (
                          <DropdownMenuItem onClick={onExportCSV}>
                            Export as CSV
                          </DropdownMenuItem>
                        )}
                        {onExportPDF && (
                          <DropdownMenuItem onClick={onExportPDF}>
                            Export as PDF
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {actions}
                </div>
              )}
              {/* Status badges — mobile: below actions */}
              {statusBadge && (
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-2",
                    useBudgetLayout ? "lg:hidden" : "sm:hidden",
                  )}
                >
                  {statusBadge}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs — rendered below title/actions, flush with the header bottom */}
        {tabs && tabs.length > 0 && (
          <PageTabs tabs={tabs} variant="inline" className="mb-0 md:mb-0" />
        )}
      </div>
    </div>
  );
}

// Backwards compatibility handled via named export above.
