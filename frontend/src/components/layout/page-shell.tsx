"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageContainer } from "./PageContainer";
import { PageHeader } from "./page-header-unified";

// ─────────────────────────────────────────────────────────────────────────────
// PageShell — the one true entry point for all page layouts.
//
// Usage:
//   <PageShell variant="dashboard" title="Project Dashboard">...</PageShell>
//   <PageShell variant="table"     title="Commitments" actions={<Button>+ New</Button>}>...</PageShell>
//   <PageShell variant="form"      title="Create Contract" onBack={() => router.back()}>...</PageShell>
//   <PageShell variant="detail"    title="Contract #1042" statusBadge={<StatusBadge status="Draft" />}>...</PageShell>
//   <PageShell variant="detailWide" title="Contract #1042">...</PageShell>
//   <PageShell variant="content"   title="About">...</PageShell>
//
// Variants:
//   dashboard — max-w-[1800px] centered, standard padding. Use for home/overview pages with KPI cards + charts.
//   table     — full-width, tight padding. Use for data table pages (UnifiedTablePage goes inside).
//   form      — max-w-5xl centered, space-y-8. Use for create/edit forms. Includes optional back button.
//   detail    — max-w-6xl centered. Use for record detail pages (tabs, line items).
//   detailWide — max-w-screen-2xl centered. Use when detail pages need more canvas without going full dashboard width.
//   detailXWide — max-w-[1800px] centered. Use for detail pages with wide tables (e.g. schedule of values) that need more horizontal room than detailWide but shouldn't span the full viewport.
//   content   — max-w-4xl centered. Use for document/settings/read-heavy pages.
// ─────────────────────────────────────────────────────────────────────────────

export type PageShellVariant =
  | "dashboard"
  | "table"
  | "form"
  | "detail"
  | "detailWide"
  | "detailXWide"
  | "content";

export interface PageShellProps {
  variant: PageShellVariant;

  // Header
  title: string;
  eyebrow?: React.ReactNode;
  description?: string;
  showHeader?: boolean;
  titleContent?: React.ReactNode;
  actions?: React.ReactNode;
  headerLayout?: "default" | "balanced";
  statusBadge?: React.ReactNode;
  tabs?: { label: string; href: string; count?: number; isActive?: boolean }[];
  showExportButton?: boolean;
  onExportCSV?: () => void;
  onExportPDF?: () => void;

  // Breadcrumbs (shown above the title)
  breadcrumbs?: { label: string; href?: string }[];

  // Back navigation (form variant)
  onBack?: () => void;
  backLabel?: string;

  // Content
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  containerPaddingClassName?: string;
  /** Thread flex height through PageShell so children can fill the viewport */
  fillHeight?: boolean;
}

const variantConfig: Record<
  PageShellVariant,
  { containerMaxWidth: "full" | "sm" | "md" | "lg" | "xl" | "2xl"; contentMaxWidth?: string; spacing: string; headerPadding?: string }
> = {
  dashboard: { containerMaxWidth: "full", contentMaxWidth: "max-w-[1800px]", spacing: "space-y-14" },
  table:     { containerMaxWidth: "full", spacing: "space-y-4" },
  form:      { containerMaxWidth: "full", contentMaxWidth: "max-w-5xl",  spacing: "space-y-8" },
  detail:    { containerMaxWidth: "full", contentMaxWidth: "max-w-6xl",  spacing: "space-y-6" },
  detailWide:{ containerMaxWidth: "full", contentMaxWidth: "max-w-screen-2xl",  spacing: "space-y-6" },
  detailXWide:{ containerMaxWidth: "full", contentMaxWidth: "max-w-[1800px]",  spacing: "space-y-6" },
  content:   { containerMaxWidth: "full", contentMaxWidth: "max-w-4xl",  spacing: "space-y-8" },
};

