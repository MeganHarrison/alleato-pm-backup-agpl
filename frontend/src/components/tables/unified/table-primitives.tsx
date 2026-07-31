"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { MoreVertical } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/ds/status-badge";
import { parseDisplayDate } from "@/lib/date-utils";

export type TableBadgeVariant = "default" | "secondary" | "outline";

interface TableCountIndicatorProps {
  count: number;
  className?: string;
}

export function TableCountIndicator({ count, className }: TableCountIndicatorProps): React.ReactElement | null {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground",
        className,
      )}
    >
      {count}
    </span>
  );
}

interface TableDateValueProps {
  value: string | Date | null | undefined;
  showTime?: boolean;
  emptyLabel?: string;
  className?: string;
}

export function TableDateValue({
  value,
  showTime = false,
  emptyLabel = "—",
  className,
}: TableDateValueProps): React.ReactElement {
  if (!value) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{emptyLabel}</span>;
  }

  const parsed = parseDisplayDate(value);
  if (Number.isNaN(parsed.getTime())) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{emptyLabel}</span>;
  }

  const dateLabel = parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!showTime) {
    return <span className={cn("text-xs text-foreground", className)}>{dateLabel}</span>;
  }

  const timeLabel = parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className="text-foreground">{dateLabel}</span>
      <span className="text-muted-foreground">•</span>
      <span className="text-muted-foreground">{timeLabel}</span>
    </span>
  );
}

function resolveStatusDotClass(status: string | null | undefined): string {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (!normalized) return "bg-muted-foreground/40";

  if (
    normalized.includes("complete") ||
    normalized.includes("done") ||
    normalized.includes("embedded") ||
    normalized.includes("approved") ||
    normalized.includes("paid")
  ) {
    return "bg-[hsl(var(--status-success))]";
  }

  if (
    normalized.includes("processing") ||
    normalized.includes("pending") ||
    normalized.includes("running") ||
    normalized.includes("submitted")
  ) {
    return "bg-[hsl(var(--status-warning))]";
  }

  if (normalized.includes("error") || normalized.includes("failed") || normalized.includes("rejected")) {
    return "bg-[hsl(var(--status-error))]";
  }

  return "bg-[hsl(var(--status-info))]";
}

interface TableStatusDotProps {
  status: string | null | undefined;
  fallbackLabel?: string;
  className?: string;
}

export function TableStatusDot({
  status,
  fallbackLabel = "Unknown",
  className,
}: TableStatusDotProps): React.ReactElement {
  const label = status?.trim() || fallbackLabel;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-block h-2 w-2 rounded-full flex-shrink-0", resolveStatusDotClass(status), className)} />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface TableTagBadgeProps {
  label: string | null | undefined;
  variant?: TableBadgeVariant;
  emptyLabel?: string;
  className?: string;
}

export function TableTagBadge({
  label,
  variant = "outline",
  emptyLabel = "—",
  className,
}: TableTagBadgeProps): React.ReactElement {
  const displayLabel = label?.trim() || emptyLabel;
  return (
    <Badge variant={variant} className={cn("font-normal", className)}>
      {displayLabel}
    </Badge>
  );
}

function getParticipantInitials(value: string): string {
  const cleaned = value.replace(/^[^a-zA-Z0-9]+/, "");
  const tokenized = cleaned.split("@")[0]?.split(/[._\-\s]+/).filter(Boolean) ?? [];
  if (tokenized.length >= 2) {
    return `${tokenized[0][0]}${tokenized[tokenized.length - 1][0]}`.toUpperCase();
  }
  const first = tokenized[0] ?? cleaned;
  return first.slice(0, 2).toUpperCase();
}

