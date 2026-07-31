/**
 * REFERENCE COMPONENTS FOR CLAUDE CODE
 * =====================================
 * 
 * These are COPY-PASTE-READY patterns for the Aldo/Alleato app.
 * When building any screen, find the closest pattern here and adapt it.
 * Do NOT invent new visual patterns — use these.
 * 
 * Tech stack: React 18+, TypeScript, Tailwind CSS, shadcn/ui, Next.js App Router
 * Theme: Light mode, Procore orange accent (hsl(24, 95%, 53%))
 * 
 * IMPORTANT: These components use standard Tailwind classes that map to the
 * existing shadcn/ui CSS variables (text-foreground, text-muted-foreground, etc.)
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Users,
  Clock,
  Calendar,
} from "lucide-react";

// ============================================================================
// 1. KPI BLOCK — The fundamental metric display unit
// ============================================================================

interface KpiBlockProps {
  label: string;
  value: string;
  delta?: {
    value: string;
    positive: boolean;
  };
  context?: string;
  /** Use "prominent" for hero stats, "compact" for secondary stats */
  size?: "prominent" | "compact";
}

/**
 * KpiBlock — Renders a single metric with proper 3-tier text hierarchy.
 * 
 * Usage:
 *   <KpiBlock label="Total Budget" value="$9.3M" context="Original contract value" />
 *   <KpiBlock label="Revenue" value="$24K" delta={{ value: "12.4%", positive: true }} context="vs $21.3K last month" />
 */
export function KpiBlock({ label, value, delta, context, size = "prominent" }: KpiBlockProps) {
  return (
    <div>
      {/* Tier 1: Eyebrow — always the same */}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>

      {/* Tier 2: Value + delta */}
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground",
            size === "prominent" ? "text-2xl" : "text-lg"
          )}
        >
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
              delta.positive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            )}
          >
            {delta.positive ? "↑" : "↓"} {delta.value}
          </span>
        )}
      </div>

      {/* Tier 4: Context */}
      {context && (
        <span className="mt-0.5 block text-xs text-muted-foreground/60">
          {context}
        </span>
      )}
    </div>
  );
}


// ============================================================================
// 2. KPI ROW — Bento-style unified container for 3-4 metrics
// ============================================================================

/**
 * KpiRow — Renders multiple KpiBlocks inside a shared container with dividers.
 * This avoids the "card trap" of wrapping each metric in its own bordered card.
 * 
 * Usage:
 *   <KpiRow
 *     metrics={[
 *       { label: "Total Budget", value: "$9.3M", context: "Original contract value" },
 *       { label: "Committed", value: "—", context: "No contracts yet" },
 *       { label: "Remaining", value: "$9.3M", delta: { value: "100%", positive: true }, context: "100% unallocated" },
 *       { label: "Open Items", value: "—", context: "Nothing pending" },
 *     ]}
 *   />
 */
export function KpiRow({ metrics }: { metrics: KpiBlockProps[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div
        className={cn(
          "grid divide-x divide-gray-100",
          metrics.length === 4 && "grid-cols-4",
          metrics.length === 3 && "grid-cols-3",
          metrics.length === 2 && "grid-cols-2"
        )}
      >
        {metrics.map((metric, i) => (
          <div key={i} className="px-6 py-5">
            <KpiBlock {...metric} />
          </div>
        ))}
      </div>
    </div>
  );
}


// ============================================================================
// 3. SECTION HEADER — The standard way to introduce a content section
// ============================================================================

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: {
    label: string;
    href: string;
  };
}

/**
 * SectionHeader — Title + optional count + optional action link.
 * 
 * Usage:
 *   <SectionHeader title="Meetings" count={57} action={{ label: "View all", href: "/meetings" }} />
 */
