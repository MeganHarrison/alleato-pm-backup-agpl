import * as React from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { forwardRef } from "react";

const detailGridClassMap = {
  default:
    "grid grid-cols-1 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(340px,420px)] lg:gap-x-12",
  compact:
    "grid grid-cols-1 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,380px)] lg:gap-x-10",
} as const;

export interface ContentSectionStackProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentSectionStack({
  children,
  className,
}: ContentSectionStackProps) {
  return <div className={cn("space-y-12", className)}>{children}</div>;
}

export interface DetailThreeColumnGridProps {
  children: React.ReactNode;
  className?: string;
  density?: keyof typeof detailGridClassMap;
}

export function DetailThreeColumnGrid({
  children,
  className,
  density = "default",
}: DetailThreeColumnGridProps) {
  return (
    <div className={cn(detailGridClassMap[density], className)}>{children}</div>
  );
}

export interface DetailPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function DetailPanel({ children, className }: DetailPanelProps) {
  return (
    <div className={cn("rounded-md", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryPanel — the tinted "summary" container for detail-page sidebars
// (financial summary, totals, rollups). Owns the very-light-gray surface
// (#F9F9F9 via --surface-summary), rounding, and padding so the background is
// defined in ONE place and can never drift. Use this instead of
// `<DetailPanel className="rounded-lg bg-muted p-6">` for any summary block.
// ---------------------------------------------------------------------------
export function SummaryPanel({ children, className }: DetailPanelProps) {
  return (
    <div className={cn("summary-panel rounded-lg bg-surface-summary", className)}>
      {children}
    </div>
  );
}

export interface SectionRuleHeadingProps {
  label: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  as?: "div" | "h2" | "h3";
}

export function SectionRuleHeading({
  label,
  className,
  icon,
  actions,
  as: Heading = "div",
}: SectionRuleHeadingProps) {
  return (
    <Heading className={cn("flex items-center gap-3 pb-1 mb-4", className)}>
      {icon ? <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">{icon}</span> : null}
      <Eyebrow>{label}</Eyebrow>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </Heading>
  );
}

// ---------------------------------------------------------------------------
// SectionAction — the ONLY permitted action button in SectionRuleHeading.
// Forces variant="outline" size="sm" so section CTAs always look distinct
// from heading text. Never pass a raw <Button variant="ghost"> as an action.
// ---------------------------------------------------------------------------
export interface SectionActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  disabled?: boolean;
}

export const SectionAction = forwardRef<HTMLButtonElement, SectionActionProps>(
  ({ children, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="outline"
        size="sm"
        disabled={disabled}
        className={cn("h-9 text-xs sm:h-7", className)}
        {...props}
      >
        {children}
      </Button>
    );
  },
);

SectionAction.displayName = "SectionAction";

export interface LabelValueRowProps {
  label: string;
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  missing?: boolean;
  stacked?: boolean;
}

export function LabelValueRow({
  label,
  children,
  className,
  labelClassName,
  valueClassName,
  missing,
}: LabelValueRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]",
        className,
      )}
    >
      <dt
        className={cn(
          "min-w-0 pt-0.5 text-xs text-muted-foreground",
          labelClassName,
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 text-left text-sm",
          missing
            ? "text-muted-foreground/50"
            : "font-medium text-foreground",
          valueClassName,
        )}
      >
        {children ?? "—"}
      </dd>
    </div>
  );
}

export interface SummaryValueRowProps {
  label: string;
  value: string;
  className?: string;
  bold?: boolean;
  border?: boolean;
}

export function SummaryValueRow({
  label,
  value,
  className,
  bold,
  border,
}: SummaryValueRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        border && "border-t border-border/40 pt-3",
        className,
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm tabular-nums",
          bold ? "text-base font-semibold" : "font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
