"use client";

import { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { cn } from "@/lib/utils";

interface BaseSidebarProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

/**
 * BaseSidebar - Reusable sidebar component for budget detail views
 *
 * Provides a consistent layout with:
 * - Dark header with title and close button
 * - Scrollable content area
 * - Responsive sizing
 */
export function BaseSidebar({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "lg",
}: BaseSidebarProps) {
  return (
    <SidePanel
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SidePanelContent
        size={size}
        side="right"
        className="flex h-full flex-col bg-background"
      >
        <SidePanelHeader className="px-4 py-4 sm:px-6">
          {subtitle ? (
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
          <SidePanelTitle className="tracking-tight">{title}</SidePanelTitle>
        </SidePanelHeader>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidePanelContent>
    </SidePanel>
  );
}

/**
 * SidebarBody - Scrollable content area
 */
export function SidebarBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <SidePanelBody className={className}>{children}</SidePanelBody>;
}

/**
 * SidebarFooter - Fixed footer area
 */
export function SidebarFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SidePanelFooter
      className={cn("bg-background px-4 py-4 sm:px-6", className)}
    >
      {children}
    </SidePanelFooter>
  );
}

/**
 * SidebarStats - the single summary line every drilldown panel renders above
 * its table: muted context on the left (cost code · count), the total on the
 * right. Plain typography from the type scale — no cards, no borders, no hero
 * metrics (noise-gate rules 15/17: spacing separates content; borders are
 * earned by interaction).
 */
export function SidebarStats({
  summary,
  value,
}: {
  summary: ReactNode;
  value?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-sm text-muted-foreground">{summary}</p>
      {value != null && (
        <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">
          {value}
        </p>
      )}
    </div>
  );
}

/**
 * SidebarFilterTabs - the single segmented control every drilldown uses to
 * filter its table (status / type). One shared primitive replaces the per-modal
 * hand-rolled pill-button rows (noise-gate: no one-off overrides, no pills where
 * a segmented control is clearer).
 */
export function SidebarFilterTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * SidebarTabs - Tab navigation for sidebar using standard section tabs
 */
export function SidebarTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}) {
  return (
    <div className="shrink-0 px-4 sm:px-8">
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="w-full justify-start">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="px-1.5 py-3 text-sm font-medium"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
