/**
 * REFERENCE COMPONENTS FOR CLAUDE CODE
 * =====================================
 *
 * These are COPY-PASTE-READY patterns for the Alleato app.
 * When building any screen, find the closest pattern here and adapt it.
 * Do NOT invent new visual patterns — use these.
 *
 * Tech stack: React 18+, TypeScript, Tailwind CSS, shadcn/ui, Next.js App Router
 * Theme: Light mode
 * 
 * CRITICAL: All colors use semantic tokens (text-foreground, bg-muted, etc.)
 * NEVER use hardcoded colors (bg-gray-200, text-orange-600, border-gray-200).
 * See tokens.md for the full token list.
 */

import type * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Clock, Plus, Users } from "lucide-react";

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
 *   <KpiBlock label="Revenue" value="$24K" delta={{ value: "12.4%", positive: true }} />
 */
export function KpiBlock({ label, value, delta, context, size = "prominent" }: KpiBlockProps) {
  return (
    <div>
      {/* Tier 1: Eyebrow */}
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
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
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
 * Avoids the "card trap" of wrapping each metric in its own bordered card.
 */
export function KpiRow({ metrics }: { metrics: KpiBlockProps[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div
        className={cn(
          "grid divide-x divide-border",
          metrics.length === 4 && "grid-cols-4",
          metrics.length === 3 && "grid-cols-3",
          metrics.length === 2 && "grid-cols-2"
        )}
      >
        {metrics.map((metric, i) => (
          <div key={i} className="px-6 py-4">
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
  attendeeAvatars: string[];
  overflowCount?: number;
  duration?: string;
  href: string;
}

/**
 * MeetingListItem — A single meeting in a feed/list.
 *
 * Key design decisions:
 * - Entire row is hoverable (group pattern)
 * - Title gets brand accent on hover via group-hover:text-primary
 * - Summary is clamped to 2 lines
 * - Date column acts as visual anchor
 * - Meta row uses Tier 4 text (text-muted-foreground/60)
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
      className="group -mx-2 flex gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-muted"
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
          <h3 className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
            {title}
          </h3>

          {/* Avatar stack */}
          <div className="flex flex-shrink-0 -space-x-1.5">
            {attendeeAvatars.map((initials, i) => (
              <div
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background"
              >
                {initials}
              </div>
            ))}
            {overflowCount && overflowCount > 0 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
                +{overflowCount}
              </div>
            )}
          </div>
        </div>

        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {summary}
        </p>

        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground/60">
          {duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {duration}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-4 w-4" />
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

export function NavSidebar({ sections }: { sections: NavSection[] }) {
  return (
    <aside className="hidden w-56 flex-shrink-0 border-l border-border bg-card lg:block">
      <div className="sticky top-0 h-screen overflow-y-auto p-6">
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
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
// 6. STATUS INDICATORS
// ============================================================================

type StatusVariant = "success" | "warning" | "error" | "info" | "neutral";

interface StatusDotProps {
  variant: StatusVariant;
  label: string;
}

const statusDotColors: Record<StatusVariant, string> = {
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-muted-foreground/40",
};

/** StatusDot — Minimal inline status indicator for tables and lists. */
export function StatusDot({ variant, label }: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDotColors[variant])} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

const badgeStyles: Record<StatusVariant, string> = {
  success: "bg-green-50 text-green-600",
  warning: "bg-yellow-50 text-yellow-600",
  error: "bg-red-50 text-red-600",
  info: "bg-blue-50 text-blue-600",
  neutral: "bg-muted text-muted-foreground",
};

/** StatusBadge — For tags, categories, and emphasized status. */
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
// 7. EMPTY STATE
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

/** EmptyState — Always: icon + title + description + optional action. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-4" size="sm">
          <Plus className="h-4 w-4" />
          {action.label}
        </Button>
      )}
    </div>
  );
}


// ============================================================================
// 8. DATA TABLE — Premium table pattern
// ============================================================================

interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  primary?: boolean;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
}

/**
 * PremiumTable — Correct table styling:
 * - 11px uppercase tracking-wider headers
 * - First column in primary weight
 * - Subtle row dividers (divide-border)
 * - Row hover state (hover:bg-muted)
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
        <tr className="border-b border-border">
          {columns.map((col) => (
            <th
              key={col.key}
              className={cn(
                "pb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                col.align === "right" ? "text-right" : "text-left"
              )}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "transition-colors",
              onRowClick && "cursor-pointer hover:bg-muted"
            )}
          >
            {columns.map((col) => (
              <td
                key={col.key}
                className={cn(
                  "py-4 text-sm",
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
// 9. AVATAR STACK
// ============================================================================

interface AvatarStackProps {
  avatars: string[];
  max?: number;
  size?: "sm" | "md";
}

export function AvatarStack({ avatars, max = 3, size = "sm" }: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;

  return (
    <div className="flex -space-x-1.5">
      {visible.map((initials, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background",
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
            "flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background",
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