export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-sm text-muted-foreground/60">{count}</span>
        )}
      </div>
      {action && (
        <a
          href={action.href}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}


// ============================================================================
// 4. MEETING LIST ITEM — Rich list row with date, content, and avatars
// ============================================================================

interface MeetingListItemProps {
  month: string;
  day: string;
  title: string;
  summary: string;
  attendeeCount: number;
  attendeeAvatars: string[]; // Array of initials, e.g. ["BC", "JD"]
  overflowCount?: number;
  duration?: string;
  href: string;
}

/**
 * MeetingListItem — A single meeting in a feed/list.
 * 
 * Key design decisions:
 * - Entire row is hoverable (group pattern)
 * - Title gets accent color on hover
 * - Summary is clamped to 2 lines
 * - Date column acts as visual anchor
 * - Meta row uses Tier 4 text
 */
export function MeetingListItem({
  month,
  day,
  title,
  summary,
  attendeeCount,
  attendeeAvatars,
  overflowCount,
  duration,
  href,
}: MeetingListItemProps) {
  return (
    <a
      href={href}
      className="group -mx-2 flex gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-gray-50"
    >
      {/* Date column */}
      <div className="w-12 flex-shrink-0 pt-0.5 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {month}
        </div>
        <div className="text-xl font-semibold tracking-tight text-foreground">
          {day}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-sm font-medium text-foreground transition-colors group-hover:text-orange-600">
            {title}
          </h3>

          {/* Avatar stack */}
          <div className="flex flex-shrink-0 -space-x-1.5">
            {attendeeAvatars.map((initials, i) => (
              <div
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-muted-foreground ring-2 ring-white"
              >
                {initials}
              </div>
            ))}
            {overflowCount && overflowCount > 0 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-[10px] font-medium text-muted-foreground ring-2 ring-white">
                +{overflowCount}
              </div>
            )}
          </div>
        </div>

        {/* Summary — 2 line clamp */}
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
          {summary}
        </p>

        {/* Meta row */}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/60">
          {duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {duration}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {attendeeCount} attendees
          </span>
        </div>
      </div>
    </a>
  );
}


// ============================================================================
// 5. NAV SIDEBAR — Right-side category navigation
// ============================================================================

interface NavSection {
  label: string;
  items: {
    name: string;
    href: string;
    count?: number;
    active?: boolean;
  }[];
}

/**
 * NavSidebar — Sticky right sidebar with categorized navigation links.
 * 
 * Usage:
 *   <NavSidebar
 *     sections={[
 *       {
 *         label: "Financial",
 *         items: [
 *           { name: "Budget", href: "/budget" },
 *           { name: "Prime Contracts", href: "/contracts", count: 1 },
 *         ],
 *       },
 *     ]}
 *   />
 */
export function NavSidebar({ sections }: { sections: NavSection[] }) {
  return (
    <aside className="hidden w-56 flex-shrink-0 border-l border-gray-200 bg-white lg:block">
      <div className="sticky top-0 h-screen overflow-y-auto p-5">
        <nav className="space-y-6">
          {sections.map((section, i) => (
            <div key={i}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item, j) => (
                  <a
                    key={j}
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                      item.active
                        ? "bg-gray-100 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
                    )}
                  >
                    <span>{item.name}</span>
                    {item.count !== undefined && (
                      <span className="text-xs tabular-nums text-muted-foreground/60">
                        {item.count}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}


// ============================================================================
// 6. PAGE HEADER — Breadcrumb + title + actions
// ============================================================================

interface PageHeaderProps {
  breadcrumbs: { label: string; href?: string }[];
  projectCode?: string;
  title: string;
  actions?: React.ReactNode;
}

/**
 * PageHeader — Standard page header with breadcrumbs, optional code, title, and actions.
 */
export function PageHeader({ breadcrumbs, projectCode, title, actions }: PageHeaderProps) {
  return (
    <div className="border-b border-gray-200 bg-white px-6 py-5">
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <span className="text-muted-foreground/40">›</span>
            )}
            {crumb.href ? (
              <a
                href={crumb.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.label}
              </a>
            ) : (
              <span className="font-medium text-foreground">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Title row */}
      <div className="flex items-center justify-between">
        <div>
          {projectCode && (
            <span className="text-xs text-muted-foreground/60">{projectCode}</span>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}


// ============================================================================
// 7. BUTTON VARIANTS — The 3 you should use
// ============================================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Button — 3 variants, 2 sizes, proper interactive states.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        // Variant
        variant === "primary" &&
          "rounded-md bg-orange-500 text-white shadow-sm hover:bg-orange-600",
        variant === "secondary" &&
          "rounded-md border border-gray-200 bg-white text-foreground shadow-sm hover:bg-gray-50",
        variant === "ghost" &&
          "rounded-md text-muted-foreground hover:bg-gray-100 hover:text-foreground",
        // Size
        size === "md" && "px-3 py-1.5 text-sm",
        size === "sm" && "px-2 py-1 text-xs",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}


// ============================================================================
// 8. STATUS INDICATOR — Dot + label (for tables and inline use)
// ============================================================================

type StatusVariant = "success" | "warning" | "error" | "info" | "neutral";

interface StatusDotProps {
  variant: StatusVariant;
  label: string;
}

const statusStyles: Record<StatusVariant, { dot: string; text: string }> = {
  success: { dot: "bg-emerald-500", text: "text-muted-foreground" },
  warning: { dot: "bg-amber-500", text: "text-muted-foreground" },
  error: { dot: "bg-red-500", text: "text-muted-foreground" },
  info: { dot: "bg-blue-500", text: "text-muted-foreground" },
  neutral: { dot: "bg-gray-400", text: "text-muted-foreground" },
};

/**
 * StatusDot — Minimal inline status indicator. Dot + label, not a full badge.
 * Use in tables, lists, and anywhere status needs to be shown without visual weight.
 */
export function StatusDot({ variant, label }: StatusDotProps) {
  const style = statusStyles[variant];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      <span className={style.text}>{label}</span>
    </span>
  );
}


// ============================================================================
// 9. STATUS BADGE — For tags, categories, and emphasized status
// ============================================================================

const badgeStyles: Record<StatusVariant, string> = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  neutral: "bg-gray-100 text-gray-600",
};

export function StatusBadge({ variant, label }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
        badgeStyles[variant]
      )}
    >
      {label}
    </span>
  );
}


// ============================================================================
// 10. EMPTY STATE — Never just "No data"
// ============================================================================

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * EmptyState — Always: icon + title + description + optional action.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600"
        >
          <Plus className="h-3.5 w-3.5" />
          {action.label}
        </button>
      )}
    </div>
  );
}