export function formatParticipantDisplayName(value: string): string {
  const cleaned = value.replace(/^[^a-zA-Z0-9]+/, "");
  const tokenized = cleaned.split("@")[0]?.split(/[._\-\s]+/).filter(Boolean) ?? [];
  if (tokenized.length === 0) return value;

  return tokenized
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

interface TableAvatarUsersProps {
  users: string[];
  maxVisible?: number;
  className?: string;
}

export function TableAvatarUsers({
  users,
  maxVisible = 4,
  className,
}: TableAvatarUsersProps): React.ReactElement | null {
  if (users.length === 0) return null;

  const visibleUsers = users.slice(0, maxVisible);
  const hiddenCount = Math.max(0, users.length - visibleUsers.length);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("inline-flex", className)} onClick={(event) => event.stopPropagation()}>
            <AvatarGroup className="justify-start">
              {visibleUsers.map((user) => (
                <Avatar key={user} className="h-7 w-7">
                  <AvatarFallback className="text-[10px] font-semibold">
                    {getParticipantInitials(user)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {hiddenCount > 0 ? (
                <AvatarGroupCount className="h-7 w-7 text-[10px] font-semibold">
                  +{hiddenCount}
                </AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-80">
          <div className="space-y-1">
            <p className="text-xs font-semibold">Participants ({users.length})</p>
            <ul className="space-y-1">
              {users.map((user) => (
                <li key={user} className="text-xs opacity-70">
                  {formatParticipantDisplayName(user)}
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface TableIconLinkItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

interface TableIconLinksProps {
  items: TableIconLinkItem[];
  className?: string;
}

export function TableIconLinks({ items, className }: TableIconLinksProps): React.ReactElement | null {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2", className)} onClick={(event) => event.stopPropagation()}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <a
            key={`${item.href}-${item.label}`}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            title={item.label}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Cell Renderers — reusable data-type components for table columns.
 *
 * Usage in column definitions:
 *   render: (item) => <CellBadge value={item.type} colorMap={contactTypeColors} />
 *   render: (item) => <CellLink value={item.company} href={`/companies/${item.companyId}`} />
 *   render: (item) => <CellText value={item.phone} />
 * ------------------------------------------------------------------------- */

/** A map from lowercase value → Tailwind classes for badge coloring. */
export type CellColorMap = Record<string, string>;

// ── CellText ────────────────────────────────────────────────────────────────

interface CellTextProps {
  value: string | null | undefined;
  emptyLabel?: string;
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** Plain text cell. Renders `emptyLabel` when value is falsy. */
export function CellText({
  value,
  emptyLabel = "—",
  muted = false,
  className,
  style,
}: CellTextProps): React.ReactElement {
  const display = value?.trim() || emptyLabel;
  return (
    <span className={cn(muted ? "text-muted-foreground" : undefined, className)} style={style}>
      {display}
    </span>
  );
}

interface CellStackTextProps {
  primary: string | null | undefined;
  secondary?: string | null | undefined;
  icon?: React.ReactNode;
  emptyLabel?: string;
}

/** Two-line text cell for table rows that need supporting metadata. */
export function CellStackText({
  primary,
  secondary,
  icon,
  emptyLabel = "—",
}: CellStackTextProps): React.ReactElement {
  const display = primary?.trim() || emptyLabel;
  const support = secondary?.trim();

  return (
    <span className="flex min-w-0 items-center gap-2">
      {icon ? (
        <span className="shrink-0 text-muted-foreground">{icon}</span>
      ) : null}
      <span className="min-w-0">
        <span className="block truncate">{display}</span>
        {support ? (
          <span className="block truncate text-muted-foreground">{support}</span>
        ) : null}
      </span>
    </span>
  );
}

// ── CellBadge ───────────────────────────────────────────────────────────────

interface CellBadgeProps {
  value: string | null | undefined;
  /** Map of lowercase value → Tailwind color classes. Unmatched values use a muted fallback. */
  colorMap?: CellColorMap;
  /** Capitalize the displayed label (default true). */
  capitalize?: boolean;
  emptyLabel?: string;
  className?: string;
}

const CELL_BADGE_FALLBACK = "bg-muted text-muted-foreground";

/** Colored pill/badge for categorical values like type, role, status. */
export function CellBadge({
  value,
  colorMap,
  capitalize = true,
  emptyLabel = "—",
  className,
}: CellBadgeProps): React.ReactElement {
  if (!value?.trim()) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  // Clean up raw DB values: replace underscores with spaces, then title-case each word
  const cleaned = value.replace(/_/g, " ");
  const label = capitalize
    ? cleaned.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    : cleaned;

  const lookupKey = cleaned.toLowerCase();
  const colors = colorMap?.[lookupKey] ?? colorMap?.[value.toLowerCase()] ?? CELL_BADGE_FALLBACK;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors,
        className,
      )}
    >
      {label}
    </span>
  );
}

// ── CellLink ────────────────────────────────────────────────────────────────

interface CellLinkProps {
  value: string | null | undefined;
  href: string | null | undefined;
  emptyLabel?: string;
  /** Open in new tab (default false). */
  external?: boolean;
  className?: string;
}

export const TABLE_LINK_CLASSNAME =
  "text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/40";

/** Clickable text that navigates to a detail page. Falls back to plain text when href is absent. */
export function CellLink({
  value,
  href,
  emptyLabel = "—",
  external = false,
  className,
}: CellLinkProps): React.ReactElement {
  const display = value?.trim();
  if (!display) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  if (!href) {
    return <span className={className}>{display}</span>;
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(TABLE_LINK_CLASSNAME, className)}
        onClick={(e) => e.stopPropagation()}
      >
        {display}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={cn(TABLE_LINK_CLASSNAME, className)}
      onClick={(e) => e.stopPropagation()}
    >
      {display}
    </Link>
  );
}

// ── CellEmail ───────────────────────────────────────────────────────────────

interface CellEmailProps {
  value: string | null | undefined;
  emptyLabel?: string;
  className?: string;
}

/** Email address rendered as a mailto link. */
export function CellEmail({
  value,
  emptyLabel = "—",
  className,
}: CellEmailProps): React.ReactElement {
  const display = value?.trim();
  if (!display) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <a
      href={`mailto:${display}`}
      className={cn("hover:text-primary hover:underline transition-colors", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {display}
    </a>
  );
}

// ── TruncatedCell ────────────────────────────────────────────────────────────

interface TruncatedCellProps {
  /** The text to display (truncated to one line with ellipsis). */
  value: string | null | undefined;
  /** Max width in pixels. Defaults to 320. */
  maxWidth?: number;
  emptyLabel?: string;
  className?: string;
}

/**
 * A table cell that truncates long text to a single line and shows a
 * styled tooltip with the full content on hover.
 *
 * Usage:
 *   render: (item) => <TruncatedCell value={item.title} maxWidth={360} />
 */
export function TruncatedCell({
  value,
  maxWidth = 320,
  emptyLabel = "—",
  className,
}: TruncatedCellProps): React.ReactElement {
  const display = value?.trim();
  const spanRef = React.useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  // display and maxWidth change the rendered layout, so both are valid deps
   
  React.useLayoutEffect(() => {
    const el = spanRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.offsetWidth);
    }
  }, [display, maxWidth]);

  if (!display) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

   
  const span = (
    <span
      ref={spanRef}
      className={cn("block truncate", className)}
      style={{ maxWidth }}
    >
      {display}
    </span>
  );
   

  if (!isTruncated) return span;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{span}</TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-lg border bg-popover px-3 py-2 text-popover-foreground shadow-sm"
        >
          <p className="text-xs leading-relaxed whitespace-pre-wrap">
            {display}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── CellCurrency ─────────────────────────────────────────────────────────────

interface CellCurrencyProps {
  value: number | string | null | undefined;
  emptyLabel?: string;
  muted?: boolean;
  className?: string;
}

/** Currency cell. Formats as USD with commas. Always uses tabular-nums. */
export function CellCurrency({
  value,
  emptyLabel = "—",
  muted = false,
  className,
}: CellCurrencyProps): React.ReactElement {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
  return (
    <span className={cn("tabular-nums", muted ? "text-muted-foreground" : undefined, className)}>
      {formatted}
    </span>
  );
}

// ── CellNumber ────────────────────────────────────────────────────────────────

interface CellNumberProps {
  value: number | string | null | undefined;
  decimals?: number;
  emptyLabel?: string;
  muted?: boolean;
  className?: string;
}

/** Plain number cell with optional decimal places and tabular-nums font. */
export function CellNumber({
  value,
  decimals = 0,
  emptyLabel = "—",
  muted = false,
  className,
}: CellNumberProps): React.ReactElement {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
  return (
    <span className={cn("tabular-nums", muted ? "text-muted-foreground" : undefined, className)}>
      {formatted}
    </span>
  );
}

// ── CellPercent ───────────────────────────────────────────────────────────────

interface CellPercentProps {
  value: number | string | null | undefined;
  decimals?: number;
  emptyLabel?: string;
  muted?: boolean;
  className?: string;
}

/** Percentage cell. Appends % symbol with tabular-nums. */
export function CellPercent({
  value,
  decimals = 1,
  emptyLabel = "—",
  muted = false,
  className,
}: CellPercentProps): React.ReactElement {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }
  const safeDec = Math.min(100, Math.max(0, Math.floor(decimals)));
  return (
    <span className={cn("tabular-nums", muted ? "text-muted-foreground" : undefined, className)}>
      {num.toFixed(safeDec)}%
    </span>
  );
}

// ── CellDate ──────────────────────────────────────────────────────────────────

interface CellDateProps {
  value: string | Date | null | undefined;
  showTime?: boolean;
  emptyLabel?: string;
  className?: string;
}

/** Date cell. Wraps TableDateValue for consistent formatting across all tables. */
export function CellDate({
  value,
  showTime = false,
  emptyLabel = "—",
  className,
}: CellDateProps): React.ReactElement {
  return (
    <TableDateValue
      value={value}
      showTime={showTime}
      emptyLabel={emptyLabel}
      className={className}
    />
  );
}

// ── CellStatus ────────────────────────────────────────────────────────────────

interface CellStatusProps {
  value: string | null | undefined;
  emptyLabel?: string;
  className?: string;
}

/** Status badge cell. Uses StatusBadge with automatic color mapping from STATUS_TO_VARIANT. */
export function CellStatus({
  value,
  emptyLabel = "—",
  className,
}: CellStatusProps): React.ReactElement {
  const normalized = value?.trim();
  if (!normalized) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }
  return <StatusBadge status={normalized} className={className} />;
}

// ── Legacy exports below ────────────────────────────────────────────────────

export interface TableRowActionItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface TableRowActionsMenuProps {
  items: TableRowActionItem[];
  align?: "start" | "center" | "end";
}

export function TableRowActionsMenu({
  items,
  align = "end",
}: TableRowActionsMenuProps): React.ReactElement | null {
  const visibleItems = items.filter((item) => Boolean(item.label));
  if (visibleItems.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical />
          <span className="sr-only">Open actions menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.key}
              onClick={item.onSelect}
              disabled={item.disabled}
              className={item.destructive ? "text-destructive focus:text-destructive" : undefined}
            >
              {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
