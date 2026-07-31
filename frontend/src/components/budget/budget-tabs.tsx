"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Tab {
  id: string;
  label: string;
}

interface BudgetTabsProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  controls?: ReactNode;
}

const tabs: Tab[] = [
  { id: "budget", label: "Budget" },
  { id: "budget-changes", label: "Budget Changes" },
  { id: "budget-details", label: "Budget Details" },
  { id: "cost-codes", label: "Cost Codes" },
  { id: "forecasting", label: "Forecasting" },
  { id: "snapshots", label: "Project Status Snapshots" },
  { id: "change-history", label: "Change History" },
  { id: "settings", label: "Settings" },
];

/**
 * BudgetTabs - Matches site-standard tab styling with border-bottom
 * Aligned with PageHeader: px-4 sm:px-6 lg:px-8
 */
export function BudgetTabs({
  activeTab = "budget",
  onTabChange,
  controls,
}: BudgetTabsProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <nav
        className="-mb-px flex flex-col gap-2 border-b border-border xl:flex-row xl:items-end xl:justify-between xl:gap-4"
        aria-label="Budget Tabs"
      >
        <div className="min-w-0 max-w-full overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max space-x-4 md:space-x-6">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  type="button"
                  variant="ghost"
                  onClick={() => onTabChange?.(tab.id)}
                  className={cn(
                    "group inline-flex items-center gap-2 whitespace-nowrap border-b-2 rounded-none pb-4 pt-4 text-sm font-medium transition-colors h-auto px-0",
                    isActive
                      ? "border-primary text-primary hover:bg-transparent hover:text-primary"
                      : "border-transparent text-muted-foreground hover:border-transparent hover:text-primary hover:bg-transparent"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </div>
        {controls ? (
          <div className="flex min-w-0 items-center justify-end gap-1 pb-2 xl:ml-auto xl:shrink-0">
            {controls}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