export function PageShell({
  variant,
  title,
  eyebrow,
  showHeader = true,
  titleContent,
  actions,
  headerLayout,
  statusBadge,
  showExportButton,
  onExportCSV,
  onExportPDF,
  breadcrumbs,
  onBack,
  backLabel = "Back",
  description,
  tabs,
  children,
  className,
  contentClassName,
  containerPaddingClassName,
  fillHeight = false,
}: PageShellProps) {
  const config = variantConfig[variant];
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const pathname = usePathname()!;

  React.useEffect(() => {
    if (variant !== "form") {
      return;
    }

    const resetScrollPosition = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });

      let ancestor = rootRef.current?.parentElement ?? null;
      while (ancestor) {
        const styles = window.getComputedStyle(ancestor);
        if (
          (styles.overflowY === "auto" || styles.overflowY === "scroll") &&
          ancestor.scrollHeight > ancestor.clientHeight
        ) {
          ancestor.scrollTo({ top: 0, left: 0, behavior: "auto" });
          break;
        }
        ancestor = ancestor.parentElement;
      }
    };

    resetScrollPosition();

    const rafId = window.requestAnimationFrame(resetScrollPosition);
    const timeoutId = window.setTimeout(resetScrollPosition, 120);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [pathname, title, variant]);

  const backButton =
    onBack ? (
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
        <ArrowLeft className="size-3.5" />
        {backLabel}
      </Button>
    ) : null;

  // For form/detail/content, resolve the actions: prefer explicit actions, fall back to back button
  const resolvedActions = actions ?? (variant === "form" ? backButton : undefined);

  // Form pages get an enhanced title: slightly larger, semibold, with a primary accent line and visible description.
  const effectiveTitleContent =
    titleContent ??
    (variant === "form" ? (
      <div className="flex flex-col gap-1.5 py-1">
        <h1 className="text-[2rem] sm:text-[2.25rem] font-semibold text-foreground tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
    ) : undefined);
  const headerDescription =
    variant === "form" && !titleContent ? undefined : description;

  const header = showHeader ? (
    <PageHeader
      title={title}
      eyebrow={eyebrow}
      description={headerDescription}
      titleContent={effectiveTitleContent}
      actions={resolvedActions}
      headerLayout={headerLayout}
      statusBadge={statusBadge}
      tabs={tabs}
      breadcrumbs={breadcrumbs}
      showExportButton={showExportButton}
      onExportCSV={onExportCSV}
      onExportPDF={onExportPDF}
    />
  ) : null;

  // Table variant: tight layout — no extra top padding so header aligns with
  // pages that render ProjectPageHeader outside of PageContainer.
  if (variant === "table") {
    return (
      <PageContainer
        maxWidth={config.containerMaxWidth}
        className={cn(fillHeight && "flex flex-col min-h-0", className)}
        paddingClassName={containerPaddingClassName ?? "px-4 sm:px-6 lg:px-8 pt-2 pb-4"}
      >
        {header}
        <div className={cn("min-w-0 pt-2 pb-12", fillHeight && "flex flex-1 flex-col min-h-0", contentClassName)}>
          {children}
        </div>
      </PageContainer>
    );
  }

  // Form/detail/content/dashboard: constrained inner width
  if (config.contentMaxWidth) {
    return (
      <PageContainer
        maxWidth={config.containerMaxWidth}
        className={cn(fillHeight && "flex flex-col min-h-0", className)}
        paddingClassName={containerPaddingClassName ?? "px-4 sm:px-6 lg:px-8 pt-2 pb-4"}
      >
        <div ref={rootRef} className={cn("mx-auto w-full min-w-0", config.contentMaxWidth, config.headerPadding, fillHeight && "flex flex-col flex-1 min-h-0")}>
          {header}
          <div className={cn(config.spacing, "min-w-0 pt-6 pb-12", fillHeight && "flex flex-col flex-1 min-h-0", contentClassName)}>{children}</div>
        </div>
      </PageContainer>
    );
  }

  // Fallback: full width
  return (
    <PageContainer
      maxWidth={config.containerMaxWidth}
      className={cn(fillHeight && "flex flex-col min-h-0", className)}
      paddingClassName={containerPaddingClassName ?? "px-4 sm:px-6 lg:px-8 pt-2 pb-4"}
    >
      {header}
      <div ref={rootRef} className={cn(config.spacing, "min-w-0 pt-6 pb-12", fillHeight && "flex flex-col flex-1 min-h-0", contentClassName)}>{children}</div>
    </PageContainer>
  );
}
