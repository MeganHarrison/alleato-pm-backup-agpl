"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PageShell, type PageShellVariant } from "./page-shell";
import { DetailLayout } from "./detail-layout";

// ─────────────────────────────────────────────────────────────────────────────
// PageScaffold — the strict, opinionated page shell.
//
// PageShell owns the page width + header. PageScaffold goes one step further and
// owns the *content layout* too. You pick ONE named layout from a fixed menu and
// the component renders the columns, gaps, and responsive stacking. There is no
// free-form `children` grid to dump a hand-rolled `grid-cols-3` into — that is
// the whole point. The ESLint rule `no-raw-page-grid` blocks raw multi-column
// grids in page files so the only way to lay out a page is through here.
//
// Layouts (pick one — the `layout` prop is required):
//   single       — one centered content column (a vertical stack of sections).
//   sidebar      — main column + fixed-width right sidebar (300–380px).
//   two-column   — two balanced columns (1fr 1fr).
//   three-column — master list: list | list | preview (browse-and-preview).
//
// Each layout stacks to a single column on small screens automatically.
//
// Usage:
//   <PageScaffold layout="single" title="About">
//     <SectionRuleHeading label="Overview" />
//     …
//   </PageScaffold>
//
//   <PageScaffold layout="sidebar" title="Contract #1042" sidebar={<FinancialSidebar />}>
//     <DetailPanel>…</DetailPanel>
//   </PageScaffold>
//
//   <PageScaffold
//     layout="two-column"
//     title="Comparison"
//     left={<PanelA />}
//     right={<PanelB />}
//   />
//
//   <PageScaffold
//     layout="three-column"
//     title="Deep Research Archive"
//     left={<WorkspaceList />}
//     center={<FileList />}
//     right={<FilePreview />}
//   />
//
// Width: each layout picks a sensible default width (single→content, sidebar→detail,
// two/three-column→detailWide). Override with `variant` when a page genuinely needs
// a different width. Header props (title, eyebrow, description, actions, statusBadge,
// breadcrumbs, tabs) pass straight through to PageShell so headers stay identical.
// ─────────────────────────────────────────────────────────────────────────────

export type PageScaffoldLayoutKind =
  | "single"
  | "sidebar"
  | "two-column"
  | "three-column";

interface PageScaffoldBaseProps {
  /** Page title — rendered by the shared PageHeader (no raw <h1>). */
  title: string;
  /** Width override. Defaults to a sensible width per layout. */
  variant?: PageShellVariant;
  eyebrow?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  statusBadge?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  tabs?: { label: string; href: string; count?: number; isActive?: boolean }[];
  showExportButton?: boolean;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  /** Class applied to the layout grid wrapper (spacing only — never columns). */
  className?: string;
}

type PageScaffoldLayoutProps =
  | { layout: "single"; children: React.ReactNode }
  | { layout: "sidebar"; children: React.ReactNode; sidebar: React.ReactNode }
  | { layout: "two-column"; left: React.ReactNode; right: React.ReactNode }
  | {
      layout: "three-column";
      left: React.ReactNode;
      center: React.ReactNode;
      right: React.ReactNode;
    };

export type PageScaffoldProps = PageScaffoldBaseProps & PageScaffoldLayoutProps;

const DEFAULT_VARIANT: Record<PageScaffoldLayoutKind, PageShellVariant> = {
  single: "content",
  sidebar: "detail",
  "two-column": "detailWide",
  "three-column": "detailWide",
};

// Per-column vertical rhythm — one source of truth so every page's columns
// breathe identically.
const COLUMN_STACK = "min-w-0 space-y-8";

function renderBody(props: PageScaffoldProps): React.ReactNode {
  switch (props.layout) {
    case "single":
      return <div className={cn(COLUMN_STACK)}>{props.children}</div>;

    case "sidebar":
      return <DetailLayout sidebar={props.sidebar}>{props.children}</DetailLayout>;

    case "two-column":
      return (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className={COLUMN_STACK}>{props.left}</div>
          <div className={COLUMN_STACK}>{props.right}</div>
        </div>
      );

    case "three-column":
      return (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className={COLUMN_STACK}>{props.left}</div>
          <div className={COLUMN_STACK}>{props.center}</div>
          <div className={COLUMN_STACK}>{props.right}</div>
        </div>
      );
  }
}

export function PageScaffold(props: PageScaffoldProps) {
  const {
    layout,
    title,
    variant,
    eyebrow,
    description,
    actions,
    statusBadge,
    breadcrumbs,
    tabs,
    showExportButton,
    onExportCSV,
    onExportPDF,
    className,
  } = props;

  return (
    <PageShell
      variant={variant ?? DEFAULT_VARIANT[layout]}
      title={title}
      eyebrow={eyebrow}
      description={description}
      actions={actions}
      statusBadge={statusBadge}
      breadcrumbs={breadcrumbs}
      tabs={tabs}
      showExportButton={showExportButton}
      onExportCSV={onExportCSV}
      onExportPDF={onExportPDF}
      contentClassName={className}
    >
      {renderBody(props)}
    </PageShell>
  );
}
