"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* =============================================================================
   SECTION CARD - Premium Collapsible Section Component
   =============================================================================
   A reusable, consistent section card for displaying grouped content.
   Used throughout the app for contracts, commitments, budget, team, etc.

   Features:
   - Collapsible content with smooth animation
   - Consistent header with title, actions, and collapse toggle
   - Premium styling with subtle shadows
   - Mobile-first responsive design
   - Empty state handling

   Usage:
   <SectionCard
     title="Prime Contracts"
     addHref="/contracts/new"
     viewAllHref="/contracts"
   >
     {content}
   </SectionCard>
   ============================================================================= */

interface SectionCardProps {
  /** Section title displayed in header */
  title: string;
  /** Optional URL for "Add" action */
  addHref?: string;
  /** Optional custom add action */
  onAdd?: () => void;
  /** Add button label (defaults to "Add") */
  addLabel?: string;
  /** Optional URL for "View All" action */
  viewAllHref?: string;
  /** View all button label (defaults to "View All") */
  viewAllLabel?: string;
  /** Whether the section is initially open */
  defaultOpen?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Children content */
  children: React.ReactNode;
  /** Additional className for the container */
  className?: string;
  /** Hide the collapse trigger */
  hideCollapse?: boolean;
  /** Custom header actions (replaces default add/view all) */
  headerActions?: React.ReactNode;
  /** Use brand color for title */
  brandTitle?: boolean;
}

interface SectionCardEmptyProps {
  /** Primary message */
  message: string;
  /** Secondary description */
  description?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action URL */
  actionHref?: string;
  /** Action callback */
  onAction?: () => void;
}

/* -----------------------------------------------------------------------------
   SectionCard Empty State
   ----------------------------------------------------------------------------- */
function SectionCardEmpty({
  message,
  description,
  actionLabel,
  actionHref,
  onAction,
}: SectionCardEmptyProps) {
  const ActionWrapper = actionHref ? Link : "button";

  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center">
      <p className="text-sm text-neutral-400 mb-1">{message}</p>
      {description && (
        <p className="text-xs text-neutral-400 mb-4">{description}</p>
      )}
      {(actionLabel && (actionHref || onAction)) && (
        <ActionWrapper
          href={actionHref || "#"}
          onClick={onAction}
          className="text-xs font-medium text-brand hover:text-brand/80 underline underline-offset-2 transition-colors"
        >
          {actionLabel}
        </ActionWrapper>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   SectionCard List Item
   ----------------------------------------------------------------------------- */
interface SectionCardItemProps {
  /** Item title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional metadata (number, amount, etc.) */
  meta?: React.ReactNode;
  /** Optional badge content */
  badge?: React.ReactNode;
  /** Optional status indicator */
  status?: string;
  /** Link URL */
  href?: string;
  /** Click handler */
  onClick?: () => void;
  /** Additional className */
  className?: string;
}

function SectionCardItem({
  title,
  subtitle,
  meta,
  badge,
  status,
  href,
  onClick,
  className,
}: SectionCardItemProps) {
  const Wrapper = href ? Link : "div";
  const isClickable = href || onClick;

  return (
    <Wrapper
      href={href || "#"}
      onClick={onClick}
      className={cn(
        "flex flex-wrap items-start gap-x-4 gap-y-2 py-4.5",
        "border-b border-neutral-100/80 last:border-0",
        isClickable && "cursor-pointer hover:bg-neutral-50/50 -mx-5 px-4 sm:-mx-6 sm:px-6 transition-colors",
        className
      )}
    >
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm text-neutral-900 truncate">
            {title}
          </p>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-neutral-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {/* Meta and status */}
      <div className="flex items-center gap-4 shrink-0">
        {meta && (
          <span className="text-sm font-medium text-neutral-900 tabular-nums">
            {meta}
          </span>
        )}
        {status && (
          <span className="text-xs text-neutral-500 capitalize">{status}</span>
        )}
      </div>
    </Wrapper>
  );
}

/* -----------------------------------------------------------------------------
   SectionCard Badge
   ----------------------------------------------------------------------------- */
interface SectionCardBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "brand" | "success" | "warning" | "error";
}

function SectionCardBadge({ children, variant = "default" }: SectionCardBadgeProps) {
  const variants = {
    default: "bg-muted text-muted-foreground",
    brand: "bg-brand/10 text-brand",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    error: "bg-destructive/10 text-destructive",
  };

  return (
    <span className={cn(
      "text-2xs px-2 py-0.5 uppercase tracking-wider font-medium shrink-0",
      variants[variant]
    )}>
      {children}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   SectionCard Main Component
   ----------------------------------------------------------------------------- */
function SectionCardRoot({
  title,
  addHref,
  onAdd,
  addLabel = "Add",
  viewAllHref,
  viewAllLabel = "View All",
  defaultOpen = true,
  open,
  onOpenChange,
  children,
  className,
  hideCollapse = false,
  headerActions,
  brandTitle = true,
}: SectionCardProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  return (
    <div className={cn(
      "bg-card border border-border rounded-md overflow-hidden",
      "shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]",
      className
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header */}
        <div className="px-4 py-4 sm:px-4 sm:py-4 bg-gradient-to-r from-neutral-50/30 to-transparent">
          <div className="flex items-center justify-between gap-4">
            {/* Title */}
            <h3 className={cn(
              "text-2xs sm:text-[11px] font-semibold tracking-[0.15em] uppercase",
              brandTitle ? "text-brand" : "text-neutral-500"
            )}>
              {title}
            </h3>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {headerActions ? (
                headerActions
              ) : (
                <>
                  {/* Add button */}
                  {(addHref || onAdd) && (
                    <>
                      {addHref ? (
                        <Link
                          href={addHref}
                          className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600 hover:text-brand transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={onAdd}
                          className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600 hover:text-brand transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  )}

                  {/* Separator */}
                  {(addHref || onAdd) && viewAllHref && (
                    <span className="text-neutral-200 hidden sm:inline">|</span>
                  )}

                  {/* View All link */}
                  {viewAllHref && (
                    <Link
                      href={viewAllHref}
                      className="text-xs font-medium text-neutral-600 hover:text-brand transition-colors"
                    >
                      {viewAllLabel}
                    </Link>
                  )}
                </>
              )}

              {/* Collapse trigger */}
              {!hideCollapse && (
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-6 h-6 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
                    aria-label={isOpen ? "Collapse section" : "Expand section"}
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <CollapsibleContent>
          <div className="px-4 py-4 sm:px-4 sm:py-4">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/* -----------------------------------------------------------------------------
   Export as compound component
   ----------------------------------------------------------------------------- */
export const SectionCard = Object.assign(SectionCardRoot, {
  Empty: SectionCardEmpty,
  Item: SectionCardItem,
  Badge: SectionCardBadge,
});

export type {
  SectionCardProps,
  SectionCardEmptyProps,
  SectionCardItemProps,
  SectionCardBadgeProps,
};
