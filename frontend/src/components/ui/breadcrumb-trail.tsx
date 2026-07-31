"use client";

import * as React from "react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface BreadcrumbTrailItem {
  label: string;
  href?: string;
}

interface BreadcrumbTrailProps {
  items: BreadcrumbTrailItem[];
  className?: string;
  listClassName?: string;
  linkClassName?: string;
  currentClassName?: string;
  maxVisibleItems?: number;
  leadingItems?: number;
  trailingItems?: number;
}

function collapseItems(
  items: BreadcrumbTrailItem[],
  maxVisibleItems: number,
  leadingItems: number,
  trailingItems: number,
) {
  if (
    items.length <= maxVisibleItems ||
    items.length <= leadingItems + trailingItems
  ) {
    return {
      leading: items,
      hidden: [] as BreadcrumbTrailItem[],
      trailing: [] as BreadcrumbTrailItem[],
    };
  }

  return {
    leading: items.slice(0, leadingItems),
    hidden: items.slice(leadingItems, items.length - trailingItems),
    trailing: items.slice(items.length - trailingItems),
  };
}

/**
 * A single crumb whose label is truncated by CSS. When (and only when) the
 * label is actually clipped, hovering/focusing it reveals the full label in a
 * tooltip — the crumb itself stays a real link, so a click still navigates.
 */
function TruncatingCrumb({
  crumb,
  isCurrent,
  linkClassName,
  currentClassName,
}: {
  crumb: BreadcrumbTrailItem;
  isCurrent: boolean;
  linkClassName?: string;
  currentClassName?: string;
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth + 1);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [crumb.label]);

  const inner =
    isCurrent || !crumb.href ? (
      <BreadcrumbPage
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cn("truncate", currentClassName)}
      >
        {crumb.label}
      </BreadcrumbPage>
    ) : (
      <BreadcrumbLink asChild className={cn("block truncate", linkClassName)}>
        <Link ref={ref as React.Ref<HTMLAnchorElement>} href={crumb.href}>
          {crumb.label}
        </Link>
      </BreadcrumbLink>
    );

  // Trigger is always present so the measured node never remounts; the tooltip
  // content only mounts when the label is clipped, so untruncated crumbs get no
  // redundant hover card.
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      {isTruncated ? (
        <TooltipContent side="bottom" className="max-w-xs">
          {crumb.label}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function renderCrumb(
  crumb: BreadcrumbTrailItem,
  isLast: boolean,
  indexKey: string,
  linkClassName?: string,
  currentClassName?: string,
) {
  return (
    <React.Fragment key={indexKey}>
      <BreadcrumbItem className="min-w-0 shrink">
        <TruncatingCrumb
          crumb={crumb}
          isCurrent={isLast}
          linkClassName={linkClassName}
          currentClassName={currentClassName}
        />
      </BreadcrumbItem>
      {!isLast ? <BreadcrumbSeparator className="shrink-0" /> : null}
    </React.Fragment>
  );
}

export function BreadcrumbTrail({
  items,
  className,
  listClassName,
  linkClassName,
  currentClassName,
  maxVisibleItems = 5,
  leadingItems = 2,
  trailingItems = 2,
}: BreadcrumbTrailProps) {
  const { leading, hidden, trailing } = collapseItems(
    items,
    maxVisibleItems,
    leadingItems,
    trailingItems,
  );

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList
        className={cn("min-w-0 flex-nowrap overflow-hidden", listClassName)}
      >
        {leading.map((crumb, index) =>
          renderCrumb(
            crumb,
            hidden.length === 0 && trailing.length === 0 && index === leading.length - 1,
            `leading-${index}-${crumb.label}`,
            linkClassName,
            currentClassName,
          ),
        )}

        {hidden.length > 0 ? (
          <>
            <BreadcrumbSeparator className="shrink-0" />
            <BreadcrumbItem className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <BreadcrumbEllipsis className="size-6" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {hidden.map((crumb, index) => (
                    <DropdownMenuItem key={`hidden-${index}-${crumb.label}`} asChild={Boolean(crumb.href)}>
                      {crumb.href ? (
                        <Link href={crumb.href} className="block truncate">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="block truncate">{crumb.label}</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="shrink-0" />
          </>
        ) : null}

        {trailing.map((crumb, index) =>
          renderCrumb(
            crumb,
            index === trailing.length - 1,
            `trailing-${index}-${crumb.label}`,
            linkClassName,
            currentClassName,
          ),
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