// ============================================================================
// 11. DATA TABLE — Premium table pattern
// ============================================================================

interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  /** If true, uses primary text weight (for the identifier column) */
  primary?: boolean;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
}

/**
 * PremiumTable — Correct table styling with:
 * - 11px uppercase tracking-wider headers
 * - First column in primary weight
 * - Subtle row dividers (divide-gray-100, not border-gray-200)
 * - Row hover state
 * - Tabular nums for number columns
 */
export function PremiumTable<T extends { id: string | number }>({
  columns,
  rows,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-200">
          {columns.map((col) => (
            <th
              key={col.key}
              className={cn(
                "pb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                col.align === "right" ? "text-right" : "text-left"
              )}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "transition-colors",
              onRowClick && "cursor-pointer hover:bg-gray-50/50"
            )}
          >
            {columns.map((col) => (
              <td
                key={col.key}
                className={cn(
                  "py-3 text-sm",
                  col.primary
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                  col.align === "right" && "text-right tabular-nums"
                )}
              >
                {col.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}


// ============================================================================
// 12. AVATAR STACK — Overlapping avatar circles
// ============================================================================

interface AvatarStackProps {
  avatars: string[]; // Array of initials
  max?: number;
  size?: "sm" | "md";
}

/**
 * AvatarStack — Overlapping circles with initials.
 * Shows first `max` avatars, then "+N" overflow.
 */
export function AvatarStack({ avatars, max = 3, size = "sm" }: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;

  return (
    <div className="flex -space-x-1.5">
      {visible.map((initials, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-center rounded-full bg-gray-200 font-medium text-muted-foreground ring-2 ring-white",
            size === "sm" && "h-6 w-6 text-[10px]",
            size === "md" && "h-8 w-8 text-xs"
          )}
        >
          {initials}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-gray-300 font-medium text-muted-foreground ring-2 ring-white",
            size === "sm" && "h-6 w-6 text-[10px]",
            size === "md" && "h-8 w-8 text-xs"
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}


// ============================================================================
// 13. COMPLETE PAGE EXAMPLE: Project Home
// ============================================================================

/**
 * This is a COMPLETE working example of the Project Home page layout.
 * Use this as the reference when building any project-level page.
 * 
 * Structure:
 * - Page header (breadcrumb + title + actions)
 * - KPI row (bento style)
 * - Meetings list (with proper hierarchy)
 * - Right sidebar navigation
 */
export function ProjectHomeExample() {
  const kpiMetrics: KpiBlockProps[] = [
    { label: "Total Budget", value: "$9.3M", context: "Original contract value" },
    { label: "Committed", value: "—", context: "No contracts yet" },
    {
      label: "Remaining",
      value: "$9.3M",
      delta: { value: "100%", positive: true },
      context: "100% unallocated",
    },
    { label: "Open Items", value: "—", context: "Nothing pending" },
  ];

  const navSections: NavSection[] = [
    {
      label: "Financial",
      items: [
        { name: "Budget", href: "#" },
        { name: "Prime Contracts", href: "#", count: 1 },
        { name: "Commitments", href: "#" },
        { name: "Direct Costs", href: "#" },
        { name: "Invoices", href: "#" },
        { name: "Change Orders", href: "#" },
        { name: "Change Events", href: "#" },
      ],
    },
    {
      label: "Project",
      items: [
        { name: "Schedule", href: "#" },
        { name: "RFIs", href: "#" },
        { name: "Submittals", href: "#" },
        { name: "Daily Log", href: "#" },
        { name: "Punch List", href: "#" },
        { name: "Meetings", href: "#", count: 57, active: true },
      ],
    },
    {
      label: "Files",
      items: [
        { name: "Drawings", href: "#" },
        { name: "Documents", href: "#" },
        { name: "Photos", href: "#" },
        { name: "Specifications", href: "#" },
      ],
    },
    {
      label: "Directory",
      items: [
        { name: "Users", href: "#" },
        { name: "Companies", href: "#" },
        { name: "Contacts", href: "#" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Projects", href: "/projects" },
          { label: "Westfield Collective" },
        ]}
        projectCode="24-115"
        title="Westfield Collective"
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />}>
              Edit Project
            </Button>
            <Button variant="primary" icon={<ChevronRight className="h-3.5 w-3.5" />}>
              Setup Checklist
            </Button>
          </>
        }
      />

      {/* Body: content + sidebar */}
      <div className="flex">
        {/* Main content */}
        <div className="min-w-0 flex-1 px-6 py-6">
          <div className="max-w-4xl space-y-12">
            {/* KPI Row */}
            <section>
              <KpiRow metrics={kpiMetrics} />
            </section>

            {/* Meetings Section */}
            <section>
              <SectionHeader
                title="Meetings"
                count={57}
                action={{ label: "View all", href: "/meetings" }}
              />
              <div className="divide-y divide-gray-100">
                <MeetingListItem
                  month="Feb"
                  day="24"
                  title="OAC- Westfield Collective"
                  summary="Construction is nearing completion with key installations in plumbing, electrical, and wood trim starting soon. An impromptu inspection raised concerns regarding door and sprinkler placements, but these won't hinder obtaining the Temporary Certificate of Occupancy (TCO)."
                  attendeeCount={15}
                  attendeeAvatars={["BC", "JD"]}
                  overflowCount={12}
                  href="/meetings/1"
                />
                <MeetingListItem
                  month="Feb"
                  day="17"
                  title="Westfield Collective: Beer Line Discussion"
                  summary="The team discussed the rerouting of 4.5-inch PVC beer lines under the bar to prevent interference with coolers and floor conditions. They agreed on trenching and sleeving to protect the lines from moisture and temperature changes."
                  attendeeCount={6}
                  attendeeAvatars={["AL", "DS"]}
                  overflowCount={3}
                  href="/meetings/2"
                />
              </div>
            </section>
          </div>
        </div>

        {/* Right sidebar */}
        <NavSidebar sections={navSections} />
      </div>
    </div>
  );
}
